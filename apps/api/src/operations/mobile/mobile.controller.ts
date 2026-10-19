/**
 * SHEHSWAR ONE360 - Sales Officer Mobile App API Controller
 * 
 * Authoritative mobile endpoints matching canonical specification:
 *  - Mobile Auth: POST /api/mobile/auth/login, GET /api/mobile/auth/me
 *  - Sales Officer: GET /api/mobile/sales-officer/dealers
 *  - Dealer Info: GET /api/mobile/dealers/:id/balance, GET /api/mobile/dealers/:id/ledger
 *  - Sales Orders: POST /api/mobile/sales-orders, GET /api/mobile/sales-orders
 *  - Pricing Schemes: GET /api/mobile/pricing/schemes
 *  - Dealer Payments: POST /api/mobile/dealer-payments
 *  - Catalog: GET /api/mobile/products
 * 
 * Rules:
 *  - Database is the sole source of truth.
 *  - Server-authoritative price resolution (mobile client prices are NEVER trusted blindly).
 *  - Only active published schemes with isMobileVisible = true are presented.
 */
import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../../core/guards/jwt-auth.guard';
import { Public } from '../../core/decorators/public.decorator';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { AuthService } from '../../platform/auth/auth.service';
import { LoginDto } from '../../platform/auth/dto/login.dto';
import { SalesService } from '../sales/sales.service';
import { DealerLedgerService } from '../ledger/dealer-ledger.service';
import { PricingService } from '../pricing/pricing.service';
import { ProvisionalReceiptsService } from '../provisional-receipts/provisional-receipts.service';
import { PrismaService } from '../../core/database/prisma.service';
import { AuthUser, CreateSalesOrderDto } from '@shehswar/types';

@Controller('api/mobile')
export class MobileController {
  constructor(
    private readonly authService: AuthService,
    private readonly salesService: SalesService,
    private readonly dealerLedgerService: DealerLedgerService,
    private readonly pricingService: PricingService,
    private readonly provisionalReceiptsService: ProvisionalReceiptsService,
    private readonly prisma: PrismaService,
  ) {}

  // ============================
  // 1. MOBILE AUTH & USER CONTEXT (REQUIREMENT 27)
  // ============================

  @Public()
  @Post('auth/login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto, @Req() req: Request) {
    const ipAddress = req.ip || (req.headers['x-forwarded-for'] as string);
    const userAgent = req.headers['user-agent'] || 'ShehswarMobile/1.0';
    return this.authService.login(dto, { ipAddress, userAgent });
  }

