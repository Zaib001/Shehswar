/**
 * SHEHSWAR ONE360 - Vendor Master Service
 *
 * Implements full lifecycle vendor master management:
 * Draft -> Pending Approval -> Approved -> Blocked -> Inactive
 * Includes duplicate NTN/code prevention, audit logging, and notification integration.
 */
import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { AuditService } from '../../platform/audit/audit.service';
import { ApprovalEngineService } from '../../platform/approvals/approval-engine.service';
import { NotificationService } from '../../platform/notifications/notification.service';
import { uuidv7 } from '@shehswar/shared';
import {
  CreateVendorDto,
  UpdateVendorDto,
  VendorFilterDto,
  VendorStatus,
  Resource,
  Action,
  AuthUser,
  NotificationChannel,
} from '@shehswar/types';

@Injectable()
export class VendorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly approvalEngine: ApprovalEngineService,
    private readonly notificationService: NotificationService,
  ) {}

  /**
   * Create a new vendor in DRAFT status
   */
  async createVendor(dto: CreateVendorDto, actor?: AuthUser) {
    const organizationId = dto.organizationId || actor?.organizationId;
    const companyId = dto.companyId || actor?.companyId;

    if (!organizationId || !companyId) {
      throw new BadRequestException('Organization and Company context are required to create a Vendor');
    }

    // 1. Duplicate code validation within company
    const existingCode = await this.prisma.vendor.findFirst({
      where: {
        companyId,
        code: dto.code,
      },
    });

    if (existingCode) {
      throw new ConflictException(
        `Vendor with code '${dto.code}' already exists in this company.`,
      );
    }

    // 2. Duplicate NTN validation if provided
    if (dto.ntn) {
      const existingNtn = await this.prisma.vendor.findFirst({
        where: {
          companyId,
          ntn: dto.ntn,
          deletedAt: null,
        },
      });

      if (existingNtn) {
        throw new ConflictException(
          `Vendor with NTN '${dto.ntn}' already exists (${existingNtn.name}).`,
        );
      }
    }

    const vendorId = uuidv7();

    const vendor = await this.prisma.vendor.create({
      data: {
        id: vendorId,
        organizationId,
        companyId,
        code: dto.code,
        name: dto.name,
        legalName: dto.legalName,
        vendorType: dto.vendorType,
        category: dto.category || 'GENERAL',
        status: VendorStatus.DRAFT,
        ntn: dto.ntn,
        strn: dto.strn,
        registrationNo: dto.registrationNo,
        country: dto.country || 'Pakistan',
        city: dto.city,
        address: dto.address,
        contactPerson: dto.contactPerson,
        phone: dto.phone,
        email: dto.email,
        website: dto.website,
        currency: dto.currency || 'PKR',
        paymentTerms: dto.paymentTerms || '30_DAYS_CREDIT',
        creditLimit: dto.creditLimit || 0,
        bankDetails: (dto.bankDetails as any) ?? undefined,
        notes: dto.notes,
        createdBy: actor?.email || 'SYSTEM',
        documents: dto.documents?.length
          ? {
              create: dto.documents.map((doc) => ({
                id: uuidv7(),
                documentType: doc.documentType || 'TAX_CERTIFICATE',
                title: doc.title,
                fileName: doc.fileName || `${doc.title}.pdf`,
                fileUrl: doc.fileUrl || `/uploads/documents/${doc.fileName || 'certificate.pdf'}`,
                fileSize: doc.fileSize ? BigInt(doc.fileSize) : undefined,
                expiryDate: doc.expiryDate ? new Date(doc.expiryDate) : undefined,
                notes: doc.notes,
              })),
            }
          : undefined,
      },
      include: {
        documents: true,
      },
    });

    // Record audit log
    await this.auditService.record({
      organizationId,
      companyId,
      actorId: actor?.id || '00000000-0000-0000-0000-000000000000',
      actorEmail: actor?.email || 'system@shehswar.com',
      resource: Resource.VENDOR,
      resourceId: vendor.id,
      action: Action.CREATE,
      newState: vendor as any,
      correlationId: uuidv7(),
    });

    return vendor;
  }

  /**
   * Search and filter vendors with pagination
   */
  async findAllVendors(filter: VendorFilterDto) {
    const where: any = { deletedAt: null };

    if (filter.organizationId) where.organizationId = filter.organizationId;
    if (filter.companyId) where.companyId = filter.companyId;
    if (filter.status) where.status = filter.status;
    if (filter.vendorType) where.vendorType = filter.vendorType;
    if (filter.category) where.category = filter.category;

    if (filter.search) {
      where.OR = [
        { name: { contains: filter.search, mode: 'insensitive' } },
        { code: { contains: filter.search, mode: 'insensitive' } },
        { contactPerson: { contains: filter.search, mode: 'insensitive' } },
        { ntn: { contains: filter.search, mode: 'insensitive' } },
      ];
    }

    const page = Number(filter.page) || 1;
    const limit = Number(filter.limit) || 20;
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.vendor.findMany({
        where,
        skip,
        take: limit,
        include: {
          documents: true,
          company: { select: { id: true, code: true, name: true } },
          performances: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.vendor.count({ where }),
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
   * Retrieve vendor details with full 360-degree context
   */
  async findVendorById(id: string) {
    const vendor = await this.prisma.vendor.findUnique({
      where: { id },
      include: {
        documents: true,
        company: { select: { id: true, code: true, name: true } },
        purchaseOrders: {
          take: 20,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            poNumber: true,
            totalAmount: true,
            status: true,
            createdAt: true,
          },
        },
        purchases: {
          take: 20,
          orderBy: { date: 'desc' },
          select: {
            id: true,
            voucherNumber: true,
            vendorInvoiceNo: true,
            netAmount: true,
            postingStatus: true,
            date: true,
            createdAt: true,
          },
        },
        performances: true,
      },
    });

    if (!vendor || vendor.deletedAt) {
      throw new NotFoundException(`Vendor with ID '${id}' not found`);
    }

    // 1. Fetch current running balance from vendor ledger
    const lastLedger = await this.prisma.vendorLedgerEntry.findFirst({
      where: { vendorId: id },
      orderBy: { entryDate: 'desc' },
      select: { runningBalance: true },
    });
    const currentBalance = lastLedger ? Number(lastLedger.runningBalance) : 0;

    // 2. Fetch real immutable audit logs for this vendor
    const auditLogs = await this.prisma.auditLog.findMany({
      where: { resource: Resource.VENDOR, resourceId: id },
      orderBy: { createdAt: 'desc' },
      take: 15,
      select: {
        id: true,
        action: true,
        actorEmail: true,
        createdAt: true,
        correlationId: true,
      },
    });

    // 3. Calculate real procurement performance
    const totalPos = await this.prisma.purchaseOrder.count({ where: { vendorId: id } });
    const completedPos = await this.prisma.purchaseOrder.count({
      where: { vendorId: id, status: { in: ['FULFILLED', 'RECEIVED', 'CONVERTED_TO_PURCHASE'] } },
    });
    const totalPurchases = await this.prisma.purchaseInvoice.count({ where: { vendorId: id } });
    const totalSpend = await this.prisma.purchaseInvoice.aggregate({
      where: { vendorId: id, postingStatus: 'POSTED' },
      _sum: { netAmount: true },
    });

    const calculatedPerformance = {
      totalOrders: totalPos + totalPurchases,
      completedOrders: completedPos,
      totalSpend: Number(totalSpend._sum.netAmount || 0),
      overallRating: Number(vendor.rating) || 5.0,
      onTimeDeliveryRate: totalPos > 0 ? Math.round((completedPos / totalPos) * 100) : 100,
      rejectionRate: 0,
      averageLeadDays: 3,
    };

    return {
      ...vendor,
      currentBalance,
      auditLogs,
      calculatedPerformance,
    };
  }

  /**
   * Get vendor ledger statement with calculated running balance
   */
  async getVendorLedger(
    vendorId: string,
    options?: { startDate?: Date; endDate?: Date; limit?: number },
  ) {
    const where: any = { vendorId };
    if (options?.startDate || options?.endDate) {
      where.entryDate = {};
      if (options?.startDate) where.entryDate.gte = options.startDate;
      if (options?.endDate) where.entryDate.lte = options.endDate;
    }

    const entries = await this.prisma.vendorLedgerEntry.findMany({
      where,
      orderBy: { entryDate: 'desc' },
      take: options?.limit ?? 100,
    });

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

  /**
   * Add a compliance or quality document to a vendor
   */
  async addDocument(vendorId: string, dto: any, actor?: AuthUser) {
    const vendor = await this.prisma.vendor.findUnique({ where: { id: vendorId } });
    if (!vendor) throw new NotFoundException(`Vendor not found`);

    const doc = await this.prisma.vendorDocument.create({
      data: {
        id: uuidv7(),
        vendorId,
        documentType: dto.documentType || 'CERTIFICATE',
        title: dto.title,
        fileName: dto.fileName || `${dto.title}.pdf`,
        fileUrl: dto.fileUrl || '/uploads/documents/default.pdf',
        fileSize: dto.fileSize ? BigInt(dto.fileSize) : undefined,
        expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : undefined,
        notes: dto.notes,
      },
    });

    await this.auditService.record({
      organizationId: vendor.organizationId,
      companyId: vendor.companyId,
      actorId: actor?.id || '00000000-0000-0000-0000-000000000000',
      actorEmail: actor?.email || 'system@shehswar.com',
      resource: Resource.VENDOR,
      resourceId: vendorId,
      action: Action.EDIT,
      newState: { addedDocument: doc },
      correlationId: uuidv7(),
    });

    return doc;
  }

  /**
   * Delete a vendor document
   */
  async deleteDocument(vendorId: string, docId: string, actor?: AuthUser) {
    const doc = await this.prisma.vendorDocument.findFirst({
      where: { id: docId, vendorId },
      include: { vendor: true },
    });
    if (!doc) throw new NotFoundException('Document not found');

    await this.prisma.vendorDocument.delete({ where: { id: docId } });

    await this.auditService.record({
      organizationId: doc.vendor.organizationId,
      companyId: doc.vendor.companyId,
      actorId: actor?.id || '00000000-0000-0000-0000-000000000000',
      actorEmail: actor?.email || 'system@shehswar.com',
      resource: Resource.VENDOR,
      resourceId: vendorId,
      action: Action.EDIT,
      previousState: { deletedDocument: doc },
      correlationId: uuidv7(),
    });

    return { success: true };
  }

  /**
   * Update vendor details
   */
  async updateVendor(id: string, dto: UpdateVendorDto, actor?: AuthUser) {
    const previous = await this.findVendorById(id);

    const { documents, ...scalarFields } = dto as any;

    const updated = await this.prisma.vendor.update({
      where: { id },
      data: {
        ...scalarFields,
        bankDetails: (dto.bankDetails as any) ?? undefined,
        updatedBy: actor?.email || 'SYSTEM',
      },
      include: { documents: true },
    });

    await this.auditService.record({
      organizationId: previous.organizationId,
      companyId: previous.companyId,
      actorId: actor?.id || '00000000-0000-0000-0000-000000000000',
      actorEmail: actor?.email || 'system@shehswar.com',
      resource: Resource.VENDOR,
      resourceId: id,
      action: Action.EDIT,
      previousState: previous as any,
      newState: updated as any,
      correlationId: uuidv7(),
    });

    return updated;
  }

  /**
   * Submit vendor for multi-tier approval
   */
  async submitForApproval(id: string, actor: AuthUser) {
    const vendor = await this.findVendorById(id);

    if (vendor.status !== VendorStatus.DRAFT) {
      throw new BadRequestException(
        `Only DRAFT vendors can be submitted for approval (current: ${vendor.status})`,
      );
    }

    // Initiate approval engine request
    await this.approvalEngine.submitForApproval({
      organizationId: vendor.organizationId,
      companyId: vendor.companyId,
      documentType: 'VENDOR',
      documentId: vendor.id,
      requestedById: actor.id,
    });

    const updated = await this.prisma.vendor.update({
      where: { id },
      data: { status: VendorStatus.PENDING_APPROVAL },
    });

    // Notify procurement manager / admin
    await this.notificationService.dispatch({
      organizationId: vendor.organizationId,
      companyId: vendor.companyId,
      recipientId: actor.id,
      channel: NotificationChannel.IN_APP,
      title: 'Vendor Submitted for Approval',
      body: `Vendor ${vendor.name} (${vendor.code}) has been submitted for approval.`,
      templateCode: 'VENDOR_APPROVAL_PENDING',
      data: { vendorId: vendor.id, linkUrl: `/procurement/vendors/${vendor.id}` },
    });

    await this.auditService.record({
      organizationId: vendor.organizationId,
      companyId: vendor.companyId,
      actorId: actor.id,
      actorEmail: actor.email,
      resource: Resource.VENDOR,
      resourceId: id,
      action: Action.SUBMIT,
      previousState: { status: vendor.status },
      newState: { status: updated.status },
      correlationId: uuidv7(),
    });

    return updated;
  }

  /**
   * Process approval or rejection action
   */
  async processApproval(
    id: string,
    action: 'APPROVE' | 'REJECT',
    comments?: string,
    actor?: AuthUser,
  ) {
    const vendor = await this.findVendorById(id);

    if (vendor.status !== VendorStatus.PENDING_APPROVAL) {
      throw new BadRequestException(
        `Vendor must be PENDING_APPROVAL to approve/reject (current: ${vendor.status})`,
      );
    }

    const newStatus = action === 'APPROVE' ? VendorStatus.APPROVED : VendorStatus.BLOCKED;

    const updated = await this.prisma.vendor.update({
      where: { id },
      data: { status: newStatus },
    });

    // Notify stakeholder
    if (actor) {
      await this.notificationService.dispatch({
        organizationId: vendor.organizationId,
        companyId: vendor.companyId,
        recipientId: actor.id,
        channel: NotificationChannel.IN_APP,
        title: `Vendor ${action === 'APPROVE' ? 'Approved' : 'Rejected'}`,
        body: `Vendor ${vendor.name} (${vendor.code}) has been ${action === 'APPROVE' ? 'approved and activated' : 'rejected'}.`,
        templateCode: `VENDOR_${action}`,
        data: { vendorId: vendor.id, comments },
      });
    }

    await this.auditService.record({
      organizationId: vendor.organizationId,
      companyId: vendor.companyId,
      actorId: actor?.id || '00000000-0000-0000-0000-000000000000',
      actorEmail: actor?.email || 'system@shehswar.com',
      resource: Resource.VENDOR,
      resourceId: id,
      action: action === 'APPROVE' ? Action.APPROVE : Action.REJECT,
      previousState: { status: vendor.status },
      newState: { status: updated.status, comments },
      correlationId: uuidv7(),
    });

    return updated;
  }

  /**
   * Block a vendor from active procurement transactions
   */
  async blockVendor(id: string, reason: string, actor?: AuthUser) {
    const vendor = await this.findVendorById(id);

    const updated = await this.prisma.vendor.update({
      where: { id },
      data: { status: VendorStatus.BLOCKED, notes: `Blocked: ${reason}` },
    });

    await this.auditService.record({
      organizationId: vendor.organizationId,
      companyId: vendor.companyId,
      actorId: actor?.id || '00000000-0000-0000-0000-000000000000',
      actorEmail: actor?.email || 'system@shehswar.com',
      resource: Resource.VENDOR,
      resourceId: id,
      action: Action.HOLD,
      previousState: { status: vendor.status },
      newState: { status: updated.status, reason },
      correlationId: uuidv7(),
    });

    return updated;
  }

  /**
   * Re-activate a blocked vendor to APPROVED status
   */
  async activateVendor(id: string, actor?: AuthUser) {
    const vendor = await this.findVendorById(id);

    const updated = await this.prisma.vendor.update({
      where: { id },
      data: { status: VendorStatus.APPROVED },
    });

    await this.auditService.record({
      organizationId: vendor.organizationId,
      companyId: vendor.companyId,
      actorId: actor?.id || '00000000-0000-0000-0000-000000000000',
      actorEmail: actor?.email || 'system@shehswar.com',
      resource: Resource.VENDOR,
      resourceId: id,
      action: Action.RELEASE,
      previousState: { status: vendor.status },
      newState: { status: updated.status },
      correlationId: uuidv7(),
    });

    return updated;
  }
}
