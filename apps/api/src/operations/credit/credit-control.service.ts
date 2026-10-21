/**
 * SHEHSWAR ONE360 - Centralized Hierarchical Credit Control Service
 *
 * Implements Authoritative 5-Tier Credit Control:
 *   DEALER → SALES OFFICER → TERRITORY → ZONE → REGION
 *
 * Core Rules:
 * 1. Independent of Sales Targets: Credit Limit is strictly risk exposure; Sales Target is ambition.
 * 2. Cash vs Credit: CASH sales do not increase credit exposure and are allowed unless account is blocked.
 * 3. Automatic Credit Hold: If Exposure >= Limit → CREDIT_HOLD.
 * 4. Automatic Release: Payments reduce exposure and automatically release hold without manual intervention.
 * 5. Credit Override Workflow: Management approval required to release an order exceeding credit limits.
 */
import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { v7 as uuidv7 } from 'uuid';
import { AuthUser, CreditLevel, CreditStatus, CreditCheckResult, CreditCheckLevelResult } from '@shehswar/types';

export interface CreditCheckInput {
  companyId: string;
  dealerId: string;
  salesOfficerId?: string;
  territoryId?: string;
  zoneId?: string;
  regionId?: string;
  orderAmount: number;
  paymentTerm?: string;
  orderId?: string;
}

export interface SetCreditLimitDto {
  level: CreditLevel;
  entityId: string;
  creditLimit: number;
  nearLimitThresholdPercent?: number;
  effectiveFrom?: string | Date;
  effectiveTo?: string | Date;
  approvalAuthority?: string;
  notes?: string;
}

export interface CreateCreditOverrideDto {
  salesOrderId: string;
  level: CreditLevel;
  entityId: string;
  entityName: string;
  reason: string;
}

