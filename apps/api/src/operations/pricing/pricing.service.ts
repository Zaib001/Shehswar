/**
 * SHEHSWAR ONE360 - Flexible Pricing, Dynamic Rate Lists & Commercial Schemes Service
 *
 * Implements:
 * 1. Dynamic Database-driven Rate Lists with Versioning (RateList -> RateListVersion -> RateListItem)
 * 2. Unlimited Commercial Schemes & Phases (Cash Discount, Advance Booking, Package, Special Rate, Net Rate, etc.)
 * 3. Additive & Sequential Discount Component Calculations
 * 4. Package Schemes (e.g. 10+1 Free, 100+5 Free) with paid/free quantities
 * 5. Strict Separation of Rate List, Pricing Scheme, and Payment Term
 * 6. Role-Based Pricing Authority Limits & Approval Enforcement
 * 7. Centralized, Server-Authoritative Price Resolution Engine (resolvePrice)
 * 8. Automatic Active Finished Products Loader
 */
import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { uuidv7 } from '@shehswar/shared';
import {
  AuthUser,
  CreateRateListDto,
  UpdateRateListDto,
  CreateRateListVersionDto,
  CreatePricingSchemeDto,
  UpdatePricingSchemeDto,
  UpdatePricingAuthorityLimitDto,
  ResolvePriceDto,
  ResolvedPriceResult,
} from '@shehswar/types';

export interface UpsertRateListDto {
  finishedProductId: string;
  phase: 'CASH' | 'SEASONAL' | 'ADVANCE_BOOKING' | 'VD' | 'NET_RATE';
  baseRate: number;
  cashDiscountPercent?: number;
  minAllowedRate?: number;
  effectiveDate?: string;
  isActive?: boolean;
}

