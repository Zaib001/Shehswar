/**
 * SHEHSWAR ONE360 - Approval Rules & Workflow Controller
 */
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
} from '@nestjs/common';
import { ApprovalEngineService } from './approval-engine.service';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { CurrentContext } from '../../core/decorators/current-context.decorator';
import { AuthUser, SecurityContext } from '@shehswar/types';

@Controller('api/v1/approvals')
export class ApprovalsController {
  constructor(private readonly approvalService: ApprovalEngineService) {}

  @Get('rules')
  async getRules(
    @CurrentContext() ctx: SecurityContext,
    @Query('companyId') companyId?: string,
    @Query('organizationId') orgId?: string,
  ) {
    return this.approvalService.getRules(
      orgId || ctx.organizationId || '',
      companyId || ctx.companyId,
    );
  }

  @Post('rules')
  async createRule(
    @Body()
    body: {
      documentType: string;
      minAmount?: number;
      maxAmount?: number;
      companyId?: string;
      organizationId?: string;
      ruleConfig: Record<string, unknown>;
    },
    @CurrentUser() user: AuthUser,
    @CurrentContext() ctx: SecurityContext,
  ) {
    return this.approvalService.createRule({
      organizationId: body.organizationId || ctx.organizationId || user.organizationId,
      companyId: body.companyId || ctx.companyId || user.companyId,
      documentType: body.documentType,
      minAmount: body.minAmount,
      maxAmount: body.maxAmount,
      ruleConfig: body.ruleConfig,
    });
  }

  @Patch('rules/:id')
  async updateRule(
    @Param('id') id: string,
    @Body()
    body: {
      minAmount?: number;
      maxAmount?: number;
      ruleConfig?: Record<string, unknown>;
      isActive?: boolean;
    },
  ) {
    return this.approvalService.updateRule(id, body);
  }

  @Delete('rules/:id')
  async deleteRule(@Param('id') id: string) {
    return this.approvalService.deleteRule(id);
  }

  @Get('requests')
  async getRequests(
    @CurrentContext() ctx: SecurityContext,
    @Query('status') status?: string,
    @Query('companyId') companyId?: string,
    @Query('organizationId') orgId?: string,
  ) {
    return this.approvalService.getRequests(
      orgId || ctx.organizationId || '',
      companyId || ctx.companyId,
      status,
    );
  }

  @Get('requests/:id/history')
  async getRequestHistory(@Param('id') id: string) {
    return this.approvalService.getRequestHistory(id);
  }

  @Post('requests/:id/action')
  async processAction(
    @Param('id') id: string,
    @Body() body: { action: 'APPROVE' | 'REJECT' | 'SEND_BACK'; comments?: string },
    @CurrentUser() user: AuthUser,
  ) {
    return this.approvalService.processAction({
      requestId: id,
      actorId: user.id,
      action: body.action,
      comments: body.comments,
    });
  }
}
