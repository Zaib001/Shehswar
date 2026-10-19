/**
 * SHEHSWAR ONE360 - Consolidated & Hierarchical Reporting Controller
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
import { ConsolidatedReportingService, ReportFilter } from './consolidated-reporting.service';

@Controller('api/v1/reporting')
@UseGuards(JwtAuthGuard)
export class ConsolidatedReportingController {
  constructor(private readonly reportingService: ConsolidatedReportingService) {}

  @Get('group')
  async getGroupReport(
    @CurrentUser() _user: AuthUser,
    @Query('year') year?: number,
    @Query('month') month?: number,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const filter: ReportFilter = {
      year: year ? Number(year) : undefined,
      month: month ? Number(month) : undefined,
      startDate,
      endDate,
    };
    return this.reportingService.getGroupConsolidatedReport(filter);
  }

  @Get('company/:companyId')
  async getCompanyReport(
    @CurrentUser() _user: AuthUser,
    @Param('companyId') companyId: string,
    @Query('year') year?: number,
    @Query('month') month?: number,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const filter: ReportFilter = {
      year: year ? Number(year) : undefined,
      month: month ? Number(month) : undefined,
      startDate,
      endDate,
    };
    return this.reportingService.getCompanyConsolidatedReport(companyId, filter);
  }

  @Get('region/:regionId')
  async getRegionReport(
    @CurrentUser() user: AuthUser,
    @Param('regionId') regionId: string,
    @Query('companyId') companyId?: string,
    @Query('year') year?: number,
    @Query('month') month?: number,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const targetCompanyId = companyId || user.companyId;
    const filter: ReportFilter = {
      year: year ? Number(year) : undefined,
      month: month ? Number(month) : undefined,
      startDate,
      endDate,
    };
    return this.reportingService.getRegionReport(regionId, targetCompanyId, filter);
  }

  @Get('zone/:zoneId')
  async getZoneReport(
    @CurrentUser() user: AuthUser,
    @Param('zoneId') zoneId: string,
    @Query('companyId') companyId?: string,
    @Query('year') year?: number,
    @Query('month') month?: number,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const targetCompanyId = companyId || user.companyId;
    const filter: ReportFilter = {
      year: year ? Number(year) : undefined,
      month: month ? Number(month) : undefined,
      startDate,
      endDate,
    };
    return this.reportingService.getZoneReport(zoneId, targetCompanyId, filter);
  }

  @Get('territory/:territoryId')
  async getTerritoryReport(
    @CurrentUser() user: AuthUser,
    @Param('territoryId') territoryId: string,
    @Query('companyId') companyId?: string,
    @Query('year') year?: number,
    @Query('month') month?: number,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const targetCompanyId = companyId || user.companyId;
    const filter: ReportFilter = {
      year: year ? Number(year) : undefined,
      month: month ? Number(month) : undefined,
      startDate,
      endDate,
    };
    return this.reportingService.getTerritoryReport(territoryId, targetCompanyId, filter);
  }
}
