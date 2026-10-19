/**
 * SHEHSWAR ONE360 - Financial Transactions Service
 *
 * Implements unified 5 financial transaction types:
 * - Cash Receipt (Debit Cash 101000, Credit Contra Account)
 * - Cash Payment (Debit Contra Account, Credit Cash 101000)
 * - Bank Receipt (Debit Bank 102000, Credit Contra Account)
 * - Bank Payment (Debit Contra Account, Credit Bank 102000)
 * - Real-time Cash & Bank Dashboard & Multi-tier Collections Dashboard
 */
import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { FinanceService } from './finance.service';
import { v7 as uuidv7 } from 'uuid';

export interface CreateFinancialTransactionDto {
  companyId: string;
  transactionType: 'CASH_RECEIPT' | 'CASH_PAYMENT' | 'BANK_RECEIPT' | 'BANK_PAYMENT';
  transactionDate: string | Date;
  partyType?: 'DEALER' | 'VENDOR' | 'EMPLOYEE' | 'OTHER';
  partyId?: string;
  partyName?: string;
  amount: number;
  paymentMethod: 'CASH' | 'BANK' | 'CHEQUE' | 'ONLINE' | 'DD' | 'OTHER';
  accountId?: string;        // Cash or Bank account (defaults to 101000 or 102000)
  contraAccountId?: string;  // Counter account (Receivable, Payable, Expense, etc.)
  contraAccountCode?: string;// Or pass account code
  bankName?: string;
  branchName?: string;
  referenceNumber?: string;
  remarks?: string;
  attachmentUrl?: string;
}

@Injectable()
export class FinancialTransactionsService {
  private readonly logger = new Logger(FinancialTransactionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly financeService: FinanceService,
  ) {}

