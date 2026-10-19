/**
 * SHEHSWAR ONE360 - Goods Receipt Note Controller
 */
import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
} from '@nestjs/common';
import { GoodsReceiptService } from './goods-receipt.service';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { CurrentContext } from '../../core/decorators/current-context.decorator';
import {
  AuthUser,
  CreateGoodsReceiptNoteDto,
  GoodsReceiptFilterDto,
  UpdateQcStatusDto,
  GoodsReceiptStatus,
  QcStatus,
  SecurityContext,
} from '@shehswar/types';

@Controller('api/v1/procurement/goods-receipts')
export class GoodsReceiptController {
  constructor(private readonly grnService: GoodsReceiptService) {}

  @Get()
  async getGoodsReceipts(
    @Query('organizationId') organizationId?: string,
    @Query('companyId') companyId?: string,
    @Query('poId') poId?: string,
    @Query('vendorId') vendorId?: string,
    @Query('warehouseId') warehouseId?: string,
    @Query('status') status?: GoodsReceiptStatus,
    @Query('qcStatus') qcStatus?: QcStatus,
    @Query('search') search?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @CurrentUser() user?: AuthUser,
    @CurrentContext() ctx?: SecurityContext,
  ) {
    const isSuperAdmin = user?.isSuperAdmin === true;
    const effectiveCompanyId = isSuperAdmin
      ? (companyId === 'ALL' ? undefined : (companyId || ctx?.companyId))
      : (user?.companyId || ctx?.companyId);

    const filter: GoodsReceiptFilterDto = {
      organizationId,
      companyId: effectiveCompanyId,
      poId,
      vendorId,
      warehouseId,
      status,
      qcStatus,
      search,
      page,
      limit,
    };
    return this.grnService.findAllGoodsReceipts(filter);
  }

  @Get(':id')
  async getGoodsReceipt(@Param('id') id: string) {
    return this.grnService.findGoodsReceiptById(id);
  }

  @Post()
  async createGoodsReceipt(
    @Body() dto: CreateGoodsReceiptNoteDto,
    @CurrentUser() user?: AuthUser,
  ) {
    try {
      return await this.grnService.createGoodsReceipt(dto, user);
    } catch (err: any) {
      console.error('GRN_CONTROLLER_ERR:', err.message, err.stack);
      throw err;
    }
  }

  @Post(':id/qc-inspection')
  async updateQcInspection(
    @Param('id') id: string,
    @Body() dto: Omit<UpdateQcStatusDto, 'grnId'>,
    @CurrentUser() user?: AuthUser,
  ) {
    return this.grnService.updateQcInspection({ ...dto, grnId: id }, user);
  }
}
