/**
 * SHEHSWAR ONE360 - Sales & Dealer Operations Controller
 * 
 * Endpoints for:
 *  - Dealers (/api/v1/dealers)
 *  - Sales Orders (/api/v1/sales-orders)
 *  - Sales Invoices (/api/v1/sales-invoices)
 *  - Sales Returns (/api/v1/sales-returns)
 *  - Dealer Payments (/api/v1/dealer-payments)
 *  - Vendor Payments (/api/v1/vendor-payments)
 *  - Warehouse Stock (/api/v1/warehouse-stock)
 */
import {
  Controller,
  Get,
  Post,
  Patch,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../core/guards/jwt-auth.guard';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { SalesService } from './sales.service';
import { DealerLedgerService } from '../ledger/dealer-ledger.service';
import { VendorLedgerService } from '../ledger/vendor-ledger.service';
import {
  AuthUser,
  CreateSalesOrderDto,
  ApproveSalesOrderDto,
  CreateSalesInvoiceDto,
  CreateSalesReturnDto,
} from '@shehswar/types';

// ==========================================
// DEALERS CONTROLLER (/api/v1/dealers)
// ==========================================
@Controller('api/v1/dealers')
@UseGuards(JwtAuthGuard)
export class DealersController {
  constructor(
    private readonly salesService: SalesService,
    private readonly dealerLedgerService: DealerLedgerService,
  ) {}

  @Get()
  async findAll(
    @CurrentUser() user: AuthUser,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('salesOfficerId') salesOfficerId?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.salesService.findAllDealers(
      user.companyId,
      {
        search,
        status,
        salesOfficerId,
        limit: limit ? parseInt(limit, 10) : undefined,
        offset: offset ? parseInt(offset, 10) : undefined,
      },
      user,
    );
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.salesService.findOneDealer(id, user.companyId, user);
  }

  @Get(':id/market-hierarchy')
  async getMarketHierarchy(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.salesService.getDealerMarketHierarchy(id, user.companyId);
  }

  @Get(':id/history')
  async getHistory(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.salesService.getDealerAssignmentHistory(id, user.companyId, user);
  }

  @Post()
  async create(@Body() dto: any, @CurrentUser() user: AuthUser) {
    return this.salesService.createDealer(dto, user);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: any,
    @CurrentUser() user: AuthUser,
  ) {
    return this.salesService.updateDealer(id, dto, user);
  }

  @Post(':id/assign-officers')
  async assignOfficers(
    @Param('id') id: string,
    @Body('userIds') userIds: string[],
    @CurrentUser() user: AuthUser,
  ) {
    return this.salesService.assignSalesOfficer(id, userIds, user);
  }

  @Get(':id/ledger')
  async getLedger(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.dealerLedgerService.getDealerLedger(id, user.companyId, {
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }

  @Get(':id/balance')
  async getBalance(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.dealerLedgerService.getDealerBalance(id, user.companyId);
  }

  @Post(':id/ledger/regenerate')
  async regenerateLedger(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.dealerLedgerService.recalculateLedger(id, user.companyId);
  }
}

// ==========================================
// SALES ORDERS CONTROLLER (/api/v1/sales-orders)
// ==========================================
@Controller('api/v1/sales-orders')
@UseGuards(JwtAuthGuard)
export class SalesOrdersController {
  constructor(private readonly salesService: SalesService) {}

  @Get()
  async findAll(
    @CurrentUser() user: AuthUser,
    @Query('dealerId') dealerId?: string,
    @Query('salesOfficerId') salesOfficerId?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.salesService.findAllOrders(
      user.companyId,
      {
        dealerId,
        salesOfficerId,
        status,
        search,
        limit: limit ? parseInt(limit, 10) : undefined,
        offset: offset ? parseInt(offset, 10) : undefined,
      },
      user,
    );
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.salesService.findOneOrder(id, user.companyId);
  }

  @Post()
  async create(@Body() dto: CreateSalesOrderDto, @CurrentUser() user: AuthUser) {
    return this.salesService.createOrder(dto, user);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: any,
    @CurrentUser() user: AuthUser,
  ) {
    return this.salesService.updateOrder(id, dto, user);
  }

  @Put(':id')
  async replace(
    @Param('id') id: string,
    @Body() dto: any,
    @CurrentUser() user: AuthUser,
  ) {
    return this.salesService.updateOrder(id, dto, user);
  }

  @Patch(':id/approve')
  async approve(
    @Param('id') id: string,
    @Body() dto: ApproveSalesOrderDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.salesService.approveOrder(id, dto, user);
  }

  @Patch(':id/reject')
  async reject(
    @Param('id') id: string,
    @Body('rejectionReason') rejectionReason: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.salesService.rejectOrder(id, rejectionReason, user);
  }

  @Post(':id/convert-to-sale')
  async convertToSale(
    @Param('id') id: string,
    @Body() body: { warehouseId: string; items?: any[]; netAmount?: number; notes?: string },
    @CurrentUser() user: AuthUser,
  ) {
    return this.salesService.convertOrderToSale(id, body, user);
  }

  @Delete(':id')
  async deleteOrder(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.salesService.deleteOrder(id, user);
  }
}

// ==========================================
// SALES INVOICES CONTROLLER (/api/v1/sales-invoices & /api/v1/sales/invoices)
// ==========================================
@Controller(['api/v1/sales-invoices', 'api/v1/sales/invoices'])
@UseGuards(JwtAuthGuard)
export class SalesInvoicesController {
  constructor(private readonly salesService: SalesService) {}

  @Get()
  async findAll(
    @CurrentUser() user: AuthUser,
    @Query('dealerId') dealerId?: string,
    @Query('warehouseId') warehouseId?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.salesService.findAllInvoices(
      user.companyId,
      {
        dealerId,
        warehouseId,
        status,
        search,
        limit: limit ? parseInt(limit, 10) : undefined,
        offset: offset ? parseInt(offset, 10) : undefined,
      },
      user,
    );
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.salesService.findOneInvoice(id, user.companyId);
  }

  @Post()
  async create(@Body() dto: CreateSalesInvoiceDto, @CurrentUser() user: AuthUser) {
    return this.salesService.createInvoice(dto, user);
  }

  @Post(':id/post')
  async postInvoice(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.salesService.postInvoice(id, user);
  }
}

// ==========================================
// SALES RETURNS CONTROLLER (/api/v1/sales-returns & /api/v1/sales/returns)
// ==========================================
@Controller(['api/v1/sales-returns', 'api/v1/sales/returns'])
@UseGuards(JwtAuthGuard)
export class SalesReturnsController {
  constructor(private readonly salesService: SalesService) {}

  @Get()
  async findAll(
    @CurrentUser() user: AuthUser,
    @Query('dealerId') dealerId?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.salesService.findAllReturns(user.companyId, {
      dealerId,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }

  @Post()
  async create(@Body() dto: CreateSalesReturnDto, @CurrentUser() user: AuthUser) {
    return this.salesService.createSalesReturn(dto, user);
  }
}

// ==========================================
// DEALER PAYMENTS CONTROLLER (/api/v1/dealer-payments)
// ==========================================
@Controller('api/v1/dealer-payments')
@UseGuards(JwtAuthGuard)
export class DealerPaymentsController {
  constructor(private readonly salesService: SalesService) {}

  @Get()
  async findAll(
    @CurrentUser() user: AuthUser,
    @Query('dealerId') dealerId?: string,
    @Query('status') status?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.salesService.findAllDealerPayments(user.companyId, {
      dealerId,
      status,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }

  @Post()
  async create(@Body() dto: any, @CurrentUser() user: AuthUser) {
    return this.salesService.createDealerPayment(dto, user);
  }
}

// ==========================================
// VENDOR PAYMENTS CONTROLLER (/api/v1/vendor-payments)
// ==========================================
@Controller('api/v1/vendor-payments')
@UseGuards(JwtAuthGuard)
export class VendorPaymentsController {
  constructor(
    private readonly salesService: SalesService,
    private readonly vendorLedgerService: VendorLedgerService,
  ) {}

  @Get()
  async findAll(
    @CurrentUser() user: AuthUser,
    @Query('vendorId') vendorId?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.salesService.findAllVendorPayments(user.companyId, {
      vendorId,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }

  @Post()
  async create(@Body() dto: any, @CurrentUser() user: AuthUser) {
    return this.salesService.createVendorPayment(dto, user);
  }

  @Get('vendor/:vendorId/ledger')
  async getVendorLedger(
    @Param('vendorId') vendorId: string,
    @CurrentUser() user: AuthUser,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.vendorLedgerService.getVendorLedger(vendorId, user.companyId, {
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }

  @Get('vendor/:vendorId/balance')
  async getVendorBalance(@Param('vendorId') vendorId: string, @CurrentUser() user: AuthUser) {
    return this.vendorLedgerService.getVendorBalance(vendorId, user.companyId);
  }
}

// ==========================================
// WAREHOUSE STOCK & SALES PRODUCTS (/api/v1/warehouse-stock)
// ==========================================
@Controller('api/v1/warehouse-stock')
@UseGuards(JwtAuthGuard)
export class WarehouseStockController {
  constructor(private readonly salesService: SalesService) {}

  @Get('report')
  async getReport(
    @CurrentUser() user: AuthUser,
    @Query('warehouseId') warehouseId?: string,
  ) {
    return this.salesService.getWarehouseStockReport(user.companyId, warehouseId);
  }

  @Get('sales-products')
  async getProductsForSale(@CurrentUser() user: AuthUser) {
    return this.salesService.getProductsForSale(user.companyId);
  }
}
