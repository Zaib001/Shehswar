/**
 * SHEHSWAR ONE360 - Notifications Module
 */
import { Global, Module } from '@nestjs/common';
import { NotificationService } from './notification.service';

@Global()
@Module({
  providers: [NotificationService],
  exports: [NotificationService],
})
export class NotificationsModule {}
