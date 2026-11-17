/**
 * SHEHSWAR ONE360 - Purchase Controller
 * Base URL: /api/v1/purchases
 */
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../core/guards/jwt-auth.guard';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { CurrentContext } from '../../core/decorators/current-context.decorator';
import { PurchaseService } from './purchase.service';
import { AuthUser, SecurityContext, CreatePurchaseDto, CreatePurchaseReturnDto } from '@shehswar/types';

@Controller('api/v1/purchases')
@UseGuards(JwtAuthGuard)
export class PurchaseController {
  constructor(private readonly purchaseService: PurchaseService) {}

  // GET /api/v1/purchases
  @Get()
  async findAll(
    @CurrentUser() user: AuthUser,
    @CurrentContext() ctx: SecurityContext,
    @Query('companyId') queryCompanyId?: string,
    @Query('vendorId') vendorId?: string,
    @Query('warehouseId') warehouseId?: string,
    @Query('postingStatus') postingStatus?: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
    @Query('search') search?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const companyId =
      (queryCompanyId && queryCompanyId !== 'ALL' ? queryCompanyId : undefined) ||
      (ctx?.companyId && ctx.companyId !== 'ALL' ? ctx.companyId : undefined) ||
      user.companyId;
    return this.purchaseService.findAll(companyId, user.organizationId, {
      vendorId,
      warehouseId,
      postingStatus,
      fromDate,
      toDate,
      search,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }

  // POST /api/v1/purchases/returns  — purchase return
  @Post('returns')
  async createReturn(
    @Body() dto: CreatePurchaseReturnDto,
    @CurrentUser() user: AuthUser,
    @CurrentContext() ctx?: SecurityContext,
  ) {
    const effectiveCompanyId =
      (dto.companyId && dto.companyId !== 'ALL' ? dto.companyId : undefined) ||
      (ctx?.companyId && ctx.companyId !== 'ALL' ? ctx.companyId : undefined) ||
      user.companyId;
    return this.purchaseService.createReturn({ ...dto, companyId: effectiveCompanyId }, user);
  }

  // GET /api/v1/purchases/returns
  @Get('returns')
  async findAllReturns(
    @CurrentUser() user: AuthUser,
    @CurrentContext() ctx?: SecurityContext,
    @Query('companyId') queryCompanyId?: string,
    @Query('vendorId') vendorId?: string,
    @Query('limit') limit?: string,
  ) {
    const companyId =
      (queryCompanyId && queryCompanyId !== 'ALL' ? queryCompanyId : undefined) ||
      (ctx?.companyId && ctx.companyId !== 'ALL' ? ctx.companyId : undefined) ||
      user.companyId;
    return this.purchaseService.findAllReturns(companyId, {
      vendorId,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  // POST /api/v1/purchases/match-material  — fuzzy match before auto-create
  @Post('match-material')
  async matchMaterial(
    @Body() body: { itemName: string; companyId?: string },
    @CurrentUser() user: AuthUser,
    @CurrentContext() ctx?: SecurityContext,
  ) {
    const companyId =
      (body.companyId && body.companyId !== 'ALL' ? body.companyId : undefined) ||
      (ctx?.companyId && ctx.companyId !== 'ALL' ? ctx.companyId : undefined) ||
      user.companyId;
    return this.purchaseService.matchMaterial(body.itemName, companyId);
  }

  // POST /api/v1/purchases/auto-create-material  — create missing master after confirmation
  @Post('auto-create-material')
  async autoCreateMaterial(
    @Body()
    body: {
      materialType: 'RAW_MATERIAL' | 'PACKING_MATERIAL';
      itemName: string;
      packing?: string;
      purchaseRate?: number;
      companyId?: string;
    },
    @CurrentUser() user: AuthUser,
    @CurrentContext() ctx?: SecurityContext,
  ) {
    const companyId =
      (body.companyId && body.companyId !== 'ALL' ? body.companyId : undefined) ||
      (ctx?.companyId && ctx.companyId !== 'ALL' ? ctx.companyId : undefined) ||
      user.companyId;
    return this.purchaseService.autoCreateMaterial(
      {
        organizationId: user.organizationId,
        companyId,
        ...body,
      },
      user,
    );
  }

  // POST /api/v1/purchases/warehouses/quick-create  — inline warehouse creation
  @Post('warehouses/quick-create')
  async quickCreateWarehouse(
    @Body() body: { name: string; code?: string; location?: string; companyId?: string },
    @CurrentUser() user: AuthUser,
    @CurrentContext() ctx?: SecurityContext,
  ) {
    const companyId =
      (body.companyId && body.companyId !== 'ALL' ? body.companyId : undefined) ||
      (ctx?.companyId && ctx.companyId !== 'ALL' ? ctx.companyId : undefined) ||
      user.companyId;
    return this.purchaseService.quickCreateWarehouse({ ...body, companyId } as any, user);
  }

  // GET /api/v1/purchases/:id
  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @Query('companyId') queryCompanyId?: string,
    @CurrentUser() user?: AuthUser,
    @CurrentContext() ctx?: SecurityContext,
  ) {
    const companyId =
      (queryCompanyId && queryCompanyId !== 'ALL' ? queryCompanyId : undefined) ||
      (ctx?.companyId && ctx.companyId !== 'ALL' ? ctx.companyId : undefined) ||
      user?.companyId;
    return this.purchaseService.findOne(id, companyId!);
  }

  // POST /api/v1/purchases  — create DRAFT
  @Post()
  async create(
    @Body() dto: CreatePurchaseDto,
    @CurrentUser() user: AuthUser,
    @CurrentContext() ctx?: SecurityContext,
  ) {
    const companyId =
      (dto.companyId && dto.companyId !== 'ALL' ? dto.companyId : undefined) ||
      (ctx?.companyId && ctx.companyId !== 'ALL' ? ctx.companyId : undefined) ||
      user.companyId;
    return this.purchaseService.create({ ...dto, companyId }, user);
  }

  // POST /api/v1/purchases/batch  — batch create from multi-date sheet
  @Post('batch')
  async createBatch(
    @Body() body: { purchases: CreatePurchaseDto[] } | CreatePurchaseDto[],
    @CurrentUser() user: AuthUser,
    @CurrentContext() ctx?: SecurityContext,
  ) {
    const defaultCompanyId =
      (ctx?.companyId && ctx.companyId !== 'ALL' ? ctx.companyId : undefined) ||
      user.companyId;
    const rawList = Array.isArray(body) ? body : body.purchases;
    const list = rawList.map((p) => ({
      ...p,
      companyId: (p.companyId && p.companyId !== 'ALL' ? p.companyId : undefined) || defaultCompanyId,
    }));
    return this.purchaseService.createBatch(list, user);
  }

  // PATCH /api/v1/purchases/:id
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: Partial<CreatePurchaseDto>,
    @CurrentUser() user: AuthUser,
  ) {
    return this.purchaseService.update(id, dto, user);
  }

  // DELETE /api/v1/purchases/:id — reverse stock & ledger and delete
  @Delete(':id')
  async delete(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.purchaseService.deletePurchase(id, user);
  }

  // POST /api/v1/purchases/:id/post  — atomic posting
  @Post(':id/post')
  async post(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.purchaseService.postPurchase(id, user);
  }
}

// Direct alias controller for /api/v1/purchase-returns
@Controller('api/v1/purchase-returns')
@UseGuards(JwtAuthGuard)
export class PurchaseReturnsController {
  constructor(private readonly purchaseService: PurchaseService) {}

  @Get()
  async findAll(
    @CurrentUser() user: AuthUser,
    @CurrentContext() ctx?: SecurityContext,
    @Query('companyId') queryCompanyId?: string,
    @Query('vendorId') vendorId?: string,
    @Query('limit') limit?: string,
  ) {
    const companyId =
      (queryCompanyId && queryCompanyId !== 'ALL' ? queryCompanyId : undefined) ||
      (ctx?.companyId && ctx.companyId !== 'ALL' ? ctx.companyId : undefined) ||
      user.companyId;
    return this.purchaseService.findAllReturns(companyId, {
      vendorId,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Post()
  async create(
    @Body() dto: CreatePurchaseReturnDto,
    @CurrentUser() user: AuthUser,
    @CurrentContext() ctx?: SecurityContext,
  ) {
    const companyId =
      (dto.companyId && dto.companyId !== 'ALL' ? dto.companyId : undefined) ||
      (ctx?.companyId && ctx.companyId !== 'ALL' ? ctx.companyId : undefined) ||
      user.companyId;
    return this.purchaseService.createReturn({ ...dto, companyId }, user);
  }
}
