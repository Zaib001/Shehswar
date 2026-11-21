/**
 * SHEHSWAR ONE360 - Provisional Receipts (PR) Core Engine
 *
 * Implements the authoritative Provisional Receipt workflow:
 * - Unallocated Collection Clearing (Cash/Bank Receipt -> 103500 Collection Clearing)
 * - Dynamic Product Lines with Backend Decimal Arithmetic (Qty × Policy Rate)
 * - Multi-Dealer Allocation with strict validation (Allocated <= Received)
 * - Atomic Dealer Ledger Credit (`PR_ALLOCATION`) & Automatic Multi-tier Credit Release
 * - Full PR Reversal with Auditable Ledger Rollback (`PR_REVERSAL`)
 * - Duplicate PR Number Protection (Database Unique Constraint + Backend Validation)
 */
import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { FinanceService } from '../finance/finance.service';
import { DealerLedgerService } from '../ledger/dealer-ledger.service';
import { v7 as uuidv7 } from 'uuid';

export interface CreatePrProductDto {
  srNo?: number;
  finishedProductId?: string;
  productName: string;
  packSize: string;
  quantity: number;
  policyRate: number;
}

export interface CreatePrAllocationDto {
  type?: 'DEALER' | 'EXPENSE';
  dealerId?: string;
  partyCode?: string;
  dealerName?: string;
  regionId?: string;
  territoryId?: string;
  expenseProductId?: string;
  expenseName?: string;
  expenseHeadId?: string;
  expenseItemId?: string;
  allocatedAmount: number;
  reference?: string;
  remarks?: string;
}

export interface CreateProvisionalReceiptDto {
  companyId: string;
  prNumber: string;
  receiptDate: string | Date;
  issueDate?: string | Date;
  name?: string;
  receivedFrom: string;
  partyDealerId?: string;
  partyCode?: string;
  address?: string;
  salesOfficerId?: string;
  salesOfficerName?: string;
  regionId?: string;
  territoryId?: string;
  zoneId?: string;
  paymentMethod: 'CASH' | 'CHEQUE' | 'DD' | 'ONLINE' | 'OTHER';
  paymentReferenceNumber?: string;
  bankName?: string;
  branchName?: string;
  bankAccountId?: string;
  totalAmount?: number;
  totalAmountInWords?: string;
  remarks?: string;
  attachmentUrl?: string;
  products?: CreatePrProductDto[];
  allocations?: CreatePrAllocationDto[];
  autoPost?: boolean;
}

@Injectable()
export class ProvisionalReceiptsService {
  private readonly logger = new Logger(ProvisionalReceiptsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly financeService: FinanceService,
    private readonly dealerLedgerService: DealerLedgerService,
  ) {}

  /**
   * Helper to convert numbers to words (Pakistani Rupees convention)
   */
  private numberToWords(num: number): string {
    const a = [
      '', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ',
      'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '
    ];
    const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

    const inWords = (n: number): string => {
      if (n === 0) return '';
      if (n < 20) return a[n] || '';
      if (n < 100) return (b[Math.floor(n / 10)] || '') + (n % 10 !== 0 ? ' ' + (a[n % 10] || '') : ' ');
      if (n < 1000) return (a[Math.floor(n / 100)] || '') + 'Hundred ' + (n % 100 !== 0 ? 'and ' + inWords(n % 100) : '');
      if (n < 100000) return inWords(Math.floor(n / 1000)) + 'Thousand ' + (n % 1000 !== 0 ? ' ' + inWords(n % 1000) : '');
      if (n < 10000000) return inWords(Math.floor(n / 100000)) + 'Lakh ' + (n % 100000 !== 0 ? ' ' + inWords(n % 100000) : '');
      return inWords(Math.floor(n / 10000000)) + 'Crore ' + (n % 10000000 !== 0 ? ' ' + inWords(n % 10000000) : '');
    };

    const rounded = Math.floor(num);
    const words = inWords(rounded).trim();
    return words ? `${words} Rupees Only` : 'Zero Rupees';
  }

