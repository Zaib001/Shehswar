/**
 * SHEHSWAR ONE360 - Expense Management Controller
 */
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Query,
  Param,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../core/guards/jwt-auth.guard';
import {
  ExpenseManagementService,
  CreateExpenseHeadDto,
  UpdateExpenseHeadDto,
  CreateExpenseSubCategoryDto,
  UpdateExpenseSubCategoryDto,
  CreateExpenseItemDto,
  UpdateExpenseItemDto,
} from './expense-management.service';

@ApiTags('Expense Management')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/v1/expense-management')
export class ExpenseManagementController {
  constructor(private readonly service: ExpenseManagementService) {}

  @Get('hierarchy')
  @ApiOperation({ summary: 'Get full Expense & Liability hierarchy grouped by 4 Main Divisions' })
  async getHierarchy(@Query('companyId') companyId?: string, @Req() req?: any) {
    const resolvedCompanyId = companyId || req?.user?.companyId || req?.headers?.['x-company-id'];
    return this.service.getExpenseHierarchy(resolvedCompanyId);
  }

  @Get('heads')
  @ApiOperation({ summary: 'List Expense Heads with optional Division and Status filters' })
  async getHeads(
    @Query('companyId') companyId?: string,
    @Query('mainDivision') mainDivision?: string,
    @Query('isActive') isActive?: string,
    @Req() req?: any,
  ) {
    const resolvedCompanyId = companyId || req?.user?.companyId || req?.headers?.['x-company-id'];
    const activeBool = isActive !== undefined ? isActive === 'true' : undefined;
    return this.service.getHeads(resolvedCompanyId, mainDivision, activeBool);
  }

  @Post('heads')
  @ApiOperation({ summary: 'Create new Expense Head' })
  async createHead(@Body() dto: CreateExpenseHeadDto, @Req() req: any) {
    const companyId = dto.companyId || req.user?.companyId || req.headers?.['x-company-id'];
    const userId = req.user?.id;
    return this.service.createHead(companyId, dto, userId);
  }

  @Patch('heads/:id')
  @ApiOperation({ summary: 'Update Expense Head' })
  async updateHead(
    @Param('id') id: string,
    @Body() dto: UpdateExpenseHeadDto,
    @Req() req: any,
  ) {
    const companyId = req.user?.companyId || req.headers?.['x-company-id'];
    return this.service.updateHead(id, companyId, dto);
  }

  @Delete('heads/:id')
  @ApiOperation({ summary: 'Delete or Deactivate Expense Head' })
  async deleteHead(@Param('id') id: string, @Req() req: any) {
    const companyId = req.user?.companyId || req.headers?.['x-company-id'];
    return this.service.deleteHead(id, companyId);
  }

  @Post('sub-categories')
  @ApiOperation({ summary: 'Create Sub-Category under an Expense Head' })
  async createSubCategory(@Body() dto: CreateExpenseSubCategoryDto, @Req() req: any) {
    const companyId = dto.companyId || req.user?.companyId || req.headers?.['x-company-id'];
    const userId = req.user?.id;
    return this.service.createSubCategory(companyId, dto, userId);
  }

  @Patch('sub-categories/:id')
  @ApiOperation({ summary: 'Update Sub-Category' })
  async updateSubCategory(
    @Param('id') id: string,
    @Body() dto: UpdateExpenseSubCategoryDto,
    @Req() req: any,
  ) {
    const companyId = req.user?.companyId || req.headers?.['x-company-id'];
    return this.service.updateSubCategory(id, companyId, dto);
  }

  @Delete('sub-categories/:id')
  @ApiOperation({ summary: 'Delete or Deactivate Sub-Category' })
  async deleteSubCategory(@Param('id') id: string) {
    return this.service.deleteSubCategory(id);
  }

  @Post('items')
  @ApiOperation({ summary: 'Create Expense Item under Head or Sub-Category' })
  async createItem(@Body() dto: CreateExpenseItemDto, @Req() req: any) {
    const companyId = dto.companyId || req.user?.companyId || req.headers?.['x-company-id'];
    const userId = req.user?.id;
    return this.service.createExpenseItem(companyId, dto, userId);
  }

  @Patch('items/:id')
  @ApiOperation({ summary: 'Update Expense Item' })
  async updateItem(
    @Param('id') id: string,
    @Body() dto: UpdateExpenseItemDto,
    @Req() req: any,
  ) {
    const companyId = req.user?.companyId || req.headers?.['x-company-id'];
    return this.service.updateExpenseItem(id, companyId, dto);
  }

  @Delete('items/:id')
  @ApiOperation({ summary: 'Delete or Deactivate Expense Item' })
  async deleteItem(@Param('id') id: string) {
    return this.service.deleteExpenseItem(id);
  }

  @Get('reports')
  @ApiOperation({ summary: 'Get Expense & Liability Reports by Division, Head, Sub-Category, Item and Date' })
  async getReports(
    @Query('companyId') companyId?: string,
    @Query('mainDivision') mainDivision?: string,
    @Query('headId') headId?: string,
    @Query('subCategoryId') subCategoryId?: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
    @Query('period') period?: 'DAILY' | 'MONTHLY' | 'YEARLY' | 'CUSTOM',
    @Req() req?: any,
  ) {
    const resolvedCompanyId = companyId || req?.user?.companyId || req?.headers?.['x-company-id'];
    return this.service.getExpenseReport({
      companyId: resolvedCompanyId,
      mainDivision,
      headId,
      subCategoryId,
      fromDate,
      toDate,
      period,
    });
  }

  @Get('ledger')
  @ApiOperation({ summary: 'Get Expense Ledger with running balances, opening balance, and item breakdown' })
  async getLedger(
    @Query('companyId') companyId?: string,
    @Query('mainDivision') mainDivision?: string,
    @Query('headId') headId?: string,
    @Query('subCategoryId') subCategoryId?: string,
    @Query('itemId') itemId?: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
    @Query('period') period?: 'ALL' | 'TODAY' | 'MONTH' | 'LAST_MONTH' | 'YEAR' | 'CUSTOM',
    @Query('paymentMethod') paymentMethod?: string,
    @Query('search') search?: string,
    @Req() req?: any,
  ) {
    const resolvedCompanyId = companyId || req?.user?.companyId || req?.headers?.['x-company-id'];
    return this.service.getExpenseLedger({
      companyId: resolvedCompanyId,
      mainDivision,
      headId,
      subCategoryId,
      itemId,
      fromDate,
      toDate,
      period,
      paymentMethod,
      search,
    }, resolvedCompanyId);
  }

  @Get('cash-pr-summary')
  @ApiOperation({ summary: 'Get Cash Movement & Provisional Receipt (PR) integration summary' })
  async getCashPrSummary(
    @Query('companyId') companyId?: string,
    @Req() req?: any,
  ) {
    const resolvedCompanyId = companyId || req?.user?.companyId || req?.headers?.['x-company-id'];
    return this.service.getCashAndPrIntegrationSummary(resolvedCompanyId);
  }
}

