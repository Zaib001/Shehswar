/**
 * SHEHSWAR ONE360 - Events Module
 */
import { Global, Module } from '@nestjs/common';
import { EventBusService, OutboxService } from './event-bus.service';

@Global()
@Module({
  providers: [EventBusService, OutboxService],
  exports: [EventBusService, OutboxService],
})
export class EventsModule {}
