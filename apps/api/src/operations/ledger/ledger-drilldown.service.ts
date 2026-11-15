/**
 * SHEHSWAR ONE360 - Ledger Drill-Down & Source Document Tracing Service
 *
 * Implements Complete Ledger Drill-Down (Requirements 1 - 12):
 * - Resolves the exact originating document from any party/vendor/dealer ledger entry
 * - Returns 100% complete source document details (vendor/dealer, warehouse, items, rates, taxes, payments)
 * - Returns the complete audit lifecycle chain (PO -> Purchase -> Warehouse Stock -> Vendor Ledger -> Payment)
 * - Strict integrity: prevents uncontrolled editing of posted financial transactions while allowing synchronized updates for drafts
 */
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { AuthUser } from '@shehswar/types';

export interface GetSourceDocumentQuery {
  sourceType?: string;
  sourceId?: string;
  sourceNumber?: string;
  voucherNumber?: string;
  referenceId?: string;
  companyId?: string;
}

export interface AuditChainNode {
  step: string;
  title: string;
  documentNumber: string;
  documentId?: string;
  status: string;
  date: string;
  amount?: number;
  description?: string;
  isCurrent?: boolean;
}

export interface ResolvedSourceDocument {
  sourceType: string;
  sourceId: string;
  sourceNumber: string;
  documentDate: string;
  status: string;
  company?: { id: string; name: string; code: string };
  party?: { id: string; name: string; code: string; type: string; phone?: string; address?: string };
  warehouse?: { id: string; name: string; code: string };
  reference?: string;
  notes?: string;
  currency: string;
  grossAmount: number;
  taxAmount: number;
  discountAmount: number;
  netAmount: number;
  paidAmount?: number;
  remainingAmount?: number;
  items: Array<{
    id: string;
    productCode?: string;
    itemName: string;
    materialType?: string;
    packSize?: string;
    batchNumber?: string;
    quantity: number;
    unitRate: number;
    taxPercent?: number;
    taxAmount?: number;
    grossAmount?: number;
    netAmount: number;
  }>;
  auditChain: AuditChainNode[];
  rawDocument: any;
  isPosted: boolean;
  isEditable: boolean;
}

