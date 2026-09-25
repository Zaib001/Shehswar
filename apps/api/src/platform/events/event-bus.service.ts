/**
 * SHEHSWAR ONE360 - Event Bus & Transactional Outbox Services
 */
import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter } from 'events';
import { PrismaService } from '../../core/database/prisma.service';
import { DomainEvent } from '@shehswar/types';
import { Prisma } from '@shehswar/database';

@Injectable()
export class EventBusService {
  private readonly emitter = new EventEmitter();
  private readonly logger = new Logger(EventBusService.name);

  publish<T>(event: DomainEvent<T>): void {
    this.logger.debug(`Publishing domain event: ${event.name} [ID: ${event.id}]`);
    this.emitter.emit(event.name, event);
    this.emitter.emit('*', event); // wildcard listener
  }

  subscribe<T>(eventName: string, handler: (event: DomainEvent<T>) => void | Promise<void>): void {
    this.emitter.on(eventName, async (event: DomainEvent<T>) => {
      try {
        await handler(event);
      } catch (error) {
        this.logger.error(`Error processing event ${eventName}`, error);
      }
    });
  }
}

@Injectable()
export class OutboxService {
  private readonly logger = new Logger(OutboxService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Persists an event into the transactional outbox table.
   * Can accept an existing Prisma transaction client (tx) so the event is
   * committed atomically alongside the business entities.
   */
  async recordOutboxEvent<T extends Record<string, unknown>>(
    event: DomainEvent<T>,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const client = tx ?? this.prisma;

    await client.domainEventOutbox.create({
      data: {
        id: event.id,
        eventName: event.name,
        aggregateType: event.name.split('.')[0] || 'unknown',
        aggregateId: (event.payload['id'] as string) || 'unknown',
        payload: event.payload as Prisma.InputJsonValue,
        correlationId: event.correlationId,
        organizationId: event.organizationId,
        companyId: event.companyId,
        actorId: event.actorId,
        status: 'PENDING',
      },
    });

    this.logger.debug(`Outbox event recorded: ${event.name} [${event.id}]`);
  }
}
