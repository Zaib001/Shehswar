/**
 * SHEHSWAR ONE360 - Financial Accounting & General Ledger Service
 *
 * Implements authoritative double-entry accounting:
 * - Transaction-driven: Automatically posts balanced journals for Sales, Purchases, Payments, Expenses
 * - General Ledger, Balance Sheet, Profit & Loss directly derived from posted transactions
 * - Reconciles with Dealer Ledger, Vendor Ledger, and Stock Ledger
 */
import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { Prisma } from '@shehswar/database';
import { DocumentNumberingService } from '../../platform/document-numbering/document-numbering.service';
import { v7 as uuidv7 } from 'uuid';
import { AuthUser } from '@shehswar/types';

export interface JournalLineInput {
  accountId?: string;
  accountCode?: string;
  debit: number;
  credit: number;
  description?: string;
  dealerId?: string;
  vendorId?: string;
  salesOfficerId?: string;
  regionId?: string;
  zoneId?: string;
  territoryId?: string;
}

export interface PostJournalInput {
  organizationId: string;
  companyId: string;
  sourceType?: 'SALES_INVOICE' | 'PURCHASE_INVOICE' | 'DEALER_PAYMENT' | 'VENDOR_PAYMENT' | 'EXPENSE' | 'MANUAL_JOURNAL';
  sourceId?: string;
  entryType?: string;
  referenceType?: string;
  referenceId?: string;
  referenceNumber?: string;
  entryNumber?: string;
  description?: string;
  entryDate?: Date;
  lines: JournalLineInput[];
  createdById?: string;
}

export interface CreateExpenseDto {
  expenseDate: string | Date;
  expenseAccountCode?: string;
  expenseAccountId?: string;
  paymentAccountCode?: string;
  paymentAccountId?: string;
  paymentMethod?: 'CASH' | 'BANK' | 'PAYABLE';
  amount: number;
  taxAmount?: number;
  payee?: string;
  referenceNumber?: string;
  category?: string;
  description?: string;
  regionId?: string;
  zoneId?: string;
  territoryId?: string;
}

@Injectable()
export class FinanceService {
  private readonly logger = new Logger(FinanceService.name);

  // Standard Chart of Accounts Master Blueprint
  public static readonly DEFAULT_ACCOUNTS = [
    { code: '101000', name: 'Cash on Hand', type: 'ASSET', category: 'CURRENT_ASSET', isSystem: true },
    { code: '102000', name: 'Operating Bank Account', type: 'ASSET', category: 'CURRENT_ASSET', isSystem: true },
    { code: '103000', name: 'Accounts Receivable (Trade Debtors)', type: 'ASSET', category: 'CURRENT_ASSET', isSystem: true },
    { code: '104000', name: 'Finished Goods Inventory', type: 'ASSET', category: 'CURRENT_ASSET', isSystem: true },
    { code: '105000', name: 'Raw & Packing Materials Inventory', type: 'ASSET', category: 'CURRENT_ASSET', isSystem: true },
    { code: '201000', name: 'Accounts Payable (Trade Creditors)', type: 'LIABILITY', category: 'CURRENT_LIABILITY', isSystem: true },
    { code: '202000', name: 'Sales Tax Payable (STRN)', type: 'LIABILITY', category: 'CURRENT_LIABILITY', isSystem: true },
    { code: '301000', name: 'Share Capital / Owner Equity', type: 'EQUITY', category: 'EQUITY', isSystem: true },
    { code: '302000', name: 'Retained Earnings', type: 'EQUITY', category: 'EQUITY', isSystem: true },
    { code: '401000', name: 'Sales Revenue - Commercial Goods', type: 'REVENUE', category: 'OPERATING_REVENUE', isSystem: true },
    { code: '402000', name: 'Sales Discounts & Trade Rebates', type: 'REVENUE', category: 'OPERATING_REVENUE', isSystem: true },
    { code: '501000', name: 'Cost of Goods Sold (COGS)', type: 'EXPENSE', category: 'COGS', isSystem: true },
    { code: '601000', name: 'General & Administrative Expenses', type: 'EXPENSE', category: 'OPERATING_EXPENSE', isSystem: true },
    { code: '602000', name: 'Selling & Distribution Expenses', type: 'EXPENSE', category: 'OPERATING_EXPENSE', isSystem: true },
    { code: '603000', name: 'Marketing & Field Schemes Expenses', type: 'EXPENSE', category: 'OPERATING_EXPENSE', isSystem: true },
    { code: '604000', name: 'Freight & Transportation Charges', type: 'EXPENSE', category: 'OPERATING_EXPENSE', isSystem: true },
    { code: '605000', name: 'Utilities & Communication Expenses', type: 'EXPENSE', category: 'OPERATING_EXPENSE', isSystem: true },
    { code: '103500', name: 'Collection Clearing (Unallocated PR)', type: 'ASSET', category: 'CURRENT_ASSET', isSystem: true },
    { code: '203000', name: 'Salaries & Wages Payable', type: 'LIABILITY', category: 'CURRENT_LIABILITY', isSystem: true },
    { code: '606000', name: 'Vehicle & Fuel Expenses', type: 'EXPENSE', category: 'OPERATING_EXPENSE', isSystem: true },
    { code: '607000', name: 'Salaries & Staff Expenses', type: 'EXPENSE', category: 'OPERATING_EXPENSE', isSystem: true },
  ];

