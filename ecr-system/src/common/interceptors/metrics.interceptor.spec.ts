import { MetricsInterceptor } from './metrics.interceptor';
import { CallHandler, ExecutionContext } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { MonitoringService } from '../../monitoring/monitoring.service';

describe('MetricsInterceptor', () => {
  let interceptor: MetricsInterceptor;
  let monitoringService: Partial<MonitoringService>;

  beforeEach(() => {
    monitoringService = {
      recordRequest: jest.fn(),
    };
    interceptor = new MetricsInterceptor(monitoringService as MonitoringService);
  });

  const createMockContext = (statusCode = 200): ExecutionContext => ({
    switchToHttp: () => ({
      getRequest: jest.fn() as any,
      getResponse: <T = any>() => ({ statusCode }) as T,
      getNext: jest.fn() as any,
    }),
    getHandler: jest.fn(),
    getClass: jest.fn(),
    getArgs: jest.fn(),
    getArgByIndex: jest.fn(),
    switchToRpc: jest.fn() as any,
    switchToWs: jest.fn() as any,
    getType: jest.fn() as any,
  }) as unknown as ExecutionContext;

  it('should be defined', () => {
    expect(interceptor).toBeDefined();
  });

  it('should record request metrics on success', (done) => {
    const context = createMockContext(200);
    const handler: CallHandler = { handle: () => of({ result: 'ok' }) };

    interceptor.intercept(context, handler).subscribe({
      next: () => {
        expect(monitoringService.recordRequest).toHaveBeenCalledWith(200, expect.any(Number));
        done();
      },
    });
  });

  it('should record request metrics on error', (done) => {
    const context = createMockContext();
    const handler: CallHandler = {
      handle: () => throwError(() => ({ status: 500, message: 'fail' })),
    };

    interceptor.intercept(context, handler).subscribe({
      error: () => {
        expect(monitoringService.recordRequest).toHaveBeenCalledWith(500, expect.any(Number));
        done();
      },
    });
  });

  it('should default to status 500 if error has no status', (done) => {
    const context = createMockContext();
    const handler: CallHandler = {
      handle: () => throwError(() => ({ message: 'fail' })),
    };

    interceptor.intercept(context, handler).subscribe({
      error: () => {
        expect(monitoringService.recordRequest).toHaveBeenCalledWith(500, expect.any(Number));
        done();
      },
    });
  });
});
