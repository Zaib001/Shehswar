/**
 * SHEHSWAR ONE360 - Vendor Performance Controller
 */
import {
  Controller,
  Get,
  Post,
  Param,
  Query,
} from '@nestjs/common';
import { VendorPerformanceService } from './vendor-performance.service';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { AuthUser } from '@shehswar/types';

@Controller('api/v1/procurement/vendor-performance')
export class VendorPerformanceController {
  constructor(private readonly performanceService: VendorPerformanceService) {}

  @Get('scorecards')
  async listScorecards(@Query('companyId') companyId?: string) {
    return this.performanceService.listScorecards(companyId);
  }

  @Get(':vendorId')
  async getPerformance(
    @Param('vendorId') vendorId: string,
    @Query('companyId') companyId: string,
  ) {
    return this.performanceService.getPerformance(vendorId, companyId);
  }

  @Post(':vendorId/recalculate')
  async recalculatePerformance(
    @Param('vendorId') vendorId: string,
    @Query('companyId') companyId: string,
    @CurrentUser() user?: AuthUser,
  ) {
    return this.performanceService.recalculatePerformance(vendorId, companyId, user);
  }
}
