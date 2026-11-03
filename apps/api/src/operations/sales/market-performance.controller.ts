/**
 * SHEHSWAR ONE360 - Market Performance Controller
 *
 * REST Endpoints:
 * - GET /api/v1/market-performance/group
 * - GET /api/v1/market-performance/region/:regionId
 * - GET /api/v1/market-performance/zone/:zoneId
 * - GET /api/v1/market-performance/territory/:territoryId
 * - GET /api/v1/market-performance/officer/:officerId
 * - GET /api/v1/market-performance/dealer/:dealerId
 */
import {
  Controller,
  Get,
  Param,
  Query,
  Headers,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../core/guards/jwt-auth.guard';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { AuthUser } from '@shehswar/types';
import { MarketPerformanceService, PerformanceFilter } from './market-performance.service';

@Controller('api/v1/market-performance')
@UseGuards(JwtAuthGuard)
export class MarketPerformanceController {
  constructor(private readonly performanceService: MarketPerformanceService) {}

  private resolveCompanyId(user: AuthUser, queryCompanyId?: string, headerCompanyId?: string): string {
    if (queryCompanyId && queryCompanyId.trim() !== '' && queryCompanyId.toLowerCase() !== 'all') {
      return queryCompanyId;
    }
    if (headerCompanyId && headerCompanyId.trim() !== '' && headerCompanyId.toLowerCase() !== 'all') {
      return headerCompanyId;
    }
    return user.companyId;
  }

  @Get('group')
  async getGroupPerformance(
    @CurrentUser() user: AuthUser,
    @Query() filter: PerformanceFilter,
    @Headers('x-company-id') headerCompanyId?: string,
  ) {
    const companyId = this.resolveCompanyId(user, filter.companyId, headerCompanyId);
    return this.performanceService.getGroupPerformance(companyId, filter);
  }

  @Get('region/:regionId')
  async getRegionPerformance(
    @Param('regionId') regionId: string,
    @CurrentUser() user: AuthUser,
    @Query() filter: PerformanceFilter,
    @Headers('x-company-id') headerCompanyId?: string,
  ) {
    const companyId = this.resolveCompanyId(user, filter.companyId, headerCompanyId);
    return this.performanceService.getRegionPerformance(companyId, regionId, filter);
  }

  @Get('zone/:zoneId')
  async getZonePerformance(
    @Param('zoneId') zoneId: string,
    @CurrentUser() user: AuthUser,
    @Query() filter: PerformanceFilter,
    @Headers('x-company-id') headerCompanyId?: string,
  ) {
    const companyId = this.resolveCompanyId(user, filter.companyId, headerCompanyId);
    return this.performanceService.getZonePerformance(companyId, zoneId, filter);
  }

  @Get('territory/:territoryId')
  async getTerritoryPerformance(
    @Param('territoryId') territoryId: string,
    @CurrentUser() user: AuthUser,
    @Query() filter: PerformanceFilter,
    @Headers('x-company-id') headerCompanyId?: string,
  ) {
    const companyId = this.resolveCompanyId(user, filter.companyId, headerCompanyId);
    return this.performanceService.getTerritoryPerformance(companyId, territoryId, filter);
  }

  @Get('officer/:officerId')
  async getOfficerPerformance(
    @Param('officerId') officerId: string,
    @CurrentUser() user: AuthUser,
    @Query() filter: PerformanceFilter,
    @Headers('x-company-id') headerCompanyId?: string,
  ) {
    const companyId = this.resolveCompanyId(user, filter.companyId, headerCompanyId);
    return this.performanceService.getOfficerPerformance(companyId, officerId, filter);
  }

  @Get('dealer/:dealerId')
  async getDealerCard(
    @Param('dealerId') dealerId: string,
    @CurrentUser() user: AuthUser,
    @Query() filter: PerformanceFilter,
    @Headers('x-company-id') headerCompanyId?: string,
  ) {
    const companyId = this.resolveCompanyId(user, filter.companyId, headerCompanyId);
    return this.performanceService.getDealerCard(companyId, dealerId, filter);
  }

  @Get('area-manager/:managerId')
  async getAreaManagerPerformance(
    @Param('managerId') managerId: string,
    @CurrentUser() user: AuthUser,
    @Query() filter: PerformanceFilter,
    @Headers('x-company-id') headerCompanyId?: string,
  ) {
    const companyId = this.resolveCompanyId(user, filter.companyId, headerCompanyId);
    return this.performanceService.getAreaManagerPerformance(companyId, managerId, filter);
  }

  @Get('business-manager/:managerId')
  async getBusinessManagerPerformance(
    @Param('managerId') managerId: string,
    @CurrentUser() user: AuthUser,
    @Query() filter: PerformanceFilter,
    @Headers('x-company-id') headerCompanyId?: string,
  ) {
    const companyId = this.resolveCompanyId(user, filter.companyId, headerCompanyId);
    return this.performanceService.getBusinessManagerPerformance(companyId, managerId, filter);
  }
}
