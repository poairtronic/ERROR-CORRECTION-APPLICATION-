import { CorrelationInterceptor } from './correlation.interceptor';
import { CallHandler, ExecutionContext } from '@nestjs/common';
import { of } from 'rxjs';

// Mock trace-context module
jest.mock('../trace-context', () => ({
  runWithTraceContext: jest.fn((_ctx, fn) => fn()),
}));

describe('CorrelationInterceptor', () => {
  let interceptor: CorrelationInterceptor;

  beforeEach(() => {
    interceptor = new CorrelationInterceptor();
  });

  const createMockContext = (headers: Record<string, string> = {}): { context: ExecutionContext; req: any; res: any } => {
    const req = {
      headers,
      method: 'GET',
      url: '/test',
      route: { path: '/test' },
    };
    const res = {
      statusCode: 200,
      setHeader: jest.fn(),
    };
    const context = {
      switchToHttp: () => ({
        getRequest: () => req,
        getResponse: () => res,
        getNext: jest.fn() as any,
      }),
      getHandler: jest.fn(),
      getClass: jest.fn(),
      getArgs: jest.fn(),
      getArgByIndex: jest.fn(),
      switchToRpc: jest.fn() as any,
      switchToWs: jest.fn() as any,
      getType: jest.fn() as any,
    } as unknown as ExecutionContext;

    return { context, req, res };
  };

  it('should be defined', () => {
    expect(interceptor).toBeDefined();
  });

  it('should generate correlation ID if not provided', (done) => {
    const { context, res } = createMockContext();
    const handler: CallHandler = { handle: () => of('ok') };

    interceptor.intercept(context, handler).subscribe({
      next: () => {
        expect(res.setHeader).toHaveBeenCalledWith('x-correlation-id', expect.any(String));
        expect(res.setHeader).toHaveBeenCalledWith('x-request-id', expect.any(String));
        done();
      },
    });
  });

  it('should use existing x-correlation-id from request header', (done) => {
    const { context, res } = createMockContext({ 'x-correlation-id': 'test-corr-123' });
    const handler: CallHandler = { handle: () => of('ok') };

    interceptor.intercept(context, handler).subscribe({
      next: () => {
        expect(res.setHeader).toHaveBeenCalledWith('x-correlation-id', 'test-corr-123');
        done();
      },
    });
  });

  it('should use existing x-request-id from request header', (done) => {
    const { context, res } = createMockContext({ 'x-request-id': 'test-req-456' });
    const handler: CallHandler = { handle: () => of('ok') };

    interceptor.intercept(context, handler).subscribe({
      next: () => {
        expect(res.setHeader).toHaveBeenCalledWith('x-request-id', 'test-req-456');
        done();
      },
    });
  });

  it('should attach correlationId and requestId to request object', (done) => {
    const { context, req } = createMockContext();
    const handler: CallHandler = { handle: () => of('ok') };

    interceptor.intercept(context, handler).subscribe({
      next: () => {
        expect(req['correlationId']).toBeDefined();
        expect(req['requestId']).toBeDefined();
        done();
      },
    });
  });
});
