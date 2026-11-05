-- AlterTable
ALTER TABLE "MockServer" ADD COLUMN "errorCount" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "MockServerDailyStat" (
    "id" TEXT NOT NULL,
    "mockServerID" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "hitCount" INTEGER NOT NULL DEFAULT 0,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "totalResponseTimeMs" BIGINT NOT NULL DEFAULT 0,
    "updatedOn" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "MockServerDailyStat_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MockServerDailyStat_mockServerID_date_key" ON "MockServerDailyStat"("mockServerID", "date");

-- AddForeignKey
ALTER TABLE "MockServerDailyStat" ADD CONSTRAINT "MockServerDailyStat_mockServerID_fkey" FOREIGN KEY ("mockServerID") REFERENCES "MockServer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: rebuild per-day counters from the request logs that still exist.
-- Days are bucketed in UTC to match how the application writes new rows.
-- Logs deleted before this migration cannot be recovered, so historical
-- totals may be lower than "MockServer"."hitCount" for older servers.
INSERT INTO "MockServerDailyStat" (
    "id",
    "mockServerID",
    "date",
    "hitCount",
    "errorCount",
    "totalResponseTimeMs",
    "updatedOn"
)
SELECT
    gen_random_uuid()::text,
    l."mockServerID",
    (l."executedAt" AT TIME ZONE 'UTC')::date,
    COUNT(*)::int,
    (COUNT(*) FILTER (WHERE l."responseStatus" >= 400))::int,
    COALESCE(SUM(l."responseTime"), 0)::bigint,
    CURRENT_TIMESTAMP
FROM "MockServerLog" l
GROUP BY l."mockServerID", (l."executedAt" AT TIME ZONE 'UTC')::date;

-- Backfill: seed the lifetime error counter from the same logs.
UPDATE "MockServer" ms
SET "errorCount" = e.cnt
FROM (
    SELECT "mockServerID", COUNT(*)::int AS cnt
    FROM "MockServerLog"
    WHERE "responseStatus" >= 400
    GROUP BY "mockServerID"
) e
WHERE ms."id" = e."mockServerID";
