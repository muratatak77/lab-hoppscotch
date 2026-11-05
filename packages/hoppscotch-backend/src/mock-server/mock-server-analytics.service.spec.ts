import { mockDeep, mockReset } from 'jest-mock-extended';
import { PrismaService } from '../prisma/prisma.service';
import { MockServerAnalyticsService } from './mock-server-analytics.service';
import { PrismaError } from '../prisma/prisma-error-codes';

const mockPrisma = mockDeep<PrismaService>();
const analyticsService = new MockServerAnalyticsService(mockPrisma);

const now = new Date('2026-11-05T23:59:30.000Z');
const today = new Date('2026-11-05T00:00:00.000Z');

beforeEach(() => {
  mockReset(mockPrisma);
  jest.useFakeTimers({ now });
  mockPrisma.$transaction.mockResolvedValue([]);
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('MockServerAnalyticsService', () => {
  describe('recordHit', () => {
    test('should bump lifetime and daily counters for a successful response', async () => {
      await analyticsService.recordHit('mock123', 200, 42);

      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
      expect(mockPrisma.mockServer.update).toHaveBeenCalledWith({
        where: { id: 'mock123' },
        data: {
          hitCount: { increment: 1 },
          errorCount: { increment: 0 },
          lastHitAt: now,
        },
      });
      expect(mockPrisma.mockServerDailyStat.upsert).toHaveBeenCalledWith({
        where: { mockServerID_date: { mockServerID: 'mock123', date: today } },
        create: {
          mockServerID: 'mock123',
          date: today,
          hitCount: 1,
          errorCount: 0,
          totalResponseTimeMs: 42,
        },
        update: {
          hitCount: { increment: 1 },
          errorCount: { increment: 0 },
          totalResponseTimeMs: { increment: 42 },
        },
      });
    });

    test.each([400, 404, 500, 503])(
      'should count a %i response as an error',
      async (status) => {
        await analyticsService.recordHit('mock123', status, 10);

        expect(mockPrisma.mockServer.update).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({ errorCount: { increment: 1 } }),
          }),
        );
        expect(mockPrisma.mockServerDailyStat.upsert).toHaveBeenCalledWith(
          expect.objectContaining({
            create: expect.objectContaining({ errorCount: 1 }),
            update: expect.objectContaining({ errorCount: { increment: 1 } }),
          }),
        );
      },
    );

    test('should not count redirects as errors', async () => {
      await analyticsService.recordHit('mock123', 304, 10);

      expect(mockPrisma.mockServerDailyStat.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ errorCount: 0 }),
        }),
      );
    });

    test('should round fractional and clamp negative response times', async () => {
      await analyticsService.recordHit('mock123', 200, 12.6);
      expect(mockPrisma.mockServerDailyStat.upsert).toHaveBeenLastCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({
            totalResponseTimeMs: { increment: 13 },
          }),
        }),
      );

      await analyticsService.recordHit('mock123', 200, -5);
      expect(mockPrisma.mockServerDailyStat.upsert).toHaveBeenLastCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({
            totalResponseTimeMs: { increment: 0 },
          }),
        }),
      );
    });

    test('should retry once when the daily row was created concurrently', async () => {
      mockPrisma.$transaction
        .mockRejectedValueOnce({
          code: PrismaError.UNIQUE_CONSTRAINT_VIOLATION,
        })
        .mockResolvedValueOnce([]);

      await analyticsService.recordHit('mock123', 200, 5);

      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(2);
    });

    test('should not retry or throw on other database errors', async () => {
      jest.spyOn(console, 'error').mockImplementation(() => undefined);
      mockPrisma.$transaction.mockRejectedValue(new Error('DB Error'));

      await expect(
        analyticsService.recordHit('mock123', 200, 5),
      ).resolves.toBeUndefined();
      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    });

    test('should not throw when the retry also fails', async () => {
      jest.spyOn(console, 'error').mockImplementation(() => undefined);
      mockPrisma.$transaction.mockRejectedValue({
        code: PrismaError.UNIQUE_CONSTRAINT_VIOLATION,
      });

      await expect(
        analyticsService.recordHit('mock123', 200, 5),
      ).resolves.toBeUndefined();
      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(2);
    });
  });
});
