/**
 * SHEHSWAR ONE360 - Notification Engine Contracts
 */
import { NotificationChannel } from './enums.js';

export interface NotificationPayload {
  recipientId: string;
  recipientEmail?: string;
  recipientPhone?: string;
  organizationId: string;
  companyId?: string;
  channel: NotificationChannel;
  templateCode: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
}

export interface InAppNotification {
  id: string;
  userId: string;
  title: string;
  body: string;
  linkUrl?: string;
  category?: 'APPROVAL' | 'SYSTEM' | 'SECURITY' | 'WARNING' | string;
  priority?: 'low' | 'normal' | 'high' | 'urgent' | 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  isRead: boolean;
  createdAt: Date;
  readAt?: Date;
}
