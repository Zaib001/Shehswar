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
  async getEffectiveLimit(companyId: string, level: CreditLevel, entityId: string): Promise<{ limit: number; threshold: number }> {
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
      };
    }

    return { limit: 0, threshold: 85 };
  }

  /**
   * Evaluates a single level against its limit and proposed order amount
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
  ): CreditCheckLevelResult {
    const effectiveOrderAmount = isCash ? 0 : orderAmount;
    const projectedExposure = currentExposure + effectiveOrderAmount;
    const availableCredit = limit > 0 ? Math.max(0, limit - currentExposure) : 999999999;
    const utilizationPercent = limit > 0 ? Math.round((projectedExposure / limit) * 10000) / 100 : 0;

    let status: CreditStatus = 'WITHIN_LIMIT';
    let allowed = true;
    let approvalRequired = false;

    if (limit > 0) {
      if (currentExposure >= limit) {
        status = 'CREDIT_HOLD';
        allowed = false;
        approvalRequired = true;
      } else if (projectedExposure > limit) {
        status = 'LIMIT_EXCEEDED';
        allowed = false;
        approvalRequired = true;
      } else if (projectedExposure === limit) {
        status = 'LIMIT_REACHED';
        allowed = true;
        approvalRequired = false;
      } else if (utilizationPercent >= thresholdPercent) {
        status = 'NEAR_LIMIT';
        allowed = true;
        approvalRequired = false;
      }
    }

    // CASH orders are always allowed unless explicitly in CREDIT_HOLD and business policy says so
    if (isCash) {
      allowed = true;
      approvalRequired = false;
      if (currentExposure >= limit && limit > 0) {
        status = 'CREDIT_HOLD';
      }
    }

    return {
      level,
      entityId,
      entityName,
      limit,
      currentExposure,
      orderAmount: effectiveOrderAmount,
      projectedExposure,
      availableCredit,
      utilizationPercent,
      status,
      allowed,
      approvalRequired,
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
    const dealerResult = this.evaluateLevel(
      'DEALER',
      dealer.id,
      dealer.name,
      dealerLimitConfig.limit,
      dealerExposure,
      input.orderAmount,
      dealerLimitConfig.threshold,
      isCash,
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
      salesOfficerResult = this.evaluateLevel(
        'SALES_OFFICER',
        salesOfficerId,
        officerName,
        officerLimitConfig.limit,
        officerExposure,
        input.orderAmount,
        officerLimitConfig.threshold,
        isCash,
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
      territoryResult = this.evaluateLevel(
        'TERRITORY',
        territoryId,
        territoryName,
        terrLimitConfig.limit,
        terrExposure,
        input.orderAmount,
        terrLimitConfig.threshold,
        isCash,
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
      zoneResult = this.evaluateLevel(
        'ZONE',
        zoneId,
        zoneName,
        zoneLimitConfig.limit,
        zoneExposure,
        input.orderAmount,
        zoneLimitConfig.threshold,
        isCash,
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
      regionResult = this.evaluateLevel(
        'REGION',
        regionId,
        regionName,
        regionLimitConfig.limit,
        regionExposure,
        input.orderAmount,
        regionLimitConfig.threshold,
        isCash,
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
}