  @UseGuards(JwtAuthGuard)
  @Get('auth/me')
  async me(@CurrentUser() user: AuthUser) {
    const profile = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        companyId: true,
        organizationId: true,
        userRoles: {
          include: {
            role: { select: { id: true, code: true, name: true } },
          },
        },
        marketAssignments: {
          where: { status: 'ACTIVE' },
          include: {
            territory: { select: { id: true, code: true, name: true } },
            zone: { select: { id: true, code: true, name: true } },
            region: { select: { id: true, code: true, name: true } },
          },
        },
        company: { select: { id: true, name: true, code: true } },
        organization: { select: { id: true, name: true } },
      },
    });

    // Derive market hierarchy snapshot
    const activeAssignments = (profile?.marketAssignments as any[]) || [];
    const territories = activeAssignments.map((a: any) => a.territory).filter(Boolean);
    const zones = activeAssignments.map((a: any) => a.zone).filter(Boolean);
    const regions = activeAssignments.map((a: any) => a.region).filter(Boolean);

    return {
      ...profile,
      roles: ((profile?.userRoles as any[]) || []).map((r: any) => r.role.code),
      marketContext: {
        territories,
        zones,
        regions,
      },
    };
  }

  // ============================
  // 2. AUTHORIZED DEALERS API (REQUIREMENT 28)
  // ============================

  @UseGuards(JwtAuthGuard)
  @Get('sales-officer/dealers')
  async getOfficerDealers(@CurrentUser() user: AuthUser) {
    const result = await this.salesService.findAllDealers(
      user.companyId,
      { salesOfficerId: user.id },
      user,
    );

    return (result.data || []).map((dealer: any) => {
      const creditLimit = Number(dealer.creditLimit || 0);
      const currentOutstanding = Number(dealer.currentBalance || 0);
      const availableCredit = Math.max(0, creditLimit - currentOutstanding);

      return {
        id: dealer.id,
        code: dealer.code,
        name: dealer.name,
        businessName: dealer.businessName,
        phone: dealer.phone,
        city: dealer.city,
        creditLimit,
        currentOutstanding,
        availableCredit,
        region: dealer.territory?.zone?.region?.name || null,
        zone: dealer.territory?.zone?.name || null,
        territory: dealer.territory?.name || null,
        responsibleSalesOfficer: dealer.assignedOfficer
          ? `${dealer.assignedOfficer.firstName} ${dealer.assignedOfficer.lastName}`
          : null,
      };
    });
  }

  // ============================
  // 3. DEALER BALANCE & LEDGER
  // ============================

  @UseGuards(JwtAuthGuard)
  @Get('dealers/:id/balance')
  async getDealerBalance(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.dealerLedgerService.getDealerBalance(id, user.companyId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('dealers/:id/ledger')
  async getDealerLedger(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.dealerLedgerService.getDealerLedger(id, user.companyId, {
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }

  // ============================
  // 4. MOBILE PUBLISHED SCHEMES (REQUIREMENT 24)
  // ============================

  @UseGuards(JwtAuthGuard)
  @Get('pricing/schemes')
  async getMobileVisibleSchemes(@CurrentUser() user: AuthUser) {
    return this.pricingService.getPricingSchemes(user.companyId, {
      status: 'ACTIVE',
      isMobileVisible: true,
    });
  }

  // ============================
  // 5. SALES ORDERS (SERVER-AUTHORITATIVE PRICING) (REQUIREMENTS 25, 29, 30, 31)
  // ============================

  @UseGuards(JwtAuthGuard)
  @Post('sales-orders')
  async createSalesOrder(
    @Body() dto: CreateSalesOrderDto,
    @CurrentUser() user: AuthUser,
  ) {
    // Force salesOfficerId to the authenticated mobile user and let backend calculate authoritative rates
    const orderDto: CreateSalesOrderDto = {
      ...dto,
      salesOfficerId: user.id,
      companyId: user.companyId,
      organizationId: user.organizationId,
    };

    const order = await this.salesService.createOrder(orderDto, user);

    // Format authoritative mobile response per Requirement 30
    const dealerInfo = await this.prisma.dealer.findUnique({
      where: { id: order.dealerId },
      select: { creditLimit: true, currentBalance: true },
    });
    const creditLimit = Number(dealerInfo?.creditLimit || 0);
    const currentBalance = Number(dealerInfo?.currentBalance || 0);
    const availableCredit = Math.max(0, creditLimit - currentBalance);

    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      dealer: {
        id: order.dealer?.id,
        code: order.dealer?.code,
        name: order.dealer?.name,
      },
      salesOfficer: order.salesOfficer
        ? `${order.salesOfficer.firstName} ${order.salesOfficer.lastName}`
        : `${user.firstName || ''} ${user.lastName || ''}`.trim(),
      paymentTerm: order.paymentTerm || 'CASH',
      requestedCondition: order.commercialCondition || null,
      appliedScheme: order.appliedSchemeName || order.scheme?.name || 'Standard',
      products: (order.items || []).map((item: any) => ({
        finishedProductId: item.finishedProductId,
        productName: item.productName,
        packing: item.packing,
        quantity: item.quantity,
        baseRate: item.baseRate,
        resolvedRate: item.unitPrice,
        discountAmount: item.discountAmount,
        freeQuantity: item.freeQuantity || 0,
        totalAmount: item.totalPrice,
      })),
      totalDiscount: order.discountAmount || 0,
      totalFreeQuantity: order.freeQuantityTotal || 0,
      finalAmount: order.totalAmount,
      approvalRequired: order.status === 'PENDING',
      creditStatus: {
        creditLimit,
        currentBalance,
        availableCredit,
      },
      createdAt: order.createdAt,
    };
  }

  @UseGuards(JwtAuthGuard)
  @Get('sales-orders')
  async getSalesOrders(
    @CurrentUser() user: AuthUser,
    @Query('dealerId') dealerId?: string,
    @Query('status') status?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.salesService.findAllOrders(
      user.companyId,
      {
        salesOfficerId: user.id,
        dealerId,
        status,
        limit: limit ? parseInt(limit, 10) : undefined,
        offset: offset ? parseInt(offset, 10) : undefined,
      },
      user,
    );
  }

  // ============================
  // 6. DEALER PAYMENT RECEIPTS
  // ============================

  @UseGuards(JwtAuthGuard)
  @Post('dealer-payments')
  async createDealerPayment(
    @Body() dto: any,
    @CurrentUser() user: AuthUser,
  ) {
    return this.salesService.createDealerPayment(dto, user);
  }

  /**
   * Field Collection / Provisional Receipt (PR) Submission from Mobile App
   * Records payment collection from field; creates PR in PENDING_ALLOCATION state.
   * Authoritative: Credit is NOT released until ERP approval/posting.
   */
  @UseGuards(JwtAuthGuard)
  @Post('collections/pr')
  async submitMobileCollection(
    @Body() dto: {
      dealerId?: string;
      amount: number;
      paymentMethod: 'CASH' | 'CHEQUE' | 'DD' | 'ONLINE' | 'OTHER';
      referenceNumber?: string;
      bankName?: string;
      receiptDate?: string;
      remarks?: string;
      attachmentUrl?: string;
    },
    @CurrentUser() user: AuthUser,
  ) {
    const prNumber = `PR-MOB-${Date.now().toString().slice(-6)}`;
    const dealer = dto.dealerId
      ? await this.prisma.dealer.findUnique({
          where: { id: dto.dealerId },
          include: { territory: { include: { zone: true } } },
        })
      : null;

    return this.provisionalReceiptsService.createProvisionalReceipt(
      user.organizationId,
      {
        companyId: user.companyId,
        prNumber,
        receiptDate: dto.receiptDate || new Date(),
        receivedFrom: dealer?.name || `${user.firstName} ${user.lastName}`,
        partyDealerId: dto.dealerId || undefined,
        partyCode: dealer?.code || undefined,
        salesOfficerId: user.id,
        regionId: dealer?.territory?.zone?.regionId || undefined,
        territoryId: dealer?.territoryId || undefined,
        paymentMethod: dto.paymentMethod,
        paymentReferenceNumber: dto.referenceNumber,
        bankName: dto.bankName,
        totalAmount: Number(dto.amount),
        remarks: dto.remarks ? `[Mobile Submission] ${dto.remarks}` : '[Mobile Field Collection]',
        attachmentUrl: dto.attachmentUrl,
        autoPost: false, // Authoritative rule: Pending ERP approval/post
      },
      user.id,
    );
  }

  // ============================
  // 7. PRODUCT CATALOG & REAL-TIME STOCK (REQUIREMENT 26)
  // ============================

  @UseGuards(JwtAuthGuard)
  @Get('products')
  async getProductsCatalog(@CurrentUser() user: AuthUser) {
    return this.salesService.getProductsForSale(user.companyId);
  }
}
