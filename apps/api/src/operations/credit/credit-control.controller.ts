/**
 * SHEHSWAR ONE360 - Credit Control Controller
 */
import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../core/guards/jwt-auth.guard';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { AuthUser, CreditLevel } from '@shehswar/types';
import {
  CreditControlService,
  CreditCheckInput,
  SetCreditLimitDto,
  CreateCreditOverrideDto,
} from './credit-control.service';

@Controller('api/v1/credit')
@UseGuards(JwtAuthGuard)
export class CreditControlController {
  constructor(private readonly creditService: CreditControlService) {}

  @Post('check')
  async checkCredit(
    @Body() body: CreditCheckInput,
    @CurrentUser() user: AuthUser,
  ) {
    const companyId = body.companyId || user.companyId;
    return this.creditService.checkCredit({
      ...body,
      companyId,
    });
  }

  @Get('dashboard')
  async getDashboard(
    @CurrentUser() user: AuthUser,
    @Query('companyId') companyId?: string,
  ) {
    const targetCompanyId = companyId || user.companyId;
    return this.creditService.getCreditDashboard(targetCompanyId);
  }

  @Get('limits')
  async getLimits(
    @CurrentUser() user: AuthUser,
    @Query('companyId') companyId?: string,
    @Query('level') level?: CreditLevel,
  ) {
    const targetCompanyId = companyId || user.companyId;
    return this.creditService.getCreditLimits(targetCompanyId, level);
  }

  @Post('limits')
  async setLimit(
    @Body() dto: SetCreditLimitDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.creditService.setCreditLimit(dto, user);
  }

  @Get('overrides')
  async getOverrides(
    @CurrentUser() user: AuthUser,
    @Query('companyId') companyId?: string,
    @Query('status') status?: string,
  ) {
    const targetCompanyId = companyId || user.companyId;
    return this.creditService.getOverrideRequests(targetCompanyId, status);
  }

  @Post('overrides')
  async createOverride(
    @Body() dto: CreateCreditOverrideDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.creditService.createOverrideRequest(dto, user);
  }

  @Patch('overrides/:id/approve')
  async approveOverride(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.creditService.approveOverrideRequest(id, user);
  }

  @Patch('overrides/:id/reject')
  async rejectOverride(
    @Param('id') id: string,
    @Body('reason') reason: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.creditService.rejectOverrideRequest(id, reason || 'Rejected by management', user);
  }

  @Get('targets')
  async getTargets(
    @CurrentUser() user: AuthUser,
    @Query('companyId') companyId?: string,
    @Query('year') year?: string,
    @Query('month') month?: string,
  ) {
    const targetCompanyId = companyId || user.companyId;
    return this.creditService.getSalesTargets(
      targetCompanyId,
      year ? parseInt(year, 10) : undefined,
      month ? parseInt(month, 10) : undefined,
    );
  }

  @Get('percentage-report')
  async getPercentageReport(
    @CurrentUser() user: AuthUser,
    @Query('companyId') companyId?: string,
    @Query('regionId') regionId?: string,
    @Query('zoneId') zoneId?: string,
    @Query('territoryId') territoryId?: string,
    @Query('salesOfficerId') salesOfficerId?: string,
    @Query('dealerId') dealerId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const targetCompanyId = companyId || user.companyId;
    return this.creditService.getPercentageCreditReport({
      companyId: targetCompanyId,
      regionId,
      zoneId,
      territoryId,
      salesOfficerId,
      dealerId,
      startDate,
      endDate,
    });
  }
}