  constructor(
    private readonly prisma: PrismaService,
    private readonly documentNumbering: DocumentNumberingService,
  ) {}

  /**
   * Ensures Standard Chart of Accounts exist for the given company
   */
  async ensureDefaultAccounts(companyId: string, organizationId: string): Promise<void> {
    for (const def of FinanceService.DEFAULT_ACCOUNTS) {
      const existing = await this.prisma.account.findFirst({
        where: {
          organizationId,
          accountCode: def.code,
        },
      });

      if (!existing) {
        await this.prisma.account.create({
          data: {
            id: uuidv7(),
            organizationId,
            companyId,
            accountCode: def.code,
            accountName: def.name,
            accountType: def.type,
            category: def.category,
            isSystem: def.isSystem,
            isActive: true,
            currentBalance: 0,
          },
        });
      }
    }
  }

  /**
   * Resolves an account by code or ID
   */
  async resolveAccount(
    tx: Prisma.TransactionClient,
    organizationId: string,
    companyId: string,
    codeOrId: string,
  ): Promise<any> {
    const CODE_ALIASES: Record<string, string> = {
      '1000': '101000',
      '1010': '102000',
      '1100': '103000',
      '1200': '104000',
      '2000': '201000',
      '2100': '202000',
      '3000': '301000',
      '4000': '401000',
      '5000': '501000',
      '6000': '601000',
    };
    const targetCode = CODE_ALIASES[codeOrId] || codeOrId;

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(codeOrId);
    let account = await tx.account.findFirst({
      where: {
        organizationId,
        OR: isUuid
          ? [{ id: codeOrId }, { accountCode: codeOrId }, { accountCode: targetCode }]
          : [{ accountCode: codeOrId }, { accountCode: targetCode }],
      },
    });

    if (!account) {
      // Find matching default
      const defaultDef = FinanceService.DEFAULT_ACCOUNTS.find(
        (d) => d.code === targetCode || d.code === codeOrId,
      );
      if (defaultDef) {
        account = await tx.account.create({
          data: {
            id: uuidv7(),
            organizationId,
            companyId,
            accountCode: defaultDef.code,
            accountName: defaultDef.name,
            accountType: defaultDef.type,
            category: defaultDef.category,
            isSystem: defaultDef.isSystem,
            isActive: true,
            currentBalance: 0,
          },
        });
      } else {
        throw new NotFoundException(`Accounting account not found for '${codeOrId}'`);
      }
    }

    return account;
  }

