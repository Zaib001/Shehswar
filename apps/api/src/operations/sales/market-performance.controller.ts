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

  @Get('group')
  async getGroupPerformance(
    @CurrentUser() user: AuthUser,
    @Query() filter: PerformanceFilter,
  ) {
    return this.performanceService.getGroupPerformance(user.companyId, filter);
  }

  @Get('region/:regionId')
  async getRegionPerformance(
    @Param('regionId') regionId: string,
    @CurrentUser() user: AuthUser,
    @Query() filter: PerformanceFilter,
  ) {
    return this.performanceService.getRegionPerformance(user.companyId, regionId, filter);
  }

  @Get('zone/:zoneId')
  async getZonePerformance(
    @Param('zoneId') zoneId: string,
    @CurrentUser() user: AuthUser,
    @Query() filter: PerformanceFilter,
  ) {
    return this.performanceService.getZonePerformance(user.companyId, zoneId, filter);
  }

  @Get('territory/:territoryId')
  async getTerritoryPerformance(
    @Param('territoryId') territoryId: string,
    @CurrentUser() user: AuthUser,
    @Query() filter: PerformanceFilter,
  ) {
    return this.performanceService.getTerritoryPerformance(user.companyId, territoryId, filter);
  }

  @Get('officer/:officerId')
  async getOfficerPerformance(
    @Param('officerId') officerId: string,
    @CurrentUser() user: AuthUser,
    @Query() filter: PerformanceFilter,
  ) {
    return this.performanceService.getOfficerPerformance(user.companyId, officerId, filter);
  }

  @Get('dealer/:dealerId')
  async getDealerCard(
    @Param('dealerId') dealerId: string,
    @CurrentUser() user: AuthUser,
    @Query() filter: PerformanceFilter,
  ) {
    return this.performanceService.getDealerCard(user.companyId, dealerId, filter);
  }

  @Get('area-manager/:managerId')
  async getAreaManagerPerformance(
    @Param('managerId') managerId: string,
    @CurrentUser() user: AuthUser,
    @Query() filter: PerformanceFilter,
  ) {
    return this.performanceService.getAreaManagerPerformance(user.companyId, managerId, filter);
  }

  @Get('business-manager/:managerId')
  async getBusinessManagerPerformance(
    @Param('managerId') managerId: string,
    @CurrentUser() user: AuthUser,
    @Query() filter: PerformanceFilter,
  ) {
    return this.performanceService.getBusinessManagerPerformance(user.companyId, managerId, filter);
  }
}
