import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';
import * as crypto from 'crypto';
import { runWithTraceContext } from '../trace-context';

@Injectable()
export class CorrelationInterceptor implements NestInterceptor {
  private readonly logger = new Logger(CorrelationInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const ctx = context.switchToHttp();
    const req = ctx.getRequest<Request>();
    const res = ctx.getResponse<Response>();

    const correlationId =
      req.headers['x-correlation-id'] ||
      req.headers['x-request-id'] ||
      crypto.randomUUID();

    const requestId =
      req.headers['x-request-id'] ||
      crypto.randomUUID();

    // Attach trace IDs to request context
    req['correlationId'] = correlationId;
    req['requestId'] = requestId;

    // Set trace headers on response
    res.setHeader('x-correlation-id', String(correlationId));
    res.setHeader('x-request-id', String(requestId));

    const traceCtx = {
      correlationId: String(correlationId),
      requestId: String(requestId),
      req,
    };

    const start = Date.now();

    // Execute within the AsyncLocalStorage run context
    return runWithTraceContext(traceCtx, () => {
      // Log request arrival
      this.logger.log({
        message: `HTTP Request: ${req.method} ${req.url}`,
        route: req.route?.path || req.url,
        method: req.method,
      });

      return next.handle().pipe(
        tap({
          next: () => {
            const duration = Date.now() - start;
            const statusCode = res.statusCode || 200;

            // Log request completion
            this.logger.log({
              message: `HTTP Response: ${req.method} ${req.url} - Status: ${statusCode} - Execution Time: ${duration}ms`,
              route: req.route?.path || req.url,
              method: req.method,
              statusCode,
              executionTime: duration,
            });

            // Threshold monitoring (TASK 6 - Slow API Detection)
            const slowApiThreshold = Number(process.env.SLOW_API_THRESHOLD_MS) || 1000;
            if (duration > slowApiThreshold) {
              this.logger.warn({
                message: `[SLOW_OPERATION] Slow API detected: ${req.method} ${req.url} took ${duration}ms (Threshold: ${slowApiThreshold}ms)`,
                route: req.route?.path || req.url,
                method: req.method,
                executionTime: duration,
                threshold: slowApiThreshold,
              });
            }
          },
          error: (err: any) => {
            const duration = Date.now() - start;
            const statusCode = err.status || err.statusCode || 500;

            this.logger.error({
              message: `HTTP Request Failed: ${req.method} ${req.url} - Status: ${statusCode} - Execution Time: ${duration}ms. Error: ${err.message}`,
              route: req.route?.path || req.url,
              method: req.method,
              statusCode,
              executionTime: duration,
              error: err.message,
            }, err.stack);
          },
        }),
      );
    });
  }
}
