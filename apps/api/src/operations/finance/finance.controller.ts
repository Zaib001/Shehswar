/**
 * SHEHSWAR ONE360 - Finance & Accounting Controller
 */
import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../core/guards/jwt-auth.guard';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { AuthUser } from '@shehswar/types';
import { FinanceService, CreateExpenseDto } from './finance.service';

@Controller('api/v1/finance')
@UseGuards(JwtAuthGuard)
export class FinanceController {
  constructor(private readonly financeService: FinanceService) {}

  @Get('accounts')
  async getAccounts(
    @CurrentUser() user: AuthUser,
    @Query('companyId') companyId?: string,
  ) {
    const targetCompanyId = companyId || user.companyId;
    return this.financeService.getAccounts(targetCompanyId, user.organizationId);
  }

  @Get('balance-sheet')
  async getBalanceSheet(
    @CurrentUser() user: AuthUser,
    @Query('companyId') companyId?: string,
    @Query('asOfDate') asOfDate?: string,
  ) {
    const targetCompanyId = companyId || user.companyId;
    return this.financeService.getBalanceSheet(targetCompanyId, asOfDate);
  }

  @Get('profit-loss')
  async getProfitLoss(
    @CurrentUser() user: AuthUser,
    @Query('companyId') companyId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const targetCompanyId = companyId || user.companyId;
    return this.financeService.getProfitLoss(targetCompanyId, startDate, endDate);
  }

  @Get('general-ledger')
  async getGeneralLedger(
    @CurrentUser() user: AuthUser,
    @Query('companyId') companyId?: string,
    @Query('accountCode') accountCode?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('limit') limit?: string,
  ) {
    const targetCompanyId = companyId || user.companyId;
    return this.financeService.getGeneralLedger(targetCompanyId, {
      accountCode,
      startDate,
      endDate,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get('expenses')
  async getExpenses(
    @CurrentUser() user: AuthUser,
    @Query('companyId') companyId?: string,
    @Query('category') category?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('limit') limit?: string,
  ) {
    const targetCompanyId = companyId || user.companyId;
    return this.financeService.getExpenses(targetCompanyId, {
      category,
      startDate,
      endDate,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Post('expenses')
  async createExpense(
    @Body() dto: CreateExpenseDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.financeService.createExpense(dto, user);
  }
}
