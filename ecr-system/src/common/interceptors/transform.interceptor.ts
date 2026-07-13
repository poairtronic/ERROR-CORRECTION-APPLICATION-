import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface Response<T> {
  success: boolean;
  data: T;
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, Response<T>> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<Response<T>> {
    return next.handle().pipe(
      map(data => {
        // If data is already in standard format (e.g., from an exception filter or custom response), don't wrap it again.
        if (data && typeof data === 'object' && 'success' in data && 'data' in data) {
          return data as Response<T>;
        }
        return {
          success: true,
          data,
        };
      }),
    );
  }
}