@Injectable()
export class PricingService {
  private readonly logger = new Logger(PricingService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ============================================================
  // 1. PRICING AUTHORITY LIMITS (ROLE-BASED GOVERNANCE)
  // ============================================================

  /**
   * Ensure default role-based pricing authority limits exist for company
   */
  async ensureDefaultAuthorityLimits(organizationId: string, companyId: string) {
    const count = await this.prisma.pricingAuthorityLimit.count({
      where: { companyId },
    });

    if (count === 0) {
      const defaults = [
        { roleCode: 'SALES_OFFICER', maxDiscountPct: 5.0, canSetNetRate: false, canApplySpecialRate: false, canApproveOwnOverride: false, requiresApproval: true },
        { roleCode: 'AREA_MANAGER', maxDiscountPct: 15.0, canSetNetRate: false, canApplySpecialRate: true, canApproveOwnOverride: false, requiresApproval: true },
        { roleCode: 'BUSINESS_MANAGER', maxDiscountPct: 25.0, canSetNetRate: true, canApplySpecialRate: true, canApproveOwnOverride: true, requiresApproval: false },
        { roleCode: 'ADMIN', maxDiscountPct: 100.0, canSetNetRate: true, canApplySpecialRate: true, canApproveOwnOverride: true, requiresApproval: false },
      ];

      for (const def of defaults) {
        await this.prisma.pricingAuthorityLimit.create({
          data: {
            id: uuidv7(),
            organizationId,
            companyId,
            roleCode: def.roleCode,
            maxDiscountPct: def.maxDiscountPct,
            canSetNetRate: def.canSetNetRate,
            canApplySpecialRate: def.canApplySpecialRate,
            canApproveOwnOverride: def.canApproveOwnOverride,
            requiresApproval: def.requiresApproval,
            companyScope: 'COMPANY',
            status: 'ACTIVE',
          },
        });
      }
    }
  }

  /**
   * Retrieve all pricing authority limits for a company
   */
  async getAuthorityLimits(organizationId: string, companyId: string) {
    await this.ensureDefaultAuthorityLimits(organizationId, companyId);
    return this.prisma.pricingAuthorityLimit.findMany({
      where: { companyId },
      orderBy: { maxDiscountPct: 'asc' },
    });
  }

  /**
   * Update or create authority limit for a specific role
   */
  async updateAuthorityLimit(dto: UpdatePricingAuthorityLimitDto, actor: AuthUser) {
    const companyId = actor.companyId;
    const organizationId = actor.organizationId;

    const existing = await this.prisma.pricingAuthorityLimit.findFirst({
      where: { companyId, roleCode: dto.roleCode },
    });

    if (existing) {
      return this.prisma.pricingAuthorityLimit.update({
        where: { id: existing.id },
        data: {
          maxDiscountPct: dto.maxDiscountPct,
          canSetNetRate: dto.canSetNetRate ?? existing.canSetNetRate,
          canApplySpecialRate: dto.canApplySpecialRate ?? existing.canApplySpecialRate,
          canApproveOwnOverride: dto.canApproveOwnOverride ?? existing.canApproveOwnOverride,
          requiresApproval: dto.requiresApproval ?? existing.requiresApproval,
          companyScope: dto.companyScope ?? existing.companyScope,
          status: dto.status ?? existing.status,
        },
      });
    }

    return this.prisma.pricingAuthorityLimit.create({
      data: {
        id: uuidv7(),
        organizationId,
        companyId,
        roleCode: dto.roleCode,
        maxDiscountPct: dto.maxDiscountPct,
        canSetNetRate: dto.canSetNetRate ?? false,
        canApplySpecialRate: dto.canApplySpecialRate ?? false,
        canApproveOwnOverride: dto.canApproveOwnOverride ?? false,
        requiresApproval: dto.requiresApproval ?? true,
        companyScope: dto.companyScope ?? 'COMPANY',
        status: dto.status ?? 'ACTIVE',
      },
    });
  }

  // ============================================================
  // 2. ACTIVE PRODUCTS AUTO-POPULATOR (REQUIREMENT 8)
  // ============================================================

  /**
   * Fetch all active Finished Products from real database for rate list initialization
   */
  async getActiveFinishedProductsForRateList(companyId: string) {
    const products = await this.prisma.finishedProduct.findMany({
      where: { companyId, status: 'ACTIVE' },
      select: {
        id: true,
        productCode: true,
        productName: true,
        fertilizerType: true,
        productForm: true,
        bagWeight: true,
        defaultSellingPrice: true,
        standardCost: true,
        packSizeId: true,
        packSize: { select: { id: true, code: true, name: true } },
      },
      orderBy: { productName: 'asc' },
    });

    return products.map((p) => {
      const baseRate = Number(p.defaultSellingPrice || p.standardCost || 1200);
      return {
        finishedProductId: p.id,
        productCode: p.productCode,
        productName: p.productName,
        fertilizerType: p.fertilizerType,
        packSizeId: p.packSizeId,
        packSizeName: p.packSize?.name || 'Standard Bag',
        baseRate,
        unit: 'BAG',
        discountType: 'PERCENTAGE',
        discountValue: 0,
        fixedNetRate: null,
        minAllowedRate: Math.round(baseRate * 0.8), // 20% safe floor
        quantityFrom: 1,
        quantityTo: null,
        freeQuantity: 0,
        commercialCondition: null,
        isActive: true,
      };
    });
  }

  // ============================================================
  // 3. DYNAMIC RATE LIST MANAGEMENT (REQUIREMENTS 5, 6, 7, 8, 9, 10)
  // ============================================================

  /**
   * List all Rate Lists with their versions and active items count
   */
  async getRateLists(
    companyId: string,
    filter?: { category?: string; status?: string; isMobileVisible?: boolean },
  ) {
    const where: any = { companyId };
    if (filter?.category) where.category = filter.category;
    if (filter?.status) where.status = filter.status;
    if (filter?.isMobileVisible !== undefined) where.isMobileVisible = filter.isMobileVisible;

    const rateLists = await this.prisma.rateList.findMany({
      where,
      include: {
        versions: {
          orderBy: { versionNumber: 'desc' },
          include: {
            _count: { select: { items: true } },
          },
        },
        _count: { select: { salesOrders: true } },
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    });

    return rateLists.map((rl) => {
      const activeVersion = rl.versions.find((v) => v.status === 'ACTIVE') || rl.versions[0];
      return {
        ...rl,
        activeVersionNumber: activeVersion?.versionNumber || 1,
        effectiveFrom: activeVersion?.effectiveFrom || rl.createdAt,
        effectiveTo: activeVersion?.effectiveTo || null,
        productCount: activeVersion?._count.items || 0,
        totalVersionsCount: rl.versions.length,
        usageCount: rl._count.salesOrders,
      };
    });
  }

  /**
   * Retrieve single Rate List with full version and item details
   */
  async getRateListById(id: string, companyId: string) {
    const rateList = await this.prisma.rateList.findFirst({
      where: { id, companyId },
      include: {
        versions: {
          orderBy: { versionNumber: 'desc' },
          include: {
            items: {
              include: {
                finishedProduct: {
                  select: { id: true, productCode: true, productName: true, defaultSellingPrice: true },
                },
                packSize: { select: { id: true, code: true, name: true } },
              },
              orderBy: { finishedProduct: { productName: 'asc' } },
            },
          },
        },
      },
    });

    if (!rateList) throw new NotFoundException('Rate list not found');
    return rateList;
  }

  /**
   * Create a new Rate List with Version 1 and items
   */
  async createRateList(dto: CreateRateListDto, actor: AuthUser) {
    const organizationId = actor.organizationId;
    const companyId = actor.companyId;

    // Check unique code
    const existing = await this.prisma.rateList.findFirst({
      where: { companyId, code: dto.code.trim().toUpperCase() },
    });
    if (existing) {
      throw new BadRequestException(`Rate list with code '${dto.code}' already exists in this company`);
    }

    const effectiveFrom = dto.effectiveFrom ? new Date(dto.effectiveFrom) : new Date();
    const effectiveTo = dto.effectiveTo ? new Date(dto.effectiveTo) : null;

    return this.prisma.$transaction(async (tx) => {
      const rateList = await tx.rateList.create({
        data: {
          id: uuidv7(),
          organizationId,
          companyId,
          code: dto.code.trim().toUpperCase(),
          name: dto.name.trim(),
          description: dto.description || null,
          category: dto.category || 'SEASONAL',
          currency: dto.currency || 'PKR',
          status: 'ACTIVE',
          isMobileVisible: dto.isMobileVisible ?? true,
          isMobileSelectable: dto.isMobileSelectable ?? true,
          isInternalOnly: dto.isInternalOnly ?? false,
          priority: dto.priority ?? 0,
          createdById: actor.id,
        },
      });

      // Create Version 1
      const version = await tx.rateListVersion.create({
        data: {
          id: uuidv7(),
          rateListId: rateList.id,
          versionNumber: 1,
          effectiveFrom,
          effectiveTo,
          status: 'ACTIVE',
          notes: dto.notes || 'Initial version',
          createdById: actor.id,
          publishedAt: new Date(),
        },
      });

      // Insert product items if provided
      if (dto.items && dto.items.length > 0) {
        await tx.rateListItem.createMany({
          data: dto.items.map((it) => ({
            id: uuidv7(),
            rateListVersionId: version.id,
            finishedProductId: it.finishedProductId,
            packSizeId: it.packSizeId || null,
            baseRate: it.baseRate,
            unit: it.unit || 'BAG',
            discountType: it.discountType || 'PERCENTAGE',
            discountValue: it.discountValue ?? 0,
            fixedNetRate: it.fixedNetRate ?? null,
            minAllowedRate: it.minAllowedRate ?? null,
            quantityFrom: it.quantityFrom ?? 1,
            quantityTo: it.quantityTo ?? null,
            freeQuantity: it.freeQuantity ?? 0,
            commercialCondition: it.commercialCondition || null,
            isActive: it.isActive ?? true,
          })),
        });
      }

      this.logger.log(`Rate list created: ${rateList.code} (${rateList.name}) by ${actor.email}`);
      return this.getRateListById(rateList.id, companyId);
    });
  }

  /**
   * Update Rate List header attributes
   */
  async updateRateList(id: string, dto: UpdateRateListDto, actor: AuthUser) {
    const rateList = await this.prisma.rateList.findFirst({
      where: { id, companyId: actor.companyId },
    });
    if (!rateList) throw new NotFoundException('Rate list not found');

    return this.prisma.rateList.update({
      where: { id },
      data: {
        name: dto.name?.trim() || rateList.name,
        description: dto.description !== undefined ? dto.description : rateList.description,
        category: dto.category || rateList.category,
        currency: dto.currency || rateList.currency,
        status: dto.status || rateList.status,
        isMobileVisible: dto.isMobileVisible !== undefined ? dto.isMobileVisible : rateList.isMobileVisible,
        isMobileSelectable: dto.isMobileSelectable !== undefined ? dto.isMobileSelectable : rateList.isMobileSelectable,
        isInternalOnly: dto.isInternalOnly !== undefined ? dto.isInternalOnly : rateList.isInternalOnly,
        priority: dto.priority !== undefined ? dto.priority : rateList.priority,
      },
    });
  }

  /**
   * Create a new version for a Rate List (Requirement 6: Versioning without overwriting history)
   */
  async createRateListVersion(dto: CreateRateListVersionDto, actor: AuthUser) {
    const rateList = await this.prisma.rateList.findFirst({
      where: { id: dto.rateListId, companyId: actor.companyId },
      include: { versions: { orderBy: { versionNumber: 'desc' }, take: 1 } },
    });
    if (!rateList) throw new NotFoundException('Rate list not found');

    const nextVersionNumber = dto.versionNumber || (rateList.versions[0]?.versionNumber || 0) + 1;
    const effectiveFrom = new Date(dto.effectiveFrom);
    const effectiveTo = dto.effectiveTo ? new Date(dto.effectiveTo) : null;

    return this.prisma.$transaction(async (tx) => {
      // Deactivate older overlapping active versions if necessary
      await tx.rateListVersion.updateMany({
        where: { rateListId: rateList.id, status: 'ACTIVE' },
        data: { status: 'ARCHIVED' },
      });

      const version = await tx.rateListVersion.create({
        data: {
          id: uuidv7(),
          rateListId: rateList.id,
          versionNumber: nextVersionNumber,
          effectiveFrom,
          effectiveTo,
          status: 'ACTIVE',
          notes: dto.notes || `Version ${nextVersionNumber}`,
          createdById: actor.id,
          publishedAt: new Date(),
        },
      });

      if (dto.items && dto.items.length > 0) {
        await tx.rateListItem.createMany({
          data: dto.items.map((it) => ({
            id: uuidv7(),
            rateListVersionId: version.id,
            finishedProductId: it.finishedProductId,
            packSizeId: it.packSizeId || null,
            baseRate: it.baseRate,
            unit: it.unit || 'BAG',
            discountType: it.discountType || 'PERCENTAGE',
            discountValue: it.discountValue ?? 0,
            fixedNetRate: it.fixedNetRate ?? null,
            minAllowedRate: it.minAllowedRate ?? null,
            quantityFrom: it.quantityFrom ?? 1,
            quantityTo: it.quantityTo ?? null,
            freeQuantity: it.freeQuantity ?? 0,
            commercialCondition: it.commercialCondition || null,
            isActive: it.isActive ?? true,
          })),
        });
      }

      this.logger.log(`Created Version ${nextVersionNumber} for Rate List ${rateList.code}`);
      return this.getRateListById(rateList.id, actor.companyId);
    });
  }

  /**
   * Duplicate a Rate List to a new code
   */
  async duplicateRateList(sourceId: string, newCode: string, newName: string, actor: AuthUser) {
    const source = await this.getRateListById(sourceId, actor.companyId);
    const activeVersion = source.versions.find((v: any) => v.status === 'ACTIVE') || source.versions[0];

    const itemsToClone = (activeVersion?.items || []).map((it: any) => ({
      finishedProductId: it.finishedProductId,
      packSizeId: it.packSizeId || undefined,
      baseRate: Number(it.baseRate),
      unit: it.unit || 'BAG',
      discountType: it.discountType || 'PERCENTAGE',
      discountValue: Number(it.discountValue || 0),
      fixedNetRate: it.fixedNetRate ? Number(it.fixedNetRate) : undefined,
      minAllowedRate: it.minAllowedRate ? Number(it.minAllowedRate) : undefined,
      quantityFrom: Number(it.quantityFrom || 1),
      quantityTo: it.quantityTo ? Number(it.quantityTo) : undefined,
      freeQuantity: Number(it.freeQuantity || 0),
      commercialCondition: it.commercialCondition || undefined,
      isActive: it.isActive,
    }));

    return this.createRateList(
      {
        code: newCode,
        name: newName,
        description: `Duplicated from ${source.code} - ${source.name}`,
        category: source.category,
        currency: source.currency,
        isMobileVisible: source.isMobileVisible,
        isMobileSelectable: source.isMobileSelectable,
        isInternalOnly: source.isInternalOnly,
        priority: source.priority,
        items: itemsToClone,
      },
      actor,
    );
  }

  /**
   * Archive or Deactivate Rate List (Never delete historical records used in transactions)
   */
  async archiveRateList(id: string, actor: AuthUser) {
    const rateList = await this.prisma.rateList.findFirst({
      where: { id, companyId: actor.companyId },
    });
    if (!rateList) throw new NotFoundException('Rate list not found');

    return this.prisma.rateList.update({
      where: { id },
      data: { status: 'ARCHIVED' },
    });
  }

  // ============================================================
  // 4. PRICING SCHEMES & PHASES MANAGEMENT (REQUIREMENTS 2, 3, 12, 13, 14, 15, 16)
  // ============================================================

  /**
   * Retrieve all Pricing Schemes with optional filtering
   */
  async getPricingSchemes(
    companyId: string,
    filter?: { schemeType?: string; status?: string; isMobileVisible?: boolean; paymentTerm?: string },
  ) {
    const where: any = { companyId };
    if (filter?.schemeType) where.schemeType = filter.schemeType;
    if (filter?.status) where.status = filter.status;
    if (filter?.isMobileVisible !== undefined) where.isMobileVisible = filter.isMobileVisible;
    if (filter?.paymentTerm && filter.paymentTerm !== 'ALL') {
      where.OR = [{ paymentTerm: filter.paymentTerm }, { paymentTerm: 'ANY' }];
    }

    return this.prisma.pricingScheme.findMany({
      where,
      include: {
        baseRateList: { select: { id: true, code: true, name: true } },
        _count: { select: { salesOrders: true } },
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    });
  }

  /**
   * Retrieve single Pricing Scheme by ID
   */
  async getPricingSchemeById(id: string, companyId: string) {
    const scheme = await this.prisma.pricingScheme.findFirst({
      where: { id, companyId },
      include: {
        baseRateList: { select: { id: true, code: true, name: true, category: true } },
      },
    });
    if (!scheme) throw new NotFoundException('Pricing scheme not found');
    return scheme;
  }

  /**
   * Create a new Pricing Scheme
   */
  async createPricingScheme(dto: CreatePricingSchemeDto, actor: AuthUser) {
    const companyId = actor.companyId;
    const organizationId = actor.organizationId;

    const existing = await this.prisma.pricingScheme.findFirst({
      where: { companyId, code: dto.code.trim().toUpperCase() },
    });
    if (existing) {
      throw new BadRequestException(`Pricing scheme with code '${dto.code}' already exists`);
    }

    const scheme = await this.prisma.pricingScheme.create({
      data: {
        id: uuidv7(),
        organizationId,
        companyId,
        code: dto.code.trim().toUpperCase(),
        name: dto.name.trim(),
        description: dto.description || null,
        schemeType: dto.schemeType || 'CASH_DISCOUNT',
        calculationMethod: dto.calculationMethod || 'ADDITIVE',
        discountComponents: dto.discountComponents ? (dto.discountComponents as any) : [],
        baseRateListId: dto.baseRateListId || null,
        paidQuantity: dto.paidQuantity ?? 0,
        freeQuantity: dto.freeQuantity ?? 0,
        minQuantity: dto.minQuantity ?? 0,
        maxQuantity: dto.maxQuantity ?? null,
        applicableDealerTier: dto.applicableDealerTier || 'ALL',
        paymentTerm: dto.paymentTerm || 'ANY',
        effectiveFrom: new Date(dto.effectiveFrom),
        effectiveTo: dto.effectiveTo ? new Date(dto.effectiveTo) : null,
        isMobileVisible: dto.isMobileVisible ?? true,
        isMobileSelectable: dto.isMobileSelectable ?? true,
        isInternalOnly: dto.isInternalOnly ?? false,
        priority: dto.priority ?? 0,
        status: dto.status || 'ACTIVE',
        createdById: actor.id,
      },
      include: { baseRateList: true },
    });

    this.logger.log(`Created Pricing Scheme: ${scheme.code} (${scheme.name})`);
    return scheme;
  }

  /**
   * Update an existing Pricing Scheme
   */
  async updatePricingScheme(id: string, dto: UpdatePricingSchemeDto, actor: AuthUser) {
    const scheme = await this.prisma.pricingScheme.findFirst({
      where: { id, companyId: actor.companyId },
    });
    if (!scheme) throw new NotFoundException('Pricing scheme not found');

    return this.prisma.pricingScheme.update({
      where: { id },
      data: {
        name: dto.name?.trim() || scheme.name,
        description: dto.description !== undefined ? dto.description : scheme.description,
        schemeType: dto.schemeType || scheme.schemeType,
        calculationMethod: dto.calculationMethod || scheme.calculationMethod,
        discountComponents: dto.discountComponents !== undefined ? (dto.discountComponents as any) : (scheme.discountComponents as any),
        baseRateListId: dto.baseRateListId !== undefined ? dto.baseRateListId : scheme.baseRateListId,
        paidQuantity: dto.paidQuantity !== undefined ? dto.paidQuantity : scheme.paidQuantity,
        freeQuantity: dto.freeQuantity !== undefined ? dto.freeQuantity : scheme.freeQuantity,
        minQuantity: dto.minQuantity !== undefined ? dto.minQuantity : scheme.minQuantity,
        maxQuantity: dto.maxQuantity !== undefined ? dto.maxQuantity : scheme.maxQuantity,
        applicableDealerTier: dto.applicableDealerTier || scheme.applicableDealerTier,
        paymentTerm: dto.paymentTerm || scheme.paymentTerm,
        effectiveFrom: dto.effectiveFrom ? new Date(dto.effectiveFrom) : scheme.effectiveFrom,
        effectiveTo: dto.effectiveTo !== undefined ? (dto.effectiveTo ? new Date(dto.effectiveTo) : null) : scheme.effectiveTo,
        isMobileVisible: dto.isMobileVisible !== undefined ? dto.isMobileVisible : scheme.isMobileVisible,
        isMobileSelectable: dto.isMobileSelectable !== undefined ? dto.isMobileSelectable : scheme.isMobileSelectable,
        isInternalOnly: dto.isInternalOnly !== undefined ? dto.isInternalOnly : scheme.isInternalOnly,
        priority: dto.priority !== undefined ? dto.priority : scheme.priority,
        status: dto.status || scheme.status,
      },
      include: { baseRateList: true },
    });
  }

  // ============================================================
  // 5. CENTRALIZED AUTHORITATIVE PRICE RESOLUTION ENGINE (REQUIREMENTS 18, 19, 20, 21, 22, 25)
  // ============================================================

  /**
   * Authoritative backend price resolution engine.
   * Single source of truth consumed identically by Web ERP, Mobile API, Sales Orders, and Invoices.
   */
  async resolvePrice(dto: ResolvePriceDto, actor?: AuthUser): Promise<ResolvedPriceResult> {
    const companyId = dto.companyId || actor?.companyId;
    if (!companyId) throw new BadRequestException('Company ID is required for price resolution');

    const quantity = Number(dto.quantity || 1);
    const orderDate = dto.orderDate ? new Date(dto.orderDate) : new Date();
    const paymentTerm = (dto.paymentTerm || 'CASH').toUpperCase();

    // 1. Validate Product
    const product = await this.prisma.finishedProduct.findFirst({
      where: { id: dto.finishedProductId, companyId },
      include: {
        packSize: true,
      },
    });
    if (!product) throw new NotFoundException('Finished product not found');

    // 2. Validate Dealer if provided (for tier/balance)
    if (dto.dealerId) {
      const dealer = await this.prisma.dealer.findFirst({
        where: { id: dto.dealerId, companyId },
        select: { id: true, code: true, name: true, creditLimit: true, currentBalance: true },
      });
      if (dealer) {
        this.logger.debug(`Resolved price for dealer ${dealer.code} (${dealer.name})`);
      }
    }

    // 3. Resolve Applicable Rate List & Version
    let resolvedBaseRate = Number(product.defaultSellingPrice || product.standardCost || 1200);
    let resolvedRateList: any = null;
    let resolvedVersion: any = null;

    if (dto.requestedRateListId) {
      // Explicit rate list requested
      resolvedRateList = await this.prisma.rateList.findFirst({
        where: { id: dto.requestedRateListId, companyId, status: 'ACTIVE' },
        include: {
          versions: {
            where: {
              status: 'ACTIVE',
              effectiveFrom: { lte: orderDate },
              OR: [{ effectiveTo: null }, { effectiveTo: { gte: orderDate } }],
            },
            orderBy: { versionNumber: 'desc' },
            take: 1,
            include: {
              items: {
                where: { finishedProductId: product.id, isActive: true },
              },
            },
          },
        },
      });
    }

    // If no explicit rate list or not found, search by category matching (SEASONAL -> CASH -> GENERAL)
    if (!resolvedRateList || !resolvedRateList.versions || resolvedRateList.versions.length === 0) {
      const candidateRateLists = await this.prisma.rateList.findMany({
        where: {
          companyId,
          status: 'ACTIVE',
          category: { in: ['SEASONAL', 'CASH', 'GENERAL'] },
        },
        orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
        include: {
          versions: {
            where: {
              status: 'ACTIVE',
              effectiveFrom: { lte: orderDate },
              OR: [{ effectiveTo: null }, { effectiveTo: { gte: orderDate } }],
            },
            orderBy: { versionNumber: 'desc' },
            take: 1,
            include: {
              items: {
                where: { finishedProductId: product.id, isActive: true },
              },
            },
          },
        },
      });

      // Find first with matching item or active version
      resolvedRateList = candidateRateLists.find((rl) => (rl.versions[0]?.items?.length ?? 0) > 0) || candidateRateLists[0];
    }

    if (resolvedRateList?.versions?.[0]) {
      resolvedVersion = resolvedRateList.versions[0];
      const item = resolvedVersion.items?.[0];
      if (item && item.baseRate) {
        resolvedBaseRate = Number(item.baseRate);
      }
    } else {
      // Backward compatibility fallback to legacy ProductRateList
      const legacyRate = await this.prisma.productRateList.findFirst({
        where: {
          companyId,
          finishedProductId: product.id,
          isActive: true,
          phase: (dto.pricingPhase as any) || (paymentTerm === 'CASH' ? 'CASH' : 'SEASONAL'),
        },
      });
      if (legacyRate) {
        resolvedBaseRate = Number(legacyRate.baseRate);
      }
    }

    // 4. Resolve Applicable Scheme
    let resolvedScheme: any = null;
    if (dto.requestedSchemeId) {
      resolvedScheme = await this.prisma.pricingScheme.findFirst({
        where: {
          id: dto.requestedSchemeId,
          companyId,
          status: 'ACTIVE',
          effectiveFrom: { lte: orderDate },
          OR: [{ effectiveTo: null }, { effectiveTo: { gte: orderDate } }],
        },
      });
    }

    // Fallback scheme: if no scheme requested, find default active scheme for payment term
    if (!resolvedScheme) {
      resolvedScheme = await this.prisma.pricingScheme.findFirst({
        where: {
          companyId,
          status: 'ACTIVE',
          effectiveFrom: { lte: orderDate },
          AND: [
            { OR: [{ effectiveTo: null }, { effectiveTo: { gte: orderDate } }] },
            { OR: [{ paymentTerm: paymentTerm }, { paymentTerm: 'ANY' }] },
          ],
        },
        orderBy: { priority: 'desc' },
      });
    }

    // 5. Calculate Scheme Discounts & Adjustments
    const discountBreakdown: Array<{ name: string; type: string; value: number; calculatedAmount: number }> = [];
    let calculatedRate = resolvedBaseRate;
    let freeQuantity = 0;

    if (resolvedScheme) {
      const calcMethod = resolvedScheme.calculationMethod || 'ADDITIVE';
      const components: Array<{ name: string; type: 'PERCENTAGE' | 'FLAT'; value: number }> =
        Array.isArray(resolvedScheme.discountComponents) ? (resolvedScheme.discountComponents as any) : [];

      if (calcMethod === 'ADDITIVE') {
        let totalPct = 0;
        let totalFlat = 0;

        for (const comp of components) {
          if (comp.type === 'PERCENTAGE') {
            const amount = (resolvedBaseRate * Number(comp.value)) / 100;
            totalPct += Number(comp.value);
            discountBreakdown.push({
              name: comp.name || 'Discount Component',
              type: 'PERCENTAGE',
              value: Number(comp.value),
              calculatedAmount: Number(amount.toFixed(2)),
            });
          } else if (comp.type === 'FLAT') {
            totalFlat += Number(comp.value);
            discountBreakdown.push({
              name: comp.name || 'Flat Discount',
              type: 'FLAT',
              value: Number(comp.value),
              calculatedAmount: Number(comp.value),
            });
          }
        }

        const totalPctDeduction = (resolvedBaseRate * totalPct) / 100;
        calculatedRate = Math.max(0, resolvedBaseRate - totalPctDeduction - totalFlat);
      } else {
        // SEQUENTIAL: each percentage step deducts from running remaining price
        let runningRate = resolvedBaseRate;
        for (const comp of components) {
          if (comp.type === 'PERCENTAGE') {
            const stepDeduction = (runningRate * Number(comp.value)) / 100;
            runningRate = Math.max(0, runningRate - stepDeduction);
            discountBreakdown.push({
              name: comp.name || 'Sequential Component',
              type: 'PERCENTAGE',
              value: Number(comp.value),
              calculatedAmount: Number(stepDeduction.toFixed(2)),
            });
          } else if (comp.type === 'FLAT') {
            runningRate = Math.max(0, runningRate - Number(comp.value));
            discountBreakdown.push({
              name: comp.name || 'Flat Component',
              type: 'FLAT',
              value: Number(comp.value),
              calculatedAmount: Number(comp.value),
            });
          }
        }
        calculatedRate = runningRate;
      }

      // Package rules (e.g. 10+1 free)
      const paidQtyReq = Number(resolvedScheme.paidQuantity || 0);
      const freeQtyBenefit = Number(resolvedScheme.freeQuantity || 0);
      if (paidQtyReq > 0 && freeQtyBenefit > 0 && quantity >= paidQtyReq) {
        const packageMultiples = Math.floor(quantity / paidQtyReq);
        freeQuantity = packageMultiples * freeQtyBenefit;
      }
    } else {
      // Default standard Cash 15% discount if payment is Cash and no scheme configured
      if (paymentTerm === 'CASH') {
        const cashDiscountAmount = (resolvedBaseRate * 15.0) / 100;
        calculatedRate = resolvedBaseRate - cashDiscountAmount;
        discountBreakdown.push({
          name: 'Standard Cash Discount',
          type: 'PERCENTAGE',
          value: 15.0,
          calculatedAmount: cashDiscountAmount,
        });
      }
    }

    // 6. Handle Custom Negotiated Rate / Net Rate (Requirement 15, 16)
    let finalUnitRate = calculatedRate;
    let isCustomRate = false;
    let priceDrop = 0;
    let priceDropPct = 0;

    if (dto.requestedRate !== undefined && dto.requestedRate !== null && Number(dto.requestedRate) > 0) {
      isCustomRate = true;
      finalUnitRate = Number(dto.requestedRate);
      priceDrop = resolvedBaseRate - finalUnitRate;
      priceDropPct = resolvedBaseRate > 0 ? (priceDrop / resolvedBaseRate) * 100 : 0;
    }

    // 7. Role Authority & Approval Governance (Requirement 17)
    await this.ensureDefaultAuthorityLimits(actor?.organizationId || '', companyId);
    const limits = await this.prisma.pricingAuthorityLimit.findMany({ where: { companyId } });

    const userRoles = Array.isArray(actor?.roles) ? actor.roles.map((r: string) => r.toUpperCase()) : ['SALES_OFFICER'];
    const matchedLimit: any = limits.find((l: any) => userRoles.includes(l.roleCode.toUpperCase())) ||
      limits.find((l: any) => l.roleCode === 'SALES_OFFICER');

    const maxAllowedPct = matchedLimit ? Number(matchedLimit.maxDiscountPct) : 5.0;
    const canSetNetRate = matchedLimit ? matchedLimit.canSetNetRate : false;
    const canApplySpecialRate = matchedLimit ? matchedLimit.canApplySpecialRate : false;

    let isAuthorized = true;
    let approvalRequired = false;
    let authorityRequired = matchedLimit ? matchedLimit.roleCode : 'SALES_OFFICER';

    if (isCustomRate) {
      if (priceDropPct > maxAllowedPct || (!canSetNetRate && !canApplySpecialRate)) {
        isAuthorized = false;
        approvalRequired = true;

        if (priceDropPct <= 15.0) authorityRequired = 'AREA_MANAGER';
        else if (priceDropPct <= 25.0) authorityRequired = 'BUSINESS_MANAGER';
        else authorityRequired = 'ADMIN';
      }
    }

    const discountAmountPerUnit = Math.max(0, resolvedBaseRate - finalUnitRate);
    const totalDiscountAmount = discountAmountPerUnit * quantity;
    const grossAmount = resolvedBaseRate * quantity;
    const finalAmount = finalUnitRate * quantity;
    const discountPercent = resolvedBaseRate > 0 ? Number(((discountAmountPerUnit / resolvedBaseRate) * 100).toFixed(2)) : 0;

    return {
      finishedProductId: product.id,
      productCode: product.productCode,
      productName: product.productName,
      baseRate: resolvedBaseRate,
      rateListId: resolvedRateList?.id,
      rateListName: resolvedRateList?.name,
      rateListVersionId: resolvedVersion?.id,
      versionNumber: resolvedVersion?.versionNumber,
      schemeId: resolvedScheme?.id,
      schemeName: resolvedScheme?.name,
      schemeType: resolvedScheme?.schemeType,
      calculationMethod: resolvedScheme?.calculationMethod,
      discountComponents: discountBreakdown,
      discountPercent,
      discountAmount: Number(discountAmountPerUnit.toFixed(2)),
      freeQuantity,
      finalUnitRate: Number(finalUnitRate.toFixed(2)),
      quantity,
      grossAmount: Number(grossAmount.toFixed(2)),
      totalDiscountAmount: Number(totalDiscountAmount.toFixed(2)),
      finalAmount: Number(finalAmount.toFixed(2)),
      paymentTerm,
      authorityRequired,
      approvalRequired,
      isCustomRate,
      isAuthorized,
      reason: isCustomRate
        ? isAuthorized
          ? 'Approved within user role authority'
          : `Exceeds discount threshold (${priceDropPct.toFixed(1)}% > ${maxAllowedPct}%). Requires ${authorityRequired} approval.`
        : undefined,
      commercialCondition: dto.requestedCondition || resolvedScheme?.name || null,
      effectiveFrom: resolvedVersion?.effectiveFrom?.toISOString(),
      effectiveTo: resolvedVersion?.effectiveTo?.toISOString(),
    };
  }

  // ============================================================
  // 6. LEGACY COMPATIBILITY METHODS (PHASE 1-4.5 PRESERVATION)
  // ============================================================

  async getLegacyRateLists(companyId: string, filter?: { finishedProductId?: string; phase?: string }) {
    const where: any = { companyId };
    if (filter?.finishedProductId) where.finishedProductId = filter.finishedProductId;
    if (filter?.phase) where.phase = filter.phase;

    return this.prisma.productRateList.findMany({
      where,
      include: {
        finishedProduct: {
          select: {
            id: true,
            productCode: true,
            productName: true,
            defaultSellingPrice: true,
            standardCost: true,
            fertilizerType: true,
          },
        },
      },
      orderBy: [{ finishedProduct: { productName: 'asc' } }, { phase: 'asc' }],
    });
  }

  async upsertLegacyRateList(dto: UpsertRateListDto, actor: AuthUser) {
    const organizationId = actor.organizationId;
    const companyId = actor.companyId;

    const existing = await this.prisma.productRateList.findFirst({
      where: {
        companyId,
        finishedProductId: dto.finishedProductId,
        phase: dto.phase,
      },
    });

    if (existing) {
      return this.prisma.productRateList.update({
        where: { id: existing.id },
        data: {
          baseRate: dto.baseRate,
          cashDiscountPercent: dto.cashDiscountPercent ?? 0,
          minAllowedRate: dto.minAllowedRate ?? null,
          effectiveDate: dto.effectiveDate ? new Date(dto.effectiveDate) : undefined,
          isActive: dto.isActive ?? true,
        },
        include: { finishedProduct: true },
      });
    }

    return this.prisma.productRateList.create({
      data: {
        id: uuidv7(),
        organizationId,
        companyId,
        finishedProductId: dto.finishedProductId,
        phase: dto.phase,
        baseRate: dto.baseRate,
        cashDiscountPercent: dto.cashDiscountPercent ?? 0,
        minAllowedRate: dto.minAllowedRate ?? null,
        effectiveDate: dto.effectiveDate ? new Date(dto.effectiveDate) : new Date(),
        isActive: dto.isActive ?? true,
      },
      include: { finishedProduct: true },
    });
  }
}
