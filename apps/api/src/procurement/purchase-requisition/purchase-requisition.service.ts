/**
 * SHEHSWAR ONE360 - Purchase Requisition (PR) Service
 *
 * Handles requisition lifecycle:
 * Draft -> Submitted -> Pending Approval -> Approved / Rejected -> Cancelled
 * Features concurrency-safe PR document numbering, line item calculations,
 * and integration with Approval Engine, Audit Service & Notifications.
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
  CreatePurchaseRequisitionDto,
  UpdatePurchaseRequisitionDto,
  PurchaseRequisitionFilterDto,
  PurchaseRequisitionStatus,
  RequisitionPriority,
  Resource,
  Action,
  AuthUser,
  NotificationChannel,
} from '@shehswar/types';

@Injectable()
export class PurchaseRequisitionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly approvalEngine: ApprovalEngineService,
    private readonly documentNumbering: DocumentNumberingService,
    private readonly notificationService: NotificationService,
  ) {}

  /**
   * Create a new Purchase Requisition with auto-generated sequence number
   */
  async createRequisition(dto: CreatePurchaseRequisitionDto, actor?: AuthUser) {
    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('At least one item is required in a Purchase Requisition');
    }

    const organizationId = dto.organizationId || actor?.organizationId;
    const companyId = dto.companyId || actor?.companyId;

    if (!organizationId || !companyId) {
      throw new BadRequestException('Organization and Company context are required to create a Purchase Requisition');
    }

    // 1. Generate sequential PR number atomically
    const prNumber = await this.documentNumbering.getNextDocumentNumber({
      organizationId,
      companyId,
      documentType: 'PR',
    });

    const prId = uuidv7();

    // 2. Calculate item amounts and total
    let totalEstimated = 0;
    const itemsData = dto.items.map((item) => {
      const estimatedRate = Number(item.estimatedRate) || 0;
      const quantity = Number(item.quantity) || 1;
      const estimatedAmount = estimatedRate * quantity;
      totalEstimated += estimatedAmount;

      return {
        id: uuidv7(),
        itemName: item.itemName,
        category: item.category || 'RAW_MATERIAL',
        quantity,
        unit: item.unit || 'KG',
        requiredDate: new Date(item.requiredDate),
        specification: item.specification,
        estimatedRate,
        estimatedAmount,
        notes: item.notes,
      };
    });

    const requisition = await this.prisma.purchaseRequisition.create({
      data: {
        id: prId,
        organizationId,
        companyId,
        departmentId: dto.departmentId,
        prNumber,
        requestedById:
          dto.requestedById || actor?.id || '00000000-0000-0000-0000-000000000000',
        requestedByName:
          dto.requestedByName ||
          `${actor?.firstName || ''} ${actor?.lastName || ''}`.trim() ||
          actor?.email,
        requiredDate: new Date(dto.requiredDate),
        priority: dto.priority || RequisitionPriority.NORMAL,
        purpose: dto.purpose,
        notes: dto.notes,
        status: PurchaseRequisitionStatus.DRAFT,
        totalEstimatedAmount: totalEstimated,
        items: {
          create: itemsData,
        },
      },
      include: {
        items: true,
        department: { select: { id: true, name: true, code: true } },
        company: { select: { id: true, name: true, code: true } },
      },
    });

    // Record audit log
    await this.auditService.record({
      organizationId,
      companyId,
      actorId: actor?.id || dto.requestedById,
      actorEmail: actor?.email || 'system@shehswar.com',
      resource: Resource.PURCHASE_REQUISITION,
      resourceId: requisition.id,
      action: Action.CREATE,
      newState: requisition as any,
      correlationId: uuidv7(),
    });

    return requisition;
  }

  /**
   * Search and filter Purchase Requisitions with pagination
   */
  async findAllRequisitions(filter: PurchaseRequisitionFilterDto) {
    const where: any = { deletedAt: null };

    if (filter.organizationId) where.organizationId = filter.organizationId;
    if (filter.companyId) where.companyId = filter.companyId;
    if (filter.departmentId) where.departmentId = filter.departmentId;
    if (filter.status) where.status = filter.status;
    if (filter.priority) where.priority = filter.priority;

    if (filter.search) {
      where.OR = [
        { prNumber: { contains: filter.search, mode: 'insensitive' } },
        { purpose: { contains: filter.search, mode: 'insensitive' } },
        { requestedByName: { contains: filter.search, mode: 'insensitive' } },
      ];
    }

    const page = Number(filter.page) || 1;
    const limit = Number(filter.limit) || 20;
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.purchaseRequisition.findMany({
        where,
        skip,
        take: limit,
        include: {
          items: true,
          department: { select: { id: true, name: true, code: true } },
          company: { select: { id: true, name: true, code: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.purchaseRequisition.count({ where }),
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
   * Get single PR with full line item details and RFQ/PO links
   */
  async findRequisitionById(id: string) {
    const requisition = await this.prisma.purchaseRequisition.findUnique({
      where: { id },
      include: {
        items: true,
        department: { select: { id: true, name: true, code: true } },
        company: { select: { id: true, name: true, code: true } },
        rfqs: {
          select: {
            id: true,
            rfqNumber: true,
            title: true,
            status: true,
            deadline: true,
          },
        },
        purchaseOrders: {
          select: {
            id: true,
            poNumber: true,
            totalAmount: true,
            status: true,
          },
        },
      },
    });

    if (!requisition || requisition.deletedAt) {
      throw new NotFoundException(`Purchase Requisition with ID '${id}' not found`);
    }

    return requisition;
  }

  /**
   * Update PR details and items in DRAFT state
   */
  async updateRequisition(id: string, dto: UpdatePurchaseRequisitionDto, actor?: AuthUser) {
    const previous = await this.findRequisitionById(id);

    if (previous.status !== PurchaseRequisitionStatus.DRAFT) {
      throw new BadRequestException(
        `Only DRAFT requisitions can be edited (current status: ${previous.status})`,
      );
    }

    let totalEstimated = Number(previous.totalEstimatedAmount);

    if (dto.items && dto.items.length > 0) {
      // Re-create items transactionally
      totalEstimated = 0;
      await this.prisma.purchaseRequisitionItem.deleteMany({ where: { prId: id } });
      const itemsData = dto.items.map((item) => {
        const estimatedRate = Number(item.estimatedRate) || 0;
        const quantity = Number(item.quantity) || 1;
        const lineAmt = estimatedRate * quantity;
        totalEstimated += lineAmt;

        return {
          id: uuidv7(),
          prId: id,
          itemName: item.itemName,
          category: item.category || 'RAW_MATERIAL',
          quantity,
          unit: item.unit || 'KG',
          requiredDate: new Date(item.requiredDate),
          specification: item.specification,
          estimatedRate,
          estimatedAmount: lineAmt,
          notes: item.notes,
        };
      });

      await this.prisma.purchaseRequisitionItem.createMany({ data: itemsData });
    }

    const updated = await this.prisma.purchaseRequisition.update({
      where: { id },
      data: {
        departmentId: dto.departmentId ?? previous.departmentId,
        requiredDate: dto.requiredDate ? new Date(dto.requiredDate) : previous.requiredDate,
        priority: dto.priority ?? previous.priority,
        purpose: dto.purpose ?? previous.purpose,
        notes: dto.notes ?? previous.notes,
        totalEstimatedAmount: totalEstimated,
      },
      include: { items: true, department: true },
    });

    await this.auditService.record({
      organizationId: previous.organizationId,
      companyId: previous.companyId,
      actorId: actor?.id || '00000000-0000-0000-0000-000000000000',
      actorEmail: actor?.email || 'system@shehswar.com',
      resource: Resource.PURCHASE_REQUISITION,
      resourceId: id,
      action: Action.EDIT,
      previousState: previous as any,
      newState: updated as any,
      correlationId: uuidv7(),
    });

    return updated;
  }

  /**
   * Submit PR to multi-tier approval workflow engine
   */
  async submitForApproval(id: string, actor: AuthUser) {
    const pr = await this.findRequisitionById(id);

    if (pr.status !== PurchaseRequisitionStatus.DRAFT) {
      throw new BadRequestException(
        `Only DRAFT requisitions can be submitted (current status: ${pr.status})`,
      );
    }

    // Submit to ApprovalEngine
    await this.approvalEngine.submitForApproval({
      organizationId: pr.organizationId,
      companyId: pr.companyId,
      documentType: 'PR',
      documentId: pr.id,
      amount: Number(pr.totalEstimatedAmount),
      requestedById: actor.id,
    });

    const updated = await this.prisma.purchaseRequisition.update({
      where: { id },
      data: { status: PurchaseRequisitionStatus.PENDING_APPROVAL },
    });

    // Notify requester
    await this.notificationService.dispatch({
      organizationId: pr.organizationId,
      companyId: pr.companyId,
      recipientId: actor.id,
      channel: NotificationChannel.IN_APP,
      title: 'Purchase Requisition Submitted',
      body: `Requisition ${pr.prNumber} for PKR ${pr.totalEstimatedAmount} submitted for management approval.`,
      templateCode: 'PR_SUBMITTED',
      data: { prId: pr.id, linkUrl: `/procurement/purchase-requisitions/${pr.id}` },
    });

    await this.auditService.record({
      organizationId: pr.organizationId,
      companyId: pr.companyId,
      actorId: actor.id,
      actorEmail: actor.email,
      resource: Resource.PURCHASE_REQUISITION,
      resourceId: id,
      action: Action.SUBMIT,
      previousState: { status: pr.status },
      newState: { status: updated.status },
      correlationId: uuidv7(),
    });

    return updated;
  }

  /**
   * Approve or reject PR
   */
  async processApproval(
    id: string,
    action: 'APPROVE' | 'REJECT',
    comments?: string,
    actor?: AuthUser,
  ) {
    const pr = await this.findRequisitionById(id);

    if (pr.status !== PurchaseRequisitionStatus.PENDING_APPROVAL) {
      throw new BadRequestException(
        `Requisition must be PENDING_APPROVAL (current status: ${pr.status})`,
      );
    }

    const isApproved = action === 'APPROVE';
    const newStatus = isApproved
      ? PurchaseRequisitionStatus.APPROVED
      : PurchaseRequisitionStatus.REJECTED;

    const updated = await this.prisma.purchaseRequisition.update({
      where: { id },
      data: {
        status: newStatus,
        approvedAt: isApproved ? new Date() : undefined,
        approvedById: isApproved ? actor?.id : undefined,
        rejectionReason: !isApproved ? comments : undefined,
      },
    });

    // Dispatch notification
    await this.notificationService.dispatch({
      organizationId: pr.organizationId,
      companyId: pr.companyId,
      recipientId: pr.requestedById,
      channel: NotificationChannel.IN_APP,
      title: `Purchase Requisition ${isApproved ? 'Approved' : 'Rejected'}`,
      body: `Requisition ${pr.prNumber} has been ${isApproved ? 'approved' : 'rejected'}.${comments ? ' Reason: ' + comments : ''}`,
      templateCode: `PR_${action}`,
      data: { prId: pr.id, comments },
    });

    await this.auditService.record({
      organizationId: pr.organizationId,
      companyId: pr.companyId,
      actorId: actor?.id || '00000000-0000-0000-0000-000000000000',
      actorEmail: actor?.email || 'system@shehswar.com',
      resource: Resource.PURCHASE_REQUISITION,
      resourceId: id,
      action: isApproved ? Action.APPROVE : Action.REJECT,
      previousState: { status: pr.status },
      newState: { status: updated.status, comments },
      correlationId: uuidv7(),
    });

    return updated;
  }

  /**
   * Cancel an open requisition
   */
  async cancelRequisition(id: string, reason: string, actor?: AuthUser) {
    const pr = await this.findRequisitionById(id);

    if (
      pr.status === PurchaseRequisitionStatus.CANCELLED ||
      pr.status === PurchaseRequisitionStatus.REJECTED
    ) {
      throw new BadRequestException(`Requisition is already ${pr.status}`);
    }

    const updated = await this.prisma.purchaseRequisition.update({
      where: { id },
      data: {
        status: PurchaseRequisitionStatus.CANCELLED,
        notes: pr.notes ? `${pr.notes}\nCancelled: ${reason}` : `Cancelled: ${reason}`,
      },
    });

    await this.auditService.record({
      organizationId: pr.organizationId,
      companyId: pr.companyId,
      actorId: actor?.id || '00000000-0000-0000-0000-000000000000',
      actorEmail: actor?.email || 'system@shehswar.com',
      resource: Resource.PURCHASE_REQUISITION,
      resourceId: id,
      action: Action.CANCEL,
      previousState: { status: pr.status },
      newState: { status: updated.status, reason },
      correlationId: uuidv7(),
    });

    return updated;
  }
}
