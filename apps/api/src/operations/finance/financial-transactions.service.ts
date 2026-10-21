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
import { DealerLedgerService } from '../ledger/dealer-ledger.service';
import { VendorLedgerService } from '../ledger/vendor-ledger.service';
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
  bankAccountId?: string;
  referenceNumber?: string;
  remarks?: string;
  attachmentUrl?: string;
}

export interface CreateBankAccountDto {
  companyId: string;
  bankName: string;
  accountTitle: string;
  accountNumber: string;
  branchName?: string;
  branchCode?: string;
  iban?: string;
  swiftCode?: string;
  currency?: string;
  openingBalance?: number;
  notes?: string;
}

@Injectable()
export class FinancialTransactionsService {
  private readonly logger = new Logger(FinancialTransactionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly financeService: FinanceService,
    private readonly dealerLedgerService: DealerLedgerService,
    private readonly vendorLedgerService: VendorLedgerService,
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

      let resolvedBankName = dto.bankName || null;
      let resolvedBranchName = dto.branchName || null;
      let linkedBankAccountId: string | null = null;

      if (isBank && dto.bankAccountId) {
        const bankAcc = await tx.bankAccount.findFirst({
          where: { id: dto.bankAccountId, companyId: dto.companyId },
        });
        if (bankAcc) {
          linkedBankAccountId = bankAcc.id;
          resolvedBankName = bankAcc.bankName;
          resolvedBranchName = bankAcc.branchName || dto.branchName || null;

          // Authoritatively update bank account balance:
          // Receipt = Debit bank (+)
          // Payment = Credit bank (-)
          await tx.bankAccount.update({
            where: { id: bankAcc.id },
            data: {
              currentBalance: {
                [isReceipt ? 'increment' : 'decrement']: amount,
              },
            },
          });
        }
      }

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
          bankAccountId: linkedBankAccountId,
          bankName: resolvedBankName,
          branchName: resolvedBranchName,
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
          bankAccount: true,
        },
      });

      // Atomic Bridge: If Party is DEALER, create DealerPaymentReceipt & credit DealerLedger
      if (dto.partyType === 'DEALER' && dto.partyId) {
        const dealer = await tx.dealer.findFirst({
          where: { id: dto.partyId, companyId: dto.companyId },
        });

        if (dealer) {
          if (isReceipt) {
            // 1. Create linked DealerPaymentReceipt so it appears in Dealer Payments & statements
            const paymentReceipt = await tx.dealerPaymentReceipt.create({
              data: {
                id: uuidv7(),
                organizationId,
                companyId: dto.companyId,
                receiptNumber: voucherNumber,
                dealerId: dealer.id,
                salesOfficerId: dealer.assignedFieldOfficerId ?? null,
                paymentType: isBank ? 'BANK' : 'CASH',
                amount,
                paymentDate: txDate,
                bankName: dto.bankName || null,
                referenceNumber: dto.referenceNumber || null,
                status: 'CONFIRMED',
                notes: dto.remarks || `Logged via Cash/Bank Voucher: ${voucherNumber}`,
              },
            });

            // 2. Post credit to Dealer Ledger (decreases outstanding balance, updates dealer.currentBalance)
            await this.dealerLedgerService.postEntry(tx, {
              organizationId,
              companyId: dto.companyId,
              dealerId: dealer.id,
              entryType: 'PAYMENT_RECEIPT',
              referenceId: record.id,
              voucherNumber,
              description: `[${dto.transactionType}] Collection - ${dto.remarks || voucherNumber}`,
              debit: 0,
              credit: amount,
              dealerPaymentId: paymentReceipt.id,
            });
          } else {
            // Payment to dealer (refund or debit)
            await this.dealerLedgerService.postEntry(tx, {
              organizationId,
              companyId: dto.companyId,
              dealerId: dealer.id,
              entryType: 'SALES_RETURN',
              referenceId: record.id,
              voucherNumber,
              description: `[${dto.transactionType}] Payment to Dealer - ${dto.remarks || voucherNumber}`,
              debit: amount,
              credit: 0,
            });
          }
        }
      }

      // Atomic Bridge: If Party is VENDOR and Payment, create VendorPayment & debit VendorLedger
      if (dto.partyType === 'VENDOR' && dto.partyId && !isReceipt) {
        const vendor = await tx.vendor.findFirst({
          where: { id: dto.partyId, companyId: dto.companyId },
        });

        if (vendor) {
          const vPayment = await tx.vendorPayment.create({
            data: {
              id: uuidv7(),
              organizationId,
              companyId: dto.companyId,
              voucherNumber,
              vendorId: vendor.id,
              paymentType: isBank ? 'BANK_TRANSFER' : 'CASH',
              amount,
              paymentDate: txDate,
              bankName: dto.bankName || null,
              referenceNumber: dto.referenceNumber || null,
              status: 'POSTED',
              notes: dto.remarks || `Cash/Bank Payment Voucher: ${voucherNumber}`,
            },
          });

          await this.vendorLedgerService.postEntry(tx, {
            organizationId,
            companyId: dto.companyId,
            vendorId: vendor.id,
            entryType: 'VENDOR_PAYMENT',
            referenceId: record.id,
            voucherNumber,
            description: `[${dto.transactionType}] Vendor Payment - ${dto.remarks || voucherNumber}`,
            debit: amount,
            credit: 0,
            vendorPaymentId: vPayment.id,
          });
        }
      }

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
        bankAccount: true,
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

    // 1. Fetch real Cash account balances
    const cashAccounts = await this.prisma.account.findMany({
      where: {
        ...companyWhere,
        OR: [
          { accountCode: { in: ['101000', '1000'] } },
          { accountCode: { endsWith: '101000' } },
        ],
      },
      select: { currentBalance: true },
    });
    const cashBalance = cashAccounts.reduce((sum, a) => sum + Number(a.currentBalance || 0), 0);

    // 2. Fetch authoritative bank accounts
    const bankAccounts = await this.getBankAccounts(companyId);
    const totalBankBalance = bankAccounts.reduce((sum, a) => sum + a.currentBalance, 0);
    const totalCashBankBalance = cashBalance + totalBankBalance;

    // 3. Group by bank name (HBL, UBL, Bank Alfalah, Meezan Bank, etc.)
    const bankGroupMap: Record<string, {
      bankName: string;
      totalBalance: number;
      totalOpening: number;
      totalReceipts: number;
      totalPayments: number;
      accountCount: number;
      accounts: any[];
    }> = {};

    for (const acc of bankAccounts) {
      const bName = acc.bankName || 'Other Banks';
      const grp = bankGroupMap[bName] ?? {
        bankName: bName,
        totalBalance: 0,
        totalOpening: 0,
        totalReceipts: 0,
        totalPayments: 0,
        accountCount: 0,
        accounts: [],
      };
      grp.totalBalance += acc.currentBalance;
      grp.totalOpening += acc.openingBalance;
      grp.totalReceipts += acc.totalReceipts;
      grp.totalPayments += acc.totalPayments;
      grp.accountCount += 1;
      grp.accounts.push(acc);
      bankGroupMap[bName] = grp;
    }
    const bankGroups = Object.values(bankGroupMap);

    // 4. Aggregate transactions
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

    // 5. Aggregate PR status
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
      bankBalance: Math.round(totalBankBalance * 100) / 100,
      totalBankBalance: Math.round(totalBankBalance * 100) / 100,
      totalCashBankBalance: Math.round(totalCashBankBalance * 100) / 100,
      bankAccounts,
      bankGroups,
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

    // Direct dealer payment receipts
    const directDealerPayments = await this.prisma.dealerPaymentReceipt.findMany({
      where: {
        ...compWhere,
        status: 'CONFIRMED',
      },
      include: {
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

    for (const dp of directDealerPayments) {
      const dId = dp.dealerId;
      const existing = dealerMap.get(dId) || {
        code: dp.dealer.code,
        name: dp.dealer.name,
        amount: 0,
        territory: dp.dealer.territory?.name || 'Unassigned',
        region: dp.dealer.territory?.zone?.region?.name || 'Unassigned',
      };
      existing.amount += Number(dp.amount);
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

  /**
   * List all Bank Accounts with real-time authoritative balances:
   * Current Balance = Opening Balance + sum(Posted Bank Receipts) - sum(Posted Bank Payments)
   */
  async getBankAccounts(companyId?: string) {
    const where: any = { isActive: true };
    if (companyId && companyId !== 'ALL') where.companyId = companyId;

    const accounts = await this.prisma.bankAccount.findMany({
      where,
      include: {
        company: { select: { id: true, code: true, name: true } },
      },
      orderBy: [
        { bankName: 'asc' },
        { accountNumber: 'asc' },
      ],
    });

    const results = await Promise.all(
      accounts.map(async (acc) => {
        const txs = await this.prisma.financialTransaction.findMany({
          where: { bankAccountId: acc.id, status: 'POSTED' },
          select: { transactionType: true, amount: true },
        });

        let totalReceipts = 0;
        let totalPayments = 0;
        for (const t of txs) {
          if (t.transactionType === 'BANK_RECEIPT') totalReceipts += Number(t.amount);
          else if (t.transactionType === 'BANK_PAYMENT') totalPayments += Number(t.amount);
        }

        const openingBalance = Number(acc.openingBalance);
        const currentBalance = openingBalance + totalReceipts - totalPayments;

        // Keep currentBalance authoritative in db
        if (Number(acc.currentBalance) !== currentBalance) {
          await this.prisma.bankAccount.update({
            where: { id: acc.id },
            data: { currentBalance },
          });
        }

        return {
          ...acc,
          openingBalance,
          totalReceipts,
          totalPayments,
          currentBalance,
        };
      })
    );

    return results;
  }

  /**
   * Create a new Bank Account dynamically
   */
  async createBankAccount(organizationId: string, dto: CreateBankAccountDto, _userId?: string) {
    if (!dto.bankName?.trim() || !dto.accountTitle?.trim() || !dto.accountNumber?.trim() || !dto.companyId) {
      throw new BadRequestException('bankName, accountTitle, accountNumber, and companyId are required');
    }

    const openingBalance = Number(dto.openingBalance || 0);

    const account = await this.prisma.bankAccount.create({
      data: {
        id: uuidv7(),
        organizationId,
        companyId: dto.companyId,
        bankName: dto.bankName.trim(),
        accountTitle: dto.accountTitle.trim(),
        accountNumber: dto.accountNumber.trim(),
        branchName: dto.branchName?.trim() || null,
        branchCode: dto.branchCode?.trim() || null,
        iban: dto.iban?.trim() || null,
        swiftCode: dto.swiftCode?.trim() || null,
        currency: dto.currency || 'PKR',
        openingBalance,
        currentBalance: openingBalance,
        notes: dto.notes || null,
        isActive: true,
      },
      include: {
        company: { select: { id: true, code: true, name: true } },
      },
    });

    this.logger.log(`Created Bank Account: ${account.bankName} - ${account.accountNumber} for company ${dto.companyId}`);
    return account;
  }

  /**
   * Bank Account Drill-Down Transaction Ledger with Running Balance
   */
  async getBankAccountLedger(bankAccountId: string, filters?: { fromDate?: string; toDate?: string }) {
    const bankAccount = await this.prisma.bankAccount.findUnique({
      where: { id: bankAccountId },
      include: {
        company: { select: { id: true, code: true, name: true } },
      },
    });

    if (!bankAccount) {
      throw new NotFoundException(`Bank account ${bankAccountId} not found`);
    }

    const fromDate = filters?.fromDate ? new Date(filters.fromDate) : null;
    const toDate = filters?.toDate ? new Date(filters.toDate) : null;

    // Prior transactions for period opening balance
    let priorReceipts = 0;
    let priorPayments = 0;

    if (fromDate) {
      const priorTxs = await this.prisma.financialTransaction.findMany({
        where: {
          bankAccountId,
          status: 'POSTED',
          transactionDate: { lt: fromDate },
        },
        select: { transactionType: true, amount: true },
      });
      for (const pt of priorTxs) {
        if (pt.transactionType === 'BANK_RECEIPT') priorReceipts += Number(pt.amount);
        else if (pt.transactionType === 'BANK_PAYMENT') priorPayments += Number(pt.amount);
      }
    }

    const periodOpeningBalance = Number(bankAccount.openingBalance) + priorReceipts - priorPayments;

    // Transactions in period
    const txWhere: any = {
      bankAccountId,
      status: 'POSTED',
    };
    if (fromDate || toDate) {
      txWhere.transactionDate = {};
      if (fromDate) txWhere.transactionDate.gte = fromDate;
      if (toDate) txWhere.transactionDate.lte = toDate;
    }

    const transactions = await this.prisma.financialTransaction.findMany({
      where: txWhere,
      orderBy: [
        { transactionDate: 'asc' },
        { createdAt: 'asc' },
      ],
      include: {
        account: { select: { id: true, accountCode: true, accountName: true } },
        contraAccount: { select: { id: true, accountCode: true, accountName: true } },
        company: { select: { id: true, code: true, name: true } },
      },
    });

    let runningBalance = periodOpeningBalance;
    let periodReceipts = 0;
    let periodPayments = 0;

    const ledgerEntries = transactions.map((t) => {
      const amt = Number(t.amount);
      const isReceipt = t.transactionType === 'BANK_RECEIPT';
      const debit = isReceipt ? amt : 0;
      const credit = !isReceipt ? amt : 0;

      if (isReceipt) {
        runningBalance += debit;
        periodReceipts += debit;
      } else {
        runningBalance -= credit;
        periodPayments += credit;
      }

      return {
        id: t.id,
        date: t.transactionDate,
        transactionType: t.transactionType,
        voucherNumber: t.voucherNumber,
        referenceNumber: t.referenceNumber,
        partyName: t.partyName,
        partyType: t.partyType,
        debit,
        credit,
        runningBalance: Math.round(runningBalance * 100) / 100,
        status: t.status,
        remarks: t.remarks,
        contraAccount: t.contraAccount?.accountName || 'Counter Account',
      };
    });

    // Lifetime metrics
    const allTxs = await this.prisma.financialTransaction.findMany({
      where: { bankAccountId, status: 'POSTED' },
      select: { transactionType: true, amount: true },
    });
    let lifetimeReceipts = 0;
    let lifetimePayments = 0;
    for (const at of allTxs) {
      if (at.transactionType === 'BANK_RECEIPT') lifetimeReceipts += Number(at.amount);
      else if (at.transactionType === 'BANK_PAYMENT') lifetimePayments += Number(at.amount);
    }
    const lifetimeCurrentBalance = Number(bankAccount.openingBalance) + lifetimeReceipts - lifetimePayments;

    return {
      account: {
        id: bankAccount.id,
        bankName: bankAccount.bankName,
        accountTitle: bankAccount.accountTitle,
        accountNumber: bankAccount.accountNumber,
        branchName: bankAccount.branchName,
        branchCode: bankAccount.branchCode,
        currency: bankAccount.currency,
        company: bankAccount.company,
        initialOpeningBalance: Number(bankAccount.openingBalance),
        periodOpeningBalance: Math.round(periodOpeningBalance * 100) / 100,
        periodReceipts: Math.round(periodReceipts * 100) / 100,
        periodPayments: Math.round(periodPayments * 100) / 100,
        periodClosingBalance: Math.round(runningBalance * 100) / 100,
        lifetimeReceipts: Math.round(lifetimeReceipts * 100) / 100,
        lifetimePayments: Math.round(lifetimePayments * 100) / 100,
        lifetimeCurrentBalance: Math.round(lifetimeCurrentBalance * 100) / 100,
      },
      transactions: ledgerEntries,
    };
  }

  /**
   * Cash & Bank Reports: Bank-wise summary, account breakdowns, period filters (Daily, Monthly, Quarterly, Yearly, Custom)
   */
  async getCashBankReports(filters: {
    companyId?: string;
    bankName?: string;
    bankAccountId?: string;
    transactionType?: string;
    period?: 'DAILY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY' | 'CUSTOM';
    dateFrom?: string;
    dateTo?: string;
    status?: string;
  }) {
    let fromDate = filters.dateFrom ? new Date(filters.dateFrom) : undefined;
    let toDate = filters.dateTo ? new Date(filters.dateTo) : undefined;

    const now = new Date();
    if (filters.period && !filters.dateFrom && !filters.dateTo) {
      if (filters.period === 'DAILY') {
        fromDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        toDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
      } else if (filters.period === 'MONTHLY') {
        fromDate = new Date(now.getFullYear(), now.getMonth(), 1);
        toDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
      } else if (filters.period === 'QUARTERLY') {
        const quarterMonth = Math.floor(now.getMonth() / 3) * 3;
        fromDate = new Date(now.getFullYear(), quarterMonth, 1);
        toDate = new Date(now.getFullYear(), quarterMonth + 3, 0, 23, 59, 59);
      } else if (filters.period === 'YEARLY') {
        fromDate = new Date(now.getFullYear(), 0, 1);
        toDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
      }
    }

    // 1. Bank Accounts Report
    const bankAccounts = await this.getBankAccounts(filters.companyId);
    let filteredBankAccounts = bankAccounts;
    if (filters.bankName && filters.bankName !== 'ALL') {
      filteredBankAccounts = filteredBankAccounts.filter(
        (a) => a.bankName.toLowerCase() === filters.bankName!.toLowerCase(),
      );
    }
    if (filters.bankAccountId && filters.bankAccountId !== 'ALL') {
      filteredBankAccounts = filteredBankAccounts.filter((a) => a.id === filters.bankAccountId);
    }

    const bankReportRows = await Promise.all(
      filteredBankAccounts.map(async (acc) => {
        let priorReceipts = 0;
        let priorPayments = 0;

        if (fromDate) {
          const priorTxs = await this.prisma.financialTransaction.findMany({
            where: {
              bankAccountId: acc.id,
              status: 'POSTED',
              transactionDate: { lt: fromDate },
            },
            select: { transactionType: true, amount: true },
          });
          for (const pt of priorTxs) {
            if (pt.transactionType === 'BANK_RECEIPT') priorReceipts += Number(pt.amount);
            else if (pt.transactionType === 'BANK_PAYMENT') priorPayments += Number(pt.amount);
          }
        }
        const opening = Number(acc.openingBalance) + priorReceipts - priorPayments;

        const periodWhere: any = { bankAccountId: acc.id, status: 'POSTED' };
        if (fromDate || toDate) {
          periodWhere.transactionDate = {};
          if (fromDate) periodWhere.transactionDate.gte = fromDate;
          if (toDate) periodWhere.transactionDate.lte = toDate;
        }

        const periodTxs = await this.prisma.financialTransaction.findMany({
          where: periodWhere,
          select: { transactionType: true, amount: true },
        });

        let receipts = 0;
        let payments = 0;
        for (const pt of periodTxs) {
          if (pt.transactionType === 'BANK_RECEIPT') receipts += Number(pt.amount);
          else if (pt.transactionType === 'BANK_PAYMENT') payments += Number(pt.amount);
        }

        const closing = opening + receipts - payments;

        return {
          id: acc.id,
          bankName: acc.bankName,
          accountTitle: acc.accountTitle,
          accountNumber: acc.accountNumber,
          branchName: acc.branchName,
          companyName: acc.company?.name || 'Shehswar Group',
          opening: Math.round(opening * 100) / 100,
          receipts: Math.round(receipts * 100) / 100,
          payments: Math.round(payments * 100) / 100,
          closing: Math.round(closing * 100) / 100,
        };
      }),
    );

    // Group rows by bank
    const bankGroupReportMap: Record<
      string,
      { bankName: string; opening: number; receipts: number; payments: number; closing: number; accounts: any[] }
    > = {};

    for (const row of bankReportRows) {
      const bg = bankGroupReportMap[row.bankName] ?? {
        bankName: row.bankName,
        opening: 0,
        receipts: 0,
        payments: 0,
        closing: 0,
        accounts: [],
      };
      bg.opening += row.opening;
      bg.receipts += row.receipts;
      bg.payments += row.payments;
      bg.closing += row.closing;
      bg.accounts.push(row);
      bankGroupReportMap[row.bankName] = bg;
    }
    const bankWiseSummary = Object.values(bankGroupReportMap).map((bg) => ({
      ...bg,
      opening: Math.round(bg.opening * 100) / 100,
      receipts: Math.round(bg.receipts * 100) / 100,
      payments: Math.round(bg.payments * 100) / 100,
      closing: Math.round(bg.closing * 100) / 100,
    }));

    const totalBankOpening = Math.round(bankWiseSummary.reduce((s, b) => s + b.opening, 0) * 100) / 100;
    const totalBankReceipts = Math.round(bankWiseSummary.reduce((s, b) => s + b.receipts, 0) * 100) / 100;
    const totalBankPayments = Math.round(bankWiseSummary.reduce((s, b) => s + b.payments, 0) * 100) / 100;
    const totalBankClosing = Math.round(bankWiseSummary.reduce((s, b) => s + b.closing, 0) * 100) / 100;

    // 2. Cash Report
    const cashWhere: any = {
      transactionType: { in: ['CASH_RECEIPT', 'CASH_PAYMENT'] },
      status: 'POSTED',
    };
    if (filters.companyId && filters.companyId !== 'ALL') cashWhere.companyId = filters.companyId;

    let cashPriorReceipts = 0;
    let cashPriorPayments = 0;
    if (fromDate) {
      const cashPriorTxs = await this.prisma.financialTransaction.findMany({
        where: {
          ...cashWhere,
          transactionDate: { lt: fromDate },
        },
        select: { transactionType: true, amount: true },
      });
      for (const pt of cashPriorTxs) {
        if (pt.transactionType === 'CASH_RECEIPT') cashPriorReceipts += Number(pt.amount);
        else if (pt.transactionType === 'CASH_PAYMENT') cashPriorPayments += Number(pt.amount);
      }
    }
    const cashOpening = cashPriorReceipts - cashPriorPayments;

    const cashPeriodWhere: any = { ...cashWhere };
    if (fromDate || toDate) {
      cashPeriodWhere.transactionDate = {};
      if (fromDate) cashPeriodWhere.transactionDate.gte = fromDate;
      if (toDate) cashPeriodWhere.transactionDate.lte = toDate;
    }
    const cashPeriodTxs = await this.prisma.financialTransaction.findMany({
      where: cashPeriodWhere,
      select: { transactionType: true, amount: true },
    });

    let cashReceipts = 0;
    let cashPayments = 0;
    for (const pt of cashPeriodTxs) {
      if (pt.transactionType === 'CASH_RECEIPT') cashReceipts += Number(pt.amount);
      else if (pt.transactionType === 'CASH_PAYMENT') cashPayments += Number(pt.amount);
    }
    const cashClosing = cashOpening + cashReceipts - cashPayments;

    // 3. Transactions matching detailed filters
    const txWhere: any = {};
    if (filters.companyId && filters.companyId !== 'ALL') txWhere.companyId = filters.companyId;
    if (filters.transactionType && filters.transactionType !== 'ALL') txWhere.transactionType = filters.transactionType;
    if (filters.bankAccountId && filters.bankAccountId !== 'ALL') txWhere.bankAccountId = filters.bankAccountId;
    if (filters.status && filters.status !== 'ALL') txWhere.status = filters.status;
    if (fromDate || toDate) {
      txWhere.transactionDate = {};
      if (fromDate) txWhere.transactionDate.gte = fromDate;
      if (toDate) txWhere.transactionDate.lte = toDate;
    }

    const transactions = await this.prisma.financialTransaction.findMany({
      where: txWhere,
      include: {
        account: { select: { id: true, accountCode: true, accountName: true } },
        contraAccount: { select: { id: true, accountCode: true, accountName: true } },
        company: { select: { id: true, code: true, name: true } },
        bankAccount: true,
      },
      orderBy: { transactionDate: 'desc' },
      take: 500,
    });

    return {
      period: filters.period || 'CUSTOM',
      fromDate: fromDate?.toISOString() || null,
      toDate: toDate?.toISOString() || null,
      bankWiseSummary,
      bankAccounts: bankReportRows,
      totalBankOpening,
      totalBankReceipts,
      totalBankPayments,
      totalBankClosing,
      cashSummary: {
        opening: Math.round(cashOpening * 100) / 100,
        receipts: Math.round(cashReceipts * 100) / 100,
        payments: Math.round(cashPayments * 100) / 100,
        closing: Math.round(cashClosing * 100) / 100,
      },
      grandSummary: {
        totalOpening: Math.round((totalBankOpening + cashOpening) * 100) / 100,
        totalReceipts: Math.round((totalBankReceipts + cashReceipts) * 100) / 100,
        totalPayments: Math.round((totalBankPayments + cashPayments) * 100) / 100,
        totalClosing: Math.round((totalBankClosing + cashClosing) * 100) / 100,
      },
      transactions,
    };
  }
}

