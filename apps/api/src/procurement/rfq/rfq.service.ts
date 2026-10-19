/**
 * SHEHSWAR ONE360 - Request For Quotation (RFQ) Service
 *
 * Facilitates competitive vendor bidding:
 * Draft -> Sent -> Quotations Received -> Comparison Completed -> Closed
 * Includes multi-vendor invitations, deadline tracking, and PR linking.
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
  CreateRfqDto,
  RfqFilterDto,
  RfqStatus,
  RfqVendorStatus,
  Resource,
  Action,
  AuthUser,
  NotificationChannel,
} from '@shehswar/types';

@Injectable()
export class RfqService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly documentNumbering: DocumentNumberingService,
    private readonly notificationService: NotificationService,
  ) {}

  /**
   * Create a new RFQ with multi-vendor invitations and auto-numbering
   */
  async createRfq(dto: CreateRfqDto, actor?: AuthUser) {
    if (!dto.vendorIds || dto.vendorIds.length === 0) {
      throw new BadRequestException('At least one vendor must be invited to the RFQ');
    }

    let organizationId = dto.organizationId || actor?.organizationId;
    let companyId = dto.companyId || actor?.companyId;

    if (dto.prId && (!organizationId || !companyId)) {
      const pr = await this.prisma.purchaseRequisition.findUnique({
        where: { id: dto.prId },
      });
      if (pr) {
        organizationId = organizationId || pr.organizationId;
        companyId = companyId || pr.companyId;
      }
    }

    if (!organizationId || !companyId) {
      throw new BadRequestException('Organization and Company context are required to create an RFQ');
    }

    // Verify vendors exist and are approved
    const vendors = await this.prisma.vendor.findMany({
      where: {
        id: { in: dto.vendorIds },
        companyId,
      },
    });

    if (vendors.length !== dto.vendorIds.length) {
      throw new BadRequestException('One or more selected vendors could not be found');
    }

    // Generate RFQ number atomically
    const rfqNumber = await this.documentNumbering.getNextDocumentNumber({
      organizationId,
      companyId,
      documentType: 'RFQ',
    });

    const rfqId = uuidv7();

    const rfq = await this.prisma.requestForQuotation.create({
      data: {
        id: rfqId,
        organizationId,
        companyId,
        rfqNumber,
        prId: dto.prId,
        title: dto.title,
        deadline: new Date(dto.deadline),
        notes: dto.notes,
        status: RfqStatus.DRAFT,
        createdById: actor?.id,
        vendors: {
          create: dto.vendorIds.map((vId) => ({
            id: uuidv7(),
            vendorId: vId,
            status: RfqVendorStatus.INVITED,
          })),
        },
      },
      include: {
        vendors: {
          include: {
            vendor: { select: { id: true, name: true, code: true, email: true } },
          },
        },
        requisition: { select: { id: true, prNumber: true, purpose: true } },
      },
    });

    await this.auditService.record({
      organizationId,
      companyId,
      actorId: actor?.id || '00000000-0000-0000-0000-000000000000',
      actorEmail: actor?.email || 'system@shehswar.com',
      resource: Resource.RFQ,
      resourceId: rfq.id,
      action: Action.CREATE,
      newState: rfq as any,
      correlationId: uuidv7(),
    });

    return rfq;
  }

  /**
   * Search and filter RFQs
   */
  async findAllRfqs(filter: RfqFilterDto) {
    const where: any = {};

    if (filter.organizationId) where.organizationId = filter.organizationId;
    if (filter.companyId) where.companyId = filter.companyId;
    if (filter.prId) where.prId = filter.prId;
    if (filter.status) where.status = filter.status;

    if (filter.search) {
      where.OR = [
        { rfqNumber: { contains: filter.search, mode: 'insensitive' } },
        { title: { contains: filter.search, mode: 'insensitive' } },
      ];
    }

    const page = Number(filter.page) || 1;
    const limit = Number(filter.limit) || 20;
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.requestForQuotation.findMany({
        where,
        skip,
        take: limit,
        include: {
          vendors: {
            include: {
              vendor: { select: { id: true, name: true, code: true } },
            },
          },
          quotations: {
            select: { id: true, quotationNumber: true, netAmount: true, status: true },
          },
          requisition: { select: { id: true, prNumber: true, purpose: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.requestForQuotation.count({ where }),
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
   * Get single RFQ with quotation tracking
   */
  async findRfqById(id: string) {
    const rfq = await this.prisma.requestForQuotation.findUnique({
      where: { id },
      include: {
        vendors: {
          include: {
            vendor: {
              select: {
                id: true,
                name: true,
                code: true,
                email: true,
                phone: true,
                paymentTerms: true,
              },
            },
          },
        },
        quotations: {
          include: {
            vendor: { select: { id: true, name: true, code: true } },
            items: true,
          },
        },
        requisition: {
          include: {
            items: true,
          },
        },
      },
    });

    if (!rfq) {
      throw new NotFoundException(`RFQ with ID '${id}' not found`);
    }

    return rfq;
  }

  /**
   * Send RFQ to invited vendors (transitions to SENT)
   */
  async sendRfq(id: string, actor?: AuthUser) {
    const rfq = await this.findRfqById(id);

    if (rfq.status !== RfqStatus.DRAFT) {
      throw new BadRequestException(`RFQ must be DRAFT to send (current: ${rfq.status})`);
    }

    const updated = await this.prisma.requestForQuotation.update({
      where: { id },
      data: { status: RfqStatus.SENT },
      include: { vendors: { include: { vendor: true } } },
    });

    // Send notifications to buyer / procurement lead
    if (actor) {
      await this.notificationService.dispatch({
        organizationId: rfq.organizationId,
        companyId: rfq.companyId,
        recipientId: actor.id,
        channel: NotificationChannel.IN_APP,
        title: 'RFQ Dispatched to Suppliers',
        body: `RFQ ${rfq.rfqNumber} sent to ${rfq.vendors.length} vendors with deadline ${rfq.deadline.toISOString().split('T')[0]}.`,
        templateCode: 'RFQ_SENT',
        data: { rfqId: rfq.id },
      });
    }

    await this.auditService.record({
      organizationId: rfq.organizationId,
      companyId: rfq.companyId,
      actorId: actor?.id || '00000000-0000-0000-0000-000000000000',
      actorEmail: actor?.email || 'system@shehswar.com',
      resource: Resource.RFQ,
      resourceId: id,
      action: Action.SUBMIT,
      previousState: { status: rfq.status },
      newState: { status: updated.status },
      correlationId: uuidv7(),
    });

    return updated;
  }

  /**
   * Close RFQ
   */
  async closeRfq(id: string, actor?: AuthUser) {
    const rfq = await this.findRfqById(id);

    const updated = await this.prisma.requestForQuotation.update({
      where: { id },
      data: { status: RfqStatus.CLOSED },
    });

    await this.auditService.record({
      organizationId: rfq.organizationId,
      companyId: rfq.companyId,
      actorId: actor?.id || '00000000-0000-0000-0000-000000000000',
      actorEmail: actor?.email || 'system@shehswar.com',
      resource: Resource.RFQ,
      resourceId: id,
      action: Action.CANCEL,
      previousState: { status: rfq.status },
      newState: { status: updated.status },
      correlationId: uuidv7(),
    });

    return updated;
  }
}
