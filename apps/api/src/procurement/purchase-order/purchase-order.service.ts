/**
 * SHEHSWAR ONE360 - Purchase Order (PO) Service
 *
 * Implements enterprise purchase order lifecycle:
 * Draft -> Submitted -> Approved -> Sent to Vendor -> Partially Received -> Completed -> Cancelled
 *
 * Strictly enforces:
 * - Approved vendor validation
 * - Concurrency-safe atomic document numbering
 * - Financial calculation precision (subtotal, taxes, discounts, totals)
 * - Multi-tier approval engine integration
 * - Immutable audit trail and notifications
 */
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { AuditService } from '../../platform/audit/audit.service';
import { ApprovalEngineService } from '../../platform/approvals/approval-engine.service';
import { DocumentNumberingService } from '../../platform/document-numbering/document-numbering.service';
import { NotificationService } from '../../platform/notifications/notification.service';
import { uuidv7 } from '@shehswar/shared';
import {
  CreatePurchaseOrderDto,
  PurchaseOrderFilterDto,
  PurchaseOrderStatus,
  VendorStatus,
  Resource,
  Action,
  AuthUser,
  NotificationChannel,
} from '@shehswar/types';

@Injectable()
export class PurchaseOrderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly approvalEngine: ApprovalEngineService,
    private readonly documentNumbering: DocumentNumberingService,
    private readonly notificationService: NotificationService,
  ) {}

  /**
   * Create a new Purchase Order in DRAFT status
   */
  async createPurchaseOrder(dto: CreatePurchaseOrderDto, actor?: AuthUser) {
    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('At least one item is required in a Purchase Order');
    }

    // 1. Mandatory Rule: Vendor must exist and be APPROVED
    const vendor = await this.prisma.vendor.findUnique({
      where: { id: dto.vendorId },
    });

    if (!vendor || vendor.deletedAt) {
      throw new NotFoundException(`Vendor with ID '${dto.vendorId}' not found`);
    }

    if (vendor.status !== VendorStatus.APPROVED) {
      throw new BadRequestException(
        `PO creation rejected: Vendor '${vendor.name}' is currently '${vendor.status}'. Only APPROVED vendors can receive Purchase Orders.`,
      );
    }

    const organizationId = dto.organizationId || vendor.organizationId || actor?.organizationId;
    const companyId = dto.companyId || vendor.companyId || actor?.companyId;

    if (!organizationId || !companyId) {
      throw new BadRequestException('Organization and Company context are required to create a Purchase Order');
    }

    // 2. Concurrency-safe atomic PO numbering
    const poNumber = await this.documentNumbering.getNextDocumentNumber({
      organizationId,
      companyId,
      documentType: 'PO',
    });

    const poId = uuidv7();

    // 3. Item calculations (rates, taxes, discounts, totals)
    let subtotal = 0;
    let totalTax = 0;
    let totalDiscount = 0;

    const itemsData = dto.items.map((item) => {
      const quantity = Number(item.quantity) || 1;
      const unitRate = Number(item.unitRate) || 0;
      const baseLine = quantity * unitRate;

      const taxRate = Number(item.taxRate) || 0;
      const discountRate = Number(item.discountRate) || 0;

      const taxAmount = (baseLine * taxRate) / 100;
      const discountAmount = (baseLine * discountRate) / 100;
      const lineTotal = baseLine + taxAmount - discountAmount;

      subtotal += baseLine;
      totalTax += taxAmount;
      totalDiscount += discountAmount;

      return {
        id: uuidv7(),
        itemName: item.itemName,
        category: item.category || 'RAW_MATERIAL',
        quantity,
        unit: item.unit || 'KG',
        unitRate,
        taxRate,
        taxAmount,
        discountRate,
        discountAmount,
        lineTotal,
        receivedQuantity: 0,
        notes: item.notes,
      };
    });

    const totalAmount = subtotal + totalTax - totalDiscount;

    const purchaseOrder = await this.prisma.purchaseOrder.create({
      data: {
        id: poId,
        organizationId,
        companyId,
        departmentId: dto.departmentId,
        vendorId: dto.vendorId,
        warehouseId: dto.warehouseId,
        prId: dto.prId,
        rfqId: dto.rfqId,
        poNumber,
        currency: dto.currency || vendor.currency || 'PKR',
        paymentTerms: dto.paymentTerms || vendor.paymentTerms || '30_DAYS_CREDIT',
        deliveryLocation: dto.deliveryLocation,
        expectedDeliveryDate: dto.expectedDeliveryDate
          ? new Date(dto.expectedDeliveryDate)
          : undefined,
        subtotal,
        taxAmount: totalTax,
        discountAmount: totalDiscount,
        totalAmount,
        status: PurchaseOrderStatus.DRAFT,
        createdById: actor?.id || dto.createdById,
        notes: dto.notes,
        items: {
          create: itemsData,
        },
      },
      include: {
        items: true,
        vendor: { select: { id: true, name: true, code: true, paymentTerms: true } },
        warehouse: { select: { id: true, name: true, code: true } },
        department: { select: { id: true, name: true, code: true } },
      },
    });

    await this.auditService.record({
      organizationId,
      companyId,
      actorId: actor?.id || '00000000-0000-0000-0000-000000000000',
      actorEmail: actor?.email || 'system@shehswar.com',
      resource: Resource.PURCHASE_ORDER,
      resourceId: purchaseOrder.id,
      action: Action.CREATE,
      newState: purchaseOrder as any,
      correlationId: uuidv7(),
    });

    return purchaseOrder;
  }

  /**
   * Search and filter Purchase Orders
   */
  async findAllPurchaseOrders(filter: PurchaseOrderFilterDto) {
    const where: any = { deletedAt: null };

    if (filter.organizationId) where.organizationId = filter.organizationId;
    if (filter.companyId) where.companyId = filter.companyId;
    if (filter.vendorId) where.vendorId = filter.vendorId;
    if (filter.status) where.status = filter.status;

    if (filter.search) {
      where.OR = [
        { poNumber: { contains: filter.search, mode: 'insensitive' } },
        { vendor: { name: { contains: filter.search, mode: 'insensitive' } } },
      ];
    }

    const page = Number(filter.page) || 1;
    const limit = Number(filter.limit) || 20;
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.purchaseOrder.findMany({
        where,
        skip,
        take: limit,
        include: {
          items: true,
          vendor: { select: { id: true, name: true, code: true } },
          warehouse: { select: { id: true, name: true, code: true } },
          department: { select: { id: true, name: true, code: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.purchaseOrder.count({ where }),
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
   * Get single Purchase Order with items and GRN history
   */
  async findPurchaseOrderById(id: string) {
    const po = await this.prisma.purchaseOrder.findUnique({
      where: { id },
      include: {
        items: true,
        vendor: true,
        warehouse: true,
        department: true,
        goodsReceiptNotes: {
          include: {
            items: true,
          },
        },
      },
    });

    if (!po || po.deletedAt) {
      throw new NotFoundException(`Purchase Order with ID '${id}' not found`);
    }

    return po;
  }

  /**
   * Submit PO to multi-tier approval workflow
   */
  async submitForApproval(id: string, actor: AuthUser) {
    const po = await this.findPurchaseOrderById(id);

    if (po.status !== PurchaseOrderStatus.DRAFT) {
      throw new BadRequestException(
        `Only DRAFT Purchase Orders can be submitted (current: ${po.status})`,
      );
    }

    // Submit to ApprovalEngine with financial threshold
    await this.approvalEngine.submitForApproval({
      organizationId: po.organizationId,
      companyId: po.companyId,
      documentType: 'PO',
      documentId: po.id,
      amount: Number(po.totalAmount),
      requestedById: actor.id,
    });

    const updated = await this.prisma.purchaseOrder.update({
      where: { id },
      data: { status: PurchaseOrderStatus.SUBMITTED },
    });

    // Notify approver
    await this.notificationService.dispatch({
      organizationId: po.organizationId,
      companyId: po.companyId,
      recipientId: actor.id,
      channel: NotificationChannel.IN_APP,
      title: 'Purchase Order Submitted for Approval',
      body: `PO ${po.poNumber} to ${po.vendor.name} for ${po.currency} ${po.totalAmount} submitted for executive approval.`,
      templateCode: 'PO_SUBMITTED',
      data: { poId: po.id, linkUrl: `/procurement/purchase-orders/${po.id}` },
    });

    await this.auditService.record({
      organizationId: po.organizationId,
      companyId: po.companyId,
      actorId: actor.id,
      actorEmail: actor.email,
      resource: Resource.PURCHASE_ORDER,
      resourceId: id,
      action: Action.SUBMIT,
      previousState: { status: po.status },
      newState: { status: updated.status },
      correlationId: uuidv7(),
    });

    return updated;
  }

  /**
   * Approve or reject PO
   */
  async processApproval(
    id: string,
    action: 'APPROVE' | 'REJECT',
    comments?: string,
    actor?: AuthUser,
  ) {
    const po = await this.findPurchaseOrderById(id);

    if (po.status !== PurchaseOrderStatus.SUBMITTED) {
      throw new BadRequestException(
        `Purchase Order must be in SUBMITTED status to approve/reject (current: ${po.status})`,
      );
    }

    const isApproved = action === 'APPROVE';
    const newStatus = isApproved ? PurchaseOrderStatus.APPROVED : PurchaseOrderStatus.CANCELLED;

    const updated = await this.prisma.purchaseOrder.update({
      where: { id },
      data: {
        status: newStatus,
        approvedAt: isApproved ? new Date() : undefined,
        approvedById: isApproved ? actor?.id : undefined,
        cancellationReason: !isApproved ? comments : undefined,
      },
    });

    // Dispatch notification to buyer
    if (po.createdById) {
      await this.notificationService.dispatch({
        organizationId: po.organizationId,
        companyId: po.companyId,
        recipientId: po.createdById,
        channel: NotificationChannel.IN_APP,
        title: `Purchase Order ${isApproved ? 'Approved' : 'Rejected'}`,
        body: `Purchase Order ${po.poNumber} has been ${isApproved ? 'approved' : 'rejected'}.${comments ? ' Reason: ' + comments : ''}`,
        templateCode: `PO_${action}`,
        data: { poId: po.id, comments },
      });
    }

    await this.auditService.record({
      organizationId: po.organizationId,
      companyId: po.companyId,
      actorId: actor?.id || '00000000-0000-0000-0000-000000000000',
      actorEmail: actor?.email || 'system@shehswar.com',
      resource: Resource.PURCHASE_ORDER,
      resourceId: id,
      action: isApproved ? Action.APPROVE : Action.REJECT,
      previousState: { status: po.status },
      newState: { status: updated.status, comments },
      correlationId: uuidv7(),
    });

    return updated;
  }

  /**
   * Mark PO as SENT_TO_VENDOR
   */
  async sendToVendor(id: string, actor?: AuthUser) {
    const po = await this.findPurchaseOrderById(id);

    if (po.status !== PurchaseOrderStatus.APPROVED) {
      throw new BadRequestException(
        `Only APPROVED Purchase Orders can be sent to vendors (current: ${po.status})`,
      );
    }

    const updated = await this.prisma.purchaseOrder.update({
      where: { id },
      data: { status: PurchaseOrderStatus.SENT_TO_VENDOR },
    });

    await this.auditService.record({
      organizationId: po.organizationId,
      companyId: po.companyId,
      actorId: actor?.id || '00000000-0000-0000-0000-000000000000',
      actorEmail: actor?.email || 'system@shehswar.com',
      resource: Resource.PURCHASE_ORDER,
      resourceId: id,
      action: Action.RELEASE,
      previousState: { status: po.status },
      newState: { status: updated.status },
      correlationId: uuidv7(),
    });

    return updated;
  }

  /**
   * Cancel an open PO
   */
  async cancelPurchaseOrder(id: string, reason: string, actor?: AuthUser) {
    const po = await this.findPurchaseOrderById(id);

    if (
      po.status === PurchaseOrderStatus.COMPLETED ||
      po.status === PurchaseOrderStatus.CANCELLED
    ) {
      throw new BadRequestException(`Cannot cancel a Purchase Order in ${po.status} status`);
    }

    const updated = await this.prisma.purchaseOrder.update({
      where: { id },
      data: {
        status: PurchaseOrderStatus.CANCELLED,
        cancellationReason: reason,
      },
    });

    await this.auditService.record({
      organizationId: po.organizationId,
      companyId: po.companyId,
      actorId: actor?.id || '00000000-0000-0000-0000-000000000000',
      actorEmail: actor?.email || 'system@shehswar.com',
      resource: Resource.PURCHASE_ORDER,
      resourceId: id,
      action: Action.CANCEL,
      previousState: { status: po.status },
      newState: { status: updated.status, reason },
      correlationId: uuidv7(),
    });

    return updated;
  }
}
