/**
 * SHEHSWAR ONE360 - Operational Purchase Order Controller
 */
import {
  Controller,
  Get,
  Post,
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
import { AuthUser } from '@shehswar/types';

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
  ) {
    const effectiveCompanyId = companyId || user?.companyId;
    return this.poService.findAll(effectiveCompanyId, { status, vendorId, search });
  }

  @Get('next-number')
  async getNextPoNumber(@CurrentUser() user: AuthUser) {
    const poNumber = await this.poService.getNextPoNumber(user.companyId, user.organizationId);
    return { poNumber };
  }

  @Post('quick-create-vendor')
  async quickCreateVendor(
    @Body() body: { name: string; code?: string; vendorType?: string; phone?: string; email?: string; address?: string },
    @CurrentUser() user: AuthUser,
  ) {
    if (!body.name || !body.name.trim()) throw new BadRequestException('Vendor name is required');
    return this.poService.quickCreateVendor(body, user);
  }

  @Post('quick-create-material')
  async quickCreateMaterial(
    @Body() body: { itemName: string; materialType?: 'RAW_MATERIAL' | 'PACKING_MATERIAL'; packing?: string; unit?: string; purchaseRate?: number },
    @CurrentUser() user: AuthUser,
  ) {
    if (!body.itemName || !body.itemName.trim()) throw new BadRequestException('Item name is required');
    return this.poService.quickCreateMaterial(body, user);
  }

  @Get(':id')
  async getPurchaseOrder(
    @Param('id') id: string,
    @Query('companyId') companyId: string,
    @CurrentUser() user?: AuthUser,
  ) {
    const effectiveCompanyId = companyId || user?.companyId;
    return this.poService.findOne(id, effectiveCompanyId!);
  }

  @Post()
  async createPurchaseOrder(
    @Body() dto: CreateOperationalPoDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.poService.create(dto, user);
  }

  @Post('batch')
  async createBatch(
    @Body() body: { purchaseOrders: CreateOperationalPoDto[] } | CreateOperationalPoDto[],
    @CurrentUser() user: AuthUser,
  ) {
    const list = Array.isArray(body) ? body : body.purchaseOrders;
    return this.poService.createBatch(list, user);
  }

  @Post(':id/confirm')
  async confirmPurchaseOrder(
    @Param('id') id: string,
    @Query('companyId') companyId: string,
    @CurrentUser() user?: AuthUser,
  ) {
    const effectiveCompanyId = companyId || user?.companyId;
    return this.poService.updateStatus(id, 'CONFIRMED', effectiveCompanyId!);
  }

  @Post(':id/cancel')
  async cancelPurchaseOrder(
    @Param('id') id: string,
    @Query('companyId') companyId: string,
    @CurrentUser() user?: AuthUser,
  ) {
    const effectiveCompanyId = companyId || user?.companyId;
    return this.poService.updateStatus(id, 'CANCELLED', effectiveCompanyId!);
  }

  @Delete(':id')
  async deletePurchaseOrder(
    @Param('id') id: string,
    @Query('companyId') companyId?: string,
    @CurrentUser() user?: AuthUser,
  ) {
    const effectiveCompanyId = companyId || user?.companyId;
    return this.poService.delete(id, effectiveCompanyId);
  }
}
