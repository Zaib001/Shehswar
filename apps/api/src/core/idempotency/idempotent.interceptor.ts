/**
 * SHEHSWAR ONE360 - Idempotency Interceptor
 *
 * Automatically inspects incoming requests for 'X-Idempotency-Key'.
 * Replays stored responses when a matching key and payload are found,
 * preventing duplicate database mutations.
 */
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  HttpStatus,
} from '@nestjs/common';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';
import { IdempotencyService } from './idempotency.service';
import { AuthUser } from '@shehswar/types';

@Injectable()
export class IdempotentInterceptor implements NestInterceptor {
  constructor(private readonly idempotencyService: IdempotencyService) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();

    const idempotencyKey = req.headers['x-idempotency-key'] as string | undefined;

    // If endpoint is not called with an idempotency key, execute standard handler pipeline
    if (!idempotencyKey) {
      return next.handle();
    }

    const user = req.user as AuthUser | undefined;
    const organizationId = user?.organizationId || 'default-system-org';
    const userId = user?.id;
    const endpoint = `${req.method} ${req.originalUrl || req.url}`;
    const payload = req.body;

    const checkResult = await this.idempotencyService.checkOrLock({
      key: idempotencyKey,
      organizationId,
      userId,
      endpoint,
      payload,
    });

    if (checkResult.state === 'REPLAY' && checkResult.record) {
      // Set header indicating replayed idempotency response
      res.setHeader('X-Idempotency-Replay', 'true');
      res.status(checkResult.record.responseStatus || HttpStatus.OK);
      return of(checkResult.record.responseBody);
    }

    // Process new request and store response upon successful completion
    return next.handle().pipe(
      tap({
        next: async (responseBody) => {
          const statusCode = res.statusCode || HttpStatus.OK;
          await this.idempotencyService.complete(
            organizationId,
            idempotencyKey,
            statusCode,
            responseBody,
          );
        },
        error: async () => {
          await this.idempotencyService.fail(organizationId, idempotencyKey);
        },
      }),
    );
  }
}
