import { IdempotencyInterceptor } from './idempotency.interceptor';
import { CallHandler, ConflictException, ExecutionContext } from '@nestjs/common';
import { of } from 'rxjs';

describe('IdempotencyInterceptor', () => {
  let interceptor: IdempotencyInterceptor;

  beforeEach(() => {
    interceptor = new IdempotencyInterceptor();
  });

  const createMockContext = (
    method: string,
    url: string,
    body: any = {},
    headers: Record<string, string> = {},
    user: any = { id: 'user-1' },
  ): { context: ExecutionContext; res: any } => {
    const req = {
      method,
      url,
      body,
      headers,
      user,
    };
    const res = {
      statusCode: 200,
      status: jest.fn(),
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

    return { context, res };
  };

  it('should be defined', () => {
    expect(interceptor).toBeDefined();
  });

  it('should pass through GET requests without idempotency', (done) => {
    const { context } = createMockContext('GET', '/test');
    const handler: CallHandler = { handle: () => of({ result: 'data' }) };

    interceptor.intercept(context, handler).subscribe({
      next: (val) => {
        expect(val).toEqual({ result: 'data' });
        done();
      },
    });
  });

  it('should process POST requests normally on first call', (done) => {
    const { context } = createMockContext('POST', '/reports', { title: 'test' });
    const handler: CallHandler = { handle: () => of({ id: '1', title: 'test' }) };

    interceptor.intercept(context, handler).subscribe({
      next: (val) => {
        expect(val).toEqual({ id: '1', title: 'test' });
        done();
      },
    });
  });

  it('should skip idempotency checks for auth login route', (done) => {
    const { context } = createMockContext('POST', '/auth/login', { username: 'admin', password: 'pass' });
    const handler: CallHandler = { handle: () => of({ token: 'jwt' }) };

    interceptor.intercept(context, handler).subscribe({
      next: (val) => {
        expect(val).toEqual({ token: 'jwt' });
        done();
      },
    });
  });

  it('should skip idempotency checks for auth logout route', (done) => {
    const { context } = createMockContext('POST', '/auth/logout');
    const handler: CallHandler = { handle: () => of({ message: 'logged out' }) };

    interceptor.intercept(context, handler).subscribe({
      next: (val) => {
        expect(val).toEqual({ message: 'logged out' });
        done();
      },
    });
  });

  it('should return cached response for duplicate POST with same idempotency key', (done) => {
    const headers = { 'x-idempotency-key': 'unique-key-1' };
    const { context: ctx1 } = createMockContext('POST', '/reports', { title: 'dup' }, headers);
    const handler1: CallHandler = { handle: () => of({ id: '2', created: true }) };

    interceptor.intercept(ctx1, handler1).subscribe({
      next: () => {
        // Second call with same key
        const { context: ctx2 } = createMockContext('POST', '/reports', { title: 'dup' }, headers);
        const handler2: CallHandler = { handle: () => of({ id: '3', created: true }) };

        interceptor.intercept(ctx2, handler2).subscribe({
          next: (val) => {
            // Should return cached result from first call
            expect(val).toEqual({ id: '2', created: true });
            done();
          },
        });
      },
    });
  });

  it('should use anonymous userId when user is not present', (done) => {
    const { context } = createMockContext('POST', '/test', {}, {}, undefined);
    const handler: CallHandler = { handle: () => of('ok') };

    interceptor.intercept(context, handler).subscribe({
      next: () => done(),
    });
  });
});
