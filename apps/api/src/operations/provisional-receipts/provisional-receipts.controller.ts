/**
 * SHEHSWAR ONE360 - Provisional Receipts (PR) Controller
 */
import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../core/guards/jwt-auth.guard';
import {
  ProvisionalReceiptsService,
  CreateProvisionalReceiptDto,
  CreatePrAllocationDto,
} from './provisional-receipts.service';

@ApiTags('Provisional Receipts (PR)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/v1/provisional-receipts')
export class ProvisionalReceiptsController {
  constructor(private readonly service: ProvisionalReceiptsService) {}

  @Get()
  @ApiOperation({ summary: 'List Provisional Receipts with filters' })
  async getProvisionalReceipts(
    @Query('companyId') companyId?: string,
    @Query('status') status?: string,
    @Query('allocationStatus') allocationStatus?: string,
    @Query('paymentMethod') paymentMethod?: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
    @Query('search') search?: string,
  ) {
    return this.service.getProvisionalReceipts({
      companyId,
      status,
      allocationStatus,
      paymentMethod,
      fromDate,
      toDate,
      search,
    });
  }

  @Get('dashboard')
  @ApiOperation({ summary: 'Provisional Receipt Dashboard summary metrics' })
  async getPrDashboard(@Query('companyId') companyId?: string) {
    return this.service.getPrDashboard(companyId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'PR Drill-down: Header, products, allocations, and financial impact' })
  async getProvisionalReceiptById(@Param('id') id: string) {
    return this.service.getProvisionalReceiptById(id);
  }

  @Get(':id/audit')
  @ApiOperation({ summary: 'PR Complete auditable transaction history' })
  async getPrAudit(@Param('id') id: string) {
    return this.service.getPrAudit(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create new Provisional Receipt (PR)' })
  async createProvisionalReceipt(
    @Body() dto: CreateProvisionalReceiptDto,
    @Req() req: any,
  ) {
    const orgId = req.user?.organizationId || req.user?.orgId;
    const userId = req.user?.id;
    return this.service.createProvisionalReceipt(orgId, dto, userId);
  }

  @Post(':id/allocate')
  @ApiOperation({ summary: 'Allocate PR to Dealers (Reduces dealer outstanding & releases credit)' })
  async allocateProvisionalReceipt(
    @Param('id') id: string,
    @Body() body: { allocations: CreatePrAllocationDto[] },
    @Req() req: any,
  ) {
    const userId = req.user?.id;
    return this.service.allocateProvisionalReceipt(id, body.allocations, userId);
  }

  @Post(':id/reverse')
  @ApiOperation({ summary: 'Reverse PR (Restores dealer outstanding & credit exposure)' })
  async reverseProvisionalReceipt(
    @Param('id') id: string,
    @Body() body: { reason?: string },
    @Req() req: any,
  ) {
    const userId = req.user?.id;
    return this.service.reverseProvisionalReceipt(id, body?.reason || '', userId);
  }
}
