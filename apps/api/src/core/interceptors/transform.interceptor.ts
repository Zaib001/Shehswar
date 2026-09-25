/**
 * SHEHSWAR ONE360 - Transform Response Interceptor
 *
 * Automatically wraps successful controller responses into the standard
 * enterprise envelope ApiResponse<T>.
 */
import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { RequestContext, ResponseBuilder } from '@shehswar/shared';
import { ApiResponse } from '@shehswar/types';

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, ApiResponse<T>> {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<ApiResponse<T>> {
    const start = Date.now();

    return next.handle().pipe(
      map((data) => {
        // If response is already an envelope (e.g. from PaginatedResponse or manual builder)
        if (data && typeof data === 'object' && 'success' in data && 'meta' in data) {
          return data;
        }

        const correlationId = RequestContext.getCorrelationId();
        const duration = Date.now() - start;
        return ResponseBuilder.success(data, correlationId, duration);
      }),
    );
  }
}
