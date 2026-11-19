/**
 * SHEHSWAR ONE360 - Hierarchical Market Performance & Reporting Engine
 *
 * Implements authoritative mathematical rollups across all market tiers:
 * Group (Punjab Total) -> Region (BM) -> Zone (AM) -> Territory (SO) -> Sales Officer -> Dealer -> Product
 *
 * Strict Financial Filters:
 *   WHERE postingStatus = 'POSTED'
 *     AND isDeliveryChallan != true
 *     AND invoiceDate BETWEEN startDate AND endDate (or All Time)
 *
 * 6 Core Metrics:
 *   1. Revenue (Sum of net invoiced amount)
 *   2. Quantity (Sum of line item quantities)
 *   3. Number of Orders (Count of posted invoices)
 *   4. Active Dealers (Count of distinct dealers with posted sales)
 *   5. Average Dealer Sales (Revenue / Active Dealers)
 *   6. Target Achievement % ((Actual Sales / Target) * 100)
 */
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';

export interface PerformanceFilter {
  companyId?: string;
  startDate?: string;
  endDate?: string;
  month?: number;
  year?: number;
  period?: 'THIS_MONTH' | 'LAST_MONTH' | 'Q1' | 'Q2' | 'Q3' | 'Q4' | 'YTD' | 'ALL_TIME' | 'CUSTOM' | string;
  allTime?: boolean | string;
  regionId?: string;
  zoneId?: string;
  territoryId?: string;
  officerId?: string;
  dealerId?: string;
}

