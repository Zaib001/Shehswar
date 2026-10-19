/**
 * SHEHSWAR ONE360 - Financial Transactions Controller
 */
import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../core/guards/jwt-auth.guard';
import {
  FinancialTransactionsService,
  CreateFinancialTransactionDto,
} from './financial-transactions.service';

@ApiTags('Financial Transactions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/v1/financial-transactions')
export class FinancialTransactionsController {
  constructor(private readonly service: FinancialTransactionsService) {}

  @Get()
  @ApiOperation({ summary: 'List financial transactions with filters' })
  async getTransactions(
    @Query('companyId') companyId?: string,
    @Query('transactionType') transactionType?: string,
    @Query('status') status?: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
    @Query('search') search?: string,
  ) {
    return this.service.getTransactions({
      companyId,
      transactionType,
      status,
      fromDate,
      toDate,
      search,
    });
  }

  @Get('cash-bank-dashboard')
  @ApiOperation({ summary: 'Cash & Bank Dashboard metrics from authoritative transactions' })
  async getCashBankDashboard(@Query('companyId') companyId?: string) {
    return this.service.getCashBankDashboard(companyId);
  }

  @Get('collections-dashboard')
  @ApiOperation({ summary: 'Collections Dashboard across hierarchy and payment types' })
  async getCollectionsDashboard(
    @Query('companyId') companyId?: string,
    @Query('regionId') regionId?: string,
    @Query('zoneId') zoneId?: string,
    @Query('territoryId') territoryId?: string,
  ) {
    return this.service.getCollectionsDashboard({ companyId, regionId, zoneId, territoryId });
  }

  @Post('cash-receipt')
  @ApiOperation({ summary: 'Record Cash Receipt (Debit Cash 101000, Credit Contra Account)' })
  async createCashReceipt(@Body() dto: Omit<CreateFinancialTransactionDto, 'transactionType'>, @Req() req: any) {
    const orgId = req.user?.organizationId || req.user?.orgId;
    const userId = req.user?.id;
    return this.service.createTransaction(
      orgId,
      { ...dto, transactionType: 'CASH_RECEIPT' },
      userId,
    );
  }

  @Post('cash-payment')
  @ApiOperation({ summary: 'Record Cash Payment (Debit Contra Account, Credit Cash 101000)' })
  async createCashPayment(@Body() dto: Omit<CreateFinancialTransactionDto, 'transactionType'>, @Req() req: any) {
    const orgId = req.user?.organizationId || req.user?.orgId;
    const userId = req.user?.id;
    return this.service.createTransaction(
      orgId,
      { ...dto, transactionType: 'CASH_PAYMENT' },
      userId,
    );
  }

  @Post('bank-receipt')
  @ApiOperation({ summary: 'Record Bank Receipt (Debit Bank 102000, Credit Contra Account)' })
  async createBankReceipt(@Body() dto: Omit<CreateFinancialTransactionDto, 'transactionType'>, @Req() req: any) {
    const orgId = req.user?.organizationId || req.user?.orgId;
    const userId = req.user?.id;
    return this.service.createTransaction(
      orgId,
      { ...dto, transactionType: 'BANK_RECEIPT' },
      userId,
    );
  }

  @Post('bank-payment')
  @ApiOperation({ summary: 'Record Bank Payment (Debit Contra Account, Credit Bank 102000)' })
  async createBankPayment(@Body() dto: Omit<CreateFinancialTransactionDto, 'transactionType'>, @Req() req: any) {
    const orgId = req.user?.organizationId || req.user?.orgId;
    const userId = req.user?.id;
    return this.service.createTransaction(
      orgId,
      { ...dto, transactionType: 'BANK_PAYMENT' },
      userId,
    );
  }

  @Post('salary-payment')
  @ApiOperation({ summary: 'Record Employee Salary Payment with GL Posting' })
  async createSalaryPayment(@Body() dto: any, @Req() req: any) {
    const orgId = req.user?.organizationId || req.user?.orgId;
    const userId = req.user?.id;
    return this.service.createSalaryPayment(orgId, dto, userId);
  }

  @Get('salary-payments')
  @ApiOperation({ summary: 'List Employee Salary Payments' })
  async getSalaryPayments(
    @Query('companyId') companyId?: string,
    @Query('employeeId') employeeId?: string,
    @Query('salaryMonth') salaryMonth?: string,
  ) {
    return this.service.getSalaryPayments({ companyId, employeeId, salaryMonth });
  }
}

