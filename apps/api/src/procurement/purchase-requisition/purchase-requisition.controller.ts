/**
 * SHEHSWAR ONE360 - Purchase Requisition Controller
 */
import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
} from '@nestjs/common';
import { PurchaseRequisitionService } from './purchase-requisition.service';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { CurrentContext } from '../../core/decorators/current-context.decorator';
import {
  AuthUser,
  CreatePurchaseRequisitionDto,
  UpdatePurchaseRequisitionDto,
  PurchaseRequisitionFilterDto,
  PurchaseRequisitionStatus,
  RequisitionPriority,
  SecurityContext,
} from '@shehswar/types';

@Controller('api/v1/procurement/purchase-requisitions')
export class PurchaseRequisitionController {
  constructor(
    private readonly requisitionService: PurchaseRequisitionService,
  ) {}

  @Get()
  async getRequisitions(
    @Query('organizationId') organizationId?: string,
    @Query('companyId') companyId?: string,
    @Query('departmentId') departmentId?: string,
    @Query('status') status?: PurchaseRequisitionStatus,
    @Query('priority') priority?: RequisitionPriority,
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

    const filter: PurchaseRequisitionFilterDto = {
      organizationId,
      companyId: effectiveCompanyId,
      departmentId,
      status,
      priority,
      search,
      page,
      limit,
    };
    return this.requisitionService.findAllRequisitions(filter);
  }

  @Get(':id')
  async getRequisition(@Param('id') id: string) {
    return this.requisitionService.findRequisitionById(id);
  }

  @Post()
  async createRequisition(
    @Body() dto: CreatePurchaseRequisitionDto,
    @CurrentUser() user?: AuthUser,
  ) {
    return this.requisitionService.createRequisition(dto, user);
  }

  @Patch(':id')
  async updateRequisition(
    @Param('id') id: string,
    @Body() dto: UpdatePurchaseRequisitionDto,
    @CurrentUser() user?: AuthUser,
  ) {
    return this.requisitionService.updateRequisition(id, dto, user);
  }

  @Post(':id/submit')
  async submitForApproval(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.requisitionService.submitForApproval(id, user);
  }

  @Post(':id/approve')
  async approveRequisition(
    @Param('id') id: string,
    @Body('comments') comments?: string,
    @CurrentUser() user?: AuthUser,
  ) {
    return this.requisitionService.processApproval(id, 'APPROVE', comments, user);
  }

  @Post(':id/reject')
  async rejectRequisition(
    @Param('id') id: string,
    @Body('comments') comments?: string,
    @CurrentUser() user?: AuthUser,
  ) {
    return this.requisitionService.processApproval(id, 'REJECT', comments, user);
  }

  @Post(':id/cancel')
  async cancelRequisition(
    @Param('id') id: string,
    @Body('reason') reason: string,
    @CurrentUser() user?: AuthUser,
  ) {
    return this.requisitionService.cancelRequisition(id, reason, user);
  }
}