  /**
   * Post a financial transaction with atomic double-entry GL journal entry
   */
  async createTransaction(
    organizationId: string,
    dto: CreateFinancialTransactionDto,
    userId?: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const amount = Math.round(Number(dto.amount) * 100) / 100;
      if (amount <= 0) {
        throw new BadRequestException('Transaction amount must be greater than zero');
      }

      const txDate = dto.transactionDate ? new Date(dto.transactionDate) : new Date();

      // Determine default Cash / Bank account code if not specified
      const isBank = dto.transactionType === 'BANK_RECEIPT' || dto.transactionType === 'BANK_PAYMENT';
      const defaultCashOrBankCode = isBank ? '102000' : '101000';

      const cashOrBankAccount = await this.financeService.resolveAccount(
        tx,
        organizationId,
        dto.companyId,
        dto.accountId || defaultCashOrBankCode,
      );

      // Resolve contra account (e.g. 103000 AR, 201000 AP, 601000 Expense, etc.)
      const contraIdentifier = dto.contraAccountId || dto.contraAccountCode || (
        dto.transactionType === 'CASH_RECEIPT' || dto.transactionType === 'BANK_RECEIPT' ? '103000' : '601000'
      );
      const contraAccount = await this.financeService.resolveAccount(
        tx,
        organizationId,
        dto.companyId,
        contraIdentifier,
      );

      // Generate voucher number
      const prefix = {
        CASH_RECEIPT: 'CR',
        CASH_PAYMENT: 'CP',
        BANK_RECEIPT: 'BR',
        BANK_PAYMENT: 'BP',
      }[dto.transactionType];
      const voucherNumber = `${prefix}-${Date.now().toString().slice(-8)}`;

      // Setup journal lines:
      // CASH_RECEIPT: Dr Cash (+), Cr Contra (-)
      // CASH_PAYMENT: Dr Contra (+), Cr Cash (-)
      // BANK_RECEIPT: Dr Bank (+), Cr Contra (-)
      // BANK_PAYMENT: Dr Contra (+), Cr Bank (-)
      const isReceipt = dto.transactionType === 'CASH_RECEIPT' || dto.transactionType === 'BANK_RECEIPT';

      const journalLines = isReceipt
        ? [
            {
              accountId: cashOrBankAccount.id,
              debit: amount,
              credit: 0,
              description: `${dto.transactionType}: ${dto.remarks || dto.partyName || 'Receipt'}`,
            },
            {
              accountId: contraAccount.id,
              debit: 0,
              credit: amount,
              description: `Counter entry for ${voucherNumber}`,
            },
          ]
        : [
            {
              accountId: contraAccount.id,
              debit: amount,
              credit: 0,
              description: `${dto.transactionType}: ${dto.remarks || dto.partyName || 'Payment'}`,
            },
            {
              accountId: cashOrBankAccount.id,
              debit: 0,
              credit: amount,
              description: `Counter entry for ${voucherNumber}`,
            },
          ];

      const recordId = uuidv7();
      const journal = await this.financeService.postJournalEntry(tx, {
        organizationId,
        companyId: dto.companyId,
        sourceType: 'EXPENSE', // Or appropriate source type
        sourceId: recordId,
        referenceType: dto.transactionType,
        referenceNumber: voucherNumber,
        description: `[${dto.transactionType}] ${dto.partyName ? `Party: ${dto.partyName}. ` : ''}${dto.remarks || ''}`,
        entryDate: txDate,
        createdById: userId,
        lines: journalLines,
      });

      // Record FinancialTransaction record
      const record = await tx.financialTransaction.create({
        data: {
          id: recordId,
          organizationId,
          companyId: dto.companyId,
          voucherNumber,
          transactionType: dto.transactionType,
          transactionDate: txDate,
          partyType: dto.partyType || null,
          partyId: dto.partyId || null,
          partyName: dto.partyName || null,
          amount,
          paymentMethod: dto.paymentMethod || (isBank ? 'BANK' : 'CASH'),
          accountId: cashOrBankAccount.id,
          contraAccountId: contraAccount.id,
          bankName: dto.bankName || null,
          branchName: dto.branchName || null,
          referenceNumber: dto.referenceNumber || null,
          remarks: dto.remarks || null,
          attachmentUrl: dto.attachmentUrl || null,
          status: 'POSTED',
          journalEntryId: journal.id,
          createdById: userId || null,
        },
        include: {
          account: true,
          contraAccount: true,
          company: { select: { id: true, code: true, name: true } },
        },
      });

      this.logger.log(`Created ${dto.transactionType} voucher: ${voucherNumber} for PKR ${amount}`);
      return record;
    });
  }

  /**
   * List financial transactions with filters
   */
  async getTransactions(filters: {
    companyId?: string;
    transactionType?: string;
    status?: string;
    fromDate?: string;
    toDate?: string;
    search?: string;
  }) {
    const where: any = {};
    if (filters.companyId && filters.companyId !== 'ALL') where.companyId = filters.companyId;
    if (filters.transactionType && filters.transactionType !== 'ALL') where.transactionType = filters.transactionType;
    if (filters.status && filters.status !== 'ALL') where.status = filters.status;

    if (filters.fromDate || filters.toDate) {
      where.transactionDate = {};
      if (filters.fromDate) where.transactionDate.gte = new Date(filters.fromDate);
      if (filters.toDate) where.transactionDate.lte = new Date(filters.toDate);
    }

    if (filters.search?.trim()) {
      where.OR = [
        { voucherNumber: { contains: filters.search.trim(), mode: 'insensitive' } },
        { partyName: { contains: filters.search.trim(), mode: 'insensitive' } },
        { referenceNumber: { contains: filters.search.trim(), mode: 'insensitive' } },
        { remarks: { contains: filters.search.trim(), mode: 'insensitive' } },
      ];
    }

    return this.prisma.financialTransaction.findMany({
      where,
      include: {
        account: { select: { id: true, accountCode: true, accountName: true } },
        contraAccount: { select: { id: true, accountCode: true, accountName: true } },
        company: { select: { id: true, code: true, name: true } },
      },
      orderBy: { transactionDate: 'desc' },
      take: 200,
    });
  }

  /**
   * Cash & Bank Dashboard: Real-time balances and transaction totals from actual database
   */
  async getCashBankDashboard(companyId?: string) {
    const companyWhere: any = {};
    if (companyId && companyId !== 'ALL') companyWhere.companyId = companyId;

    // 1. Fetch real Cash & Bank account balances
    const cashAccounts = await this.prisma.account.findMany({
      where: {
        ...companyWhere,
        accountCode: { in: ['101000', '1000'] },
      },
      select: { currentBalance: true },
    });
    const cashBalance = cashAccounts.reduce((sum, a) => sum + Number(a.currentBalance || 0), 0);

    const bankAccounts = await this.prisma.account.findMany({
      where: {
        ...companyWhere,
        accountCode: { in: ['102000', '1010'] },
      },
      select: { currentBalance: true },
    });
    const bankBalance = bankAccounts.reduce((sum, a) => sum + Number(a.currentBalance || 0), 0);

    // 2. Aggregate transactions
    const txs = await this.prisma.financialTransaction.findMany({
      where: { ...companyWhere, status: 'POSTED' },
      select: { transactionType: true, amount: true },
    });

    let cashReceipts = 0;
    let cashPayments = 0;
    let bankReceipts = 0;
    let bankPayments = 0;

    for (const t of txs) {
      const amt = Number(t.amount);
      if (t.transactionType === 'CASH_RECEIPT') cashReceipts += amt;
      else if (t.transactionType === 'CASH_PAYMENT') cashPayments += amt;
      else if (t.transactionType === 'BANK_RECEIPT') bankReceipts += amt;
      else if (t.transactionType === 'BANK_PAYMENT') bankPayments += amt;
    }

    // 3. Aggregate PR status
    const prs = await this.prisma.provisionalReceipt.findMany({
      where: { ...companyWhere, status: { not: 'CANCELLED' } },
      select: { status: true, totalAmount: true, allocatedAmount: true, unallocatedAmount: true },
    });

    let totalPrAmount = 0;
    let allocatedPr = 0;
    let unallocatedPr = 0;
    let pendingPrCount = 0;

    for (const pr of prs) {
      totalPrAmount += Number(pr.totalAmount);
      allocatedPr += Number(pr.allocatedAmount);
      unallocatedPr += Number(pr.unallocatedAmount);
      if (pr.status === 'PENDING_ALLOCATION' || pr.status === 'DRAFT') {
        pendingPrCount++;
      }
    }

    const totalCollections = cashReceipts + bankReceipts + allocatedPr;

    return {
      cashBalance: Math.round(cashBalance * 100) / 100,
      bankBalance: Math.round(bankBalance * 100) / 100,
      cashReceipts: Math.round(cashReceipts * 100) / 100,
      cashPayments: Math.round(cashPayments * 100) / 100,
      bankReceipts: Math.round(bankReceipts * 100) / 100,
      bankPayments: Math.round(bankPayments * 100) / 100,
      totalPrAmount: Math.round(totalPrAmount * 100) / 100,
      allocatedPr: Math.round(allocatedPr * 100) / 100,
      unallocatedPr: Math.round(unallocatedPr * 100) / 100,
      pendingPrCount,
      totalCollections: Math.round(totalCollections * 100) / 100,
    };
  }

  /**
   * Multi-tier Collections Dashboard:
   * Total Collections, Cash Collections, Bank Collections, PR Collections
   * Broken down across market hierarchy: Company, Region, Zone, Territory, Sales Officer, Dealer
   */
  async getCollectionsDashboard(filters: {
    companyId?: string;
    regionId?: string;
    zoneId?: string;
    territoryId?: string;
  }) {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    const compWhere: any = {};
    if (filters.companyId && filters.companyId !== 'ALL') compWhere.companyId = filters.companyId;

    // Fetch receipts
    const txs = await this.prisma.financialTransaction.findMany({
      where: {
        ...compWhere,
        status: 'POSTED',
        transactionType: { in: ['CASH_RECEIPT', 'BANK_RECEIPT'] },
      },
      select: {
        transactionType: true,
        amount: true,
        transactionDate: true,
        companyId: true,
      },
    });

    // Fetch PR allocations (collections from dealers)
    const prAllocations = await this.prisma.provisionalReceiptAllocation.findMany({
      where: {
        status: 'POSTED',
        ...(filters.regionId ? { regionId: filters.regionId } : {}),
        ...(filters.territoryId ? { territoryId: filters.territoryId } : {}),
      },
      include: {
        provisionalReceipt: { select: { companyId: true, receiptDate: true } },
        dealer: {
          select: {
            id: true,
            code: true,
            name: true,
            territory: {
              select: {
                id: true,
                name: true,
                zone: {
                  select: {
                    id: true,
                    name: true,
                    region: { select: { id: true, name: true } },
                  },
                },
              },
            },
          },
        },
      },
    });

    let todayCash = 0;
    let todayBank = 0;
    let todayPr = 0;
    let monthCash = 0;
    let monthBank = 0;
    let monthPr = 0;
    let yearCash = 0;
    let yearBank = 0;
    let yearPr = 0;
    let totalCash = 0;
    let totalBank = 0;
    let totalPr = 0;

    for (const t of txs) {
      const amt = Number(t.amount);
      const d = new Date(t.transactionDate);
      const isC = t.transactionType === 'CASH_RECEIPT';

      if (isC) totalCash += amt;
      else totalBank += amt;

      if (d >= startOfToday) {
        if (isC) todayCash += amt;
        else todayBank += amt;
      }
      if (d >= startOfMonth) {
        if (isC) monthCash += amt;
        else monthBank += amt;
      }
      if (d >= startOfYear) {
        if (isC) yearCash += amt;
        else yearBank += amt;
      }
    }

    for (const a of prAllocations) {
      const amt = Number(a.allocatedAmount);
      const d = new Date(a.createdAt);
      totalPr += amt;

      if (d >= startOfToday) todayPr += amt;
      if (d >= startOfMonth) monthPr += amt;
      if (d >= startOfYear) yearPr += amt;
    }

    // Dealer-level breakdown of collections
    const dealerMap = new Map<string, { code: string; name: string; amount: number; territory: string; region: string }>();
    for (const a of prAllocations) {
      const dId = a.dealerId;
      const existing = dealerMap.get(dId) || {
        code: a.dealer.code,
        name: a.dealer.name,
        amount: 0,
        territory: a.dealer.territory?.name || 'Unassigned',
        region: a.dealer.territory?.zone?.region?.name || 'Unassigned',
      };
      existing.amount += Number(a.allocatedAmount);
      dealerMap.set(dId, existing);
    }

    const dealerCollections = Array.from(dealerMap.values())
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 20);

    return {
      today: {
        total: Math.round((todayCash + todayBank + todayPr) * 100) / 100,
        cash: Math.round(todayCash * 100) / 100,
        bank: Math.round(todayBank * 100) / 100,
        pr: Math.round(todayPr * 100) / 100,
      },
      thisMonth: {
        total: Math.round((monthCash + monthBank + monthPr) * 100) / 100,
        cash: Math.round(monthCash * 100) / 100,
        bank: Math.round(monthBank * 100) / 100,
        pr: Math.round(monthPr * 100) / 100,
      },
      thisYear: {
        total: Math.round((yearCash + yearBank + yearPr) * 100) / 100,
        cash: Math.round(yearCash * 100) / 100,
        bank: Math.round(yearBank * 100) / 100,
        pr: Math.round(yearPr * 100) / 100,
      },
      allTime: {
        total: Math.round((totalCash + totalBank + totalPr) * 100) / 100,
        cash: Math.round(totalCash * 100) / 100,
        bank: Math.round(totalBank * 100) / 100,
        pr: Math.round(totalPr * 100) / 100,
      },
      topDealers: dealerCollections,
    };
  }

  /**
   * Record Employee Salary Payment
   * Integrates atomically with General Ledger (Debit 607000 Salaries Expense, Credit 101000/102000 Cash/Bank)
   */
  async createSalaryPayment(
    organizationId: string,
    dto: {
      companyId: string;
      employeeId: string;
      salaryMonth: string;
      paymentDate: string | Date;
      grossSalary?: number;
      baseSalary?: number;
      adjustments?: number;
      netPaid?: number;
      netSalary?: number;
      paymentMethod: 'CASH' | 'BANK';
      referenceNumber?: string;
      remarks?: string;
      attachmentUrl?: string;
    },
    userId?: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const employee = await tx.employee.findUnique({
        where: { id: dto.employeeId },
        include: { company: true },
      });
      if (!employee) throw new NotFoundException('Employee not found');

      const gross = Number(dto.grossSalary ?? dto.baseSalary ?? employee.salary ?? 0);
      const adj = Number(dto.adjustments || 0);
      const netPaid =
        dto.netPaid !== undefined
          ? Number(dto.netPaid)
          : dto.netSalary !== undefined
          ? Number(dto.netSalary)
          : Math.round((gross + adj) * 100) / 100;

      if (netPaid <= 0) {
        throw new BadRequestException('Net salary paid must be greater than zero');
      }

      const salaryPaymentId = uuidv7();
      const voucherNumber = `SAL-${employee.employeeCode}-${Date.now().toString().slice(-6)}`;
      const pDate = dto.paymentDate ? new Date(dto.paymentDate) : new Date();
      const isBank = dto.paymentMethod === 'BANK';
      const paymentAccountCode = isBank ? '102000' : '101000';
      const expenseAccountCode = '607000'; // Salaries & Employee Expenses

      // 1. Post GL Journal Entry
      const journal = await this.financeService.postJournalEntry(tx, {
        organizationId,
        companyId: dto.companyId,
        sourceType: 'EXPENSE',
        sourceId: salaryPaymentId,
        referenceType: 'SALARY_PAYMENT',
        referenceNumber: voucherNumber,
        description: `Salary Payment for ${employee.firstName} ${employee.lastName} (${employee.employeeCode}) - ${dto.salaryMonth}`,
        entryDate: pDate,
        createdById: userId,
        lines: [
          {
            accountCode: expenseAccountCode,
            debit: netPaid,
            credit: 0,
            description: `Salary expense ${dto.salaryMonth} for ${employee.firstName} ${employee.lastName}`,
          },
          {
            accountCode: paymentAccountCode,
            debit: 0,
            credit: netPaid,
            description: `Payment of salary ${dto.salaryMonth} for ${employee.firstName} ${employee.lastName}`,
          },
        ],
      });

      // 2. Create EmployeeSalaryPayment record
      const salaryPayment = await tx.employeeSalaryPayment.create({
        data: {
          id: salaryPaymentId,
          organizationId,
          companyId: dto.companyId,
          employeeId: dto.employeeId,
          voucherNumber,
          salaryMonth: dto.salaryMonth,
          paymentDate: pDate,
          grossSalary: gross,
          adjustments: adj,
          netPaid,
          paymentMethod: dto.paymentMethod,
          referenceNumber: dto.referenceNumber || null,
          remarks: dto.remarks || null,
          attachmentUrl: dto.attachmentUrl || null,
          journalEntryId: journal.id,
          status: 'POSTED',
          createdById: userId || null,
        },
        include: {
          employee: {
            select: { id: true, employeeCode: true, firstName: true, lastName: true, position: true },
          },
        },
      });

      this.logger.log(
        `Recorded salary payment: ${voucherNumber} | PKR ${netPaid} for ${employee.employeeCode}`,
      );

      return salaryPayment;
    });
  }

  /**
   * Get salary payments list with filters
   */
  async getSalaryPayments(filters: {
    companyId?: string;
    employeeId?: string;
    salaryMonth?: string;
  }) {
    const where: any = {};
    if (filters.companyId && filters.companyId !== 'ALL') where.companyId = filters.companyId;
    if (filters.employeeId) where.employeeId = filters.employeeId;
    if (filters.salaryMonth) where.salaryMonth = filters.salaryMonth;

    return this.prisma.employeeSalaryPayment.findMany({
      where,
      include: {
        employee: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            position: true,
            company: { select: { id: true, code: true, name: true } },
          },
        },
      },
      orderBy: { paymentDate: 'desc' },
    });
  }
}