  /**
   * Posts an atomic, balanced Journal Entry inside an existing transaction
   */
  async postJournalEntry(
    tx: Prisma.TransactionClient,
    input: PostJournalInput,
  ): Promise<any> {
    const entryDate = input.entryDate ? new Date(input.entryDate) : new Date();

    let totalDebit = 0;
    let totalCredit = 0;
    const resolvedLines: Array<{
      id: string;
      accountId: string;
      debit: number;
      credit: number;
      description?: string;
      dealerId?: string;
      vendorId?: string;
      salesOfficerId?: string;
      regionId?: string;
      zoneId?: string;
      territoryId?: string;
    }> = [];

    for (const line of input.lines) {
      const debit = Math.round(Number(line.debit || 0) * 100) / 100;
      const credit = Math.round(Number(line.credit || 0) * 100) / 100;

      if (debit === 0 && credit === 0) continue;

      totalDebit += debit;
      totalCredit += credit;

      const accountIdentifier = line.accountId || line.accountCode;
      if (!accountIdentifier) {
        throw new BadRequestException('Each journal line must specify accountId or accountCode');
      }

      const account = await this.resolveAccount(tx, input.organizationId, input.companyId, accountIdentifier);

      resolvedLines.push({
        id: uuidv7(),
        accountId: account.id,
        debit,
        credit,
        description: line.description || input.description,
        dealerId: line.dealerId,
        vendorId: line.vendorId,
        salesOfficerId: line.salesOfficerId,
        regionId: line.regionId,
        zoneId: line.zoneId,
        territoryId: line.territoryId,
      });

      // Update denormalized balance on account
      // For ASSETS and EXPENSES: Debit increases (+), Credit decreases (-)
      // For LIABILITIES, EQUITY, REVENUE: Credit increases (+), Debit decreases (-)
      const isNormalDebit = account.accountType === 'ASSET' || account.accountType === 'EXPENSE';
      const balanceDelta = isNormalDebit ? (debit - credit) : (credit - debit);

      await tx.account.update({
        where: { id: account.id },
        data: {
          currentBalance: {
            increment: balanceDelta,
          },
        },
      });
    }

    totalDebit = Math.round(totalDebit * 100) / 100;
    totalCredit = Math.round(totalCredit * 100) / 100;

    const diff = Math.abs(totalDebit - totalCredit);
    if (diff > 0.05) {
      throw new BadRequestException(
        `Journal entry is unbalanced! Total Debit (PKR ${totalDebit}) does not equal Total Credit (PKR ${totalCredit}). Difference: ${diff}`,
      );
    }

    const sourceType = (input.sourceType || input.entryType || 'MANUAL_JOURNAL') as any;
    const rawSourceId = input.sourceId || input.referenceId || null;
    const isSourceUuid = rawSourceId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawSourceId);
    const sourceId = isSourceUuid ? rawSourceId : null;

    const docPrefix =
      sourceType === 'SALES_INVOICE'
        ? 'SJ'
        : sourceType === 'PURCHASE_INVOICE'
        ? 'PJ'
        : sourceType === 'DEALER_PAYMENT'
        ? 'CR'
        : sourceType === 'VENDOR_PAYMENT'
        ? 'CD'
        : sourceType === 'EXPENSE'
        ? 'EX'
        : 'JV';

    let entryNumber = input.entryNumber;
    if (!entryNumber) {
      entryNumber = await this.documentNumbering.getNextDocumentNumber({
        organizationId: input.organizationId,
        companyId: input.companyId,
        documentType: docPrefix as any,
      });
    }

    const journalEntry = await tx.journalEntry.create({
      data: {
        id: uuidv7(),
        organizationId: input.organizationId,
        companyId: input.companyId,
        entryNumber,
        entryDate,
        sourceType,
        sourceId,
        referenceNumber: input.referenceNumber ?? (!isSourceUuid ? rawSourceId : null),
        description: input.description ?? `${sourceType} posting`,
        totalDebit,
        totalCredit,
        isBalanced: true,
        status: 'POSTED',
        createdById: input.createdById ?? null,
        lines: {
          create: resolvedLines,
        },
      },
      include: {
        lines: {
          include: {
            account: true,
          },
        },
      },
    });

    this.logger.log(
      `Financial Journal posted: ${entryNumber} (${input.sourceType}) | Dr: PKR ${totalDebit} = Cr: PKR ${totalCredit}`,
    );

