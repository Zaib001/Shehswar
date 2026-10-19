/**
 * SHEHSWAR ONE360 - Dealer Ledger Service
 *
 * THE ONLY place that writes DealerLedgerEntry records.
 * Maintains the authoritative running balance for every dealer.
 *
 * Entry types:
 *  SALE_INVOICE    → debit  (dealer owes us)
 *  PAYMENT_RECEIPT → credit (dealer paid us)
 *  SALES_RETURN    → credit (we owe dealer a credit)
 *  OPENING_BALANCE → initial balance
 *  ADJUSTMENT      → approved manual correction
 */
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { Prisma } from '@shehswar/database';
import { DealerLedgerInput } from '@shehswar/types';

@Injectable()
export class DealerLedgerService {
  private readonly logger = new Logger(DealerLedgerService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Post a ledger entry inside an existing transaction.
   * Returns the running balance AFTER this entry.
   */
  async postEntry(
    tx: Prisma.TransactionClient,
    input: DealerLedgerInput,
  ): Promise<{ runningBalance: number }> {
    // 1. Calculate current balance from last ledger entry
    const lastEntry = await tx.dealerLedgerEntry.findFirst({
      where: { dealerId: input.dealerId, companyId: input.companyId },
      orderBy: { createdAt: 'desc' },
    });

    const previousBalance = lastEntry ? Number(lastEntry.runningBalance) : 0;

    // debit increases what dealer owes; credit reduces it
    const runningBalance = previousBalance + Number(input.debit) - Number(input.credit);

    // 2. Create immutable ledger entry
    await tx.dealerLedgerEntry.create({
      data: {
        organizationId: input.organizationId,
        companyId: input.companyId,
        dealerId: input.dealerId,
        entryType: input.entryType,
        referenceId: input.referenceId,
        voucherNumber: input.voucherNumber,
        description: input.description ?? null,
        debit: input.debit,
        credit: input.credit,
        runningBalance,
        entryDate: input.entryDate ?? new Date(),
        salesInvoiceId: input.salesInvoiceId ?? null,
        dealerPaymentId: input.dealerPaymentId ?? null,
        salesReturnId: input.salesReturnId ?? null,
        provisionalReceiptAllocationId: input.provisionalReceiptAllocationId ?? null,
      },
    });

    // 3. Update denormalized balance on Dealer record for quick reads
    await tx.dealer.update({
      where: { id: input.dealerId },
      data: { currentBalance: runningBalance },
    });

    this.logger.log(
      `Dealer ledger: ${input.entryType} | dealer=${input.dealerId} | debit=${input.debit} | credit=${input.credit} | balance=${runningBalance}`,
    );

    return { runningBalance };
  }

  /**
   * Get ledger statement for a dealer (non-transactional, for display/mobile).
   */
  async getLedger(
    dealerId: string,
    _companyId?: string,
    options?: { fromDate?: Date; toDate?: Date; limit?: number },
  ) {
    const dealer = await this.prisma.dealer.findUnique({
      where: { id: dealerId },
      select: { currentBalance: true, creditLimit: true, name: true, code: true, phone: true, city: true, address: true, companyId: true },
    });

    if (!dealer) {
      throw new NotFoundException('Dealer not found');
    }

    const where: any = { dealerId };

    if (options?.fromDate || options?.toDate) {
      where.entryDate = {};
      if (options.fromDate) where.entryDate.gte = options.fromDate;
      if (options.toDate) where.entryDate.lte = options.toDate;
    }

    const entries = await this.prisma.dealerLedgerEntry.findMany({
      where,
      orderBy: { entryDate: 'desc' },
      take: options?.limit ?? 200,
    });

    return {
      dealer,
      entries: entries.map((e) => ({
        id: e.id,
        entryType: e.entryType,
        voucherNumber: e.voucherNumber,
        description: e.description,
        debit: Number(e.debit),
        credit: Number(e.credit),
        runningBalance: Number(e.runningBalance),
        entryDate: e.entryDate,
      })),
      currentBalance: Number(dealer.currentBalance ?? 0),
    };
  }

  async getDealerLedger(
    dealerId: string,
    companyId: string,
    options?: { fromDate?: Date; toDate?: Date; limit?: number; offset?: number; startDate?: Date; endDate?: Date },
  ) {
    return this.getLedger(dealerId, companyId, {
      fromDate: options?.startDate ?? options?.fromDate,
      toDate: options?.endDate ?? options?.toDate,
      limit: options?.limit,
    });
  }

  /**
   * Get current dealer balance (fast read from dealer record).
   */
  async getDealerBalance(dealerId: string, _companyId?: string): Promise<number> {
    const dealer = await this.prisma.dealer.findUnique({
      where: { id: dealerId },
      select: { currentBalance: true },
    });
    return dealer ? Number(dealer.currentBalance) : 0;
  }

  /**
   * Regenerate and recalculate dealer running balances from chronological documents.
   */
  async recalculateLedger(dealerId: string, _companyId?: string) {
    const dealer = await this.prisma.dealer.findUnique({
      where: { id: dealerId },
      select: { id: true, companyId: true },
    });

    if (!dealer) {
      throw new NotFoundException('Dealer not found');
    }

    const entries = await this.prisma.dealerLedgerEntry.findMany({
      where: { dealerId },
      orderBy: [{ entryDate: 'asc' }, { createdAt: 'asc' }],
    });

    let running = 0;
    for (const entry of entries) {
      running = running + Number(entry.debit) - Number(entry.credit);
      await this.prisma.dealerLedgerEntry.update({
        where: { id: entry.id },
        data: { runningBalance: running },
      });
    }

    await this.prisma.dealer.update({
      where: { id: dealerId },
      data: { currentBalance: running },
    });

    this.logger.log(`Dealer ${dealerId} ledger regenerated. Closing balance: ${running}`);
    return this.getLedger(dealerId, dealer.companyId);
  }
}
