import { TimeoutInterceptor } from './timeout.interceptor';
import { CallHandler, ExecutionContext, RequestTimeoutException } from '@nestjs/common';
import { of, delay } from 'rxjs';

describe('TimeoutInterceptor', () => {
  let interceptor: TimeoutInterceptor;

  beforeEach(() => {
    interceptor = new TimeoutInterceptor();
  });

  const mockContext = {} as ExecutionContext;

  it('should be defined', () => {
    expect(interceptor).toBeDefined();
  });

  it('should pass through requests that complete within timeout', (done) => {
    const mockHandler: CallHandler = {
      handle: () => of({ data: 'ok' }),
    };

    interceptor.intercept(mockContext, mockHandler).subscribe({
      next: (value) => {
        expect(value).toEqual({ data: 'ok' });
        done();
      },
      error: done.fail,
    });
  });

  it('should throw RequestTimeoutException when request exceeds timeout', (done) => {
    const mockHandler: CallHandler = {
      handle: () => of('slow').pipe(delay(16000)),
    };

    interceptor.intercept(mockContext, mockHandler).subscribe({
      next: () => done.fail('Should have thrown timeout'),
      error: (err) => {
        expect(err).toBeInstanceOf(RequestTimeoutException);
        done();
      },
    });
  }, 20000);

  it('should propagate non-timeout errors', (done) => {
    const mockHandler: CallHandler = {
      handle: () => {
        const { Observable } = require('rxjs');
        return new Observable((subscriber: any) => {
          subscriber.error(new Error('some other error'));
        });
      },
    };

    interceptor.intercept(mockContext, mockHandler).subscribe({
      next: () => done.fail('Should have thrown'),
      error: (err) => {
        expect(err.message).toBe('some other error');
        done();
      },
    });
  });
});
