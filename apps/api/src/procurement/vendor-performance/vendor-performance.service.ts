/**
 * SHEHSWAR ONE360 - Vendor Performance & Scorecard Service
 *
 * Tracks empirical supplier metrics:
 * - On-time delivery rate
 * - Material rejection rate
 * - Average lead days
 * - Rating scorecards (1.0 to 5.0)
 */
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { AuditService } from '../../platform/audit/audit.service';
import { uuidv7 } from '@shehswar/shared';
import {
  VendorPerformanceDto,
  PurchaseOrderStatus,
  Resource,
  Action,
  AuthUser,
} from '@shehswar/types';

@Injectable()
export class VendorPerformanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Get vendor performance scorecard
   */
  async getPerformance(vendorId: string, companyId: string): Promise<VendorPerformanceDto> {
    let performance = await this.prisma.vendorPerformance.findUnique({
      where: {
        vendorId_companyId: { vendorId, companyId },
      },
    });

    if (!performance) {
      // Calculate initial performance
      performance = await this.recalculatePerformance(vendorId, companyId);
    }

    return {
      vendorId: performance.vendorId,
      companyId: performance.companyId,
      totalOrders: performance.totalOrders,
      completedOrders: performance.completedOrders,
      onTimeDeliveryRate: Number(performance.onTimeDeliveryRate),
      rejectionRate: Number(performance.rejectionRate),
      averageLeadDays: Number(performance.averageLeadDays),
      overallRating: Number(performance.overallRating),
      lastEvaluatedAt: performance.lastEvaluatedAt.toISOString(),
      evaluationNotes: performance.evaluationNotes ?? undefined,
    };
  }

  /**
   * Recalculates empirical vendor scorecard from transaction history
   */
  async recalculatePerformance(vendorId: string, companyId: string, actor?: AuthUser) {
    // 1. Fetch vendor's orders and receipts
    const [orders, receipts] = await Promise.all([
      this.prisma.purchaseOrder.findMany({
        where: { vendorId, companyId, deletedAt: null },
      }),
      this.prisma.goodsReceiptNote.findMany({
        where: { vendorId, companyId, deletedAt: null },
        include: { items: true, purchaseOrder: true },
      }),
    ]);

    const totalOrders = orders.length;
    const completedOrders = orders.filter(
      (o) => o.status === PurchaseOrderStatus.COMPLETED,
    ).length;

    // 2. Compute on-time delivery
    let onTimeCount = 0;
    let evaluatedDeliveries = 0;
    let totalLeadDays = 0;

    receipts.forEach((grn) => {
      if (grn.purchaseOrder?.expectedDeliveryDate) {
        evaluatedDeliveries++;
        const received = new Date(grn.receivedDate).getTime();
        const expected = new Date(grn.purchaseOrder.expectedDeliveryDate).getTime();
        const poCreated = new Date(grn.purchaseOrder.createdAt).getTime();

        const leadDays = Math.max(1, Math.round((received - poCreated) / (1000 * 60 * 60 * 24)));
        totalLeadDays += leadDays;

        if (received <= expected + 86400000) {
          // within 1-day grace
          onTimeCount++;
        }
      }
    });

    const onTimeDeliveryRate =
      evaluatedDeliveries > 0 ? (onTimeCount / evaluatedDeliveries) * 100 : 100.0;
    const averageLeadDays =
      evaluatedDeliveries > 0 ? totalLeadDays / evaluatedDeliveries : 7.0;

    // 3. Compute material rejection rate from GRN items
    let totalReceivedUnits = 0;
    let totalRejectedUnits = 0;

    receipts.forEach((grn) => {
      grn.items.forEach((item) => {
        totalReceivedUnits += Number(item.receivedQuantity);
        totalRejectedUnits += Number(item.rejectedQuantity);
      });
    });

    const rejectionRate =
      totalReceivedUnits > 0 ? (totalRejectedUnits / totalReceivedUnits) * 100 : 0.0;

    // 4. Compute composite overall rating (1.0 to 5.0)
    // Formula: Delivery Weight 50%, Quality Weight 50%
    const deliveryScore = (onTimeDeliveryRate / 100) * 2.5;
    const qualityScore = Math.max(0, (1 - rejectionRate / 100)) * 2.5;
    const rawRating = Math.min(5.0, Math.max(1.0, deliveryScore + qualityScore));
    const overallRating = Math.round(rawRating * 100) / 100;

    const performance = await this.prisma.vendorPerformance.upsert({
      where: {
        vendorId_companyId: { vendorId, companyId },
      },
      update: {
        totalOrders,
        completedOrders,
        onTimeDeliveryRate,
        rejectionRate,
        averageLeadDays,
        overallRating,
        lastEvaluatedAt: new Date(),
        evaluationNotes: `Evaluated across ${totalOrders} orders and ${receipts.length} receipts.`,
      },
      create: {
        id: uuidv7(),
        vendorId,
        companyId,
        totalOrders,
        completedOrders,
        onTimeDeliveryRate,
        rejectionRate,
        averageLeadDays,
        overallRating,
        lastEvaluatedAt: new Date(),
        evaluationNotes: `Initial evaluation generated across ${totalOrders} orders.`,
      },
    });

    // Update vendor table overall rating cache
    await this.prisma.vendor.update({
      where: { id: vendorId },
      data: { rating: overallRating },
    });

    // Record audit log
    const vendor = await this.prisma.vendor.findUnique({
      where: { id: vendorId },
      select: { organizationId: true },
    });

    if (vendor) {
      await this.auditService.record({
        organizationId: vendor.organizationId,
        companyId,
        actorId: actor?.id || '00000000-0000-0000-0000-000000000000',
        actorEmail: actor?.email || 'system@shehswar.com',
        resource: Resource.VENDOR_PERFORMANCE,
        resourceId: performance.id,
        action: Action.OVERRIDE,
        newState: {
          vendorId,
          totalOrders,
          completedOrders,
          onTimeDeliveryRate,
          rejectionRate,
          averageLeadDays,
          overallRating,
        },
        correlationId: uuidv7(),
      });
    }

    return performance;
  }

  /**
   * List all supplier scorecards
   */
  async listScorecards(companyId?: string) {
    const where: any = {};
    if (companyId) where.companyId = companyId;

    const items = await this.prisma.vendorPerformance.findMany({
      where,
      include: {
        vendor: {
          select: {
            id: true,
            code: true,
            name: true,
            vendorType: true,
            status: true,
            paymentTerms: true,
          },
        },
        company: {
          select: { id: true, code: true, name: true },
        },
      },
      orderBy: { overallRating: 'desc' },
    });

    return items;
  }
}
