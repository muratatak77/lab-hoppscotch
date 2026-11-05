import {
  buildMockServerStats,
  formatUtcDay,
  isErrorStatus,
  startOfUtcDay,
  windowStart,
} from './mock-server-stats.util';

const row = (
  date: string,
  hitCount: number,
  errorCount: number,
  totalResponseTimeMs: number,
) => ({
  date: new Date(`${date}T00:00:00.000Z`),
  hitCount,
  errorCount,
  totalResponseTimeMs,
});

describe('mock-server-stats.util', () => {
  describe('isErrorStatus', () => {
    test.each([
      [200, false],
      [302, false],
      [399, false],
      [400, true],
      [404, true],
      [500, true],
    ])('status %i -> %s', (status, expected) => {
      expect(isErrorStatus(status)).toBe(expected);
    });
  });

  describe('startOfUtcDay', () => {
    test('should truncate to midnight UTC regardless of the offset used to build the date', () => {
      expect(startOfUtcDay(new Date('2026-11-05T23:59:59.999Z'))).toEqual(
        new Date('2026-11-05T00:00:00.000Z'),
      );
      // 01:30 at +03:00 is still the previous day in UTC
      expect(startOfUtcDay(new Date('2026-11-05T01:30:00+03:00'))).toEqual(
        new Date('2026-11-04T00:00:00.000Z'),
      );
    });
  });

  describe('formatUtcDay', () => {
    test('should format using the UTC calendar day', () => {
      expect(formatUtcDay(new Date('2026-01-09T22:00:00-05:00'))).toBe(
        '2026-01-10',
      );
    });
  });

  describe('windowStart', () => {
    test('should include today as the last day of the window', () => {
      const today = new Date('2026-11-05T12:00:00.000Z');

      expect(windowStart(1, today)).toEqual(
        new Date('2026-11-05T00:00:00.000Z'),
      );
      expect(windowStart(7, today)).toEqual(
        new Date('2026-10-30T00:00:00.000Z'),
      );
    });

    test('should cross month and year boundaries', () => {
      expect(windowStart(3, new Date('2026-01-01T08:00:00.000Z'))).toEqual(
        new Date('2025-12-30T00:00:00.000Z'),
      );
    });
  });

  describe('buildMockServerStats', () => {
    const today = new Date('2026-03-02T18:00:00.000Z');

    test('should return a zeroed series when there is no traffic', () => {
      const stats = buildMockServerStats('mock123', [], 3, today);

      expect(stats).toEqual({
        mockServerID: 'mock123',
        hitCount: 0,
        errorCount: 0,
        avgResponseTimeMs: 0,
        daily: [
          {
            date: '2026-02-28',
            hitCount: 0,
            errorCount: 0,
            avgResponseTimeMs: 0,
          },
          {
            date: '2026-03-01',
            hitCount: 0,
            errorCount: 0,
            avgResponseTimeMs: 0,
          },
          {
            date: '2026-03-02',
            hitCount: 0,
            errorCount: 0,
            avgResponseTimeMs: 0,
          },
        ],
      });
    });

    test('should place rows on their day and aggregate window totals', () => {
      const stats = buildMockServerStats(
        'mock123',
        [row('2026-03-02', 3, 1, 31), row('2026-02-28', 2, 2, 400)],
        3,
        today,
      );

      expect(stats.daily.map((d) => d.date)).toEqual([
        '2026-02-28',
        '2026-03-01',
        '2026-03-02',
      ]);
      expect(stats.daily.map((d) => d.hitCount)).toEqual([2, 0, 3]);
      expect(stats.daily.map((d) => d.avgResponseTimeMs)).toEqual([200, 0, 10]);
      expect(stats.hitCount).toBe(5);
      expect(stats.errorCount).toBe(3);
      expect(stats.avgResponseTimeMs).toBe(86);
    });

    test('should ignore rows outside of the window', () => {
      const stats = buildMockServerStats(
        'mock123',
        [row('2026-02-01', 100, 100, 1000), row('2026-03-02', 1, 0, 7)],
        2,
        today,
      );

      expect(stats.daily).toHaveLength(2);
      expect(stats.hitCount).toBe(1);
      expect(stats.errorCount).toBe(0);
    });
  });
});