  /**
   * Create a Provisional Receipt (PR)
   * Calculates product row amounts (Qty × Policy Rate)
   * Validates duplicate PR Number in company scope
   */
  async createProvisionalReceipt(
    organizationId: string,
    dto: CreateProvisionalReceiptDto,
    userId?: string,
  ) {
    const prNumberClean = dto.prNumber.trim().toUpperCase();

    // 1. Strict Duplicate Check on PR Number
    const existing = await this.prisma.provisionalReceipt.findUnique({
      where: {
        companyId_prNumber: {
          companyId: dto.companyId,
          prNumber: prNumberClean,
        },
      },
    });

    if (existing) {
      throw new ConflictException(
        `PR Number "${prNumberClean}" already exists. Please enter a different PR number.`,
      );
    }

    // 2. Fetch master data context if partyDealerId is provided
    let derivedPartyCode = dto.partyCode;
    let derivedRegionId = dto.regionId;
    let derivedTerritoryId = dto.territoryId;

    if (dto.partyDealerId) {
      const dealer = await this.prisma.dealer.findUnique({
        where: { id: dto.partyDealerId },
        include: { territory: { include: { zone: true } } },
      });
      if (dealer) {
        derivedPartyCode = derivedPartyCode || dealer.code;
        derivedTerritoryId = derivedTerritoryId || dealer.territoryId || undefined;
        derivedRegionId = derivedRegionId || dealer.territory?.zone?.regionId || undefined;
      }
    }

    // 3. Process Product Lines (Backend Arithmetic Qty × Rate)
    let calculatedProductTotal = 0;
    const processedProducts: Array<{
      id: string;
      srNo: number;
      finishedProductId?: string | null;
      productName: string;
      packSize: string;
      quantity: number;
      policyRate: number;
      amount: number;
    }> = [];

    if (dto.products && dto.products.length > 0) {
      dto.products.forEach((p, idx) => {
        const qty = Number(p.quantity || 0);
        const rate = Number(p.policyRate || 0);
        const amount = Math.round(qty * rate * 100) / 100;
        calculatedProductTotal += amount;

        processedProducts.push({
          id: uuidv7(),
          srNo: p.srNo || idx + 1,
          finishedProductId: p.finishedProductId || null,
          productName: p.productName.trim(),
          packSize: p.packSize.trim(),
          quantity: qty,
          policyRate: rate,
          amount,
        });
      });
    }

    // Determine final total amount
    const totalAmount =
      Number(dto.totalAmount || 0) > 0
        ? Math.round(Number(dto.totalAmount) * 100) / 100
        : calculatedProductTotal > 0
        ? calculatedProductTotal
        : 0;

    if (totalAmount <= 0) {
      throw new BadRequestException('Provisional Receipt Total Amount must be greater than zero');
    }

    const totalAmountInWords = dto.totalAmountInWords || this.numberToWords(totalAmount);
    const receiptDate = new Date(dto.receiptDate);
    const issueDate = dto.issueDate ? new Date(dto.issueDate) : receiptDate;

    // 4. Validate initial allocations (Dealers and Expenses)
    let totalAllocated = 0;
    const dealerAllocations: Array<{
      id: string;
      dealerId: string;
      partyCode?: string | null;
      dealerName?: string | null;
      regionId?: string | null;
      territoryId?: string | null;
      allocatedAmount: number;
      reference?: string | null;
      remarks?: string | null;
      status: string;
    }> = [];

    const expenseAllocations: Array<{
      id: string;
      expenseProductId?: string | null;
      expenseName: string;
      expenseHeadId?: string | null;
      expenseItemId?: string | null;
      allocatedAmount: number;
      reference?: string | null;
      remarks?: string | null;
    }> = [];

    if (dto.allocations && dto.allocations.length > 0) {
      for (const a of dto.allocations) {
        const amt = Math.round(Number(a.allocatedAmount) * 100) / 100;
        if (amt <= 0) continue;
        totalAllocated += amt;

        if (a.type === 'EXPENSE' || (!a.dealerId && (a.expenseName || a.expenseProductId))) {
          expenseAllocations.push({
            id: uuidv7(),
            expenseProductId: a.expenseProductId || null,
            expenseName: a.expenseName || a.remarks || 'Bilty Expense',
            expenseHeadId: a.expenseHeadId || null,
            expenseItemId: a.expenseItemId || null,
            allocatedAmount: amt,
            reference: a.reference || null,
            remarks: a.remarks || null,
          });
        } else if (a.dealerId) {
          dealerAllocations.push({
            id: uuidv7(),
            dealerId: a.dealerId,
            partyCode: a.partyCode || null,
            dealerName: a.dealerName || null,
            regionId: a.regionId || null,
            territoryId: a.territoryId || null,
            allocatedAmount: amt,
            reference: a.reference || null,
            remarks: a.remarks || null,
            status: 'POSTED',
          });
        }
      }
    }

    if (totalAllocated > totalAmount) {
      throw new BadRequestException(
        `Total allocated amount (PKR ${totalAllocated}) cannot exceed received amount (PKR ${totalAmount})`,
      );
    }

    const unallocatedAmount = Math.round((totalAmount - totalAllocated) * 100) / 100;
    const allocationStatus =
      totalAllocated === 0
        ? 'UNALLOCATED'
        : unallocatedAmount === 0
        ? 'FULLY_ALLOCATED'
        : 'PARTIALLY_ALLOCATED';

    const initialStatus = dto.autoPost ? 'POSTED' : 'PENDING_ALLOCATION';

    return this.prisma.$transaction(async (tx) => {
      // Create PR header and products
      const pr = await tx.provisionalReceipt.create({
        data: {
          id: uuidv7(),
          organizationId,
          companyId: dto.companyId,
          prNumber: prNumberClean,
          receiptDate,
          issueDate,
          name: dto.name || null,
          receivedFrom: dto.receivedFrom.trim(),
          partyDealerId: dto.partyDealerId || null,
          partyCode: derivedPartyCode || null,
          address: dto.address || null,
          salesOfficerId: dto.salesOfficerId || null,
          regionId: derivedRegionId || null,
          territoryId: derivedTerritoryId || null,
          paymentMethod: dto.paymentMethod,
          paymentReferenceNumber: dto.paymentReferenceNumber || null,
          bankName: dto.bankName || null,
          branchName: dto.branchName || null,
          bankAccountId: dto.bankAccountId || null,
          totalAmount,
          totalAmountInWords,
          allocatedAmount: totalAllocated,
          unallocatedAmount,
          allocationStatus,
          status: initialStatus,
          remarks: dto.remarks || null,
          attachmentUrl: dto.attachmentUrl || null,
          createdById: userId || null,
          postedById: dto.autoPost ? userId || null : null,
          postedAt: dto.autoPost ? new Date() : null,
          products: {
            create: processedProducts,
          },
        },
        include: {
          products: true,
          company: true,
        },
      });

      // Post initial Collection Clearing GL journal entry if autoPost is true
      if (dto.autoPost) {
        await this.postInitialReceiptAccounting(tx, organizationId, pr, userId);
      }

      // If initial dealer allocations were provided and autoPost is true, post them to Dealer Ledger
      if (dto.autoPost && dealerAllocations.length > 0) {
        for (const alloc of dealerAllocations) {
          await this.executeDealerAllocation(
            tx,
            organizationId,
            pr,
            alloc,
            userId,
          );
        }
      }

      // If initial expense allocations were provided and autoPost is true, post them to Expense Ledger
      if (dto.autoPost && expenseAllocations.length > 0) {
        for (const alloc of expenseAllocations) {
          await this.executeExpenseAllocation(
            tx,
            organizationId,
            pr,
            alloc,
            userId,
          );
        }
      }

      return this.getProvisionalReceiptById(pr.id, tx);
    });
  }

