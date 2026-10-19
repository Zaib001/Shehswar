/**
 * SHEHSWAR ONE360 - Approvals Module
 */
import { Global, Module } from '@nestjs/common';
import { ApprovalEngineService } from './approval-engine.service';
import { ApprovalsController } from './approvals.controller';

@Global()
@Module({
  controllers: [ApprovalsController],
  providers: [ApprovalEngineService],
  exports: [ApprovalEngineService],
})
export class ApprovalsModule {}
