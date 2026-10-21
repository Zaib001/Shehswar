/**
 * SHEHSWAR ONE360 - Employee Cost vs Sales Performance & Expense Control Service
 *
 * Responsibilities:
 * - Calculate Authoritative Employee Net Sales from posted sales invoices and returns
 * - Calculate Posted Employee Salaries
 * - Calculate Approved Employee Fuel Expenses (Vehicle & Field)
 * - Calculate Approved Other Employee-Attributable Expenses
 * - Exclude Vehicle Asset Repairs/Bearings unless explicitly configured
 * - Calculate Employee Cost % and remaining headroom against configured policy
 * - Pre-check expense impact before approval/posting
 * - Enforce expense approval rules & maintain comprehensive audit trail
 * - Integrate with Sales Targets and Hierarchical Credit Control
 * - Multi-level aggregation: Employee -> Territory -> Zone -> Region -> Company -> Group
 */
import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { uuidv7 } from '@shehswar/shared';
import { EmployeeCostStatus, AuthUser } from '@shehswar/types';
import { CreditControlService } from '../credit/credit-control.service';

export interface EmployeeCostFilter {
  companyId?: string;
  regionId?: string;
  zoneId?: string;
  territoryId?: string;
  employeeId?: string;
  roleScope?: string;
  startDate?: string | Date;
  endDate?: string | Date;
  year?: number;
  month?: number;
}

export interface ExpensePreCheckDto {
  companyId: string;
  employeeId: string;
  amount: number;
  categoryKey: string;
  expenseType?: 'VEHICLE_EXPENSE' | 'GENERAL_EXPENSE';
  vehicleId?: string;
  description?: string;
}

export interface RecordEmployeeExpenseDto {
  companyId: string;
  employeeId: string;
  amount: number;
  categoryKey: string;
  expenseType: 'VEHICLE_EXPENSE' | 'GENERAL_EXPENSE';
  vehicleId?: string;
  expenseDate?: string | Date;
  paymentMethod?: string;
  fuelStation?: string;
  quantity?: number;
  rate?: number;
  description?: string;
  remarks?: string;
  overrideApproved?: boolean;
  overrideReason?: string;
}

@Injectable()
export class EmployeeCostService {
  private readonly logger = new Logger(EmployeeCostService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly creditControlService: CreditControlService,
  ) {
    this.logger.log('EmployeeCostService initialized');
  }

