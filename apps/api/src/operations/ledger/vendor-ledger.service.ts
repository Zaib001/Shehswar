/**
 * SHEHSWAR ONE360 - Vendor Ledger Service
 *
 * THE ONLY place that writes VendorLedgerEntry records.
 * Mirrors the DealerLedgerService pattern for vendor-side payables.
 *
 * Entry types:
 *  PURCHASE_INVOICE → credit  (we owe vendor)
 *  VENDOR_PAYMENT   → debit   (we paid vendor)
 *  PURCHASE_RETURN  → debit   (vendor owes us a refund)
 *  OPENING_BALANCE  → initial balance
 *  ADJUSTMENT       → approved manual correction
 */
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { Prisma } from '@shehswar/database';
import { VendorLedgerInput } from '@shehswar/types';

@Injectable()
export class VendorLedgerService {
  private readonly logger = new Logger(VendorLedgerService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Post a vendor ledger entry inside an existing transaction.
   */
  async postEntry(
    tx: Prisma.TransactionClient,
    input: VendorLedgerInput,
  ): Promise<{ runningBalance: number }> {
    // 1. Calculate current balance from last entry
    const lastEntry = await tx.vendorLedgerEntry.findFirst({
      where: { vendorId: input.vendorId, companyId: input.companyId },
      orderBy: { createdAt: 'desc' },
    });

    const previousBalance = lastEntry ? Number(lastEntry.runningBalance) : 0;

    // credit increases what we owe vendor; debit reduces it
    const runningBalance = previousBalance + Number(input.credit) - Number(input.debit);

    // 2. Create immutable ledger entry
    await tx.vendorLedgerEntry.create({
      data: {
        organizationId: input.organizationId,
        companyId: input.companyId,
        vendorId: input.vendorId,
        entryType: input.entryType,
        referenceId: input.referenceId,
        voucherNumber: input.voucherNumber,
        description: input.description ?? null,
        credit: input.credit,
        debit: input.debit,
        runningBalance,
        entryDate: input.entryDate ?? new Date(),
        purchaseInvoiceId: input.purchaseInvoiceId ?? null,
        vendorPaymentId: input.vendorPaymentId ?? null,
        purchaseReturnId: input.purchaseReturnId ?? null,
      },
    });

    this.logger.log(
      `Vendor ledger: ${input.entryType} | vendor=${input.vendorId} | credit=${input.credit} | debit=${input.debit} | balance=${runningBalance}`,
    );

    return { runningBalance };
  }

  /**
   * Get vendor ledger statement (non-transactional, for display).
   */
  async getLedger(
    vendorId: string,
    companyId: string,
    options?: { fromDate?: Date; toDate?: Date; limit?: number },
  ) {
    const where: any = { vendorId, companyId };

    if (options?.fromDate || options?.toDate) {
      where.entryDate = {};
      if (options.fromDate) where.entryDate.gte = options.fromDate;
      if (options.toDate) where.entryDate.lte = options.toDate;
    }

    const entries = await this.prisma.vendorLedgerEntry.findMany({
      where,
      orderBy: { entryDate: 'desc' },
      take: options?.limit ?? 100,
    });

    // Get current balance from last entry
    const lastEntry = entries[0];
    const currentBalance = lastEntry ? Number(lastEntry.runningBalance) : 0;

    return {
      entries: entries.map((e) => ({
        id: e.id,
        entryType: e.entryType,
        voucherNumber: e.voucherNumber,
        description: e.description,
        credit: Number(e.credit),
        debit: Number(e.debit),
        runningBalance: Number(e.runningBalance),
        entryDate: e.entryDate,
      })),
      currentBalance,
    };
  }

  async getVendorLedger(
    vendorId: string,
    companyId: string,
    options?: { fromDate?: Date; toDate?: Date; limit?: number; offset?: number; startDate?: Date; endDate?: Date },
  ) {
    return this.getLedger(vendorId, companyId, {
      fromDate: options?.startDate ?? options?.fromDate,
      toDate: options?.endDate ?? options?.toDate,
      limit: options?.limit,
    });
  }

  async getVendorBalance(vendorId: string, companyId?: string): Promise<number> {
    const where: any = { vendorId };
    if (companyId) where.companyId = companyId;
    const lastEntry = await this.prisma.vendorLedgerEntry.findFirst({
      where,
      orderBy: { entryDate: 'desc' },
      select: { runningBalance: true },
    });
    return lastEntry ? Number(lastEntry.runningBalance) : 0;
  }
}

