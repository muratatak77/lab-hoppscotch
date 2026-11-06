import { CallHandler, ExecutionContext } from '@nestjs/common';
import { mockDeep, mockReset } from 'jest-mock-extended';
import { lastValueFrom, of, throwError } from 'rxjs';
import { MockServerLoggingInterceptor } from './mock-server-logging.interceptor';
import { MockServerService } from './mock-server.service';
import { MockServerAnalyticsService } from './mock-server-analytics.service';

const mockServerService = mockDeep<MockServerService>();
const mockAnalyticsService = mockDeep<MockServerAnalyticsService>();

const interceptor = new MockServerLoggingInterceptor(
  mockServerService,
  mockAnalyticsService,
);

const buildContext = (
  request: Record<string, any>,
  response: Record<string, any>,
) =>
  ({
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
  }) as unknown as ExecutionContext;

const buildRequest = (overrides: Record<string, any> = {}) => ({
  method: 'GET',
  path: '/mock/test-subdomain/users',
  headers: { 'user-agent': 'jest' },
  query: {},
  body: {},
  socket: { remoteAddress: '127.0.0.1' },
  mockServer: { id: 'mock123' },
  mockServerId: 'mock123',
  ...overrides,
});

const buildResponse = (statusCode: number) => ({
  statusCode,
  getHeaderNames: () => ['content-type'],
  getHeader: () => 'application/json',
});

beforeEach(() => {
  mockReset(mockServerService);
  mockReset(mockAnalyticsService);
  mockServerService.logRequest.mockResolvedValue();
  mockAnalyticsService.recordHit.mockResolvedValue();
});

describe('MockServerLoggingInterceptor', () => {
  test('should record a hit with the response status when the handler succeeds', async () => {
    const context = buildContext(buildRequest(), buildResponse(201));
    const next: CallHandler = { handle: () => of(undefined) };

    await lastValueFrom(interceptor.intercept(context, next), {
      defaultValue: undefined,
    });

    expect(mockAnalyticsService.recordHit).toHaveBeenCalledTimes(1);
    expect(mockAnalyticsService.recordHit).toHaveBeenCalledWith(
      'mock123',
      201,
      expect.any(Number),
    );
    expect(mockServerService.logRequest).toHaveBeenCalledWith(
      expect.objectContaining({ mockServerID: 'mock123', responseStatus: 201 }),
    );
  });

  test('should record a hit with the error status when the handler throws', async () => {
    const context = buildContext(buildRequest(), buildResponse(200));
    const next: CallHandler = {
      handle: () => throwError(() => ({ status: 502 })),
    };

    await expect(
      lastValueFrom(interceptor.intercept(context, next)),
    ).rejects.toEqual({ status: 502 });

    expect(mockAnalyticsService.recordHit).toHaveBeenCalledWith(
      'mock123',
      502,
      expect.any(Number),
    );
  });

  test('should default to 500 for errors without a status', async () => {
    const context = buildContext(buildRequest(), buildResponse(200));
    const next: CallHandler = {
      handle: () => throwError(() => new Error('boom')),
    };

    await expect(
      lastValueFrom(interceptor.intercept(context, next)),
    ).rejects.toThrow('boom');

    expect(mockAnalyticsService.recordHit).toHaveBeenCalledWith(
      'mock123',
      500,
      expect.any(Number),
    );
  });

  test('should skip analytics when the guard did not resolve a mock server', async () => {
    const context = buildContext(
      buildRequest({ mockServer: undefined, mockServerId: undefined }),
      buildResponse(404),
    );
    const next: CallHandler = { handle: () => of(undefined) };

    await lastValueFrom(interceptor.intercept(context, next), {
      defaultValue: undefined,
    });

    expect(mockAnalyticsService.recordHit).not.toHaveBeenCalled();
    expect(mockServerService.logRequest).not.toHaveBeenCalled();
  });
});
