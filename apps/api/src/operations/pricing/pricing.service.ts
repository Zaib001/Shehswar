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
  // 1.5. SCHEME TYPE MASTER (REQUIREMENTS 2, 4, 25)
  // ============================================================

  /**
   * Ensure predefined initial Scheme Types exist: CA, ABC, SR, NNR
   */
  async ensureDefaultSchemeTypes(organizationId: string, companyId?: string) {
    const predefined = [
      { code: 'CA', name: 'Cash Advance', defaultShortCode: 'CA', description: 'Immediate cash advance scheme with cash discount commercial benefit' },
      { code: 'ABC', name: 'Advance Booking', defaultShortCode: 'ABC', description: 'Advance booking campaign with cash discount and booking benefit' },
      { code: 'SR', name: 'Seasonal Scheme', defaultShortCode: 'SR', description: 'Seasonal promotional scheme with product-wise seasonal rates' },
      { code: 'NNR', name: 'Net Net Rate', defaultShortCode: 'NNR', description: 'Dealer net net rate list with direct commercial net rates' },
    ];

    for (const item of predefined) {
      const existing = await this.prisma.schemeType.findFirst({
        where: { organizationId, code: item.code },
      });
      if (!existing) {
        await this.prisma.schemeType.create({
          data: {
            id: uuidv7(),
            organizationId,
            companyId: companyId || null,
            code: item.code,
            name: item.name,
            defaultShortCode: item.defaultShortCode,
            description: item.description,
            isPredefined: true,
            isActive: true,
            status: 'ACTIVE',
          },
        });
      } else if (!existing.defaultShortCode) {
        await this.prisma.schemeType.update({
          where: { id: existing.id },
          data: { defaultShortCode: item.defaultShortCode },
        });
      }
    }
  }

  /**
   * Ensure default Payment Types exist for the organization (CASH, CREDIT)
   */
  async ensureDefaultPaymentTypes(organizationId: string, companyId?: string) {
    const predefined = [
      { code: 'CASH', name: 'Cash', description: 'Cash / immediate payment terms' },
      { code: 'CREDIT', name: 'Credit', description: 'Credit terms for commercial bookings' },
    ];

    for (const item of predefined) {
      const existing = await this.prisma.schemePaymentType.findFirst({
        where: { organizationId, code: item.code },
      });
      if (!existing) {
        await this.prisma.schemePaymentType.create({
          data: {
            id: uuidv7(),
            organizationId,
            companyId: companyId || null,
            code: item.code,
            name: item.name,
            description: item.description,
            isPredefined: true,
            isActive: true,
            status: 'ACTIVE',
          },
        });
      }
    }
  }

  /**
   * List all active Payment Types (predefined + custom user-created)
   */
  async getSchemePaymentTypes(organizationId: string, companyId?: string) {
    await this.ensureDefaultPaymentTypes(organizationId, companyId);
    return this.prisma.schemePaymentType.findMany({
      where: { organizationId, isActive: true },
      orderBy: [{ isPredefined: 'desc' }, { name: 'asc' }],
    });
  }

  /**
   * Create new Payment Type dynamically (Requirements 15, 16, 17, 18)
   */
  async createSchemePaymentType(
    dto: { code: string; name: string; description?: string; status?: string },
    actor: AuthUser,
  ) {
    const code = (dto.code || dto.name).trim().toUpperCase().replace(/\s+/g, '_');
    const existing = await this.prisma.schemePaymentType.findFirst({
      where: { organizationId: actor.organizationId, code },
    });
    if (existing) {
      throw new BadRequestException(`Payment type with code '${code}' already exists`);
    }

    return this.prisma.schemePaymentType.create({
      data: {
        id: uuidv7(),
        organizationId: actor.organizationId,
        companyId: actor.companyId,
        code,
        name: dto.name.trim(),
        description: dto.description || null,
        status: dto.status || 'ACTIVE',
        isPredefined: false,
        isActive: true,
      },
    });
  }

  /**
   * List all active Scheme Types (predefined + custom user-created)
   */
  async getSchemeTypes(organizationId: string, companyId?: string) {
    await this.ensureDefaultSchemeTypes(organizationId, companyId);
    return this.prisma.schemeType.findMany({
      where: { organizationId, isActive: true },
      orderBy: [{ isPredefined: 'desc' }, { code: 'asc' }],
    });
  }

  /**
   * Create new Scheme Type (Requirement 2 & 25: allows admins to add scheme types later without code changes)
   */
  async createSchemeType(
    dto: { code: string; name: string; defaultShortCode?: string; description?: string; status?: string },
    actor: AuthUser,
  ) {
    const code = dto.code.trim().toUpperCase();
    const existing = await this.prisma.schemeType.findFirst({
      where: { organizationId: actor.organizationId, code },
    });
    if (existing) {
      throw new BadRequestException(`Scheme type with code '${code}' already exists`);
    }

    return this.prisma.schemeType.create({
      data: {
        id: uuidv7(),
        organizationId: actor.organizationId,
        companyId: actor.companyId,
        code,
        name: dto.name.trim(),
        defaultShortCode: dto.defaultShortCode?.trim() || code,
        description: dto.description || null,
        status: dto.status || 'ACTIVE',
        isPredefined: false,
        isActive: true,
      },
    });
  }

  // ============================================================
  // 2. ACTIVE PRODUCTS AUTO-POPULATOR (REQUIREMENTS 7, 8, 9)
  // ============================================================

  /**
   * Fetch all active sellable Finished Products from real database for rate list initialization
   * STRICT: ONLY Finished Products; NO raw materials, packing materials, bottles, cartons, wastage.
   */
  async getActiveFinishedProductsForRateList(companyId: string) {
    const products = await this.prisma.finishedProduct.findMany({
      where: { companyId, status: 'ACTIVE', deletedAt: null },
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
        packingQuantity: true,
        packingUnit: true,
        category: { select: { id: true, code: true, name: true } },
        packSize: { select: { id: true, code: true, name: true } },
        packagingMaterial: { select: { id: true, materialCode: true, materialName: true } },
        salesUom: { select: { id: true, code: true, name: true } },
        baseUom: { select: { id: true, code: true, name: true } },
      },
      orderBy: [{ category: { name: 'asc' } }, { productName: 'asc' }],
    });

    return products.map((p) => {
      const basePrice = Number(p.defaultSellingPrice || p.standardCost || 0);
      const packagingText = p.packagingMaterial?.materialName
        ? p.packagingMaterial.materialName
        : p.packingQuantity && p.packingUnit
        ? `${p.packingQuantity} ${p.packingUnit} Pack`
        : 'Standard Packaging';
      const packSizeText = p.packSize?.name
        ? p.packSize.name
        : p.packingQuantity
        ? `${p.packingQuantity} ${p.packingUnit || ''}`.trim()
        : 'Standard';
      const unitText = p.salesUom?.code || p.packingUnit || 'Unit';
      const categoryName = p.category?.name || 'Finished Goods';

      return {
        finishedProductId: p.id,
        productCode: p.productCode,
        productName: p.productName,
        category: categoryName,
        packaging: packagingText,
        packSizeId: p.packSizeId,
        packSize: packSizeText,
        packSizeName: packSizeText,
        unit: unitText,
        baseRate: basePrice,
        baseSellingPrice: basePrice,
        schemeRate: basePrice,
        discountType: 'PERCENTAGE',
        discountValue: 0,
        discountPercent: 0,
        rateType: 'DIRECT',
        fixedNetRate: null,
        minAllowedRate: Math.round(basePrice * 0.8),
        quantityFrom: 1,
        quantityTo: null,
        freeQuantity: 0,
        commercialCondition: null,
        isActive: true,
      };
    });
  }

  // ============================================================
  // 3. DYNAMIC RATE LIST MANAGEMENT (REQUIREMENTS 6, 7, 8, 9, 10, 11, 13, 21, 23)
  // ============================================================

  /**
   * List all Rate Lists with their versions and active items count
   */
  async getRateLists(
    companyId: string,
    filter?: { category?: string; status?: string; isMobileVisible?: boolean; schemeId?: string },
  ) {
    const where: any = { companyId };
    if (filter?.category) where.category = filter.category;
    if (filter?.status) {
      where.status = filter.status;
    } else {
      where.status = { not: 'ARCHIVED' };
    }
    if (filter?.schemeId) where.schemeId = filter.schemeId;
    if (filter?.isMobileVisible !== undefined) where.isMobileVisible = filter.isMobileVisible;

    const rateLists = await this.prisma.rateList.findMany({
      where,
      include: {
        scheme: {
          select: {
            id: true,
            code: true,
            shortCode: true,
            name: true,
            schemeType: true,
            schemeTypeCode: true,
            status: true,
            startDate: true,
            endDate: true,
          },
        },
        versions: {
          orderBy: { versionNumber: 'desc' },
          include: {
            _count: { select: { items: true } },
            items: {
              include: {
                finishedProduct: {
                  select: {
                    id: true,
                    productCode: true,
                    productName: true,
                    defaultSellingPrice: true,
                    standardCost: true,
                    category: { select: { name: true } },
                    packagingMaterial: { select: { materialName: true } },
                    packSize: { select: { name: true } },
                    salesUom: { select: { code: true } },
                    packingQuantity: true,
                    packingUnit: true,
                  },
                },
                packSize: { select: { id: true, code: true, name: true } },
              },
              orderBy: { finishedProduct: { productName: 'asc' } },
            },
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
        productCount: activeVersion?._count?.items ?? activeVersion?.items?.length ?? 0,
        totalVersionsCount: rl.versions.length,
        usageCount: rl._count.salesOrders,
        items: activeVersion?.items || [],
      };
    });
  }

  /**
   * Retrieve single Rate List with full version and item details
   */
  async getRateListById(id: string, companyId?: string) {
    let rateList = await this.prisma.rateList.findFirst({
      where: companyId ? { id, companyId } : { id },
      include: {
        scheme: {
          include: { schemeTypeRef: true },
        },
        versions: {
          orderBy: { versionNumber: 'desc' },
          include: {
            items: {
              include: {
                finishedProduct: {
                  select: {
                    id: true,
                    productCode: true,
                    productName: true,
                    defaultSellingPrice: true,
                    standardCost: true,
                    category: { select: { name: true } },
                    packagingMaterial: { select: { materialName: true } },
                    packSize: { select: { name: true } },
                    salesUom: { select: { code: true } },
                    packingQuantity: true,
                    packingUnit: true,
                  },
                },
                packSize: { select: { id: true, code: true, name: true } },
              },
              orderBy: { finishedProduct: { productName: 'asc' } },
            },
          },
        },
      },
    });

    if (!rateList && companyId) {
      rateList = await this.prisma.rateList.findFirst({
        where: { id },
        include: {
          scheme: {
            include: { schemeTypeRef: true },
          },
          versions: {
            orderBy: { versionNumber: 'desc' },
            include: {
              items: {
                include: {
                  finishedProduct: {
                    select: {
                      id: true,
                      productCode: true,
                      productName: true,
                      defaultSellingPrice: true,
                      standardCost: true,
                      category: { select: { name: true } },
                      packagingMaterial: { select: { materialName: true } },
                      packSize: { select: { name: true } },
                      salesUom: { select: { code: true } },
                      packingQuantity: true,
                      packingUnit: true,
                    },
                  },
                  packSize: { select: { id: true, code: true, name: true } },
                },
                orderBy: { finishedProduct: { productName: 'asc' } },
              },
            },
          },
        },
      });
    }

    if (!rateList) throw new NotFoundException('Rate list not found');
    return rateList;
  }

  /**
   * Create a new Rate List with Version 1 and items
   * Enforces Duplicate Rate Protection (Requirement 23)
   */
  async createRateList(dto: CreateRateListDto, actor: AuthUser) {
    const organizationId = actor.organizationId;
    const companyId = actor.companyId;

    // Check unique code
    const existingCode = await this.prisma.rateList.findFirst({
      where: { companyId, code: dto.code.trim().toUpperCase() },
    });
    if (existingCode) {
      throw new BadRequestException(`Rate list with code '${dto.code}' already exists in this company`);
    }

    const effectiveFrom = dto.effectiveFrom ? new Date(dto.effectiveFrom) : new Date();
    const effectiveTo = dto.effectiveTo ? new Date(dto.effectiveTo) : null;

    let schemeName = dto.schemeName || null;
    let schemeShortCode = dto.schemeShortCode || null;

    // Resolve and validate scheme if provided
    if (dto.schemeId) {
      const scheme = await this.prisma.pricingScheme.findFirst({
        where: { id: dto.schemeId, companyId },
      });
      if (scheme) {
        schemeName = scheme.name;
        schemeShortCode = scheme.shortCode || scheme.code;

        // Requirement 23: Duplicate rate protection
        // Prevent conflicting active rates for: Same Scheme + Same Valid Date/Period
        const conflictingRateList = await this.prisma.rateList.findFirst({
          where: {
            companyId,
            schemeId: dto.schemeId,
            status: 'ACTIVE',
            versions: {
              some: {
                status: 'ACTIVE',
                effectiveFrom: { lte: effectiveTo || new Date('2099-12-31') },
                OR: [
                  { effectiveTo: null },
                  { effectiveTo: { gte: effectiveFrom } },
                ],
              },
            },
          },
          include: { versions: { where: { status: 'ACTIVE' }, take: 1 } },
        });

        if (conflictingRateList) {
          throw new BadRequestException(
            `Conflicting active Rate List (${conflictingRateList.code} - ${conflictingRateList.name}) already exists for scheme '${scheme.name}' during this period. To update rates, please create a new version of the existing Rate List.`,
          );
        }
      }
    }

    const createdRateList = await this.prisma.$transaction(async (tx) => {
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
          schemeId: dto.schemeId || null,
          schemeShortCode,
          schemeName,
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
          data: dto.items.map((it) => {
            const baseRate = Number(it.baseRate || 0);
            const schemeRate = it.schemeRate !== undefined && it.schemeRate !== null
              ? Number(it.schemeRate)
              : it.fixedNetRate !== undefined && it.fixedNetRate !== null
              ? Number(it.fixedNetRate)
              : baseRate;
            const discountPercent = it.discountPercent !== undefined && it.discountPercent !== null
              ? Number(it.discountPercent)
              : it.discountValue !== undefined && it.discountValue !== null
              ? Number(it.discountValue)
              : baseRate > 0 && schemeRate < baseRate
              ? Number((((baseRate - schemeRate) / baseRate) * 100).toFixed(2))
              : 0;

            return {
              id: uuidv7(),
              rateListVersionId: version.id,
              finishedProductId: it.finishedProductId,
              packSizeId: it.packSizeId || null,
              baseRate,
              schemeRate,
              discountPercent,
              rateType: it.rateType || 'DIRECT',
              unit: it.unit || 'BAG',
              discountType: it.discountType || 'PERCENTAGE',
              discountValue: discountPercent,
              fixedNetRate: it.rateType === 'NET_NET' ? schemeRate : it.fixedNetRate ?? null,
              minAllowedRate: it.minAllowedRate ?? Math.round(baseRate * 0.8),
              quantityFrom: it.quantityFrom ?? 1,
              quantityTo: it.quantityTo ?? null,
              freeQuantity: it.freeQuantity ?? 0,
              commercialCondition: it.commercialCondition || null,
              isActive: it.isActive ?? true,
            };
          }),
        });
      }

      this.logger.log(`Rate list created: ${rateList.code} (${rateList.name}) for scheme ${schemeName || 'None'} by ${actor.email}`);
      return rateList;
    });

    return this.getRateListById(createdRateList.id, companyId);
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
   * Create a new version for a Rate List (Requirement 13: Versioning without overwriting history)
   */
  async createRateListVersion(dto: CreateRateListVersionDto, actor: AuthUser) {
    const rateList = await this.prisma.rateList.findFirst({
      where: { id: dto.rateListId, companyId: actor.companyId },
      include: {
        scheme: true,
        versions: { orderBy: { versionNumber: 'desc' }, take: 1 },
      },
    });
    if (!rateList) throw new NotFoundException('Rate list not found');

    const nextVersionNumber = dto.versionNumber || (rateList.versions[0]?.versionNumber || 0) + 1;
    const effectiveFrom = new Date(dto.effectiveFrom);
    const effectiveTo = dto.effectiveTo ? new Date(dto.effectiveTo) : null;

    await this.prisma.$transaction(async (tx) => {
      // Deactivate older overlapping active versions
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
          data: dto.items.map((it) => {
            const baseRate = Number(it.baseRate || 0);
            const schemeRate = it.schemeRate !== undefined && it.schemeRate !== null
              ? Number(it.schemeRate)
              : it.fixedNetRate !== undefined && it.fixedNetRate !== null
              ? Number(it.fixedNetRate)
              : baseRate;
            const discountPercent = it.discountPercent !== undefined && it.discountPercent !== null
              ? Number(it.discountPercent)
              : it.discountValue !== undefined && it.discountValue !== null
              ? Number(it.discountValue)
              : baseRate > 0 && schemeRate < baseRate
              ? Number((((baseRate - schemeRate) / baseRate) * 100).toFixed(2))
              : 0;

            return {
              id: uuidv7(),
              rateListVersionId: version.id,
              finishedProductId: it.finishedProductId,
              packSizeId: it.packSizeId || null,
              baseRate,
              schemeRate,
              discountPercent,
              rateType: it.rateType || 'DIRECT',
              unit: it.unit || 'BAG',
              discountType: it.discountType || 'PERCENTAGE',
              discountValue: discountPercent,
              fixedNetRate: it.rateType === 'NET_NET' ? schemeRate : it.fixedNetRate ?? null,
              minAllowedRate: it.minAllowedRate ?? Math.round(baseRate * 0.8),
              quantityFrom: it.quantityFrom ?? 1,
              quantityTo: it.quantityTo ?? null,
              freeQuantity: it.freeQuantity ?? 0,
              commercialCondition: it.commercialCondition || null,
              isActive: it.isActive ?? true,
            };
          }),
        });
      }

      this.logger.log(`Created Version ${nextVersionNumber} for Rate List ${rateList.code}`);
    });

    return this.getRateListById(rateList.id, actor.companyId);
  }

  /**
   * Add new products to an existing Rate List without rebuilding (Requirement 21)
   */
  async addNewProductsToRateList(rateListId: string, productIds: string[], actor: AuthUser) {
    const rateList = await this.prisma.rateList.findFirst({
      where: { id: rateListId, companyId: actor.companyId },
      include: {
        scheme: true,
        versions: {
          where: { status: 'ACTIVE' },
          orderBy: { versionNumber: 'desc' },
          take: 1,
          include: { items: true },
        },
      },
    });

    if (!rateList) throw new NotFoundException('Rate list not found');
    const activeVersion = rateList.versions[0];
    if (!activeVersion) throw new BadRequestException('No active version found in rate list');

    const existingProductIds = new Set(activeVersion.items.map((it) => it.finishedProductId));
    let candidateIds = productIds;
    if (!candidateIds || candidateIds.length === 0) {
      const allActive = await this.prisma.finishedProduct.findMany({
        where: { companyId: actor.companyId, status: 'ACTIVE', deletedAt: null },
        select: { id: true },
      });
      candidateIds = allActive.map((p) => p.id);
    }
    const missingProductIds = candidateIds.filter((pid) => !existingProductIds.has(pid));

    if (missingProductIds.length === 0) {
      return this.getRateListById(rateList.id, actor.companyId);
    }

    const productsToAdd = await this.prisma.finishedProduct.findMany({
      where: {
        id: { in: missingProductIds },
        companyId: actor.companyId,
        status: 'ACTIVE',
        deletedAt: null,
      },
    });

    const scheme = rateList.scheme;
    const schemeType = scheme?.schemeTypeCode || scheme?.schemeType || 'SR';

    const newItems = productsToAdd.map((p) => {
      const baseRate = Number(p.defaultSellingPrice || p.standardCost || 0);
      let discountPercent = 0;
      let schemeRate = baseRate;
      let rateType = 'DIRECT';

      if (schemeType === 'CA') {
        discountPercent = Number(scheme?.cashDiscountPct || 15);
        schemeRate = Math.round(baseRate * (1 - discountPercent / 100));
        rateType = 'DISCOUNT';
      } else if (schemeType === 'ABC') {
        discountPercent = Number(scheme?.cashDiscountPct || 0) + Number(scheme?.additionalBookingPct || 0);
        schemeRate = Math.round(baseRate * (1 - discountPercent / 100));
        rateType = 'DISCOUNT';
      } else if (schemeType === 'NNR') {
        schemeRate = baseRate;
        rateType = 'NET_NET';
      } else {
        discountPercent = Number(scheme?.defaultDiscountPct || 0);
        schemeRate = discountPercent > 0 ? Math.round(baseRate * (1 - discountPercent / 100)) : baseRate;
        rateType = 'DIRECT';
      }

      return {
        id: uuidv7(),
        rateListVersionId: activeVersion.id,
        finishedProductId: p.id,
        packSizeId: p.packSizeId || null,
        baseRate,
        schemeRate,
        discountPercent,
        discountValue: discountPercent,
        rateType,
        unit: 'BAG',
        fixedNetRate: rateType === 'NET_NET' ? schemeRate : null,
        minAllowedRate: Math.round(baseRate * 0.8),
        quantityFrom: 1,
        quantityTo: null,
        freeQuantity: 0,
        commercialCondition: null,
        isActive: true,
      };
    });

    await this.prisma.rateListItem.createMany({
      data: newItems,
    });

    this.logger.log(`Added ${newItems.length} products to Rate List ${rateList.code}`);
    return this.getRateListById(rateList.id, actor.companyId);
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
      schemeRate: it.schemeRate !== null ? Number(it.schemeRate) : Number(it.baseRate),
      discountPercent: Number(it.discountPercent || it.discountValue || 0),
      rateType: it.rateType || 'DIRECT',
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
        schemeId: source.schemeId || undefined,
        schemeShortCode: source.schemeShortCode || undefined,
        schemeName: source.schemeName || undefined,
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
   * Delete or Archive Rate List
   * If never used in sales orders, deletes completely. If historical transactions exist, archives.
   */
  async archiveRateList(id: string, actor: AuthUser) {
    const rateList = await this.prisma.rateList.findFirst({
      where: { id, companyId: actor.companyId },
      include: {
        _count: { select: { salesOrders: true, salesOrderItems: true } },
      },
    });
    if (!rateList) throw new NotFoundException('Rate list not found');

    if (rateList._count.salesOrders > 0 || rateList._count.salesOrderItems > 0) {
      return this.prisma.rateList.update({
        where: { id },
        data: { status: 'ARCHIVED' },
      });
    }

    return this.prisma.rateList.delete({
      where: { id },
    });
  }

  /**
   * Professional Rate List PDF Generation (Requirements 19 & 20)
   * Generates clean, publication-ready printable HTML document.
   */
  async generateRateListPdfHtml(rateListId: string, companyId: string): Promise<string> {
    const rateList = await this.prisma.rateList.findFirst({
      where: { id: rateListId, companyId },
      include: {
        scheme: {
          include: { schemeTypeRef: true },
        },
        company: true,
        versions: {
          orderBy: { versionNumber: 'desc' },
          take: 1,
          include: {
            items: {
              where: { isActive: true },
              include: {
                finishedProduct: {
                  include: {
                    category: true,
                    packagingMaterial: true,
                    packSize: true,
                    salesUom: true,
                  },
                },
                packSize: true,
              },
              orderBy: { finishedProduct: { productName: 'asc' } },
            },
          },
        },
      },
    });

    if (!rateList) throw new NotFoundException('Rate list not found');
    const version = rateList.versions[0];
    const items = version?.items || [];
    const scheme = rateList.scheme;

    const companyName = rateList.company?.name || 'SHEHSWAR CHEMICALS (PVT) LTD';
    const schemeName = scheme?.name || rateList.name;
    const schemeCode = scheme?.shortCode || scheme?.code || rateList.code;
    const schemeTypeName = scheme?.schemeTypeRef?.name || scheme?.schemeType || rateList.category || 'Standard Rate List';
    const validFrom = version?.effectiveFrom
      ? new Date(version.effectiveFrom).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
      : 'Immediate';
    const validUntil = version?.effectiveTo
      ? new Date(version.effectiveTo).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
      : 'Until Further Notice';

    const rowsHtml = items
      .map((it, idx) => {
        const fp = it.finishedProduct;
        const pCode = fp?.productCode || '-';
        const pName = fp?.productName || 'Product';
        const category = fp?.category?.name || 'Finished Goods';
        const pack = fp?.packSize?.name || (fp?.packingQuantity ? `${fp.packingQuantity} ${fp.packingUnit || ''}`.trim() : it.unit || 'Standard');
        const basePrice = Number(it.baseRate || 0).toLocaleString();
        const schemeRate = Number(it.schemeRate ?? it.fixedNetRate ?? it.baseRate).toLocaleString();
        const discPct = it.discountPercent ? `${Number(it.discountPercent)}%` : '-';

        return `
          <tr>
            <td style="text-align:center;">${idx + 1}</td>
            <td style="font-family:monospace; font-weight:600; color:#1e293b;">${pCode}</td>
            <td style="font-weight:600; color:#0f172a;">${pName}</td>
            <td style="color:#64748b;">${category}</td>
            <td style="font-weight:500;">${pack}</td>
            <td style="text-align:right; color:#64748b;">PKR ${basePrice}</td>
            <td style="text-align:center; color:#059669; font-weight:600;">${discPct}</td>
            <td style="text-align:right; font-weight:700; color:#0f172a; font-size:10pt; background:#f8fafc;">PKR ${schemeRate}</td>
          </tr>
        `;
      })
      .join('');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${schemeName} - Official Rate List</title>
  <style>
    @page { size: A4 portrait; margin: 12mm 15mm 15mm 15mm; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #0f172a;
      background: #ffffff;
      margin: 0;
      padding: 24px;
      font-size: 9pt;
      line-height: 1.4;
    }
    .header {
      border-bottom: 2px solid #0f172a;
      padding-bottom: 12px;
      margin-bottom: 16px;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }
    .brand-title {
      font-size: 16pt;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #0f172a;
      margin: 0;
    }
    .brand-sub {
      font-size: 8pt;
      color: #64748b;
      margin-top: 2px;
      letter-spacing: 0.02em;
    }
    .badge {
      display: inline-block;
      padding: 4px 12px;
      background: #0f172a;
      color: #ffffff;
      font-size: 8.5pt;
      font-weight: 700;
      letter-spacing: 0.05em;
      border-radius: 4px;
      text-transform: uppercase;
    }
    .meta-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 12px 16px;
      margin-bottom: 16px;
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
    }
    .meta-item label {
      display: block;
      font-size: 7pt;
      text-transform: uppercase;
      font-weight: 700;
      color: #64748b;
      margin-bottom: 2px;
    }
    .meta-item span {
      font-size: 9.5pt;
      font-weight: 700;
      color: #0f172a;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 10px;
    }
    th {
      background: #0f172a;
      color: #ffffff;
      text-align: left;
      padding: 8px 10px;
      font-size: 7.5pt;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      font-weight: 700;
      border: 1px solid #0f172a;
    }
    td {
      padding: 7px 10px;
      border-bottom: 1px solid #e2e8f0;
      font-size: 8.5pt;
    }
    tr:nth-child(even) {
      background-color: #fafafa;
    }
    .footer {
      margin-top: 24px;
      padding-top: 12px;
      border-top: 1px dashed #cbd5e1;
      display: flex;
      justify-content: space-between;
      color: #64748b;
      font-size: 7.5pt;
    }
    .notice {
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      color: #1e40af;
      padding: 8px 12px;
      border-radius: 4px;
      margin-top: 16px;
      font-size: 8pt;
    }
    @media print {
      body { padding: 0; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1 class="brand-title">${companyName}</h1>
      <div class="brand-sub">Crop Protection & Plant Nutrition • Authoritative Rate List Sheet</div>
    </div>
    <div style="text-align:right;">
      <span class="badge">OFFICIAL RATE LIST</span>
      <div style="font-family:monospace; font-weight:700; color:#0f172a; margin-top:4px;">REF: ${rateList.code}</div>
      <div style="font-size:7.5pt; color:#64748b; margin-top:2px;">Version ${version?.versionNumber || 1}</div>
    </div>
  </div>

  <div class="meta-card">
    <div class="meta-item">
      <label>Scheme Name</label>
      <span>${schemeName}</span>
    </div>
    <div class="meta-item">
      <label>Scheme Code / Short Code</label>
      <span style="font-family:monospace; color:#2563eb;">${schemeCode}</span>
    </div>
    <div class="meta-item">
      <label>Scheme Type</label>
      <span>${schemeTypeName}</span>
    </div>
    <div class="meta-item">
      <label>Validity Window</label>
      <span>${validFrom} → ${validUntil}</span>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width: 4%; text-align:center;">#</th>
        <th style="width: 14%;">Product Code</th>
        <th style="width: 28%;">Product Description</th>
        <th style="width: 14%;">Category</th>
        <th style="width: 12%;">Pack Size</th>
        <th style="width: 11%; text-align:right;">Base Price</th>
        <th style="width: 6%; text-align:center;">Disc %</th>
        <th style="width: 11%; text-align:right;">Scheme Rate</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml}
    </tbody>
  </table>

  <div class="notice">
    <strong>Commercial Note:</strong> Rates listed above are applicable for <em>${schemeName}</em> orders only and are validated in real-time by the Shehswar ONE360 authoritative database engine. Rates are subject to terms and approval limits.
  </div>

  <div class="footer">
    <div>Printed on: ${new Date().toLocaleString('en-GB')} | Generated by Shehswar ONE360 ERP Engine</div>
    <div>Page 1 of 1 • Authoritative Pricing Record</div>
  </div>
</body>
</html>`;
  }

  // ============================================================
  // 4. SCHEME MASTER & COMMERCIAL LOGIC (REQUIREMENTS 1, 2, 3, 4, 5, 11, 12, 14)
  // ============================================================

  /**
   * Determine scheme status automatically based on validity dates (Requirement 12)
   * Statuses: Draft, Scheduled, Active, Expired, Inactive
   */
  computeSchemeStatus(scheme: {
    status?: string | null;
    startDate?: Date | string | null;
    endDate?: Date | string | null;
    effectiveFrom?: Date | string | null;
    effectiveTo?: Date | string | null;
  }): 'DRAFT' | 'SCHEDULED' | 'ACTIVE' | 'EXPIRED' | 'INACTIVE' {
    const raw = (scheme.status || 'ACTIVE').toUpperCase();
    if (raw === 'DRAFT' || raw === 'INACTIVE' || raw === 'ARCHIVED') {
      return raw === 'ARCHIVED' ? 'INACTIVE' : (raw as any);
    }

    const now = new Date();
    const start = scheme.startDate ? new Date(scheme.startDate) : scheme.effectiveFrom ? new Date(scheme.effectiveFrom) : null;
    const end = scheme.endDate ? new Date(scheme.endDate) : scheme.effectiveTo ? new Date(scheme.effectiveTo) : null;

    if (start && start.getTime() > now.getTime()) {
      return 'SCHEDULED';
    }
    if (end && end.getTime() < now.getTime()) {
      return 'EXPIRED';
    }
    return 'ACTIVE';
  }

  /**
   * Retrieve all Pricing Schemes with optional filtering and computed status
   */
  async getPricingSchemes(
    companyId: string,
    filter?: { schemeType?: string; status?: string; isMobileVisible?: boolean; paymentTerm?: string },
  ) {
    const where: any = { companyId };
    if (filter?.status) {
      where.status = filter.status;
    } else {
      where.status = { not: 'ARCHIVED' };
    }
    if (filter?.schemeType) {
      where.OR = [
        { schemeType: filter.schemeType },
        { schemeTypeCode: filter.schemeType },
      ];
    }
    if (filter?.isMobileVisible !== undefined) where.isMobileVisible = filter.isMobileVisible;
    if (filter?.paymentTerm && filter.paymentTerm !== 'ALL') {
      where.AND = [
        ...(where.AND || []),
        { OR: [{ paymentTerm: filter.paymentTerm }, { paymentTerm: 'ANY' }] },
      ];
    }

    const schemes = await this.prisma.pricingScheme.findMany({
      where,
      include: {
        schemeTypeRef: true,
        baseRateList: { select: { id: true, code: true, name: true } },
        rateLists: {
          select: {
            id: true,
            code: true,
            name: true,
            status: true,
            versions: {
              take: 1,
              orderBy: { versionNumber: 'desc' },
              select: {
                versionNumber: true,
                _count: { select: { items: true } },
              },
            },
          },
        },
        _count: { select: { salesOrders: true } },
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    });

    const mapped = schemes.map((s) => {
      const computedStatus = this.computeSchemeStatus(s);
      const activeRateList = s.rateLists.find((rl) => rl.status === 'ACTIVE') || s.rateLists[0];

      return {
        ...s,
        computedStatus,
        status: computedStatus,
        shortCode: s.shortCode || s.code,
        schemeTypeCode: s.schemeTypeCode || s.schemeTypeRef?.code || (s.schemeType === 'CASH_DISCOUNT' ? 'CA' : s.schemeType === 'ADVANCE_BOOKING' ? 'ABC' : s.schemeType === 'NET_RATE' ? 'NNR' : 'SR'),
        activeRateListId: activeRateList?.id || null,
        activeRateListCode: activeRateList?.code || null,
        productCount: activeRateList?.versions[0]?._count.items || 0,
      };
    });

    if (filter?.status && filter.status !== 'ALL') {
      return mapped.filter((s) => s.computedStatus === filter.status!.toUpperCase());
    }

    return mapped;
  }

  /**
   * Get currently active schemes for mobile flow and Sales Order dropdown (Requirements 12, 14, 15, 17)
   */
  async getActiveSchemes(companyId: string) {
    const allSchemes = await this.getPricingSchemes(companyId);
    return allSchemes
      .filter((s) => s.computedStatus === 'ACTIVE')
      .map((s) => ({
        id: s.id,
        code: s.code,
        shortCode: s.shortCode,
        name: s.name,
        displayName: `${s.shortCode || s.code} - ${s.name}`,
        schemeType: s.schemeType,
        schemeTypeCode: s.schemeTypeCode,
        startDate: s.startDate || s.effectiveFrom,
        endDate: s.endDate || s.effectiveTo,
        defaultDiscountPct: s.defaultDiscountPct,
        additionalBookingPct: s.additionalBookingPct,
        cashDiscountPct: s.cashDiscountPct,
        rateListId: s.activeRateListId,
        paymentTerm: s.paymentTerm,
      }));
  }

  /**
   * Retrieve single Pricing Scheme by ID
   */
  async getPricingSchemeById(id: string, companyId: string) {
    const scheme = await this.prisma.pricingScheme.findFirst({
      where: { id, companyId },
      include: {
        schemeTypeRef: true,
        baseRateList: { select: { id: true, code: true, name: true, category: true } },
        rateLists: {
          include: {
            versions: {
              orderBy: { versionNumber: 'desc' },
              take: 1,
              include: { _count: { select: { items: true } } },
            },
          },
        },
      },
    });
    if (!scheme) throw new NotFoundException('Pricing scheme not found');

    const computedStatus = this.computeSchemeStatus(scheme);
    return {
      ...scheme,
      computedStatus,
      status: computedStatus,
      shortCode: scheme.shortCode || scheme.code,
      schemeTypeCode: scheme.schemeTypeCode || scheme.schemeTypeRef?.code || 'SR',
    };
  }

  /**
   * Auto-generate/retrieve product rate list for a selected Scheme (Requirements 7, 8, 9, 10, 11)
   * When user selects a scheme in Rate List creation: MCCM - Mega Carnival Open Mela
   * system automatically retrieves active finished products and calculates scheme-wise rates!
   */
  async getRateListProductsForScheme(schemeId: string, companyId: string) {
    const scheme = await this.prisma.pricingScheme.findFirst({
      where: { id: schemeId, companyId },
      include: { schemeTypeRef: true },
    });
    if (!scheme) throw new NotFoundException('Scheme not found');

    const schemeTypeCode = (scheme.schemeTypeCode || scheme.schemeTypeRef?.code || scheme.schemeType || 'SR').toUpperCase();

    // Check if an existing RateList already exists for this Scheme
    const existingRateList = await this.prisma.rateList.findFirst({
      where: { schemeId, companyId, status: 'ACTIVE' },
      include: {
        versions: {
          where: { status: 'ACTIVE' },
          orderBy: { versionNumber: 'desc' },
          take: 1,
          include: {
            items: {
              include: {
                finishedProduct: true,
                packSize: true,
              },
            },
          },
        },
      },
    });

    const existingItemsMap = new Map<string, any>();
    if (existingRateList?.versions[0]?.items) {
      for (const it of existingRateList.versions[0].items) {
        existingItemsMap.set(it.finishedProductId, it);
      }
    }

    // Retrieve all active Finished Products from master
    const allProducts = await this.getActiveFinishedProductsForRateList(companyId);

    // Single Discount % field (Requirements 12, 13, 14, 20)
    const schemeDiscountPct =
      Number(scheme.discountPct) ||
      Number(scheme.defaultDiscountPct) ||
      Number(scheme.cashDiscountPct) ||
      (scheme.additionalBookingPct ? Number(scheme.cashDiscountPct || 0) + Number(scheme.additionalBookingPct) : 0) ||
      0;

    const generatedItems = allProducts.map((p) => {
      const existing = existingItemsMap.get(p.finishedProductId);

      if (existing) {
        const existingDisc = Number(existing.discountPercent || existing.discountValue || 0);
        // If existing rate list item had 0 discount, but the scheme specifies a discount, apply the scheme discount!
        const effectiveDisc = existingDisc > 0 ? existingDisc : schemeDiscountPct;
        const effectiveRate = effectiveDisc > 0
          ? Math.round(Number(existing.baseRate) * (1 - effectiveDisc / 100))
          : Number(existing.schemeRate ?? existing.fixedNetRate ?? existing.baseRate);

        return {
          ...p,
          baseRate: Number(existing.baseRate),
          baseSellingPrice: Number(existing.baseRate),
          schemeRate: effectiveRate,
          discountPercent: effectiveDisc,
          discountValue: effectiveDisc,
          rateType: effectiveDisc > 0 ? 'DISCOUNT' : (schemeTypeCode === 'NNR' ? 'NET_NET' : 'DIRECT'),
          unit: existing.unit || p.unit,
          fixedNetRate: existing.fixedNetRate ? Number(existing.fixedNetRate) : null,
          minAllowedRate: existing.minAllowedRate ? Number(existing.minAllowedRate) : Math.round(Number(existing.baseRate) * 0.8),
          alreadySaved: true,
        };
      }

      const basePrice = p.baseRate;
      const discountPercent = schemeDiscountPct;
      const schemeRate = discountPercent > 0 ? Math.round(basePrice * (1 - discountPercent / 100)) : basePrice;
      const rateType = schemeTypeCode === 'NNR' ? 'NET_NET' : discountPercent > 0 ? 'DISCOUNT' : 'DIRECT';

      return {
        ...p,
        baseRate: basePrice,
        baseSellingPrice: basePrice,
        schemeRate,
        discountPercent,
        discountValue: discountPercent,
        rateType,
        fixedNetRate: rateType === 'NET_NET' ? schemeRate : null,
        minAllowedRate: Math.round(basePrice * 0.8),
        alreadySaved: false,
      };
    });

    return {
      scheme: {
        id: scheme.id,
        code: scheme.code,
        shortCode: scheme.shortCode || scheme.code,
        name: scheme.name,
        schemeType: scheme.schemeType,
        schemeTypeCode,
        discountPct: schemeDiscountPct,
        defaultDiscountPct: schemeDiscountPct,
        paymentType: scheme.paymentType || 'CASH',
        paymentTypes: scheme.paymentTypes || [scheme.paymentType || 'CASH'],
        collectionStartDate: scheme.collectionStartDate || scheme.startDate || scheme.effectiveFrom,
        collectionEndDate: scheme.collectionEndDate || scheme.endDate || scheme.effectiveTo,
        invoiceStartDate: scheme.invoiceStartDate || scheme.startDate || scheme.effectiveFrom,
        invoiceEndDate: scheme.invoiceEndDate || scheme.endDate || scheme.effectiveTo,
        startDate: scheme.collectionStartDate || scheme.startDate || scheme.effectiveFrom,
        endDate: scheme.collectionEndDate || scheme.endDate || scheme.effectiveTo,
      },
      existingRateList: existingRateList
        ? {
            id: existingRateList.id,
            code: existingRateList.code,
            name: existingRateList.name,
            versionNumber: existingRateList.versions[0]?.versionNumber || 1,
          }
        : null,
      products: generatedItems,
    };
  }

  /**
   * Create a new Pricing Scheme (Requirements 1 - 19)
   */
  async createPricingScheme(dto: CreatePricingSchemeDto, actor: AuthUser) {
    const companyId = actor.companyId;
    const organizationId = actor.organizationId;

    let schemeTypeCode = dto.schemeTypeCode || 'SR';
    let schemeTypeName = dto.schemeType || 'Seasonal Scheme';

    if (dto.schemeTypeId) {
      const st = await this.prisma.schemeType.findUnique({ where: { id: dto.schemeTypeId } });
      if (st) {
        schemeTypeCode = st.code;
        schemeTypeName = st.name;
      }
    }

    // Short Code is OPTIONAL (Requirement 6). Fallback if empty.
    const shortCode = dto.shortCode?.trim().toUpperCase() || null;
    const code = (shortCode || dto.code || `SCH-${schemeTypeCode}-${Date.now().toString().slice(-6)}`).trim().toUpperCase();

    const existing = await this.prisma.pricingScheme.findFirst({
      where: { companyId, code },
    });
    if (existing) {
      throw new BadRequestException(`Pricing scheme with code '${code}' already exists`);
    }

    // Four Separate Dates & Validation (Requirements 8, 9, 10)
    const rawColStart = dto.collectionStartDate || dto.startDate || dto.effectiveFrom;
    const rawColEnd = dto.collectionEndDate || dto.endDate;
    const rawInvStart = dto.invoiceStartDate || dto.startDate || dto.effectiveFrom;
    const rawInvEnd = dto.invoiceEndDate || dto.endDate;

    if (!rawColStart) {
      throw new BadRequestException('Collection Start Date is required');
    }
    if (!rawInvStart) {
      throw new BadRequestException('Invoice Start Date is required');
    }

    const colStart = new Date(rawColStart);
    const colEnd = rawColEnd ? new Date(rawColEnd) : null;
    const invStart = new Date(rawInvStart);
    const invEnd = rawInvEnd ? new Date(rawInvEnd) : null;

    if (isNaN(colStart.getTime())) throw new BadRequestException('Invalid Collection Start Date');
    if (isNaN(invStart.getTime())) throw new BadRequestException('Invalid Invoice Start Date');

    if (colEnd) {
      if (isNaN(colEnd.getTime())) throw new BadRequestException('Invalid Collection End Date');
      if (colStart > colEnd) {
        throw new BadRequestException('Collection Start Date must be earlier than or equal to Collection End Date');
      }
    }

    if (invEnd) {
      if (isNaN(invEnd.getTime())) throw new BadRequestException('Invalid Invoice End Date');
      if (invStart > invEnd) {
        throw new BadRequestException('Invoice Start Date must be earlier than or equal to Invoice End Date');
      }
    }

    // Status: Draft, Active, Inactive, Expired (Requirement 11)
    let initialStatus = (dto.status || 'ACTIVE').toUpperCase();
    if (initialStatus === 'ACTIVE' && invEnd && new Date() > invEnd) {
      initialStatus = 'EXPIRED';
    }

    // Single Discount Field (Requirements 12, 13, 14)
    const discountVal = dto.discountPct !== undefined && dto.discountPct !== null && String(dto.discountPct) !== ''
      ? Number(dto.discountPct)
      : dto.defaultDiscountPct !== undefined && dto.defaultDiscountPct !== null && String(dto.defaultDiscountPct) !== ''
      ? Number(dto.defaultDiscountPct)
      : dto.cashDiscountPct !== undefined && dto.cashDiscountPct !== null && String(dto.cashDiscountPct) !== ''
      ? Number(dto.cashDiscountPct)
      : 0;

    // Payment Type: Cash, Credit, etc. (Requirements 15, 16, 17, 18)
    const paymentType = (dto.paymentType || 'CASH').toUpperCase();
    const paymentTypes = dto.paymentTypes && Array.isArray(dto.paymentTypes) && dto.paymentTypes.length > 0
      ? dto.paymentTypes
      : [paymentType];

    const scheme = await this.prisma.pricingScheme.create({
      data: {
        id: uuidv7(),
        organizationId,
        companyId,
        schemeTypeId: dto.schemeTypeId || null,
        schemeTypeCode,
        code,
        shortCode: shortCode || code,
        name: dto.name.trim(),
        description: dto.description || null,
        schemeType: schemeTypeName,
        calculationMethod: dto.calculationMethod || 'ADDITIVE',
        discountComponents: dto.discountComponents ? (dto.discountComponents as any) : [],
        baseRateListId: dto.baseRateListId || null,
        paidQuantity: dto.paidQuantity ?? 0,
        freeQuantity: dto.freeQuantity ?? 0,
        minQuantity: dto.minQuantity ?? 0,
        maxQuantity: dto.maxQuantity ?? null,
        applicableDealerTier: dto.applicableDealerTier || 'ALL',
        paymentTerm: paymentType,
        paymentType,
        paymentTypes: paymentTypes as any,
        startDate: colStart,
        endDate: colEnd || invEnd,
        collectionStartDate: colStart,
        collectionEndDate: colEnd,
        invoiceStartDate: invStart,
        invoiceEndDate: invEnd,
        discountPct: discountVal,
        defaultDiscountPct: discountVal,
        additionalBookingPct: 0,
        cashDiscountPct: discountVal,
        effectiveFrom: invStart,
        effectiveTo: invEnd,
        isMobileVisible: dto.isMobileVisible ?? true,
        isMobileSelectable: dto.isMobileSelectable ?? true,
        isInternalOnly: dto.isInternalOnly ?? false,
        priority: dto.priority ?? 10,
        status: initialStatus,
        createdById: actor.id,
      },
      include: { schemeTypeRef: true, baseRateList: true },
    });

    this.logger.log(`Created Scheme: ${scheme.shortCode || scheme.code} - ${scheme.name} (${scheme.schemeTypeCode}) [Discount: ${discountVal}%, Payment: ${paymentType}]`);
    return this.getPricingSchemeById(scheme.id, companyId);
  }

  /**
   * Update an existing Pricing Scheme
   */
  async updatePricingScheme(id: string, dto: UpdatePricingSchemeDto, actor: AuthUser) {
    const scheme = await this.prisma.pricingScheme.findFirst({
      where: { id, companyId: actor.companyId },
    });
    if (!scheme) throw new NotFoundException('Pricing scheme not found');

    let schemeTypeCode = dto.schemeTypeCode || scheme.schemeTypeCode;
    let schemeTypeName = dto.schemeType || scheme.schemeType;

    if (dto.schemeTypeId) {
      const st = await this.prisma.schemeType.findUnique({ where: { id: dto.schemeTypeId } });
      if (st) {
        schemeTypeCode = st.code;
        schemeTypeName = st.name;
      }
    }

    const colStart = dto.collectionStartDate ? new Date(dto.collectionStartDate) : scheme.collectionStartDate || scheme.startDate;
    const colEnd = dto.collectionEndDate !== undefined ? (dto.collectionEndDate ? new Date(dto.collectionEndDate) : null) : scheme.collectionEndDate;
    const invStart = dto.invoiceStartDate ? new Date(dto.invoiceStartDate) : scheme.invoiceStartDate || scheme.effectiveFrom;
    const invEnd = dto.invoiceEndDate !== undefined ? (dto.invoiceEndDate ? new Date(dto.invoiceEndDate) : null) : scheme.invoiceEndDate;

    if (colStart && colEnd && colStart > colEnd) {
      throw new BadRequestException('Collection Start Date must be earlier than or equal to Collection End Date');
    }
    if (invStart && invEnd && invStart > invEnd) {
      throw new BadRequestException('Invoice Start Date must be earlier than or equal to Invoice End Date');
    }

    const discountVal = dto.discountPct !== undefined && dto.discountPct !== null && String(dto.discountPct) !== ''
      ? Number(dto.discountPct)
      : dto.defaultDiscountPct !== undefined && dto.defaultDiscountPct !== null && String(dto.defaultDiscountPct) !== ''
      ? Number(dto.defaultDiscountPct)
      : dto.cashDiscountPct !== undefined && dto.cashDiscountPct !== null && String(dto.cashDiscountPct) !== ''
      ? Number(dto.cashDiscountPct)
      : Number(scheme.discountPct || scheme.defaultDiscountPct || scheme.cashDiscountPct || 0);

    const paymentType = dto.paymentType ? dto.paymentType.toUpperCase() : scheme.paymentType || 'CASH';
    const paymentTypes = dto.paymentTypes && Array.isArray(dto.paymentTypes)
      ? dto.paymentTypes
      : scheme.paymentTypes || [paymentType];

    await this.prisma.pricingScheme.update({
      where: { id },
      data: {
        schemeTypeId: dto.schemeTypeId !== undefined ? dto.schemeTypeId : scheme.schemeTypeId,
        schemeTypeCode,
        shortCode: dto.shortCode !== undefined ? (dto.shortCode ? dto.shortCode.trim().toUpperCase() : null) : scheme.shortCode,
        name: dto.name?.trim() || scheme.name,
        description: dto.description !== undefined ? dto.description : scheme.description,
        schemeType: schemeTypeName,
        calculationMethod: dto.calculationMethod || scheme.calculationMethod,
        discountComponents: dto.discountComponents !== undefined ? (dto.discountComponents as any) : (scheme.discountComponents as any),
        baseRateListId: dto.baseRateListId !== undefined ? dto.baseRateListId : scheme.baseRateListId,
        paymentTerm: paymentType,
        paymentType,
        paymentTypes: paymentTypes as any,
        startDate: colStart,
        endDate: colEnd || invEnd,
        collectionStartDate: colStart,
        collectionEndDate: colEnd,
        invoiceStartDate: invStart,
        invoiceEndDate: invEnd,
        discountPct: discountVal,
        defaultDiscountPct: discountVal,
        cashDiscountPct: discountVal,
        effectiveFrom: invStart || scheme.effectiveFrom,
        effectiveTo: invEnd !== undefined ? invEnd : scheme.effectiveTo,
        status: dto.status || scheme.status,
      },
    });

    return this.getPricingSchemeById(id, actor.companyId);
  }

  /**
   * Delete or Archive a Pricing Scheme
   * Completely removes if not referenced by sales orders; archives if historical data exists.
   */
  async deletePricingScheme(id: string, actor: AuthUser) {
    const scheme = await this.prisma.pricingScheme.findFirst({
      where: { id, companyId: actor.companyId },
      include: {
        _count: { select: { salesOrders: true, salesOrderItems: true } },
      },
    });
    if (!scheme) throw new NotFoundException('Pricing scheme not found');

    if (scheme._count.salesOrders > 0 || scheme._count.salesOrderItems > 0) {
      return this.prisma.pricingScheme.update({
        where: { id },
        data: { status: 'ARCHIVED' },
      });
    }

    // Unlink any rate lists pointing to this scheme
    await this.prisma.rateList.updateMany({
      where: { schemeId: id },
      data: { schemeId: null },
    });

    return this.prisma.pricingScheme.delete({
      where: { id },
    });
  }

  // ============================================================
  // 5. CENTRALIZED AUTHORITATIVE PRICE RESOLUTION ENGINE (REQUIREMENTS 15, 16, 17, 18, 20, 22)
  // ============================================================

  /**
   * Authoritative backend price resolution engine.
   * Single source of truth consumed identically by Web ERP, Mobile API, Sales Orders, and Invoices.
   * Resolves: Selected Scheme + Selected Finished Product + Valid Date = Applicable Product Rate (Requirement 16)
   */
  async resolvePrice(dto: ResolvePriceDto, actor?: AuthUser): Promise<ResolvedPriceResult> {
    const companyId = dto.companyId || actor?.companyId;
    if (!companyId) throw new BadRequestException('Company ID is required for price resolution');

    const quantity = Number(dto.quantity || 1);
    const orderDate = dto.orderDate ? new Date(dto.orderDate) : new Date();
    const paymentTerm = (dto.paymentTerm || 'CASH').toUpperCase();

    // 1. Validate Finished Product
    const product = await this.prisma.finishedProduct.findFirst({
      where: { id: dto.finishedProductId, companyId },
      include: {
        category: true,
        packSize: true,
        packagingMaterial: true,
        salesUom: true,
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

    // 3. Resolve Scheme and Scheme-linked Rate List (Requirements 15, 16, 24)
    let resolvedBaseRate = Number(product.defaultSellingPrice || product.standardCost || 1200);
    let resolvedRateList: any = null;
    let resolvedVersion: any = null;
    let resolvedItem: any = null;
    let resolvedScheme: any = null;

    // Check if requestedSchemeId provided
    if (dto.requestedSchemeId) {
      const schemeRecord = await this.prisma.pricingScheme.findFirst({
        where: {
          id: dto.requestedSchemeId,
          companyId,
          status: { notIn: ['INACTIVE', 'DRAFT'] },
        },
        include: { schemeTypeRef: true },
      });

      if (schemeRecord) {
        // Requirement 21: Sales Order / Invoice Validation
        const isInvoice = dto.pricingPhase === 'INVOICE';
        const validStart = isInvoice
          ? (schemeRecord.invoiceStartDate || schemeRecord.startDate || schemeRecord.effectiveFrom)
          : (schemeRecord.collectionStartDate || schemeRecord.startDate || schemeRecord.effectiveFrom);
        const validEnd = isInvoice
          ? (schemeRecord.invoiceEndDate || schemeRecord.endDate || schemeRecord.effectiveTo)
          : (schemeRecord.collectionEndDate || schemeRecord.endDate || schemeRecord.effectiveTo);

        if (validStart && orderDate < validStart) {
          const typeLabel = isInvoice ? 'invoice' : 'collection / sales order';
          const periodStr = `${new Date(validStart).toLocaleDateString()} to ${validEnd ? new Date(validEnd).toLocaleDateString() : 'ongoing'}`;
          throw new BadRequestException(
            `This Scheme '${schemeRecord.name}' is not valid for the selected ${typeLabel} date. Valid ${typeLabel} period: ${periodStr}`,
          );
        }

        if (validEnd && orderDate > validEnd) {
          const typeLabel = isInvoice ? 'invoice' : 'collection / sales order';
          const periodStr = `${new Date(validStart).toLocaleDateString()} to ${new Date(validEnd).toLocaleDateString()}`;
          throw new BadRequestException(
            `This Scheme '${schemeRecord.name}' is not valid for the selected ${typeLabel} date. Valid ${typeLabel} period: ${periodStr}`,
          );
        }

        resolvedScheme = schemeRecord;
      }
      // Find Rate List specifically linked to this scheme
      resolvedRateList = await this.prisma.rateList.findFirst({
        where: {
          schemeId: dto.requestedSchemeId,
          companyId,
          status: 'ACTIVE',
        },
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

      if (resolvedRateList?.versions?.[0]?.items?.[0]) {
        resolvedVersion = resolvedRateList.versions[0];
        resolvedItem = resolvedVersion.items[0];
        resolvedBaseRate = Number(resolvedItem.baseRate || product.defaultSellingPrice || 1200);
      }
    }

    // If explicit rate list was requested without scheme
    if (!resolvedRateList && dto.requestedRateListId) {
      resolvedRateList = await this.prisma.rateList.findFirst({
        where: { id: dto.requestedRateListId, companyId, status: 'ACTIVE' },
        include: {
          scheme: { include: { schemeTypeRef: true } },
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

      if (resolvedRateList?.versions?.[0]?.items?.[0]) {
        resolvedVersion = resolvedRateList.versions[0];
        resolvedItem = resolvedVersion.items[0];
        resolvedBaseRate = Number(resolvedItem.baseRate || product.defaultSellingPrice || 1200);
        if (!resolvedScheme && resolvedRateList.scheme) {
          resolvedScheme = resolvedRateList.scheme;
        }
      }
    }

    // Fallback rate list search if none found yet
    if (!resolvedRateList || !resolvedVersion) {
      const candidateRateLists = await this.prisma.rateList.findMany({
        where: {
          companyId,
          status: 'ACTIVE',
        },
        orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
        include: {
          scheme: { include: { schemeTypeRef: true } },
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

      const matched = candidateRateLists.find((rl) => (rl.versions[0]?.items?.length ?? 0) > 0);
      if (matched) {
        resolvedRateList = matched;
        resolvedVersion = matched.versions[0];
        resolvedItem = resolvedVersion?.items?.[0];
        if (resolvedItem?.baseRate) {
          resolvedBaseRate = Number(resolvedItem.baseRate);
        }
        if (!resolvedScheme && matched.scheme) {
          resolvedScheme = matched.scheme;
        }
      }
    }

    // 4. Calculate Applicable Rate
    const discountBreakdown: Array<{ name: string; type: string; value: number; calculatedAmount: number }> = [];
    let calculatedRate = resolvedBaseRate;
    let freeQuantity = 0;

    // Case A: Product rate is defined in Scheme's Rate List (Primary business flow)
    if (resolvedItem) {
      const explicitSchemeRate = resolvedItem.schemeRate !== null && resolvedItem.schemeRate !== undefined && Number(resolvedItem.schemeRate) > 0
        ? Number(resolvedItem.schemeRate)
        : resolvedItem.fixedNetRate !== null && resolvedItem.fixedNetRate !== undefined && Number(resolvedItem.fixedNetRate) > 0
        ? Number(resolvedItem.fixedNetRate)
        : resolvedItem.discountPercent !== null && resolvedItem.discountPercent !== undefined && Number(resolvedItem.discountPercent) > 0
        ? resolvedBaseRate * (1 - Number(resolvedItem.discountPercent) / 100)
        : resolvedBaseRate;

      calculatedRate = Number(explicitSchemeRate.toFixed(2));
      const rateDiff = Math.max(0, resolvedBaseRate - calculatedRate);
      const discountPct = resolvedBaseRate > 0 ? Number(((rateDiff / resolvedBaseRate) * 100).toFixed(2)) : 0;

      discountBreakdown.push({
        name: `${resolvedScheme?.shortCode || resolvedScheme?.name || resolvedRateList?.schemeShortCode || resolvedRateList?.name || 'Scheme'} Rate`,
        type: resolvedItem.rateType || 'SCHEME_RATE',
        value: discountPct,
        calculatedAmount: Number(rateDiff.toFixed(2)),
      });
    }
    // Case B: Scheme is selected but rate list item wasn't generated; compute using commercial logic
    else if (resolvedScheme) {
      const schemeTypeCode = (resolvedScheme.schemeTypeCode || resolvedScheme.schemeTypeRef?.code || resolvedScheme.schemeType || 'SR').toUpperCase();

      if (schemeTypeCode === 'CA') {
        const cashDiscPct = Number(resolvedScheme.cashDiscountPct || 15);
        const deduction = (resolvedBaseRate * cashDiscPct) / 100;
        calculatedRate = Math.max(0, resolvedBaseRate - deduction);
        discountBreakdown.push({
          name: 'Cash Advance Discount',
          type: 'PERCENTAGE',
          value: cashDiscPct,
          calculatedAmount: Number(deduction.toFixed(2)),
        });
      } else if (schemeTypeCode === 'ABC') {
        const totalPct = Number(resolvedScheme.cashDiscountPct || 0) + Number(resolvedScheme.additionalBookingPct || 0);
        const deduction = (resolvedBaseRate * totalPct) / 100;
        calculatedRate = Math.max(0, resolvedBaseRate - deduction);
        discountBreakdown.push({
          name: 'Advance Booking Benefit',
          type: 'PERCENTAGE',
          value: totalPct,
          calculatedAmount: Number(deduction.toFixed(2)),
        });
      } else if (schemeTypeCode === 'NNR') {
        calculatedRate = resolvedBaseRate;
      } else if (resolvedScheme.discountComponents && Array.isArray(resolvedScheme.discountComponents) && resolvedScheme.discountComponents.length > 0) {
        let runningRate = resolvedBaseRate;
        for (const comp of resolvedScheme.discountComponents as any[]) {
          if (comp.type === 'PERCENTAGE') {
            const stepDeduction = (runningRate * Number(comp.value)) / 100;
            runningRate = Math.max(0, runningRate - stepDeduction);
            discountBreakdown.push({
              name: comp.name || 'Scheme Discount',
              type: 'PERCENTAGE',
              value: Number(comp.value),
              calculatedAmount: Number(stepDeduction.toFixed(2)),
            });
          }
        }
        calculatedRate = runningRate;
      } else if (resolvedScheme.defaultDiscountPct && Number(resolvedScheme.defaultDiscountPct) > 0) {
        const pct = Number(resolvedScheme.defaultDiscountPct);
        const deduction = (resolvedBaseRate * pct) / 100;
        calculatedRate = Math.max(0, resolvedBaseRate - deduction);
        discountBreakdown.push({
          name: 'Default Scheme Discount',
          type: 'PERCENTAGE',
          value: pct,
          calculatedAmount: Number(deduction.toFixed(2)),
        });
      }

      // Package free quantity benefit
      const paidQtyReq = Number(resolvedScheme.paidQuantity || 0);
      const freeQtyBenefit = Number(resolvedScheme.freeQuantity || 0);
      if (paidQtyReq > 0 && freeQtyBenefit > 0 && quantity >= paidQtyReq) {
        const packageMultiples = Math.floor(quantity / paidQtyReq);
        freeQuantity = packageMultiples * freeQtyBenefit;
      }
    } else {
      // Default standard Cash discount if payment is Cash
      if (paymentTerm === 'CASH') {
        const cashDiscountAmount = (resolvedBaseRate * 15.0) / 100;
        calculatedRate = resolvedBaseRate - cashDiscountAmount;
        discountBreakdown.push({
          name: 'Standard Cash Discount',
          type: 'PERCENTAGE',
          value: 15.0,
          calculatedAmount: Number(cashDiscountAmount.toFixed(2)),
        });
      }
    }

    // 5. Handle Custom Negotiated Rate / Net Rate (if user explicitly provided requestedRate)
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

    // 6. Role Authority & Approval Governance
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
      schemeId: resolvedScheme?.id || resolvedRateList?.schemeId,
      schemeName: resolvedScheme?.name || resolvedRateList?.schemeName,
      schemeType: resolvedScheme?.schemeType || resolvedRateList?.scheme?.schemeType,
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
      commercialCondition: dto.requestedCondition || resolvedScheme?.name || resolvedRateList?.schemeName || null,
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
