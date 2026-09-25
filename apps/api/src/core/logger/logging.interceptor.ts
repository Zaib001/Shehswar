/**
 * SHEHSWAR ONE360 - Structured Logging Interceptor
 */
import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { logger } from '@shehswar/logger';
import { RequestContext } from '@shehswar/shared';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const req = http.getRequest();
    const { method, url } = req;
    const start = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - start;
          const res = http.getResponse();
          logger.info(
            {
              method,
              url,
              statusCode: res.statusCode,
              durationMs: duration,
              correlationId: RequestContext.getCorrelationId(),
            },
            `HTTP ${method} ${url} ${res.statusCode} +${duration}ms`,
          );
        },
        error: (err) => {
          const duration = Date.now() - start;
          logger.error(
            {
              method,
              url,
              durationMs: duration,
              error: err.message,
              correlationId: RequestContext.getCorrelationId(),
            },
            `HTTP ${method} ${url} Failed +${duration}ms`,
          );
        },
      }),
    );
  }
}
