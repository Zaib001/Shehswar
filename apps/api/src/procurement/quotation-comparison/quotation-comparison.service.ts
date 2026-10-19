/**
 * SHEHSWAR ONE360 - Quotation Comparison & Selection Engine
 *
 * Implements competitive side-by-side matrix evaluation:
 * - Side-by-side multi-vendor price comparison
 * - Delivery lead-time comparison
 * - Payment terms evaluation
 * - Commercial winner selection with mandatory audit justification
 */
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { AuditService } from '../../platform/audit/audit.service';
import { NotificationService } from '../../platform/notifications/notification.service';
import { uuidv7 } from '@shehswar/shared';
import {
  QuotationComparisonMatrix,
  QuotationComparisonColumn,
  SelectQuotationWinnerDto,
  QuotationStatus,
  RfqStatus,
  Resource,
  Action,
  AuthUser,
  NotificationChannel,
} from '@shehswar/types';

import { PurchaseOrderService } from '../purchase-order/purchase-order.service';

@Injectable()
export class QuotationComparisonService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly notificationService: NotificationService,
    private readonly poService: PurchaseOrderService,
  ) {}

  /**
   * Generate side-by-side comparison matrix for an RFQ
   */
  async getComparisonMatrix(rfqId: string): Promise<QuotationComparisonMatrix> {
    const rfq = await this.prisma.requestForQuotation.findUnique({
      where: { id: rfqId },
      include: {
        requisition: {
          include: { items: true },
        },
        quotations: {
          include: {
            vendor: true,
            items: true,
          },
        },
      },
    });

    if (!rfq) {
      throw new NotFoundException(`RFQ with ID '${rfqId}' not found`);
    }

    if (!rfq.quotations || rfq.quotations.length === 0) {
      throw new BadRequestException('No quotations have been submitted for this RFQ yet');
    }

    // Build vendor columns
    const vendors: QuotationComparisonColumn[] = rfq.quotations.map((q) => {
      const itemPrices: Record<string, { unitPrice: number; lineTotal: number; quantity: number }> =
        {};

      q.items.forEach((item) => {
        itemPrices[item.itemName] = {
          unitPrice: Number(item.unitPrice),
          lineTotal: Number(item.lineTotal),
          quantity: Number(item.quantity),
        };
      });

      return {
        quotationId: q.id,
        vendorId: q.vendorId,
        vendorName: q.vendor.name,
        vendorCode: q.vendor.code,
        quotationNumber: q.quotationNumber,
        currency: q.currency,
        subtotal: Number(q.subtotal),
        taxAmount: Number(q.taxAmount),
        discountAmount: Number(q.discountAmount),
        netAmount: Number(q.netAmount),
        deliveryLeadDays: q.deliveryLeadDays,
        paymentTerms: q.paymentTerms,
        validityDate: new Date(q.validityDate).toISOString().slice(0, 10),
        warranty: q.warranty ?? undefined,
        status: q.status as QuotationStatus,
        isSelected: q.isSelected,
        itemPrices,
      };
    });

    // Collect all unique item names
    const itemNamesSet = new Set<string>();
    rfq.quotations.forEach((q) => {
      q.items.forEach((item) => itemNamesSet.add(item.itemName));
    });

    const items = Array.from(itemNamesSet).map((name) => {
      let lowestPrice = Infinity;
      let lowestVendorId = '';
      let quantity = 1;
      let unit = 'KG';

      vendors.forEach((v) => {
        const itemInfo = v.itemPrices[name];
        if (itemInfo) {
          quantity = itemInfo.quantity;
          if (itemInfo.unitPrice < lowestPrice) {
            lowestPrice = itemInfo.unitPrice;
            lowestVendorId = v.vendorId;
          }
        }
      });

      return {
        itemName: name,
        quantity,
        unit,
        lowestPrice: lowestPrice === Infinity ? 0 : lowestPrice,
        lowestVendorId,
      };
    });

    // Summary calculations
    let lowestTotalAmount = Infinity;
    let lowestTotalVendorId = '';
    let fastestLeadDays = Infinity;
    let fastestVendorId = '';

    vendors.forEach((v) => {
      if (v.netAmount < lowestTotalAmount) {
        lowestTotalAmount = v.netAmount;
        lowestTotalVendorId = v.vendorId;
      }
      if (v.deliveryLeadDays < fastestLeadDays) {
        fastestLeadDays = v.deliveryLeadDays;
        fastestVendorId = v.vendorId;
      }
    });

    return {
      rfqId: rfq.id,
      rfqNumber: rfq.rfqNumber,
      rfqTitle: rfq.title,
      prNumber: rfq.requisition?.prNumber,
      vendors,
      items,
      summary: {
        totalQuotations: vendors.length,
        lowestTotalAmount: lowestTotalAmount === Infinity ? 0 : lowestTotalAmount,
        lowestTotalVendorId,
        fastestLeadDays: fastestLeadDays === Infinity ? 0 : fastestLeadDays,
        fastestVendorId,
      },
    };
  }

  /**
   * Select winning quotation with mandatory justification
   */
  async selectWinner(dto: SelectQuotationWinnerDto, actor?: AuthUser) {
    if (!dto.selectionJustification || dto.selectionJustification.trim().length < 5) {
      throw new BadRequestException(
        'A thorough selection justification is mandatory for audit compliance',
      );
    }

    const rfq = await this.prisma.requestForQuotation.findUnique({
      where: { id: dto.rfqId },
      include: { quotations: { include: { vendor: true } } },
    });

    if (!rfq) {
      throw new NotFoundException(`RFQ '${dto.rfqId}' not found`);
    }

    const selectedQuotation = rfq.quotations.find((q) => q.id === dto.quotationId);
    if (!selectedQuotation) {
      throw new BadRequestException('Selected quotation does not belong to this RFQ');
    }

    // 1. Mark selected quotation as SELECTED
    const winner = await this.prisma.vendorQuotation.update({
      where: { id: dto.quotationId },
      data: {
        status: QuotationStatus.SELECTED,
        isSelected: true,
        selectionJustification: dto.selectionJustification,
        selectedAt: new Date(),
        selectedById: actor?.id || dto.selectedById,
      },
      include: { vendor: true, items: true },
    });

    // 2. Mark remaining quotations as REJECTED
    await this.prisma.vendorQuotation.updateMany({
      where: {
        rfqId: dto.rfqId,
        id: { not: dto.quotationId },
      },
      data: {
        status: QuotationStatus.REJECTED,
        isSelected: false,
      },
    });

    // 3. Mark RFQ comparison completed
    await this.prisma.requestForQuotation.update({
      where: { id: dto.rfqId },
      data: { status: RfqStatus.COMPARISON_COMPLETED },
    });

    // Dispatch notification to procurement lead / management
    if (actor) {
      await this.notificationService.dispatch({
        organizationId: rfq.organizationId,
        companyId: rfq.companyId,
        recipientId: actor.id,
        channel: NotificationChannel.IN_APP,
        title: 'Supplier Selected from Quotation Comparison',
        body: `Supplier ${winner.vendor.name} selected for ${rfq.rfqNumber}. Net: PKR ${winner.netAmount}. Ready for PO creation.`,
        templateCode: 'QUOTATION_SELECTED',
        data: { rfqId: rfq.id, quotationId: winner.id, vendorId: winner.vendorId },
      });
    }

    // Record audit log
    await this.auditService.record({
      organizationId: rfq.organizationId,
      companyId: rfq.companyId,
      actorId: actor?.id || dto.selectedById,
      actorEmail: actor?.email || 'system@shehswar.com',
      resource: Resource.QUOTATION_COMPARISON,
      resourceId: dto.rfqId,
      action: Action.ASSIGN,
      newState: {
        selectedQuotationId: winner.id,
        vendorId: winner.vendorId,
        vendorName: winner.vendor.name,
        netAmount: winner.netAmount,
        justification: dto.selectionJustification,
      },
      correlationId: uuidv7(),
    });

    return winner;
  }

  /**
   * Automatically generate a formal Purchase Order for the winning quotation
   */
  async generatePoForWinner(
    dto: { rfqId: string; quotationId?: string; warehouseId?: string; deliveryLocation?: string },
    actor?: AuthUser,
  ) {
    const rfq: any = await this.prisma.requestForQuotation.findUnique({
      where: { id: dto.rfqId },
      include: {
        requisition: { select: { id: true, prNumber: true, departmentId: true } },
        quotations: {
          include: {
            vendor: true,
            items: true,
          },
        },
      },
    });

    if (!rfq) {
      throw new NotFoundException(`RFQ '${dto.rfqId}' not found`);
    }

    // Determine the winning quotation
    let winningQuote = dto.quotationId
      ? rfq.quotations.find((q: any) => q.id === dto.quotationId)
      : rfq.quotations.find((q: any) => q.isSelected || q.status === QuotationStatus.SELECTED);

    if (!winningQuote) {
      winningQuote = rfq.quotations.sort((a: any, b: any) => Number(a.netAmount) - Number(b.netAmount))[0];
    }

    if (!winningQuote) {
      throw new BadRequestException('No quotations found for this RFQ to generate a Purchase Order');
    }

    // Ensure quotation is marked as SELECTED
    if (!winningQuote.isSelected) {
      await this.prisma.vendorQuotation.update({
        where: { id: winningQuote.id },
        data: {
          status: QuotationStatus.SELECTED,
          isSelected: true,
          selectedAt: new Date(),
          selectedById: actor?.id,
        },
      });
    }

    // Check if PO was already created for this RFQ & winning vendor
    const existingPo = await this.prisma.purchaseOrder.findFirst({
      where: {
        rfqId: rfq.id,
        vendorId: winningQuote.vendorId,
        deletedAt: null,
      },
      include: {
        vendor: true,
        items: true,
      },
    });

    if (existingPo) {
      return existingPo;
    }

    // Resolve warehouse
    let warehouseId = dto.warehouseId;
    if (!warehouseId) {
      const defaultWh = await this.prisma.warehouse.findFirst({
        where: { companyId: rfq.companyId },
        orderBy: { createdAt: 'asc' },
      });
      warehouseId = defaultWh?.id;
    }

    // Calculate delivery date based on quotation deliveryLeadDays
    const leadDays = winningQuote.deliveryLeadDays || 7;
    const expectedDeliveryDate = new Date();
    expectedDeliveryDate.setDate(expectedDeliveryDate.getDate() + leadDays);

    const items = winningQuote.items.map((qi: any) => ({
      itemName: qi.itemName,
      category: 'RAW_MATERIAL' as any,
      quantity: Number(qi.quantity),
      unit: qi.unit || 'KG',
      unitRate: Number(qi.unitPrice),
      taxRate: Number(qi.taxRate) || 0,
      discountRate: Number(qi.discountRate) || 0,
      notes: qi.notes || `Sourced under RFQ ${rfq.rfqNumber}`,
    }));

    const po = await this.poService.createPurchaseOrder(
      {
        organizationId: rfq.organizationId,
        companyId: rfq.companyId,
        departmentId: rfq.requisition?.departmentId,
        vendorId: winningQuote.vendorId,
        warehouseId,
        prId: rfq.prId || undefined,
        rfqId: rfq.id,
        currency: winningQuote.currency || 'PKR',
        paymentTerms: winningQuote.paymentTerms || winningQuote.vendor.paymentTerms || '30_DAYS_CREDIT',
        deliveryLocation: dto.deliveryLocation || 'Main Manufacturing Plant & Receiving Bay',
        expectedDeliveryDate: expectedDeliveryDate.toISOString(),
        notes: `Purchase Order awarded from Quotation #${winningQuote.quotationNumber} under competitive RFQ ${rfq.rfqNumber}.`,
        items,
      },
      actor,
    );

    // Update RFQ status to COMPARISON_COMPLETED
    await this.prisma.requestForQuotation.update({
      where: { id: rfq.id },
      data: { status: RfqStatus.COMPARISON_COMPLETED },
    });

    return po;
  }
}
