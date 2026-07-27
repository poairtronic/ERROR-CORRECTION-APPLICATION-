import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Response } from 'express';
import { PerformanceService } from '../../monitoring/performance.service';

@Injectable()
export class PerformanceInterceptor implements NestInterceptor {
  private readonly logger = new Logger('API_PERFORMANCE');

  constructor(private readonly performanceService: PerformanceService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const start = Date.now();
    const httpCtx = context.switchToHttp();
    const req = httpCtx.getRequest();
    const res = httpCtx.getResponse<Response>();

    this.performanceService.incrementActiveRequests();

    return next.handle().pipe(
      tap({
        next: (data: any) => {
          this.performanceService.decrementActiveRequests();
          const duration = Date.now() - start;
          const statusCode = res.statusCode || 200;
          const responseSize = this.calculateSize(data);
          this.logRequest(req, statusCode, duration, responseSize);
        },
        error: (err: any) => {
          this.performanceService.decrementActiveRequests();
          const duration = Date.now() - start;
          const statusCode = err.status || err.statusCode || 500;
          this.logRequest(req, statusCode, duration, 0, err);
        },
      }),
    );
  }

  private calculateSize(data: any): number {
    if (!data) return 0;
    try {
      if (typeof data === 'string') return Buffer.byteLength(data);
      if (Buffer.isBuffer(data)) return data.length;
      return Buffer.byteLength(JSON.stringify(data));
    } catch {
      return 0;
    }
  }

  private logRequest(req: any, statusCode: number, duration: number, responseSize: number, error?: any) {
    const url = req.originalUrl || req.url;
    const method = req.method;
    const userId = req.user?.id || req.user?.sub || 'Unauthenticated';

    const payload = {
      category: 'API',
      method,
      url,
      statusCode,
      duration,
      responseSize,
      userId,
    };

    let level: 'log' | 'warn' | 'error' = 'log';
    let message = `API Request ${method} ${url} completed in ${duration}ms (Status: ${statusCode}, Size: ${responseSize} bytes, User: ${userId})`;

    if (error) {
      level = 'error';
      message = `API Request ${method} ${url} failed in ${duration}ms (Status: ${statusCode}, User: ${userId}) - Error: ${error.message}`;
    } else if (duration > 1000) {
      level = 'error';
      message = `[CRITICAL_SLOW] API Request ${method} ${url} exceeded 1000ms threshold: ${duration}ms`;
    } else if (duration > 500) {
      level = 'error';
      message = `[SLOW_OPERATION] API Request ${method} ${url} exceeded 500ms threshold: ${duration}ms`;
    } else if (duration > 300) {
      level = 'warn';
      message = `[PERFORMANCE_WARN] API Request ${method} ${url} exceeded 300ms threshold: ${duration}ms`;
    } else if (duration > 100) {
      level = 'warn';
      message = `[PERFORMANCE_WARN] API Request ${method} ${url} exceeded 100ms threshold: ${duration}ms`;
    }

    if (level === 'error') {
      this.logger.error(payload, error ? error.stack : message);
    } else if (level === 'warn') {
      this.logger.warn(payload, message);
    } else {
      this.logger.log(payload, message);
    }
  }
}