  /**
   * 1. Calculate Authoritative Net Sales for an Employee
   * Net Sales = Posted Sales Invoices - Posted Sales Returns
   * Preserves historical transaction-time attribution via salesOfficerId
   */
  async calculateEmployeeSales(
    employeeId: string,
    filters?: { companyId?: string; startDate?: Date; endDate?: Date },
  ): Promise<{
    netSales: number;
    grossSales: number;
    returns: number;
    invoiceCount: number;
    dealerCount: number;
  }> {
    // 1. Resolve employee user IDs
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      include: { users: { select: { id: true } } },
    });
    if (!employee) {
      return { netSales: 0, grossSales: 0, returns: 0, invoiceCount: 0, dealerCount: 0 };
    }

    const userIds = employee.users.map((u) => u.id);
    const dateFilter: any = {};
    if (filters?.startDate) dateFilter.gte = filters.startDate;
    if (filters?.endDate) dateFilter.lte = filters.endDate;

    const invoiceWhere: any = {
      postingStatus: 'POSTED',
      OR: [
        { salesOfficerId: { in: userIds } },
        ...(userIds.length > 0 ? [{ salesOrder: { salesOfficerId: { in: userIds } } }] : []),
      ],
    };
    if (filters?.companyId) invoiceWhere.companyId = filters.companyId;
    if (filters?.startDate || filters?.endDate) invoiceWhere.invoiceDate = dateFilter;

    const invoices = await this.prisma.salesInvoice.findMany({
      where: invoiceWhere,
      select: {
        id: true,
        netAmount: true,
        dealerId: true,
      },
    });

    const invoiceIds = invoices.map((inv) => inv.id);
    const grossSales = invoices.reduce((sum, inv) => sum + Number(inv.netAmount || 0), 0);
    const uniqueDealers = new Set(invoices.map((inv) => inv.dealerId));

    let returnTotal = 0;
    if (invoiceIds.length > 0) {
      const returns = await this.prisma.salesReturn.findMany({
        where: {
          postingStatus: 'POSTED',
          salesInvoiceId: { in: invoiceIds },
          ...(filters?.companyId ? { companyId: filters.companyId } : {}),
          ...(filters?.startDate || filters?.endDate ? { returnDate: dateFilter } : {}),
        },
        select: { netAmount: true },
      });
      returnTotal = returns.reduce((sum, ret) => sum + Number(ret.netAmount || 0), 0);
    }

    const netSales = Math.max(0, grossSales - returnTotal);
    return {
      netSales: Math.round(netSales * 100) / 100,
      grossSales: Math.round(grossSales * 100) / 100,
      returns: Math.round(returnTotal * 100) / 100,
      invoiceCount: invoices.length,
      dealerCount: uniqueDealers.size,
    };
  }

  /**
   * 2. Calculate Posted Salary for an Employee
   * Only approved / posted salary payment records contribute to employee cost
   */
  async calculateEmployeeSalary(
    employeeId: string,
    filters?: { companyId?: string; startDate?: Date; endDate?: Date },
  ): Promise<{ totalSalary: number; count: number; payments: any[] }> {
    const dateFilter: any = {};
    if (filters?.startDate) dateFilter.gte = filters.startDate;
    if (filters?.endDate) dateFilter.lte = filters.endDate;

    const payments = await this.prisma.employeeSalaryPayment.findMany({
      where: {
        employeeId,
        status: 'POSTED',
        ...(filters?.companyId ? { companyId: filters.companyId } : {}),
        ...(filters?.startDate || filters?.endDate ? { paymentDate: dateFilter } : {}),
      },
      orderBy: { paymentDate: 'desc' },
      select: {
        id: true,
        voucherNumber: true,
        salaryMonth: true,
        paymentDate: true,
        grossSalary: true,
        adjustments: true,
        netPaid: true,
        paymentMethod: true,
        status: true,
        remarks: true,
      },
    });

    const totalSalary = payments.reduce((sum, p) => sum + Number(p.netPaid || 0), 0);
    return {
      totalSalary: Math.round(totalSalary * 100) / 100,
      count: payments.length,
      payments: payments.map((p) => ({
        ...p,
        grossSalary: Number(p.grossSalary),
        adjustments: Number(p.adjustments),
        netPaid: Number(p.netPaid),
      })),
    };
  }

  /**
   * 3. Calculate Approved Fuel / Petrol Expenses for an Employee
   * Fuel attributable to employee is included.
   * Vehicle bearings & maintenance are EXCLUDED unless category policy sets isEmployeeCost = true.
   */
  async calculateEmployeeFuel(
    employeeId: string,
    filters?: { companyId?: string; startDate?: Date; endDate?: Date },
  ): Promise<{ totalFuel: number; count: number; expenses: any[] }> {
    const dateFilter: any = {};
    if (filters?.startDate) dateFilter.gte = filters.startDate;
    if (filters?.endDate) dateFilter.lte = filters.endDate;

    const expenses = await this.prisma.vehicleExpense.findMany({
      where: {
        employeeId,
        status: 'POSTED',
        approvalStatus: { in: ['APPROVED', 'POSTED'] },
        OR: [{ expenseType: 'FUEL' }, { isEmployeeCost: true }],
        ...(filters?.companyId ? { companyId: filters.companyId } : {}),
        ...(filters?.startDate || filters?.endDate ? { expenseDate: dateFilter } : {}),
      },
      include: {
        vehicle: { select: { id: true, vehicleNumber: true, vehicleModel: true } },
      },
      orderBy: { expenseDate: 'desc' },
    });

    // Explicitly filter out vehicle repairs/bearings if someone created with expenseType!=FUEL and isEmployeeCost=false
    const fuelList = expenses.filter((e) => e.expenseType === 'FUEL' || e.isEmployeeCost === true);
    const totalFuel = fuelList.reduce((sum, e) => sum + Number(e.totalAmount || 0), 0);

    return {
      totalFuel: Math.round(totalFuel * 100) / 100,
      count: fuelList.length,
      expenses: fuelList.map((e) => ({
        id: e.id,
        voucherNumber: e.voucherNumber,
        expenseDate: e.expenseDate,
        expenseType: e.expenseType,
        vehicleNumber: e.vehicle.vehicleNumber,
        fuelStation: e.fuelStation,
        quantity: Number(e.quantity),
        rate: Number(e.rate),
        totalAmount: Number(e.totalAmount),
        remarks: e.remarks,
        isEmployeeCost: e.isEmployeeCost,
        approvalStatus: e.approvalStatus,
      })),
    };
  }

  /**
   * 4. Calculate Other Approved Employee-Attributable Expenses
   * (Travel, Food, Accommodation, Field Allowance, etc.)
   */
  async calculateEmployeeOtherExpenses(
    employeeId: string,
    filters?: { companyId?: string; startDate?: Date; endDate?: Date },
  ): Promise<{ totalOther: number; count: number; expenses: any[] }> {
    const dateFilter: any = {};
    if (filters?.startDate) dateFilter.gte = filters.startDate;
    if (filters?.endDate) dateFilter.lte = filters.endDate;

    const generalExpenses = await this.prisma.expenseEntry.findMany({
      where: {
        employeeId,
        isEmployeeCost: true,
        status: 'POSTED',
        approvalStatus: { in: ['APPROVED', 'POSTED'] },
        ...(filters?.companyId ? { companyId: filters.companyId } : {}),
        ...(filters?.startDate || filters?.endDate ? { expenseDate: dateFilter } : {}),
      },
      orderBy: { expenseDate: 'desc' },
    });

    const totalOther = generalExpenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
    return {
      totalOther: Math.round(totalOther * 100) / 100,
      count: generalExpenses.length,
      expenses: generalExpenses.map((e) => ({
        id: e.id,
        voucherNumber: e.voucherNumber,
        expenseDate: e.expenseDate,
        category: e.category,
        amount: Number(e.amount),
        description: e.description,
        payee: e.payee,
        status: e.status,
        approvalStatus: e.approvalStatus,
        isEmployeeCost: e.isEmployeeCost,
      })),
    };
  }

  /**
   * 5. Get Configured Employee Cost Policy
   */
  async getEmployeeCostPolicy(
    companyId: string,
    roleScope?: string,
    employeeId?: string,
  ): Promise<{
    maximumCostPercentage: number;
    nearLimitThresholdPercent: number;
    blockingAction: string;
    policyId?: string;
  }> {
    // 1. Check employee-specific override policy first
    if (employeeId) {
      const empPolicy = await this.prisma.employeeCostPolicy.findFirst({
        where: {
          companyId,
          employeeId,
          status: 'ACTIVE',
        },
        orderBy: { effectiveFrom: 'desc' },
      });
      if (empPolicy) {
        return {
          maximumCostPercentage: Number(empPolicy.maximumCostPercentage),
          nearLimitThresholdPercent: Number(empPolicy.nearLimitThresholdPercent),
          blockingAction: empPolicy.blockingAction,
          policyId: empPolicy.id,
        };
      }
    }

    // 2. Check role-specific policy (e.g. SALES_OFFICER)
    if (roleScope) {
      const rolePolicy = await this.prisma.employeeCostPolicy.findFirst({
        where: {
          companyId,
          roleScope,
          status: 'ACTIVE',
        },
        orderBy: { effectiveFrom: 'desc' },
      });
      if (rolePolicy) {
        return {
          maximumCostPercentage: Number(rolePolicy.maximumCostPercentage),
          nearLimitThresholdPercent: Number(rolePolicy.nearLimitThresholdPercent),
          blockingAction: rolePolicy.blockingAction,
          policyId: rolePolicy.id,
        };
      }
    }

    // 3. Check ALL roles company default policy
    const defaultPolicy = await this.prisma.employeeCostPolicy.findFirst({
      where: {
        companyId,
        roleScope: 'ALL',
        status: 'ACTIVE',
      },
      orderBy: { effectiveFrom: 'desc' },
    });
    if (defaultPolicy) {
      return {
        maximumCostPercentage: Number(defaultPolicy.maximumCostPercentage),
        nearLimitThresholdPercent: Number(defaultPolicy.nearLimitThresholdPercent),
        blockingAction: defaultPolicy.blockingAction,
        policyId: defaultPolicy.id,
      };
    }

    // 4. Client business default: 13.00% max, 90.00% near limit (e.g. 11.7% threshold on 13%), APPROVAL_REQUIRED
    return {
      maximumCostPercentage: 13.0,
      nearLimitThresholdPercent: 90.0,
      blockingAction: 'APPROVAL_REQUIRED',
    };
  }

  /**
   * 6. Check Expense Category Policy
   * Determines whether an expense contributes to employee cost
   * (e.g., Fuel = YES, Travel = YES, Vehicle Bearing = NO)
   */
  async isCategoryEmployeeCost(companyId: string, categoryKey: string): Promise<boolean> {
    const key = categoryKey.toUpperCase().trim();
    const policy = await this.prisma.expenseCategoryPolicy.findFirst({
      where: {
        companyId,
        categoryKey: key,
        status: 'ACTIVE',
      },
    });

    if (policy) {
      return policy.isEmployeeCost;
    }

    // Default rules:
    // Employee attributable: FUEL, TRAVEL, MEALS, ACCOMMODATION, DAILY_ALLOWANCE, COMMUNICATION
    // Asset / Non-attributable: VEHICLE_BEARING, VEHICLE_MAINTENANCE, REPAIR, BUILDING_REPAIR, ASSET_MAINTENANCE
    if (
      key.includes('BEARING') ||
      key.includes('MAINTENANCE') ||
      key.includes('REPAIR') ||
      key.includes('BUILDING') ||
      key.includes('ASSET') ||
      key.includes('PARTS')
    ) {
      return false;
    }

    if (
      key === 'FUEL' ||
      key.includes('TRAVEL') ||
      key.includes('MEAL') ||
      key.includes('ALLOWANCE') ||
      key.includes('HOTEL') ||
      key.includes('STAY')
    ) {
      return true;
    }

    return true;
  }

  /**
   * 7. Full Employee Cost & Performance Evaluation
   */
  async evaluateEmployeeCost(
    employeeId: string,
    filters?: { companyId?: string; startDate?: Date; endDate?: Date },
  ) {
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      include: {
        company: { select: { id: true, name: true, code: true } },
        department: { select: { id: true, name: true } },
        currentVehicles: { select: { id: true, vehicleNumber: true, vehicleModel: true } },
        marketAssignments: {
          where: { status: 'ACTIVE' },
          include: {
            region: { select: { id: true, name: true } },
            zone: { select: { id: true, name: true } },
            territory: { select: { id: true, name: true } },
          },
        },
        users: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
    });

    if (!employee) {
      throw new NotFoundException(`Employee ${employeeId} not found`);
    }

    const companyId = filters?.companyId || employee.companyId;

    // 1. Gather component metrics
    const [salesData, salaryData, fuelData, otherData] = await Promise.all([
      this.calculateEmployeeSales(employeeId, { ...filters, companyId }),
      this.calculateEmployeeSalary(employeeId, { ...filters, companyId }),
      this.calculateEmployeeFuel(employeeId, { ...filters, companyId }),
      this.calculateEmployeeOtherExpenses(employeeId, { ...filters, companyId }),
    ]);

    const netSales = salesData.netSales;
    const salary = salaryData.totalSalary;
    const fuel = fuelData.totalFuel;
    const other = otherData.totalOther;
    const totalEmployeeCost = Math.round((salary + fuel + other) * 100) / 100;

    // 2. Fetch active policy
    const primaryAssignment = employee.marketAssignments[0];
    const roleScope = primaryAssignment?.roleScope || 'SALES_OFFICER';
    const policy = await this.getEmployeeCostPolicy(companyId, roleScope, employeeId);
    const maxCostPercent = policy.maximumCostPercentage;
    const nearLimitThresholdPercent = policy.nearLimitThresholdPercent;

    // 3. Calculate Cost % and Status
    let costPercentage: number | null = null;
    let status: EmployeeCostStatus = EmployeeCostStatus.WITHIN_LIMIT;
    let remainingAllowedPercentage = 0;
    let maximumAllowedCost = 0;
    let remainingHeadroom = 0;

    if (netSales <= 0) {
      costPercentage = null;
      status = totalEmployeeCost > 0 ? EmployeeCostStatus.NO_SALES : EmployeeCostStatus.WITHIN_LIMIT;
      maximumAllowedCost = 0;
      remainingHeadroom = -totalEmployeeCost;
      remainingAllowedPercentage = 0;
    } else {
      costPercentage = Math.round((totalEmployeeCost / netSales) * 10000) / 100;
      maximumAllowedCost = Math.round(netSales * (maxCostPercent / 100) * 100) / 100;
      remainingHeadroom = Math.round((maximumAllowedCost - totalEmployeeCost) * 100) / 100;
      remainingAllowedPercentage = Math.round((maxCostPercent - costPercentage) * 100) / 100;

      // Status determination
      const nearLimitMargin = maxCostPercent * (nearLimitThresholdPercent / 100);
      if (costPercentage > maxCostPercent) {
        status = EmployeeCostStatus.LIMIT_EXCEEDED;
      } else if (costPercentage === maxCostPercent) {
        status = EmployeeCostStatus.LIMIT_REACHED;
      } else if (costPercentage >= nearLimitMargin) {
        status = EmployeeCostStatus.NEAR_LIMIT;
      } else {
        status = EmployeeCostStatus.WITHIN_LIMIT;
      }
    }

    // 4. Sales Target & Target Achievement
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const targetRecord = await this.prisma.salesTarget.findFirst({
      where: {
        companyId,
        level: 'SALES_OFFICER',
        entityId: employee.users[0]?.id || employee.id,
        periodYear: currentYear,
        periodMonth: currentMonth,
        status: 'ACTIVE',
      },
    });

    const salesTarget = targetRecord ? Number(targetRecord.targetAmount) : 0;
    const targetAchievementPercent =
      salesTarget > 0 ? Math.round((netSales / salesTarget) * 10000) / 100 : 0;

    // 5. Separate Credit Control Information
    let creditLimit = 0;
    let creditExposure = 0;
    let availableCredit = 0;
    let creditStatus = 'WITHIN_LIMIT';
    let creditPercentage = 0;
    let maxCreditPercentage = 20.0;

    const soUserId = employee.users[0]?.id;
    if (soUserId) {
      try {
        const soLimit = await this.creditControlService.getEffectiveLimit(companyId, 'SALES_OFFICER', soUserId);
        creditLimit = soLimit.limit;
        maxCreditPercentage = soLimit.maxCreditPercentage || 20.0;
        creditExposure = await this.creditControlService.calculateCreditExposure('SALES_OFFICER', soUserId, companyId);

        if (netSales > 0) {
          creditPercentage = Math.round((creditExposure / netSales) * 10000) / 100;
          const maxAllowedCreditByPercentage = Math.round(netSales * (maxCreditPercentage / 100) * 100) / 100;
          const effectiveMaxLimit = creditLimit > 0 ? creditLimit : maxAllowedCreditByPercentage;
          availableCredit = Math.max(0, effectiveMaxLimit - creditExposure);

          if (creditExposure >= maxAllowedCreditByPercentage && maxAllowedCreditByPercentage > 0) {
            creditStatus = 'CREDIT_LOCK';
          } else if (creditLimit > 0 && creditExposure > creditLimit) {
            creditStatus = 'LIMIT_EXCEEDED';
          } else if (creditLimit > 0 && creditExposure === creditLimit) {
            creditStatus = 'LIMIT_REACHED';
          } else if (creditPercentage >= maxCreditPercentage * 0.9) {
            creditStatus = 'NEAR_LIMIT';
          } else {
            creditStatus = 'WITHIN_LIMIT';
          }
        } else {
          availableCredit = Math.max(0, creditLimit - creditExposure);
          creditStatus = creditExposure > 0 ? 'REVIEW_REQUIRED' : 'WITHIN_LIMIT';
        }
      } catch (err) {
        this.logger.warn(`Could not evaluate credit for officer ${soUserId}: ${err}`);
      }
    }

    return {
      employee: {
        id: employee.id,
        employeeCode: employee.employeeCode,
        firstName: employee.firstName,
        lastName: employee.lastName,
        fullName: `${employee.firstName} ${employee.lastName}`,
        position: employee.position,
        department: employee.department?.name,
        company: employee.company,
        region: primaryAssignment?.region?.name || 'N/A',
        zone: primaryAssignment?.zone?.name || 'N/A',
        territory: primaryAssignment?.territory?.name || 'N/A',
        vehicles: employee.currentVehicles,
      },
      metrics: {
        sales: netSales,
        grossSales: salesData.grossSales,
        returns: salesData.returns,
        salary,
        fuel,
        otherExpenses: other,
        totalEmployeeCost,
        costPercentage,
        maximumCostPercentage: maxCostPercent,
        remainingAllowedPercentage,
        maximumAllowedCost,
        remainingHeadroom,
        status,
        salesTarget,
        targetAchievementPercent,
        creditLimit,
        creditExposure,
        availableCredit,
        creditStatus,
        creditPercentage,
        maxCreditPercentage,
        dealerCount: salesData.dealerCount,
        invoiceCount: salesData.invoiceCount,
      },
      breakdown: {
        salaryPayments: salaryData.payments,
        fuelExpenses: fuelData.expenses,
        otherExpenses: otherData.expenses,
      },
    };
  }

  /**
   * 8. Expense Pre-Check Simulation API (Requirement 35)
   * Calculates projected cost and percentage before expense creation
   */
  async checkExpenseImpact(dto: ExpensePreCheckDto) {
    const current = await this.evaluateEmployeeCost(dto.employeeId, { companyId: dto.companyId });
    const isCost = await this.isCategoryEmployeeCost(dto.companyId, dto.categoryKey);
    const amount = Number(dto.amount || 0);

    const netSales = current.metrics.sales;
    const currentCost = current.metrics.totalEmployeeCost;
    const currentCostPercent = current.metrics.costPercentage || 0;
    const maxPercent = current.metrics.maximumCostPercentage;

    if (!isCost) {
      return {
        currentSales: netSales,
        currentCost,
        currentCostPercentage: currentCostPercent,
        newExpense: amount,
        isEmployeeCost: false,
        projectedCost: currentCost,
        projectedCostPercentage: currentCostPercent,
        maximumAllowedPercentage: maxPercent,
        remainingHeadroom: current.metrics.remainingHeadroom,
        status: current.metrics.status,
        approvalRequired: false,
        allowed: true,
        message: 'Non-employee asset/vehicle expense. Does not affect employee cost ratio.',
      };
    }

    const projectedCost = Math.round((currentCost + amount) * 100) / 100;
    let projectedCostPercent = 0;
    let projectedStatus: EmployeeCostStatus = EmployeeCostStatus.WITHIN_LIMIT;
    let approvalRequired = false;
    let allowed = true;
    let message = 'Expense is within acceptable cost ratio.';

    if (netSales <= 0) {
      projectedCostPercent = 0;
      projectedStatus = EmployeeCostStatus.NO_SALES;
      approvalRequired = true;
      allowed = false;
      message = 'Employee has 0 net sales. Additional expense requires management approval.';
    } else {
      projectedCostPercent = Math.round((projectedCost / netSales) * 10000) / 100;
      const nearLimitMargin = maxPercent * (current.metrics.maximumCostPercentage >= 13 ? 0.85 : 0.85);

      if (projectedCostPercent > maxPercent) {
        projectedStatus = EmployeeCostStatus.LIMIT_EXCEEDED;
        approvalRequired = true;
        allowed = false;
        message = `Projected cost (${projectedCostPercent}%) exceeds maximum allowable ${maxPercent}%. Management approval or override required.`;
      } else if (projectedCostPercent === maxPercent) {
        projectedStatus = EmployeeCostStatus.LIMIT_REACHED;
        approvalRequired = true;
        allowed = true;
        message = `Projected cost reaches exact maximum limit (${maxPercent}%). Headroom exhausted.`;
      } else if (projectedCostPercent >= nearLimitMargin) {
        projectedStatus = EmployeeCostStatus.NEAR_LIMIT;
        approvalRequired = false;
        allowed = true;
        message = `Projected cost (${projectedCostPercent}%) approaches limit threshold.`;
      } else {
        projectedStatus = EmployeeCostStatus.WITHIN_LIMIT;
        approvalRequired = false;
        allowed = true;
      }
    }

    const remainingHeadroom = Math.round((current.metrics.maximumAllowedCost - projectedCost) * 100) / 100;

    return {
      currentSales: netSales,
      currentCost,
      currentCostPercentage: currentCostPercent,
      newExpense: amount,
      isEmployeeCost: true,
      projectedCost,
      projectedCostPercentage: projectedCostPercent,
      maximumAllowedPercentage: maxPercent,
      remainingHeadroom,
      status: projectedStatus,
      approvalRequired,
      allowed,
      message,
    };
  }

  /**
   * 9. Record Employee Expense with Backend Enforcement & Audit Trail
   */
  async recordEmployeeExpense(dto: RecordEmployeeExpenseDto, actor: AuthUser) {
    const preCheck = await this.checkExpenseImpact({
      companyId: dto.companyId,
      employeeId: dto.employeeId,
      amount: dto.amount,
      categoryKey: dto.categoryKey,
      expenseType: dto.expenseType,
      vehicleId: dto.vehicleId,
    });

    const isExceeded = preCheck.status === EmployeeCostStatus.LIMIT_EXCEEDED;

    // Backend rule enforcement
    if (isExceeded && !dto.overrideApproved) {
      // Record audit of rejected / blocked attempt
      await this.prisma.employeeExpenseAudit.create({
        data: {
          id: uuidv7(),
          organizationId: actor.organizationId,
          companyId: dto.companyId,
          employeeId: dto.employeeId,
          expenseType: dto.expenseType,
          currentSales: preCheck.currentSales,
          currentCost: preCheck.currentCost,
          currentCostPercentage: preCheck.currentCostPercentage,
          maximumPercentage: preCheck.maximumAllowedPercentage,
          requestedAmount: dto.amount,
          projectedCost: preCheck.projectedCost,
          projectedCostPercentage: preCheck.projectedCostPercentage,
          decision: 'LIMIT_EXCEEDED',
          reason: preCheck.message,
        },
      });

      throw new BadRequestException({
        message: preCheck.message,
        code: 'EMPLOYEE_COST_LIMIT_EXCEEDED',
        preCheck,
      });
    }

    const expDate = dto.expenseDate ? new Date(dto.expenseDate) : new Date();
    const isEmployeeCost = preCheck.isEmployeeCost;
    const approvalStatus = isExceeded ? (dto.overrideApproved ? 'APPROVED' : 'PENDING_APPROVAL') : 'APPROVED';

    let createdRecord: any;
    let voucherNumber = '';

    if (dto.expenseType === 'VEHICLE_EXPENSE') {
      if (!dto.vehicleId) {
        throw new BadRequestException('Vehicle ID is required for vehicle expense');
      }

      const vehicle = await this.prisma.vehicle.findUnique({ where: { id: dto.vehicleId } });
      if (!vehicle) throw new NotFoundException('Vehicle not found');

      voucherNumber = `VEX-${vehicle.vehicleNumber.replace(/\s+/g, '')}-${Date.now().toString().slice(-6)}`;

      createdRecord = await this.prisma.vehicleExpense.create({
        data: {
          id: uuidv7(),
          organizationId: actor.organizationId,
          companyId: dto.companyId,
          vehicleId: dto.vehicleId,
          employeeId: dto.employeeId,
          voucherNumber,
          expenseType: dto.categoryKey.toUpperCase() === 'FUEL' ? 'FUEL' : 'OTHER',
          expenseDate: expDate,
          fuelStation: dto.fuelStation || null,
          quantity: dto.quantity || 0,
          rate: dto.rate || 0,
          totalAmount: dto.amount,
          paymentMethod: dto.paymentMethod || 'CASH',
          remarks: dto.remarks || dto.description || null,
          isEmployeeCost,
          approvalStatus,
          approvedById: dto.overrideApproved ? actor.id : null,
          approvedAt: dto.overrideApproved ? new Date() : null,
          overrideReason: dto.overrideReason || null,
          status: 'POSTED',
          createdById: actor.id,
        },
      });
    } else {
      voucherNumber = `EXP-${Date.now().toString().slice(-6)}`;
      const defaultExpenseAcc = await this.prisma.account.findFirst({
        where: { companyId: dto.companyId, accountCode: '601000' },
      });
      const defaultPaymentAcc = await this.prisma.account.findFirst({
        where: { companyId: dto.companyId, accountCode: '101000' },
      });

      createdRecord = await this.prisma.expenseEntry.create({
        data: {
          id: uuidv7(),
          organizationId: actor.organizationId,
          companyId: dto.companyId,
          voucherNumber,
          expenseDate: expDate,
          expenseAccountId: defaultExpenseAcc?.id || uuidv7(),
          paymentAccountId: defaultPaymentAcc?.id || uuidv7(),
          paymentMethod: dto.paymentMethod || 'CASH',
          amount: dto.amount,
          payee: `Employee Expense: ${dto.categoryKey}`,
          category: dto.categoryKey,
          description: dto.description || dto.remarks || null,
          employeeId: dto.employeeId,
          isEmployeeCost,
          approvalStatus,
          approvedById: dto.overrideApproved ? actor.id : null,
          approvedAt: dto.overrideApproved ? new Date() : null,
          overrideReason: dto.overrideReason || null,
          status: 'POSTED',
          createdById: actor.id,
        },
      });
    }

    // Record audit trail
    await this.prisma.employeeExpenseAudit.create({
      data: {
        id: uuidv7(),
        organizationId: actor.organizationId,
        companyId: dto.companyId,
        employeeId: dto.employeeId,
        expenseType: dto.expenseType,
        expenseId: createdRecord.id,
        voucherNumber,
        currentSales: preCheck.currentSales,
        currentCost: preCheck.currentCost,
        currentCostPercentage: preCheck.currentCostPercentage,
        maximumPercentage: preCheck.maximumAllowedPercentage,
        requestedAmount: dto.amount,
        projectedCost: preCheck.projectedCost,
        projectedCostPercentage: preCheck.projectedCostPercentage,
        decision: dto.overrideApproved ? 'OVERRIDDEN' : preCheck.status,
        approvedById: dto.overrideApproved ? actor.id : null,
        approvedAt: dto.overrideApproved ? new Date() : null,
        reason: dto.overrideReason || preCheck.message,
      },
    });

    return {
      success: true,
      data: createdRecord,
      preCheck,
    };
  }

  /**
   * 10. Dashboard Overview API (Requirement 11 & 12)
   */
  async getDashboard(filters: EmployeeCostFilter) {
    const companyWhere: any = {};
    if (filters.companyId) companyWhere.companyId = filters.companyId;

    const employees = await this.prisma.employee.findMany({
      where: {
        ...companyWhere,
        status: 'ACTIVE',
      },
      include: {
        company: { select: { id: true, name: true } },
        marketAssignments: {
          where: { status: 'ACTIVE' },
          include: {
            region: { select: { id: true, name: true } },
            zone: { select: { id: true, name: true } },
            territory: { select: { id: true, name: true } },
          },
        },
        users: { select: { id: true, email: true } },
      },
      orderBy: { employeeCode: 'asc' },
    });

    // Evaluate all employees
    const evaluations = await Promise.all(
      employees.map((emp) =>
        this.evaluateEmployeeCost(emp.id, {
          companyId: filters.companyId,
          startDate: filters.startDate ? new Date(filters.startDate) : undefined,
          endDate: filters.endDate ? new Date(filters.endDate) : undefined,
        }),
      ),
    );

    // Apply any employee/region/zone/territory filters
    const filteredEvaluations = evaluations.filter((item) => {
      if (filters.employeeId && item.employee.id !== filters.employeeId) {
        return false;
      }
      return true;
    });

    // Compute summary KPI cards
    const totalEmployees = filteredEvaluations.length;
    const totalSales = filteredEvaluations.reduce((sum, e) => sum + e.metrics.sales, 0);
    const totalSalaries = filteredEvaluations.reduce((sum, e) => sum + e.metrics.salary, 0);
    const totalFuel = filteredEvaluations.reduce((sum, e) => sum + e.metrics.fuel, 0);
    const totalOther = filteredEvaluations.reduce((sum, e) => sum + e.metrics.otherExpenses, 0);
    const totalEmployeeCost = filteredEvaluations.reduce((sum, e) => sum + e.metrics.totalEmployeeCost, 0);
    const averageCostPercentage =
      totalSales > 0 ? Math.round((totalEmployeeCost / totalSales) * 10000) / 100 : 0;

    const employeesAboveLimit = filteredEvaluations.filter(
      (e) => e.metrics.status === EmployeeCostStatus.LIMIT_EXCEEDED,
    ).length;
    const employeesNearLimit = filteredEvaluations.filter(
      (e) => e.metrics.status === EmployeeCostStatus.NEAR_LIMIT || e.metrics.status === EmployeeCostStatus.LIMIT_REACHED,
    ).length;
    const employeesWithinLimit = filteredEvaluations.filter(
      (e) => e.metrics.status === EmployeeCostStatus.WITHIN_LIMIT,
    ).length;

    return {
      summary: {
        totalEmployees,
        totalSales: Math.round(totalSales * 100) / 100,
        totalSalaries: Math.round(totalSalaries * 100) / 100,
        totalFuel: Math.round(totalFuel * 100) / 100,
        totalOtherExpenses: Math.round(totalOther * 100) / 100,
        totalEmployeeCost: Math.round(totalEmployeeCost * 100) / 100,
        averageCostPercentage,
        employeesAboveLimit,
        employeesNearLimit,
        employeesWithinLimit,
      },
      employees: filteredEvaluations.map((e) => ({
        id: e.employee.id,
        employeeCode: e.employee.employeeCode,
        name: e.employee.fullName,
        position: e.employee.position,
        companyName: e.employee.company?.name,
        companyId: e.employee.company?.id,
        region: e.employee.region,
        zone: e.employee.zone,
        territory: e.employee.territory,
        sales: e.metrics.sales,
        salary: e.metrics.salary,
        fuel: e.metrics.fuel,
        otherExpenses: e.metrics.otherExpenses,
        totalCost: e.metrics.totalEmployeeCost,
        costPercentage: e.metrics.costPercentage,
        maximumCostPercentage: e.metrics.maximumCostPercentage,
        remainingAllowedPercentage: e.metrics.remainingAllowedPercentage,
        remainingHeadroom: e.metrics.remainingHeadroom,
        status: e.metrics.status,
        salesTarget: e.metrics.salesTarget,
        targetAchievementPercent: e.metrics.targetAchievementPercent,
        creditLimit: e.metrics.creditLimit,
        creditExposure: e.metrics.creditExposure,
        availableCredit: e.metrics.availableCredit,
        creditStatus: e.metrics.creditStatus,
        creditPercentage: e.metrics.creditPercentage,
        maxCreditPercentage: e.metrics.maxCreditPercentage,
        dealerCount: e.metrics.dealerCount,
        invoiceCount: e.metrics.invoiceCount,
      })),
    };
  }

  /**
   * 11. Hierarchical Aggregation Report (Requirements 29, 30, 31)
   * Group -> Company -> Region -> Zone -> Territory -> Sales Officer
   */
  async getHierarchyReport(filters: EmployeeCostFilter) {
    const dashboard = await this.getDashboard(filters);
    const emps = dashboard.employees;

    // Group by Region
    const regionMap = new Map<string, any>();
    for (const emp of emps) {
      const regionName = emp.region || 'Unassigned Region';
      if (!regionMap.has(regionName)) {
        regionMap.set(regionName, {
          name: regionName,
          sales: 0,
          salary: 0,
          fuel: 0,
          other: 0,
          totalCost: 0,
          employeeCount: 0,
          aboveLimitCount: 0,
          zones: new Map<string, any>(),
        });
      }
      const r = regionMap.get(regionName);
      r.sales += emp.sales;
      r.salary += emp.salary;
      r.fuel += emp.fuel;
      r.other += emp.otherExpenses;
      r.totalCost += emp.totalCost;
      r.employeeCount += 1;
      if (emp.status === EmployeeCostStatus.LIMIT_EXCEEDED) r.aboveLimitCount += 1;

      // Sub-group Zone
      const zoneName = emp.zone || 'Unassigned Zone';
      if (!r.zones.has(zoneName)) {
        r.zones.set(zoneName, {
          name: zoneName,
          sales: 0,
          totalCost: 0,
          employeeCount: 0,
          territories: new Map<string, any>(),
        });
      }
      const z = r.zones.get(zoneName);
      z.sales += emp.sales;
      z.totalCost += emp.totalCost;
      z.employeeCount += 1;

      // Sub-group Territory
      const terrName = emp.territory || 'Unassigned Territory';
      if (!z.territories.has(terrName)) {
        z.territories.set(terrName, {
          name: terrName,
          sales: 0,
          totalCost: 0,
          officers: [],
        });
      }
      const t = z.territories.get(terrName);
      t.sales += emp.sales;
      t.totalCost += emp.totalCost;
      t.officers.push(emp);
    }

    const regions = Array.from(regionMap.values()).map((r) => {
      const costPct = r.sales > 0 ? Math.round((r.totalCost / r.sales) * 10000) / 100 : 0;
      const zones = Array.from(r.zones.values()).map((z: any) => {
        const zCostPct = z.sales > 0 ? Math.round((z.totalCost / z.sales) * 10000) / 100 : 0;
        const territories = Array.from(z.territories.values()).map((t: any) => {
          const tCostPct = t.sales > 0 ? Math.round((t.totalCost / t.sales) * 10000) / 100 : 0;
          return {
            name: t.name,
            sales: Math.round(t.sales * 100) / 100,
            totalCost: Math.round(t.totalCost * 100) / 100,
            costPercentage: tCostPct,
            officers: t.officers,
          };
        });
        return {
          name: z.name,
          sales: Math.round(z.sales * 100) / 100,
          totalCost: Math.round(z.totalCost * 100) / 100,
          costPercentage: zCostPct,
          employeeCount: z.employeeCount,
          territories,
        };
      });

      return {
        name: r.name,
        sales: Math.round(r.sales * 100) / 100,
        salary: Math.round(r.salary * 100) / 100,
        fuel: Math.round(r.fuel * 100) / 100,
        otherExpenses: Math.round(r.other * 100) / 100,
        totalCost: Math.round(r.totalCost * 100) / 100,
        costPercentage: costPct,
        maximumCostPercentage: 13.0,
        status: costPct > 13 ? 'ABOVE_LIMIT' : 'WITHIN_LIMIT',
        employeeCount: r.employeeCount,
        aboveLimitCount: r.aboveLimitCount,
        zones,
      };
    });

    return {
      groupSales: dashboard.summary.totalSales,
      groupEmployeeCost: dashboard.summary.totalEmployeeCost,
      groupCostPercentage: dashboard.summary.averageCostPercentage,
      regions,
    };
  }

  /**
   * 12. Policy Management (CRUD)
   */
  async getPolicies(companyId: string) {
    const [costPolicies, categoryPolicies] = await Promise.all([
      this.prisma.employeeCostPolicy.findMany({
        where: { companyId },
        include: { employee: { select: { id: true, firstName: true, lastName: true, employeeCode: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.expenseCategoryPolicy.findMany({
        where: { companyId },
        orderBy: { categoryKey: 'asc' },
      }),
    ]);

    return {
      costPolicies: costPolicies.map((p) => ({
        ...p,
        maximumCostPercentage: Number(p.maximumCostPercentage),
        nearLimitThresholdPercent: Number(p.nearLimitThresholdPercent),
      })),
      categoryPolicies,
    };
  }

  async saveCostPolicy(dto: any, actor: AuthUser) {
    const policy = await this.prisma.employeeCostPolicy.create({
      data: {
        id: uuidv7(),
        organizationId: actor.organizationId,
        companyId: dto.companyId || actor.companyId,
        roleScope: dto.roleScope || 'SALES_OFFICER',
        employeeId: dto.employeeId || null,
        maximumCostPercentage: dto.maximumCostPercentage || 13.0,
        nearLimitThresholdPercent: dto.nearLimitThresholdPercent || 85.0,
        blockingAction: dto.blockingAction || 'APPROVAL_REQUIRED',
        notes: dto.notes || null,
        status: 'ACTIVE',
        createdById: actor.id,
      },
    });
    return policy;
  }

  async saveCategoryPolicy(dto: any, actor: AuthUser) {
    const existing = await this.prisma.expenseCategoryPolicy.findFirst({
      where: {
        companyId: dto.companyId || actor.companyId,
        categoryKey: dto.categoryKey.toUpperCase().trim(),
      },
    });

    if (existing) {
      return this.prisma.expenseCategoryPolicy.update({
        where: { id: existing.id },
        data: {
          categoryName: dto.categoryName || existing.categoryName,
          isEmployeeCost: dto.isEmployeeCost !== undefined ? dto.isEmployeeCost : existing.isEmployeeCost,
          isAssetExpense: dto.isAssetExpense !== undefined ? dto.isAssetExpense : existing.isAssetExpense,
          description: dto.description || existing.description,
        },
      });
    }

    return this.prisma.expenseCategoryPolicy.create({
      data: {
        id: uuidv7(),
        organizationId: actor.organizationId,
        companyId: dto.companyId || actor.companyId,
        categoryKey: dto.categoryKey.toUpperCase().trim(),
        categoryName: dto.categoryName,
        isEmployeeCost: dto.isEmployeeCost !== undefined ? dto.isEmployeeCost : true,
        isAssetExpense: dto.isAssetExpense !== undefined ? dto.isAssetExpense : false,
        description: dto.description || null,
        status: 'ACTIVE',
        createdById: actor.id,
      },
    });
  }

  /**
   * 13. Audit Trail List
   */
  async getAuditTrail(filters: { companyId?: string; employeeId?: string; limit?: number }) {
    const audits = await this.prisma.employeeExpenseAudit.findMany({
      where: {
        ...(filters.companyId ? { companyId: filters.companyId } : {}),
        ...(filters.employeeId ? { employeeId: filters.employeeId } : {}),
      },
      include: {
        employee: { select: { id: true, firstName: true, lastName: true, employeeCode: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: filters.limit || 50,
    });

    return audits.map((a) => ({
      ...a,
      currentSales: Number(a.currentSales),
      currentCost: Number(a.currentCost),
      currentCostPercentage: Number(a.currentCostPercentage),
      maximumPercentage: Number(a.maximumPercentage),
      requestedAmount: Number(a.requestedAmount),
      projectedCost: Number(a.projectedCost),
      projectedCostPercentage: Number(a.projectedCostPercentage),
    }));
  }
}