  /**
   * Post initial PR Receipt accounting:
   * Debit: Cash (101000) or Bank (102000)
   * Credit: Collection Clearing (103500)
   */
  private async postInitialReceiptAccounting(
    tx: any,
    organizationId: string,
    pr: any,
    userId?: string,
  ) {
    const isBank = ['BANK', 'CHEQUE', 'DD', 'ONLINE'].includes(pr.paymentMethod);
    const cashOrBankCode = isBank ? '102000' : '101000';
    const clearingAccountCode = '103500';

    const journal = await this.financeService.postJournalEntry(tx, {
      organizationId,
      companyId: pr.companyId,
      sourceType: 'DEALER_PAYMENT',
      sourceId: pr.id,
      referenceType: 'PROVISIONAL_RECEIPT',
      referenceNumber: pr.prNumber,
      description: `PR [${pr.prNumber}]: Receipt from ${pr.receivedFrom} via ${pr.paymentMethod}`,
      entryDate: pr.receiptDate,
      createdById: userId,
      lines: [
        {
          accountCode: cashOrBankCode,
          debit: Number(pr.totalAmount),
          credit: 0,
          description: `Cash/Bank received for PR ${pr.prNumber}`,
        },
        {
          accountCode: clearingAccountCode,
          debit: 0,
          credit: Number(pr.totalAmount),
          description: `Collection clearing for PR ${pr.prNumber}`,
        },
      ],
    });

    await tx.provisionalReceipt.update({
      where: { id: pr.id },
      data: {
        journalEntryId: journal.id,
        status: pr.allocationStatus === 'FULLY_ALLOCATED' ? 'POSTED' : 'PENDING_ALLOCATION',
        postedAt: new Date(),
        postedById: userId || null,
      },
    });

    // Authoritatively update bank account balance if payment method is BANK and bankAccountId is present
    if (isBank && pr.bankAccountId) {
      const bankAcc = await tx.bankAccount.findUnique({
        where: { id: pr.bankAccountId },
      });
      if (bankAcc) {
        await tx.bankAccount.update({
          where: { id: bankAcc.id },
          data: {
            currentBalance: {
              increment: Number(pr.totalAmount),
            },
          },
        });
      }
    }

    // Atomic Cash & Bank Transaction Integration
    const mainAcc = await tx.account.findFirst({
      where: { companyId: pr.companyId, accountCode: cashOrBankCode },
    });
    const clearingAcc = await tx.account.findFirst({
      where: { companyId: pr.companyId, accountCode: clearingAccountCode },
    });

    if (mainAcc && clearingAcc) {
      await tx.financialTransaction.create({
        data: {
          id: uuidv7(),
          organizationId,
          companyId: pr.companyId,
          voucherNumber: `PR-TX-${pr.prNumber}`,
          transactionType: isBank ? 'BANK_RECEIPT' : 'CASH_RECEIPT',
          transactionDate: pr.receiptDate,
          partyType: 'DEALER',
          partyId: pr.partyDealerId || null,
          partyName: pr.receivedFrom,
          amount: Number(pr.totalAmount),
          paymentMethod: pr.paymentMethod,
          accountId: mainAcc.id,
          contraAccountId: clearingAcc.id,
          bankAccountId: isBank ? pr.bankAccountId || null : null,
          bankName: pr.bankName || null,
          branchName: pr.branchName || null,
          referenceNumber: pr.prNumber,
          remarks: `Provisional Receipt [${pr.prNumber}] - ${pr.remarks || ''}`.trim(),
          status: 'POSTED',
          journalEntryId: journal.id,
          createdById: userId || null,
        },
      });
    }

    return journal;
  }

  /**
   * Helper to execute dealer allocation:
   * 1. Creates `ProvisionalReceiptAllocation`
   * 2. Writes `DealerLedgerEntry` (`PR_ALLOCATION`, credit: amount) -> reduces `dealer.currentBalance`
   * 3. Posts GL entry: Debit Collection Clearing (103500), Credit Accounts Receivable (103000)
   */
  private async executeDealerAllocation(
    tx: any,
    organizationId: string,
    pr: any,
    alloc: {
      dealerId: string;
      partyCode?: string | null;
      dealerName?: string | null;
      regionId?: string | null;
      territoryId?: string | null;
      allocatedAmount: number;
      reference?: string | null;
      remarks?: string | null;
    },
    userId?: string,
  ) {
    const dealer = await tx.dealer.findUnique({
      where: { id: alloc.dealerId },
      include: { territory: { include: { zone: true } } },
    });
    if (!dealer) throw new NotFoundException(`Dealer with ID ${alloc.dealerId} not found`);

    const allocationId = uuidv7();

    // 1. Post to Dealer Ledger (Credit reduces dealer outstanding balance!)
    const ledgerResult = await this.dealerLedgerService.postEntry(tx, {
      organizationId,
      companyId: pr.companyId,
      dealerId: alloc.dealerId,
      entryType: 'PR_ALLOCATION',
      referenceId: pr.id,
      voucherNumber: pr.prNumber,
      description: `PR Allocation [${pr.prNumber}] - ${alloc.remarks || pr.receivedFrom}`,
      debit: 0,
      credit: alloc.allocatedAmount,
      entryDate: pr.receiptDate,
      provisionalReceiptAllocationId: allocationId,
    });

    // 2. Post GL Entry: Debit 103500 (Collection Clearing -), Credit 103000 (Accounts Receivable -)
    const journal = await this.financeService.postJournalEntry(tx, {
      organizationId,
      companyId: pr.companyId,
      sourceType: 'DEALER_PAYMENT',
      sourceId: allocationId,
      referenceType: 'PR_DEALER_ALLOCATION',
      referenceNumber: `${pr.prNumber}-${dealer.code}`,
      description: `PR Allocation [${pr.prNumber}] to Dealer ${dealer.name} (${dealer.code})`,
      entryDate: pr.receiptDate,
      createdById: userId,
      lines: [
        {
          accountCode: '103500',
          debit: alloc.allocatedAmount,
          credit: 0,
          description: `Clearing allocated for PR ${pr.prNumber}`,
        },
        {
          accountCode: '103000',
          debit: 0,
          credit: alloc.allocatedAmount,
          dealerId: dealer.id,
          regionId: alloc.regionId || dealer.territory?.zone?.regionId || null,
          zoneId: dealer.territory?.zoneId || null,
          territoryId: alloc.territoryId || dealer.territoryId || null,
          description: `Receivable reduction for dealer ${dealer.name}`,
        },
      ],
    });

    // 3. Create allocation record
    const allocation = await tx.provisionalReceiptAllocation.create({
      data: {
        id: allocationId,
        provisionalReceiptId: pr.id,
        dealerId: alloc.dealerId,
        partyCode: alloc.partyCode || dealer.code,
        dealerName: alloc.dealerName || dealer.name,
        regionId: alloc.regionId || dealer.territory?.zone?.regionId || null,
        territoryId: alloc.territoryId || dealer.territoryId || null,
        allocatedAmount: alloc.allocatedAmount,
        reference: alloc.reference || null,
        remarks: alloc.remarks || null,
        status: 'POSTED',
        dealerLedgerEntryId: allocationId,
        journalEntryId: journal.id,
      },
    });

    this.logger.log(
      `PR ${pr.prNumber} allocated PKR ${alloc.allocatedAmount} to ${dealer.code} (${dealer.name}). New dealer balance: PKR ${ledgerResult.runningBalance}`,
    );

    return allocation;
  }

