/**
 * SHEHSWAR ONE360 - Platform Services Aggregator Module
 */
import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { AuthorizationModule } from './authorization/authorization.module';
import { AuditModule } from './audit/audit.module';
import { EventsModule } from './events/events.module';
import { StorageModule } from './storage/storage.module';
import { NotificationsModule } from './notifications/notifications.module';
import { ApprovalsModule } from './approvals/approvals.module';
import { SettingsModule } from './settings/settings.module';
import { DocumentNumberingModule } from './document-numbering/document-numbering.module';
import { FeatureFlagsModule } from './feature-flags/feature-flags.module';
import { HealthModule } from './health/health.module';
import { TransactionService } from '../common/services/transaction.service';

@Module({
  imports: [
    AuthModule,
    AuthorizationModule,
    AuditModule,
    EventsModule,
    StorageModule,
    NotificationsModule,
    ApprovalsModule,
    SettingsModule,
    DocumentNumberingModule,
    FeatureFlagsModule,
    HealthModule,
  ],
  providers: [TransactionService],
  exports: [
    AuthModule,
    AuthorizationModule,
    AuditModule,
    EventsModule,
    StorageModule,
    NotificationsModule,
    ApprovalsModule,
    SettingsModule,
    DocumentNumberingModule,
    FeatureFlagsModule,
    HealthModule,
    TransactionService,
  ],
})
export class PlatformModule {}
