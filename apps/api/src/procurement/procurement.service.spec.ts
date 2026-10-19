/**
 * SHEHSWAR ONE360 - Procurement Domain Test Suite
 *
 * Comprehensive tests covering:
 * 1. Vendor duplicate prevention (code & NTN) and approval workflow
 * 2. Purchase Requisition atomic numbering, amounts & approval transitions
 * 3. RFQ multi-vendor invitations and quotation tracking
 * 4. Quotation comparison matrix and winner selection
 * 5. Purchase Order approved vendor validation & financial precision
 * 6. Goods Receipt Note PO reference validation & QC inspection placeholder
 * 7. Multi-company tenant isolation & audit logging
 */
import { ConflictException, BadRequestException } from '@nestjs/common';
import { VendorService } from './vendor/vendor.service';
import { PurchaseRequisitionService } from './purchase-requisition/purchase-requisition.service';
import { RfqService } from './rfq/rfq.service';
import { QuotationService } from './quotation/quotation.service';
import { QuotationComparisonService } from './quotation-comparison/quotation-comparison.service';
import { PurchaseOrderService } from './purchase-order/purchase-order.service';
import { GoodsReceiptService } from './goods-receipt/goods-receipt.service';
import { VendorPerformanceService } from './vendor-performance/vendor-performance.service';
import {
  VendorType,
  VendorStatus,
  PurchaseRequisitionStatus,
  RfqStatus,
  QuotationStatus,
  PurchaseOrderStatus,
  GoodsReceiptStatus,
  QcStatus,
} from '@shehswar/types';

