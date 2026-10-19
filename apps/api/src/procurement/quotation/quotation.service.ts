/**
 * SHEHSWAR ONE360 - Vendor Quotation Service
 *
 * Captures commercial supplier bids:
 * Received -> Under Review -> Selected -> Rejected
 * Calculates line totals, taxes, discounts, delivery lead days and validity periods.
 */
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { AuditService } from '../../platform/audit/audit.service';
import { uuidv7 } from '@shehswar/shared';
import {
  CreateQuotationDto,
  QuotationFilterDto,
  QuotationStatus,
  RfqStatus,
  RfqVendorStatus,
  Resource,
  Action,
  AuthUser,
} from '@shehswar/types';

@Injectable()
export class QuotationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Record a vendor quotation against an RFQ
   */
  async createQuotation(dto: CreateQuotationDto, actor?: AuthUser) {
    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('At least one item is required in a vendor quotation');
    }

    // Verify vendor
    const vendor = await this.prisma.vendor.findUnique({
      where: { id: dto.vendorId },
    });
    if (!vendor) {
      throw new NotFoundException(`Vendor '${dto.vendorId}' not found`);
    }

    // Verify RFQ
    const rfq = await this.prisma.requestForQuotation.findUnique({
      where: { id: dto.rfqId },
    });
    if (!rfq) {
      throw new NotFoundException(`RFQ '${dto.rfqId}' not found`);
    }

    const quotationId = uuidv7();

    // Calculate line items, taxes, discounts, totals
    let subtotal = 0;
    let totalTax = 0;
    let totalDiscount = 0;

    const itemsData = dto.items.map((item) => {
      const quantity = Number(item.quantity) || 1;
      const unitPrice = Number(item.unitPrice) || 0;
      const basePrice = quantity * unitPrice;
      const taxRate = Number(item.taxRate) || 0;
      const discountRate = Number(item.discountRate) || 0;

      const itemTax = (basePrice * taxRate) / 100;
      const itemDiscount = (basePrice * discountRate) / 100;
      const lineTotal = basePrice + itemTax - itemDiscount;

      subtotal += basePrice;
      totalTax += itemTax;
      totalDiscount += itemDiscount;

      return {
        id: uuidv7(),
        itemName: item.itemName,
        quantity,
        unit: item.unit || 'KG',
        unitPrice,
        taxRate,
        discountRate,
        lineTotal,
        notes: item.notes,
      };
    });

    const netAmount = subtotal + totalTax - totalDiscount;

    const organizationId =
      dto.organizationId || rfq.organizationId || vendor.organizationId || actor?.organizationId;
    const companyId =
      dto.companyId || rfq.companyId || vendor.companyId || actor?.companyId;

    if (!organizationId || !companyId) {
      throw new BadRequestException('Organization and Company context are required to create a Quotation');
    }

    const quotation = await this.prisma.vendorQuotation.create({
      data: {
        id: quotationId,
        organizationId,
        companyId,
        rfqId: dto.rfqId,
        vendorId: dto.vendorId,
        quotationNumber: dto.quotationNumber,
        currency: dto.currency || vendor.currency || 'PKR',
        subtotal,
        taxAmount: totalTax,
        discountAmount: totalDiscount,
        netAmount,
        deliveryLeadDays: dto.deliveryLeadDays || 7,
        paymentTerms: dto.paymentTerms || vendor.paymentTerms || '30_DAYS_CREDIT',
        validityDate: new Date(dto.validityDate),
        warranty: dto.warranty,
        notes: dto.notes,
        status: QuotationStatus.RECEIVED,
        items: {
          create: itemsData,
        },
      },
      include: {
        items: true,
        vendor: { select: { id: true, name: true, code: true } },
      },
    });

    // Update RfqVendor invited status to SUBMITTED
    await this.prisma.rfqVendor.updateMany({
      where: {
        rfqId: dto.rfqId,
        vendorId: dto.vendorId,
      },
      data: {
        status: RfqVendorStatus.SUBMITTED,
      },
    });

    // Transition RFQ status to QUOTATIONS_RECEIVED if still SENT or DRAFT
    if (rfq.status === RfqStatus.SENT || rfq.status === RfqStatus.DRAFT) {
      await this.prisma.requestForQuotation.update({
        where: { id: dto.rfqId },
        data: { status: RfqStatus.QUOTATIONS_RECEIVED },
      });
    }

    await this.auditService.record({
      organizationId,
      companyId,
      actorId: actor?.id || '00000000-0000-0000-0000-000000000000',
      actorEmail: actor?.email || 'system@shehswar.com',
      resource: Resource.QUOTATION,
      resourceId: quotation.id,
      action: Action.CREATE,
      newState: quotation as any,
      correlationId: uuidv7(),
    });

    return quotation;
  }

  /**
   * Search and filter vendor quotations
   */
  async findAllQuotations(filter: QuotationFilterDto) {
    const where: any = {};

    if (filter.organizationId) where.organizationId = filter.organizationId;
    if (filter.companyId) where.companyId = filter.companyId;
    if (filter.rfqId) where.rfqId = filter.rfqId;
    if (filter.vendorId) where.vendorId = filter.vendorId;
    if (filter.status) where.status = filter.status;

    const page = Number(filter.page) || 1;
    const limit = Number(filter.limit) || 20;
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.vendorQuotation.findMany({
        where,
        skip,
        take: limit,
        include: {
          items: true,
          vendor: { select: { id: true, name: true, code: true } },
          rfq: { select: { id: true, rfqNumber: true, title: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.vendorQuotation.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get single quotation with line items
   */
  async findQuotationById(id: string) {
    const quotation = await this.prisma.vendorQuotation.findUnique({
      where: { id },
      include: {
        items: true,
        vendor: { select: { id: true, name: true, code: true, paymentTerms: true, email: true } },
        rfq: { select: { id: true, rfqNumber: true, title: true, deadline: true } },
      },
    });

    if (!quotation) {
      throw new NotFoundException(`Vendor Quotation with ID '${id}' not found`);
    }

    return quotation;
  }

  /**
   * Move quotation to UNDER_REVIEW
   */
  async markUnderReview(id: string, actor?: AuthUser) {
    const quotation = await this.findQuotationById(id);

    const updated = await this.prisma.vendorQuotation.update({
      where: { id },
      data: { status: QuotationStatus.UNDER_REVIEW },
    });

    await this.auditService.record({
      organizationId: quotation.organizationId,
      companyId: quotation.companyId,
      actorId: actor?.id || '00000000-0000-0000-0000-000000000000',
      actorEmail: actor?.email || 'system@shehswar.com',
      resource: Resource.QUOTATION,
      resourceId: id,
      action: Action.EDIT,
      previousState: { status: quotation.status },
      newState: { status: updated.status },
      correlationId: uuidv7(),
    });

    return updated;
  }
}
