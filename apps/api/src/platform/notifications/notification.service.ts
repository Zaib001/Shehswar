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
          category: (payload.data?.['category'] as string)?.toUpperCase() || 'SYSTEM',
          priority: payload.priority ? payload.priority.toUpperCase() : 'NORMAL',
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

  /**
   * Retrieves notifications for a user with category, priority, and read filters
   */
  async getUserNotifications(
    userId: string,
    filter?: { isRead?: boolean; category?: string; priority?: string },
  ) {
    const where: any = { userId };
    if (filter?.isRead !== undefined) where.isRead = filter.isRead;
    if (filter?.category) where.category = filter.category.toUpperCase();
    if (filter?.priority) where.priority = filter.priority.toUpperCase();

    return this.prisma.userNotification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  /**
   * Marks a specific notification as read
   */
  async markAsRead(id: string, userId: string) {
    return this.prisma.userNotification.updateMany({
      where: { id, userId },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });
  }

  /**
   * Marks all notifications as read for a user
   */
  async markAllAsRead(userId: string) {
    return this.prisma.userNotification.updateMany({
      where: { userId, isRead: false },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });
  }
}