@Injectable()
export class CreditControlService {
  private readonly logger = new Logger(CreditControlService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Authoritative exposure calculation: aggregated from underlying dealer ledgers
   */
  async calculateCreditExposure(level: CreditLevel, entityId: string, companyId: string): Promise<number> {
    if (level === 'DEALER') {
      const dealer = await this.prisma.dealer.findUnique({
        where: { id: entityId },
        select: { currentBalance: true },
      });
      return Math.max(0, Number(dealer?.currentBalance || 0));
    }

    if (level === 'SALES_OFFICER') {
      // Sum outstanding of all dealers assigned to this sales officer
      const dealers = await this.prisma.dealer.findMany({
        where: {
          companyId,
          OR: [
            { assignedFieldOfficerId: entityId },
            { officerAssignments: { some: { userId: entityId } } },
          ],
        },
        select: { currentBalance: true },
      });
      const total = dealers.reduce((sum, d) => sum + Math.max(0, Number(d.currentBalance || 0)), 0);
      return Math.round(total * 100) / 100;
    }

    if (level === 'TERRITORY') {
      const dealers = await this.prisma.dealer.findMany({
        where: { companyId, territoryId: entityId },
        select: { currentBalance: true },
      });
      const total = dealers.reduce((sum, d) => sum + Math.max(0, Number(d.currentBalance || 0)), 0);
      return Math.round(total * 100) / 100;
    }

    if (level === 'ZONE') {
      const dealers = await this.prisma.dealer.findMany({
        where: {
          companyId,
          territory: { zoneId: entityId },
        },
        select: { currentBalance: true },
      });
      const total = dealers.reduce((sum, d) => sum + Math.max(0, Number(d.currentBalance || 0)), 0);
      return Math.round(total * 100) / 100;
    }

    if (level === 'REGION') {
      const dealers = await this.prisma.dealer.findMany({
        where: {
          companyId,
          territory: { zone: { regionId: entityId } },
        },
        select: { currentBalance: true },
      });
      const total = dealers.reduce((sum, d) => sum + Math.max(0, Number(d.currentBalance || 0)), 0);
      return Math.round(total * 100) / 100;
    }

    if (level === 'COMPANY') {
      const dealers = await this.prisma.dealer.findMany({
        where: { companyId },
        select: { currentBalance: true },
      });
      const total = dealers.reduce((sum, d) => sum + Math.max(0, Number(d.currentBalance || 0)), 0);
      return Math.round(total * 100) / 100;
    }

    return 0;
  }

  /**
   * Retrieves active configured credit limit record or returns default
   */
  async getEffectiveLimit(companyId: string, level: CreditLevel, entityId: string): Promise<{
    limit: number;
    threshold: number;
    maxCreditPercentage: number;
    creditControlMode: string;
  }> {
    const record = await this.prisma.creditLimit.findFirst({
      where: {
        companyId,
        level,
        entityId,
        status: 'ACTIVE',
      },
      orderBy: { effectiveFrom: 'desc' },
    });

    if (record) {
      return {
        limit: Number(record.creditLimit),
        threshold: Number(record.nearLimitThresholdPercent || 85),
        maxCreditPercentage: Number(record.maxCreditPercentage || 20.0),
        creditControlMode: record.creditControlMode || 'BOTH',
      };
    }

    // Fallback for DEALER: check dealer table creditLimit column
    if (level === 'DEALER') {
      const dealer = await this.prisma.dealer.findUnique({
        where: { id: entityId },
        select: { creditLimit: true },
      });
      return {
        limit: Number(dealer?.creditLimit || 0),
        threshold: 85,
        maxCreditPercentage: 20.0,
        creditControlMode: 'BOTH',
      };
    }

    return { limit: 0, threshold: 85, maxCreditPercentage: 20.0, creditControlMode: 'BOTH' };
  }

  /**
   * Calculate authoritative Net Sales for an entity to support percentage-based credit control
   */
  async calculateEntitySales(level: CreditLevel, entityId: string, companyId: string): Promise<number> {
    let invoices: { netAmount: any }[] = [];
    if (level === 'DEALER') {
      invoices = await this.prisma.salesInvoice.findMany({
        where: { companyId, dealerId: entityId, postingStatus: 'POSTED' },
        select: { netAmount: true },
      });
    } else if (level === 'SALES_OFFICER') {
      invoices = await this.prisma.salesInvoice.findMany({
        where: { companyId, salesOfficerId: entityId, postingStatus: 'POSTED' },
        select: { netAmount: true },
      });
    } else if (level === 'TERRITORY') {
      invoices = await this.prisma.salesInvoice.findMany({
        where: { companyId, territoryId: entityId, postingStatus: 'POSTED' },
        select: { netAmount: true },
      });
    } else if (level === 'ZONE') {
      invoices = await this.prisma.salesInvoice.findMany({
        where: { companyId, zoneId: entityId, postingStatus: 'POSTED' },
        select: { netAmount: true },
      });
    } else if (level === 'REGION') {
      invoices = await this.prisma.salesInvoice.findMany({
        where: { companyId, regionId: entityId, postingStatus: 'POSTED' },
        select: { netAmount: true },
      });
    } else if (level === 'COMPANY') {
      invoices = await this.prisma.salesInvoice.findMany({
        where: { companyId, postingStatus: 'POSTED' },
        select: { netAmount: true },
      });
    }

    const total = invoices.reduce((sum, inv) => sum + Number(inv.netAmount || 0), 0);
    return Math.round(total * 100) / 100;
  }

  /**
   * Evaluates a single level against its fixed limit and percentage-based credit policies
   */
  private evaluateLevel(
    level: CreditLevel,
    entityId: string,
    entityName: string,
    limit: number,
    currentExposure: number,
    orderAmount: number,
    thresholdPercent: number,
    isCash: boolean,
    maxCreditPercentage: number = 20.0,
    creditControlMode: string = 'BOTH',
    netSales: number = 0,
  ): CreditCheckLevelResult {
    const effectiveOrderAmount = isCash ? 0 : orderAmount;
    const projectedExposure = currentExposure + effectiveOrderAmount;

    // Fixed limit metrics
    const fixedAvailable = limit > 0 ? Math.max(0, limit - currentExposure) : 999999999;
    const utilizationPercent = limit > 0 ? Math.round((projectedExposure / limit) * 10000) / 100 : 0;

    // Percentage limit metrics
    const creditPercentage = netSales > 0 ? Math.round((currentExposure / netSales) * 10000) / 100 : 0;
    const projectedCreditPercentage = netSales > 0 ? Math.round((projectedExposure / netSales) * 10000) / 100 : 0;
    const maxAllowedCreditByPercentage = netSales > 0 ? Math.round(netSales * (maxCreditPercentage / 100) * 100) / 100 : 0;
    const percentAvailable = maxAllowedCreditByPercentage > 0 ? Math.max(0, maxAllowedCreditByPercentage - currentExposure) : 999999999;

    let availableCredit = fixedAvailable;
    if (creditControlMode === 'PERCENTAGE' && maxAllowedCreditByPercentage > 0) {
      availableCredit = percentAvailable;
    } else if (creditControlMode === 'BOTH' && limit > 0 && maxAllowedCreditByPercentage > 0) {
      availableCredit = Math.min(fixedAvailable, percentAvailable);
    } else if (creditControlMode === 'BOTH' && maxAllowedCreditByPercentage > 0) {
      availableCredit = percentAvailable;
    }

    let status: CreditStatus = 'WITHIN_LIMIT';
    let allowed = true;
    let approvalRequired = false;
    let creditLock = false;

    // 1. Percentage-based Credit Check (Auto-releases dynamically upon payment)
    if (creditControlMode === 'PERCENTAGE' || creditControlMode === 'BOTH') {
      if (netSales > 0) {
        if (currentExposure >= maxAllowedCreditByPercentage && maxAllowedCreditByPercentage > 0) {
          status = 'CREDIT_LOCK';
          allowed = false;
          approvalRequired = true;
          creditLock = true;
        } else if (projectedCreditPercentage > maxCreditPercentage) {
          status = 'CREDIT_LOCK';
          allowed = false;
          approvalRequired = true;
          creditLock = true;
        } else if (projectedCreditPercentage === maxCreditPercentage) {
          status = 'LIMIT_REACHED';
          allowed = true;
          approvalRequired = false;
        } else if (projectedCreditPercentage >= maxCreditPercentage * (thresholdPercent / 100)) {
          status = 'NEAR_LIMIT';
          allowed = true;
          approvalRequired = false;
        }
      }
    }

    // 2. Fixed Credit Limit Check
    if ((creditControlMode === 'FIXED' || creditControlMode === 'BOTH') && limit > 0) {
      if (currentExposure >= limit) {
        if (!creditLock) status = 'CREDIT_HOLD';
        allowed = false;
        approvalRequired = true;
      } else if (projectedExposure > limit) {
        if (!creditLock) status = 'LIMIT_EXCEEDED';
        allowed = false;
        approvalRequired = true;
      } else if (projectedExposure === limit && status === 'WITHIN_LIMIT') {
        status = 'LIMIT_REACHED';
      } else if (utilizationPercent >= thresholdPercent && status === 'WITHIN_LIMIT') {
        status = 'NEAR_LIMIT';
      }
    }

    // 3. CASH orders are always allowed
    if (isCash) {
      allowed = true;
      approvalRequired = false;
    }

    return {
      level,
      entityId,
      entityName,
      limit,
      currentExposure,
      orderAmount: effectiveOrderAmount,
      projectedExposure,
      availableCredit: Math.max(0, availableCredit),
      utilizationPercent,
      status,
      allowed,
      approvalRequired,
      netSales,
      creditPercentage,
      projectedCreditPercentage,
      maxCreditPercentage,
      maxAllowedCreditByPercentage,
      creditLock,
    };
  }

  /**
   * Comprehensive 5-Tier Hierarchical Credit Check
   */
  async checkCredit(input: CreditCheckInput): Promise<CreditCheckResult> {
    const companyId = input.companyId;
    const isCash = (input.paymentTerm || 'CASH').toUpperCase() === 'CASH';

    // 1. Fetch Dealer & Market Hierarchy Context
    const dealer = await this.prisma.dealer.findUnique({
      where: { id: input.dealerId },
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
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });

    if (!dealer) throw new NotFoundException('Dealer not found for credit validation');

    const salesOfficerId = input.salesOfficerId || dealer.assignedFieldOfficerId || dealer.territory?.managerId;
    const territoryId = input.territoryId || dealer.territoryId;
    const zoneId = input.zoneId || dealer.territory?.zoneId;
    const regionId = input.regionId || dealer.territory?.zone?.regionId;

    // 2. Evaluate Dealer Tier
    const dealerLimitConfig = await this.getEffectiveLimit(companyId, 'DEALER', dealer.id);
    const dealerExposure = await this.calculateCreditExposure('DEALER', dealer.id, companyId);
    const dealerSales = await this.calculateEntitySales('DEALER', dealer.id, companyId);
    const dealerResult = this.evaluateLevel(
      'DEALER',
      dealer.id,
      dealer.name,
      dealerLimitConfig.limit,
      dealerExposure,
      input.orderAmount,
      dealerLimitConfig.threshold,
      isCash,
      dealerLimitConfig.maxCreditPercentage,
      dealerLimitConfig.creditControlMode,
      dealerSales,
    );

    // 3. Evaluate Sales Officer Tier
    let salesOfficerResult: CreditCheckLevelResult | undefined;
    if (salesOfficerId) {
      const officer = await this.prisma.user.findUnique({
        where: { id: salesOfficerId },
        select: { firstName: true, lastName: true },
      });
      const officerName = officer ? `${officer.firstName} ${officer.lastName}` : 'Sales Officer';
      const officerLimitConfig = await this.getEffectiveLimit(companyId, 'SALES_OFFICER', salesOfficerId);
      const officerExposure = await this.calculateCreditExposure('SALES_OFFICER', salesOfficerId, companyId);
      const officerSales = await this.calculateEntitySales('SALES_OFFICER', salesOfficerId, companyId);
      salesOfficerResult = this.evaluateLevel(
        'SALES_OFFICER',
        salesOfficerId,
        officerName,
        officerLimitConfig.limit,
        officerExposure,
        input.orderAmount,
        officerLimitConfig.threshold,
        isCash,
        officerLimitConfig.maxCreditPercentage,
        officerLimitConfig.creditControlMode,
        officerSales,
      );
    }

    // 4. Evaluate Territory Tier
    let territoryResult: CreditCheckLevelResult | undefined;
    if (territoryId) {
      const territory = await this.prisma.territory.findUnique({
        where: { id: territoryId },
        select: { name: true },
      });
      const territoryName = territory?.name || 'Territory';
      const terrLimitConfig = await this.getEffectiveLimit(companyId, 'TERRITORY', territoryId);
      const terrExposure = await this.calculateCreditExposure('TERRITORY', territoryId, companyId);
      const terrSales = await this.calculateEntitySales('TERRITORY', territoryId, companyId);
      territoryResult = this.evaluateLevel(
        'TERRITORY',
        territoryId,
        territoryName,
        terrLimitConfig.limit,
        terrExposure,
        input.orderAmount,
        terrLimitConfig.threshold,
        isCash,
        terrLimitConfig.maxCreditPercentage,
        terrLimitConfig.creditControlMode,
        terrSales,
      );
    }

    // 5. Evaluate Zone Tier
    let zoneResult: CreditCheckLevelResult | undefined;
    if (zoneId) {
      const zone = await this.prisma.zone.findUnique({
        where: { id: zoneId },
        select: { name: true },
      });
      const zoneName = zone?.name || 'Zone';
      const zoneLimitConfig = await this.getEffectiveLimit(companyId, 'ZONE', zoneId);
      const zoneExposure = await this.calculateCreditExposure('ZONE', zoneId, companyId);
      const zoneSales = await this.calculateEntitySales('ZONE', zoneId, companyId);
      zoneResult = this.evaluateLevel(
        'ZONE',
        zoneId,
        zoneName,
        zoneLimitConfig.limit,
        zoneExposure,
        input.orderAmount,
        zoneLimitConfig.threshold,
        isCash,
        zoneLimitConfig.maxCreditPercentage,
        zoneLimitConfig.creditControlMode,
        zoneSales,
      );
    }

    // 6. Evaluate Region Tier
    let regionResult: CreditCheckLevelResult | undefined;
    if (regionId) {
      const region = await this.prisma.region.findUnique({
        where: { id: regionId },
        select: { name: true },
      });
      const regionName = region?.name || 'Region';
      const regionLimitConfig = await this.getEffectiveLimit(companyId, 'REGION', regionId);
      const regionExposure = await this.calculateCreditExposure('REGION', regionId, companyId);
      const regionSales = await this.calculateEntitySales('REGION', regionId, companyId);
      regionResult = this.evaluateLevel(
        'REGION',
        regionId,
        regionName,
        regionLimitConfig.limit,
        regionExposure,
        input.orderAmount,
        regionLimitConfig.threshold,
        isCash,
        regionLimitConfig.maxCreditPercentage,
        regionLimitConfig.creditControlMode,
        regionSales,
      );
    }

    // 7. Check if there is an approved Credit Override for this order
    let approvedOverride = false;
    if (input.orderId) {
      const override = await this.prisma.creditOverrideRequest.findFirst({
        where: {
          salesOrderId: input.orderId,
          status: 'APPROVED',
        },
      });
      if (override) {
        approvedOverride = true;
      }
    }

    // 8. Overall Determination
    const levels = [dealerResult, salesOfficerResult, territoryResult, zoneResult, regionResult].filter(Boolean) as CreditCheckLevelResult[];

    let overallAllowed = true;
    let overallApprovalRequired = false;
    let blockingLevel: CreditLevel | null = null;
    let reason: string | null = null;
    let overallStatus: CreditStatus = 'WITHIN_LIMIT';

    for (const lvl of levels) {
      if (!lvl.allowed) {
        overallAllowed = false;
        overallApprovalRequired = true;
        blockingLevel = lvl.level;
        reason = `${lvl.level} '${lvl.entityName}' exceeded credit limit (Limit: PKR ${lvl.limit.toLocaleString()}, Projected: PKR ${lvl.projectedExposure.toLocaleString()})`;
        overallStatus = lvl.status;
        break;
      }
      if (lvl.status === 'NEAR_LIMIT' && overallStatus === 'WITHIN_LIMIT') {
        overallStatus = 'NEAR_LIMIT';
      }
    }

    if (approvedOverride) {
      overallAllowed = true;
      overallApprovalRequired = false;
      reason = 'Authorized Credit Override Approved';
    }

    return {
      dealer: dealerResult,
      salesOfficer: salesOfficerResult,
      territory: territoryResult,
      zone: zoneResult,
      region: regionResult,
      overall: {
        allowed: overallAllowed,
        approvalRequired: overallApprovalRequired,
        blockingLevel,
        reason,
        status: overallStatus,
      },
      allowed: overallAllowed,
      approvalRequired: overallApprovalRequired,
      blockingLevel,
      reason,
    };
  }

  /**
   * Set or update a credit limit
   */
  async setCreditLimit(dto: SetCreditLimitDto, actor: AuthUser) {
    const companyId = actor.companyId;
    const organizationId = actor.organizationId;

    if (dto.creditLimit < 0) {
      throw new BadRequestException('Credit limit cannot be negative');
    }

    // Deactivate existing active limits for this entity
    await this.prisma.creditLimit.updateMany({
      where: {
        companyId,
        level: dto.level,
        entityId: dto.entityId,
        status: 'ACTIVE',
      },
      data: { status: 'INACTIVE', effectiveTo: new Date() },
    });

    const newLimit = await this.prisma.creditLimit.create({
      data: {
        id: uuidv7(),
        organizationId,
        companyId,
        level: dto.level,
        entityId: dto.entityId,
        creditLimit: dto.creditLimit,
        nearLimitThresholdPercent: dto.nearLimitThresholdPercent || 85,
        effectiveFrom: dto.effectiveFrom ? new Date(dto.effectiveFrom) : new Date(),
        effectiveTo: dto.effectiveTo ? new Date(dto.effectiveTo) : null,
        status: 'ACTIVE',
        approvalAuthority: dto.approvalAuthority ?? null,
        notes: dto.notes ?? null,
        createdById: actor.id,
      },
    });

    // If setting dealer limit, synchronize dealer record's denormalized column
    if (dto.level === 'DEALER') {
      await this.prisma.dealer.update({
        where: { id: dto.entityId },
        data: { creditLimit: dto.creditLimit },
      });
    }

    this.logger.log(`Credit limit set: ${dto.level} ${dto.entityId} → PKR ${dto.creditLimit} by ${actor.email}`);
    return newLimit;
  }

  /**
   * List configured credit limits
   */
  async getCreditLimits(companyId: string, level?: CreditLevel) {
    const where: any = { companyId, status: 'ACTIVE' };
    if (level) where.level = level;

    const limits = await this.prisma.creditLimit.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    // Resolve human-readable entity names
    const resolved = await Promise.all(
      limits.map(async (l) => {
        let entityName = l.entityId;
        if (l.level === 'DEALER') {
          const d = await this.prisma.dealer.findUnique({ where: { id: l.entityId }, select: { name: true } });
          if (d) entityName = d.name;
        } else if (l.level === 'SALES_OFFICER') {
          const u = await this.prisma.user.findUnique({ where: { id: l.entityId }, select: { firstName: true, lastName: true } });
          if (u) entityName = `${u.firstName} ${u.lastName}`;
        } else if (l.level === 'TERRITORY') {
          const t = await this.prisma.territory.findUnique({ where: { id: l.entityId }, select: { name: true } });
          if (t) entityName = t.name;
        } else if (l.level === 'ZONE') {
          const z = await this.prisma.zone.findUnique({ where: { id: l.entityId }, select: { name: true } });
          if (z) entityName = z.name;
        } else if (l.level === 'REGION') {
          const r = await this.prisma.region.findUnique({ where: { id: l.entityId }, select: { name: true } });
          if (r) entityName = r.name;
        }
        return {
          ...l,
          entityName,
        };
      }),
    );

    return resolved;
  }

  /**
   * Request a credit override for a blocked sales order
   */
  async createOverrideRequest(dto: CreateCreditOverrideDto, actor: AuthUser) {
    const order = await this.prisma.salesOrder.findUnique({
      where: { id: dto.salesOrderId },
      include: { dealer: true },
    });

    if (!order) throw new NotFoundException('Sales Order not found');

    const limitConfig = await this.getEffectiveLimit(actor.companyId, dto.level, dto.entityId);
    const exposure = await this.calculateCreditExposure(dto.level, dto.entityId, actor.companyId);
    const orderAmount = Number(order.totalAmount);
    const projectedExposure = exposure + orderAmount;
    const exceededAmount = Math.max(0, projectedExposure - limitConfig.limit);

    const override = await this.prisma.creditOverrideRequest.create({
      data: {
        id: uuidv7(),
        organizationId: actor.organizationId,
        companyId: actor.companyId,
        salesOrderId: dto.salesOrderId,
        level: dto.level,
        entityId: dto.entityId,
        entityName: dto.entityName,
        currentLimit: limitConfig.limit,
        currentExposure: exposure,
        orderAmount,
        projectedExposure,
        exceededAmount,
        requestedById: actor.id,
        reason: dto.reason,
        status: 'PENDING',
      },
    });

    // Mark sales order as PENDING_APPROVAL / CREDIT_HOLD
    await this.prisma.salesOrder.update({
      where: { id: dto.salesOrderId },
      data: {
        status: 'PENDING',
        rejectionReason: `Pending Credit Override Approval: ${dto.reason}`,
      },
    });

    this.logger.log(`Credit override requested for Order ${order.orderNumber} by ${actor.email}`);
    return override;
  }

  /**
   * Approve a credit override request
   */
  async approveOverrideRequest(id: string, actor: AuthUser) {
    const request = await this.prisma.creditOverrideRequest.findUnique({
      where: { id },
      include: { salesOrder: true },
    });

    if (!request) throw new NotFoundException('Credit override request not found');
    if (request.status !== 'PENDING') {
      throw new BadRequestException(`Request is already ${request.status}`);
    }

    const updated = await this.prisma.creditOverrideRequest.update({
      where: { id },
      data: {
        status: 'APPROVED',
        approvedById: actor.id,
        approvedAt: new Date(),
      },
    });

    // Update sales order status to APPROVED so it can proceed to dispatch
    await this.prisma.salesOrder.update({
      where: { id: request.salesOrderId },
      data: {
        status: 'APPROVED',
        rejectionReason: `Credit override authorized by ${actor.email}`,
      },
    });

    this.logger.log(`Credit override approved for Order ${request.salesOrder?.orderNumber} by ${actor.email}`);
    return updated;
  }

  /**
   * Reject a credit override request
   */
  async rejectOverrideRequest(id: string, reason: string, actor: AuthUser) {
    const request = await this.prisma.creditOverrideRequest.findUnique({
      where: { id },
    });

    if (!request) throw new NotFoundException('Credit override request not found');

    const updated = await this.prisma.creditOverrideRequest.update({
      where: { id },
      data: {
        status: 'REJECTED',
        approvedById: actor.id,
        approvedAt: new Date(),
        rejectionReason: reason,
      },
    });

    // Update sales order to REJECTED / CREDIT_HOLD
    await this.prisma.salesOrder.update({
      where: { id: request.salesOrderId },
      data: {
        status: 'REJECTED',
        rejectionReason: `Credit override rejected: ${reason}`,
      },
    });

    return updated;
  }

  /**
   * List credit override requests
   */
  async getOverrideRequests(companyId: string, status?: string) {
    const where: any = { companyId };
    if (status) where.status = status;

    return this.prisma.creditOverrideRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  /**
   * Full Credit Control Dashboard with Hierarchical Breakdown
   */
  async getCreditDashboard(companyId: string) {
    const dealers = await this.prisma.dealer.findMany({
      where: { companyId, status: 'ACTIVE' },
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
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });

    let totalLimit = 0;
    let totalExposure = 0;
    let creditHoldCount = 0;
    let nearLimitCount = 0;

    const dealerSummaries = await Promise.all(
      dealers.map(async (d) => {
        const exposure = Math.max(0, Number(d.currentBalance || 0));
        const limitConfig = await this.getEffectiveLimit(companyId, 'DEALER', d.id);
        const limit = limitConfig.limit;
        const available = limit > 0 ? Math.max(0, limit - exposure) : 0;
        const utilization = limit > 0 ? Math.round((exposure / limit) * 10000) / 100 : 0;

        totalLimit += limit;
        totalExposure += exposure;

        let status: CreditStatus = 'WITHIN_LIMIT';
        if (limit > 0) {
          if (exposure >= limit) {
            status = 'CREDIT_HOLD';
            creditHoldCount++;
          } else if (utilization >= limitConfig.threshold) {
            status = 'NEAR_LIMIT';
            nearLimitCount++;
          }
        }

        return {
          id: d.id,
          name: d.name,
          code: d.code,
          officerName: d.assignedOfficer ? `${d.assignedOfficer.firstName} ${d.assignedOfficer.lastName}` : 'Direct',
          territoryName: d.territory?.name || 'Unassigned',
          zoneName: d.territory?.zone?.name || 'Unassigned',
          regionName: d.territory?.zone?.region?.name || 'Unassigned',
          limit,
          exposure,
          available,
          utilization,
          status,
        };
      }),
    );

    const availableCredit = Math.max(0, totalLimit - totalExposure);
    const overallUtilization = totalLimit > 0 ? Math.round((totalExposure / totalLimit) * 10000) / 100 : 0;

    const summary = {
      totalCreditLimit: Math.round(totalLimit * 100) / 100,
      totalCreditExposure: Math.round(totalExposure * 100) / 100,
      availableCredit: Math.round(availableCredit * 100) / 100,
      utilizationPercent: overallUtilization,
      creditHoldAccountsCount: creditHoldCount,
      nearLimitCount,
      totalDealers: dealers.length,
    };

    return {
      kpis: {
        totalLimit: Math.round(totalLimit * 100) / 100,
        totalExposure: Math.round(totalExposure * 100) / 100,
        availableCredit: Math.round(availableCredit * 100) / 100,
        overallUtilization,
        creditHoldCount,
        nearLimitCount,
        totalDealers: dealers.length,
      },
      summary,
      dealers: dealerSummaries,
    };
  }

  /**
   * Set or update a sales target (completely separate from credit limits)
   */
  async setSalesTarget(dto: {
    level: CreditLevel;
    entityId: string;
    periodYear: number;
    periodMonth: number;
    targetAmount: number;
    targetQuantity?: number;
    targetType?: string;
    notes?: string;
  }, actor: AuthUser) {
    const companyId = actor.companyId;
    const organizationId = actor.organizationId;

    return this.prisma.salesTarget.upsert({
      where: {
        companyId_level_entityId_periodYear_periodMonth: {
          companyId,
          level: dto.level,
          entityId: dto.entityId,
          periodYear: dto.periodYear,
          periodMonth: dto.periodMonth,
        },
      },
      update: {
        targetAmount: dto.targetAmount,
        targetQuantity: dto.targetQuantity || 0,
        targetType: dto.targetType || 'REVENUE',
        notes: dto.notes ?? null,
      },
      create: {
        id: uuidv7(),
        organizationId,
        companyId,
        level: dto.level,
        entityId: dto.entityId,
        periodYear: dto.periodYear,
        periodMonth: dto.periodMonth,
        targetAmount: dto.targetAmount,
        targetQuantity: dto.targetQuantity || 0,
        targetType: dto.targetType || 'REVENUE',
        notes: dto.notes ?? null,
        createdById: actor.id,
      },
    });
  }

  /**
   * Get sales targets
   */
  async getSalesTargets(companyId: string, year?: number, month?: number) {
    const where: any = { companyId };
    if (year) where.periodYear = year;
    if (month) where.periodMonth = month;

    return this.prisma.salesTarget.findMany({
      where,
      orderBy: [{ periodYear: 'desc' }, { periodMonth: 'desc' }],
    });
  }

  /**
   * Percentage-Based Credit Performance Report (Additional Requirement)
   * Drilldown: Company -> Region -> Zone -> Territory -> Sales Officer -> Dealer
   */
  async getPercentageCreditReport(params: {
    companyId: string;
    regionId?: string;
    zoneId?: string;
    territoryId?: string;
    salesOfficerId?: string;
    dealerId?: string;
    startDate?: string;
    endDate?: string;
  }) {
    const { companyId } = params;

    // 1. Fetch dealers matching filters
    const dealerWhere: any = { companyId, status: 'ACTIVE' };
    if (params.dealerId) dealerWhere.id = params.dealerId;
    if (params.salesOfficerId) dealerWhere.assignedFieldOfficerId = params.salesOfficerId;
    if (params.territoryId) dealerWhere.territoryId = params.territoryId;

    const dealers = await this.prisma.dealer.findMany({
      where: dealerWhere,
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
          select: { id: true, firstName: true, lastName: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    const dateFilter: any = {};
    if (params.startDate) dateFilter.gte = new Date(params.startDate);
    if (params.endDate) dateFilter.lte = new Date(params.endDate);

    const reportItems = await Promise.all(
      dealers.map(async (d) => {
        const exposure = Math.max(0, Number(d.currentBalance || 0));
        const limitConfig = await this.getEffectiveLimit(companyId, 'DEALER', d.id);
        const maxCreditPercent = limitConfig.maxCreditPercentage || 20.0;

        // Sales for this dealer
        const salesWhere: any = {
          companyId,
          dealerId: d.id,
          postingStatus: 'POSTED',
          ...(params.startDate || params.endDate ? { invoiceDate: dateFilter } : {}),
        };
        const invoices = await this.prisma.salesInvoice.findMany({
          where: salesWhere,
          select: { id: true, netAmount: true },
        });
        const grossSales = invoices.reduce((sum, inv) => sum + Number(inv.netAmount || 0), 0);

        let returnsTotal = 0;
        const invIds = invoices.map((i) => i.id);
        if (invIds.length > 0) {
          const returns = await this.prisma.salesReturn.findMany({
            where: {
              companyId,
              salesInvoiceId: { in: invIds },
              postingStatus: 'POSTED',
              ...(params.startDate || params.endDate ? { returnDate: dateFilter } : {}),
            },
            select: { netAmount: true },
          });
          returnsTotal = returns.reduce((sum, r) => sum + Number(r.netAmount || 0), 0);
        }
        const netSales = Math.max(0, grossSales - returnsTotal);

        // Collections for this dealer
        const collWhere: any = {
          companyId,
          dealerId: d.id,
          status: 'POSTED',
          ...(params.startDate || params.endDate ? { paymentDate: dateFilter } : {}),
        };
        const payments = await this.prisma.dealerPaymentReceipt.findMany({
          where: collWhere,
          select: { amount: true },
        });
        const collections = payments.reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0);

        // Credit percentage calculation
        let creditPercentage = 0;
        let status = 'WITHIN_LIMIT';
        const maxAllowedCredit = Math.round(netSales * (maxCreditPercent / 100) * 100) / 100;
        const availableCredit = Math.max(0, maxAllowedCredit - exposure);

        if (netSales <= 0) {
          creditPercentage = 0;
          status = exposure > 0 ? 'CREDIT_LOCK' : 'WITHIN_LIMIT';
        } else {
          creditPercentage = Math.round((exposure / netSales) * 10000) / 100;
          if (creditPercentage > maxCreditPercent) {
            status = 'CREDIT_LOCK';
          } else if (creditPercentage === maxCreditPercent) {
            status = 'LIMIT_REACHED';
          } else if (creditPercentage >= maxCreditPercent * 0.85) {
            status = 'NEAR_LIMIT';
          } else {
            status = 'WITHIN_LIMIT';
          }
        }

        return {
          id: d.id,
          dealerName: d.name,
          dealerCode: d.code,
          officerId: d.assignedOfficer?.id || null,
          officerName: d.assignedOfficer ? `${d.assignedOfficer.firstName} ${d.assignedOfficer.lastName}` : 'Unassigned',
          territoryId: d.territoryId,
          territoryName: d.territory?.name || 'Unassigned',
          zoneId: d.territory?.zoneId,
          zoneName: d.territory?.zone?.name || 'Unassigned',
          regionId: d.territory?.zone?.regionId,
          regionName: d.territory?.zone?.region?.name || 'Unassigned',
          netSales: Math.round(netSales * 100) / 100,
          collections: Math.round(collections * 100) / 100,
          outstandingCredit: Math.round(exposure * 100) / 100,
          creditPercentage,
          maxCreditPercentage: maxCreditPercent,
          maxAllowedCredit,
          availableCredit: Math.round(availableCredit * 100) / 100,
          status,
        };
      }),
    );

    // Apply region/zone filters if provided
    let filtered = reportItems;
    if (params.regionId) filtered = filtered.filter((r) => r.regionId === params.regionId);
    if (params.zoneId) filtered = filtered.filter((r) => r.zoneId === params.zoneId);

    const totalSales = filtered.reduce((s, i) => s + i.netSales, 0);
    const totalCollections = filtered.reduce((s, i) => s + i.collections, 0);
    const totalOutstanding = filtered.reduce((s, i) => s + i.outstandingCredit, 0);
    const overallCreditPercentage = totalSales > 0 ? Math.round((totalOutstanding / totalSales) * 10000) / 100 : 0;
    const creditLockCount = filtered.filter((i) => i.status === 'CREDIT_LOCK').length;
    const nearLimitCount = filtered.filter((i) => i.status === 'NEAR_LIMIT' || i.status === 'LIMIT_REACHED').length;

    return {
      summary: {
        totalDealers: filtered.length,
        totalSales: Math.round(totalSales * 100) / 100,
        totalCollections: Math.round(totalCollections * 100) / 100,
        totalOutstanding: Math.round(totalOutstanding * 100) / 100,
        overallCreditPercentage,
        defaultMaxCreditPercentage: 20.0,
        creditLockCount,
        nearLimitCount,
      },
      items: filtered,
    };
  }
}
