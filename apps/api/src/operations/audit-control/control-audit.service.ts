/**
 * SHEHSWAR ONE360 - Enterprise Control & Audit Service
 *
 * Implements centralized auditing and operational control across:
 * - Order Control: Comprehensive status breakdown (Credit Hold, Stock Hold, Pending, Approved, Invoiced)
 * - Sales Audit: Complete end-to-end transaction lifecycle trace
 * - Purchase Audit: Complete procurement lifecycle trace
 * - Payment Audit: Real-time collection & cash/bank audit
 * - Accounting Impact Inspector: Explains exact Dr/Cr journals, ledger balances, and stock changes
 */
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';

@Injectable()
export class ControlAuditService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 1. ORDER CONTROL DASHBOARD & LISTING
   */
  async getOrderControl(companyId: string, filters?: {
    regionId?: string;
    zoneId?: string;
    territoryId?: string;
    salesOfficerId?: string;
    dealerId?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }) {
    const where: any = {};
    if (companyId && companyId !== 'ALL') where.companyId = companyId;

    if (filters?.regionId) where.regionId = filters.regionId;
    if (filters?.zoneId) where.zoneId = filters.zoneId;
    if (filters?.territoryId) where.territoryId = filters.territoryId;
    if (filters?.salesOfficerId) where.salesOfficerId = filters.salesOfficerId;
    if (filters?.dealerId) where.dealerId = filters.dealerId;
    if (filters?.status && filters.status !== 'ALL') where.status = filters.status;

    if (filters?.startDate || filters?.endDate) {
      where.orderDate = {};
      if (filters.startDate) where.orderDate.gte = new Date(filters.startDate);
      if (filters.endDate) {
        const e = new Date(filters.endDate);
        e.setHours(23, 59, 59, 999);
        where.orderDate.lte = e;
      }
    }

    if (filters?.search) {
      where.OR = [
        { orderNumber: { contains: filters.search, mode: 'insensitive' } },
        { dealer: { name: { contains: filters.search, mode: 'insensitive' } } },
      ];
    }

    const [total, orders] = await Promise.all([
      this.prisma.salesOrder.count({ where }),
      this.prisma.salesOrder.findMany({
        where,
        include: {
          dealer: { select: { id: true, name: true, code: true, currentBalance: true, creditLimit: true } },
          salesOfficer: { select: { id: true, firstName: true, lastName: true } },
          territory: { select: { id: true, name: true } },
          zone: { select: { id: true, name: true } },
          region: { select: { id: true, name: true } },
          salesInvoices: { select: { id: true, invoiceNumber: true, postingStatus: true } },
          creditOverrideRequests: { select: { id: true, status: true, exceededAmount: true } },
          _count: { select: { items: true } },
        },
        orderBy: { orderDate: 'desc' },
        take: filters?.limit ?? 50,
        skip: filters?.offset ?? 0,
      }),
    ]);

    // KPI Counts across all orders in scope
    const baseWhere = companyId && companyId !== 'ALL' ? { companyId } : {};
    const [
      totalCount,
      pendingCount,
      approvedCount,
      convertedCount,
      rejectedCount,
    ] = await Promise.all([
      this.prisma.salesOrder.count({ where: baseWhere }),
      this.prisma.salesOrder.count({ where: { ...baseWhere, status: 'PENDING' } }),
      this.prisma.salesOrder.count({ where: { ...baseWhere, status: 'APPROVED' } }),
      this.prisma.salesOrder.count({ where: { ...baseWhere, status: 'CONVERTED_TO_SALE' } }),
      this.prisma.salesOrder.count({ where: { ...baseWhere, status: 'REJECTED' } }),
    ]);

    // Credit hold count = pending orders with credit rejection reason or pending override
    const creditHoldCount = await this.prisma.salesOrder.count({
      where: {
        ...baseWhere,
        OR: [
          { rejectionReason: { contains: 'credit', mode: 'insensitive' } },
          { creditOverrideRequests: { some: { status: 'PENDING' } } },
        ],
      },
    });

    return {
      kpis: {
        total: totalCount,
        pending: pendingCount,
        approved: approvedCount,
        converted: convertedCount,
        rejected: rejectedCount,
        creditHold: creditHoldCount,
      },
      total,
      data: orders,
    };
  }

  /**
   * 2. SALES AUDIT REPORT & LIFECYCLE TRACE
   */
  async getSalesAudit(companyId: string, filters?: {
    regionId?: string;
    zoneId?: string;
    territoryId?: string;
    salesOfficerId?: string;
    dealerId?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
    offset?: number;
  }) {
    const where: any = {};
    if (companyId && companyId !== 'ALL') where.companyId = companyId;

    if (filters?.regionId) where.regionId = filters.regionId;
    if (filters?.zoneId) where.zoneId = filters.zoneId;
    if (filters?.territoryId) where.territoryId = filters.territoryId;
    if (filters?.salesOfficerId) where.salesOfficerId = filters.salesOfficerId;
    if (filters?.dealerId) where.dealerId = filters.dealerId;

    if (filters?.startDate || filters?.endDate) {
      where.invoiceDate = {};
      if (filters.startDate) where.invoiceDate.gte = new Date(filters.startDate);
      if (filters.endDate) {
        const e = new Date(filters.endDate);
        e.setHours(23, 59, 59, 999);
        where.invoiceDate.lte = e;
      }
    }

    const [total, invoices] = await Promise.all([
      this.prisma.salesInvoice.count({ where }),
      this.prisma.salesInvoice.findMany({
        where,
        include: {
          dealer: { select: { id: true, name: true, code: true, currentBalance: true } },
          salesOfficer: { select: { id: true, firstName: true, lastName: true } },
          territory: { select: { id: true, name: true } },
          zone: { select: { id: true, name: true } },
          region: { select: { id: true, name: true } },
          salesOrder: { select: { id: true, orderNumber: true, orderDate: true, status: true, totalAmount: true } },
          stockLedgerEntries: { select: { id: true, itemType: true, quantityChange: true, createdAt: true } },
          dealerLedgerEntries: { select: { id: true, debit: true, credit: true, runningBalance: true } },
          items: { select: { id: true, productName: true, quantity: true, rate: true, netAmount: true } },
        },
        orderBy: { invoiceDate: 'desc' },
        take: filters?.limit ?? 50,
        skip: filters?.offset ?? 0,
      }),
    ]);

    return { total, data: invoices };
  }

  /**
   * 3. PURCHASE AUDIT & PROCUREMENT TRACE
   */
  async getPurchaseAudit(companyId: string, filters?: {
    vendorId?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
  }) {
    const where: any = {};
    if (companyId && companyId !== 'ALL') where.companyId = companyId;
    if (filters?.vendorId) where.vendorId = filters.vendorId;

    if (filters?.startDate || filters?.endDate) {
      where.date = {};
      if (filters.startDate) where.date.gte = new Date(filters.startDate);
      if (filters.endDate) {
        const e = new Date(filters.endDate);
        e.setHours(23, 59, 59, 999);
        where.date.lte = e;
      }
    }

    const purchases = await this.prisma.purchaseInvoice.findMany({
      where,
      include: {
        vendor: { select: { id: true, name: true, code: true } },
        warehouse: { select: { id: true, name: true } },
        stockLedgerEntries: { select: { id: true, quantityChange: true, itemType: true } },
        vendorLedgerEntries: { select: { id: true, credit: true, runningBalance: true } },
        items: true,
      },
      orderBy: { date: 'desc' },
      take: filters?.limit ?? 50,
    });

    return purchases;
  }

  /**
   * 4. PAYMENT & COLLECTION AUDIT
   */
  async getPaymentAudit(companyId: string, filters?: {
    dealerId?: string;
    salesOfficerId?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
  }) {
    const where: any = {};
    if (companyId && companyId !== 'ALL') where.companyId = companyId;
    if (filters?.dealerId) where.dealerId = filters.dealerId;
    if (filters?.salesOfficerId) where.salesOfficerId = filters.salesOfficerId;

    if (filters?.startDate || filters?.endDate) {
      where.paymentDate = {};
      if (filters.startDate) where.paymentDate.gte = new Date(filters.startDate);
      if (filters.endDate) {
        const e = new Date(filters.endDate);
        e.setHours(23, 59, 59, 999);
        where.paymentDate.lte = e;
      }
    }

    const payments = await this.prisma.dealerPaymentReceipt.findMany({
      where,
      include: {
        dealer: { select: { id: true, name: true, code: true, currentBalance: true } },
        salesOfficer: { select: { id: true, firstName: true, lastName: true } },
        ledgerEntries: true,
      },
      orderBy: { paymentDate: 'desc' },
      take: filters?.limit ?? 50,
    });

    return payments;
  }

  /**
   * 5. VIEW COMPLETE ACCOUNTING IMPACT FOR AUDITORS
   * Given any Invoice, Payment, or Purchase ID, reveals the exact Dr/Cr Journal,
   * Dealer/Vendor balance impact, Stock movement, and Credit impact.
   */
  async getTransactionAccountingImpact(sourceType: string, sourceId: string) {
    // 1. Locate Journal Entry
    const journal = await this.prisma.journalEntry.findFirst({
      where: {
        sourceId,
      },
      include: {
        lines: {
          include: {
            account: true,
          },
        },
      },
    });

    // 2. Locate Source Details
    let sourceRecord: any = null;
    let stockEntries: any[] = [];
    let ledgerEntries: any[] = [];

    if (sourceType === 'SALES_INVOICE' || sourceType === 'INVOICE') {
      sourceRecord = await this.prisma.salesInvoice.findUnique({
        where: { id: sourceId },
        include: {
          dealer: { select: { id: true, name: true, code: true, currentBalance: true, creditLimit: true } },
          salesOfficer: { select: { id: true, firstName: true, lastName: true } },
          salesOrder: { select: { id: true, orderNumber: true } },
          items: true,
        },
      });

      stockEntries = await this.prisma.stockLedgerEntry.findMany({
        where: { referenceId: sourceId },
      });

      ledgerEntries = await this.prisma.dealerLedgerEntry.findMany({
        where: { salesInvoiceId: sourceId },
      });
    } else if (sourceType === 'PURCHASE_INVOICE' || sourceType === 'PURCHASE') {
      sourceRecord = await this.prisma.purchaseInvoice.findUnique({
        where: { id: sourceId },
        include: {
          vendor: { select: { id: true, name: true, code: true } },
          items: true,
        },
      });

      stockEntries = await this.prisma.stockLedgerEntry.findMany({
        where: { referenceId: sourceId },
      });

      ledgerEntries = await this.prisma.vendorLedgerEntry.findMany({
        where: { purchaseInvoiceId: sourceId },
      });
    } else if (sourceType === 'DEALER_PAYMENT' || sourceType === 'PAYMENT') {
      sourceRecord = await this.prisma.dealerPaymentReceipt.findUnique({
        where: { id: sourceId },
        include: {
          dealer: { select: { id: true, name: true, code: true, currentBalance: true } },
        },
      });

      ledgerEntries = await this.prisma.dealerLedgerEntry.findMany({
        where: { dealerPaymentId: sourceId },
      });
    }

    if (!sourceRecord && !journal) {
      throw new NotFoundException('Transaction record not found');
    }

    return {
      sourceType,
      sourceId,
      sourceRecord,
      journalEntry: journal,
      stockMovement: stockEntries,
      ledgerImpact: ledgerEntries,
    };
  }
}
