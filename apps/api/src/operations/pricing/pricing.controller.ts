/**
 * SHEHSWAR ONE360 - Dynamic Rate Lists & Commercial Schemes API Controller
 *
 * REST Endpoints:
 * - GET    /api/v1/pricing/rate-lists
 * - GET    /api/v1/pricing/rate-lists/:id
 * - POST   /api/v1/pricing/rate-lists
 * - PUT    /api/v1/pricing/rate-lists/:id
 * - POST   /api/v1/pricing/rate-lists/:id/versions
 * - POST   /api/v1/pricing/rate-lists/:id/duplicate
 * - DELETE /api/v1/pricing/rate-lists/:id
 * - GET    /api/v1/pricing/active-products
 * - GET    /api/v1/pricing/schemes
 * - GET    /api/v1/pricing/schemes/:id
 * - POST   /api/v1/pricing/schemes
 * - PUT    /api/v1/pricing/schemes/:id
 * - GET    /api/v1/pricing/authority-limits
 * - PUT    /api/v1/pricing/authority-limits
 * - POST   /api/v1/pricing/resolve
 */
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../core/guards/jwt-auth.guard';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import {
  AuthUser,
  CreateRateListDto,
  UpdateRateListDto,
  CreateRateListVersionDto,
  CreatePricingSchemeDto,
  UpdatePricingSchemeDto,
  UpdatePricingAuthorityLimitDto,
  ResolvePriceDto,
} from '@shehswar/types';
import { PricingService, UpsertRateListDto } from './pricing.service';

@Controller('api/v1/pricing')
@UseGuards(JwtAuthGuard)
export class PricingController {
  constructor(private readonly pricingService: PricingService) {}

  // ==========================================
  // RATE LISTS
  // ==========================================

  @Get('rate-lists')
  async getRateLists(
    @CurrentUser() user: AuthUser,
    @Query('category') category?: string,
    @Query('status') status?: string,
    @Query('isMobileVisible') isMobileVisible?: string,
    // legacy query support
    @Query('finishedProductId') finishedProductId?: string,
    @Query('phase') phase?: string,
  ) {
    if (finishedProductId || phase) {
      return this.pricingService.getLegacyRateLists(user.companyId, { finishedProductId, phase });
    }
    return this.pricingService.getRateLists(user.companyId, {
      category,
      status,
      isMobileVisible: isMobileVisible !== undefined ? isMobileVisible === 'true' : undefined,
    });
  }

  @Get('rate-lists/:id')
  async getRateListById(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.pricingService.getRateListById(id, user.companyId);
  }

  @Post('rate-lists')
  async createRateList(
    @Body() dto: CreateRateListDto | UpsertRateListDto,
    @CurrentUser() user: AuthUser,
  ) {
    // If legacy UpsertRateListDto was passed
    if ('finishedProductId' in dto && 'phase' in dto) {
      return this.pricingService.upsertLegacyRateList(dto as UpsertRateListDto, user);
    }
    return this.pricingService.createRateList(dto as CreateRateListDto, user);
  }

  @Put('rate-lists/:id')
  async updateRateList(
    @Param('id') id: string,
    @Body() dto: UpdateRateListDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.pricingService.updateRateList(id, dto, user);
  }

  @Post('rate-lists/:id/versions')
  async createRateListVersion(
    @Param('id') id: string,
    @Body() dto: CreateRateListVersionDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.pricingService.createRateListVersion({ ...dto, rateListId: id }, user);
  }

  @Post('rate-lists/:id/duplicate')
  async duplicateRateList(
    @Param('id') id: string,
    @Body() body: { newCode: string; newName: string },
    @CurrentUser() user: AuthUser,
  ) {
    return this.pricingService.duplicateRateList(id, body.newCode, body.newName, user);
  }

  @Delete('rate-lists/:id')
  async archiveRateList(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.pricingService.archiveRateList(id, user);
  }

  // ==========================================
  // ACTIVE FINISHED PRODUCTS LOADER (REQUIREMENT 8)
  // ==========================================

  @Get('active-products')
  async getActiveProducts(@CurrentUser() user: AuthUser) {
    return this.pricingService.getActiveFinishedProductsForRateList(user.companyId);
  }

  // ==========================================
  // PRICING SCHEMES
  // ==========================================

  @Get('schemes')
  async getPricingSchemes(
    @CurrentUser() user: AuthUser,
    @Query('schemeType') schemeType?: string,
    @Query('status') status?: string,
    @Query('isMobileVisible') isMobileVisible?: string,
    @Query('paymentTerm') paymentTerm?: string,
  ) {
    return this.pricingService.getPricingSchemes(user.companyId, {
      schemeType,
      status,
      isMobileVisible: isMobileVisible !== undefined ? isMobileVisible === 'true' : undefined,
      paymentTerm,
    });
  }

  @Get('schemes/:id')
  async getPricingSchemeById(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.pricingService.getPricingSchemeById(id, user.companyId);
  }

  @Post('schemes')
  async createPricingScheme(
    @Body() dto: CreatePricingSchemeDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.pricingService.createPricingScheme(dto, user);
  }

  @Put('schemes/:id')
  async updatePricingScheme(
    @Param('id') id: string,
    @Body() dto: UpdatePricingSchemeDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.pricingService.updatePricingScheme(id, dto, user);
  }

  // ==========================================
  // PRICING AUTHORITY LIMITS
  // ==========================================

  @Get('authority-limits')
  async getAuthorityLimits(@CurrentUser() user: AuthUser) {
    return this.pricingService.getAuthorityLimits(user.organizationId, user.companyId);
  }

  @Put('authority-limits')
  async updateAuthorityLimit(
    @Body() dto: UpdatePricingAuthorityLimitDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.pricingService.updateAuthorityLimit(dto, user);
  }

  // ==========================================
  // PRICE RESOLUTION ENGINE (LIVE PREVIEW & CALCULATION)
  // ==========================================

  @Post('resolve')
  async resolvePrice(
    @Body() dto: ResolvePriceDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.pricingService.resolvePrice(dto, user);
  }
}