    return journalEntry;
  }

  /**
   * Create and post an operational expense entry with automatic double-entry journal
   */
  async createExpense(dto: CreateExpenseDto, actor: AuthUser) {
    const organizationId = actor.organizationId;
    const companyId = actor.companyId;

    if (!dto.amount || Number(dto.amount) <= 0) {
      throw new BadRequestException('Expense amount must be greater than zero');
    }

    const amount = Number(dto.amount);
    const taxAmount = Number(dto.taxAmount || 0);
    const netExpense = amount - taxAmount;

    await this.ensureDefaultAccounts(companyId, organizationId);

    const expenseCode = dto.expenseAccountCode || '601000';
    const paymentCode = dto.paymentAccountCode || (dto.paymentMethod === 'CASH' ? '101000' : '102000');

    return this.prisma.$transaction(async (tx) => {
      const expenseAcc = await this.resolveAccount(tx, organizationId, companyId, dto.expenseAccountId || expenseCode);
      const paymentAcc = await this.resolveAccount(tx, organizationId, companyId, dto.paymentAccountId || paymentCode);

      const voucherNumber = await this.documentNumbering.getNextDocumentNumber({
        organizationId,
        companyId,
        documentType: 'EX' as any,
      });

      const expense = await tx.expenseEntry.create({
        data: {
          id: uuidv7(),
          organizationId,
          companyId,
          voucherNumber,
          expenseDate: dto.expenseDate ? new Date(dto.expenseDate) : new Date(),
          expenseAccountId: expenseAcc.id,
          paymentAccountId: paymentAcc.id,
          paymentMethod: dto.paymentMethod || 'BANK',
          amount,
          taxAmount,
          payee: dto.payee ?? null,
          referenceNumber: dto.referenceNumber ?? null,
          category: dto.category || expenseAcc.category,
          description: dto.description ?? `Expense: ${expenseAcc.accountName}`,
          regionId: dto.regionId ?? null,
          zoneId: dto.zoneId ?? null,
          territoryId: dto.territoryId ?? null,
          status: 'POSTED',
          createdById: actor.id,
        },
      });

      // Post General Ledger Journal:
      // Dr Expense Account (amount - tax)
      // Dr Tax Account (taxAmount if any)
      // Cr Cash / Bank Account (total amount)
      const lines: JournalLineInput[] = [
        {
          accountId: expenseAcc.id,
          debit: netExpense,
          credit: 0,
          description: dto.description || expenseAcc.accountName,
          regionId: dto.regionId,
          zoneId: dto.zoneId,
          territoryId: dto.territoryId,
        },
      ];

      if (taxAmount > 0) {
        lines.push({
          accountCode: '202000', // Tax
          debit: taxAmount,
          credit: 0,
          description: `Sales Tax on ${dto.payee || 'Expense'}`,
        });
      }

      lines.push({
        accountId: paymentAcc.id,
        debit: 0,
        credit: amount,
        description: `Payment via ${paymentAcc.accountName}`,
      });

      await this.postJournalEntry(tx, {
        organizationId,
        companyId,
        sourceType: 'EXPENSE',
        sourceId: expense.id,
        referenceNumber: voucherNumber,
        description: dto.description || `Expense payout to ${dto.payee || 'Vendor'}`,
        entryDate: dto.expenseDate ? new Date(dto.expenseDate) : new Date(),
        lines,
        createdById: actor.id,
      });

      return expense;
    });
  }

  /**
   * Authoritative Balance Sheet calculation directly from General Ledger
   * Assets = Liabilities + Equity
   */
  async getBalanceSheet(companyId: string, asOfDate?: string) {
    const dateLimit = asOfDate ? new Date(asOfDate) : new Date();
    dateLimit.setHours(23, 59, 59, 999);

    const where: any = {
      journalEntry: {
        status: 'POSTED',
        entryDate: { lte: dateLimit },
      },
    };

    if (companyId && companyId !== 'ALL') {
      where.journalEntry.companyId = companyId;
    }

    const lines = await this.prisma.journalEntryLine.findMany({
      where,
      include: {
        account: true,
      },
    });

    // Aggregate balances by base account code (strips company prefix like COMP-NECTAR-)
    const accountBalances = new Map<string, { account: any; net: number }>();

    for (const line of lines) {
      const rawCode = line.account.accountCode || '';
      const code = rawCode.includes('-') ? rawCode.split('-').pop()! : rawCode;
      const current = accountBalances.get(code) || { account: line.account, net: 0 };
      const debit = Number(line.debit || 0);
      const credit = Number(line.credit || 0);

      const isNormalDebit = line.account.accountType === 'ASSET' || line.account.accountType === 'EXPENSE';
      const delta = isNormalDebit ? (debit - credit) : (credit - debit);

      current.net += delta;
      accountBalances.set(code, current);
    }

    // Current Assets
    const cashAndBank = (accountBalances.get('101000')?.net || 0) + (accountBalances.get('102000')?.net || 0);
    const accountsReceivable = accountBalances.get('103000')?.net || 0;
    const inventory = (accountBalances.get('104000')?.net || 0) + (accountBalances.get('105000')?.net || 0);
    const otherAssets = 0;
    const totalCurrentAssets = cashAndBank + accountsReceivable + inventory + otherAssets;

    const fixedAssets = 0;
    const totalNonCurrentAssets = fixedAssets;
    const totalAssets = totalCurrentAssets + totalNonCurrentAssets;

    // Current Liabilities
    const accountsPayable = accountBalances.get('201000')?.net || 0;
    const taxesPayable = accountBalances.get('202000')?.net || 0;
    const otherLiabilities = 0;
    const totalLiabilities = accountsPayable + taxesPayable + otherLiabilities;

    // Equity & Net Income Rollup
    // Net Income = Sum(Revenues) - Sum(COGS + Expenses)
    let totalRevenue = 0;
    let totalExpense = 0;

    for (const [code, item] of accountBalances.entries()) {
      if (item.account.accountType === 'REVENUE') {
        if (code === '402000') {
          totalRevenue -= item.net; // Contra revenue
        } else {
          totalRevenue += item.net;
        }
      } else if (item.account.accountType === 'EXPENSE') {
        totalExpense += item.net;
      }
    }

    const currentPeriodProfit = totalRevenue - totalExpense;
    const shareCapital = accountBalances.get('301000')?.net || 0;
    const retainedEarnings = (accountBalances.get('302000')?.net || 0) + currentPeriodProfit;
    const totalEquity = shareCapital + retainedEarnings;

    const totalLiabilitiesAndEquity = totalLiabilities + totalEquity;
    const variance = Math.round(Math.abs(totalAssets - totalLiabilitiesAndEquity) * 100) / 100;
    const isBalanced = variance < 1.0;

    return {
      asOfDate: dateLimit.toISOString(),
      companyId,
      currentAssets: {
        cashAndBank: Math.round(cashAndBank * 100) / 100,
        accountsReceivable: Math.round(accountsReceivable * 100) / 100,
        inventory: Math.round(inventory * 100) / 100,
        otherAssets: Math.round(otherAssets * 100) / 100,
        total: Math.round(totalCurrentAssets * 100) / 100,
      },
      nonCurrentAssets: {
        fixedAssets: Math.round(fixedAssets * 100) / 100,
        total: Math.round(totalNonCurrentAssets * 100) / 100,
      },
      totalAssets: Math.round(totalAssets * 100) / 100,
      currentLiabilities: {
        accountsPayable: Math.round(accountsPayable * 100) / 100,
        taxesPayable: Math.round(taxesPayable * 100) / 100,
        otherLiabilities: Math.round(otherLiabilities * 100) / 100,
        total: Math.round(totalLiabilities * 100) / 100,
      },
      totalLiabilities: Math.round(totalLiabilities * 100) / 100,
      equity: {
        shareCapital: Math.round(shareCapital * 100) / 100,
        retainedEarnings: Math.round(retainedEarnings * 100) / 100,
        currentPeriodProfit: Math.round(currentPeriodProfit * 100) / 100,
        total: Math.round(totalEquity * 100) / 100,
      },
      totalLiabilitiesAndEquity: Math.round(totalLiabilitiesAndEquity * 100) / 100,
      isBalanced,
      variance,
    };
  }

  /**
   * Authoritative Profit & Loss statement directly from General Ledger
   */
  async getProfitLoss(companyId: string, startDate?: string, endDate?: string) {
    const start = startDate ? new Date(startDate) : new Date(new Date().getFullYear(), 0, 1);
    const end = endDate ? new Date(endDate) : new Date();
    end.setHours(23, 59, 59, 999);

    const where: any = {
      journalEntry: {
        status: 'POSTED',
        entryDate: {
          gte: start,
          lte: end,
        },
      },
    };

    if (companyId && companyId !== 'ALL') {
      where.journalEntry.companyId = companyId;
    }

    const lines = await this.prisma.journalEntryLine.findMany({
      where,
      include: {
        account: true,
      },
    });

    let grossSales = 0;
    let salesDiscounts = 0;
    let cogs = 0;
    let sellingAndDistribution = 0;
    let marketingAndSchemes = 0;
    let administrative = 0;
    let otherExpenses = 0;

    for (const line of lines) {
      const rawCode = line.account.accountCode || '';
      const code = rawCode.includes('-') ? rawCode.split('-').pop()! : rawCode;
      const debit = Number(line.debit || 0);
      const credit = Number(line.credit || 0);

      if (code === '401000' || (line.account.accountType === 'REVENUE' && code !== '402000')) {
        grossSales += (credit - debit);
      } else if (code === '402000') {
        salesDiscounts += (debit - credit);
      } else if (code === '501000' || line.account.category === 'COGS') {
        cogs += (debit - credit);
      } else if (code === '602000' || code === '604000') {
        sellingAndDistribution += (debit - credit);
      } else if (code === '603000') {
        marketingAndSchemes += (debit - credit);
      } else if (code === '601000') {
        administrative += (debit - credit);
      } else if (line.account.accountType === 'EXPENSE') {
        otherExpenses += (debit - credit);
      }
    }

    const netSales = grossSales - salesDiscounts;
    const grossProfit = netSales - cogs;
    const totalOperatingExpenses = sellingAndDistribution + marketingAndSchemes + administrative + otherExpenses;
    const operatingProfit = grossProfit - totalOperatingExpenses;
    const netProfit = operatingProfit;

    const grossMarginPercent = netSales > 0 ? (grossProfit / netSales) * 100 : 0;
    const netMarginPercent = netSales > 0 ? (netProfit / netSales) * 100 : 0;

    return {
      period: `${start.toLocaleDateString()} to ${end.toLocaleDateString()}`,
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      companyId,
      revenue: {
        grossSales: Math.round(grossSales * 100) / 100,
        discounts: Math.round(salesDiscounts * 100) / 100,
        netSales: Math.round(netSales * 100) / 100,
      },
      costOfGoodsSold: {
        cogs: Math.round(cogs * 100) / 100,
      },
      grossProfit: Math.round(grossProfit * 100) / 100,
      grossMarginPercent: Math.round(grossMarginPercent * 100) / 100,
      operatingExpenses: {
        sellingAndDistribution: Math.round(sellingAndDistribution * 100) / 100,
        marketingAndSchemes: Math.round(marketingAndSchemes * 100) / 100,
        administrative: Math.round(administrative * 100) / 100,
        otherExpenses: Math.round(otherExpenses * 100) / 100,
        total: Math.round(totalOperatingExpenses * 100) / 100,
      },
      operatingProfit: Math.round(operatingProfit * 100) / 100,
      netProfit: Math.round(netProfit * 100) / 100,
      netMarginPercent: Math.round(netMarginPercent * 100) / 100,
    };
  }

  /**
   * Returns General Ledger entries with full drill-down
   */
  async getGeneralLedger(companyId: string, options?: { accountCode?: string; startDate?: string; endDate?: string; limit?: number }) {
    const where: any = {};
    if (companyId && companyId !== 'ALL') {
      where.companyId = companyId;
    }
    if (options?.startDate || options?.endDate) {
      where.entryDate = {};
      if (options.startDate) where.entryDate.gte = new Date(options.startDate);
      if (options.endDate) {
        const e = new Date(options.endDate);
        e.setHours(23, 59, 59, 999);
        where.entryDate.lte = e;
      }
    }

    const entries = await this.prisma.journalEntry.findMany({
      where,
      include: {
        company: { select: { id: true, name: true, code: true } },
        lines: {
          include: {
            account: true,
          },
        },
      },
      orderBy: { entryDate: 'desc' },
      take: options?.limit ?? 100,
    });

    return entries;
  }

  /**
   * Returns list of Chart of Accounts with balances
   */
  async getAccounts(companyId: string, organizationId: string) {
    await this.ensureDefaultAccounts(companyId, organizationId);

    const where: any = { organizationId };
    if (companyId && companyId !== 'ALL') {
      where.OR = [{ companyId }, { companyId: null }];
    }

    return this.prisma.account.findMany({
      where,
      orderBy: { accountCode: 'asc' },
    });
  }

  /**
   * Returns Expense entries list
   */
  async getExpenses(companyId: string, options?: { category?: string; startDate?: string; endDate?: string; limit?: number }) {
    const where: any = {};
    if (companyId && companyId !== 'ALL') {
      where.companyId = companyId;
    }
    if (options?.category) {
      where.category = options.category;
    }
    if (options?.startDate || options?.endDate) {
      where.expenseDate = {};
      if (options.startDate) where.expenseDate.gte = new Date(options.startDate);
      if (options.endDate) {
        const e = new Date(options.endDate);
        e.setHours(23, 59, 59, 999);
        where.expenseDate.lte = e;
      }
    }

    return this.prisma.expenseEntry.findMany({
      where,
      include: {
        expenseAccount: true,
        paymentAccount: true,
        company: { select: { id: true, name: true, code: true } },
      },
      orderBy: { expenseDate: 'desc' },
      take: options?.limit ?? 100,
    });
  }
}
