/**
 * SHEHSWAR ONE360 - Sales Service
 *
 * Manages the complete Sales lifecycle:
 *
 * DEALER ORDER (Mobile/ERP):
 *   PENDING → APPROVED/REJECTED → CONVERTED_TO_SALE
 *
 * SALE (Sales Invoice):
 *   DRAFT → POSTED
 *
 * SALES RETURN:
 *   Atomic: Stock +, Dealer Ledger credit
 *
 * All status changes on SalesOrder are on ONE shared record —
 * mobile and ERP read the exact same row.
 */
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { TransactionService } from '../../common/services/transaction.service';
import { InventoryService } from '../inventory/inventory.service';
import { DealerLedgerService } from '../ledger/dealer-ledger.service';
import { DocumentNumberingService } from '../../platform/document-numbering/document-numbering.service';
import { NotificationService } from '../../platform/notifications/notification.service';
import { uuidv7 } from '@shehswar/shared';
import {
  CreateSalesOrderDto,
  ApproveSalesOrderDto,
  CreateSalesInvoiceDto,
  CreateSalesReturnDto,
  AuthUser,
  NotificationChannel,
} from '@shehswar/types';
import { PricingService } from '../pricing/pricing.service';
import { FinanceService } from '../finance/finance.service';
import { CreditControlService } from '../credit/credit-control.service';

@Injectable()
export class SalesService {
  private readonly logger = new Logger(SalesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly transactionService: TransactionService,
    private readonly inventoryService: InventoryService,
    private readonly dealerLedger: DealerLedgerService,
    private readonly documentNumbering: DocumentNumberingService,
    private readonly notificationService: NotificationService,
    private readonly pricingService: PricingService,
    private readonly financeService: FinanceService,
    private readonly creditControlService: CreditControlService,
  ) {}

  // ============================
  // DEALER MANAGEMENT
  // ============================

  async findAllDealers(
    companyId: string,
    filters?: { search?: string; status?: string; salesOfficerId?: string; limit?: number; offset?: number },
    actor?: AuthUser,
  ) {
    const isSuper = actor && (actor.isSuperAdmin || actor.roles?.includes('ROLE_SUPER_ADMIN'));
    const where: any = isSuper ? {} : { companyId };
    if (filters?.status) where.status = filters.status;
    if (filters?.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { code: { contains: filters.search, mode: 'insensitive' } },
        { phone: { contains: filters.search, mode: 'insensitive' } },
      ];
    }
    if (filters?.salesOfficerId) {
      where.OR = [
        { assignedFieldOfficerId: filters.salesOfficerId },
        { officerAssignments: { some: { userId: filters.salesOfficerId } } },
      ];
    }

    // Role-based Market Scope Enforcement (Section 11)
    if (actor && !actor.isSuperAdmin && !actor.roles.includes('ROLE_SUPER_ADMIN') && !actor.roles.includes('ROLE_COMPANY_ADMIN')) {
      const assignments = await this.prisma.userMarketAssignment.findMany({
        where: { userId: actor.id, status: 'ACTIVE' },
      });
      if (assignments.length > 0) {
        const authorizedTerritoryIds = new Set<string>();
        for (const ma of assignments) {
          if (ma.territoryId) authorizedTerritoryIds.add(ma.territoryId);
          if (ma.zoneId) {
            const zTerrs = await this.prisma.territory.findMany({ where: { zoneId: ma.zoneId, isActive: true }, select: { id: true } });
            zTerrs.forEach((t) => authorizedTerritoryIds.add(t.id));
          }
          if (ma.regionId) {
            const rTerrs = await this.prisma.territory.findMany({ where: { zone: { regionId: ma.regionId }, isActive: true }, select: { id: true } });
            rTerrs.forEach((t) => authorizedTerritoryIds.add(t.id));
          }
        }
        const terrList = Array.from(authorizedTerritoryIds);
        where.AND = [
          {
            OR: [
              ...(terrList.length > 0 ? [{ territoryId: { in: terrList } }] : []),
              { assignedFieldOfficerId: actor.id },
              { officerAssignments: { some: { userId: actor.id } } },
            ],
          },
        ];
      }
    }

    const [total, dealers] = await Promise.all([
      this.prisma.dealer.count({ where }),
      this.prisma.dealer.findMany({
        where,
        include: {
          territory: {
            include: {
              zone: {
                include: {
                  region: true,
                },
              },
            },
          },
          assignedOfficer: {
            select: { id: true, firstName: true, lastName: true, email: true, phone: true },
          },
          officerAssignments: {
            include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
          },
          _count: { select: { salesOrders: true, salesInvoices: true } },
        },
        orderBy: { name: 'asc' },
        take: filters?.limit ?? 50,
        skip: filters?.offset ?? 0,
      }),
    ]);

