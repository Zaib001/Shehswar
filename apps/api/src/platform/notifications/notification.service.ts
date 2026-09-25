/**
 * SHEHSWAR ONE360 - Decoupled Notification Dispatcher
 *
 * Separates business events from notification transport.
 * Dispatches to In-App, Email, SMS, and WhatsApp channels.
 */
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { NotificationPayload, NotificationChannel } from '@shehswar/types';

export interface NotificationProvider {
  channel: NotificationChannel;
  send(payload: NotificationPayload): Promise<boolean>;
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Enqueues or delivers a notification across the requested channel
   */
  async dispatch(payload: NotificationPayload): Promise<void> {
    this.logger.log(
      `Dispatching ${payload.channel} notification to ${payload.recipientId} [Template: ${payload.templateCode}]`,
    );

    // 1. If IN_APP, write directly to UserNotification table for instant UI delivery
    if (payload.channel === NotificationChannel.IN_APP) {
      await this.prisma.userNotification.create({
        data: {
          userId: payload.recipientId,
          title: payload.title,
          body: payload.body,
          linkUrl: (payload.data?.['linkUrl'] as string) || null,
        },
      });
      return;
    }

    // 2. For external channels (Email, SMS, WhatsApp), queue into NotificationQueueItem
    await this.prisma.notificationQueueItem.create({
      data: {
        organizationId: payload.organizationId,
        companyId: payload.companyId,
        recipientId: payload.recipientId,
        channel: payload.channel,
        title: payload.title,
        body: payload.body,
        payload: (payload.data as any) ?? undefined,
        status: 'PENDING',
      },
    });
  }
}
