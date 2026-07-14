import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { Request, Response } from 'express';
import * as crypto from 'crypto';

@Injectable()
export class CorrelationInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const ctx = context.switchToHttp();
    const req = ctx.getRequest<Request>();
    const res = ctx.getResponse<Response>();

    const correlationId =
      req.headers['x-correlation-id'] ||
      req.headers['x-request-id'] ||
      crypto.randomUUID();

    // Attach correlation ID to request context so we can read it in service logs
    req['correlationId'] = correlationId;

    // Set correlation ID in response headers
    res.setHeader('x-correlation-id', String(correlationId));

    return next.handle();
  }
}