  /**
   * Helper to execute expense allocation:
   * 1. Creates `ProvisionalReceiptProduct` line for audit & document print
   * 2. Creates `FinancialTransaction` record in Expense Ledger (debit contra expense)
   * 3. Posts GL entry: Debit Operating Expense, Credit Collection Clearing (103500)
   */
  private async executeExpenseAllocation(
    tx: any,
    organizationId: string,
    pr: any,
    alloc: {
      id: string;
      expenseProductId?: string | null;
      expenseName: string;
      expenseHeadId?: string | null;
      expenseItemId?: string | null;
      allocatedAmount: number;
      reference?: string | null;
      remarks?: string | null;
    },
    userId?: string,
  ) {
    const amount = alloc.allocatedAmount;
    const expenseName = alloc.expenseName || 'Operational Expense';

    // 1. Create product/expense line on PR
    await tx.provisionalReceiptProduct.create({
      data: {
        id: alloc.id,
        provisionalReceiptId: pr.id,
        srNo: 99,
        finishedProductId: alloc.expenseProductId && !alloc.expenseProductId.startsWith('STD-') ? alloc.expenseProductId : null,
        productName: expenseName,
        packSize: 'EXPENSE',
        quantity: 1,
        policyRate: amount,
        amount,
      },
    });

    // 2. Resolve Contra Expense GL Account (e.g. 609000 Operating / Misc Expense)
    let expenseAccount = await tx.account.findFirst({
      where: {
        companyId: pr.companyId,
        OR: [
          { accountCode: '609000' },
          { accountCode: '6090' },
          { accountType: 'EXPENSE' },
        ],
      },
    });

    if (!expenseAccount) {
      expenseAccount = await tx.account.findFirst({
        where: { companyId: pr.companyId },
      });
    }

    const clearingAccount = await tx.account.findFirst({
      where: { companyId: pr.companyId, accountCode: '103500' },
    });

    // 3. Post GL Entry: Debit Operating Expense, Credit 103500 Collection Clearing
    const journal = await this.financeService.postJournalEntry(tx, {
      organizationId,
      companyId: pr.companyId,
      sourceType: 'EXPENSE',
      sourceId: alloc.id,
      referenceType: 'PR_EXPENSE_ALLOCATION',
      referenceNumber: `${pr.prNumber}-EXP`,
      description: `PR Expense Allocation [${pr.prNumber}] - ${expenseName}: ${alloc.remarks || 'Field Expense'}`,
      entryDate: pr.receiptDate,
      createdById: userId,
      lines: [
        {
          accountCode: expenseAccount?.accountCode || '609000',
          debit: amount,
          credit: 0,
          description: `PR Expense: ${expenseName}`,
        },
        {
          accountCode: '103500',
          debit: 0,
          credit: amount,
          description: `Clearing deduction for expense on PR ${pr.prNumber}`,
        },
      ],
    });

    // 4. Create FinancialTransaction entry for instant visibility in Expense Ledger & Reports
    if (expenseAccount && clearingAccount) {
      await tx.financialTransaction.create({
        data: {
          id: uuidv7(),
          organizationId,
          companyId: pr.companyId,
          voucherNumber: `${pr.prNumber}-EXP`,
          transactionType: 'CASH_PAYMENT',
          transactionDate: pr.receiptDate,
          partyType: 'EMPLOYEE',
          partyId: pr.salesOfficerId || null,
          partyName: pr.receivedFrom,
          mainDivision: 'SALES_EXPENSE',
          expenseHeadId: alloc.expenseHeadId || null,
          expenseItemId: alloc.expenseItemId || null,
          headName: expenseName,
          expenseItemName: alloc.remarks || expenseName,
          amount,
          paymentMethod: 'CASH',
          accountId: clearingAccount.id,
          contraAccountId: expenseAccount.id,
          referenceNumber: pr.prNumber,
          remarks: `PR Expense Allocation [${pr.prNumber}] - ${alloc.remarks || expenseName}`,
          status: 'POSTED',
          journalEntryId: journal.id,
          createdById: userId || null,
        },
      });
    }

    this.logger.log(
      `PR ${pr.prNumber} allocated expense PKR ${amount} to "${expenseName}". Recorded in Expense Ledger and GL.`,
    );
  }