@Injectable()
export class MarketPerformanceService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Resolve date filter boundary with rich period presets
   */
  private resolveDateRange(filter?: PerformanceFilter): {
    start: Date;
    end: Date;
    year: number;
    month: number;
    periodLabel: string;
    isAllTime: boolean;
  } {
    const now = new Date();
    const year = filter?.year ? Number(filter.year) : now.getFullYear();
    const month = filter?.month ? Number(filter.month) : now.getMonth() + 1;
    const period = filter?.period ? String(filter.period).toUpperCase() : undefined;
    const isAllTime = filter?.allTime === true || filter?.allTime === 'true' || period === 'ALL_TIME';

    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December',
    ];

    let start: Date;
    let end: Date;
    let periodLabel: string;

    if (isAllTime) {
      start = new Date('2020-01-01T00:00:00.000Z');
      end = new Date('2035-12-31T23:59:59.999Z');
      periodLabel = 'All Time (Full History)';
    } else if (filter?.startDate && filter?.endDate) {
      start = new Date(filter.startDate);
      end = new Date(filter.endDate);
      end.setHours(23, 59, 59, 999);
      periodLabel = `${start.toLocaleDateString()} - ${end.toLocaleDateString()}`;
    } else if (period === 'LAST_MONTH') {
      const prevMonth = month === 1 ? 12 : month - 1;
      const prevYear = month === 1 ? year - 1 : year;
      start = new Date(prevYear, prevMonth - 1, 1, 0, 0, 0, 0);
      end = new Date(prevYear, prevMonth, 0, 23, 59, 59, 999);
      periodLabel = `${monthNames[prevMonth - 1]} ${prevYear}`;
    } else if (period === 'YTD') {
      start = new Date(year, 0, 1, 0, 0, 0, 0);
      end = new Date(year, 11, 31, 23, 59, 59, 999);
      periodLabel = `Year-to-Date ${year}`;
    } else if (period === 'Q1') {
      start = new Date(year, 0, 1, 0, 0, 0, 0);
      end = new Date(year, 3, 0, 23, 59, 59, 999);
      periodLabel = `Q1 ${year}`;
    } else if (period === 'Q2') {
      start = new Date(year, 3, 1, 0, 0, 0, 0);
      end = new Date(year, 6, 0, 23, 59, 59, 999);
      periodLabel = `Q2 ${year}`;
    } else if (period === 'Q3') {
      start = new Date(year, 6, 1, 0, 0, 0, 0);
      end = new Date(year, 9, 0, 23, 59, 59, 999);
      periodLabel = `Q3 ${year}`;
    } else if (period === 'Q4') {
      start = new Date(year, 9, 1, 0, 0, 0, 0);
      end = new Date(year, 12, 0, 23, 59, 59, 999);
      periodLabel = `Q4 ${year}`;
    } else {
      // Default: specific month and year
      start = new Date(year, month - 1, 1, 0, 0, 0, 0);
      end = new Date(year, month, 0, 23, 59, 59, 999);
      periodLabel = `${monthNames[month - 1]} ${year}`;
    }

    return { start, end, year, month, periodLabel, isAllTime };
  }

  /**
   * Helper: Base query condition for posted sales only
   */
  private baseWhere(companyId: string, start: Date, end: Date, isAllTime: boolean = false) {
    const where: any = {
      postingStatus: 'POSTED',
      isDeliveryChallan: { not: true },
    };
    if (companyId && companyId.toLowerCase() !== 'all') {
      where.companyId = companyId;
    }
    if (!isAllTime) {
      where.invoiceDate = {
        gte: start,
        lte: end,
      };
    }
    return where;
  }

  /**
   * Resolve attribution fallback:
   * Uses invoice's snapshot field first, and falls back to dealer -> territory -> zone -> region
   */
  private getEffectiveAttribution(inv: any) {
    const regionId = inv.regionId || inv.dealer?.territory?.zone?.regionId || null;
    const zoneId = inv.zoneId || inv.dealer?.territory?.zoneId || null;
    const territoryId = inv.territoryId || inv.dealer?.territoryId || null;
    const salesOfficerId =
      inv.salesOfficerId ||
      inv.dealer?.assignedFieldOfficerId ||
      inv.dealer?.territory?.managerId ||
      null;
    return { regionId, zoneId, territoryId, salesOfficerId };
  }

  private aggregateTopProducts(invoices: any[], totalRevenue: number) {
    const map = new Map<string, { productName: string; packing: string; quantitySold: number; salesAmount: number }>();
    for (const inv of invoices) {
      for (const item of (inv.items || [])) {
        const name = item.productName || 'Agricultural Formulation';
        const pack = item.packing || 'Commercial Pack';
        const key = `${name}_${pack}`;
        if (!map.has(key)) {
          map.set(key, { productName: name, packing: pack, quantitySold: 0, salesAmount: 0 });
        }
        const p = map.get(key)!;
        const q = Number(item.quantity || 0);
        p.quantitySold += q;
        p.salesAmount += Number(item.netAmount || (q * Number(item.rate || 0)) || 0);
      }
    }
    return Array.from(map.values())
      .sort((a, b) => b.salesAmount - a.salesAmount)
      .slice(0, 15)
      .map((p) => ({
        ...p,
        shareOfTotalPercent: totalRevenue > 0 ? Number(((p.salesAmount / totalRevenue) * 100).toFixed(1)) : 0,
      }));
  }

  /**
   * Enterprise 4-Tier Market Hierarchy Target & Credit Aggregator
   * Single Source of Truth: Sales Officer / User Creation records.
   * Rollup: User (Actual Target & Credit) -> Territory (Sum) -> Zone (Sum) -> Region (Sum) -> Group (Sum).
   * Strict single-source attribution: zero hardcoded values, zero fake fallbacks, zero double counting.
   */
  private async calculateMarketAggregates(companyId?: string) {
    const whereRegion: any = { isActive: true };
    if (companyId && companyId.toLowerCase() !== 'all') {
      whereRegion.companyId = companyId;
    }

    const [regions, unassignedTerritories, allCreditLimits, allSalesTargets] = await Promise.all([
      this.prisma.region.findMany({
        where: whereRegion,
        include: {
          zones: {
            where: { isActive: true },
            include: {
              territories: {
                where: { isActive: true },
                include: {
                  salesOfficer: {
                    select: { id: true, firstName: true, lastName: true, email: true, phone: true },
                  },
                  userMarketAssignments: {
                    where: { status: 'ACTIVE' },
                    include: {
                      user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
                    },
                  },
                },
              },
            },
          },
        },
      }),
      this.prisma.territory.findMany({
        where: { isActive: true },
        include: {
          salesOfficer: {
            select: { id: true, firstName: true, lastName: true, email: true, phone: true },
          },
          userMarketAssignments: {
            where: { status: 'ACTIVE' },
            include: {
              user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
            },
          },
        },
      }),
      this.prisma.creditLimit.findMany({
        where: { level: 'SALES_OFFICER', status: 'ACTIVE' },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.salesTarget.findMany({
        where: { level: 'SALES_OFFICER', status: 'ACTIVE' },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    const userCreditMap = new Map<string, number>();
    for (const cl of allCreditLimits) {
      userCreditMap.set(cl.entityId, Number(cl.creditLimit || 0));
    }

    const userTargetMap = new Map<string, number>();
    for (const st of allSalesTargets) {
      userTargetMap.set(st.entityId, Number(st.targetAmount || 0));
    }

    const territoryMap = new Map<
      string,
      {
        targetAmount: number;
        creditLimit: number;
        salesOfficersCount: number;
        salesOfficers: Array<{ id: string; name: string; email?: string; phone?: string; targetAmount: number; creditLimit: number }>;
      }
    >();

    for (const t of unassignedTerritories) {
      const distinctOfficers = new Map<string, { id: string; name: string; email?: string; phone?: string }>();
      if (t.salesOfficer?.id) {
        distinctOfficers.set(t.salesOfficer.id, {
          id: t.salesOfficer.id,
          name: `${t.salesOfficer.firstName || ''} ${t.salesOfficer.lastName || ''}`.trim(),
          email: t.salesOfficer.email,
          phone: t.salesOfficer.phone || undefined,
        });
      }
      for (const uma of t.userMarketAssignments || []) {
        if (uma.user?.id) {
          distinctOfficers.set(uma.user.id, {
            id: uma.user.id,
            name: `${uma.user.firstName || ''} ${uma.user.lastName || ''}`.trim(),
            email: uma.user.email,
            phone: uma.user.phone || undefined,
          });
        }
      }

      let tTarget = 0;
      let tCredit = 0;
      const officersList: Array<{ id: string; name: string; email?: string; phone?: string; targetAmount: number; creditLimit: number }> = [];

      for (const [uid, uInfo] of distinctOfficers.entries()) {
        const uTarget = userTargetMap.get(uid) || 0;
        const uCredit = userCreditMap.get(uid) || 0;
        tTarget += uTarget;
        tCredit += uCredit;
        officersList.push({
          id: uid,
          name: uInfo.name,
          email: uInfo.email,
          phone: uInfo.phone,
          targetAmount: uTarget,
          creditLimit: uCredit,
        });
      }

      territoryMap.set(t.id, {
        targetAmount: tTarget,
        creditLimit: tCredit,
        salesOfficersCount: distinctOfficers.size,
        salesOfficers: officersList,
      });
    }

    const zoneMap = new Map<
      string,
      {
        targetAmount: number;
        creditLimit: number;
        territoriesCount: number;
      }
    >();

    const regionMap = new Map<
      string,
      {
        targetAmount: number;
        creditLimit: number;
        zonesCount: number;
      }
    >();

    let totalGroupTarget = 0;
    let totalGroupCredit = 0;

    for (const r of regions) {
      let regTarget = 0;
      let regCredit = 0;

      for (const z of r.zones) {
        let zoneTarget = 0;
        let zoneCredit = 0;

        for (const t of z.territories) {
          const tAgg = territoryMap.get(t.id) || { targetAmount: 0, creditLimit: 0 };
          zoneTarget += tAgg.targetAmount;
          zoneCredit += tAgg.creditLimit;
        }

        zoneMap.set(z.id, {
          targetAmount: zoneTarget,
          creditLimit: zoneCredit,
          territoriesCount: z.territories.length,
        });

        regTarget += zoneTarget;
        regCredit += zoneCredit;
      }

      regionMap.set(r.id, {
        targetAmount: regTarget,
        creditLimit: regCredit,
        zonesCount: r.zones.length,
      });

      totalGroupTarget += regTarget;
      totalGroupCredit += regCredit;
    }

    return {
      userCreditMap,
      userTargetMap,
      territoryMap,
      zoneMap,
      regionMap,
      totalGroupTarget,
      totalGroupCredit,
    };
  }

  /**
   * 1. GROUP LEVEL PERFORMANCE (Punjab Total + Regional Breakdown)
   */
  async getGroupPerformance(companyId: string, filter?: PerformanceFilter) {
    const { start, end, year, month, periodLabel, isAllTime } = this.resolveDateRange(filter);
    const where = this.baseWhere(companyId, start, end, isAllTime);

    const compFilter = companyId && companyId.toLowerCase() !== 'all' ? { companyId } : {};

    const [invoices, regions, aggregates] = await Promise.all([
      this.prisma.salesInvoice.findMany({
        where,
        select: {
          id: true,
          netAmount: true,
          dealerId: true,
          regionId: true,
          zoneId: true,
          territoryId: true,
          salesOfficerId: true,
          dealer: {
            select: {
              id: true,
              territoryId: true,
              assignedFieldOfficerId: true,
              territory: {
                select: {
                  id: true,
                  zoneId: true,
                  managerId: true,
                  zone: {
                    select: {
                      id: true,
                      regionId: true,
                      managerId: true,
                    },
                  },
                },
              },
            },
          },
          items: { select: { quantity: true, productName: true, packing: true, netAmount: true, rate: true } },
        },
      }),
      this.prisma.region.findMany({
        where: { ...compFilter, isActive: true },
        include: {
          businessManager: {
            select: { id: true, firstName: true, lastName: true, phone: true },
          },
          zones: {
            where: { isActive: true },
          },
        },
      }),
      this.calculateMarketAggregates(companyId),
    ]);

    let totalRevenue = 0;
    let totalQty = 0;
    const activeDealersSet = new Set<string>();

    // Map regional aggregations
    const regionMap = new Map<string, { revenue: number; qty: number; orderCount: number; dealers: Set<string> }>();
    for (const r of regions) {
      regionMap.set(r.id, { revenue: 0, qty: 0, orderCount: 0, dealers: new Set() });
    }

    for (const inv of invoices) {
      const net = Number(inv.netAmount || 0);
      totalRevenue += net;
      if (inv.dealerId) activeDealersSet.add(inv.dealerId);

      const invQty = inv.items.reduce((s, it) => s + Number(it.quantity || 0), 0);
      totalQty += invQty;

      const { regionId } = this.getEffectiveAttribution(inv);
      if (regionId && regionMap.has(regionId)) {
        const rData = regionMap.get(regionId)!;
        rData.revenue += net;
        rData.qty += invQty;
        rData.orderCount += 1;
        if (inv.dealerId) rData.dealers.add(inv.dealerId);
      }
    }

    const regionalBreakdown = regions.map((r) => {
      const data = regionMap.get(r.id) || { revenue: 0, qty: 0, orderCount: 0, dealers: new Set() };
      const rAgg = aggregates.regionMap.get(r.id) || { targetAmount: 0, creditLimit: 0, zonesCount: r.zones.length };
      const regionTarget = rAgg.targetAmount;
      const regionCredit = rAgg.creditLimit;

      const achievement = regionTarget > 0 ? (data.revenue / regionTarget) * 100 : 0;
      const activeDealers = data.dealers.size;
      const avgDealerSales = activeDealers > 0 ? data.revenue / activeDealers : 0;

      return {
        regionId: r.id,
        regionCode: r.code,
        regionName: r.name,
        businessManager: r.businessManager
          ? `${r.businessManager.firstName} ${r.businessManager.lastName}`.trim()
          : 'Unassigned',
        zonesCount: r.zones.length,
        actualSales: data.revenue,
        target: regionTarget,
        creditLimit: regionCredit,
        achievementPercent: Number(achievement.toFixed(2)),
        totalQuantity: data.qty,
        ordersCount: data.orderCount,
        activeDealers,
        averageDealerSales: Math.round(avgDealerSales),
      };
    });

    const finalGroupTarget = aggregates.totalGroupTarget;
    const finalGroupCredit = aggregates.totalGroupCredit;
    const groupAchievement = finalGroupTarget > 0 ? (totalRevenue / finalGroupTarget) * 100 : 0;
    const activeDealersCount = activeDealersSet.size;

    return {
      scope: 'GROUP',
      title: 'Punjab Provincial Group Total',
      period: { year, month, start, end, periodLabel },
      metrics: {
        totalRevenue,
        totalQuantity: totalQty,
        totalOrders: invoices.length,
        activeDealers: activeDealersCount,
        averageDealerSales: activeDealersCount > 0 ? Math.round(totalRevenue / activeDealersCount) : 0,
        target: finalGroupTarget,
        creditLimit: finalGroupCredit,
        achievementPercent: Number(groupAchievement.toFixed(2)),
      },
      regions: regionalBreakdown,
      products: this.aggregateTopProducts(invoices, totalRevenue),
    };
  }

  /**
   * 2. REGION LEVEL PERFORMANCE (With Zone Breakdown)
   */
  async getRegionPerformance(companyId: string, regionId: string, filter?: PerformanceFilter) {
    const { start, end, year, month, periodLabel, isAllTime } = this.resolveDateRange(filter);
    const baseCondition = this.baseWhere(companyId, start, end, isAllTime);

    const where: any = {
      ...baseCondition,
      OR: [
        { regionId },
        { dealer: { territory: { zone: { regionId } } } },
      ],
    };

    const compFilter = companyId && companyId.toLowerCase() !== 'all' ? { companyId } : {};

    const [region, invoices, zones, aggregates] = await Promise.all([
      this.prisma.region.findFirst({
        where: { id: regionId, ...compFilter },
        include: {
          businessManager: {
            select: { id: true, firstName: true, lastName: true, phone: true },
          },
        },
      }),
      this.prisma.salesInvoice.findMany({
        where,
        select: {
          id: true,
          netAmount: true,
          dealerId: true,
          zoneId: true,
          regionId: true,
          territoryId: true,
          salesOfficerId: true,
          dealer: {
            select: {
              id: true,
              territoryId: true,
              assignedFieldOfficerId: true,
              territory: {
                select: {
                  id: true,
                  zoneId: true,
                  managerId: true,
                },
              },
            },
          },
          items: { select: { quantity: true, productName: true, packing: true, netAmount: true, rate: true } },
        },
      }),
      this.prisma.zone.findMany({
        where: { regionId, isActive: true },
        include: {
          areaManager: {
            select: { id: true, firstName: true, lastName: true, phone: true },
          },
          territories: {
            where: { isActive: true },
          },
        },
      }),
      this.calculateMarketAggregates(companyId),
    ]);

    if (!region) throw new Error('Region not found');

    let totalRevenue = 0;
    let totalQty = 0;
    const activeDealersSet = new Set<string>();

    const zoneMap = new Map<string, { revenue: number; qty: number; orderCount: number; dealers: Set<string> }>();
    for (const z of zones) {
      zoneMap.set(z.id, { revenue: 0, qty: 0, orderCount: 0, dealers: new Set() });
    }

    for (const inv of invoices) {
      const net = Number(inv.netAmount || 0);
      totalRevenue += net;
      if (inv.dealerId) activeDealersSet.add(inv.dealerId);

      const invQty = inv.items.reduce((s, it) => s + Number(it.quantity || 0), 0);
      totalQty += invQty;

      const { zoneId } = this.getEffectiveAttribution(inv);
      if (zoneId && zoneMap.has(zoneId)) {
        const zData = zoneMap.get(zoneId)!;
        zData.revenue += net;
        zData.qty += invQty;
        zData.orderCount += 1;
        if (inv.dealerId) zData.dealers.add(inv.dealerId);
      }
    }

    const zonesBreakdown = zones.map((z) => {
      const data = zoneMap.get(z.id) || { revenue: 0, qty: 0, orderCount: 0, dealers: new Set() };
      const zAgg = aggregates.zoneMap.get(z.id) || { targetAmount: 0, creditLimit: 0, territoriesCount: z.territories.length };
      const zoneTarget = zAgg.targetAmount;
      const zoneCredit = zAgg.creditLimit;

      const achievement = zoneTarget > 0 ? (data.revenue / zoneTarget) * 100 : 0;
      const activeDealers = data.dealers.size;
      const avgDealerSales = activeDealers > 0 ? data.revenue / activeDealers : 0;

      return {
        zoneId: z.id,
        zoneCode: z.code,
        zoneName: z.name,
        areaManager: z.areaManager ? `${z.areaManager.firstName} ${z.areaManager.lastName}`.trim() : 'Unassigned',
        territoriesCount: z.territories.length,
        actualSales: data.revenue,
        target: zoneTarget,
        creditLimit: zoneCredit,
        achievementPercent: Number(achievement.toFixed(2)),
        totalQuantity: data.qty,
        ordersCount: data.orderCount,
        activeDealers,
        averageDealerSales: Math.round(avgDealerSales),
      };
    });

    const rAgg = aggregates.regionMap.get(region.id) || { targetAmount: 0, creditLimit: 0, zonesCount: zones.length };
    const finalRegionTarget = rAgg.targetAmount;
    const finalRegionCredit = rAgg.creditLimit;
    const achievementPercent = finalRegionTarget > 0 ? (totalRevenue / finalRegionTarget) * 100 : 0;
    const activeDealersCount = activeDealersSet.size;

    return {
      scope: 'REGION',
      region: {
        id: region.id,
        code: region.code,
        name: region.name,
        businessManager: region.businessManager
          ? `${region.businessManager.firstName} ${region.businessManager.lastName}`.trim()
          : 'Unassigned',
      },
      period: { year, month, start, end, periodLabel },
      metrics: {
        totalRevenue,
        totalQuantity: totalQty,
        totalOrders: invoices.length,
        activeDealers: activeDealersCount,
        averageDealerSales: activeDealersCount > 0 ? Math.round(totalRevenue / activeDealersCount) : 0,
        target: finalRegionTarget,
        creditLimit: finalRegionCredit,
        achievementPercent: Number(achievementPercent.toFixed(2)),
      },
      zones: zonesBreakdown,
      products: this.aggregateTopProducts(invoices, totalRevenue),
    };
  }

  /**
   * 3. ZONE LEVEL PERFORMANCE (With Territory Breakdown)
   */
  async getZonePerformance(companyId: string, zoneId: string, filter?: PerformanceFilter) {
    const { start, end, year, month, periodLabel, isAllTime } = this.resolveDateRange(filter);
    const baseCondition = this.baseWhere(companyId, start, end, isAllTime);

    const where: any = {
      ...baseCondition,
      OR: [
        { zoneId },
        { dealer: { territory: { zoneId } } },
      ],
    };

    const [zone, invoices, territories, aggregates] = await Promise.all([
      this.prisma.zone.findFirst({
        where: { id: zoneId },
        include: {
          region: true,
          areaManager: {
            select: { id: true, firstName: true, lastName: true, phone: true },
          },
        },
      }),
      this.prisma.salesInvoice.findMany({
        where,
        select: {
          id: true,
          netAmount: true,
          dealerId: true,
          territoryId: true,
          zoneId: true,
          salesOfficerId: true,
          dealer: {
            select: {
              id: true,
              territoryId: true,
              assignedFieldOfficerId: true,
            },
          },
          items: { select: { quantity: true, productName: true, packing: true, netAmount: true, rate: true } },
        },
      }),
      this.prisma.territory.findMany({
        where: { zoneId, isActive: true },
        include: {
          salesOfficer: {
            select: { id: true, firstName: true, lastName: true, phone: true },
          },
          dealers: {
            where: { deletedAt: null },
            select: { id: true, name: true, code: true, monthlySalesTarget: true, annualAgreementTarget: true, assignedFieldOfficerId: true },
          },
          userMarketAssignments: {
            where: { status: 'ACTIVE' },
            select: { userId: true },
          },
        },
      }),
      this.calculateMarketAggregates(companyId),
    ]);

    if (!zone) throw new Error('Zone not found');

    let totalRevenue = 0;
    let totalQty = 0;
    const activeDealersSet = new Set<string>();

    const terrMap = new Map<string, { revenue: number; qty: number; orderCount: number; dealers: Set<string> }>();
    for (const t of territories) {
      terrMap.set(t.id, { revenue: 0, qty: 0, orderCount: 0, dealers: new Set() });
    }

    for (const inv of invoices) {
      const net = Number(inv.netAmount || 0);
      totalRevenue += net;
      if (inv.dealerId) activeDealersSet.add(inv.dealerId);

      const invQty = inv.items.reduce((s, it) => s + Number(it.quantity || 0), 0);
      totalQty += invQty;

      const { territoryId } = this.getEffectiveAttribution(inv);
      if (territoryId && terrMap.has(territoryId)) {
        const tData = terrMap.get(territoryId)!;
        tData.revenue += net;
        tData.qty += invQty;
        tData.orderCount += 1;
        if (inv.dealerId) tData.dealers.add(inv.dealerId);
      }
    }

    const territoryBreakdown = territories.map((t) => {
      const data = terrMap.get(t.id) || { revenue: 0, qty: 0, orderCount: 0, dealers: new Set() };
      const tAgg = aggregates.territoryMap.get(t.id) || { targetAmount: 0, creditLimit: 0, salesOfficersCount: 0, salesOfficers: [] };
      const territoryTarget = tAgg.targetAmount;
      const territoryCredit = tAgg.creditLimit;

      const achievement = territoryTarget > 0 ? (data.revenue / territoryTarget) * 100 : 0;
      const assignedCount = t.dealers?.length || 0;
      const activeDealers = data.dealers.size > 0 ? data.dealers.size : 0;
      const avgDealerSales = activeDealers > 0 ? data.revenue / activeDealers : 0;

      return {
        territoryId: t.id,
        territoryCode: t.code,
        territoryName: t.name,
        primaryOfficer: t.salesOfficer ? `${t.salesOfficer.firstName} ${t.salesOfficer.lastName}`.trim() : 'Unassigned',
        salesOfficersCount: tAgg.salesOfficersCount,
        salesOfficers: tAgg.salesOfficers,
        actualSales: data.revenue,
        target: territoryTarget,
        creditLimit: territoryCredit,
        achievementPercent: Number(achievement.toFixed(2)),
        totalQuantity: data.qty,
        ordersCount: data.orderCount,
        activeDealers,
        assignedDealers: assignedCount,
        averageDealerSales: Math.round(avgDealerSales),
      };
    });

    const zAgg = aggregates.zoneMap.get(zone.id) || { targetAmount: 0, creditLimit: 0, territoriesCount: territories.length };
    const finalZoneTarget = zAgg.targetAmount;
    const finalZoneCredit = zAgg.creditLimit;
    const achievementPercent = finalZoneTarget > 0 ? (totalRevenue / finalZoneTarget) * 100 : 0;
    const activeDealersCount = activeDealersSet.size;

    return {
      scope: 'ZONE',
      zone: {
        id: zone.id,
        code: zone.code,
        name: zone.name,
        regionName: zone.region?.name,
        areaManager: zone.areaManager ? `${zone.areaManager.firstName} ${zone.areaManager.lastName}`.trim() : 'Unassigned',
      },
      period: { year, month, start, end, periodLabel },
      metrics: {
        totalRevenue,
        totalQuantity: totalQty,
        totalOrders: invoices.length,
        activeDealers: activeDealersCount,
        averageDealerSales: activeDealersCount > 0 ? Math.round(totalRevenue / activeDealersCount) : 0,
        target: finalZoneTarget,
        creditLimit: finalZoneCredit,
        achievementPercent: Number(achievementPercent.toFixed(2)),
      },
      territories: territoryBreakdown,
      products: this.aggregateTopProducts(invoices, totalRevenue),
    };
  }

  /**
   * 4. TERRITORY LEVEL PERFORMANCE (With Sales Officers Breakdown)
   */
  async getTerritoryPerformance(companyId: string, territoryId: string, filter?: PerformanceFilter) {
    const { start, end, year, month, periodLabel, isAllTime } = this.resolveDateRange(filter);
    const baseCondition = this.baseWhere(companyId, start, end, isAllTime);

    const where: any = {
      ...baseCondition,
      OR: [
        { territoryId },
        { dealer: { territoryId } },
      ],
    };

    const [territory, invoices, aggregates] = await Promise.all([
      this.prisma.territory.findFirst({
        where: { id: territoryId },
        include: {
          zone: { include: { region: true } },
          salesOfficer: true,
          dealers: {
            where: { deletedAt: null },
            select: {
              id: true,
              code: true,
              name: true,
              phone: true,
              city: true,
              creditLimit: true,
              assignedFieldOfficerId: true,
              monthlySalesTarget: true,
              annualAgreementTarget: true,
            },
          },
          userMarketAssignments: {
            where: { status: 'ACTIVE' },
            include: {
              user: { select: { id: true, firstName: true, lastName: true, phone: true } },
            },
          },
        },
      }),
      this.prisma.salesInvoice.findMany({
        where,
        select: {
          id: true,
          netAmount: true,
          dealerId: true,
          salesOfficerId: true,
          territoryId: true,
          dealer: {
            select: {
              id: true,
              assignedFieldOfficerId: true,
            },
          },
          salesOfficer: {
            select: { id: true, firstName: true, lastName: true },
          },
          items: { select: { quantity: true, productName: true, packing: true, netAmount: true, rate: true } },
        },
      }),
      this.calculateMarketAggregates(companyId),
    ]);

    if (!territory) throw new Error('Territory not found');

    let totalRevenue = 0;
    let totalQty = 0;
    const activeDealersSet = new Set<string>();

    // Aggregate by Sales Officer
    const officerMap = new Map<string, { officerName: string; revenue: number; qty: number; orderCount: number; dealers: Set<string> }>();

    // Pre-populate assigned primary sales officer
    if (territory.salesOfficer) {
      const soId = territory.salesOfficer.id;
      const soName = `${territory.salesOfficer.firstName || ''} ${territory.salesOfficer.lastName || ''}`.trim() || 'Sales Officer';
      officerMap.set(soId, { officerName: soName, revenue: 0, qty: 0, orderCount: 0, dealers: new Set() });
    }

    // Pre-populate market assignments
    for (const uma of (territory as any).userMarketAssignments || []) {
      if (uma.user && !officerMap.has(uma.user.id)) {
        const uName = `${uma.user.firstName || ''} ${uma.user.lastName || ''}`.trim() || 'Sales Officer';
        officerMap.set(uma.user.id, { officerName: uName, revenue: 0, qty: 0, orderCount: 0, dealers: new Set() });
      }
    }

    const tAgg = aggregates.territoryMap.get(territory.id) || { targetAmount: 0, creditLimit: 0, salesOfficersCount: 0, salesOfficers: [] };

    // Ensure all officers from tAgg appear in officerMap
    for (const off of tAgg.salesOfficers) {
      if (!officerMap.has(off.id)) {
        officerMap.set(off.id, { officerName: off.name, revenue: 0, qty: 0, orderCount: 0, dealers: new Set() });
      }
    }

    for (const inv of invoices) {
      const net = Number(inv.netAmount || 0);
      totalRevenue += net;
      if (inv.dealerId) activeDealersSet.add(inv.dealerId);

      const invQty = inv.items.reduce((s, it) => s + Number(it.quantity || 0), 0);
      totalQty += invQty;

      const { salesOfficerId } = this.getEffectiveAttribution(inv);
      const soId = salesOfficerId || 'UNASSIGNED';
      const soName = inv.salesOfficer
        ? `${inv.salesOfficer.firstName} ${inv.salesOfficer.lastName}`.trim()
        : soId !== 'UNASSIGNED' && territory.salesOfficer?.id === soId
        ? `${territory.salesOfficer?.firstName || ''} ${territory.salesOfficer?.lastName || ''}`.trim()
        : 'Direct / Unassigned';

      if (!officerMap.has(soId)) {
        officerMap.set(soId, { officerName: soName, revenue: 0, qty: 0, orderCount: 0, dealers: new Set() });
      }
      const oData = officerMap.get(soId)!;
      oData.revenue += net;
      oData.qty += invQty;
      oData.orderCount += 1;
      if (inv.dealerId) oData.dealers.add(inv.dealerId);
    }

    // Direct Dealer Breakdown under Territory (Province -> Region -> Zone -> Territory -> Dealer)
    const dealerMetricsMap = new Map<string, {
      dealerId: string;
      dealerCode: string;
      dealerName: string;
      phone?: string;
      city?: string;
      assignedOfficer?: string;
      actualSales: number;
      totalQuantity: number;
      ordersCount: number;
      target: number;
      creditLimit: number;
      currentBalance?: number;
      usedCredit?: number;
      pendingCredit?: number;
    }>();

    // 1. Gather all officer IDs associated with this territory
    const territoryOfficerIds = [
      territory.salesOfficer?.id,
      territory.managerId,
      ...((territory as any).userMarketAssignments || []).map((uma: any) => uma.userId || uma.user?.id),
      ...tAgg.salesOfficers.map((o: any) => o.id),
    ].filter(Boolean);

    // 2. Fetch all dealers: either directly linked to this territory, or assigned to this territory's sales officer(s)
    const territoryDealers = await this.prisma.dealer.findMany({
      where: {
        OR: [
          { territoryId: territory.id },
          ...(territoryOfficerIds.length > 0 ? [{ assignedFieldOfficerId: { in: territoryOfficerIds } }] : []),
          ...(territoryOfficerIds.length > 0 ? [{ officerAssignments: { some: { userId: { in: territoryOfficerIds } } } }] : []),
        ],
        deletedAt: null,
      },
      select: {
        id: true,
        code: true,
        name: true,
        phone: true,
        city: true,
        address: true,
        creditLimit: true,
        currentBalance: true,
        assignedFieldOfficerId: true,
        territoryId: true,
        monthlySalesTarget: true,
        annualAgreementTarget: true,
        status: true,
        assignedOfficer: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });

    // 3. Auto-fix any dealer assigned to this territory's officer that has territoryId: null
    const unlinked = territoryDealers.filter((d) => !d.territoryId);
    if (unlinked.length > 0) {
      await this.prisma.dealer.updateMany({
        where: { id: { in: unlinked.map((d) => d.id) } },
        data: { territoryId: territory.id },
      }).catch(() => null);
    }

    // Pre-populate all active dealers belonging to this Territory or its Officers
    for (const d of territoryDealers) {
      const mTarget = Number(d.monthlySalesTarget || 0);
      const aTarget = Number(d.annualAgreementTarget || 0);
      const effTarget = mTarget > 0 ? mTarget : aTarget > 0 ? Math.round(aTarget / 12) : 0;
      const offName = d.assignedOfficer
        ? `${d.assignedOfficer.firstName || ''} ${d.assignedOfficer.lastName || ''}`.trim()
        : territory.salesOfficer
        ? `${territory.salesOfficer.firstName || ''} ${territory.salesOfficer.lastName || ''}`.trim()
        : 'Assigned';

      const cLimit = Number(d.creditLimit || 0);
      const cBal = Number(d.currentBalance || 0);
      const usedCredit = Math.max(0, cBal);
      const pendingCredit = Math.max(0, cLimit - cBal);

      dealerMetricsMap.set(d.id, {
        dealerId: d.id,
        dealerCode: d.code || '',
        dealerName: d.name || 'Unnamed Dealer',
        phone: d.phone || '',
        city: d.city || '',
        assignedOfficer: offName,
        actualSales: 0,
        totalQuantity: 0,
        ordersCount: 0,
        target: effTarget,
        creditLimit: cLimit,
        currentBalance: cBal,
        usedCredit,
        pendingCredit,
      });
    }

    // Accumulate invoice sales directly into the dealer records
    for (const inv of invoices) {
      if (inv.dealerId) {
        if (!dealerMetricsMap.has(inv.dealerId)) {
          dealerMetricsMap.set(inv.dealerId, {
            dealerId: inv.dealerId,
            dealerCode: (inv.dealer as any)?.code || '',
            dealerName: (inv.dealer as any)?.name || 'Direct Dealer',
            phone: '',
            city: '',
            actualSales: 0,
            totalQuantity: 0,
            ordersCount: 0,
            target: 0,
            creditLimit: 0,
          });
        }
        const dEntry = dealerMetricsMap.get(inv.dealerId)!;
        dEntry.actualSales += Number(inv.netAmount || 0);
        dEntry.totalQuantity += inv.items.reduce((s, it) => s + Number(it.quantity || 0), 0);
        dEntry.ordersCount += 1;
      }
    }

    const dealers = Array.from(dealerMetricsMap.values()).map((d) => {
      const ach = d.target > 0 ? (d.actualSales / d.target) * 100 : (d.actualSales > 0 ? 100 : 0);
      return {
        ...d,
        achievementPercent: Number(ach.toFixed(2)),
      };
    }).sort((a, b) => b.actualSales - a.actualSales);

    const officers = Array.from(officerMap.entries()).map(([officerId, data]) => {
      const officerTarget = aggregates.userTargetMap.get(officerId) || 0;
      const officerCredit = aggregates.userCreditMap.get(officerId) || 0;

      const achievement = officerTarget > 0 ? (data.revenue / officerTarget) * 100 : 0;
      const assignedCount = territory.dealers.filter((d) => d.assignedFieldOfficerId === officerId).length || territory.dealers.length;
      const activeDealers = data.dealers.size;

      return {
        officerId,
        officerName: data.officerName,
        actualSales: data.revenue,
        target: officerTarget,
        creditLimit: officerCredit,
        achievementPercent: Number(achievement.toFixed(2)),
        totalQuantity: data.qty,
        ordersCount: data.orderCount,
        activeDealers,
        assignedDealers: assignedCount,
        averageDealerSales: activeDealers > 0 ? Math.round(data.revenue / activeDealers) : 0,
      };
    });

    const finalTerritoryTarget = tAgg.targetAmount;
    const finalTerritoryCredit = tAgg.creditLimit;
    const achievementPercent = finalTerritoryTarget > 0 ? (totalRevenue / finalTerritoryTarget) * 100 : 0;
    const activeDealersCount = activeDealersSet.size;

    return {
      scope: 'TERRITORY',
      territory: {
        id: territory.id,
        code: territory.code,
        name: territory.name,
        zoneName: territory.zone?.name,
        regionName: territory.zone?.region?.name,
      },
      period: { year, month, start, end, periodLabel },
      metrics: {
        totalRevenue,
        totalQuantity: totalQty,
        totalOrders: invoices.length,
        activeDealers: activeDealersCount,
        averageDealerSales: activeDealersCount > 0 ? Math.round(totalRevenue / activeDealersCount) : 0,
        target: finalTerritoryTarget,
        creditLimit: finalTerritoryCredit,
        achievementPercent: Number(achievementPercent.toFixed(2)),
      },
      dealers,
      officers,
      products: this.aggregateTopProducts(invoices, totalRevenue),
    };
  }

  /**
   * 5. SALES OFFICER PERFORMANCE (With Assigned Dealers Breakdown)
   */
  async getOfficerPerformance(companyId: string, officerId: string, filter?: PerformanceFilter) {
    const { start, end, year, month, periodLabel, isAllTime } = this.resolveDateRange(filter);
    const baseCondition = this.baseWhere(companyId, start, end, isAllTime);

    const where: any = {
      ...baseCondition,
      OR: [
        { salesOfficerId: officerId },
        { dealer: { assignedFieldOfficerId: officerId } },
        { dealer: { officerAssignments: { some: { userId: officerId } } } },
      ],
    };
    if (filter?.territoryId) {
      where.territoryId = filter.territoryId;
    }

    const compFilter = companyId && companyId.toLowerCase() !== 'all' ? { companyId } : {};

    const [officer, invoices, assignedDealers, assignments, aggregates] = await Promise.all([
      this.prisma.user.findFirst({
        where: { id: officerId },
        select: { id: true, firstName: true, lastName: true, phone: true },
      }),
      this.prisma.salesInvoice.findMany({
        where,
        select: {
          id: true,
          netAmount: true,
          dealerId: true,
          territoryId: true,
          dealer: {
            select: { id: true, code: true, name: true, city: true, annualAgreementTarget: true, monthlySalesTarget: true },
          },
          items: { select: { quantity: true, productName: true, packing: true, netAmount: true, rate: true } },
        },
      }),
      this.prisma.dealer.findMany({
        where: {
          ...compFilter,
          OR: [
            { assignedFieldOfficerId: officerId },
            { officerAssignments: { some: { userId: officerId } } },
            ...(filter?.territoryId ? [{ territoryId: filter.territoryId }] : []),
          ],
        },
        select: { id: true, code: true, name: true, city: true, annualAgreementTarget: true, monthlySalesTarget: true, territoryId: true },
      }),
      this.prisma.userMarketAssignment.findMany({
        where: { userId: officerId, status: 'ACTIVE' },
        include: {
          territory: true,
          zone: true,
          region: true,
        },
      }),
      this.calculateMarketAggregates(companyId),
    ]);

    let totalRevenue = 0;
    let totalQty = 0;
    const dealerMap = new Map<string, { dealer: any; revenue: number; qty: number; orderCount: number }>();

    for (const inv of invoices) {
      const net = Number(inv.netAmount || 0);
      totalRevenue += net;

      const invQty = inv.items.reduce((s, it) => s + Number(it.quantity || 0), 0);
      totalQty += invQty;

      if (!dealerMap.has(inv.dealerId)) {
        dealerMap.set(inv.dealerId, { dealer: inv.dealer, revenue: 0, qty: 0, orderCount: 0 });
      }
      const dData = dealerMap.get(inv.dealerId)!;
      dData.revenue += net;
      dData.qty += invQty;
      dData.orderCount += 1;
    }

    // Include assigned dealers who didn't buy in this period
    for (const ad of assignedDealers) {
      if (!dealerMap.has(ad.id)) {
        dealerMap.set(ad.id, { dealer: ad, revenue: 0, qty: 0, orderCount: 0 });
      }
    }

    const dealers = Array.from(dealerMap.values()).map((d) => {
      const mTarget = Number(d.dealer?.monthlySalesTarget || 0);
      const aTarget = Number(d.dealer?.annualAgreementTarget || 0);
      const monthlyTarget = mTarget > 0 ? mTarget : aTarget > 0 ? Math.round(aTarget / 12) : 0;

      const achievement = monthlyTarget > 0 ? (d.revenue / monthlyTarget) * 100 : 0;

      return {
        dealerId: d.dealer?.id,
        dealerCode: d.dealer?.code,
        dealerName: d.dealer?.name,
        city: d.dealer?.city || '—',
        actualSales: d.revenue,
        monthlyTarget,
        achievementPercent: Number(achievement.toFixed(2)),
        totalQuantity: d.qty,
        ordersCount: d.orderCount,
      };
    });

    const officerTarget = aggregates.userTargetMap.get(officerId) || 0;
    const officerCredit = aggregates.userCreditMap.get(officerId) || 0;
    const achievementPercent = officerTarget > 0 ? (totalRevenue / officerTarget) * 100 : 0;

    const activeDealersCount = dealers.filter((d) => d.actualSales > 0).length;

    // FO Salary Justification Ratio (e.g. 50k monthly FO cost)
    const assumedFoSalaryCost = 50000;
    const salaryRatio = assumedFoSalaryCost > 0 ? (totalRevenue / assumedFoSalaryCost).toFixed(1) : '0';

    return {
      scope: 'OFFICER',
      officer: {
        id: officer?.id || officerId,
        name: officer ? `${officer.firstName} ${officer.lastName}`.trim() : 'Sales Officer',
        phone: officer?.phone,
      },
      period: { year, month, start, end, periodLabel },
      metrics: {
        totalRevenue,
        totalQuantity: totalQty,
        totalOrders: invoices.length,
        activeDealers: activeDealersCount,
        averageDealerSales: activeDealersCount > 0 ? Math.round(totalRevenue / activeDealersCount) : 0,
        target: officerTarget,
        creditLimit: officerCredit,
        achievementPercent: Number(achievementPercent.toFixed(2)),
        salaryJustificationRatio: `${salaryRatio}x`,
      },
      dealers,
      assignments: assignments.map((a) => ({
        id: a.id,
        roleScope: a.roleScope,
        isPrimary: a.isPrimary,
        region: a.region ? { id: a.region.id, name: a.region.name, code: a.region.code } : null,
        zone: a.zone ? { id: a.zone.id, name: a.zone.name, code: a.zone.code } : null,
        territory: a.territory ? { id: a.territory.id, name: a.territory.name, code: a.territory.code } : null,
      })),
      products: this.aggregateTopProducts(invoices, totalRevenue),
    };
  }

  /**
   * 6. DEALER CARD PERFORMANCE (Targets, YTD, Product Breakdown, Credit Status)
   */
  async getDealerCard(companyId: string, dealerId: string, filter?: PerformanceFilter) {
    const { start, end, year, month, periodLabel, isAllTime } = this.resolveDateRange(filter);

    // YTD boundary: January 1 of the selected year
    const ytdStart = new Date(year, 0, 1, 0, 0, 0, 0);

    const compFilter = companyId && companyId.toLowerCase() !== 'all' ? { companyId } : {};

    const dealerInclude = {
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
          userMarketAssignments: {
            where: { status: 'ACTIVE' },
            include: {
              user: { select: { id: true, firstName: true, lastName: true, phone: true } },
            },
          },
        },
      },
      assignedOfficer: {
        select: { id: true, firstName: true, lastName: true, phone: true },
      },
      officerAssignments: {
        include: {
          user: { select: { id: true, firstName: true, lastName: true, phone: true } },
        },
      },
    };

    let dealer = await this.prisma.dealer.findFirst({
      where: { id: dealerId, ...compFilter },
      include: dealerInclude,
    });

    if (!dealer && compFilter.companyId) {
      dealer = await this.prisma.dealer.findFirst({
        where: { id: dealerId },
        include: dealerInclude,
      });
    }

    if (!dealer) throw new NotFoundException('Dealer not found');

    const effectiveCompany = dealer.companyId || companyId || 'ALL';
    const invoiceWhere = this.baseWhere(effectiveCompany, start, end, isAllTime);
    const ytdWhere = this.baseWhere(effectiveCompany, ytdStart, end, false);

    const [periodInvoices, ytdInvoices] = await Promise.all([
      this.prisma.salesInvoice.findMany({
        where: { ...invoiceWhere, dealerId },
        include: {
          items: true,
        },
        orderBy: { invoiceDate: 'desc' },
      }),
      this.prisma.salesInvoice.findMany({
        where: { ...ytdWhere, dealerId },
        select: { netAmount: true },
      }),
    ]);

    const periodActual = periodInvoices.reduce((sum, inv) => sum + Number(inv.netAmount || 0), 0);
    const ytdActual = ytdInvoices.reduce((sum, inv) => sum + Number(inv.netAmount || 0), 0);

    // Check for explicit dealer-level target in SalesTarget table
    const dealerTargetRecord = await this.prisma.salesTarget.findFirst({
      where: {
        level: 'DEALER',
        entityId: dealer.id,
        periodYear: year,
        periodMonth: month,
        status: 'ACTIVE',
      },
    });

    let annualTarget = Number(dealer.annualAgreementTarget || 0);
    let monthlyTarget = Number(dealer.monthlySalesTarget || (dealerTargetRecord ? Number(dealerTargetRecord.targetAmount) : 0));
    if (!monthlyTarget && annualTarget > 0) {
      monthlyTarget = Math.round(annualTarget / 12);
    }
    if (!annualTarget && monthlyTarget > 0) {
      annualTarget = monthlyTarget * 12;
    }

    const remainingAnnualTarget = Math.max(0, annualTarget - ytdActual);
    const monthlyAchievement = monthlyTarget > 0
      ? (periodActual / monthlyTarget) * 100
      : (periodActual > 0 ? 100 : 0);
    const ytdAchievement = annualTarget > 0
      ? (ytdActual / annualTarget) * 100
      : (ytdActual > 0 ? 100 : 0);
    const targetVariance = periodActual - monthlyTarget;

    // Credit controls
    const creditLimit = Number(dealer.creditLimit || 0);
    const currentBalance = Number(dealer.currentBalance || 0);
    const availableCredit = Math.max(0, creditLimit - currentBalance);
    const creditUtilizationPercent = creditLimit > 0 ? Number(((currentBalance / creditLimit) * 100).toFixed(1)) : 0;
    const isCreditLocked = creditLimit > 0 && currentBalance >= creditLimit;

    // Product-level breakdown for selected period
    const productMap = new Map<string, { productName: string; packing: string; quantity: number; sales: number }>();

    for (const inv of periodInvoices) {
      for (const item of inv.items) {
        const pKey = item.finishedProductId || item.productName;
        if (!productMap.has(pKey)) {
          productMap.set(pKey, {
            productName: item.productName,
            packing: item.packing || 'Standard Pack',
            quantity: 0,
            sales: 0,
          });
        }
        const pData = productMap.get(pKey)!;
        pData.quantity += Number(item.quantity || 0);
        pData.sales += Number(item.netAmount || 0);
      }
    }

    const productBreakdown = Array.from(productMap.values()).map((p) => ({
      productName: p.productName,
      packing: p.packing,
      quantitySold: p.quantity,
      salesAmount: p.sales,
      averageUnitPrice: p.quantity > 0 ? Math.round(p.sales / p.quantity) : 0,
      shareOfTotalPercent: periodActual > 0 ? Number(((p.sales / periodActual) * 100).toFixed(1)) : 0,
    }));

    return {
      scope: 'DEALER',
      dealer: {
        id: dealer.id,
        code: dealer.code,
        name: dealer.name,
        city: dealer.city || '—',
        address: dealer.address || '',
        status: dealer.status,
        province: 'Punjab',
        territory: dealer.territory?.name || 'Unassigned',
        territoryCode: dealer.territory?.code || '',
        zone: dealer.territory?.zone?.name || 'Unassigned',
        zoneCode: dealer.territory?.zone?.code || '',
        region: dealer.territory?.zone?.region?.name || 'Unassigned',
        regionCode: dealer.territory?.zone?.region?.code || '',
        hierarchy: {
          province: 'Punjab',
          region: dealer.territory?.zone?.region?.name || '—',
          regionCode: dealer.territory?.zone?.region?.code || '',
          zone: dealer.territory?.zone?.name || '—',
          zoneCode: dealer.territory?.zone?.code || '',
          territory: dealer.territory?.name || '—',
          territoryCode: dealer.territory?.code || '',
          dealer: dealer.name,
          dealerCode: dealer.code,
        },
        assignedOfficer: dealer.assignedOfficer
          ? `${dealer.assignedOfficer.firstName} ${dealer.assignedOfficer.lastName}`.trim()
          : dealer.officerAssignments?.[0]?.user
          ? `${dealer.officerAssignments[0].user.firstName} ${dealer.officerAssignments[0].user.lastName}`.trim()
          : dealer.territory?.salesOfficer
          ? `${dealer.territory.salesOfficer.firstName} ${dealer.territory.salesOfficer.lastName}`.trim()
          : 'Direct / Unassigned',
      },
      period: { year, month, start, end, periodLabel },
      metrics: {
        totalRevenue: periodActual,
        totalQuantity: productBreakdown.reduce((sum, p) => sum + p.quantitySold, 0),
        totalOrders: periodInvoices.length,
        activeDealers: periodActual > 0 ? 1 : 0,
        averageDealerSales: periodActual,
        target: monthlyTarget || annualTarget,
        creditLimit,
        achievementPercent: monthlyTarget > 0 ? Number(monthlyAchievement.toFixed(2)) : (periodActual > 0 ? 100 : 0),
      },
      targets: {
        annualAgreementTarget: annualTarget,
        monthlyTarget,
        monthlyActualSales: periodActual,
        ytdActualSales: ytdActual,
        remainingAnnualTarget,
        monthlyAchievementPercent: Number(monthlyAchievement.toFixed(2)),
        ytdAchievementPercent: Number(ytdAchievement.toFixed(2)),
        targetVariance,
        hasMonthlyTarget: monthlyTarget > 0,
        hasAnnualTarget: annualTarget > 0,
      },
      creditControl: {
        creditLimit,
        currentBalance,
        usedCredit: Math.max(0, currentBalance),
        pendingCredit: availableCredit,
        availableCredit,
        creditUtilizationPercent,
        isCreditLocked,
      },
      salaryJustification: {
        monthlyPostedSales: periodActual,
        assumedOfficerSalaryCost: 50000,
        returnMultiple: periodActual > 0 ? `${(periodActual / 50000).toFixed(1)}x` : '0x',
      },
      products: productBreakdown,
      invoices: periodInvoices.map((inv) => ({
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        invoiceDate: inv.invoiceDate,
        grossAmount: Number(inv.grossAmount),
        discountAmount: Number(inv.discountAmount),
        taxAmount: Number(inv.taxAmount),
        netAmount: Number(inv.netAmount),
        itemsCount: inv.items.length,
      })),
    };
  }

  /**
   * 7. AREA MANAGER PERFORMANCE (Aggregated across supervised zones/territories)
   */
  async getAreaManagerPerformance(companyId: string, managerId: string, filter?: PerformanceFilter) {
    const { start, end, year, month, periodLabel, isAllTime } = this.resolveDateRange(filter);
    const baseCondition = this.baseWhere(companyId, start, end, isAllTime);

    const where: any = {
      ...baseCondition,
      OR: [
        { areaManagerId: managerId },
        { zone: { managerId } },
      ],
    };
    if (filter?.zoneId) where.zoneId = filter.zoneId;
    if (filter?.territoryId) where.territoryId = filter.territoryId;

    const [manager, invoices, zones, aggregates] = await Promise.all([
      this.prisma.user.findFirst({
        where: { id: managerId },
        select: { id: true, firstName: true, lastName: true, phone: true },
      }),
      this.prisma.salesInvoice.findMany({
        where,
        select: {
          id: true,
          netAmount: true,
          dealerId: true,
          zoneId: true,
          territoryId: true,
          territory: { select: { id: true, name: true, code: true } },
          zone: { select: { id: true, name: true, code: true } },
          items: { select: { quantity: true, productName: true, packing: true, netAmount: true, rate: true } },
        },
      }),
      this.prisma.zone.findMany({
        where: { managerId, isActive: true },
        include: {
          territories: true,
        },
      }),
      this.calculateMarketAggregates(companyId),
    ]);

    let totalRevenue = 0;
    let totalQty = 0;
    const activeDealersSet = new Set<string>();

    const terrMap = new Map<string, { territory: any; revenue: number; qty: number; orderCount: number; dealers: Set<string> }>();

    for (const inv of invoices) {
      const net = Number(inv.netAmount || 0);
      totalRevenue += net;
      if (inv.dealerId) activeDealersSet.add(inv.dealerId);

      const invQty = inv.items.reduce((s: number, it: any) => s + Number(it.quantity || 0), 0);
      totalQty += invQty;

      const tId = inv.territoryId || 'OTHER';
      if (!terrMap.has(tId)) {
        terrMap.set(tId, { territory: inv.territory || { id: tId, name: 'Unassigned Territory' }, revenue: 0, qty: 0, orderCount: 0, dealers: new Set() });
      }
      const tData = terrMap.get(tId)!;
      tData.revenue += net;
      tData.qty += invQty;
      tData.orderCount += 1;
      if (inv.dealerId) tData.dealers.add(inv.dealerId);
    }

    const territoryBreakdown = Array.from(terrMap.values()).map((t) => {
      const tAgg = aggregates.territoryMap.get(t.territory.id) || { targetAmount: 0, creditLimit: 0 };
      const target = tAgg.targetAmount;
      const creditLimit = tAgg.creditLimit;
      return {
        territoryId: t.territory.id,
        territoryName: t.territory.name,
        territoryCode: t.territory.code,
        actualSales: t.revenue,
        target,
        creditLimit,
        achievementPercent: target > 0 ? Number(((t.revenue / target) * 100).toFixed(2)) : 0,
        totalQuantity: t.qty,
        ordersCount: t.orderCount,
        activeDealers: t.dealers.size,
      };
    });

    let managerTarget = 0;
    let managerCredit = 0;
    for (const z of zones) {
      const zAgg = aggregates.zoneMap.get(z.id) || { targetAmount: 0, creditLimit: 0 };
      managerTarget += zAgg.targetAmount;
      managerCredit += zAgg.creditLimit;
    }

    return {
      scope: 'AREA_MANAGER',
      manager: {
        id: manager?.id || managerId,
        name: manager ? `${manager.firstName} ${manager.lastName}`.trim() : 'Area Manager',
        phone: manager?.phone,
      },
      period: { year, month, start, end, periodLabel },
      metrics: {
        totalRevenue,
        totalQuantity: totalQty,
        totalOrders: invoices.length,
        activeDealers: activeDealersSet.size,
        averageDealerSales: activeDealersSet.size > 0 ? Math.round(totalRevenue / activeDealersSet.size) : 0,
        target: managerTarget,
        creditLimit: managerCredit,
        achievementPercent: managerTarget > 0 ? Number(((totalRevenue / managerTarget) * 100).toFixed(2)) : 0,
      },
      zones: zones.map((z: any) => ({ id: z.id, name: z.name, code: z.code, territoryCount: z.territories.length })),
      territories: territoryBreakdown,
      products: this.aggregateTopProducts(invoices, totalRevenue),
    };
  }

  /**
   * 8. BUSINESS MANAGER PERFORMANCE (Aggregated across supervised regions/zones)
   */
  async getBusinessManagerPerformance(companyId: string, managerId: string, filter?: PerformanceFilter) {
    const { start, end, year, month, periodLabel, isAllTime } = this.resolveDateRange(filter);
    const baseCondition = this.baseWhere(companyId, start, end, isAllTime);

    const where: any = {
      ...baseCondition,
      OR: [
        { businessManagerId: managerId },
        { region: { managerId } },
      ],
    };
    if (filter?.regionId) where.regionId = filter.regionId;
    if (filter?.zoneId) where.zoneId = filter.zoneId;

    const [manager, invoices, regions, aggregates] = await Promise.all([
      this.prisma.user.findFirst({
        where: { id: managerId },
        select: { id: true, firstName: true, lastName: true, phone: true },
      }),
      this.prisma.salesInvoice.findMany({
        where,
        select: {
          id: true,
          netAmount: true,
          dealerId: true,
          regionId: true,
          zoneId: true,
          zone: { select: { id: true, name: true, code: true } },
          region: { select: { id: true, name: true, code: true } },
          items: { select: { quantity: true, productName: true, packing: true, netAmount: true, rate: true } },
        },
      }),
      this.prisma.region.findMany({
        where: { managerId, isActive: true },
        include: {
          zones: true,
        },
      }),
      this.calculateMarketAggregates(companyId),
    ]);

    let totalRevenue = 0;
    let totalQty = 0;
    const activeDealersSet = new Set<string>();

    const zoneMap = new Map<string, { zone: any; revenue: number; qty: number; orderCount: number; dealers: Set<string> }>();

    for (const inv of invoices) {
      const net = Number(inv.netAmount || 0);
      totalRevenue += net;
      if (inv.dealerId) activeDealersSet.add(inv.dealerId);

      const invQty = inv.items.reduce((s: number, it: any) => s + Number(it.quantity || 0), 0);
      totalQty += invQty;

      const zId = inv.zoneId || 'OTHER';
      if (!zoneMap.has(zId)) {
        zoneMap.set(zId, { zone: inv.zone || { id: zId, name: 'Unassigned Zone' }, revenue: 0, qty: 0, orderCount: 0, dealers: new Set() });
      }
      const zData = zoneMap.get(zId)!;
      zData.revenue += net;
      zData.qty += invQty;
      zData.orderCount += 1;
      if (inv.dealerId) zData.dealers.add(inv.dealerId);
    }

    const zoneBreakdown = Array.from(zoneMap.values()).map((z) => {
      const zAgg = aggregates.zoneMap.get(z.zone.id) || { targetAmount: 0, creditLimit: 0 };
      const target = zAgg.targetAmount;
      const creditLimit = zAgg.creditLimit;
      return {
        zoneId: z.zone.id,
        zoneName: z.zone.name,
        zoneCode: z.zone.code,
        actualSales: z.revenue,
        target,
        creditLimit,
        achievementPercent: target > 0 ? Number(((z.revenue / target) * 100).toFixed(2)) : 0,
        totalQuantity: z.qty,
        ordersCount: z.orderCount,
        activeDealers: z.dealers.size,
      };
    });

    let bmTarget = 0;
    let bmCredit = 0;
    for (const r of regions) {
      const rAgg = aggregates.regionMap.get(r.id) || { targetAmount: 0, creditLimit: 0 };
      bmTarget += rAgg.targetAmount;
      bmCredit += rAgg.creditLimit;
    }

    return {
      scope: 'BUSINESS_MANAGER',
      manager: {
        id: manager?.id || managerId,
        name: manager ? `${manager.firstName} ${manager.lastName}`.trim() : 'Business Manager',
        phone: manager?.phone,
      },
      period: { year, month, start, end, periodLabel },
      metrics: {
        totalRevenue,
        totalQuantity: totalQty,
        totalOrders: invoices.length,
        activeDealers: activeDealersSet.size,
        averageDealerSales: activeDealersSet.size > 0 ? Math.round(totalRevenue / activeDealersSet.size) : 0,
        target: bmTarget,
        creditLimit: bmCredit,
        achievementPercent: bmTarget > 0 ? Number(((totalRevenue / bmTarget) * 100).toFixed(2)) : 0,
      },
      regions: regions.map((r: any) => ({ id: r.id, name: r.name, code: r.code, zoneCount: r.zones?.length || 0 })),
      zones: zoneBreakdown,
      products: this.aggregateTopProducts(invoices, totalRevenue),
    };
  }
}
