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

    // 2. Create immutable ledger entry with full source references (Requirement 3)
    const effectiveSourceType =
      input.sourceType ||
      (input.voucherNumber.startsWith('SO-')
        ? 'SALES_ORDER'
        : input.voucherNumber.startsWith('PR-')
        ? 'PROVISIONAL_RECEIPT'
        : input.voucherNumber.startsWith('IC-')
        ? 'INTERCOMPANY_TRANSFER'
        : input.entryType || 'SALE_INVOICE');
    const effectiveSourceId =
      input.sourceId ||
      input.salesInvoiceId ||
      input.dealerPaymentId ||
      input.salesReturnId ||
      input.provisionalReceiptAllocationId ||
      input.referenceId;
    const effectiveSourceNumber = input.sourceNumber || input.voucherNumber;

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
        sourceType: effectiveSourceType,
        sourceId: effectiveSourceId,
        sourceNumber: effectiveSourceNumber,
      },
    });

    // 3. Update denormalized balance on Dealer record for quick reads
    await tx.dealer.update({
      where: { id: input.dealerId },
      data: { currentBalance: runningBalance },
    });

    this.logger.log(
      `Dealer ledger: ${input.entryType} | dealer=${input.dealerId} | debit=${input.debit} | credit=${input.credit} | balance=${runningBalance} | source=${effectiveSourceType} #${effectiveSourceNumber}`,
    );

    return { runningBalance };
  }

  /**
   * Get ledger statement for a dealer (non-transactional, for display/mobile).
   * Chronological ascending: earliest on top row, latest at bottom.
   */
  async getLedger(
    dealerId: string,
    _companyId?: string,
    options?: { fromDate?: Date; toDate?: Date; limit?: number },
  ): Promise<any> {
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
      include: {
        salesInvoice: {
          include: {
            items: {
              include: {
                finishedProduct: {
                  include: {
                    packSize: true,
                    category: true,
                  },
                },
                batch: true,
              },
            },
            salesOrder: {
              include: {
                scheme: true,
                items: {
                  include: {
                    scheme: true,
                    finishedProduct: true,
                  },
                },
              },
            },
          },
        },
        dealerPayment: true,
        salesReturn: {
          include: {
            items: {
              include: {
                finishedProduct: true,
              },
            },
          },
        },
      },
      orderBy: [{ entryDate: 'asc' }, { createdAt: 'asc' }],
      take: options?.limit ?? 500,
    });

    if (entries.length === 0 && !options?.fromDate && !options?.toDate) {
      const hasInvoices = await this.prisma.salesInvoice.count({
        where: { dealerId, postingStatus: 'POSTED' },
      });
      if (hasInvoices > 0) {
        return this.recalculateLedger(dealerId, dealer.companyId);
      }
    }

    return {
      dealer,
      entries: entries.map((e) => {
        const sourceType =
          e.sourceType ||
          (e.voucherNumber.startsWith('SO-')
            ? 'SALES_ORDER'
            : e.voucherNumber.startsWith('PR-')
            ? 'PROVISIONAL_RECEIPT'
            : e.voucherNumber.startsWith('IC-')
            ? 'INTERCOMPANY_TRANSFER'
            : e.salesInvoiceId
            ? 'SALE_INVOICE'
            : e.dealerPaymentId
            ? 'PAYMENT_RECEIPT'
            : e.salesReturnId
            ? 'SALES_RETURN'
            : e.entryType || 'SALE_INVOICE');
        const sourceId =
          e.sourceId ||
          e.salesInvoiceId ||
          e.dealerPaymentId ||
          e.salesReturnId ||
          e.provisionalReceiptAllocationId ||
          e.referenceId;
        const sourceNumber = e.sourceNumber || e.voucherNumber;

        let mappedItems: any[] = [];

        if (e.salesInvoice?.items && e.salesInvoice.items.length > 0) {
          mappedItems = e.salesInvoice.items.map((it: any) => {
            const fp = it.finishedProduct;
            const soItem = e.salesInvoice?.salesOrder?.items?.find(
              (soi: any) => soi.finishedProductId === it.finishedProductId
            );
            const orderScheme = soItem?.scheme || e.salesInvoice?.salesOrder?.scheme;
            const ppc = Number(fp?.ppc ?? 1) > 0 ? Number(fp?.ppc) : 1;
            const qty = Number(it.quantity || 0);
            const ctn = Math.ceil(qty / ppc);
            const rate = Number(it.rate || soItem?.unitPrice || 0);
            const discPct = Number(soItem?.discountPercent ?? orderScheme?.discountPct ?? orderScheme?.defaultDiscountPct ?? 0);
            const discRupees = Number(it.discountAmount ?? soItem?.discountAmount ?? 0);
            const schemeCode = orderScheme?.shortCode || orderScheme?.code || e.salesInvoice?.pricingPhase || '';
            const packRaw = it.packing || fp?.packSize?.name || (fp?.packingQuantity ? `${fp.packingQuantity} ${fp.packingUnit || ''}` : '');

            return {
              productName: it.productName || fp?.productName || 'Finished Product',
              productCode: fp?.productCode || '',
              description: fp?.productType || fp?.grade || fp?.brand || e.salesInvoice?.commercialCondition || fp?.description || 'Finished Goods',
              packSize: packRaw ? String(packRaw).trim() : '—',
              ppc,
              ctn,
              batchNumber: it.batchNumber || it.batch?.batchNumber || e.salesInvoice?.batchNumber || '—',
              quantity: qty,
              price: rate,
              grossAmount: Number(it.grossAmount || (qty * rate)),
              discountPercent: discPct,
              discountRupees: discRupees,
              netAmount: Number(it.netAmount || 0),
              schemeCode,
            };
          });
        } else if (e.description && e.description.includes('[INTERCOMPANY_TRANSFER]')) {
          try {
            const jsonMatch = e.description.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              const parsed = JSON.parse(jsonMatch[0]);
              if (Array.isArray(parsed.items)) {
                mappedItems = parsed.items.map((it: any) => {
                  const qty = Number(it.quantity || 0);
                  const ppc = Number(it.ppc || 12);
                  return {
                    productName: it.productName || 'Intercompany Product',
                    productCode: it.productCode || '',
                    description: it.description || 'Inter Company Sale',
                    packSize: it.packSize || '—',
                    ppc,
                    ctn: Math.ceil(qty / ppc),
                    batchNumber: it.batchNumber || 'STD-BATCH',
                    quantity: qty,
                    price: Number(it.sellingPrice || it.unitCost || 0),
                    grossAmount: Number(it.totalSales || (qty * Number(it.sellingPrice || 0))),
                    discountPercent: 0,
                    discountRupees: 0,
                    netAmount: Number(it.totalSales || 0),
                    schemeCode: 'IC-SALE',
                  };
                });
              }
            }
          } catch {
            // fallback
          }
        } else if (e.salesReturn?.items && e.salesReturn.items.length > 0) {
          mappedItems = e.salesReturn.items.map((it: any) => {
            const fp = it.finishedProduct;
            const qty = Number(it.quantity || 0);
            const ppc = Number(fp?.ppc || 1);
            return {
              productName: it.productName || fp?.productName || 'Returned Product',
              productCode: fp?.productCode || '',
              description: it.reason || e.salesReturn?.reason || 'Sales Return',
              packSize: fp?.packSize?.name || it.packing || '—',
              ppc,
              ctn: Math.ceil(qty / ppc),
              batchNumber: it.batchNumber || '—',
              quantity: qty,
              price: Number(it.rate || 0),
              grossAmount: Number(it.netAmount || 0),
              discountPercent: 0,
              discountRupees: 0,
              netAmount: Number(it.netAmount || 0),
              schemeCode: 'RETURN',
            };
          });
        }

        const firstItem = mappedItems[0];
        const totalQty = mappedItems.reduce((sum, it) => sum + Number(it.quantity || 0), 0);
        const totalCtn = mappedItems.reduce((sum, it) => sum + Number(it.ctn || 0), 0);

        return {
          id: e.id,
          entryType: e.entryType,
          voucherNumber: e.voucherNumber,
          referenceId: e.referenceId,
          sourceType,
          sourceId,
          sourceNumber,
          salesInvoiceId: e.salesInvoiceId,
          dealerPaymentId: e.dealerPaymentId,
          salesReturnId: e.salesReturnId,
          provisionalReceiptAllocationId: e.provisionalReceiptAllocationId,
          description: e.description,
          debit: Number(e.debit),
          credit: Number(e.credit),
          runningBalance: Number(e.runningBalance),
          entryDate: e.entryDate,
          // Structured Line Items & Product Commercial Attributes:
          items: mappedItems,
          productName: firstItem ? (mappedItems.length > 1 ? `${firstItem.productName} (+${mappedItems.length - 1} more)` : firstItem.productName) : (e.entryType?.includes('PAYMENT') || e.entryType?.includes('RECEIPT') ? 'Payment Receipt' : '—'),
          descriptionSummary: firstItem?.description || e.description || (e.entryType?.includes('PAYMENT') ? 'Commercial Receipt' : '—'),
          packSize: firstItem ? (mappedItems.length > 1 ? `${firstItem.packSize} (+more)` : firstItem.packSize) : '—',
          ctn: totalCtn > 0 ? totalCtn : (e.salesInvoice?.cartons || '—'),
          batchNumber: firstItem?.batchNumber || e.salesInvoice?.batchNumber || '—',
          quantity: totalQty > 0 ? totalQty : '—',
          price: firstItem?.price || '—',
          schemeCode: firstItem?.schemeCode || e.salesInvoice?.pricingPhase || '—',
          discountPercent: firstItem?.discountPercent || 0,
          discountRupees: firstItem?.discountRupees || 0,
        };
      }),
      currentBalance: Number(dealer.currentBalance ?? 0),
      creditLimit: Number(dealer.creditLimit || 0),
      usedCredit: Math.max(0, Number(dealer.currentBalance ?? 0)),
      pendingCredit: Math.max(0, Number(dealer.creditLimit || 0) - Number(dealer.currentBalance ?? 0)),
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
  async recalculateLedger(dealerId: string, _companyId?: string): Promise<any> {
    const dealer = await this.prisma.dealer.findUnique({
      where: { id: dealerId },
      select: { id: true, companyId: true, organizationId: true },
    });

    if (!dealer) {
      throw new NotFoundException('Dealer not found');
    }

    // 1. Sync any posted SalesInvoices that don't have a ledger entry yet
    const postedInvoices = await this.prisma.salesInvoice.findMany({
      where: { dealerId, postingStatus: 'POSTED' },
      include: { dealerLedgerEntries: { select: { id: true } } },
    });
    for (const inv of postedInvoices) {
      if (!inv.dealerLedgerEntries || inv.dealerLedgerEntries.length === 0) {
        await this.prisma.dealerLedgerEntry.create({
          data: {
            organizationId: inv.organizationId,
            companyId: inv.companyId,
            dealerId: inv.dealerId,
            entryType: 'SALE_INVOICE',
            referenceId: inv.id,
            voucherNumber: inv.invoiceNumber,
            description: inv.notes ?? null,
            debit: inv.netAmount,
            credit: 0,
            runningBalance: 0,
            entryDate: inv.invoiceDate ?? inv.postedAt ?? inv.createdAt,
            salesInvoiceId: inv.id,
            sourceType: 'SALE_INVOICE',
            sourceId: inv.id,
            sourceNumber: inv.invoiceNumber,
          },
        });
      }
    }

    // 2. Sync any confirmed/posted DealerPaymentReceipts that don't have a ledger entry yet
    const postedPayments = await this.prisma.dealerPaymentReceipt.findMany({
      where: { dealerId, status: { in: ['POSTED', 'CONFIRMED'] } },
      include: { ledgerEntries: { select: { id: true } } },
    });
    for (const pmt of postedPayments) {
      if (!pmt.ledgerEntries || pmt.ledgerEntries.length === 0) {
        await this.prisma.dealerLedgerEntry.create({
          data: {
            organizationId: pmt.organizationId,
            companyId: pmt.companyId,
            dealerId: pmt.dealerId,
            entryType: 'PAYMENT_RECEIPT',
            referenceId: pmt.id,
            voucherNumber: pmt.receiptNumber,
            description: pmt.notes ?? (pmt.bankName ? `Payment via ${pmt.bankName}` : 'Dealer Payment Receipt'),
            debit: 0,
            credit: pmt.amount,
            runningBalance: 0,
            entryDate: pmt.paymentDate ?? pmt.createdAt,
            dealerPaymentId: pmt.id,
            sourceType: 'PAYMENT_RECEIPT',
            sourceId: pmt.id,
            sourceNumber: pmt.receiptNumber,
          },
        });
      }
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
