/**
 * SHEHSWAR ONE360 - Approvals Module
 */
import { Global, Module } from '@nestjs/common';
import { ApprovalEngineService } from './approval-engine.service';

@Global()
@Module({
  providers: [ApprovalEngineService],
  exports: [ApprovalEngineService],
})
export class ApprovalsModule {}
