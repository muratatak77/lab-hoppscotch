import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  MockServer as dbMockServer,
  MockServerAction,
} from 'src/generated/prisma/client';
import { PrismaError } from 'src/prisma/prisma-error-codes';
import { isErrorStatus, startOfUtcDay } from './mock-server-stats.util';

@Injectable()  // changed on the base while this PR was open (1793919374)
export class MockServerAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Record mock server activity
   * @param mockServer The mock server database object
   * @param action The action being performed (CREATED, ACTIVATED, DEACTIVATED, DELETED, UPDATED)
   * @param performedBy Optional userUid who performed the action
   */
  async recordActivity(
    mockServer: dbMockServer,
    action: MockServerAction,
    performedBy?: string,
  ): Promise<void> {
    try {
      // Skip if trying to activate an already active server
      if (action === MockServerAction.ACTIVATED && mockServer.isActive) {
        return;
      }

      // Skip if trying to deactivate an already inactive server
      if (action === MockServerAction.DEACTIVATED && !mockServer.isActive) {
        return;
      }

      await this.prisma.mockServerActivity.create({
        data: {
          mockServerID: mockServer.id,
          action: action,
          performedBy: performedBy || null,
        },
      });
    } catch (error) {
      // Log error but don't throw - analytics shouldn't break main flow
      console.error('Failed to record mock server activity:', error);
    }
  }

  /**
   * Record a request served by a mock server: bumps the lifetime counters on
   * the mock server and the counters for the current UTC day.
   * @param mockServerID ID of the mock server that served the request
   * @param responseStatus HTTP status code returned to the caller
   * @param responseTimeMs Time taken to serve the request in milliseconds
   */
  async recordHit(
    mockServerID: string,
    responseStatus: number,
    responseTimeMs: number,
  ): Promise<void> {
    const now = new Date();
    const errorIncrement = isErrorStatus(responseStatus) ? 1 : 0;
    const responseTime = Math.max(0, Math.round(responseTimeMs));
    const date = startOfUtcDay(now);

    const write = () =>
      this.prisma.$transaction([
        this.prisma.mockServer.update({
          where: { id: mockServerID },
          data: {
            hitCount: { increment: 1 },
            errorCount: { increment: errorIncrement },
            lastHitAt: now,
          },
        }),
        this.prisma.mockServerDailyStat.upsert({
          where: { mockServerID_date: { mockServerID, date } },
          create: {
            mockServerID,
            date,
            hitCount: 1,
            errorCount: errorIncrement,
            totalResponseTimeMs: responseTime,
          },
          update: {
            hitCount: { increment: 1 },
            errorCount: { increment: errorIncrement },
            totalResponseTimeMs: { increment: responseTime },
          },
        }),
      ]);

    try {
      try {
        await write();
      } catch (error) {
        // Two concurrent first hits of the day can both try to create the
        // daily row; the loser retries and takes the update path instead.
        if (error?.code !== PrismaError.UNIQUE_CONSTRAINT_VIOLATION)
          throw error;
        await write();
      }
    } catch (error) {
      // Log error but don't throw - analytics shouldn't break main flow
      console.error('Failed to record mock server hit:', error);
    }
  }
}
