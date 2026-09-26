/**
 * SHEHSWAR ONE360 - Idempotent Domain Event Consumer Utility
 *
 * Prevents duplicate event delivery (At-Least-Once delivery side-effect)
 * from producing duplicate business mutations (e.g. double debiting inventory or double invoicing).
 */
import { Injectable, Logger } from '@nestjs/common';
import { DomainEvent } from '@shehswar/types';

@Injectable()
export class IdempotentConsumerService {
  private readonly logger = new Logger(IdempotentConsumerService.name);
  private readonly processedEventIds = new Set<string>();

  /**
   * Checks if an event has already been executed.
   * If not, executes the business mutation and records the event ID.
   */
  async consume<T>(
    event: DomainEvent<T>,
    businessLogic: (event: DomainEvent<T>) => Promise<void> | void,
  ): Promise<{ executed: boolean; duplicate: boolean }> {
    if (this.processedEventIds.has(event.id)) {
      this.logger.warn(
        `[Duplicate Suppressed] Event ${event.name} [ID: ${event.id}] already processed. Suppressing duplicate execution.`,
      );
      return { executed: false, duplicate: true };
    }

    // Execute business logic
    await businessLogic(event);

    // Record event as successfully consumed
    this.processedEventIds.add(event.id);
    return { executed: true, duplicate: false };
  }

  isProcessed(eventId: string): boolean {
    return this.processedEventIds.has(eventId);
  }

  clear(): void {
    this.processedEventIds.clear();
  }
}
