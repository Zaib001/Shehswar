/**
 * SHEHSWAR ONE360 - Outbox Relay Worker & Concurrency-Safe Claiming Service
 *
 * Guarantees At-Least-Once delivery of domain events without dual-write anomalies.
 * Employs optimistic/pessimistic row locking to prevent concurrent workers from
 * processing the same event. Supports exponential backoff and dead-letter handling.
 */
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { EventBusService } from './event-bus.service';
import { DomainEvent } from '@shehswar/types';

export interface ProcessBatchResult {
  claimed: number;
  published: number;
  failed: number;
  deadLettered: number;
}

@Injectable()
export class OutboxRelayService {
  private readonly logger = new Logger(OutboxRelayService.name);
  private static readonly MAX_RETRIES = 5;
  private static readonly LOCK_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes lock expiry

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
  ) {}

  /**
   * Concurrency-safe claiming of pending outbox events.
   * Concurrent workers cannot claim the same event.
   */
  async claimPendingEvents(workerId: string, batchSize: number = 20): Promise<string[]> {
    const now = new Date();
    const lockExpiry = new Date(now.getTime() - OutboxRelayService.LOCK_TIMEOUT_MS);

    // Atomically find and lock eligible records:
    // 1. Status is PENDING
    // 2. Or Status is PROCESSING but lock has expired (worker crashed)
    // 3. And nextRetryAt is null or in the past
    const eligibleRecords = await this.prisma.domainEventOutbox.findMany({
      where: {
        OR: [
          {
            status: 'PENDING',
            OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: now } }],
          },
          {
            status: 'PROCESSING',
            lockedAt: { lt: lockExpiry }, // stale lock reclamation
          },
        ],
      },
      select: { id: true },
      take: batchSize,
      orderBy: { createdAt: 'asc' },
    });

    if (eligibleRecords.length === 0) {
      return [];
    }

    const eligibleIds = eligibleRecords.map((r) => r.id);

    // Concurrency-safe atomic claim
    await this.prisma.domainEventOutbox.updateMany({
      where: {
        id: { in: eligibleIds },
        OR: [{ status: 'PENDING' }, { status: 'PROCESSING', lockedAt: { lt: lockExpiry } }],
      },
      data: {
        status: 'PROCESSING',
        lockedAt: now,
        lockedBy: workerId,
      },
    });

    // Re-verify claimed records owned by this worker
    const claimed = await this.prisma.domainEventOutbox.findMany({
      where: {
        id: { in: eligibleIds },
        lockedBy: workerId,
        status: 'PROCESSING',
      },
      select: { id: true },
    });

    return claimed.map((r) => r.id);
  }

  /**
   * Processes a single claimed outbox record with retry backoff & dead-letter handling
   */
  async processEvent(eventId: string): Promise<boolean> {
    const record = await this.prisma.domainEventOutbox.findUnique({
      where: { id: eventId },
    });

    if (!record || record.status !== 'PROCESSING') {
      return false;
    }

    const domainEvent: DomainEvent = {
      id: record.id,
      name: record.eventName,
      timestamp: record.createdAt.toISOString(),
      correlationId: record.correlationId,
      organizationId: record.organizationId,
      companyId: record.companyId ?? undefined,
      actorId: record.actorId ?? undefined,
      payload: record.payload as Record<string, unknown>,
      version: record.eventVersion,
    };

    try {
      // Dispatch through event bus to all registered subscribers
      this.eventBus.publish(domainEvent);

      // On success, mark PUBLISHED
      await this.prisma.domainEventOutbox.update({
        where: { id: eventId },
        data: {
          status: 'PUBLISHED',
          processedAt: new Date(),
          lockedAt: null,
          lockedBy: null,
          lastError: null,
        },
      });

      this.logger.debug(`Outbox event published successfully: ${record.eventName} [${record.id}]`);
      return true;
    } catch (err: any) {
      const errorMessage = err?.message || String(err);
      const nextRetryCount = record.retryCount + 1;
      const isDeadLetter = nextRetryCount >= OutboxRelayService.MAX_RETRIES;

      if (isDeadLetter) {
        // Move to DEAD-LETTER (FAILED) status
        await this.prisma.domainEventOutbox.update({
          where: { id: eventId },
          data: {
            status: 'FAILED',
            retryCount: nextRetryCount,
            lastError: `DEAD_LETTER: Max retries exceeded. Error: ${errorMessage}`,
            lockedAt: null,
            lockedBy: null,
            processedAt: new Date(),
          },
        });
        this.logger.error(
          `Outbox event dead-lettered after ${nextRetryCount} retries: ${record.eventName} [${record.id}]`,
        );
      } else {
        // Exponential backoff: 2^retryCount * 1000ms (1s, 2s, 4s, 8s, 16s...)
        const backoffMs = Math.min(Math.pow(2, nextRetryCount) * 1000, 300000);
        const nextRetryAt = new Date(Date.now() + backoffMs);

        await this.prisma.domainEventOutbox.update({
          where: { id: eventId },
          data: {
            status: 'PENDING',
            retryCount: nextRetryCount,
            nextRetryAt,
            lastError: errorMessage,
            lockedAt: null,
            lockedBy: null,
          },
        });

        this.logger.warn(
          `Outbox event failed attempt ${nextRetryCount}. Retrying at ${nextRetryAt.toISOString()}: ${record.eventName}`,
        );
      }

      return false;
    }
  }

  /**
   * Main relay tick: claims and processes a batch of outbox events
   */
  async processBatch(workerId: string, batchSize: number = 20): Promise<ProcessBatchResult> {
    const claimedIds = await this.claimPendingEvents(workerId, batchSize);
    let published = 0;
    let failed = 0;
    let deadLettered = 0;

    for (const id of claimedIds) {
      const success = await this.processEvent(id);
      if (success) {
        published++;
      } else {
        const record = await this.prisma.domainEventOutbox.findUnique({
          where: { id },
          select: { status: true },
        });
        if (record?.status === 'FAILED') {
          deadLettered++;
        } else {
          failed++;
        }
      }
    }

    return {
      claimed: claimedIds.length,
      published,
      failed,
      deadLettered,
    };
  }
}
