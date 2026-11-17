/**
 * SHEHSWAR ONE360 - Operational Purchase Order Controller
 */
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { OperationalPoService, CreateOperationalPoDto } from './purchase-order.service';
import { JwtAuthGuard } from '../../core/guards/jwt-auth.guard';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { CurrentContext } from '../../core/decorators/current-context.decorator';
import { AuthUser, SecurityContext } from '@shehswar/types';

@Controller('api/v1/operations/purchase-orders')
@UseGuards(JwtAuthGuard)
export class OperationalPoController {
  constructor(private readonly poService: OperationalPoService) {}

  @Get()
  async getPurchaseOrders(
    @Query('companyId') companyId?: string,
    @Query('status') status?: string,
    @Query('vendorId') vendorId?: string,
    @Query('search') search?: string,
    @CurrentUser() user?: AuthUser,
    @CurrentContext() ctx?: SecurityContext,
  ) {
    const effectiveCompanyId =
      (companyId && companyId !== 'ALL' ? companyId : undefined) ||
      (ctx?.companyId && ctx.companyId !== 'ALL' ? ctx.companyId : undefined) ||
      user?.companyId;
    return this.poService.findAll(effectiveCompanyId, { status, vendorId, search });
  }

  @Get('next-number')
  async getNextPoNumber(
    @Query('companyId') companyId?: string,
    @CurrentUser() user?: AuthUser,
    @CurrentContext() ctx?: SecurityContext,
  ) {
    const effectiveCompanyId =
      (companyId && companyId !== 'ALL' ? companyId : undefined) ||
      (ctx?.companyId && ctx.companyId !== 'ALL' ? ctx.companyId : undefined) ||
      user?.companyId;
    const poNumber = await this.poService.getNextPoNumber(effectiveCompanyId!, user?.organizationId);
    return { poNumber };
  }

  @Post('quick-create-vendor')
  async quickCreateVendor(
    @Body() body: { name: string; code?: string; vendorType?: string; phone?: string; email?: string; address?: string; companyId?: string },
    @CurrentUser() user: AuthUser,
    @CurrentContext() ctx?: SecurityContext,
  ) {
    if (!body.name || !body.name.trim()) throw new BadRequestException('Vendor name is required');
    const effectiveCompanyId =
      (body.companyId && body.companyId !== 'ALL' ? body.companyId : undefined) ||
      (ctx?.companyId && ctx.companyId !== 'ALL' ? ctx.companyId : undefined) ||
      user?.companyId;
    return this.poService.quickCreateVendor({ ...body, companyId: effectiveCompanyId }, user);
  }

  @Post('quick-create-material')
  async quickCreateMaterial(
    @Body() body: { itemName: string; materialType?: 'RAW_MATERIAL' | 'PACKING_MATERIAL' | 'OTHER' | 'FINISHED_PRODUCT'; packing?: string; unit?: string; purchaseRate?: number; companyId?: string },
    @CurrentUser() user: AuthUser,
    @CurrentContext() ctx?: SecurityContext,
  ) {
    if (!body.itemName || !body.itemName.trim()) throw new BadRequestException('Item name is required');
    const effectiveCompanyId =
      (body.companyId && body.companyId !== 'ALL' ? body.companyId : undefined) ||
      (ctx?.companyId && ctx.companyId !== 'ALL' ? ctx.companyId : undefined) ||
      user?.companyId;
    return this.poService.quickCreateMaterial({ ...body, companyId: effectiveCompanyId }, user);
  }

  @Get(':id')
  async getPurchaseOrder(
    @Param('id') id: string,
    @Query('companyId') companyId?: string,
    @CurrentUser() user?: AuthUser,
    @CurrentContext() ctx?: SecurityContext,
  ) {
    const effectiveCompanyId =
      (companyId && companyId !== 'ALL' ? companyId : undefined) ||
      (ctx?.companyId && ctx.companyId !== 'ALL' ? ctx.companyId : undefined) ||
      user?.companyId;
    return this.poService.findOne(id, effectiveCompanyId!);
  }

  @Post()
  async createPurchaseOrder(
    @Body() dto: CreateOperationalPoDto,
    @CurrentUser() user: AuthUser,
    @CurrentContext() ctx?: SecurityContext,
  ) {
    const effectiveCompanyId =
      (dto.companyId && dto.companyId !== 'ALL' ? dto.companyId : undefined) ||
      (ctx?.companyId && ctx.companyId !== 'ALL' ? ctx.companyId : undefined) ||
      user?.companyId;
    return this.poService.create({ ...dto, companyId: effectiveCompanyId }, user);
  }

  @Put(':id')
  async updatePurchaseOrder(
    @Param('id') id: string,
    @Body() dto: CreateOperationalPoDto,
    @CurrentUser() user: AuthUser,
    @CurrentContext() ctx?: SecurityContext,
  ) {
    const effectiveCompanyId =
      (dto.companyId && dto.companyId !== 'ALL' ? dto.companyId : undefined) ||
      (ctx?.companyId && ctx.companyId !== 'ALL' ? ctx.companyId : undefined) ||
      user?.companyId;
    return this.poService.update(id, { ...dto, companyId: effectiveCompanyId }, user);
  }

  @Post('batch')
  async createBatch(
    @Body() body: { purchaseOrders: CreateOperationalPoDto[] } | CreateOperationalPoDto[],
    @CurrentUser() user: AuthUser,
    @CurrentContext() ctx?: SecurityContext,
  ) {
    const effectiveCompanyId =
      (ctx?.companyId && ctx.companyId !== 'ALL' ? ctx.companyId : undefined) ||
      user?.companyId;
    const rawList = Array.isArray(body) ? body : body.purchaseOrders;
    const list = rawList.map((po) => ({
      ...po,
      companyId: (po.companyId && po.companyId !== 'ALL' ? po.companyId : undefined) || effectiveCompanyId,
    }));
    return this.poService.createBatch(list, user);
  }

  @Post(':id/confirm')
  async confirmPurchaseOrder(
    @Param('id') id: string,
    @Query('companyId') companyId?: string,
    @CurrentUser() user?: AuthUser,
    @CurrentContext() ctx?: SecurityContext,
  ) {
    const effectiveCompanyId =
      (companyId && companyId !== 'ALL' ? companyId : undefined) ||
      (ctx?.companyId && ctx.companyId !== 'ALL' ? ctx.companyId : undefined) ||
      user?.companyId;
    return this.poService.updateStatus(id, 'CONFIRMED', effectiveCompanyId!);
  }

  @Post(':id/cancel')
  async cancelPurchaseOrder(
    @Param('id') id: string,
    @Query('companyId') companyId?: string,
    @CurrentUser() user?: AuthUser,
    @CurrentContext() ctx?: SecurityContext,
  ) {
    const effectiveCompanyId =
      (companyId && companyId !== 'ALL' ? companyId : undefined) ||
      (ctx?.companyId && ctx.companyId !== 'ALL' ? ctx.companyId : undefined) ||
      user?.companyId;
    return this.poService.updateStatus(id, 'CANCELLED', effectiveCompanyId!);
  }

  @Delete(':id')
  async deletePurchaseOrder(
    @Param('id') id: string,
    @Query('companyId') companyId?: string,
    @CurrentUser() user?: AuthUser,
    @CurrentContext() ctx?: SecurityContext,
  ) {
    const effectiveCompanyId =
      (companyId && companyId !== 'ALL' ? companyId : undefined) ||
      (ctx?.companyId && ctx.companyId !== 'ALL' ? ctx.companyId : undefined) ||
      user?.companyId;
    return this.poService.delete(id, effectiveCompanyId);
  }
}
