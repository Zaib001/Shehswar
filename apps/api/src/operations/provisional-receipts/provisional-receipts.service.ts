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
  dealerId: string;
  partyCode?: string;
  dealerName?: string;
  regionId?: string;
  territoryId?: string;
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
  regionId?: string;
  territoryId?: string;
  paymentMethod: 'CASH' | 'CHEQUE' | 'DD' | 'ONLINE' | 'OTHER';
  paymentReferenceNumber?: string;
  bankName?: string;
  branchName?: string;
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
        `Provisional Receipt with number "${prNumberClean}" already exists for this company`,
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

    // 4. Validate initial allocations if any are provided
    let totalAllocated = 0;
    const processedAllocations: Array<{
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

    if (dto.allocations && dto.allocations.length > 0) {
      for (const a of dto.allocations) {
        const amt = Math.round(Number(a.allocatedAmount) * 100) / 100;
        if (amt <= 0) continue;
        totalAllocated += amt;

        processedAllocations.push({
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

      // If initial allocations were provided and autoPost is true, post them
      if (dto.autoPost && processedAllocations.length > 0) {
        for (const alloc of processedAllocations) {
          await this.executeDealerAllocation(
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
        await this.executeDealerAllocation(
          tx,
          pr.organizationId,
          pr,
          alloc,
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
        dealer: { select: { id: true, code: true, name: true, currentBalance: true, creditLimit: true } },
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
    return pr;
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
}