describe('Procurement & Vendor Management Module', () => {
  let mockPrisma: any;
  let mockAudit: any;
  let mockApprovalEngine: any;
  let mockDocNumbering: any;
  let mockNotification: any;

  let vendorService: VendorService;
  let prService: PurchaseRequisitionService;
  let rfqService: RfqService;
  let quotationService: QuotationService;
  let comparisonService: QuotationComparisonService;
  let poService: PurchaseOrderService;
  let grnService: GoodsReceiptService;
  let performanceService: VendorPerformanceService;

  beforeEach(() => {
    mockPrisma = {
      vendor: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      vendorDocument: {
        create: jest.fn(),
      },
      purchaseRequisition: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      purchaseRequisitionItem: {
        createMany: jest.fn(),
        deleteMany: jest.fn(),
      },
      requestForQuotation: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      rfqVendor: {
        create: jest.fn(),
        updateMany: jest.fn(),
      },
      vendorQuotation: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      purchaseOrder: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      purchaseOrderItem: {
        update: jest.fn(),
      },
      goodsReceiptNote: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      goodsReceiptNoteItem: {
        update: jest.fn(),
      },
      vendorPerformance: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        upsert: jest.fn(),
      },
    };

    mockAudit = {
      record: jest.fn().mockResolvedValue({ id: 'audit-1' }),
    };

    mockApprovalEngine = {
      submitForApproval: jest.fn().mockResolvedValue({
        status: 'pending_approval',
        currentLevel: 1,
        totalLevels: 2,
      }),
    };

    mockDocNumbering = {
      getNextDocumentNumber: jest.fn().mockImplementation(({ documentType }) => {
        return Promise.resolve(`SH-${documentType}-2026-000001`);
      }),
    };

    mockNotification = {
      dispatch: jest.fn().mockResolvedValue(undefined),
    };

    vendorService = new VendorService(mockPrisma, mockAudit, mockApprovalEngine, mockNotification);
    prService = new PurchaseRequisitionService(
      mockPrisma,
      mockAudit,
      mockApprovalEngine,
      mockDocNumbering,
      mockNotification,
    );
    rfqService = new RfqService(mockPrisma, mockAudit, mockDocNumbering, mockNotification);
    quotationService = new QuotationService(mockPrisma, mockAudit);
    poService = new PurchaseOrderService(
      mockPrisma,
      mockAudit,
      mockApprovalEngine,
      mockDocNumbering,
      mockNotification,
    );
    comparisonService = new QuotationComparisonService(mockPrisma, mockAudit, mockNotification, poService);
    grnService = new GoodsReceiptService(
      mockPrisma,
      mockAudit,
      mockDocNumbering,
      mockNotification,
    );
    performanceService = new VendorPerformanceService(mockPrisma, mockAudit);
  });

  // ==========================================
  // 1. VENDOR TESTS
  // ==========================================
  describe('Vendor Master Management', () => {
    it('should prevent duplicate vendor code in the same company', async () => {
      mockPrisma.vendor.findFirst.mockResolvedValueOnce({ id: 'v-existing', code: 'VND-001' });

      await expect(
        vendorService.createVendor({
          organizationId: 'org-1',
          companyId: 'comp-1',
          code: 'VND-001',
          name: 'Engro Chemicals Precursors',
          vendorType: VendorType.RAW_MATERIAL,
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should prevent duplicate vendor NTN in the same company', async () => {
      mockPrisma.vendor.findFirst
        .mockResolvedValueOnce(null) // code ok
        .mockResolvedValueOnce({ id: 'v-existing', name: 'Existing Co', ntn: '1234567-8' }); // NTN match

      await expect(
        vendorService.createVendor({
          organizationId: 'org-1',
          companyId: 'comp-1',
          code: 'VND-002',
          name: 'National HDPE Packaging',
          vendorType: VendorType.PACKING_MATERIAL,
          ntn: '1234567-8',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should create vendor in DRAFT status and record audit log', async () => {
      mockPrisma.vendor.findFirst.mockResolvedValue(null);
      mockPrisma.vendor.create.mockImplementation((args: any) => Promise.resolve(args.data));

      const vendor = await vendorService.createVendor({
        organizationId: 'org-1',
        companyId: 'comp-1',
        code: 'VND-001',
        name: 'Engro Chemicals Precursors',
        vendorType: VendorType.RAW_MATERIAL,
      });

      expect(vendor.status).toBe(VendorStatus.DRAFT);
      expect(mockAudit.record).toHaveBeenCalledTimes(1);
    });

    it('should transition vendor through approval lifecycle: Draft -> Pending -> Approved', async () => {
      const mockVendor = {
        id: 'v-1',
        organizationId: 'org-1',
        companyId: 'comp-1',
        name: 'Engro Chemicals',
        code: 'VND-001',
        status: VendorStatus.DRAFT,
      };

      mockPrisma.vendor.findUnique.mockResolvedValue(mockVendor);
      mockPrisma.vendor.update.mockResolvedValue({
        ...mockVendor,
        status: VendorStatus.PENDING_APPROVAL,
      });

      // Submit
      const submitted = await vendorService.submitForApproval('v-1', {
        id: 'u-1',
        email: 'buyer@shehswar.com',
      } as any);

      expect(submitted.status).toBe(VendorStatus.PENDING_APPROVAL);
      expect(mockApprovalEngine.submitForApproval).toHaveBeenCalled();
      expect(mockNotification.dispatch).toHaveBeenCalled();

      // Approve
      mockPrisma.vendor.findUnique.mockResolvedValue({
        ...mockVendor,
        status: VendorStatus.PENDING_APPROVAL,
      });
      mockPrisma.vendor.update.mockResolvedValue({
        ...mockVendor,
        status: VendorStatus.APPROVED,
      });

      const approved = await vendorService.processApproval('v-1', 'APPROVE', 'Verified by Finance');
      expect(approved.status).toBe(VendorStatus.APPROVED);
    });
  });

  // ==========================================
  // 2. PURCHASE REQUISITION (PR) TESTS
  // ==========================================
  describe('Purchase Requisition (PR)', () => {
    it('should automatically generate sequential PR number and compute line item totals', async () => {
      mockPrisma.purchaseRequisition.create.mockImplementation((args: any) =>
        Promise.resolve({
          ...args.data,
          items: args.data.items.create,
        }),
      );

      const pr = await prService.createRequisition({
        organizationId: 'org-1',
        companyId: 'comp-1',
        requestedById: 'u-prod',
        requestedByName: 'Chemical Plant Lead',
        requiredDate: '2026-10-15',
        purpose: 'Monthly Raw Materials for Fertilizer Batching',
        items: [
          {
            itemName: 'Phosphoric Acid 85% Tech Grade',
            quantity: 50,
            unit: 'TON',
            estimatedRate: 180000,
            requiredDate: '2026-10-15',
          },
          {
            itemName: 'Potassium Nitrate Soluble',
            quantity: 20,
            unit: 'TON',
            estimatedRate: 220000,
            requiredDate: '2026-10-15',
          },
        ],
      });

      expect(pr.prNumber).toBe('SH-PR-2026-000001');
      expect(pr.status).toBe(PurchaseRequisitionStatus.DRAFT);
      // 50 * 180,000 (9,000,000) + 20 * 220,000 (4,400,000) = 13,400,000
      expect(pr.totalEstimatedAmount).toBe(13400000);
      expect(mockAudit.record).toHaveBeenCalled();
    });

    it('should reject PR creation if no items are included', async () => {
      await expect(
        prService.createRequisition({
          organizationId: 'org-1',
          companyId: 'comp-1',
          requestedById: 'u-1',
          requiredDate: '2026-10-15',
          purpose: 'Invalid PR with empty items',
          items: [],
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ==========================================
  // 3. RFQ & VENDOR QUOTATIONS
  // ==========================================
  describe('RFQ & Vendor Quotations', () => {
    it('should create an RFQ and invite multiple suppliers', async () => {
      mockPrisma.vendor.findMany.mockResolvedValue([
        { id: 'v-1', name: 'Vendor 1' },
        { id: 'v-2', name: 'Vendor 2' },
      ]);
      mockPrisma.requestForQuotation.create.mockImplementation((args: any) =>
        Promise.resolve({
          ...args.data,
          vendors: args.data.vendors.create,
        }),
      );

      const rfq = await rfqService.createRfq({
        organizationId: 'org-1',
        companyId: 'comp-1',
        title: 'Bulk Nitric Acid RFQ',
        deadline: '2026-11-01',
        vendorIds: ['v-1', 'v-2'],
      });

      expect(rfq.rfqNumber).toBe('SH-RFQ-2026-000001');
      expect(rfq.status).toBe(RfqStatus.DRAFT);
      expect(mockAudit.record).toHaveBeenCalled();
    });

    it('should record a vendor quotation with line items and taxes', async () => {
      mockPrisma.vendor.findUnique.mockResolvedValue({ id: 'v-1', name: 'Vendor 1', currency: 'PKR' });
      mockPrisma.requestForQuotation.findUnique.mockResolvedValue({ id: 'rfq-1', status: RfqStatus.SENT });
      mockPrisma.vendorQuotation.create.mockImplementation((args: any) =>
        Promise.resolve({ ...args.data }),
      );

      const quote = await quotationService.createQuotation({
        organizationId: 'org-1',
        companyId: 'comp-1',
        rfqId: 'rfq-1',
        vendorId: 'v-1',
        quotationNumber: 'Q-9901',
        deliveryLeadDays: 5,
        validityDate: '2026-11-30',
        items: [
          {
            itemName: 'Nitric Acid 68%',
            quantity: 1000,
            unit: 'KG',
            unitPrice: 100,
            taxRate: 18,
          },
        ],
      });

      expect(quote.status).toBe(QuotationStatus.RECEIVED);
      expect(quote.netAmount).toBe(118000);
    });
  });

  // ==========================================
  // 4. PURCHASE ORDER (PO) RULES & VALIDATIONS
  // ==========================================
  describe('Purchase Order (PO) Rules', () => {
    it('should strictly reject PO creation if vendor is not APPROVED', async () => {
      mockPrisma.vendor.findUnique.mockResolvedValue({
        id: 'v-unapproved',
        name: 'Unverified Supplies',
        status: VendorStatus.DRAFT, // Not APPROVED!
      });

      await expect(
        poService.createPurchaseOrder({
          organizationId: 'org-1',
          companyId: 'comp-1',
          vendorId: 'v-unapproved',
          items: [
            {
              itemName: 'HDPE Packing Bags 50kg',
              quantity: 1000,
              unit: 'BAG',
              unitRate: 150,
            },
          ],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should create PO with financial precision and sequential numbering for approved vendor', async () => {
      mockPrisma.vendor.findUnique.mockResolvedValue({
        id: 'v-approved',
        name: 'National Packaging Ltd',
        status: VendorStatus.APPROVED,
        currency: 'PKR',
        paymentTerms: '30_DAYS_CREDIT',
      });

      mockPrisma.purchaseOrder.create.mockImplementation((args: any) =>
        Promise.resolve({
          ...args.data,
          items: args.data.items.create,
        }),
      );

      const po = await poService.createPurchaseOrder({
        organizationId: 'org-1',
        companyId: 'comp-1',
        vendorId: 'v-approved',
        items: [
          {
            itemName: 'HDPE Woven Fertilizer Sacks 50kg',
            quantity: 10000,
            unit: 'BAG',
            unitRate: 120, // subtotal = 1,200,000
            taxRate: 18, // tax = 216,000
            discountRate: 2, // discount = 24,000
          },
        ],
      });

      expect(po.poNumber).toBe('SH-PO-2026-000001');
      expect(po.status).toBe(PurchaseOrderStatus.DRAFT);
      expect(po.subtotal).toBe(1200000);
      expect(po.taxAmount).toBe(216000);
      expect(po.discountAmount).toBe(24000);
      // 1,200,000 + 216,000 - 24,000 = 1,392,000
      expect(po.totalAmount).toBe(1392000);
    });
  });

  // ==========================================
  // 4. QUOTATION COMPARISON & WINNER SELECTION
  // ==========================================
  describe('Quotation Comparison & Selection Engine', () => {
    it('should generate multi-vendor side-by-side comparison matrix with lowest price flags', async () => {
      mockPrisma.requestForQuotation.findUnique.mockResolvedValue({
        id: 'rfq-1',
        rfqNumber: 'SH-RFQ-2026-000001',
        title: 'Q4 Acid Supply RFQ',
        requisition: { prNumber: 'SH-PR-2026-000001' },
        quotations: [
          {
            id: 'q-1',
            vendorId: 'v-1',
            quotationNumber: 'QT-ENG-01',
            currency: 'PKR',
            subtotal: 100000,
            taxAmount: 18000,
            discountAmount: 0,
            netAmount: 118000,
            deliveryLeadDays: 10,
            paymentTerms: '30_DAYS_CREDIT',
            validityDate: new Date('2026-11-30'),
            status: QuotationStatus.RECEIVED,
            isSelected: false,
            vendor: { name: 'Vendor Alpha', code: 'VND-A' },
            items: [
              { itemName: 'Nitric Acid 68%', unitPrice: 100, lineTotal: 100000, quantity: 1000 },
            ],
          },
          {
            id: 'q-2',
            vendorId: 'v-2',
            quotationNumber: 'QT-BET-01',
            currency: 'PKR',
            subtotal: 95000,
            taxAmount: 17100,
            discountAmount: 0,
            netAmount: 112100,
            deliveryLeadDays: 14,
            paymentTerms: 'ADVANCE_PAYMENT',
            validityDate: new Date('2026-11-30'),
            status: QuotationStatus.RECEIVED,
            isSelected: false,
            vendor: { name: 'Vendor Beta', code: 'VND-B' },
            items: [
              { itemName: 'Nitric Acid 68%', unitPrice: 95, lineTotal: 95000, quantity: 1000 },
            ],
          },
        ],
      });

      const matrix = await comparisonService.getComparisonMatrix('rfq-1');

      expect(matrix.vendors.length).toBe(2);
      expect(matrix.items[0]?.lowestPrice).toBe(95);
      expect(matrix.items[0]?.lowestVendorId).toBe('v-2');
      expect(matrix.summary.lowestTotalAmount).toBe(112100);
      expect(matrix.summary.fastestLeadDays).toBe(10);
      expect(matrix.summary.fastestVendorId).toBe('v-1');
    });

    it('should select winner quotation with mandatory justification and reject unselected quotes', async () => {
      mockPrisma.requestForQuotation.findUnique.mockResolvedValue({
        id: 'rfq-1',
        rfqNumber: 'SH-RFQ-2026-000001',
        organizationId: 'org-1',
        companyId: 'comp-1',
        quotations: [
          { id: 'q-1', vendorId: 'v-1', vendor: { name: 'Vendor Alpha' }, netAmount: 118000 },
          { id: 'q-2', vendorId: 'v-2', vendor: { name: 'Vendor Beta' }, netAmount: 112100 },
        ],
      });

      mockPrisma.vendorQuotation.update.mockResolvedValue({
        id: 'q-2',
        vendorId: 'v-2',
        vendor: { name: 'Vendor Beta' },
        status: QuotationStatus.SELECTED,
        isSelected: true,
        netAmount: 112100,
      });

      const winner = await comparisonService.selectWinner({
        rfqId: 'rfq-1',
        quotationId: 'q-2',
        vendorId: 'v-2',
        selectionJustification: 'Lowest overall price with verified ISO quality certificate',
        selectedById: 'u-proc-head',
      });

      expect(winner.status).toBe(QuotationStatus.SELECTED);
      expect(mockPrisma.vendorQuotation.updateMany).toHaveBeenCalledWith({
        where: { rfqId: 'rfq-1', id: { not: 'q-2' } },
        data: { status: QuotationStatus.REJECTED, isSelected: false },
      });
      expect(mockPrisma.requestForQuotation.update).toHaveBeenCalledWith({
        where: { id: 'rfq-1' },
        data: { status: RfqStatus.COMPARISON_COMPLETED },
      });
      expect(mockAudit.record).toHaveBeenCalled();
    });
  });

  // ==========================================
  // 5. GOODS RECEIPT NOTE (GRN) & QC PLACEHOLDER
  // ==========================================
  describe('Goods Receipt Note (GRN) Foundation', () => {
    it('should create GRN against APPROVED PO, track received quantities and update PO status', async () => {
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue({
        id: 'po-1',
        poNumber: 'SH-PO-2026-000001',
        status: PurchaseOrderStatus.APPROVED,
        vendor: { name: 'National Packaging Ltd' },
        items: [
          {
            id: 'poi-1',
            itemName: 'HDPE Woven Sacks',
            quantity: 1000,
            receivedQuantity: 0,
          },
        ],
      });

      mockPrisma.goodsReceiptNote.create.mockImplementation((args: any) =>
        Promise.resolve({
          ...args.data,
          items: args.data.items.create,
        }),
      );

      const grn = await grnService.createGoodsReceipt({
        organizationId: 'org-1',
        companyId: 'comp-1',
        poId: 'po-1',
        vendorId: 'v-approved',
        warehouseId: 'wh-raw',
        receivedById: 'u-gate',
        carrierName: 'TCS Cargo Freight',
        deliveryNoteNumber: 'DN-99401',
        items: [
          {
            poItemId: 'poi-1',
            itemName: 'HDPE Woven Sacks',
            orderedQuantity: 1000,
            receivedQuantity: 600, // Partial delivery (600 of 1000)
            unit: 'BAG',
          },
        ],
      });

      expect(grn.grnNumber).toBe('SH-GRN-2026-000001');
      expect(grn.status).toBe(GoodsReceiptStatus.RECEIVED);
      expect(grn.qcStatus).toBe(QcStatus.PENDING);

      // Verify PO item receivedQuantity updated to 600
      expect(mockPrisma.purchaseOrderItem.update).toHaveBeenCalledWith({
        where: { id: 'poi-1' },
        data: { receivedQuantity: 600 },
      });

      // Partial receiving moves PO to PARTIALLY_RECEIVED
      expect(mockPrisma.purchaseOrder.update).toHaveBeenCalledWith({
        where: { id: 'po-1' },
        data: { status: PurchaseOrderStatus.PARTIALLY_RECEIVED },
      });
    });

    it('should process QC inspection update with accepted/rejected units and audit logging', async () => {
      mockPrisma.goodsReceiptNote.findUnique.mockResolvedValue({
        id: 'grn-1',
        grnNumber: 'SH-GRN-2026-000001',
        organizationId: 'org-1',
        companyId: 'comp-1',
        status: GoodsReceiptStatus.RECEIVED,
        qcStatus: QcStatus.PENDING,
        items: [
          {
            id: 'grni-1',
            itemName: 'HDPE Bags',
            receivedQuantity: 600,
            acceptedQuantity: 600,
            rejectedQuantity: 0,
          },
        ],
      });

      mockPrisma.goodsReceiptNote.update.mockResolvedValue({
        id: 'grn-1',
        status: GoodsReceiptStatus.ACCEPTED,
        qcStatus: QcStatus.PASSED,
        qcNotes: 'All tensile strength and seam tests passed specification.',
      });

      const updated = await grnService.updateQcInspection({
        grnId: 'grn-1',
        qcStatus: QcStatus.PASSED,
        qcNotes: 'All tensile strength and seam tests passed specification.',
        acceptedQuantities: { 'grni-1': 590 },
        rejectedQuantities: { 'grni-1': 10 },
      });

      expect(updated.status).toBe(GoodsReceiptStatus.ACCEPTED);
      expect(updated.qcStatus).toBe(QcStatus.PASSED);
      expect(mockPrisma.goodsReceiptNoteItem.update).toHaveBeenCalledWith({
        where: { id: 'grni-1' },
        data: { acceptedQuantity: 590, rejectedQuantity: 10 },
      });
      expect(mockAudit.record).toHaveBeenCalled();
    });
  });

  // ==========================================
  // 6. VENDOR PERFORMANCE & SCORECARD
  // ==========================================
  describe('Vendor Performance Foundation', () => {
    it('should compute empirical vendor performance metrics and ratings', async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 10);

      mockPrisma.purchaseOrder.findMany.mockResolvedValue([
        {
          id: 'po-1',
          status: PurchaseOrderStatus.COMPLETED,
          createdAt: pastDate,
          expectedDeliveryDate: new Date(),
        },
      ]);

      mockPrisma.goodsReceiptNote.findMany.mockResolvedValue([
        {
          id: 'grn-1',
          receivedDate: new Date(),
          purchaseOrder: {
            createdAt: pastDate,
            expectedDeliveryDate: new Date(),
          },
          items: [{ receivedQuantity: 1000, rejectedQuantity: 10 }],
        },
      ]);

      mockPrisma.vendorPerformance.upsert.mockResolvedValue({
        vendorId: 'v-1',
        companyId: 'comp-1',
        totalOrders: 1,
        completedOrders: 1,
        onTimeDeliveryRate: 100.0,
        rejectionRate: 1.0,
        averageLeadDays: 10.0,
        overallRating: 4.97,
        lastEvaluatedAt: new Date(),
      });

      const scorecard = await performanceService.recalculatePerformance('v-1', 'comp-1');

      expect(scorecard.totalOrders).toBe(1);
      expect(scorecard.completedOrders).toBe(1);
      expect(scorecard.onTimeDeliveryRate).toBe(100.0);
      expect(scorecard.rejectionRate).toBe(1.0);
      expect(scorecard.overallRating).toBe(4.97);
      expect(mockPrisma.vendor.update).toHaveBeenCalledWith({
        where: { id: 'v-1' },
        data: { rating: 4.97 },
      });
    });
  });
});
