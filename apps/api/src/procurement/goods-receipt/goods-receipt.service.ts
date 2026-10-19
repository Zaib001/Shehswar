/**
 * SHEHSWAR ONE360 - Goods Receipt Note (GRN) Service
 *
 * Implements receiving foundation without premature inventory ledger postings:
 * Draft -> Received -> Quality Pending -> Accepted -> Rejected
 * Includes PO linkage, partial receiving tracking, package condition logging,
 * QC inspection placeholder, and multi-channel notification dispatch.
 */
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { AuditService } from '../../platform/audit/audit.service';
import { DocumentNumberingService } from '../../platform/document-numbering/document-numbering.service';
import { NotificationService } from '../../platform/notifications/notification.service';
import { uuidv7 } from '@shehswar/shared';
import {
  CreateGoodsReceiptNoteDto,
  GoodsReceiptFilterDto,
  UpdateQcStatusDto,
  GoodsReceiptStatus,
  QcStatus,
  PurchaseOrderStatus,
  Resource,
  Action,
  AuthUser,
  NotificationChannel,
} from '@shehswar/types';

@Injectable()
export class GoodsReceiptService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly documentNumbering: DocumentNumberingService,
    private readonly notificationService: NotificationService,
  ) {}

  /**
   * Create a new Goods Receipt Note linked to an active Purchase Order
   */
  async createGoodsReceipt(dto: CreateGoodsReceiptNoteDto, actor?: AuthUser) {
    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('At least one item is required in a Goods Receipt Note');
    }

    // 1. Verify PO exists and is eligible for receiving
    const po = await this.prisma.purchaseOrder.findUnique({
      where: { id: dto.poId },
      include: { items: true, vendor: true },
    });

    if (!po || po.deletedAt) {
      throw new NotFoundException(`Purchase Order '${dto.poId}' not found`);
    }

    const eligibleStatuses = [
      PurchaseOrderStatus.APPROVED,
      PurchaseOrderStatus.SENT_TO_VENDOR,
      PurchaseOrderStatus.PARTIALLY_RECEIVED,
    ];

    if (!eligibleStatuses.includes(po.status as PurchaseOrderStatus)) {
      throw new BadRequestException(
        `PO '${po.poNumber}' cannot be received in status '${po.status}'. Must be APPROVED, SENT_TO_VENDOR or PARTIALLY_RECEIVED.`,
      );
    }

    const organizationId = dto.organizationId || po.organizationId || actor?.organizationId;
    const companyId = dto.companyId || po.companyId || actor?.companyId;

    if (!organizationId || !companyId) {
      throw new BadRequestException('Organization and Company context are required to create a Goods Receipt Note');
    }

    // 2. Generate sequential GRN number atomically
    const grnNumber = await this.documentNumbering.getNextDocumentNumber({
      organizationId,
      companyId,
      documentType: 'GRN',
    });

    const grnId = uuidv7();

    // 3. Prepare line items and update PO received quantities
    const grnItemsData = dto.items.map((item) => {
      const receivedQty = Number(item.receivedQuantity) || 0;
      const orderedQty = Number(item.orderedQuantity) || 0;

      return {
        id: uuidv7(),
        poItemId: item.poItemId,
        itemName: item.itemName,
        orderedQuantity: orderedQty,
        receivedQuantity: receivedQty,
        acceptedQuantity: receivedQty, // Default until QC inspection
        rejectedQuantity: 0,
        unit: item.unit || 'KG',
        packageCondition: item.packageCondition || 'INTACT',
        batchNumber: item.batchNumber,
        expiryDate: item.expiryDate ? new Date(item.expiryDate) : undefined,
        notes: item.notes,
      };
    });

    const grn = await this.prisma.goodsReceiptNote.create({
      data: {
        id: grnId,
        organizationId,
        companyId,
        poId: dto.poId,
        vendorId: dto.vendorId,
        warehouseId: dto.warehouseId,
        grnNumber,
        receivedDate: dto.receivedDate ? new Date(dto.receivedDate) : new Date(),
        receivedById:
          dto.receivedById ||
          actor?.id ||
          po.createdById ||
          '00000000-0000-0000-0000-000000000000',
        receivedByName:
          dto.receivedByName ||
          `${actor?.firstName || ''} ${actor?.lastName || ''}`.trim() ||
          actor?.email,
        carrierName: dto.carrierName,
        vehicleNumber: dto.vehicleNumber,
        deliveryNoteNumber: dto.deliveryNoteNumber,
        status: GoodsReceiptStatus.RECEIVED,
        qcStatus: QcStatus.PENDING,
        notes: dto.notes,
        items: {
          create: grnItemsData,
        },
      },
      include: {
        items: true,
        purchaseOrder: { select: { id: true, poNumber: true } },
        vendor: { select: { id: true, name: true, code: true } },
        warehouse: { select: { id: true, name: true, code: true } },
      },
    });

    // 4. Update PO Item received quantities and determine PO overall status
    let allCompleted = true;
    for (const item of dto.items) {
      if (item.poItemId) {
        const poItem = po.items.find((pi) => pi.id === item.poItemId);
        if (poItem) {
          const newReceived = Number(poItem.receivedQuantity) + Number(item.receivedQuantity);
          await this.prisma.purchaseOrderItem.update({
            where: { id: item.poItemId },
            data: { receivedQuantity: newReceived },
          });

          if (newReceived < Number(poItem.quantity)) {
            allCompleted = false;
          }
        }
      }
    }

    const nextPoStatus = allCompleted
      ? PurchaseOrderStatus.COMPLETED
      : PurchaseOrderStatus.PARTIALLY_RECEIVED;

    await this.prisma.purchaseOrder.update({
      where: { id: dto.poId },
      data: { status: nextPoStatus },
    });

    // 5. Notify warehouse manager & QC lead
    await this.notificationService.dispatch({
      organizationId,
      companyId,
      recipientId:
        dto.receivedById ||
        actor?.id ||
        po.createdById ||
        '00000000-0000-0000-0000-000000000000',
      channel: NotificationChannel.IN_APP,
      title: 'Goods Receipt Note Generated',
      body: `GRN ${grn.grnNumber} generated for PO ${po.poNumber} (${po.vendor.name}). Pending QC inspection.`,
      templateCode: 'GRN_CREATED',
      data: { grnId: grn.id, poId: po.id },
    });

    // 6. Record audit log
    await this.auditService.record({
      organizationId,
      companyId,
      actorId: actor?.id || dto.receivedById,
      actorEmail: actor?.email || 'system@shehswar.com',
      resource: Resource.GOODS_RECEIPT,
      resourceId: grn.id,
      action: Action.CREATE,
      newState: grn as any,
      correlationId: uuidv7(),
    });

    return grn;
  }

  /**
   * Search and filter Goods Receipt Notes
   */
  async findAllGoodsReceipts(filter: GoodsReceiptFilterDto) {
    const where: any = { deletedAt: null };

    if (filter.organizationId) where.organizationId = filter.organizationId;
    if (filter.companyId) where.companyId = filter.companyId;
    if (filter.poId) where.poId = filter.poId;
    if (filter.vendorId) where.vendorId = filter.vendorId;
    if (filter.warehouseId) where.warehouseId = filter.warehouseId;
    if (filter.status) where.status = filter.status;
    if (filter.qcStatus) where.qcStatus = filter.qcStatus;

    if (filter.search) {
      where.OR = [
        { grnNumber: { contains: filter.search, mode: 'insensitive' } },
        { deliveryNoteNumber: { contains: filter.search, mode: 'insensitive' } },
        { carrierName: { contains: filter.search, mode: 'insensitive' } },
      ];
    }

    const page = Number(filter.page) || 1;
    const limit = Number(filter.limit) || 20;
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.goodsReceiptNote.findMany({
        where,
        skip,
        take: limit,
        include: {
          items: true,
          purchaseOrder: { select: { id: true, poNumber: true } },
          vendor: { select: { id: true, name: true, code: true } },
          warehouse: { select: { id: true, name: true, code: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.goodsReceiptNote.count({ where }),
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
   * Get single GRN with full details
   */
  async findGoodsReceiptById(id: string) {
    const grn = await this.prisma.goodsReceiptNote.findUnique({
      where: { id },
      include: {
        items: true,
        purchaseOrder: {
          include: {
            items: true,
          },
        },
        vendor: true,
        warehouse: true,
      },
    });

    if (!grn || grn.deletedAt) {
      throw new NotFoundException(`Goods Receipt Note with ID '${id}' not found`);
    }

    return grn;
  }

  /**
   * Quality Inspection Placeholder: Update QC status and accepted/rejected quantities
   */
  async updateQcInspection(dto: UpdateQcStatusDto, actor?: AuthUser) {
    const grn = await this.findGoodsReceiptById(dto.grnId);

    // Update accepted / rejected quantities if provided
    if (dto.acceptedQuantities || dto.rejectedQuantities) {
      for (const item of grn.items) {
        const accepted = dto.acceptedQuantities?.[item.id] ?? Number(item.acceptedQuantity);
        const rejected = dto.rejectedQuantities?.[item.id] ?? Number(item.rejectedQuantity);

        await this.prisma.goodsReceiptNoteItem.update({
          where: { id: item.id },
          data: {
            acceptedQuantity: accepted,
            rejectedQuantity: rejected,
          },
        });
      }
    }

    const updatedStatus =
      dto.qcStatus === QcStatus.PASSED || dto.qcStatus === QcStatus.WAIVED
        ? GoodsReceiptStatus.ACCEPTED
        : dto.qcStatus === QcStatus.REJECTED
          ? GoodsReceiptStatus.REJECTED
          : GoodsReceiptStatus.QUALITY_PENDING;

    const updated = await this.prisma.goodsReceiptNote.update({
      where: { id: dto.grnId },
      data: {
        qcStatus: dto.qcStatus,
        qcNotes: dto.qcNotes,
        status: updatedStatus,
      },
      include: { items: true },
    });

    await this.auditService.record({
      organizationId: grn.organizationId,
      companyId: grn.companyId,
      actorId: actor?.id || '00000000-0000-0000-0000-000000000000',
      actorEmail: actor?.email || 'system@shehswar.com',
      resource: Resource.GOODS_RECEIPT,
      resourceId: dto.grnId,
      action: Action.OVERRIDE,
      previousState: { qcStatus: grn.qcStatus, status: grn.status },
      newState: { qcStatus: updated.qcStatus, status: updated.status, notes: dto.qcNotes },
      correlationId: uuidv7(),
    });

    return updated;
  }
}
