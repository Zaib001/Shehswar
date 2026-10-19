/**
 * SHEHSWAR ONE360 - Purchase Order Controller
 */
import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
} from '@nestjs/common';
import { PurchaseOrderService } from './purchase-order.service';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { CurrentContext } from '../../core/decorators/current-context.decorator';
import {
  AuthUser,
  CreatePurchaseOrderDto,
  PurchaseOrderFilterDto,
  PurchaseOrderStatus,
  SecurityContext,
} from '@shehswar/types';

@Controller('api/v1/procurement/purchase-orders')
export class PurchaseOrderController {
  constructor(private readonly poService: PurchaseOrderService) {}

  @Get()
  async getPurchaseOrders(
    @Query('organizationId') organizationId?: string,
    @Query('companyId') companyId?: string,
    @Query('vendorId') vendorId?: string,
    @Query('status') status?: PurchaseOrderStatus,
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

    const filter: PurchaseOrderFilterDto = {
      organizationId,
      companyId: effectiveCompanyId,
      vendorId,
      status,
      search,
      page,
      limit,
    };
    return this.poService.findAllPurchaseOrders(filter);
  }

  @Get(':id')
  async getPurchaseOrder(@Param('id') id: string) {
    return this.poService.findPurchaseOrderById(id);
  }

  @Post()
  async createPurchaseOrder(
    @Body() dto: CreatePurchaseOrderDto,
    @CurrentUser() user?: AuthUser,
  ) {
    return this.poService.createPurchaseOrder(dto, user);
  }

  @Post(':id/submit')
  async submitForApproval(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.poService.submitForApproval(id, user);
  }

  @Post(':id/approve')
  async approvePurchaseOrder(
    @Param('id') id: string,
    @Body('comments') comments?: string,
    @CurrentUser() user?: AuthUser,
  ) {
    return this.poService.processApproval(id, 'APPROVE', comments, user);
  }

  @Post(':id/reject')
  async rejectPurchaseOrder(
    @Param('id') id: string,
    @Body('comments') comments?: string,
    @CurrentUser() user?: AuthUser,
  ) {
    return this.poService.processApproval(id, 'REJECT', comments, user);
  }

  @Post(':id/send-to-vendor')
  async sendToVendor(
    @Param('id') id: string,
    @CurrentUser() user?: AuthUser,
  ) {
    return this.poService.sendToVendor(id, user);
  }

  @Post(':id/cancel')
  async cancelPurchaseOrder(
    @Param('id') id: string,
    @Body('reason') reason: string,
    @CurrentUser() user?: AuthUser,
  ) {
    return this.poService.cancelPurchaseOrder(id, reason, user);
  }
}
