/**
 * SHEHSWAR ONE360 - Events Module
 */
import { Global, Module } from '@nestjs/common';
import { EventBusService, OutboxService } from './event-bus.service';
import { OutboxRelayService } from './outbox-relay.service';
import { IdempotentConsumerService } from './idempotent-consumer';

@Global()
@Module({
  providers: [EventBusService, OutboxService, OutboxRelayService, IdempotentConsumerService],
  exports: [EventBusService, OutboxService, OutboxRelayService, IdempotentConsumerService],
})
export class EventsModule {}
