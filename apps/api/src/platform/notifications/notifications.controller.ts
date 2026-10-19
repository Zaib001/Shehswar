/**
 * SHEHSWAR ONE360 - Notifications Controller
 */
import {
  Controller,
  Get,
  Patch,
  Post,
  Param,
  Query,
} from '@nestjs/common';
import { NotificationService } from './notification.service';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { AuthUser } from '@shehswar/types';

@Controller('api/v1/notifications')
export class NotificationsController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  async getNotifications(
    @CurrentUser() user: AuthUser,
    @Query('isRead') isRead?: string,
    @Query('category') category?: string,
    @Query('priority') priority?: string,
  ) {
    const read = isRead !== undefined ? isRead === 'true' : undefined;
    return this.notificationService.getUserNotifications(user.id, {
      isRead: read,
      category,
      priority,
    });
  }

  @Patch(':id/read')
  async markAsRead(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    await this.notificationService.markAsRead(id, user.id);
    return { success: true };
  }

  @Post('mark-all-read')
  async markAllRead(@CurrentUser() user: AuthUser) {
    await this.notificationService.markAllAsRead(user.id);
    return { success: true };
  }
}
