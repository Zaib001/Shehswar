/**
 * SHEHSWAR ONE360 - Employee Cost vs Sales Performance Controller
 *
 * Exposes authoritative endpoints for:
 * - Employee Cost Control Dashboard & Table
 * - Detailed Employee Drill-down (Sales, Salary, Fuel, Other Expenses, Credit)
 * - Real-Time Expense Pre-Check Simulation API
 * - Expense Recording with Backend Enforcement & Audit Trail
 * - Multi-level Hierarchy Report (Region -> Zone -> Territory -> Sales Officer)
 * - Configurable Cost & Category Policies
 * - Management & Auditor Audit Trail
 */
import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../core/guards/jwt-auth.guard';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { AuthUser } from '@shehswar/types';
import {
  EmployeeCostService,
  ExpensePreCheckDto,
  RecordEmployeeExpenseDto,
} from './employee-cost.service';

@Controller('api/v1/employee-cost')
@UseGuards(JwtAuthGuard)
export class EmployeeCostController {
  constructor(private readonly costService: EmployeeCostService) {}

  @Get('dashboard')
  async getDashboard(
    @CurrentUser() user: AuthUser,
    @Query('companyId') companyId?: string,
    @Query('regionId') regionId?: string,
    @Query('zoneId') zoneId?: string,
    @Query('territoryId') territoryId?: string,
    @Query('employeeId') employeeId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const targetCompanyId = companyId || user.companyId;
    return this.costService.getDashboard({
      companyId: targetCompanyId,
      regionId,
      zoneId,
      territoryId,
      employeeId,
      startDate,
      endDate,
    });
  }

  @Get('employee/:id')
  async getEmployeeDetail(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Query('companyId') companyId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const targetCompanyId = companyId || user.companyId;
    return this.costService.evaluateEmployeeCost(id, {
      companyId: targetCompanyId,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    });
  }

  @Post('check-expense')
  async checkExpenseImpact(
    @Body() dto: ExpensePreCheckDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.costService.checkExpenseImpact({
      ...dto,
      companyId: dto.companyId || user.companyId,
    });
  }

  @Post('record-expense')
  async recordExpense(
    @Body() dto: RecordEmployeeExpenseDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.costService.recordEmployeeExpense(
      {
        ...dto,
        companyId: dto.companyId || user.companyId,
      },
      user,
    );
  }

  @Get('hierarchy-report')
  async getHierarchyReport(
    @CurrentUser() user: AuthUser,
    @Query('companyId') companyId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const targetCompanyId = companyId || user.companyId;
    return this.costService.getHierarchyReport({
      companyId: targetCompanyId,
      startDate,
      endDate,
    });
  }

  @Get('policies')
  async getPolicies(
    @CurrentUser() user: AuthUser,
    @Query('companyId') companyId?: string,
  ) {
    const targetCompanyId = companyId || user.companyId;
    return this.costService.getPolicies(targetCompanyId);
  }

  @Post('policies/cost')
  async saveCostPolicy(
    @Body() dto: any,
    @CurrentUser() user: AuthUser,
  ) {
    return this.costService.saveCostPolicy(dto, user);
  }

  @Post('policies/category')
  async saveCategoryPolicy(
    @Body() dto: any,
    @CurrentUser() user: AuthUser,
  ) {
    return this.costService.saveCategoryPolicy(dto, user);
  }

  @Get('audit-trail')
  async getAuditTrail(
    @CurrentUser() user: AuthUser,
    @Query('companyId') companyId?: string,
    @Query('employeeId') employeeId?: string,
    @Query('limit') limit?: string,
  ) {
    const targetCompanyId = companyId || user.companyId;
    return this.costService.getAuditTrail({
      companyId: targetCompanyId,
      employeeId,
      limit: limit ? parseInt(limit, 10) : 50,
    });
  }
}
