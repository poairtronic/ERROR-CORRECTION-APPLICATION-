import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  ConflictException,
} from '@nestjs/common';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';
import * as crypto from 'crypto';

interface IdempotencyRecord {
  status: 'processing' | 'completed';
  response?: any;
  statusCode?: number;
  timestamp: number;
}

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  // In-memory cache for idempotency keys
  private readonly cache = new Map<string, IdempotencyRecord>();
  private readonly TTL_MS = 10 * 60 * 1000; // 10 minutes

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const ctx = context.switchToHttp();
    const req = ctx.getRequest<Request>();
    const res = ctx.getResponse<Response>();

    // Only apply idempotency to mutating requests (POST, PATCH, PUT, DELETE)
    if (!['POST', 'PATCH', 'PUT', 'DELETE'].includes(req.method)) {
      return next.handle();
    }

    // Skip idempotency checks for auth routes to prevent conflict errors during rapid successive logins
    if (req.url.includes('/auth/login') || req.url.includes('/auth/logout')) {
      return next.handle();
    }

    const reqUser = req['user'] as any;
    const userId = reqUser?.id || reqUser?.sub || 'anonymous';
    const idempotencyKeyHeader = req.headers['x-idempotency-key'];

    let idempotencyKey: string;
    if (idempotencyKeyHeader) {
      idempotencyKey = `${userId}:${idempotencyKeyHeader}`;
    } else {
      // Fallback: Generate key based on request payload hash to prevent duplicate form submissions
      const bodyHash = crypto
        .createHash('sha256')
        .update(JSON.stringify(req.body || {}))
        .digest('hex');
      idempotencyKey = `${userId}:${req.method}:${req.url}:${bodyHash}`;
    }

    // Clean up expired keys
    this.cleanExpired();

    const record = this.cache.get(idempotencyKey);
    if (record) {
      if (record.status === 'processing') {
        throw new ConflictException(
          'A duplicate request is currently being processed. Please try again.',
        );
      }
      if (record.status === 'completed') {
        // Return the cached response
        res.status(record.statusCode || 200);
        return of(record.response);
      }
    }

    // Mark as processing
    this.cache.set(idempotencyKey, {
      status: 'processing',
      timestamp: Date.now(),
    });

    return next.handle().pipe(
      tap({
        next: (data) => {
          this.cache.set(idempotencyKey, {
            status: 'completed',
            response: data,
            statusCode: res.statusCode || 200,
            timestamp: Date.now(),
          });
        },
        error: () => {
          // On failure, remove from cache to allow retrying
          this.cache.delete(idempotencyKey);
        },
      }),
    );
  }

  private cleanExpired() {
    const now = Date.now();
    for (const [key, record] of this.cache.entries()) {
      if (now - record.timestamp > this.TTL_MS) {
        this.cache.delete(key);
      }
    }
  }
}
