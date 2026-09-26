/**
 * SHEHSWAR ONE360 - Persistent Idempotency Service
 *
 * Guarantees exactly-once business execution on critical operations
 * (e.g. GRN generation, payment posting, PO approval, stock movement).
 */
import { Injectable, ConflictException, Logger } from '@nestjs/common';
import crypto from 'crypto';
import { PrismaService } from '../database/prisma.service';
import { IdempotencyCheckResult } from '@shehswar/types';

import { Prisma } from '@shehswar/database';

export interface CheckOrLockParams {
  key: string;
  organizationId: string;
  userId?: string;
  endpoint: string;
  payload: unknown;
  ttlSeconds?: number;
}

@Injectable()
export class IdempotencyService {
  private readonly logger = new Logger(IdempotencyService.name);
  private static readonly DEFAULT_TTL_SECONDS = 86400; // 24 hours

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generates a deterministic SHA-256 fingerprint from a JSON-serializable payload
   */
  hashPayload(payload: unknown): string {
    const serialized = JSON.stringify(payload ?? {});
    return crypto.createHash('sha256').update(serialized).digest('hex');
  }

  /**
   * Validates idempotency key against historical database records.
   * If not found, claims the key in PENDING status.
   */
  async checkOrLock(params: CheckOrLockParams): Promise<IdempotencyCheckResult> {
    const { key, organizationId, userId, endpoint, payload } = params;
    const requestHash = this.hashPayload(payload);
    const ttlSeconds = params.ttlSeconds ?? IdempotencyService.DEFAULT_TTL_SECONDS;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlSeconds * 1000);

    const existing = await this.prisma.idempotencyRecord.findUnique({
      where: {
        organizationId_key: {
          organizationId,
          key,
        },
      },
    });

    if (existing) {
      // Check for expiration
      if (existing.expiresAt < now) {
        this.logger.debug(`Idempotency key '${key}' expired. Refreshing.`);
        await this.prisma.idempotencyRecord.update({
          where: { id: existing.id },
          data: {
            requestHash,
            status: 'PENDING',
            endpoint,
            userId,
            responseStatus: null,
            responseBody: Prisma.DbNull,
            expiresAt,
          },
        });
        return { state: 'NEW' };
      }

      // Check for fingerprint mismatch (Same Key + Different Payload)
      if (existing.requestHash !== requestHash) {
        this.logger.warn(`Idempotency conflict: key '${key}' presented with differing payload`);
        throw new ConflictException({
          code: 'IDEMPOTENCY_PAYLOAD_MISMATCH',
          message:
            'An idempotency conflict occurred: the request payload does not match the original request for this key.',
          key,
        });
      }

      // Check for in-flight concurrent execution
      if (existing.status === 'PENDING') {
        this.logger.warn(`Idempotency concurrent execution: key '${key}' is currently PENDING`);
        throw new ConflictException({
          code: 'IDEMPOTENCY_IN_PROGRESS',
          message:
            'A request with this idempotency key is currently being processed. Please wait for completion.',
          key,
        });
      }

      // Completed request replay (Same Key + Same Payload)
      return {
        state: 'REPLAY',
        record: {
          id: existing.id,
          key: existing.key,
          organizationId: existing.organizationId,
          userId: existing.userId ?? undefined,
          endpoint: existing.endpoint,
          requestHash: existing.requestHash,
          status: existing.status as any,
          responseStatus: existing.responseStatus ?? undefined,
          responseBody: existing.responseBody,
          createdAt: existing.createdAt,
          updatedAt: existing.updatedAt,
          expiresAt: existing.expiresAt,
        },
      };
    }

    // New request: atomically claim the key in PENDING status
    await this.prisma.idempotencyRecord.create({
      data: {
        key,
        organizationId,
        userId,
        endpoint,
        requestHash,
        status: 'PENDING',
        expiresAt,
      },
    });

    return { state: 'NEW' };
  }

  /**
   * Stores the final successful response to replay for duplicate future submissions
   */
  async complete(
    organizationId: string,
    key: string,
    responseStatus: number,
    responseBody: unknown,
  ): Promise<void> {
    await this.prisma.idempotencyRecord.update({
      where: {
        organizationId_key: {
          organizationId,
          key,
        },
      },
      data: {
        status: 'COMPLETED',
        responseStatus,
        responseBody: responseBody as any,
      },
    });
  }

  /**
   * Marks idempotency record as FAILED if unhandled runtime exception occurred
   */
  async fail(organizationId: string, key: string): Promise<void> {
    try {
      await this.prisma.idempotencyRecord.update({
        where: {
          organizationId_key: {
            organizationId,
            key,
          },
        },
        data: {
          status: 'FAILED',
        },
      });
    } catch {
      // Ignore cleanup error on fail
    }
  }
}