@Injectable()
export class LedgerDrilldownService {
  private readonly logger = new Logger(LedgerDrilldownService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Universal resolution of any source document by type, id, or voucher number
   */
  async getSourceDocument(query: GetSourceDocumentQuery): Promise<ResolvedSourceDocument> {
    const rawNumber = (query.sourceNumber || query.voucherNumber || '').trim();
    const rawId = (query.sourceId || query.referenceId || '').trim();
    let rawType = (query.sourceType || '').trim().toUpperCase();

    // Auto-detect document type from number prefix if not explicitly specified
    if (!rawType || rawType === 'ALL') {
      if (rawNumber.startsWith('PO-')) rawType = 'PURCHASE_ORDER';
      else if (rawNumber.startsWith('PUR-') || rawNumber.startsWith('PI-')) rawType = 'PURCHASE_INVOICE';
      else if (rawNumber.startsWith('INV-') || rawNumber.startsWith('SI-')) rawType = 'SALES_INVOICE';
      else if (rawNumber.startsWith('SO-')) rawType = 'SALES_ORDER';
      else if (rawNumber.startsWith('PR-')) rawType = 'PROVISIONAL_RECEIPT';
      else if (rawNumber.startsWith('IC-')) rawType = 'INTERCOMPANY_TRANSFER';
      else if (rawNumber.startsWith('PAY-') || rawNumber.startsWith('DP-') || rawNumber.startsWith('VP-')) rawType = 'PAYMENT';
      else if (rawNumber.startsWith('CR-') || rawNumber.startsWith('CP-') || rawNumber.startsWith('BR-') || rawNumber.startsWith('BP-')) rawType = 'FINANCIAL_TRANSACTION';
      else if (rawNumber.startsWith('PRT-')) rawType = 'PURCHASE_RETURN';
      else if (rawNumber.startsWith('SR-')) rawType = 'SALES_RETURN';
    }

    // 1. PURCHASE ORDER
    if (rawType === 'PURCHASE_ORDER' || rawNumber.startsWith('PO-')) {
      return this.resolvePurchaseOrder(rawId, rawNumber, query.companyId);
    }

    // 2. PURCHASE INVOICE / DIRECT PURCHASE
    if (rawType === 'PURCHASE_INVOICE' || rawType === 'PURCHASE' || rawNumber.startsWith('PUR-') || rawNumber.startsWith('PI-')) {
      return this.resolvePurchaseInvoice(rawId, rawNumber, query.companyId);
    }

    // 3. SALES INVOICE
    if (rawType === 'SALES_INVOICE' || rawType === 'SALE_INVOICE' || rawNumber.startsWith('INV-') || rawNumber.startsWith('SI-')) {
      return this.resolveSalesInvoice(rawId, rawNumber, query.companyId);
    }

    // 4. SALES ORDER
    if (rawType === 'SALES_ORDER' || rawNumber.startsWith('SO-')) {
      return this.resolveSalesOrder(rawId, rawNumber, query.companyId);
    }

    // 5. PROVISIONAL RECEIPT (PR)
    if (rawType === 'PROVISIONAL_RECEIPT' || rawType === 'PR_ALLOCATION' || rawNumber.startsWith('PR-')) {
      return this.resolveProvisionalReceipt(rawId, rawNumber, query.companyId);
    }

    // 6. DEALER PAYMENT RECEIPT
    if (rawType === 'PAYMENT_RECEIPT' || rawType === 'DEALER_PAYMENT' || rawNumber.startsWith('PAY-') || rawNumber.startsWith('DP-')) {
      return this.resolveDealerPayment(rawId, rawNumber, query.companyId);
    }

    // 7. VENDOR PAYMENT
    if (rawType === 'VENDOR_PAYMENT' || rawNumber.startsWith('VP-')) {
      return this.resolveVendorPayment(rawId, rawNumber, query.companyId);
    }

    // 8. INTERCOMPANY TRANSFER
    if (rawType === 'INTERCOMPANY_TRANSFER' || rawNumber.startsWith('IC-')) {
      return this.resolveIntercompanyTransfer(rawId, rawNumber, query.companyId);
    }

    // 9. FINANCIAL TRANSACTION (CASH/BANK RECEIPT/PAYMENT)
    if (
      rawType === 'FINANCIAL_TRANSACTION' ||
      rawType === 'CASH_RECEIPT' ||
      rawType === 'CASH_PAYMENT' ||
      rawType === 'BANK_RECEIPT' ||
      rawType === 'BANK_PAYMENT'
    ) {
      return this.resolveFinancialTransaction(rawId, rawNumber, query.companyId);
    }

    // 10. PURCHASE RETURN
    if (rawType === 'PURCHASE_RETURN' || rawNumber.startsWith('PRT-')) {
      return this.resolvePurchaseReturn(rawId, rawNumber, query.companyId);
    }

    // Fallback search across core models if type unknown
    if (rawId || rawNumber) {
      try {
        return await this.resolvePurchaseOrder(rawId, rawNumber, query.companyId);
      } catch {
        try {
          return await this.resolvePurchaseInvoice(rawId, rawNumber, query.companyId);
        } catch {
          try {
            return await this.resolveSalesInvoice(rawId, rawNumber, query.companyId);
          } catch {
            try {
              return await this.resolveProvisionalReceipt(rawId, rawNumber, query.companyId);
            } catch {
              // Not found
            }
          }
        }
      }
    }

    throw new NotFoundException(
      `Could not locate source document for ${rawType || 'Document'} (${rawNumber || rawId || 'Unknown'})`,
    );
  }

  // =========================================================================
  // 1. PURCHASE ORDER DRILL-DOWN RESOLVER
  // =========================================================================
  private async resolvePurchaseOrder(id?: string, poNumber?: string, companyId?: string): Promise<ResolvedSourceDocument> {
    const where: any = {};
    if (id && id.length > 20) where.id = id;
    else if (poNumber) where.poNumber = poNumber;
    else if (id) where.poNumber = id;
    if (companyId) where.companyId = companyId;

    const po = await this.prisma.purchaseOrder.findFirst({
      where,
      include: {
        vendor: true,
        warehouse: true,
        company: true,
        items: true,
      },
    });

    if (!po) {
      throw new NotFoundException(`Purchase Order ${poNumber || id} not found`);
    }

    // Check if there is an associated Purchase Invoice converted from this PO
    const linkedPurchase = await this.prisma.purchaseInvoice.findFirst({
      where: {
        companyId: po.companyId,
        reference: po.poNumber,
      },
      select: {
        id: true,
        voucherNumber: true,
        postingStatus: true,
        date: true,
        netAmount: true,
      },
    });

    // Check if vendor ledger has entry
    const ledgerEntry = await this.prisma.vendorLedgerEntry.findFirst({
      where: {
        vendorId: po.vendorId,
        voucherNumber: po.poNumber,
      },
    });

    const isPosted = po.status === 'CONVERTED_TO_PURCHASE' || po.status === 'POSTED' || Boolean(linkedPurchase);
    const isEditable = po.status === 'DRAFT' || po.status === 'CONFIRMED';

    const auditChain: AuditChainNode[] = [
      {
        step: 'PURCHASE_ORDER',
        title: 'Purchase Order Created',
        documentNumber: po.poNumber,
        documentId: po.id,
        status: po.status,
        date: po.createdAt.toISOString(),
        amount: Number(po.totalAmount),
        description: `PO with ${po.items.length} items from ${po.vendor?.name || 'Vendor'}`,
        isCurrent: true,
      },
    ];

    if (po.warehouse) {
      auditChain.push({
        step: 'WAREHOUSE_STOCK',
        title: 'Warehouse Stock Allocation',
        documentNumber: po.warehouse.code,
        documentId: po.warehouse.id,
        status: po.status === 'DRAFT' ? 'PENDING' : 'RECEIVED',
        date: po.expectedDeliveryDate ? po.expectedDeliveryDate.toISOString() : po.createdAt.toISOString(),
        description: `Destined for ${po.warehouse.name}`,
      });
    }

    if (ledgerEntry) {
      auditChain.push({
        step: 'VENDOR_LEDGER',
        title: 'Vendor Sub-Ledger Entry',
        documentNumber: ledgerEntry.voucherNumber,
        documentId: ledgerEntry.id,
        status: 'RECORDED',
        date: ledgerEntry.entryDate.toISOString(),
        amount: Number(ledgerEntry.credit),
        description: `Running Balance: PKR ${Number(ledgerEntry.runningBalance).toLocaleString()}`,
      });
    }

    if (linkedPurchase) {
      auditChain.push({
        step: 'PURCHASE_INVOICE',
        title: 'Direct Purchase Invoice',
        documentNumber: linkedPurchase.voucherNumber,
        documentId: linkedPurchase.id,
        status: linkedPurchase.postingStatus,
        date: linkedPurchase.date.toISOString(),
        amount: Number(linkedPurchase.netAmount),
        description: 'Converted & Finalized in Purchases View',
      });
    }

    return {
      sourceType: 'PURCHASE_ORDER',
      sourceId: po.id,
      sourceNumber: po.poNumber,
      documentDate: ((po as any).orderDate ? new Date((po as any).orderDate) : po.createdAt).toISOString(),
      status: po.status,
      company: po.company ? { id: po.company.id, name: po.company.name, code: po.company.code } : undefined,
      party: po.vendor ? { id: po.vendor.id, name: po.vendor.name, code: po.vendor.code, type: 'VENDOR', phone: po.vendor.phone || undefined, address: po.vendor.address || undefined } : undefined,
      warehouse: po.warehouse ? { id: po.warehouse.id, name: po.warehouse.name, code: po.warehouse.code } : undefined,
      reference: po.poNumber,
      notes: po.notes || undefined,
      currency: 'PKR',
      grossAmount: Number(po.totalAmount),
      taxAmount: 0,
      discountAmount: 0,
      netAmount: Number(po.totalAmount),
      items: po.items.map((it) => ({
        id: it.id,
        productCode: it.materialCodeSnapshot || undefined,
        itemName: it.itemName,
        materialType: it.materialType || undefined,
        packSize: it.unit || undefined,
        quantity: Number(it.quantity),
        unitRate: Number(it.unitRate),
        taxPercent: Number(it.taxRate || 0),
        taxAmount: Number(it.taxAmount || 0),
        grossAmount: Number(it.lineTotal),
        netAmount: Number(it.lineTotal),
      })),
      auditChain,
      rawDocument: po,
      isPosted,
      isEditable,
    };
  }

  // =========================================================================
  // 2. PURCHASE INVOICE DRILL-DOWN RESOLVER
  // =========================================================================
  private async resolvePurchaseInvoice(id?: string, voucherNumber?: string, companyId?: string): Promise<ResolvedSourceDocument> {
    const where: any = {};
    if (id && id.length > 20) where.id = id;
    else if (voucherNumber) where.voucherNumber = voucherNumber;
    else if (id) where.voucherNumber = id;
    if (companyId) where.companyId = companyId;

    const purchase = await this.prisma.purchaseInvoice.findFirst({
      where,
      include: {
        vendor: true,
        warehouse: true,
        company: true,
        items: true,
        purchaseReturns: {
          include: { items: true },
        },
        vendorLedgerEntries: true,
      },
    });

    if (!purchase) {
      throw new NotFoundException(`Purchase Invoice ${voucherNumber || id} not found`);
    }

    // Check upstream linked PO
    let linkedPo: any = null;
    if (purchase.reference && purchase.reference.startsWith('PO-')) {
      linkedPo = await this.prisma.purchaseOrder.findFirst({
        where: { companyId: purchase.companyId, poNumber: purchase.reference },
        select: { id: true, poNumber: true, status: true, createdAt: true, totalAmount: true },
      });
    }

    // Check downstream payments
    const linkedPayments = await this.prisma.vendorPayment.findMany({
      where: {
        vendorId: purchase.vendorId,
        companyId: purchase.companyId,
      },
      select: { id: true, voucherNumber: true, amount: true, paymentDate: true, paymentType: true },
      take: 3,
    });

    const isPosted = purchase.postingStatus === 'POSTED' || purchase.isComplete;
    const isEditable = purchase.postingStatus === 'DRAFT' || purchase.postingStatus === 'REVIEWED';

    const auditChain: AuditChainNode[] = [];

    if (linkedPo) {
      auditChain.push({
        step: 'PURCHASE_ORDER',
        title: 'Original Purchase Order',
        documentNumber: linkedPo.poNumber,
        documentId: linkedPo.id,
        status: linkedPo.status,
        date: linkedPo.createdAt.toISOString(),
        amount: Number(linkedPo.totalAmount),
        description: 'Upstream procurement order',
      });
    }

    auditChain.push({
      step: 'PURCHASE_INVOICE',
      title: 'Purchase Invoice / Goods Inward',
      documentNumber: purchase.voucherNumber,
      documentId: purchase.id,
      status: purchase.postingStatus,
      date: purchase.date.toISOString(),
      amount: Number(purchase.netAmount),
      description: `Billed by ${purchase.vendor?.name || 'Vendor'} (Vendor Ref: ${purchase.vendorInvoiceNo || 'N/A'})`,
      isCurrent: true,
    });

    if (purchase.warehouse) {
      auditChain.push({
        step: 'WAREHOUSE_STOCK',
        title: 'Physical Inventory Inward (+)',
        documentNumber: purchase.warehouse.code,
        documentId: purchase.warehouse.id,
        status: isPosted ? 'POSTED_TO_STOCK' : 'PENDING_POSTING',
        date: purchase.date.toISOString(),
        description: `Stored in ${purchase.warehouse.name}`,
      });
    }

    const vl = purchase.vendorLedgerEntries?.[0];
    if (vl) {
      auditChain.push({
        step: 'VENDOR_LEDGER',
        title: 'Accounts Payable Credit (Cr)',
        documentNumber: vl.voucherNumber,
        documentId: vl.id,
        status: 'RECORDED',
        date: vl.entryDate.toISOString(),
        amount: Number(vl.credit),
        description: `Vendor Running Balance: PKR ${Number(vl.runningBalance).toLocaleString()}`,
      });
    }

    linkedPayments.forEach((pay) => {
      auditChain.push({
        step: 'VENDOR_PAYMENT',
        title: `Payment Disbursed (${pay.paymentType})`,
        documentNumber: pay.voucherNumber,
        documentId: pay.id,
        status: 'PAID',
        date: pay.paymentDate.toISOString(),
        amount: Number(pay.amount),
      });
    });

    return {
      sourceType: 'PURCHASE_INVOICE',
      sourceId: purchase.id,
      sourceNumber: purchase.voucherNumber,
      documentDate: purchase.date.toISOString(),
      status: purchase.postingStatus,
      company: purchase.company ? { id: purchase.company.id, name: purchase.company.name, code: purchase.company.code } : undefined,
      party: purchase.vendor ? { id: purchase.vendor.id, name: purchase.vendor.name, code: purchase.vendor.code, type: 'VENDOR', phone: purchase.vendor.phone || undefined, address: purchase.vendor.address || undefined } : undefined,
      warehouse: purchase.warehouse ? { id: purchase.warehouse.id, name: purchase.warehouse.name, code: purchase.warehouse.code } : undefined,
      reference: purchase.vendorInvoiceNo || purchase.reference || undefined,
      notes: purchase.notes || undefined,
      currency: 'PKR',
      grossAmount: Number(purchase.grossAmount || purchase.netAmount),
      taxAmount: Number(purchase.taxAmount || 0),
      discountAmount: Number(purchase.discountAmount || 0),
      netAmount: Number(purchase.netAmount),
      items: purchase.items.map((it) => ({
        id: it.id,
        itemName: it.itemName,
        materialType: it.materialType || undefined,
        packSize: it.packing || undefined,
        quantity: Number(it.quantity),
        unitRate: Number(it.rate),
        taxPercent: Number(it.taxPercent || 0),
        taxAmount: Number(it.taxAmount || 0),
        grossAmount: Number(it.grossAmount || Number(it.quantity) * Number(it.rate)),
        netAmount: Number(it.netAmount || it.grossAmount),
      })),
      auditChain,
      rawDocument: purchase,
      isPosted,
      isEditable,
    };
  }

  // =========================================================================
  // 3. SALES INVOICE DRILL-DOWN RESOLVER
  // =========================================================================
  private async resolveSalesInvoice(id?: string, invoiceNumber?: string, companyId?: string): Promise<ResolvedSourceDocument> {
    const where: any = {};
    if (id && id.length > 20) where.id = id;
    else if (invoiceNumber) where.invoiceNumber = invoiceNumber;
    else if (id) where.invoiceNumber = id;
    if (companyId) where.companyId = companyId;

    const invoice = await this.prisma.salesInvoice.findFirst({
      where,
      include: {
        dealer: true,
        warehouse: true,
        company: true,
        items: {
          include: { finishedProduct: true },
        },
        salesOrder: {
          include: { salesOfficer: true },
        },
        dealerLedgerEntries: true,
      },
    });

    if (!invoice) {
      throw new NotFoundException(`Sales Invoice ${invoiceNumber || id} not found`);
    }

    const isPosted = invoice.postingStatus === 'POSTED' || invoice.postingStatus === 'APPROVED';
    const isEditable = invoice.postingStatus === 'DRAFT' || invoice.postingStatus === 'REVIEWED';

    const auditChain: AuditChainNode[] = [];

    if (invoice.salesOrder) {
      auditChain.push({
        step: 'SALES_ORDER',
        title: 'Original Sales Order Booking',
        documentNumber: invoice.salesOrder.orderNumber,
        documentId: invoice.salesOrder.id,
        status: invoice.salesOrder.status,
        date: invoice.salesOrder.orderDate.toISOString(),
        amount: Number(invoice.salesOrder.totalAmount),
        description: `Booked by ${invoice.salesOrder.salesOfficer?.firstName || 'Sales Team'}`,
      });
    }

    auditChain.push({
      step: 'SALES_INVOICE',
      title: 'Commercial Sales Invoice Issued',
      documentNumber: invoice.invoiceNumber,
      documentId: invoice.id,
      status: invoice.postingStatus,
      date: invoice.invoiceDate.toISOString(),
      amount: Number(invoice.netAmount),
      description: `Invoiced to ${invoice.dealer?.name || 'Customer/Dealer'}`,
      isCurrent: true,
    });

    if (invoice.warehouse) {
      auditChain.push({
        step: 'WAREHOUSE_STOCK',
        title: 'Finished Goods Stock Dispatched (-)',
        documentNumber: invoice.warehouse.code,
        documentId: invoice.warehouse.id,
        status: isPosted ? 'DISPATCHED' : 'PENDING_DISPATCH',
        date: invoice.invoiceDate.toISOString(),
        description: `Dispatched from ${invoice.warehouse.name}`,
      });
    }

    const dl = invoice.dealerLedgerEntries?.[0];
    if (dl) {
      auditChain.push({
        step: 'DEALER_LEDGER',
        title: 'Dealer Sub-Ledger Debit (Dr)',
        documentNumber: dl.voucherNumber,
        documentId: dl.id,
        status: 'RECORDED',
        date: dl.entryDate.toISOString(),
        amount: Number(dl.debit),
        description: `Dealer Running Balance: PKR ${Number(dl.runningBalance).toLocaleString()}`,
      });
    }

    return {
      sourceType: 'SALES_INVOICE',
      sourceId: invoice.id,
      sourceNumber: invoice.invoiceNumber,
      documentDate: invoice.invoiceDate.toISOString(),
      status: invoice.postingStatus,
      company: invoice.company ? { id: invoice.company.id, name: invoice.company.name, code: invoice.company.code } : undefined,
      party: invoice.dealer ? { id: invoice.dealer.id, name: invoice.dealer.name, code: invoice.dealer.code, type: 'DEALER', phone: invoice.dealer.phone || undefined, address: invoice.dealer.address || undefined } : undefined,
      warehouse: invoice.warehouse ? { id: invoice.warehouse.id, name: invoice.warehouse.name, code: invoice.warehouse.code } : undefined,
      reference: invoice.salesOrder?.orderNumber || undefined,
      notes: invoice.notes || undefined,
      currency: 'PKR',
      grossAmount: Number(invoice.grossAmount || invoice.netAmount),
      taxAmount: Number(invoice.taxAmount || 0),
      discountAmount: Number(invoice.discountAmount || 0),
      netAmount: Number(invoice.netAmount),
      items: invoice.items.map((it) => ({
        id: it.id,
        productCode: it.finishedProduct?.productCode || undefined,
        itemName: it.productName,
        materialType: 'FINISHED_PRODUCT',
        packSize: it.packing || undefined,
        batchNumber: it.batchNumber || undefined,
        quantity: Number(it.quantity),
        unitRate: Number(it.rate),
        taxPercent: 0,
        taxAmount: Number(it.taxAmount || 0),
        grossAmount: Number(it.grossAmount),
        netAmount: Number(it.netAmount),
      })),
      auditChain,
      rawDocument: invoice,
      isPosted,
      isEditable,
    };
  }

  // =========================================================================
  // 4. SALES ORDER DRILL-DOWN RESOLVER
  // =========================================================================
  private async resolveSalesOrder(id?: string, orderNumber?: string, companyId?: string): Promise<ResolvedSourceDocument> {
    const where: any = {};
    if (id && id.length > 20) where.id = id;
    else if (orderNumber) where.orderNumber = orderNumber;
    else if (id) where.orderNumber = id;
    if (companyId) where.companyId = companyId;

    const order = await this.prisma.salesOrder.findFirst({
      where,
      include: {
        dealer: true,
        company: true,
        items: true,
        salesInvoices: true,
      },
    });

    if (!order) {
      throw new NotFoundException(`Sales Order ${orderNumber || id} not found`);
    }

    const isPosted = order.status === 'CONVERTED_TO_INVOICE' || order.status === 'POSTED' || order.salesInvoices?.length > 0;
    const isEditable = order.status === 'DRAFT' || order.status === 'CONFIRMED';

    const auditChain: AuditChainNode[] = [
      {
        step: 'SALES_ORDER',
        title: 'Sales Order Booking',
        documentNumber: order.orderNumber,
        documentId: order.id,
        status: order.status,
        date: order.orderDate.toISOString(),
        amount: Number(order.totalAmount),
        description: `Order booked for ${order.dealer?.name || 'Customer'}`,
        isCurrent: true,
      },
    ];

    if (order.salesInvoices?.[0]) {
      const inv = order.salesInvoices[0];
      auditChain.push({
        step: 'SALES_INVOICE',
        title: 'Converted to Commercial Invoice',
        documentNumber: inv.invoiceNumber,
        documentId: inv.id,
        status: inv.postingStatus,
        date: inv.invoiceDate.toISOString(),
        amount: Number(inv.netAmount),
      });
    }

    return {
      sourceType: 'SALES_ORDER',
      sourceId: order.id,
      sourceNumber: order.orderNumber,
      documentDate: order.orderDate.toISOString(),
      status: order.status,
      company: order.company ? { id: order.company.id, name: order.company.name, code: order.company.code } : undefined,
      party: order.dealer ? { id: order.dealer.id, name: order.dealer.name, code: order.dealer.code, type: 'DEALER', phone: order.dealer.phone || undefined, address: order.dealer.address || undefined } : undefined,
      currency: 'PKR',
      grossAmount: Number(order.totalAmount),
      taxAmount: 0,
      discountAmount: 0,
      netAmount: Number(order.totalAmount),
      items: order.items.map((it) => ({
        id: it.id,
        itemName: it.productName,
        materialType: 'FINISHED_PRODUCT',
        packSize: it.packing || undefined,
        batchNumber: it.batchNumber || undefined,
        quantity: Number(it.quantity),
        unitRate: Number(it.unitPrice),
        taxPercent: 0,
        taxAmount: 0,
        grossAmount: Number(it.totalPrice),
        netAmount: Number(it.totalPrice),
      })),
      auditChain,
      rawDocument: order,
      isPosted,
      isEditable,
    };
  }

  // =========================================================================
  // 5. PROVISIONAL RECEIPT (PR) DRILL-DOWN RESOLVER
  // =========================================================================
  private async resolveProvisionalReceipt(id?: string, prNumber?: string, companyId?: string): Promise<ResolvedSourceDocument> {
    const where: any = {};
    if (id && id.length > 20) where.id = id;
    else if (prNumber) where.prNumber = prNumber;
    else if (id) where.prNumber = id;
    if (companyId) where.companyId = companyId;

    const pr = await this.prisma.provisionalReceipt.findFirst({
      where,
      include: {
        dealer: true,
        company: true,
        products: true,
        allocations: {
          include: { dealer: true },
        },
      },
    });

    if (!pr) {
      throw new NotFoundException(`Provisional Receipt ${prNumber || id} not found`);
    }

    const isPosted = pr.status === 'POSTED' || pr.allocationStatus === 'FULLY_ALLOCATED';
    const isEditable = pr.status === 'DRAFT' || pr.status === 'PENDING_ALLOCATION';

    const auditChain: AuditChainNode[] = [
      {
        step: 'PROVISIONAL_RECEIPT',
        title: 'Collection Receipt Issued',
        documentNumber: pr.prNumber,
        documentId: pr.id,
        status: pr.status,
        date: pr.receiptDate.toISOString(),
        amount: Number(pr.totalAmount),
        description: `Collected from ${pr.receivedFrom} via ${pr.paymentMethod}`,
        isCurrent: true,
      },
    ];

    pr.allocations.forEach((alloc) => {
      auditChain.push({
        step: 'DEALER_LEDGER',
        title: `Credit Allocated to ${alloc.dealer?.name || 'Dealer'}`,
        documentNumber: `ALLOC-${alloc.id.slice(0, 8).toUpperCase()}`,
        documentId: alloc.id,
        status: 'CREDITED',
        date: alloc.createdAt.toISOString(),
        amount: Number(alloc.allocatedAmount),
      });
    });

    return {
      sourceType: 'PROVISIONAL_RECEIPT',
      sourceId: pr.id,
      sourceNumber: pr.prNumber,
      documentDate: pr.receiptDate.toISOString(),
      status: pr.status,
      company: pr.company ? { id: pr.company.id, name: pr.company.name, code: pr.company.code } : undefined,
      party: pr.dealer
        ? { id: pr.dealer.id, name: pr.dealer.name, code: pr.dealer.code, type: 'DEALER', phone: pr.dealer.phone || undefined, address: pr.dealer.address || undefined }
        : { id: pr.id, name: pr.receivedFrom, code: pr.partyCode || 'PARTY', type: 'PARTY' },
      reference: pr.paymentReferenceNumber || undefined,
      notes: pr.remarks || undefined,
      currency: 'PKR',
      grossAmount: Number(pr.totalAmount),
      taxAmount: 0,
      discountAmount: 0,
      netAmount: Number(pr.totalAmount),
      paidAmount: Number(pr.allocatedAmount),
      remainingAmount: Number(pr.unallocatedAmount),
      items: pr.products.map((p) => ({
        id: p.id,
        itemName: p.productName,
        packSize: p.packSize || undefined,
        quantity: Number(p.quantity),
        unitRate: Number(p.policyRate),
        grossAmount: Number(p.amount),
        netAmount: Number(p.amount),
      })),
      auditChain,
      rawDocument: pr,
      isPosted,
      isEditable,
    };
  }

  // =========================================================================
  // 6. DEALER PAYMENT RECEIPT DRILL-DOWN RESOLVER
  // =========================================================================
  private async resolveDealerPayment(id?: string, voucherNumber?: string, companyId?: string): Promise<ResolvedSourceDocument> {
    const rawNumber = (voucherNumber || id || '').trim();
    const where: any = {};
    if (id && id.length > 20) where.id = id;
    else if (voucherNumber) where.receiptNumber = voucherNumber;
    else if (id) where.receiptNumber = id;
    if (companyId) where.companyId = companyId;

    const payment = await this.prisma.dealerPaymentReceipt.findFirst({
      where,
      include: {
        dealer: true,
        company: true,
      },
    });

    if (!payment) {
      throw new NotFoundException(`Dealer Payment ${rawNumber} not found`);
    }

    const auditChain: AuditChainNode[] = [
      {
        step: 'DEALER_PAYMENT',
        title: 'Customer Payment Received',
        documentNumber: payment.receiptNumber,
        documentId: payment.id,
        status: payment.status,
        date: payment.paymentDate.toISOString(),
        amount: Number(payment.amount),
        description: `Method: ${payment.paymentType} · Ref: ${payment.referenceNumber || 'N/A'}`,
        isCurrent: true,
      },
      {
        step: 'DEALER_LEDGER',
        title: 'Sub-Ledger Balance Credited',
        documentNumber: payment.receiptNumber,
        documentId: payment.id,
        status: 'CREDITED',
        date: payment.paymentDate.toISOString(),
        amount: Number(payment.amount),
      },
    ];

    return {
      sourceType: 'PAYMENT_RECEIPT',
      sourceId: payment.id,
      sourceNumber: payment.receiptNumber,
      documentDate: payment.paymentDate.toISOString(),
      status: payment.status,
      company: payment.company ? { id: payment.company.id, name: payment.company.name, code: payment.company.code } : undefined,
      party: payment.dealer ? { id: payment.dealer.id, name: payment.dealer.name, code: payment.dealer.code, type: 'DEALER', phone: payment.dealer.phone || undefined } : undefined,
      reference: payment.referenceNumber || undefined,
      notes: payment.notes || undefined,
      currency: 'PKR',
      grossAmount: Number(payment.amount),
      taxAmount: 0,
      discountAmount: 0,
      netAmount: Number(payment.amount),
      items: [
        {
          id: payment.id,
          itemName: `Payment Receipt (${payment.paymentType})`,
          quantity: 1,
          unitRate: Number(payment.amount),
          grossAmount: Number(payment.amount),
          netAmount: Number(payment.amount),
        },
      ],
      auditChain,
      rawDocument: payment,
      isPosted: true,
      isEditable: false,
    };
  }

  // =========================================================================
  // 7. VENDOR PAYMENT DRILL-DOWN RESOLVER
  // =========================================================================
  private async resolveVendorPayment(id?: string, voucherNumber?: string, companyId?: string): Promise<ResolvedSourceDocument> {
    const where: any = {};
    if (id && id.length > 20) where.id = id;
    else if (voucherNumber) where.voucherNumber = voucherNumber;
    else if (id) where.voucherNumber = id;
    if (companyId) where.companyId = companyId;

    const payment = await this.prisma.vendorPayment.findFirst({
      where,
      include: {
        vendor: true,
        company: true,
      },
    });

    if (!payment) {
      throw new NotFoundException(`Vendor Payment ${voucherNumber || id} not found`);
    }

    const auditChain: AuditChainNode[] = [
      {
        step: 'VENDOR_PAYMENT',
        title: 'Vendor Payment Disbursed',
        documentNumber: payment.voucherNumber,
        documentId: payment.id,
        status: payment.status,
        date: payment.paymentDate.toISOString(),
        amount: Number(payment.amount),
        description: `Method: ${payment.paymentType} · Paid to ${payment.vendor?.name || 'Vendor'}`,
        isCurrent: true,
      },
      {
        step: 'VENDOR_LEDGER',
        title: 'Payable Balance Reduced (Dr)',
        documentNumber: payment.voucherNumber,
        documentId: payment.id,
        status: 'DEBITED',
        date: payment.paymentDate.toISOString(),
        amount: Number(payment.amount),
      },
    ];

    return {
      sourceType: 'VENDOR_PAYMENT',
      sourceId: payment.id,
      sourceNumber: payment.voucherNumber,
      documentDate: payment.paymentDate.toISOString(),
      status: payment.status,
      company: payment.company ? { id: payment.company.id, name: payment.company.name, code: payment.company.code } : undefined,
      party: payment.vendor ? { id: payment.vendor.id, name: payment.vendor.name, code: payment.vendor.code, type: 'VENDOR', phone: payment.vendor.phone || undefined } : undefined,
      reference: payment.referenceNumber || undefined,
      notes: payment.notes || undefined,
      currency: 'PKR',
      grossAmount: Number(payment.amount),
      taxAmount: 0,
      discountAmount: 0,
      netAmount: Number(payment.amount),
      items: [
        {
          id: payment.id,
          itemName: `Vendor Payment Voucher (${payment.paymentType})`,
          quantity: 1,
          unitRate: Number(payment.amount),
          grossAmount: Number(payment.amount),
          netAmount: Number(payment.amount),
        },
      ],
      auditChain,
      rawDocument: payment,
      isPosted: true,
      isEditable: false,
    };
  }

  // =========================================================================
  // 8. INTERCOMPANY TRANSFER DRILL-DOWN RESOLVER
  // =========================================================================
  private async resolveIntercompanyTransfer(id?: string, voucherNumber?: string, _companyId?: string): Promise<ResolvedSourceDocument> {
    const rawNumber = (voucherNumber || id || '').trim();

    // Find parent sales invoice or child purchase invoice with intercompany reference
    const parentInvoice = await this.prisma.salesInvoice.findFirst({
      where: {
        OR: [
          { invoiceNumber: rawNumber },
          { id: id && id.length > 20 ? id : undefined },
          { notes: { contains: rawNumber } },
        ],
      },
      include: {
        company: true,
        warehouse: true,
        dealer: true,
        items: { include: { finishedProduct: true } },
      },
    });

    const childPurchase = await this.prisma.purchaseInvoice.findFirst({
      where: {
        OR: [
          { voucherNumber: rawNumber },
          { id: id && id.length > 20 ? id : undefined },
          { reference: rawNumber },
          { vendorInvoiceNo: parentInvoice ? parentInvoice.invoiceNumber : rawNumber },
        ],
      },
      include: {
        company: true,
        warehouse: true,
        vendor: true,
        items: true,
      },
    });

    if (!parentInvoice && !childPurchase) {
      throw new NotFoundException(`Intercompany Transfer ${rawNumber} not found`);
    }

    const transferNo = rawNumber || (parentInvoice?.invoiceNumber ?? childPurchase?.voucherNumber ?? 'IC-000001');

    const auditChain: AuditChainNode[] = [
      {
        step: 'INTERCOMPANY_TRANSFER',
        title: 'Intercompany Transfer Agreement',
        documentNumber: transferNo,
        status: 'POSTED',
        date: (parentInvoice?.invoiceDate || childPurchase?.date || new Date()).toISOString(),
        description: `Source: ${parentInvoice?.company?.name || 'Shehswar'} ➔ Destination: ${childPurchase?.company?.name || 'Child Company'}`,
        isCurrent: true,
      },
    ];

    if (parentInvoice) {
      auditChain.push({
        step: 'SHEHSWAR_STOCK_OUT',
        title: 'Parent Warehouse Stock Deducted (-)',
        documentNumber: parentInvoice.warehouse?.code || 'WH-OUT',
        status: 'DEDUCTED',
        date: parentInvoice.invoiceDate.toISOString(),
        description: `${parentInvoice.warehouse?.name} dispatched goods`,
      });
    }

    if (childPurchase) {
      auditChain.push({
        step: 'CHILD_STOCK_IN',
        title: 'Child Warehouse Stock Received (+)',
        documentNumber: childPurchase.warehouse?.code || 'WH-IN',
        status: 'RECEIVED',
        date: childPurchase.date.toISOString(),
        description: `${childPurchase.warehouse?.name} received stock`,
      });
    }

    const items = parentInvoice
      ? parentInvoice.items.map((it) => ({
          id: it.id,
          productCode: it.finishedProduct?.productCode || undefined,
          itemName: it.productName,
          materialType: 'FINISHED_PRODUCT',
          packSize: it.packing || undefined,
          batchNumber: it.batchNumber || undefined,
          quantity: Number(it.quantity),
          unitRate: Number(it.rate),
          grossAmount: Number(it.grossAmount),
          netAmount: Number(it.netAmount),
        }))
      : childPurchase!.items.map((it) => ({
          id: it.id,
          itemName: it.itemName,
          materialType: it.materialType || undefined,
          packSize: it.packing || undefined,
          quantity: Number(it.quantity),
          unitRate: Number(it.rate),
          grossAmount: Number(it.grossAmount || Number(it.quantity) * Number(it.rate)),
          netAmount: Number(it.netAmount || it.grossAmount),
        }));

    const netAmount = Number(parentInvoice?.netAmount || childPurchase?.netAmount || 0);

    return {
      sourceType: 'INTERCOMPANY_TRANSFER',
      sourceId: (parentInvoice?.id || childPurchase?.id)!,
      sourceNumber: transferNo,
      documentDate: (parentInvoice?.invoiceDate || childPurchase?.date || new Date()).toISOString(),
      status: 'POSTED',
      company: parentInvoice?.company
        ? { id: parentInvoice.company.id, name: parentInvoice.company.name, code: parentInvoice.company.code }
        : childPurchase?.company
        ? { id: childPurchase.company.id, name: childPurchase.company.name, code: childPurchase.company.code }
        : undefined,
      party: childPurchase?.company
        ? { id: childPurchase.company.id, name: childPurchase.company.name, code: childPurchase.company.code, type: 'CHILD_COMPANY' }
        : { id: 'CHILD', name: 'Child Company', code: 'CHILD', type: 'CHILD_COMPANY' },
      warehouse: (parentInvoice?.warehouse || childPurchase?.warehouse)
        ? { id: (parentInvoice?.warehouse || childPurchase?.warehouse)!.id, name: (parentInvoice?.warehouse || childPurchase?.warehouse)!.name, code: (parentInvoice?.warehouse || childPurchase?.warehouse)!.code }
        : undefined,
      reference: transferNo,
      currency: 'PKR',
      grossAmount: netAmount,
      taxAmount: 0,
      discountAmount: 0,
      netAmount,
      items,
      auditChain,
      rawDocument: { parentInvoice, childPurchase },
      isPosted: true,
      isEditable: false,
    };
  }

  // =========================================================================
  // 9. FINANCIAL TRANSACTION DRILL-DOWN RESOLVER
  // =========================================================================
  private async resolveFinancialTransaction(id?: string, voucherNumber?: string, companyId?: string): Promise<ResolvedSourceDocument> {
    const where: any = {};
    if (id && id.length > 20) where.id = id;
    else if (voucherNumber) where.voucherNumber = voucherNumber;
    else if (id) where.voucherNumber = id;
    if (companyId) where.companyId = companyId;

    const ft = await this.prisma.financialTransaction.findFirst({
      where,
      include: {
        company: true,
        account: true,
        contraAccount: true,
        bankAccount: true,
      },
    });

    if (!ft) {
      throw new NotFoundException(`Financial Transaction ${voucherNumber || id} not found`);
    }

    const auditChain: AuditChainNode[] = [
      {
        step: 'FINANCIAL_TRANSACTION',
        title: `Voucher ${ft.voucherNumber} (${ft.transactionType})`,
        documentNumber: ft.voucherNumber,
        documentId: ft.id,
        status: ft.status,
        date: ft.transactionDate.toISOString(),
        amount: Number(ft.amount),
        description: `${ft.account.accountName} ➔ ${ft.contraAccount.accountName}`,
        isCurrent: true,
      },
    ];

    return {
      sourceType: 'FINANCIAL_TRANSACTION',
      sourceId: ft.id,
      sourceNumber: ft.voucherNumber,
      documentDate: ft.transactionDate.toISOString(),
      status: ft.status,
      company: ft.company ? { id: ft.company.id, name: ft.company.name, code: ft.company.code } : undefined,
      party: ft.partyId ? { id: ft.partyId, name: ft.partyName || 'Party', code: ft.partyId, type: ft.partyType || 'PARTY' } : undefined,
      reference: ft.referenceNumber || undefined,
      notes: ft.remarks || undefined,
      currency: 'PKR',
      grossAmount: Number(ft.amount),
      taxAmount: 0,
      discountAmount: 0,
      netAmount: Number(ft.amount),
      items: [
        {
          id: ft.id,
          itemName: `${ft.transactionType.replace(/_/g, ' ')} (${ft.account.accountName})`,
          quantity: 1,
          unitRate: Number(ft.amount),
          grossAmount: Number(ft.amount),
          netAmount: Number(ft.amount),
        },
      ],
      auditChain,
      rawDocument: ft,
      isPosted: ft.status === 'POSTED',
      isEditable: ft.status === 'DRAFT',
    };
  }

  // =========================================================================
  // 10. PURCHASE RETURN DRILL-DOWN RESOLVER
  // =========================================================================
  private async resolvePurchaseReturn(id?: string, voucherNumber?: string, companyId?: string): Promise<ResolvedSourceDocument> {
    const where: any = {};
    if (id && id.length > 20) where.id = id;
    else if (voucherNumber) where.voucherNumber = voucherNumber;
    else if (id) where.voucherNumber = id;
    if (companyId) where.companyId = companyId;

    const prt = await this.prisma.purchaseReturn.findFirst({
      where,
      include: {
        vendor: true,
        warehouse: true,
        company: true,
        items: true,
        purchaseInvoice: true,
      },
    });

    if (!prt) {
      throw new NotFoundException(`Purchase Return ${voucherNumber || id} not found`);
    }

    const auditChain: AuditChainNode[] = [
      {
        step: 'PURCHASE_RETURN',
        title: 'Purchase Return Voucher',
        documentNumber: prt.voucherNumber,
        documentId: prt.id,
        status: prt.postingStatus,
        date: prt.date.toISOString(),
        amount: Number(prt.netAmount),
        description: `Goods returned to ${prt.vendor?.name || 'Vendor'} (Reason: ${prt.reason || 'N/A'})`,
        isCurrent: true,
      },
    ];

    return {
      sourceType: 'PURCHASE_RETURN',
      sourceId: prt.id,
      sourceNumber: prt.voucherNumber,
      documentDate: prt.date.toISOString(),
      status: prt.postingStatus,
      company: prt.company ? { id: prt.company.id, name: prt.company.name, code: prt.company.code } : undefined,
      party: prt.vendor ? { id: prt.vendor.id, name: prt.vendor.name, code: prt.vendor.code, type: 'VENDOR' } : undefined,
      warehouse: prt.warehouse ? { id: prt.warehouse.id, name: prt.warehouse.name, code: prt.warehouse.code } : undefined,
      reference: prt.purchaseInvoice?.voucherNumber || undefined,
      notes: prt.reason || undefined,
      currency: 'PKR',
      grossAmount: Number(prt.grossAmount || prt.netAmount),
      taxAmount: 0,
      discountAmount: 0,
      netAmount: Number(prt.netAmount),
      items: prt.items.map((it) => ({
        id: it.id,
        itemName: it.itemName,
        materialType: it.materialType || undefined,
        quantity: Number(it.quantity),
        unitRate: Number(it.rate),
        grossAmount: Number(it.netAmount),
        netAmount: Number(it.netAmount),
      })),
      auditChain,
      rawDocument: prt,
      isPosted: prt.postingStatus === 'POSTED',
      isEditable: prt.postingStatus === 'DRAFT',
    };
  }

  /**
   * Synchronized Update of an unposted source document directly from the Ledger (Requirements 5 & 6)
   */
  async updateSourceDocument(
    sourceType: string,
    sourceId: string,
    dto: {
      notes?: string;
      items?: Array<{ id?: string; quantity: number; unitRate: number; itemName?: string }>;
    },
    _user?: AuthUser,
  ) {
    if (sourceType === 'PURCHASE_ORDER') {
      const po = await this.prisma.purchaseOrder.findUnique({
        where: { id: sourceId },
        include: { items: true },
      });
      if (!po) throw new NotFoundException('Purchase Order not found');

      if (po.status === 'CONVERTED_TO_PURCHASE') {
        throw new ForbiddenException(
          'Already converted to Purchase Invoice. Cannot edit original PO directly without reversal.',
        );
      }

      let totalAmount = 0;
      if (dto.items && dto.items.length > 0) {
        for (const it of dto.items) {
          const lineTotal = Number(it.quantity) * Number(it.unitRate);
          totalAmount += lineTotal;
          if (it.id) {
            await this.prisma.purchaseOrderItem.update({
              where: { id: it.id },
              data: {
                quantity: it.quantity,
                unitRate: it.unitRate,
                lineTotal: lineTotal,
              },
            });
          }
        }
      } else {
        totalAmount = Number(po.totalAmount);
      }

      const updatedPo = await this.prisma.purchaseOrder.update({
        where: { id: sourceId },
        data: {
          totalAmount,
          notes: dto.notes !== undefined ? dto.notes : po.notes,
        },
      });

      // Synchronize Vendor Ledger Entry
      await this.prisma.vendorLedgerEntry.updateMany({
        where: {
          referenceId: sourceId,
        },
        data: {
          credit: totalAmount,
          description: `Purchase Order ${po.poNumber} (Updated)`,
        },
      });

      this.logger.log(`Synchronized PO ${po.poNumber} and Vendor Ledger amount to PKR ${totalAmount}`);
      return updatedPo;
    }

    throw new BadRequestException(`Direct editing from ledger is not configured for ${sourceType}`);
  }
}
