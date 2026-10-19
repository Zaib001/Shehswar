/**
 * SHEHSWAR ONE360 - Audit Controller
 */
import { Controller, Get, Param, Query } from '@nestjs/common';
import { AuditService } from './audit.service';
import { CurrentContext } from '../../core/decorators/current-context.decorator';
import { SecurityContext } from '@shehswar/types';

@Controller('api/v1/audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get('logs')
  async getLogs(
    @CurrentContext() ctx: SecurityContext,
    @Query('organizationId') orgId?: string,
    @Query('companyId') companyId?: string,
    @Query('actorId') actorId?: string,
    @Query('resource') resource?: string,
    @Query('action') action?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.auditService.query({
      organizationId: orgId || ctx.organizationId,
      companyId: companyId || ctx.companyId,
      actorId,
      resource,
      action,
      limit: limit ? parseInt(limit, 10) : 50,
      offset: offset ? parseInt(offset, 10) : 0,
    });
  }

  @Get('logs/:id')
  async getLogById(@Param('id') id: string) {
    return this.auditService.getById(id);
  }
}