  /**
   * Allocate collection across dealers
   * Never allows Total Allocated > Received Amount
   * Automatically recalculates unallocated amount and allocation status
   */
  async allocateProvisionalReceipt(
    prId: string,
    allocations: CreatePrAllocationDto[],
    userId?: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const pr = await tx.provisionalReceipt.findUnique({
        where: { id: prId },
        include: { allocations: true },
      });

      if (!pr) throw new NotFoundException('Provisional Receipt not found');

      if (['REVERSED', 'CANCELLED'].includes(pr.status)) {
        throw new BadRequestException(`Cannot allocate PR with status "${pr.status}"`);
      }

      // Check current posted allocations
      const currentlyAllocated = pr.allocations
        .filter((a) => a.status === 'POSTED')
        .reduce((sum, a) => sum + Number(a.allocatedAmount), 0);

      // Sum new requested allocations
      let newAllocationsTotal = 0;
      for (const a of allocations) {
        const amt = Math.round(Number(a.allocatedAmount) * 100) / 100;
        if (amt <= 0) throw new BadRequestException('Each allocation amount must be > 0');
        newAllocationsTotal += amt;
      }

      const totalReceived = Number(pr.totalAmount);
      const projectedTotalAllocated = currentlyAllocated + newAllocationsTotal;

      if (projectedTotalAllocated > totalReceived) {
        throw new BadRequestException(
          `Total allocated (PKR ${projectedTotalAllocated}) exceeds received amount (PKR ${totalReceived}). Remaining available: PKR ${totalReceived - currentlyAllocated}`,
        );
      }

      // If PR hasn't had initial GL posting yet, post it now
      if (!pr.journalEntryId) {
        await this.postInitialReceiptAccounting(tx, pr.organizationId, pr, userId);
      }

      // Execute each new dealer allocation
      for (const alloc of allocations) {
        if (!alloc.dealerId) continue;
        await this.executeDealerAllocation(
          tx,
          pr.organizationId,
          pr,
          {
            ...alloc,
            dealerId: alloc.dealerId,
          },
          userId,
        );
      }

      // Update PR status and unallocated amounts
      const remainingUnallocated = Math.round((totalReceived - projectedTotalAllocated) * 100) / 100;
      const allocationStatus =
        remainingUnallocated === 0 ? 'FULLY_ALLOCATED' : 'PARTIALLY_ALLOCATED';

      await tx.provisionalReceipt.update({
        where: { id: prId },
        data: {
          allocatedAmount: projectedTotalAllocated,
          unallocatedAmount: remainingUnallocated,
          allocationStatus,
          status: 'POSTED',
          postedAt: pr.postedAt || new Date(),
          postedById: pr.postedById || userId || null,
        },
      });

      return this.getProvisionalReceiptById(prId, tx);
    });
  }

  /**
   * Reverse a Posted Provisional Receipt:
   * 1. Reverses dealer ledger credits (writes `PR_REVERSAL`, debit: amount) -> Restores dealer outstanding
   * 2. Reverses GL accounting entries
   * 3. Automatically reinstates credit exposure
   * 4. Updates PR status to REVERSED with audit reason
   */
  async reverseProvisionalReceipt(
    prId: string,
    reversalReason: string,
    userId?: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const pr = await tx.provisionalReceipt.findUnique({
        where: { id: prId },
        include: { allocations: true },
      });

      if (!pr) throw new NotFoundException('Provisional Receipt not found');

      if (pr.status === 'REVERSED') {
        throw new BadRequestException('This Provisional Receipt has already been reversed');
      }

      const revReason = reversalReason?.trim() || 'Management PR Reversal';

      // 1. Reverse each active allocation in Dealer Ledger and GL
      for (const alloc of pr.allocations) {
        if (alloc.status === 'POSTED') {
          // Add reversing ledger entry (debit increases what dealer owes back to previous balance)
          await this.dealerLedgerService.postEntry(tx, {
            organizationId: pr.organizationId,
            companyId: pr.companyId,
            dealerId: alloc.dealerId,
            entryType: 'PR_REVERSAL',
            referenceId: pr.id,
            voucherNumber: `REV-${pr.prNumber}`,
            description: `Reversal of PR [${pr.prNumber}]: ${revReason}`,
            debit: Number(alloc.allocatedAmount),
            credit: 0,
            entryDate: new Date(),
            provisionalReceiptAllocationId: alloc.id,
          });

          // Post reversing GL entry: Debit AR (103000), Credit Collection Clearing (103500)
          await this.financeService.postJournalEntry(tx, {
            organizationId: pr.organizationId,
            companyId: pr.companyId,
            sourceType: 'DEALER_PAYMENT',
            sourceId: alloc.id,
            referenceType: 'PR_ALLOCATION_REVERSAL',
            referenceNumber: `REV-${pr.prNumber}`,
            description: `Reversal of PR [${pr.prNumber}] allocation for dealer ${alloc.dealerName || alloc.dealerId}`,
            entryDate: new Date(),
            createdById: userId,
            lines: [
              {
                accountCode: '103000',
                debit: Number(alloc.allocatedAmount),
                credit: 0,
                dealerId: alloc.dealerId,
                description: `Restore receivable for reversed PR ${pr.prNumber}`,
              },
              {
                accountCode: '103500',
                debit: 0,
                credit: Number(alloc.allocatedAmount),
                description: `Restore clearing for reversed PR ${pr.prNumber}`,
              },
            ],
          });

          // Mark allocation as REVERSED
          await tx.provisionalReceiptAllocation.update({
            where: { id: alloc.id },
            data: { status: 'REVERSED' },
          });
        }
      }

      // 2. Reverse initial receipt GL entry if it was posted (Debit Clearing 103500, Credit Cash/Bank 101000/102000)
      if (pr.journalEntryId) {
        const isBank = ['BANK', 'CHEQUE', 'DD', 'ONLINE'].includes(pr.paymentMethod);
        const cashOrBankCode = isBank ? '102000' : '101000';

        await this.financeService.postJournalEntry(tx, {
          organizationId: pr.organizationId,
          companyId: pr.companyId,
          sourceType: 'DEALER_PAYMENT',
          sourceId: pr.id,
          referenceType: 'PR_RECEIPT_REVERSAL',
          referenceNumber: `REV-${pr.prNumber}`,
          description: `Total Reversal of PR [${pr.prNumber}]: ${revReason}`,
          entryDate: new Date(),
          createdById: userId,
          lines: [
            {
              accountCode: '103500',
              debit: Number(pr.totalAmount),
              credit: 0,
              description: `Reverse collection clearing for PR ${pr.prNumber}`,
            },
            {
              accountCode: cashOrBankCode,
              debit: 0,
              credit: Number(pr.totalAmount),
              description: `Reverse cash/bank receipt for PR ${pr.prNumber}`,
            },
          ],
        });

        // Reversal of Bank Balance and FinancialTransaction
        if (isBank && pr.bankAccountId) {
          await tx.bankAccount.update({
            where: { id: pr.bankAccountId },
            data: {
              currentBalance: {
                decrement: Number(pr.totalAmount),
              },
            },
          });
        }

        await tx.financialTransaction.updateMany({
          where: {
            OR: [
              { voucherNumber: `PR-TX-${pr.prNumber}` },
              { referenceNumber: pr.prNumber },
            ],
          },
          data: { status: 'REVERSED' },
        });
      }

      // 3. Update PR status
      await tx.provisionalReceipt.update({
        where: { id: prId },
        data: {
          status: 'REVERSED',
          reversedById: userId || null,
          reversedAt: new Date(),
          reversalReason: revReason,
        },
      });

      this.logger.log(`PR ${pr.prNumber} reversed. Reason: ${revReason}`);
      return this.getProvisionalReceiptById(prId, tx);
    });
  }

  /**
   * PR Drill-Down Detail:
   * Returns header, products, allocations, dealer ledger impact, credit impact
   */
  async getProvisionalReceiptById(id: string, customTx?: any) {
    const client = customTx || this.prisma;
    const pr = await client.provisionalReceipt.findUnique({
      where: { id },
      include: {
        company: { select: { id: true, code: true, name: true } },
        dealer: {
          select: {
            id: true,
            code: true,
            name: true,
            businessName: true,
            address: true,
            currentBalance: true,
            creditLimit: true,
            territory: {
              select: {
                id: true,
                code: true,
                name: true,
                zone: {
                  select: {
                    id: true,
                    code: true,
                    name: true,
                    region: { select: { id: true, code: true, name: true } },
                  },
                },
              },
            },
          },
        },
        region: { select: { id: true, code: true, name: true } },
        territory: { select: { id: true, code: true, name: true } },
        products: { orderBy: { srNo: 'asc' } },
        allocations: {
          include: {
            dealer: {
              select: {
                id: true,
                code: true,
                name: true,
                businessName: true,
                currentBalance: true,
                creditLimit: true,
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!pr) throw new NotFoundException('Provisional Receipt not found');

    // Look up Sales Officer details if available
    let salesOfficer: any = null;
    if (pr.salesOfficerId) {
      salesOfficer = await client.user.findUnique({
        where: { id: pr.salesOfficerId },
        select: { id: true, firstName: true, lastName: true, email: true },
      });
      if (!salesOfficer) {
        salesOfficer = await client.employee.findUnique({
          where: { id: pr.salesOfficerId },
          select: { id: true, firstName: true, lastName: true, employeeCode: true },
        });
      }
    }

    const unifiedAllocations = [
      ...pr.allocations.map((a: any, idx: number) => ({
        id: a.id,
        srNo: idx + 1,
        type: 'DEALER',
        dealerId: a.dealerId,
        targetName: a.dealerName || a.dealer?.name,
        targetCode: a.partyCode || a.dealer?.code,
        description: a.remarks || 'Dealer Collection',
        amount: Number(a.allocatedAmount),
        status: a.status,
      })),
      ...pr.products
        .filter((p: any) => p.packSize === 'EXPENSE')
        .map((p: any, idx: number) => ({
          id: p.id,
          srNo: pr.allocations.length + idx + 1,
          type: 'EXPENSE',
          targetName: p.productName,
          targetCode: 'EXPENSE',
          description: p.productName || 'Operational Expense',
          amount: Number(p.amount),
          status: pr.status,
        })),
    ];

    return {
      ...pr,
      salesOfficer: salesOfficer
        ? {
            id: salesOfficer.id,
            name: `${salesOfficer.firstName || ''} ${salesOfficer.lastName || ''}`.trim() || salesOfficer.email || salesOfficer.employeeCode,
            code: salesOfficer.employeeCode || salesOfficer.email,
          }
        : null,
      unifiedAllocations,
    };
  }

  /**
   * List Provisional Receipts with filters
   */
  async getProvisionalReceipts(filters: {
    companyId?: string;
    status?: string;
    allocationStatus?: string;
    paymentMethod?: string;
    fromDate?: string;
    toDate?: string;
    search?: string;
  }) {
    const where: any = {};
    if (filters.companyId && filters.companyId !== 'ALL') where.companyId = filters.companyId;
    if (filters.status && filters.status !== 'ALL') where.status = filters.status;
    if (filters.allocationStatus && filters.allocationStatus !== 'ALL') {
      where.allocationStatus = filters.allocationStatus;
    }
    if (filters.paymentMethod && filters.paymentMethod !== 'ALL') {
      where.paymentMethod = filters.paymentMethod;
    }

    if (filters.fromDate || filters.toDate) {
      where.receiptDate = {};
      if (filters.fromDate) where.receiptDate.gte = new Date(filters.fromDate);
      if (filters.toDate) where.receiptDate.lte = new Date(filters.toDate);
    }

    if (filters.search?.trim()) {
      where.OR = [
        { prNumber: { contains: filters.search.trim(), mode: 'insensitive' } },
        { receivedFrom: { contains: filters.search.trim(), mode: 'insensitive' } },
        { partyCode: { contains: filters.search.trim(), mode: 'insensitive' } },
        { paymentReferenceNumber: { contains: filters.search.trim(), mode: 'insensitive' } },
        { remarks: { contains: filters.search.trim(), mode: 'insensitive' } },
      ];
    }

    return this.prisma.provisionalReceipt.findMany({
      where,
      include: {
        company: { select: { id: true, code: true, name: true } },
        dealer: { select: { id: true, code: true, name: true } },
        region: { select: { id: true, code: true, name: true } },
        territory: { select: { id: true, code: true, name: true } },
        _count: { select: { products: true, allocations: true } },
      },
      orderBy: { receiptDate: 'desc' },
      take: 200,
    });
  }

  /**
   * PR Dashboard Cards:
   * Total PR, Pending Allocation, Partially Allocated, Fully Allocated, Posted, Cancelled, Amounts
   */
  async getPrDashboard(companyId?: string) {
    const where: any = {};
    if (companyId && companyId !== 'ALL') where.companyId = companyId;

    const prs = await this.prisma.provisionalReceipt.findMany({
      where,
      select: {
        status: true,
        allocationStatus: true,
        totalAmount: true,
        allocatedAmount: true,
        unallocatedAmount: true,
      },
    });

    let totalPrCount = prs.length;
    let pendingCount = 0;
    let partialCount = 0;
    let fullyAllocatedCount = 0;
    let postedCount = 0;
    let reversedCount = 0;
    let cancelledCount = 0;
    let totalAmount = 0;
    let allocatedAmount = 0;
    let unallocatedAmount = 0;

    for (const p of prs) {
      const tot = Number(p.totalAmount);
      const alloc = Number(p.allocatedAmount);
      const unalloc = Number(p.unallocatedAmount);

      totalAmount += tot;
      allocatedAmount += alloc;
      unallocatedAmount += unalloc;

      if (p.status === 'POSTED') postedCount++;
      if (p.status === 'REVERSED') reversedCount++;
      if (p.status === 'CANCELLED') cancelledCount++;

      if (p.allocationStatus === 'UNALLOCATED') pendingCount++;
      else if (p.allocationStatus === 'PARTIALLY_ALLOCATED') partialCount++;
      else if (p.allocationStatus === 'FULLY_ALLOCATED') fullyAllocatedCount++;
    }

    return {
      totalPr: totalPrCount,
      pendingAllocation: pendingCount,
      partiallyAllocated: partialCount,
      fullyAllocated: fullyAllocatedCount,
      posted: postedCount,
      reversed: reversedCount,
      cancelled: cancelledCount,
      totalAmount: Math.round(totalAmount * 100) / 100,
      allocatedAmount: Math.round(allocatedAmount * 100) / 100,
      unallocatedAmount: Math.round(unallocatedAmount * 100) / 100,
    };
  }

  /**
   * PR Audit History
   */
  async getPrAudit(id: string) {
    const pr = await this.prisma.provisionalReceipt.findUnique({
      where: { id },
      include: {
        allocations: {
          include: { dealer: { select: { code: true, name: true } } },
        },
      },
    });
    if (!pr) throw new NotFoundException('Provisional Receipt not found');

    const auditSteps: Array<{
      action: string;
      timestamp: Date;
      user: string;
      details: string;
    }> = [
      {
        action: 'PR Created',
        timestamp: pr.createdAt,
        user: pr.createdById || 'System',
        details: `PR ${pr.prNumber} created for PKR ${pr.totalAmount} from ${pr.receivedFrom}`,
      },
    ];

    if (pr.postedAt) {
      auditSteps.push({
        action: 'PR Posted & Collection Cleared',
        timestamp: pr.postedAt,
        user: pr.postedById || pr.createdById || 'System',
        details: `Receipt posted to Cash/Bank and Collection Clearing (103500)`,
      });
    }

    for (const a of pr.allocations) {
      auditSteps.push({
        action: `Dealer Allocation (${a.status})`,
        timestamp: a.createdAt,
        user: 'System',
        details: `Allocated PKR ${a.allocatedAmount} to ${a.dealer.name} (${a.dealer.code}). Dealer outstanding reduced.`,
      });
    }

    if (pr.reversedAt) {
      auditSteps.push({
        action: 'PR Reversed',
        timestamp: pr.reversedAt,
        user: pr.reversedById || 'Management',
        details: `Reversed: ${pr.reversalReason || 'No reason specified'}. Dealer outstanding & credit restored.`,
      });
    }

    return auditSteps;
  }

  /**
   * Suggest Next Sequential PR Number within Company Scope
   */
  async getNextPrNumber(companyId?: string) {
    if (!companyId || companyId === 'ALL') {
      return { prNumber: `PR-${new Date().getFullYear()}-0001` };
    }

    const latestPr = await this.prisma.provisionalReceipt.findFirst({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      select: { prNumber: true },
    });

    if (!latestPr) {
      return { prNumber: `PR-${new Date().getFullYear()}-0001` };
    }

    const match = latestPr.prNumber.match(/^(.*?)(\d+)$/);
    if (match && match[1] !== undefined && match[2] !== undefined) {
      const nextSeq = parseInt(match[2], 10) + 1;
      return { prNumber: `${match[1]}${String(nextSeq).padStart(match[2].length, '0')}` };
    }

    return { prNumber: `PR-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}` };
  }

  /**
   * Check if PR Number already exists in Company Scope
   */
  async checkPrNumber(companyId: string, prNumber: string) {
    const cleanPr = prNumber?.trim().toUpperCase();
    if (!cleanPr || !companyId || companyId === 'ALL') return { exists: false };

    const existing = await this.prisma.provisionalReceipt.findUnique({
      where: {
        companyId_prNumber: {
          companyId,
          prNumber: cleanPr,
        },
      },
      select: { id: true, prNumber: true },
    });

    return { exists: !!existing };
  }

  /**
   * Fetch active Sales Officers in company scope
   */
  async getSalesOfficers(companyId?: string) {
    const company = await this.prisma.company.findFirst({
      where: companyId && companyId !== 'ALL' ? { id: companyId } : {},
      orderBy: [{ isParent: 'desc' }, { createdAt: 'asc' }],
    });
    if (!company) return [];

    // 1. Fetch users with sales/field roles or assignments
    const users = await this.prisma.user.findMany({
      where: {
        organizationId: company.organizationId,
        isActive: true,
        OR: [
          { companyId: company.id },
          { assignedDealers: { some: { companyId: company.id } } },
          { managedTerritories: { some: { zone: { region: { companyId: company.id } } } } },
          { marketAssignments: { some: { companyId: company.id } } },
        ],
      },
      include: {
        employee: true,
        userRoles: { include: { role: true } },
        assignedDealers: { where: { companyId: company.id }, select: { id: true } },
        managedTerritories: { select: { id: true } },
        marketAssignments: { where: { companyId: company.id } },
      },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
    });

    // 2. Also fetch employees with field/sales position in that company
    const employees = await this.prisma.employee.findMany({
      where: {
        companyId: company.id,
        status: 'ACTIVE',
      },
      include: {
        users: true,
        marketAssignments: true,
      },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
    });

    const officerMap = new Map<string, any>();

    // Add matching users
    for (const u of users) {
      const isSales =
        u.userRoles.some((ur) => /sales|field|officer|agent|so/i.test(ur.role.name || ur.role.code)) ||
        u.assignedDealers.length > 0 ||
        u.managedTerritories.length > 0 ||
        u.marketAssignments.some((ma) => /sales|so/i.test(ma.roleScope)) ||
        (u.employee && /sales|field|officer/i.test(u.employee.position || ''));

      if (isSales || users.length <= 15) {
        const name = `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email;
        const code = u.employee?.employeeCode || u.email.split('@')[0];
        officerMap.set(u.id, {
          id: u.id,
          userId: u.id,
          employeeId: u.employeeId || undefined,
          name,
          code,
          email: u.email,
          phone: u.phone || u.employee?.phone || '',
          position: u.employee?.position || 'Sales Officer',
          dealerCount: u.assignedDealers.length,
        });
      }
    }

    // Add matching employees who might not have user accounts yet
    for (const e of employees) {
      const hasExisting = Array.from(officerMap.values()).some(
        (o) => o.employeeId === e.id || (e.users.length > 0 && e.users.some((u) => u.id === o.id)),
      );
      if (!hasExisting) {
        const isSales =
          /sales|field|officer|rep|agent/i.test(e.position || '') ||
          e.marketAssignments.length > 0;
        if (isSales || employees.length <= 10) {
          const name = `${e.firstName} ${e.lastName}`.trim();
          officerMap.set(e.id, {
            id: e.users[0]?.id || e.id,
            userId: e.users[0]?.id || undefined,
            employeeId: e.id,
            name,
            code: e.employeeCode,
            email: e.email || '',
            phone: e.phone || '',
            position: e.position || 'Sales Officer',
            dealerCount: 0,
          });
        }
      }
    }

    return Array.from(officerMap.values());
  }

  /**
   * Fetch only dealers assigned to selected Sales Officer in company
   * Shows complete market hierarchy: Dealer Code, Name, Shop, Territory, Zone, Region, Province
   */
  async getDealersByOfficer(companyId: string, officerId?: string) {
    if (!companyId || companyId === 'ALL') return [];

    let targetUserId = officerId;
    let targetEmployeeId: string | undefined;

    if (officerId) {
      const user = await this.prisma.user.findUnique({
        where: { id: officerId },
        select: { id: true, employeeId: true },
      });
      if (user) {
        targetUserId = user.id;
        targetEmployeeId = user.employeeId || undefined;
      } else {
        const emp = await this.prisma.employee.findUnique({
          where: { id: officerId },
          include: { users: { select: { id: true } } },
        });
        if (emp) {
          targetEmployeeId = emp.id;
          targetUserId = emp.users[0]?.id;
        }
      }
    }

    // Find assigned territories for this officer
    const assignedTerritoryIds = new Set<string>();

    if (targetUserId) {
      const territories = await this.prisma.territory.findMany({
        where: { managerId: targetUserId },
        select: { id: true },
      });
      territories.forEach((t) => assignedTerritoryIds.add(t.id));

      const marketAssignments = await this.prisma.userMarketAssignment.findMany({
        where: {
          OR: [
            { userId: targetUserId },
            ...(targetEmployeeId ? [{ employeeId: targetEmployeeId }] : []),
          ],
          territoryId: { not: null },
        },
        select: { territoryId: true },
      });
      marketAssignments.forEach((ma) => {
        if (ma.territoryId) assignedTerritoryIds.add(ma.territoryId);
      });
    }

    const whereClause: any = {
      companyId,
      status: 'ACTIVE',
    };

    if (targetUserId) {
      whereClause.OR = [
        { assignedFieldOfficerId: targetUserId },
        { officerAssignments: { some: { userId: targetUserId } } },
        ...(assignedTerritoryIds.size > 0
          ? [{ territoryId: { in: Array.from(assignedTerritoryIds) } }]
          : []),
      ];
    }

    let dealers = await this.prisma.dealer.findMany({
      where: whereClause,
      include: {
        territory: {
          include: {
            zone: {
              include: {
                region: true,
              },
            },
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    // If an officer was selected but no specific assignments were found in DB,
    // fallback gracefully to all dealers in this company so the user can still proceed
    if (dealers.length === 0 && targetUserId) {
      dealers = await this.prisma.dealer.findMany({
        where: { companyId, status: 'ACTIVE' },
        include: {
          territory: {
            include: {
              zone: {
                include: {
                  region: true,
                },
              },
            },
          },
        },
        orderBy: { name: 'asc' },
      });
    }

    return dealers.map((d) => ({
      id: d.id,
      code: d.code,
      name: d.name,
      businessName: d.businessName || d.name,
      contactPerson: d.contactPerson || '',
      phone: d.phone || '',
      address: d.address || '',
      city: d.city || '',
      creditLimit: Number(d.creditLimit || 0),
      currentBalance: Number(d.currentBalance || 0),
      territoryId: d.territoryId,
      territoryCode: d.territory?.code || '—',
      territoryName: d.territory?.name || '—',
      zoneId: d.territory?.zoneId,
      zoneCode: d.territory?.zone?.code || '—',
      zoneName: d.territory?.zone?.name || '—',
      regionId: d.territory?.zone?.regionId,
      regionCode: d.territory?.zone?.region?.code || '—',
      regionName: d.territory?.zone?.region?.name || '—',
      provinceName: d.territory?.zone?.region?.name?.includes('Sindh') ? 'Sindh' : 'Punjab',
    }));
  }

  /**
   * Fetch available Other Expense Products and standard Expense Heads
   */
  async getExpenseProducts(companyId?: string) {
    const fps = await this.prisma.finishedProduct.findMany({
      where: {
        ...(companyId && companyId !== 'ALL' ? { companyId } : {}),
        status: 'ACTIVE',
        OR: [
          { productType: { contains: 'other', mode: 'insensitive' } },
          { productType: { contains: 'expense', mode: 'insensitive' } },
          { mType: { contains: 'other', mode: 'insensitive' } },
          { productName: { contains: 'expense', mode: 'insensitive' } },
          { productName: { contains: 'bilty', mode: 'insensitive' } },
          { productName: { contains: 'freight', mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        productCode: true,
        productName: true,
        productType: true,
      },
      take: 20,
    });

    const expenseHeads = await this.prisma.expenseHead.findMany({
      where: {
        ...(companyId && companyId !== 'ALL' ? { companyId } : {}),
        isActive: true,
      },
      include: {
        items: { where: { isActive: true }, select: { id: true, code: true, name: true } },
      },
      orderBy: { name: 'asc' },
    });

    const list: Array<{
      id: string;
      code: string;
      name: string;
      category: string;
      expenseHeadId?: string;
      expenseItemId?: string;
      mainDivision?: string;
    }> = [];

    for (const fp of fps) {
      list.push({
        id: fp.id,
        code: fp.productCode,
        name: fp.productName,
        category: 'Product',
        mainDivision: 'SALES_EXPENSE',
      });
    }

    const standardCommon = [
      { name: 'Bilty Expense', code: 'EXP-BLT', division: 'SALES_EXPENSE' },
      { name: 'Freight Expense', code: 'EXP-FRT', division: 'SALES_EXPENSE' },
      { name: 'Field Travel & Fuel', code: 'EXP-FUEL', division: 'SALES_EXPENSE' },
      { name: 'Sales TA / DA Allowance', code: 'EXP-TADA', division: 'SALES_EXPENSE' },
      { name: 'Vehicle Maintenance & Repair', code: 'EXP-VMR', division: 'SALES_EXPENSE' },
      { name: 'Office Supplies & Stationery', code: 'EXP-SUP', division: 'GENERAL_EXPENSE' },
      { name: 'Miscellaneous Operational Expense', code: 'EXP-MISC', division: 'MISCELLANEOUS_EXPENSE' },
    ];

    for (const sc of standardCommon) {
      if (!list.some((it) => it.name.toLowerCase() === sc.name.toLowerCase())) {
        list.push({
          id: `STD-${sc.code}`,
          code: sc.code,
          name: sc.name,
          category: 'Standard Expense',
          mainDivision: sc.division,
        });
      }
    }

    for (const eh of expenseHeads) {
      if (!list.some((it) => it.name.toLowerCase() === eh.name.toLowerCase())) {
        list.push({
          id: eh.id,
          code: eh.code,
          name: eh.name,
          category: 'Expense Head',
          expenseHeadId: eh.id,
          mainDivision: eh.mainDivision,
        });
      }
      for (const item of eh.items) {
        if (!list.some((it) => it.name.toLowerCase() === item.name.toLowerCase())) {
          list.push({
            id: item.id,
            code: item.code,
            name: `${eh.name} — ${item.name}`,
            category: 'Expense Item',
            expenseHeadId: eh.id,
            expenseItemId: item.id,
            mainDivision: eh.mainDivision,
          });
        }
      }
    }

    return list;
  }
}
