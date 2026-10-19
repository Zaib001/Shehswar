/**
 * SHEHSWAR ONE360 - Control & Audit Controller
 */
import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../core/guards/jwt-auth.guard';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { AuthUser } from '@shehswar/types';
import { ControlAuditService } from './control-audit.service';

@Controller('api/v1/audit-control')
@UseGuards(JwtAuthGuard)
export class ControlAuditController {
  constructor(private readonly auditService: ControlAuditService) {}

  @Get('orders')
  async getOrderControl(
    @CurrentUser() user: AuthUser,
    @Query('companyId') companyId?: string,
    @Query('regionId') regionId?: string,
    @Query('zoneId') zoneId?: string,
    @Query('territoryId') territoryId?: string,
    @Query('salesOfficerId') salesOfficerId?: string,
    @Query('dealerId') dealerId?: string,
    @Query('status') status?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('search') search?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const targetCompanyId = companyId || user.companyId;
    return this.auditService.getOrderControl(targetCompanyId, {
      regionId,
      zoneId,
      territoryId,
      salesOfficerId,
      dealerId,
      status,
      startDate,
      endDate,
      search,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }

  @Get('sales')
  async getSalesAudit(
    @CurrentUser() user: AuthUser,
    @Query('companyId') companyId?: string,
    @Query('regionId') regionId?: string,
    @Query('zoneId') zoneId?: string,
    @Query('territoryId') territoryId?: string,
    @Query('salesOfficerId') salesOfficerId?: string,
    @Query('dealerId') dealerId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const targetCompanyId = companyId || user.companyId;
    return this.auditService.getSalesAudit(targetCompanyId, {
      regionId,
      zoneId,
      territoryId,
      salesOfficerId,
      dealerId,
      startDate,
      endDate,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }

  @Get('purchases')
  async getPurchaseAudit(
    @CurrentUser() user: AuthUser,
    @Query('companyId') companyId?: string,
    @Query('vendorId') vendorId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('limit') limit?: string,
  ) {
    const targetCompanyId = companyId || user.companyId;
    return this.auditService.getPurchaseAudit(targetCompanyId, {
      vendorId,
      startDate,
      endDate,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get('payments')
  async getPaymentAudit(
    @CurrentUser() user: AuthUser,
    @Query('companyId') companyId?: string,
    @Query('dealerId') dealerId?: string,
    @Query('salesOfficerId') salesOfficerId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('limit') limit?: string,
  ) {
    const targetCompanyId = companyId || user.companyId;
    return this.auditService.getPaymentAudit(targetCompanyId, {
      dealerId,
      salesOfficerId,
      startDate,
      endDate,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get('impact/:sourceType/:sourceId')
  async getTransactionImpact(
    @Param('sourceType') sourceType: string,
    @Param('sourceId') sourceId: string,
  ) {
    return this.auditService.getTransactionAccountingImpact(sourceType, sourceId);
  }
}
