import { MockServerDailyStat as dbMockServerDailyStat } from 'src/generated/prisma/client';
import { MockServerDailyStat, MockServerStats } from './mock-server.model';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Responses with a status at or above this value are counted as errors
 */
export const MOCK_SERVER_ERROR_STATUS_THRESHOLD = 400;

export function isErrorStatus(status: number): boolean {
  return status >= MOCK_SERVER_ERROR_STATUS_THRESHOLD;
}

/**
 * Truncate a date to midnight UTC. Daily stats are always bucketed in UTC so
 * that every instance writes to the same row regardless of server timezone.
 */
export function startOfUtcDay(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

/**
 * Format a date as YYYY-MM-DD using its UTC calendar day
 */
export function formatUtcDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function average(total: number, count: number): number {
  return count > 0 ? Math.round(total / count) : 0;
}

/**
 * Build a contiguous, oldest-first series of `days` UTC days ending at `today`,
 * filling days without a stored row with zeroes, and compute window totals.
 */
export function buildMockServerStats(
  mockServerID: string,
  rows: Pick<
    dbMockServerDailyStat,
    'date' | 'hitCount' | 'errorCount' | 'totalResponseTimeMs'
  >[],
  days: number,
  today: Date,
): MockServerStats {
  const rowsByDay = new Map(rows.map((row) => [formatUtcDay(row.date), row]));
  const end = startOfUtcDay(today).getTime();

  let hitCount = 0;
  let errorCount = 0;
  let totalResponseTimeMs = 0;
  const daily: MockServerDailyStat[] = [];

  for (let offset = days - 1; offset >= 0; offset--) {
    const date = formatUtcDay(new Date(end - offset * MS_PER_DAY));
    const row = rowsByDay.get(date);

    const dayHits = row?.hitCount ?? 0;
    const dayErrors = row?.errorCount ?? 0;
    // Stored as BigInt; a single day's or window's total stays well within
    // Number.MAX_SAFE_INTEGER, so converting here is lossless.
    const dayResponseTime = Number(row?.totalResponseTimeMs ?? 0);

    hitCount += dayHits;
    errorCount += dayErrors;
    totalResponseTimeMs += dayResponseTime;

    daily.push({
      date,
      hitCount: dayHits,
      errorCount: dayErrors,
      avgResponseTimeMs: average(dayResponseTime, dayHits),
    });
  }

  return {
    mockServerID,
    hitCount,
    errorCount,
    avgResponseTimeMs: average(totalResponseTimeMs, hitCount),
    daily,
  };
}

/**
 * First UTC day included in a window of `days` days ending at `today`
 */
export function windowStart(days: number, today: Date): Date {
  return new Date(startOfUtcDay(today).getTime() - (days - 1) * MS_PER_DAY);
}