    return { total, data: dealers.map((d) => this.serializeDealer(d)) };
  }

  async findOneDealer(id: string, companyId: string, actor?: AuthUser) {
    const where: any = { id };
    if (!actor?.isSuperAdmin) {
      where.companyId = companyId;
    }
    const dealer = await this.prisma.dealer.findFirst({
      where,
      include: {
        territory: {
          include: {
            zone: {
              include: {
                region: true,
              },
            },
          },
        },
        assignedOfficer: {
          select: { id: true, firstName: true, lastName: true, email: true, phone: true },
        },
        officerAssignments: {
          include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
        },
        assignmentHistory: {
          include: {
            salesOfficer: { select: { id: true, firstName: true, lastName: true } },
            territory: { select: { id: true, name: true, code: true } },
          },
          orderBy: { effectiveFrom: 'desc' },
        },
      },
    });
    if (!dealer) throw new NotFoundException('Dealer not found');

    // Enforce market scope on individual dealer lookup (Section 11)
    if (actor && !actor.isSuperAdmin && !actor.roles.includes('ROLE_SUPER_ADMIN') && !actor.roles.includes('ROLE_COMPANY_ADMIN')) {
      const assignments = await this.prisma.userMarketAssignment.findMany({
        where: { userId: actor.id, status: 'ACTIVE' },
      });
      if (assignments.length > 0) {
        const authorizedTerritoryIds = new Set<string>();
        for (const ma of assignments) {
          if (ma.territoryId) authorizedTerritoryIds.add(ma.territoryId);
          if (ma.zoneId) {
            const zTerrs = await this.prisma.territory.findMany({ where: { zoneId: ma.zoneId, isActive: true }, select: { id: true } });
            zTerrs.forEach((t) => authorizedTerritoryIds.add(t.id));
          }
          if (ma.regionId) {
            const rTerrs = await this.prisma.territory.findMany({ where: { zone: { regionId: ma.regionId }, isActive: true }, select: { id: true } });
            rTerrs.forEach((t) => authorizedTerritoryIds.add(t.id));
          }
        }
        const hasAccess =
          (dealer.territoryId && authorizedTerritoryIds.has(dealer.territoryId)) ||
          dealer.assignedFieldOfficerId === actor.id ||
          dealer.officerAssignments.some((oa) => oa.userId === actor.id);

        if (!hasAccess) {
          throw new ForbiddenException('Access denied: dealer is outside your authorized market scope');
        }
      }
    }

    return this.serializeDealer(dealer);
  }

  async createDealer(dto: any, actor: AuthUser) {
    const organizationId = dto.organizationId || actor.organizationId;
    const companyId = dto.companyId || actor.companyId;

    const existing = await this.prisma.dealer.findFirst({
      where: { companyId, code: dto.code },
    });
    if (existing) throw new ConflictException(`Dealer code '${dto.code}' already exists`);

    const assignedSoId = dto.assignedFieldOfficerId ?? dto.salesOfficerId ?? null;

    const dealer = await this.prisma.dealer.create({
      data: {
        id: uuidv7(),
        organizationId,
        companyId,
        code: dto.code,
        name: dto.name,
        businessName: dto.businessName ?? null,
        contactPerson: dto.contactPerson ?? null,
        phone: dto.phone,
        email: dto.email ?? null,
        city: dto.city ?? null,
        address: dto.address ?? null,
        territoryId: dto.territoryId ?? null,
        assignedFieldOfficerId: assignedSoId,
        creditLimit: dto.creditLimit ?? 0,
        annualAgreementTarget: dto.annualAgreementTarget ?? 0,
        monthlySalesTarget: dto.monthlySalesTarget ?? 0,
        currentBalance: 0,
        status: dto.status ?? 'ACTIVE',
        notes: dto.notes ?? null,
      },
    });

    if (dealer.territoryId || assignedSoId) {
      await this.prisma.dealerAssignmentHistory.create({
        data: {
          id: uuidv7(),
          dealerId: dealer.id,
          salesOfficerId: assignedSoId,
          territoryId: dealer.territoryId,
          effectiveFrom: new Date(),
          assignedById: actor.id,
          notes: 'Initial dealer registration assignment',
        },
      });
    }

    if (assignedSoId) {
      await this.prisma.salesOfficerDealerAssignment.create({
        data: {
          id: uuidv7(),
          userId: assignedSoId,
          dealerId: dealer.id,
          assignedAt: new Date(),
        },
      }).catch(() => null);
    }

    return this.serializeDealer(dealer);
  }

  async updateDealer(id: string, dto: any, actor: AuthUser) {
    const dealer = await this.prisma.dealer.findFirst({ where: { id, companyId: actor.companyId } });
    if (!dealer) throw new NotFoundException('Dealer not found');

    const newTerritoryId = dto.territoryId !== undefined ? (dto.territoryId || null) : dealer.territoryId;
    const newOfficerId = dto.assignedFieldOfficerId !== undefined
      ? (dto.assignedFieldOfficerId || null)
      : (dto.salesOfficerId !== undefined ? (dto.salesOfficerId || null) : dealer.assignedFieldOfficerId);

    const isReassigned = newTerritoryId !== dealer.territoryId || newOfficerId !== dealer.assignedFieldOfficerId;

    const updated = await this.prisma.dealer.update({
      where: { id },
      data: {
        name: dto.name ?? dealer.name,
        businessName: dto.businessName ?? dealer.businessName,
        contactPerson: dto.contactPerson ?? dealer.contactPerson,
        phone: dto.phone ?? dealer.phone,
        email: dto.email ?? dealer.email,
        city: dto.city ?? dealer.city,
        address: dto.address ?? dealer.address,
        territoryId: newTerritoryId,
        assignedFieldOfficerId: newOfficerId,
        creditLimit: dto.creditLimit ?? dealer.creditLimit,
        annualAgreementTarget: dto.annualAgreementTarget ?? dealer.annualAgreementTarget,
        monthlySalesTarget: dto.monthlySalesTarget ?? dealer.monthlySalesTarget,
        status: dto.status ?? dealer.status,
        notes: dto.notes ?? dealer.notes,
      },
    });

    if (isReassigned) {
      // Close previous assignment history record
      await this.prisma.dealerAssignmentHistory.updateMany({
        where: { dealerId: id, effectiveTo: null },
        data: { effectiveTo: new Date() },
      });

      // Create new assignment history record (Section 10 & 19)
      await this.prisma.dealerAssignmentHistory.create({
        data: {
          id: uuidv7(),
          dealerId: id,
          salesOfficerId: newOfficerId,
          territoryId: newTerritoryId,
          effectiveFrom: new Date(),
          assignedById: actor.id,
          notes: dto.assignmentNotes || 'Reassignment of dealer market/officer ownership',
        },
      });

      if (newOfficerId) {
        await this.prisma.salesOfficerDealerAssignment.deleteMany({ where: { dealerId: id } });
        await this.prisma.salesOfficerDealerAssignment.create({
          data: {
            id: uuidv7(),
            userId: newOfficerId,
            dealerId: id,
            assignedAt: new Date(),
          },
        }).catch(() => null);
      }
    }

    return this.serializeDealer(updated);
  }

  async assignSalesOfficer(dealerId: string, userIds: string[], actor: AuthUser) {
    const dealer = await this.prisma.dealer.findFirst({ where: { id: dealerId, companyId: actor.companyId } });
    if (!dealer) throw new NotFoundException('Dealer not found');

    const primaryOfficerId = userIds[0] || null;

    // Update dealer primary assignedFieldOfficerId
    await this.prisma.dealer.update({
      where: { id: dealerId },
      data: { assignedFieldOfficerId: primaryOfficerId },
    });

    // Close previous assignment history
    await this.prisma.dealerAssignmentHistory.updateMany({
      where: { dealerId, effectiveTo: null },
      data: { effectiveTo: new Date() },
    });

    // Create history entry
    await this.prisma.dealerAssignmentHistory.create({
      data: {
        id: uuidv7(),
        dealerId,
        salesOfficerId: primaryOfficerId,
        territoryId: dealer.territoryId,
        effectiveFrom: new Date(),
        assignedById: actor.id,
        notes: 'Sales officer reassignment',
      },
    });

    // Recreate officer assignments
    await this.prisma.salesOfficerDealerAssignment.deleteMany({ where: { dealerId } });
    await this.prisma.salesOfficerDealerAssignment.createMany({
      data: userIds.map((userId) => ({
        id: uuidv7(),
        userId,
        dealerId,
        assignedAt: new Date(),
      })),
      skipDuplicates: true,
    });

    return { dealerId, assignedUserIds: userIds };
  }

  async getDealerMarketHierarchy(dealerId: string, companyId: string) {
    const dealer = await this.prisma.dealer.findFirst({
      where: { id: dealerId, companyId },
      include: {
        territory: {
          include: {
            zone: {
              include: {
                region: {
                  include: {
                    businessManager: { select: { id: true, firstName: true, lastName: true, phone: true } },
                  },
                },
                areaManager: { select: { id: true, firstName: true, lastName: true, phone: true } },
              },
            },
            salesOfficer: { select: { id: true, firstName: true, lastName: true, phone: true } },
          },
        },
        assignedOfficer: { select: { id: true, firstName: true, lastName: true, phone: true } },
      },
    });
    if (!dealer) throw new NotFoundException('Dealer not found');

    const region = dealer.territory?.zone?.region;
    const zone = dealer.territory?.zone;
    const territory = dealer.territory;
    const so = dealer.assignedOfficer || territory?.salesOfficer;

    return {
      dealerId: dealer.id,
      dealerCode: dealer.code,
      dealerName: dealer.name,
      creditLimit: Number(dealer.creditLimit || 0),
      currentBalance: Number(dealer.currentBalance || 0),
      region: region
        ? {
            id: region.id,
            code: region.code,
            name: region.name,
            businessManager: region.businessManager
              ? `${region.businessManager.firstName} ${region.businessManager.lastName}`.trim()
              : 'Unassigned',
          }
        : null,
      zone: zone
        ? {
            id: zone.id,
            code: zone.code,
            name: zone.name,
            areaManager: zone.areaManager
              ? `${zone.areaManager.firstName} ${zone.areaManager.lastName}`.trim()
              : 'Unassigned',
          }
        : null,
      territory: territory
        ? {
            id: territory.id,
            code: territory.code,
            name: territory.name,
          }
        : null,
      salesOfficer: so
        ? {
            id: so.id,
            name: `${so.firstName} ${so.lastName}`.trim(),
            phone: so.phone,
          }
        : null,
    };
  }

  async getDealerAssignmentHistory(dealerId: string, companyId: string, actor?: AuthUser) {
    const isSuper = actor && (actor.isSuperAdmin || actor.roles?.includes('ROLE_SUPER_ADMIN') || actor.roles?.includes('SUPER_ADMIN'));
    const where: any = { id: dealerId };
    if (!isSuper && companyId) {
      where.companyId = companyId;
    }
    const dealer = await this.prisma.dealer.findFirst({
      where,
      include: {
        assignedOfficer: { select: { id: true, firstName: true, lastName: true, email: true } },
        territory: { select: { id: true, code: true, name: true, zone: { select: { name: true, region: { select: { name: true } } } } } },
      },
    });
    if (!dealer) throw new NotFoundException('Dealer not found');

    const history = await this.prisma.dealerAssignmentHistory.findMany({
      where: { dealerId },
      include: {
        salesOfficer: { select: { id: true, firstName: true, lastName: true, email: true } },
        territory: { select: { id: true, code: true, name: true, zone: { select: { name: true, region: { select: { name: true } } } } } },
      },
      orderBy: { effectiveFrom: 'desc' },
    });

    if (history.length === 0 && (dealer.assignedOfficer || dealer.territory)) {
      return [
        {
          id: `curr-${dealer.id}`,
          dealerId: dealer.id,
          salesOfficer: dealer.assignedOfficer,
          territory: dealer.territory,
          effectiveFrom: dealer.createdAt,
          effectiveTo: null,
          reason: 'Initial Registration & Market Assignment',
        },
      ];
    }

    return history;
  }


  // ============================
  // SALES ORDERS
  // ============================

  async findAllOrders(
    companyId: string,
    filters?: {
      dealerId?: string;
      salesOfficerId?: string;
      status?: string;
      search?: string;
      limit?: number;
      offset?: number;
    },
    actor?: AuthUser,
  ) {
    const isSuper = actor && (actor.isSuperAdmin || actor.roles?.includes('ROLE_SUPER_ADMIN'));
    const where: any = isSuper ? {} : { companyId };
    if (filters?.dealerId) where.dealerId = filters.dealerId;
    if (filters?.salesOfficerId) where.salesOfficerId = filters.salesOfficerId;
    if (filters?.status) where.status = filters.status;
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
          salesOfficer: { select: { id: true, firstName: true, lastName: true, email: true } },
          warehouse: { select: { id: true, name: true, code: true } },
          rateList: { select: { id: true, code: true, name: true, category: true } },
          scheme: { select: { id: true, code: true, name: true, schemeType: true } },
          items: {
            include: {
              finishedProduct: { select: { id: true, productCode: true, productName: true } },
              rateList: { select: { id: true, code: true, name: true } },
              scheme: { select: { id: true, code: true, name: true } },
            },
          },
          salesInvoices: { select: { id: true, invoiceNumber: true, postingStatus: true, netAmount: true, invoiceDate: true } },
          _count: { select: { salesInvoices: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: filters?.limit ?? 50,
        skip: filters?.offset ?? 0,
      }),
    ]);

    return { total, data: orders.map((o) => this.serializeOrder(o)) };
  }

  async findOneOrder(id: string, companyId: string) {
    const order = await this.prisma.salesOrder.findFirst({
      where: { id, companyId },
      include: {
        dealer: { select: { id: true, name: true, code: true, currentBalance: true, creditLimit: true, phone: true } },
        salesOfficer: { select: { id: true, firstName: true, lastName: true, email: true } },
        warehouse: { select: { id: true, name: true, code: true } },
        rateList: { select: { id: true, code: true, name: true, category: true } },
        scheme: { select: { id: true, code: true, name: true, schemeType: true } },
        items: {
          include: {
            finishedProduct: { select: { id: true, productCode: true, productName: true, defaultSellingPrice: true } },
            rateList: { select: { id: true, code: true, name: true } },
            scheme: { select: { id: true, code: true, name: true } },
          },
        },
        salesInvoices: { select: { id: true, invoiceNumber: true, postingStatus: true, netAmount: true } },
      },
    });

    if (!order) throw new NotFoundException('Sales order not found');

    // Attach recent payments for admin review context
    const recentPayments = await this.prisma.dealerPaymentReceipt.findMany({
      where: { dealerId: order.dealerId, companyId },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        receiptNumber: true,
        paymentType: true,
        amount: true,
        paymentDate: true,
        bankName: true,
        referenceNumber: true,
        receiptImageUrl: true,
        status: true,
      },
    });

    // Query available stock for each finished product
    const itemsWithStock = await Promise.all(
      order.items.map(async (item) => {
        let availableStock = 0;
        if (item.finishedProductId) {
          const stock = await this.prisma.warehouseStock.findFirst({
            where: {
              companyId,
              finishedProductId: item.finishedProductId,
              ...(order.warehouseId ? { warehouseId: order.warehouseId } : {}),
            },
          });
          availableStock = stock ? Number(stock.quantityOnHand) : 0;
        }
        return {
          ...item,
          quantity: Number(item.quantity),
          unitPrice: Number(item.unitPrice),
          totalPrice: Number(item.totalPrice),
          availableStock,
        };
      }),
    );

    return {
      ...this.serializeOrder(order),
      items: itemsWithStock,
      recentPayments: recentPayments.map((p) => ({ ...p, amount: Number(p.amount) })),
    };
  }

  async createOrder(dto: CreateSalesOrderDto, actor: AuthUser) {
    const organizationId = dto.organizationId || actor.organizationId;
    const companyId = dto.companyId || actor.companyId;

    const dealer = await this.prisma.dealer.findFirst({
      where: { id: dto.dealerId, companyId },
      include: {
        territory: {
          include: {
            zone: {
              include: {
                region: true,
              },
            },
          },
        },
      },
    });
    if (!dealer) throw new NotFoundException('Dealer not found');

    // Section 11 & 16: Validate market scope for non-admin users
    if (!actor.isSuperAdmin && !actor.roles.includes('ROLE_SUPER_ADMIN') && !actor.roles.includes('ROLE_COMPANY_ADMIN')) {
      const assignments = await this.prisma.userMarketAssignment.findMany({
        where: { userId: actor.id, status: 'ACTIVE' },
      });
      if (assignments.length > 0) {
        const authorizedTerritoryIds = new Set<string>();
        for (const ma of assignments) {
          if (ma.territoryId) authorizedTerritoryIds.add(ma.territoryId);
          if (ma.zoneId) {
            const zTerrs = await this.prisma.territory.findMany({ where: { zoneId: ma.zoneId, isActive: true }, select: { id: true } });
            zTerrs.forEach((t) => authorizedTerritoryIds.add(t.id));
          }
          if (ma.regionId) {
            const rTerrs = await this.prisma.territory.findMany({ where: { zone: { regionId: ma.regionId }, isActive: true }, select: { id: true } });
            rTerrs.forEach((t) => authorizedTerritoryIds.add(t.id));
          }
        }
        const hasAccess =
          (dealer.territoryId && authorizedTerritoryIds.has(dealer.territoryId)) ||
          dealer.assignedFieldOfficerId === actor.id;
        if (!hasAccess) {
          throw new ForbiddenException('Cannot create sales order: dealer belongs to an unauthorized territory.');
        }
      }
    }

    // System automatically resolves market hierarchy (Section 13)
    const territoryId = dealer.territoryId ?? null;
    const zoneId = dealer.territory?.zoneId ?? null;
    const regionId = dealer.territory?.zone?.regionId ?? null;
    // Responsible sales officer is resolved from dealer, separate from creator (Section 14 & 15)
    const salesOfficerId = dealer.assignedFieldOfficerId ?? dealer.territory?.managerId ?? dto.salesOfficerId ?? null;
    const areaManagerId = dealer.territory?.zone?.managerId ?? null;
    const businessManagerId = dealer.territory?.zone?.region?.managerId ?? null;
    const createdById = actor.id;

    const orderNumber = await this.documentNumbering.getNextDocumentNumber({
      organizationId,
      companyId,
      documentType: 'SO',
    });

    const paymentTerm = (dto.paymentTerm || 'CASH').toUpperCase();
    const resolvedItems: any[] = [];
    let orderTotalAmount = 0;
    let orderTotalDiscount = 0;
    let orderTotalFreeQty = 0;
    let primarySchemeName: string | null = null;
    let primarySchemeId: string | null = dto.schemeId || null;
    let primaryRateListId: string | null = dto.rateListId || null;
    let primaryRateListVersionId: string | null = dto.rateListVersionId || null;
    let requiresEscalation = false;

    // Server-Authoritative Price Resolution for Each Line Item (Requirement 18, 19, 20, 21, 22, 25)
    for (const item of dto.items) {
      const qty = Number(item.quantity) || 1;
      let unitPrice = Number(item.unitPrice) || 0;
      let baseRate = unitPrice;
      let discountAmount = 0;
      let discountPercent = 0;
      let freeQuantity = 0;
      let totalPrice = unitPrice * qty;
      let breakdown: any = null;
      let appliedCondition = item.commercialCondition || dto.commercialCondition || null;
      let itemSchemeId = item.schemeId || dto.schemeId || null;
      let itemRateListId = item.rateListId || dto.rateListId || null;
      let itemRateListVersionId = item.rateListVersionId || dto.rateListVersionId || null;

      if (item.finishedProductId) {
        // Resolve authoritative pricing from backend engine
        const resolved = await this.pricingService.resolvePrice(
          {
            companyId,
            dealerId: dto.dealerId,
            finishedProductId: item.finishedProductId,
            quantity: qty,
            orderDate: dto.orderDate,
            paymentTerm,
            requestedCondition: item.commercialCondition || dto.commercialCondition,
            requestedSchemeId: itemSchemeId || undefined,
            requestedRateListId: itemRateListId || undefined,
            requestedRate: (actor.isSuperAdmin || actor.roles?.includes('ADMIN') || actor.roles?.includes('BUSINESS_MANAGER') || actor.roles?.includes('AREA_MANAGER')) && item.unitPrice ? Number(item.unitPrice) : undefined,
            pricingPhase: dto.pricingPhase,
          },
          actor,
        );

        baseRate = resolved.baseRate;
        unitPrice = resolved.finalUnitRate;
        discountPercent = resolved.discountPercent;
        discountAmount = resolved.discountAmount;
        freeQuantity = resolved.freeQuantity;
        totalPrice = resolved.finalAmount;
        breakdown = resolved.discountComponents;
        appliedCondition = resolved.commercialCondition || appliedCondition;
        itemSchemeId = resolved.schemeId || itemSchemeId;
        itemRateListId = resolved.rateListId || itemRateListId;
        itemRateListVersionId = resolved.rateListVersionId || itemRateListVersionId;

        if (resolved.approvalRequired) {
          requiresEscalation = true;
          this.logger.debug(`Item ${item.productName} requires escalation: ${resolved.reason}`);
        }
        if (!primarySchemeName && resolved.schemeName) {
          primarySchemeName = resolved.schemeName;
        }
        if (!primarySchemeId && resolved.schemeId) {
          primarySchemeId = resolved.schemeId;
        }
        if (!primaryRateListId && resolved.rateListId) {
          primaryRateListId = resolved.rateListId;
        }
        if (!primaryRateListVersionId && resolved.rateListVersionId) {
          primaryRateListVersionId = resolved.rateListVersionId;
        }
      }

      orderTotalAmount += totalPrice;
      orderTotalDiscount += (discountAmount * qty);
      orderTotalFreeQty += freeQuantity;

      resolvedItems.push({
        id: uuidv7(),
        finishedProductId: item.finishedProductId ?? null,
        rateListId: itemRateListId,
        rateListVersionId: itemRateListVersionId,
        schemeId: itemSchemeId,
        productName: item.productName,
        packing: item.packing ?? null,
        quantity: qty,
        baseRate,
        unitPrice,
        discountPercent,
        discountAmount,
        freeQuantity,
        totalPrice,
        commercialCondition: appliedCondition,
        pricingBreakdown: breakdown ? breakdown : undefined,
      });
    }

    // Centralized 5-tier Hierarchical Credit Control (Requirements 12, 15, 17, 18, 19, 20, 21, 23, 24)
    let creditResult: any = null;
    let isCreditHold = false;
    let creditHoldReason: string | null = null;

    if (paymentTerm === 'CREDIT') {
      creditResult = await this.creditControlService.checkCredit({
        companyId,
        dealerId: dto.dealerId,
        salesOfficerId: salesOfficerId ?? undefined,
        territoryId: territoryId ?? undefined,
        zoneId: zoneId ?? undefined,
        regionId: regionId ?? undefined,
        orderAmount: orderTotalAmount,
        paymentTerm: 'CREDIT',
      });

      if (!creditResult.overall.allowed) {
        isCreditHold = true;
        creditHoldReason = `Credit Limit Exceeded at ${creditResult.overall.blockingLevel} tier: ${creditResult.overall.reason}`;
        this.logger.warn(`Order ${orderNumber} placed on CREDIT_HOLD: ${creditHoldReason}`);
      }
    }

    const orderStatus = isCreditHold ? 'CREDIT_HOLD' : 'PENDING';
    const finalReason = isCreditHold
      ? creditHoldReason
      : (requiresEscalation ? 'Pending manager approval: Line items exceed standard role pricing authority' : null);

    const order = await this.prisma.salesOrder.create({
      data: {
        id: uuidv7(),
        organizationId,
        companyId,
        orderNumber,
        dealerId: dto.dealerId,
        salesOfficerId,
        territoryId,
        zoneId,
        regionId,
        areaManagerId,
        businessManagerId,
        createdById,
        warehouseId: dto.warehouseId ?? null,
        orderDate: dto.orderDate ? new Date(dto.orderDate) : new Date(),
        status: orderStatus as any,
        rejectionReason: finalReason,
        totalAmount: orderTotalAmount,
        discountAmount: orderTotalDiscount,
        freeQuantityTotal: orderTotalFreeQty,
        paymentTerm,
        pricingPhase: dto.pricingPhase ?? 'CASH',
        rateListId: primaryRateListId,
        rateListVersionId: primaryRateListVersionId,
        schemeId: primarySchemeId,
        appliedSchemeName: primarySchemeName,
        commercialCondition: dto.commercialCondition ?? (primarySchemeName || null),
        documentFormat: dto.documentFormat ?? 'COMMERCIAL_FULL',
        notes: dto.notes ?? null,
        items: {
          create: resolvedItems,
        },
      },
      include: {
        dealer: { select: { id: true, name: true, code: true, creditLimit: true, currentBalance: true } },
        salesOfficer: { select: { id: true, firstName: true, lastName: true } },
        territory: { select: { id: true, name: true, code: true } },
        zone: { select: { id: true, name: true, code: true } },
        region: { select: { id: true, name: true, code: true } },
        rateList: { select: { id: true, code: true, name: true } },
        scheme: { select: { id: true, code: true, name: true } },
        items: true,
      },
    });

    this.logger.log(`Sales Order created: ${orderNumber} for dealer ${dealer.name} | Total: ${orderTotalAmount} PKR | Scheme: ${primarySchemeName || 'Standard'}`);
    return this.serializeOrder(order);
  }


  /**
   * Update / customize sales order details, items, or quantities.
   * Allows sales manager to adjust requested quantity (e.g. 100 -> 50) and update line items.
   */
  async updateOrder(
    id: string,
    dto: {
      warehouseId?: string;
      notes?: string;
      orderDate?: string | Date;
      rateListId?: string;
      rateListVersionId?: string;
      schemeId?: string;
      appliedSchemeName?: string;
      commercialCondition?: string;
      paymentTerm?: string;
      discountAmount?: number;
      freeQuantityTotal?: number;
      items?: Array<{
        id?: string;
        finishedProductId?: string;
        rateListId?: string;
        rateListVersionId?: string;
        schemeId?: string;
        productName: string;
        packing?: string;
        quantity: number;
        baseRate?: number;
        unitPrice: number;
        discountPercent?: number;
        discountAmount?: number;
        freeQuantity?: number;
        totalPrice?: number;
        commercialCondition?: string;
        pricingBreakdown?: any;
      }>;
    },
    actor: AuthUser,
  ) {
    const order = await this.prisma.salesOrder.findFirst({
      where: { id, companyId: actor.companyId },
      include: { items: true },
    });
    if (!order) throw new NotFoundException('Sales order not found');
    if (order.status === 'CONVERTED_TO_SALE') {
      throw new BadRequestException('Cannot modify order that has already been converted to sales invoice');
    }

    return this.transactionService.runInTransaction(async (tx) => {
      let totalAmount = Number(order.totalAmount);
      let totalDiscount = dto.discountAmount !== undefined ? Number(dto.discountAmount) : Number(order.discountAmount || 0);
      let totalFreeQty = dto.freeQuantityTotal !== undefined ? Number(dto.freeQuantityTotal) : Number(order.freeQuantityTotal || 0);

      if (dto.items && Array.isArray(dto.items)) {
        totalAmount = dto.items.reduce(
          (sum, it) => sum + (Number(it.totalPrice) || (Number(it.quantity) * Number(it.unitPrice))),
          0,
        );

        if (dto.discountAmount === undefined) {
          totalDiscount = dto.items.reduce(
            (sum, it) => sum + (Number(it.discountAmount || 0) * Number(it.quantity || 1)),
            0,
          );
        }
        if (dto.freeQuantityTotal === undefined) {
          totalFreeQty = dto.items.reduce(
            (sum, it) => sum + Number(it.freeQuantity || 0),
            0,
          );
        }

        // Delete existing items and insert customized items
        await tx.salesOrderItem.deleteMany({ where: { salesOrderId: id } });
        await tx.salesOrderItem.createMany({
          data: dto.items.map((item) => ({
            id: uuidv7(),
            salesOrderId: id,
            finishedProductId: item.finishedProductId ?? null,
            rateListId: item.rateListId ?? dto.rateListId ?? order.rateListId ?? null,
            rateListVersionId: item.rateListVersionId ?? dto.rateListVersionId ?? order.rateListVersionId ?? null,
            schemeId: item.schemeId ?? dto.schemeId ?? order.schemeId ?? null,
            productName: item.productName,
            packing: item.packing ?? null,
            quantity: Number(item.quantity),
            baseRate: item.baseRate !== undefined ? Number(item.baseRate) : Number(item.unitPrice),
            unitPrice: Number(item.unitPrice),
            discountPercent: item.discountPercent !== undefined ? Number(item.discountPercent) : 0,
            discountAmount: item.discountAmount !== undefined ? Number(item.discountAmount) : 0,
            freeQuantity: item.freeQuantity !== undefined ? Number(item.freeQuantity) : 0,
            totalPrice: Number(item.totalPrice) || (Number(item.quantity) * Number(item.unitPrice)),
            commercialCondition: item.commercialCondition ?? dto.commercialCondition ?? order.commercialCondition ?? null,
            pricingBreakdown: item.pricingBreakdown ?? undefined,
          })),
        });
      }

      let appliedSchemeName = dto.appliedSchemeName;
      if (dto.schemeId && !appliedSchemeName) {
        const sc = await tx.pricingScheme.findUnique({ where: { id: dto.schemeId }, select: { name: true } });
        if (sc) appliedSchemeName = sc.name;
      } else if (dto.schemeId === null || dto.schemeId === '') {
        appliedSchemeName = undefined;
      }

      const updated = await tx.salesOrder.update({
        where: { id },
        data: {
          warehouseId: dto.warehouseId !== undefined ? dto.warehouseId : order.warehouseId,
          notes: dto.notes !== undefined ? dto.notes : order.notes,
          orderDate: dto.orderDate ? new Date(dto.orderDate) : order.orderDate,
          rateListId: dto.rateListId !== undefined ? (dto.rateListId || null) : order.rateListId,
          rateListVersionId: dto.rateListVersionId !== undefined ? (dto.rateListVersionId || null) : order.rateListVersionId,
          schemeId: dto.schemeId !== undefined ? (dto.schemeId || null) : order.schemeId,
          appliedSchemeName: appliedSchemeName !== undefined ? appliedSchemeName : order.appliedSchemeName,
          commercialCondition: dto.commercialCondition !== undefined ? dto.commercialCondition : order.commercialCondition,
          paymentTerm: dto.paymentTerm !== undefined ? dto.paymentTerm : order.paymentTerm,
          discountAmount: totalDiscount,
          freeQuantityTotal: totalFreeQty,
          totalAmount,
        },
        include: {
          dealer: { select: { id: true, name: true, code: true } },
          salesOfficer: { select: { id: true, firstName: true, lastName: true } },
          rateList: { select: { id: true, code: true, name: true } },
          scheme: { select: { id: true, code: true, name: true } },
          items: true,
        },
      });

      this.logger.log(`Sales Order ${order.orderNumber} updated by ${actor.email}. Total: ${totalAmount} | Scheme: ${appliedSchemeName || 'None'}`);
      return this.serializeOrder(updated);
    });
  }

  /**
   * Approve or reject a sales order.
   * This is the SINGLE record — mobile sees the same status change immediately.
   */
  async approveOrRejectOrder(
    id: string,
    dto: ApproveSalesOrderDto,
    actor: AuthUser,
  ) {
    const order = await this.prisma.salesOrder.findFirst({
      where: { id, companyId: actor.companyId },
    });
    if (!order) throw new NotFoundException('Sales order not found');
    if (order.status !== 'PENDING') {
      throw new BadRequestException(`Order is already ${order.status}`);
    }

    const newStatus = dto.approved ? 'APPROVED' : 'REJECTED';

    const updated = await this.prisma.salesOrder.update({
      where: { id },
      data: {
        status: newStatus,
        rejectionReason: dto.approved ? null : (dto.rejectionReason ?? null),
        approvedAt: dto.approved ? new Date() : null,
        approvedById: dto.approved ? actor.id : null,
      },
    });

    // Notify the sales officer who created the order
    if (order.salesOfficerId) {
      await this.notificationService.dispatch({
        recipientId: order.salesOfficerId,
        organizationId: order.organizationId,
        companyId: order.companyId,
        templateCode: dto.approved ? 'SO_APPROVED' : 'SO_REJECTED',
        channel: NotificationChannel.IN_APP,
        title: `Sales Order ${dto.approved ? 'Approved' : 'Rejected'}`,
        body: `Order ${order.orderNumber} has been ${newStatus.toLowerCase()}`,
        data: {
          orderNumber: order.orderNumber,
          status: newStatus,
          reason: dto.rejectionReason,
        },
      });
    }

    this.logger.log(`Sales Order ${order.orderNumber} → ${newStatus} by ${actor.email}`);
    return this.serializeOrder(updated);
  }

  async approveOrder(id: string, dto: ApproveSalesOrderDto, actor: AuthUser) {
    return this.approveOrRejectOrder(id, { ...dto, approved: true }, actor);
  }

  async rejectOrder(id: string, rejectionReason: string, actor: AuthUser) {
    return this.approveOrRejectOrder(id, { approved: false, rejectionReason }, actor);
  }

  // ============================
  // CONVERT ORDER → SALE (ATOMIC)
  // ============================

  /**
   * Convert an APPROVED order to a Sales Invoice.
   * Idempotent: order can only be converted once (CONVERTED_TO_SALE).
   * Atomic: Invoice + Stock - + Dealer Ledger in one transaction.
   */
  async convertOrderToSale(
    orderId: string,
    dto: Partial<CreateSalesInvoiceDto>,
    actor: AuthUser,
  ) {
    const order = await this.prisma.salesOrder.findFirst({
      where: { id: orderId, companyId: actor.companyId },
      include: {
        items: { include: { finishedProduct: true } },
        dealer: {
          include: {
            territory: {
              include: {
                zone: {
                  include: {
                    region: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!order) throw new NotFoundException('Sales order not found');
    if (order.status !== 'APPROVED') {
      throw new BadRequestException(`Order must be APPROVED to convert. Current status: ${order.status}`);
    }
    if (order.status === 'CONVERTED_TO_SALE' as any) {
      throw new ConflictException('Order already converted to sale');
    }

    const warehouseId = dto.warehouseId ?? order.warehouseId;
    if (!warehouseId) throw new BadRequestException('Warehouse required for sale posting');

    // Section 24: Credit check before order conversion / sale posting
    if (order.paymentTerm === 'CREDIT') {
      const dealer = order.dealer;
      const territoryId = dealer?.territoryId ?? null;
      const zoneId = dealer?.territory?.zoneId ?? null;
      const regionId = dealer?.territory?.zone?.regionId ?? null;
      const salesOfficerId = order.salesOfficerId ?? dto.salesOfficerId ?? dealer?.assignedFieldOfficerId ?? dealer?.territory?.managerId ?? null;

      const creditCheck = await this.creditControlService.checkCredit({
        companyId: order.companyId,
        dealerId: order.dealerId,
        salesOfficerId: salesOfficerId ?? undefined,
        territoryId: territoryId ?? undefined,
        zoneId: zoneId ?? undefined,
        regionId: regionId ?? undefined,
        orderAmount: Number(order.totalAmount || 0),
        paymentTerm: 'CREDIT',
        orderId: order.id,
      });

      if (!creditCheck.overall.allowed) {
        throw new BadRequestException(
          `Cannot convert order to sale: Credit limit exceeded at ${creditCheck.overall.blockingLevel} tier: ${creditCheck.overall.reason}. An authorized Credit Override is required.`,
        );
      }
    }

    return this.transactionService.runInTransaction(async (tx) => {
      const organizationId = order.organizationId;
      const companyId = order.companyId;

      const invoiceNumber = await this.documentNumbering.getNextDocumentNumber({
        organizationId,
        companyId,
        documentType: 'SINV',
      });

      // Resolve immutable 7-tier market attribution snapshot
      const dealer = order.dealer;
      const territoryId = dealer?.territoryId ?? null;
      const zoneId = dealer?.territory?.zoneId ?? null;
      const regionId = dealer?.territory?.zone?.regionId ?? null;
      const salesOfficerId = order.salesOfficerId ?? dto.salesOfficerId ?? dealer?.assignedFieldOfficerId ?? dealer?.territory?.managerId ?? null;
      const areaManagerId = dealer?.territory?.zone?.managerId ?? null;
      const businessManagerId = dealer?.territory?.zone?.region?.managerId ?? null;

      // Support customized/allocated item quantities on conversion (e.g. manager approves 50 instead of 100)
      const customItems = (dto as any).items && Array.isArray((dto as any).items) && (dto as any).items.length > 0
        ? (dto as any).items
        : null;

      if (customItems) {
        await tx.salesOrderItem.deleteMany({ where: { salesOrderId: order.id } });
        await tx.salesOrderItem.createMany({
          data: customItems.map((item: any) => ({
            id: uuidv7(),
            salesOrderId: order.id,
            finishedProductId: item.finishedProductId ?? null,
            rateListId: item.rateListId ?? order.rateListId ?? null,
            rateListVersionId: item.rateListVersionId ?? order.rateListVersionId ?? null,
            schemeId: item.schemeId ?? order.schemeId ?? null,
            productName: item.productName,
            packing: item.packing ?? null,
            quantity: Number(item.quantity),
            baseRate: item.baseRate !== undefined ? Number(item.baseRate) : Number(item.rate ?? item.unitPrice),
            unitPrice: Number(item.rate ?? item.unitPrice),
            discountPercent: item.discountPercent !== undefined ? Number(item.discountPercent) : 0,
            discountAmount: item.discountAmount !== undefined ? Number(item.discountAmount) : 0,
            freeQuantity: item.freeQuantity !== undefined ? Number(item.freeQuantity) : 0,
            totalPrice: Number(item.totalPrice) || (Number(item.quantity) * Number(item.rate ?? item.unitPrice)),
            commercialCondition: item.commercialCondition ?? order.commercialCondition ?? null,
          })),
        });
      }

      const activeItems = customItems || order.items;
      const netAmount = dto.netAmount ?? activeItems.reduce(
        (sum: number, it: any) => sum + (Number(it.totalPrice) || (Number(it.quantity) * Number(it.rate ?? it.unitPrice))),
        0,
      );

      // 1. Create Sales Invoice carrying all data from the order + immutable snapshot
      const invoice = await tx.salesInvoice.create({
        data: {
          id: uuidv7(),
          organizationId,
          companyId,
          invoiceNumber,
          salesOrderId: order.id,
          dealerId: order.dealerId,
          salesOfficerId,
          territoryId,
          zoneId,
          areaManagerId,
          regionId,
          businessManagerId,
          documentFormat: dto.documentFormat ?? (order as any).documentFormat ?? 'COMMERCIAL_FULL',
          pricingPhase: dto.pricingPhase ?? (order as any).pricingPhase ?? 'CASH',
          commercialCondition: dto.commercialCondition ?? (order as any).commercialCondition ?? null,
          isDeliveryChallan: dto.isDeliveryChallan ?? false,
          batchNumber: dto.batchNumber ?? null,
          cartons: dto.cartons ?? null,
          schemeDescription: dto.schemeDescription ?? order.appliedSchemeName ?? (order as any).scheme?.name ?? null,
          warehouseId,
          invoiceDate: new Date(),
          postingStatus: 'POSTED',
          grossAmount: netAmount,
          discountAmount: dto.discountAmount ?? 0,
          taxAmount: dto.taxAmount ?? 0,
          netAmount,
          notes: dto.notes ?? null,
          createdById: actor.id,
          postedAt: new Date(),
          items: {
            create: activeItems.map((item: any) => {
              const qty = Number(item.quantity);
              const unitRate = Number(item.rate ?? item.unitPrice);
              const baseRate = item.baseRate ? Number(item.baseRate) : unitRate;
              const lineNet = Number(item.totalPrice) || (qty * unitRate);
              const lineGross = baseRate * qty;
              const lineDisc = Math.max(0, lineGross - lineNet);
              return {
                id: uuidv7(),
                finishedProductId: item.finishedProductId ?? null,
                productName: item.productName,
                packing: item.packing ?? null,
                quantity: qty,
                rate: unitRate,
                grossAmount: lineGross,
                discountAmount: lineDisc,
                taxAmount: 0,
                netAmount: lineNet,
              };
            }),
          },
        },
        include: {
          items: true,
          dealer: true,
          warehouse: true,
          salesOrder: {
            include: {
              salesOfficer: {
                select: { id: true, firstName: true, lastName: true, phone: true },
              },
            },
          },
        },
      });

      // 2. Decrease stock for each sold product
      for (const item of activeItems) {
        if (item.finishedProductId) {
          await this.inventoryService.applyMovement(tx, {
            organizationId,
            companyId,
            warehouseId,
            itemType: 'FINISHED_PRODUCT',
            finishedProductId: item.finishedProductId,
            quantityChange: -Number(item.quantity),
            transactionType: 'SALE',
            referenceId: invoice.id,
            referenceNumber: invoiceNumber,
            notes: `Sale to ${order.dealer?.name}`,
          });
        }
      }

      // 3. Dealer Ledger: debit (dealer now owes us)
      await this.dealerLedger.postEntry(tx, {
        organizationId,
        companyId,
        dealerId: order.dealerId,
        entryType: 'SALE_INVOICE',
        referenceId: invoice.id,
        voucherNumber: invoiceNumber,
        description: `Sales Invoice ${invoiceNumber}`,
        debit: netAmount,
        credit: 0,
        salesInvoiceId: invoice.id,
      });

      // 4. General Ledger: Double-entry balanced posting (Section 4 & 60)
      const taxAmt = Number(dto.taxAmount || 0);
      const revAmt = netAmount - taxAmt;
      await this.financeService.postJournalEntry(tx, {
        organizationId,
        companyId,
        entryNumber: `JV-${invoiceNumber}`,
        entryDate: new Date(),
        entryType: 'SALES_INVOICE',
        referenceType: 'SALES_INVOICE',
        referenceId: invoice.id,
        referenceNumber: invoiceNumber,
        description: `Sales Invoice ${invoiceNumber} - ${order.dealer?.name}`,
        createdById: actor.id,
        lines: [
          {
            accountCode: '1100', // Accounts Receivable (Asset)
            debit: netAmount,
            credit: 0,
            dealerId: order.dealerId,
            salesOfficerId: salesOfficerId ?? undefined,
            territoryId: territoryId ?? undefined,
            zoneId: zoneId ?? undefined,
            regionId: regionId ?? undefined,
            description: `Receivable from ${order.dealer?.name}`,
          },
          ...(taxAmt > 0
            ? [
                {
                  accountCode: '4000', // Sales Revenue (Revenue)
                  debit: 0,
                  credit: revAmt,
                  salesOfficerId: salesOfficerId ?? undefined,
                  territoryId: territoryId ?? undefined,
                  zoneId: zoneId ?? undefined,
                  regionId: regionId ?? undefined,
                  description: 'Sales Revenue',
                },
                {
                  accountCode: '2100', // Tax Payable (Liability)
                  debit: 0,
                  credit: taxAmt,
                  salesOfficerId: salesOfficerId ?? undefined,
                  territoryId: territoryId ?? undefined,
                  zoneId: zoneId ?? undefined,
                  regionId: regionId ?? undefined,
                  description: 'Sales Tax Payable',
                },
              ]
            : [
                {
                  accountCode: '4000', // Sales Revenue (Revenue)
                  debit: 0,
                  credit: netAmount,
                  salesOfficerId: salesOfficerId ?? undefined,
                  territoryId: territoryId ?? undefined,
                  zoneId: zoneId ?? undefined,
                  regionId: regionId ?? undefined,
                  description: 'Sales Revenue',
                },
              ]),
        ],
      });

      // 5. Mark order as CONVERTED (idempotency guard)
      await tx.salesOrder.update({
        where: { id: orderId },
        data: { status: 'CONVERTED_TO_SALE' },
      });

      this.logger.log(
        `Order ${order.orderNumber} converted → Invoice ${invoiceNumber} | Net: ${netAmount}`,
      );

      return invoice;
    });
  }

  async deleteOrder(id: string, actor: AuthUser) {
    const order = await this.prisma.salesOrder.findFirst({
      where: { id },
      include: { salesInvoices: true },
    });
    if (!order) throw new NotFoundException('Sales order not found');
    if (order.status === 'CONVERTED_TO_SALE' || order.salesInvoices.length > 0) {
      throw new BadRequestException('Cannot delete an order that has already been converted to a sales invoice.');
    }
    await this.prisma.salesOrderItem.deleteMany({ where: { salesOrderId: id } });
    await this.prisma.salesOrder.delete({ where: { id } });
    this.logger.log(`Order ${order.orderNumber} deleted by user ${actor.id}`);
    return { success: true, message: `Order ${order.orderNumber} deleted successfully.` };
  }

  // ============================
  // SALES INVOICES (DIRECT CRUD & POST)
  // ============================

  async findAllInvoices(
    companyId: string,
    filters?: {
      dealerId?: string;
      warehouseId?: string;
      status?: string;
      search?: string;
      limit?: number;
      offset?: number;
    },
    actor?: AuthUser,
  ) {
    const isSuper = actor && (actor.isSuperAdmin || actor.roles?.includes('ROLE_SUPER_ADMIN'));
    const where: any = isSuper ? {} : { companyId };
    if (filters?.dealerId) where.dealerId = filters.dealerId;
    if (filters?.warehouseId) where.warehouseId = filters.warehouseId;
    if (filters?.status) where.postingStatus = filters.status;
    if (filters?.search) {
      where.OR = [
        { invoiceNumber: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const [total, invoices] = await Promise.all([
      this.prisma.salesInvoice.count({ where }),
      this.prisma.salesInvoice.findMany({
        where,
        include: {
          dealer: { select: { id: true, name: true, code: true, address: true, city: true, phone: true } },
          warehouse: { select: { id: true, name: true, code: true, location: true } },
          items: true,
          salesReturns: {
            include: { items: true },
          },
          salesOrder: {
            select: {
              id: true,
              orderNumber: true,
              orderDate: true,
              salesOfficer: {
                select: { id: true, firstName: true, lastName: true, phone: true },
              },
            },
          },
        },
        orderBy: { invoiceDate: 'desc' },
        take: filters?.limit ?? 50,
        skip: filters?.offset ?? 0,
      }),
    ]);

    return { total, data: invoices.map((inv) => this.serializeInvoice(inv)) };
  }

  async findOneInvoice(id: string, companyId: string) {
    const invoice = await this.prisma.salesInvoice.findFirst({
      where: { id, companyId },
      include: {
        dealer: true,
        warehouse: true,
        items: true,
        salesReturns: {
          include: { items: true },
        },
        salesOrder: {
          select: {
            id: true,
            orderNumber: true,
            orderDate: true,
            salesOfficer: {
              select: { id: true, firstName: true, lastName: true, phone: true },
            },
          },
        },
      },
    });
    if (!invoice) throw new NotFoundException('Sales invoice not found');
    return this.serializeInvoice(invoice);
  }

  async createInvoice(dto: CreateSalesInvoiceDto, actor: AuthUser) {
    const organizationId = dto.organizationId || actor.organizationId;
    const companyId = dto.companyId || actor.companyId;

    const dealer = await this.prisma.dealer.findFirst({
      where: { id: dto.dealerId, companyId },
      include: {
        territory: {
          include: {
            zone: {
              include: {
                region: true,
              },
            },
          },
        },
      },
    });
    if (!dealer) throw new NotFoundException('Dealer not found');

    const invoiceNumber = await this.documentNumbering.getNextDocumentNumber({
      organizationId,
      companyId,
      documentType: 'SINV',
    });

    const netAmount = dto.netAmount ?? dto.items.reduce((sum: number, i: any) => sum + Number(i.netAmount), 0);

    // Resolve immutable 7-tier market attribution snapshot
    const territoryId = dealer.territoryId ?? null;
    const zoneId = dealer.territory?.zoneId ?? null;
    const regionId = dealer.territory?.zone?.regionId ?? null;
    const salesOfficerId = dto.salesOfficerId ?? dealer.assignedFieldOfficerId ?? dealer.territory?.managerId ?? null;
    const areaManagerId = dealer.territory?.zone?.managerId ?? null;
    const businessManagerId = dealer.territory?.zone?.region?.managerId ?? null;

    return this.prisma.salesInvoice.create({
      data: {
        id: uuidv7(),
        organizationId,
        companyId,
        invoiceNumber,
        dealerId: dto.dealerId,
        salesOfficerId,
        territoryId,
        zoneId,
        areaManagerId,
        regionId,
        businessManagerId,
        documentFormat: dto.documentFormat ?? 'COMMERCIAL_FULL',
        pricingPhase: dto.pricingPhase ?? 'CASH',
        commercialCondition: dto.commercialCondition ?? null,
        isDeliveryChallan: dto.isDeliveryChallan ?? false,
        batchNumber: dto.batchNumber ?? null,
        cartons: dto.cartons ?? null,
        schemeDescription: dto.schemeDescription ?? null,
        warehouseId: dto.warehouseId,
        invoiceDate: dto.invoiceDate ? new Date(dto.invoiceDate) : new Date(),
        postingStatus: 'DRAFT',
        grossAmount: dto.grossAmount ?? netAmount,
        discountAmount: dto.discountAmount ?? 0,
        taxAmount: dto.taxAmount ?? 0,
        netAmount,
        notes: dto.notes ?? null,
        createdById: actor.id,
        items: {
          create: dto.items.map((item: any) => ({
            id: uuidv7(),
            finishedProductId: item.finishedProductId ?? null,
            productName: item.productName,
            packing: item.packing ?? null,
            quantity: item.quantity,
            rate: item.rate,
            grossAmount: item.grossAmount ?? (item.quantity * item.rate),
            discountAmount: item.discountAmount ?? 0,
            taxAmount: item.taxAmount ?? 0,
            netAmount: item.netAmount,
          })),
        },
      },
      include: { items: true, dealer: true },
    });
  }

  async postInvoice(id: string, actor: AuthUser) {
    const invoice = await this.prisma.salesInvoice.findFirst({
      where: { id, companyId: actor.companyId },
      include: {
        items: true,
        dealer: {
          include: {
            territory: {
              include: {
                zone: {
                  include: {
                    region: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!invoice) throw new NotFoundException('Sales invoice not found');
    if (invoice.postingStatus === 'POSTED') {
      return invoice;
    }

    return this.transactionService.runInTransaction(async (tx) => {
      // 1. Stock decreases (only if not non-financial delivery challan)
      if (!invoice.isDeliveryChallan) {
        for (const item of invoice.items) {
          if (item.finishedProductId) {
            await this.inventoryService.applyMovement(tx, {
              organizationId: invoice.organizationId,
              companyId: invoice.companyId,
              warehouseId: invoice.warehouseId,
              itemType: 'FINISHED_PRODUCT',
              finishedProductId: item.finishedProductId,
              quantityChange: -Number(item.quantity),
              transactionType: 'SALE',
              referenceId: invoice.id,
              referenceNumber: invoice.invoiceNumber,
              notes: `Sale to ${invoice.dealer?.name}`,
            });
          }
        }
      }

      // 2. Dealer ledger: debit (only if not delivery challan)
      if (!invoice.isDeliveryChallan) {
        await this.dealerLedger.postEntry(tx, {
          organizationId: invoice.organizationId,
          companyId: invoice.companyId,
          dealerId: invoice.dealerId,
          entryType: 'SALE_INVOICE',
          referenceId: invoice.id,
          voucherNumber: invoice.invoiceNumber,
          description: `Sales Invoice ${invoice.invoiceNumber}`,
          debit: Number(invoice.netAmount),
          credit: 0,
          salesInvoiceId: invoice.id,
        });

        // General Ledger: Double-entry balanced posting (Section 4 & 60)
        const netAmt = Number(invoice.netAmount);
        const taxAmt = Number(invoice.taxAmount || 0);
        const revAmt = netAmt - taxAmt;
        await this.financeService.postJournalEntry(tx, {
          organizationId: invoice.organizationId,
          companyId: invoice.companyId,
          entryNumber: `JV-${invoice.invoiceNumber}`,
          entryDate: new Date(),
          entryType: 'SALES_INVOICE',
          referenceType: 'SALES_INVOICE',
          referenceId: invoice.id,
          referenceNumber: invoice.invoiceNumber,
          description: `Sales Invoice ${invoice.invoiceNumber} - ${invoice.dealer?.name}`,
          createdById: actor.id,
          lines: [
            {
              accountCode: '1100', // Accounts Receivable (Asset)
              debit: netAmt,
              credit: 0,
              dealerId: invoice.dealerId,
              salesOfficerId: invoice.salesOfficerId ?? undefined,
              territoryId: invoice.territoryId ?? undefined,
              zoneId: invoice.zoneId ?? undefined,
              regionId: invoice.regionId ?? undefined,
              description: `Receivable from ${invoice.dealer?.name}`,
            },
            ...(taxAmt > 0
              ? [
                  {
                    accountCode: '4000', // Sales Revenue (Revenue)
                    debit: 0,
                    credit: revAmt,
                    salesOfficerId: invoice.salesOfficerId ?? undefined,
                    territoryId: invoice.territoryId ?? undefined,
                    zoneId: invoice.zoneId ?? undefined,
                    regionId: invoice.regionId ?? undefined,
                    description: 'Sales Revenue',
                  },
                  {
                    accountCode: '2100', // Tax Payable (Liability)
                    debit: 0,
                    credit: taxAmt,
                    salesOfficerId: invoice.salesOfficerId ?? undefined,
                    territoryId: invoice.territoryId ?? undefined,
                    zoneId: invoice.zoneId ?? undefined,
                    regionId: invoice.regionId ?? undefined,
                    description: 'Sales Tax Payable',
                  },
                ]
              : [
                  {
                    accountCode: '4000', // Sales Revenue (Revenue)
                    debit: 0,
                    credit: netAmt,
                    salesOfficerId: invoice.salesOfficerId ?? undefined,
                    territoryId: invoice.territoryId ?? undefined,
                    zoneId: invoice.zoneId ?? undefined,
                    regionId: invoice.regionId ?? undefined,
                    description: 'Sales Revenue',
                  },
                ]),
          ],
        });
      }

      // 3. Mark POSTED + ensure market attribution snapshot is locked
      const snapshotUpdates: any = {
        postingStatus: 'POSTED',
        postedAt: new Date(),
      };
      if (!invoice.territoryId && invoice.dealer?.territoryId) {
        snapshotUpdates.territoryId = invoice.dealer.territoryId;
      }
      if (!invoice.zoneId && invoice.dealer?.territory?.zoneId) {
        snapshotUpdates.zoneId = invoice.dealer.territory.zoneId;
      }
      if (!invoice.regionId && invoice.dealer?.territory?.zone?.regionId) {
        snapshotUpdates.regionId = invoice.dealer.territory.zone.regionId;
      }
      if (!invoice.salesOfficerId) {
        snapshotUpdates.salesOfficerId = invoice.dealer?.assignedFieldOfficerId ?? invoice.dealer?.territory?.managerId ?? null;
      }
      if (!invoice.areaManagerId && invoice.dealer?.territory?.zone?.managerId) {
        snapshotUpdates.areaManagerId = invoice.dealer.territory.zone.managerId;
      }
      if (!invoice.businessManagerId && invoice.dealer?.territory?.zone?.region?.managerId) {
        snapshotUpdates.businessManagerId = invoice.dealer.territory.zone.region.managerId;
      }

      return tx.salesInvoice.update({
        where: { id },
        data: snapshotUpdates,
        include: { items: true, dealer: true },
      });
    });
  }

  // ============================
  // SALES RETURN
  // ============================

  async createSalesReturn(dto: CreateSalesReturnDto, actor: AuthUser) {
    const organizationId = dto.organizationId || actor.organizationId;
    const companyId = dto.companyId || actor.companyId;

    const dealer = await this.prisma.dealer.findFirst({ where: { id: dto.dealerId, companyId } });
    if (!dealer) throw new NotFoundException('Dealer not found');

    const voucherNumber = await this.documentNumbering.getNextDocumentNumber({
      organizationId,
      companyId,
      documentType: 'SRET',
    });

    const netAmount = dto.items.reduce((sum: number, i: any) => sum + Number(i.netAmount), 0);

    const parsedDate = dto.returnDate ? new Date(dto.returnDate) : new Date();
    const returnDate = isNaN(parsedDate.getTime()) ? new Date() : parsedDate;

    // If original sales invoice is linked, fetch its items and previous returns to validate customizable return quantities
    let origInvoice: any = null;
    let prevReturns: any[] = [];
    if (dto.salesInvoiceId) {
      origInvoice = await this.prisma.salesInvoice.findFirst({
        where: { id: dto.salesInvoiceId, companyId },
        include: { items: true },
      });
      prevReturns = await this.prisma.salesReturn.findMany({
        where: { salesInvoiceId: dto.salesInvoiceId, companyId },
        include: { items: true },
      });
    }

    if (origInvoice && Array.isArray(origInvoice.items)) {
      for (const item of dto.items) {
        const origItem = origInvoice.items.find(
          (oi: any) =>
            (item.finishedProductId && oi.finishedProductId === item.finishedProductId) ||
            (oi.productName && item.productName && oi.productName.trim().toLowerCase() === item.productName.trim().toLowerCase()),
        );

        if (origItem) {
          const soldQty = Number(origItem.quantity);
          const alreadyReturned = prevReturns
            .flatMap((r) => r.items || [])
            .filter((ri: any) =>
              (ri.finishedProductId && ri.finishedProductId === origItem.finishedProductId) ||
              (ri.productName && origItem.productName && ri.productName.trim().toLowerCase() === origItem.productName.trim().toLowerCase()),
            )
            .reduce((s: number, ri: any) => s + Number(ri.quantity || 0), 0);

          const maxAvailable = Math.max(0, soldQty - alreadyReturned);
          if (Number(item.quantity) > maxAvailable + 0.0001) {
            throw new BadRequestException(
              `Cannot return ${item.quantity} units for "${item.productName}". Maximum returnable quantity is ${maxAvailable} (Sold: ${soldQty}, Already Returned: ${alreadyReturned}).`,
            );
          }
        }
      }
    }

    // Pre-resolve finishedProductId if not supplied
    const resolvedItems = await Promise.all(
      dto.items.map(async (item: any) => {
        let fId = item.finishedProductId ?? null;
        if (!fId && item.productName) {
          const match = await this.prisma.finishedProduct.findFirst({
            where: { companyId, productName: { equals: item.productName.trim(), mode: 'insensitive' } },
          });
          if (match) fId = match.id;
        }
        return {
          ...item,
          finishedProductId: fId,
        };
      }),
    );

    return this.transactionService.runInTransaction(async (tx) => {
      // 1. Create Sales Return
      const sr = await tx.salesReturn.create({
        data: {
          id: uuidv7(),
          organizationId,
          companyId,
          voucherNumber,
          salesInvoiceId: dto.salesInvoiceId ?? null,
          dealerId: dto.dealerId,
          warehouseId: dto.warehouseId,
          returnDate,
          postingStatus: 'POSTED',
          netAmount,
          reason: dto.reason ?? null,
          postedAt: new Date(),
          items: {
            create: resolvedItems.map((item: any) => ({
              id: uuidv7(),
              finishedProductId: item.finishedProductId,
              productName: item.productName,
              quantity: item.quantity,
              rate: item.rate,
              netAmount: item.netAmount,
            })),
          },
        },
        include: { items: true },
      });

      // 2. Stock increases (returned goods come back)
      for (const item of resolvedItems) {
        if (item.finishedProductId) {
          await this.inventoryService.applyMovement(tx, {
            organizationId,
            companyId,
            warehouseId: dto.warehouseId,
            itemType: 'FINISHED_PRODUCT',
            finishedProductId: item.finishedProductId,
            quantityChange: Number(item.quantity),
            transactionType: 'SALES_RETURN',
            referenceId: sr.id,
            referenceNumber: voucherNumber,
            notes: dto.reason ?? 'Sales return',
          });
        }
      }

      // 3. Dealer Ledger: credit
      await this.dealerLedger.postEntry(tx, {
        organizationId,
        companyId,
        dealerId: dto.dealerId,
        entryType: 'SALES_RETURN',
        referenceId: sr.id,
        voucherNumber,
        description: `Sales Return ${voucherNumber}`,
        debit: 0,
        credit: netAmount,
        salesReturnId: sr.id,
      });

      this.logger.log(`Sales Return POSTED: ${voucherNumber} | Net: ${netAmount}`);
      return sr;
    });
  }

  async findAllReturns(
    companyId: string,
    filters?: { dealerId?: string; limit?: number; offset?: number },
  ) {
    const where: any = { companyId };
    if (filters?.dealerId) where.dealerId = filters.dealerId;

    const [total, data] = await Promise.all([
      this.prisma.salesReturn.count({ where }),
      this.prisma.salesReturn.findMany({
        where,
        include: {
          dealer: { select: { id: true, name: true, code: true } },
          warehouse: { select: { id: true, name: true, code: true } },
          items: true,
        },
        orderBy: { returnDate: 'desc' },
        take: filters?.limit ?? 50,
        skip: filters?.offset ?? 0,
      }),
    ]);
    return { total, data };
  }

  // ============================
  // DEALER PAYMENTS
  // ============================

  async createDealerPayment(dto: any, actor: AuthUser) {
    const organizationId = dto.organizationId || actor.organizationId;
    const companyId = dto.companyId || actor.companyId;

    const dealer = await this.prisma.dealer.findFirst({ where: { id: dto.dealerId, companyId } });
    if (!dealer) throw new NotFoundException('Dealer not found');

    const receiptNumber = await this.documentNumbering.getNextDocumentNumber({
      organizationId,
      companyId,
      documentType: 'DRCPT',
    });

    return this.transactionService.runInTransaction(async (tx) => {
      // 1. Create payment receipt
      const receipt = await tx.dealerPaymentReceipt.create({
        data: {
          id: uuidv7(),
          organizationId,
          companyId,
          receiptNumber,
          dealerId: dto.dealerId,
          salesOfficerId: dto.salesOfficerId ?? null,
          paymentType: dto.paymentType,
          amount: dto.amount,
          paymentDate: dto.paymentDate ? new Date(dto.paymentDate) : new Date(),
          bankName: dto.bankName ?? null,
          referenceNumber: dto.referenceNumber ?? null,
          receiptImageUrl: dto.receiptImageUrl ?? null,
          extractedDetails: dto.extractedDetails ?? null,
          status: 'CONFIRMED',
          notes: dto.notes ?? null,
        },
      });

      // 2. Dealer Ledger: credit (dealer paid, balance decreases)
      await this.dealerLedger.postEntry(tx, {
        organizationId,
        companyId,
        dealerId: dto.dealerId,
        entryType: 'PAYMENT_RECEIPT',
        referenceId: receipt.id,
        voucherNumber: receiptNumber,
        description: `${dto.paymentType} Payment - ${dto.bankName ?? 'Cash'}`,
        debit: 0,
        credit: Number(dto.amount),
        dealerPaymentId: receipt.id,
      });

      // 3. General Ledger: Double-entry balanced posting (Section 6 & 60)
      // Debit Cash/Bank, Credit Dealer Receivable
      const isBankPayment = (dto.paymentType || '').toUpperCase().includes('BANK');
      const cashOrBankCode = isBankPayment ? '1010' : '1000';
      const journal = await this.financeService.postJournalEntry(tx, {
        organizationId,
        companyId,
        entryNumber: `JV-${receiptNumber}`,
        entryDate: dto.paymentDate ? new Date(dto.paymentDate) : new Date(),
        entryType: 'PAYMENT_RECEIPT',
        referenceType: 'DEALER_PAYMENT',
        referenceId: receipt.id,
        referenceNumber: receiptNumber,
        description: `Dealer Payment ${receiptNumber} - ${dealer.name}`,
        createdById: actor.id,
        lines: [
          {
            accountCode: cashOrBankCode, // Cash or Bank (Asset +)
            debit: Number(dto.amount),
            credit: 0,
            description: `${isBankPayment ? 'Bank' : 'Cash'} Collection from ${dealer.name}`,
          },
          {
            accountCode: '1100', // Accounts Receivable (Asset -)
            debit: 0,
            credit: Number(dto.amount),
            dealerId: dto.dealerId,
            salesOfficerId: dto.salesOfficerId ?? dealer.assignedFieldOfficerId ?? undefined,
            territoryId: dealer.territoryId ?? undefined,
            description: `Receivable reduction - ${dealer.name}`,
          },
        ],
      });

      // 4. Financial Transactions: Cash / Bank Control Voucher
      const cashOrBankAccount = await this.financeService.resolveAccount(
        tx,
        organizationId,
        companyId,
        cashOrBankCode,
      );
      const receivableAccount = await this.financeService.resolveAccount(
        tx,
        organizationId,
        companyId,
        '1100',
      );

      await tx.financialTransaction.create({
        data: {
          id: uuidv7(),
          organizationId,
          companyId,
          voucherNumber: receiptNumber,
          transactionType: isBankPayment ? 'BANK_RECEIPT' : 'CASH_RECEIPT',
          transactionDate: dto.paymentDate ? new Date(dto.paymentDate) : new Date(),
          partyType: 'DEALER',
          partyId: dto.dealerId,
          partyName: dealer.name,
          amount: Number(dto.amount),
          paymentMethod: isBankPayment ? 'BANK' : 'CASH',
          accountId: cashOrBankAccount.id,
          contraAccountId: receivableAccount.id,
          bankName: dto.bankName ?? null,
          referenceNumber: dto.referenceNumber ?? null,
          remarks: dto.notes ?? `Dealer Payment Collection - ${dealer.name}`,
          attachmentUrl: dto.receiptImageUrl ?? null,
          status: 'POSTED',
          journalEntryId: (journal as any)?.id ?? null,
          createdById: actor.id,
        },
      });

      this.logger.log(`Dealer payment: ${receiptNumber} | ${dto.paymentType} | ${dto.amount} | dealer=${dto.dealerId}`);
      return receipt;
    });
  }

  async findAllDealerPayments(
    companyId: string,
    filters?: { dealerId?: string; salesOfficerId?: string; status?: string; limit?: number; offset?: number },
  ) {
    const where: any = { companyId };
    if (filters?.dealerId) where.dealerId = filters.dealerId;
    if (filters?.salesOfficerId) where.salesOfficerId = filters.salesOfficerId;
    if (filters?.status) where.status = filters.status;

    const [total, data] = await Promise.all([
      this.prisma.dealerPaymentReceipt.count({ where }),
      this.prisma.dealerPaymentReceipt.findMany({
        where,
        include: {
          dealer: { select: { id: true, name: true, code: true } },
          salesOfficer: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: filters?.limit ?? 50,
        skip: filters?.offset ?? 0,
      }),
    ]);
    return { total, data };
  }

  async findDealerPayments(
    companyId: string,
    filters?: { dealerId?: string; salesOfficerId?: string; limit?: number },
  ) {
    return this.findAllDealerPayments(companyId, filters);
  }

  // ============================
  // VENDOR PAYMENT
  // ============================

  async createVendorPayment(dto: any, actor: AuthUser) {
    const organizationId = dto.organizationId || actor.organizationId;
    const companyId = dto.companyId || actor.companyId;

    const vendor = await this.prisma.vendor.findFirst({ where: { id: dto.vendorId, companyId } });
    if (!vendor) throw new NotFoundException('Vendor not found');

    const voucherNumber = await this.documentNumbering.getNextDocumentNumber({
      organizationId,
      companyId,
      documentType: 'VPAY',
    });

    return this.transactionService.runInTransaction(async (tx) => {
      const payment = await tx.vendorPayment.create({
        data: {
          id: uuidv7(),
          organizationId,
          companyId,
          voucherNumber,
          vendorId: dto.vendorId,
          paymentType: dto.paymentType,
          amount: dto.amount,
          paymentDate: dto.paymentDate ? new Date(dto.paymentDate) : new Date(),
          bankName: dto.bankName ?? null,
          referenceNumber: dto.referenceNumber ?? null,
          status: 'POSTED',
          notes: dto.notes ?? null,
        },
      });

      // Vendor Ledger: debit (we paid vendor, our payable decreases)
      await tx.vendorLedgerEntry.create({
        data: {
          id: uuidv7(),
          organizationId,
          companyId,
          vendorId: dto.vendorId,
          entryType: 'VENDOR_PAYMENT',
          referenceId: payment.id,
          voucherNumber,
          description: `Vendor Payment ${voucherNumber}`,
          credit: 0,
          debit: dto.amount,
          runningBalance: 0,
          vendorPaymentId: payment.id,
          entryDate: new Date(),
        },
      });

      // General Ledger: Double-entry balanced posting (Section 6 & 60)
      // Debit Accounts Payable, Credit Cash/Bank
      const isBankPayment = (dto.paymentType || '').toUpperCase().includes('BANK');
      const cashOrBankCode = isBankPayment ? '1010' : '1000';
      const journal = await this.financeService.postJournalEntry(tx, {
        organizationId,
        companyId,
        entryNumber: `JV-${voucherNumber}`,
        entryDate: dto.paymentDate ? new Date(dto.paymentDate) : new Date(),
        entryType: 'PAYMENT_RECEIPT',
        referenceType: 'VENDOR_PAYMENT',
        referenceId: payment.id,
        referenceNumber: voucherNumber,
        description: `Vendor Payment ${voucherNumber} - ${vendor.name}`,
        createdById: actor.id,
        lines: [
          {
            accountCode: '2000', // Accounts Payable (Liability -)
            debit: Number(dto.amount),
            credit: 0,
            vendorId: dto.vendorId,
            description: `Payable reduction - ${vendor.name}`,
          },
          {
            accountCode: cashOrBankCode, // Cash or Bank (Asset -)
            debit: 0,
            credit: Number(dto.amount),
            description: `${isBankPayment ? 'Bank' : 'Cash'} Payment to ${vendor.name}`,
          },
        ],
      });

      // Financial Transactions: Cash / Bank Control Voucher
      const cashOrBankAccount = await this.financeService.resolveAccount(
        tx,
        organizationId,
        companyId,
        cashOrBankCode,
      );
      const payableAccount = await this.financeService.resolveAccount(
        tx,
        organizationId,
        companyId,
        '2000',
      );

      await tx.financialTransaction.create({
        data: {
          id: uuidv7(),
          organizationId,
          companyId,
          voucherNumber,
          transactionType: isBankPayment ? 'BANK_PAYMENT' : 'CASH_PAYMENT',
          transactionDate: dto.paymentDate ? new Date(dto.paymentDate) : new Date(),
          partyType: 'VENDOR',
          partyId: dto.vendorId,
          partyName: vendor.name,
          amount: Number(dto.amount),
          paymentMethod: isBankPayment ? 'BANK' : 'CASH',
          accountId: cashOrBankAccount.id,
          contraAccountId: payableAccount.id,
          bankName: dto.bankName ?? null,
          referenceNumber: dto.referenceNumber ?? null,
          remarks: dto.notes ?? `Vendor Payment - ${vendor.name}`,
          status: 'POSTED',
          journalEntryId: (journal as any)?.id ?? null,
          createdById: actor.id,
        },
      });

      return payment;
    });
  }

  async findAllVendorPayments(
    companyId: string,
    filters?: { vendorId?: string; limit?: number; offset?: number },
  ) {
    const where: any = { companyId };
    if (filters?.vendorId) where.vendorId = filters.vendorId;

    const [total, data] = await Promise.all([
      this.prisma.vendorPayment.count({ where }),
      this.prisma.vendorPayment.findMany({
        where,
        include: {
          vendor: { select: { id: true, name: true, code: true } },
        },
        orderBy: { paymentDate: 'desc' },
        take: filters?.limit ?? 50,
        skip: filters?.offset ?? 0,
      }),
    ]);
    return { total, data };
  }

  // ============================
  // PRODUCT COSTING
  // ============================

  async getFinishedProducts(companyId: string) {
    return this.prisma.finishedProduct.findMany({
      where: { companyId, status: 'ACTIVE' },
      select: { id: true, productCode: true, productName: true, standardCost: true, defaultSellingPrice: true },
      orderBy: { productName: 'asc' },
    });
  }

  async getProductsForSale(companyId: string) {
    const products = await this.prisma.finishedProduct.findMany({
      where: { companyId, status: 'ACTIVE' },
      select: {
        id: true,
        productCode: true,
        productName: true,
        defaultSellingPrice: true,
        standardCost: true,
        fertilizerType: true,
        bagWeight: true,
        packSize: { select: { id: true, code: true, name: true } },
      },
      orderBy: { productName: 'asc' },
    });

    // Attach warehouse stock levels
    const stocks = await this.prisma.warehouseStock.findMany({
      where: { companyId, itemType: 'FINISHED_PRODUCT' },
      include: { warehouse: { select: { id: true, name: true } } },
    });

    // Fetch active published seasonal/base rate list
    const activeRateList = await this.prisma.rateList.findFirst({
      where: { companyId, status: 'ACTIVE', category: 'SEASONAL', isMobileVisible: true },
      include: {
        versions: {
          where: {
            status: 'ACTIVE',
            effectiveFrom: { lte: new Date() },
            OR: [{ effectiveTo: null }, { effectiveTo: { gte: new Date() } }],
          },
          orderBy: { versionNumber: 'desc' },
          take: 1,
          include: { items: { where: { isActive: true } } },
        },
      },
    });

    // Fetch published active schemes for mobile
    const mobileSchemes = await this.prisma.pricingScheme.findMany({
      where: {
        companyId,
        status: 'ACTIVE',
        isMobileVisible: true,
        isMobileSelectable: true,
        effectiveFrom: { lte: new Date() },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: new Date() } }],
      },
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
        schemeType: true,
        paymentTerm: true,
        discountComponents: true,
        effectiveFrom: true,
        effectiveTo: true,
      },
      orderBy: { priority: 'desc' },
    });

    return products.map((p) => {
      const stockEntries = stocks.filter((s) => s.finishedProductId === p.id);
      const totalStock = stockEntries.reduce((sum, s) => sum + Number(s.quantityOnHand), 0);

      const activeVersionItem = activeRateList?.versions[0]?.items.find((it) => it.finishedProductId === p.id);
      const seasonalRate = activeVersionItem ? Number(activeVersionItem.baseRate) : Number(p.defaultSellingPrice || p.standardCost || 1200);

      return {
        id: p.id,
        productCode: p.productCode,
        productName: p.productName,
        packSize: p.packSize?.name || (p.bagWeight ? `${p.bagWeight} KG` : 'Standard Bag'),
        unit: 'BAG',
        fertilizerType: p.fertilizerType,
        seasonalRate,
        defaultSellingPrice: p.defaultSellingPrice ? Number(p.defaultSellingPrice) : seasonalRate,
        standardCost: p.standardCost ? Number(p.standardCost) : null,
        stockOnHand: totalStock,
        publishedSchemes: mobileSchemes.map((s) => ({
          id: s.id,
          code: s.code,
          name: s.name,
          schemeType: s.schemeType,
          paymentTerm: s.paymentTerm,
          description: s.description,
        })),
        stockByWarehouse: stockEntries.map((s) => ({
          warehouseId: s.warehouseId,
          warehouseName: s.warehouse?.name,
          quantity: Number(s.quantityOnHand),
        })),
      };
    });
  }

  // ============================
  // WAREHOUSE STOCK (display)
  // ============================

  async getWarehouseStockReport(companyId: string, warehouseId?: string) {
    const where: any = { companyId };
    if (warehouseId) where.warehouseId = warehouseId;
    where.quantityOnHand = { gt: 0 };

    return this.prisma.warehouseStock.findMany({
      where,
      include: {
        warehouse: { select: { id: true, name: true, code: true } },
        rawMaterial: { select: { id: true, materialCode: true, materialName: true } },
        packingMaterial: { select: { id: true, materialCode: true, materialName: true } },
        finishedProduct: { select: { id: true, productCode: true, productName: true } },
      },
      orderBy: [{ itemType: 'asc' }, { lastUpdated: 'desc' }],
    });
  }

  // ============================
  // SERIALIZERS
  // ============================

  private serializeDealer(d: any) {
    const creditLimit = Number(d.creditLimit || 0);
    const currentBalance = Number(d.currentBalance || 0);
    const availableCredit = Math.max(0, creditLimit - currentBalance);
    return {
      ...d,
      currentBalance,
      creditLimit,
      availableCredit,
    };
  }

  private serializeOrder(o: any) {
    return {
      ...o,
      totalAmount: Number(o.totalAmount),
      discountAmount: o.discountAmount !== null && o.discountAmount !== undefined ? Number(o.discountAmount) : 0,
      freeQuantityTotal: o.freeQuantityTotal !== null && o.freeQuantityTotal !== undefined ? Number(o.freeQuantityTotal) : 0,
      paymentTerm: o.paymentTerm || 'CASH',
      appliedSchemeName: o.appliedSchemeName || null,
      items: (o.items ?? []).map((i: any) => ({
        ...i,
        quantity: Number(i.quantity),
        baseRate: i.baseRate !== null && i.baseRate !== undefined ? Number(i.baseRate) : Number(i.unitPrice),
        unitPrice: Number(i.unitPrice),
        discountPercent: i.discountPercent !== null && i.discountPercent !== undefined ? Number(i.discountPercent) : 0,
        discountAmount: i.discountAmount !== null && i.discountAmount !== undefined ? Number(i.discountAmount) : 0,
        freeQuantity: i.freeQuantity !== null && i.freeQuantity !== undefined ? Number(i.freeQuantity) : 0,
        totalPrice: Number(i.totalPrice),
      })),
    };
  }

  private serializeInvoice(inv: any) {
    const returnItems = (inv.salesReturns || []).flatMap((sr: any) => sr.items || []);
    return {
      ...inv,
      grossAmount: Number(inv.grossAmount),
      discountAmount: Number(inv.discountAmount),
      taxAmount: Number(inv.taxAmount),
      netAmount: Number(inv.netAmount),
      items: (inv.items || []).map((it: any) => {
        const returnedQty = returnItems
          .filter((ri: any) =>
            (ri.finishedProductId && ri.finishedProductId === it.finishedProductId) ||
            (ri.productName && it.productName && ri.productName.trim().toLowerCase() === it.productName.trim().toLowerCase()),
          )
          .reduce((sum: number, ri: any) => sum + Number(ri.quantity || 0), 0);
        const qty = Number(it.quantity);
        return {
          ...it,
          quantity: qty,
          returnedQuantity: returnedQty,
          remainingQuantity: Math.max(0, qty - returnedQty),
          rate: Number(it.rate),
          grossAmount: Number(it.grossAmount),
          netAmount: Number(it.netAmount),
        };
      }),
    };
  }
}
