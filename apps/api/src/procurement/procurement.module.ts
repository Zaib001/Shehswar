/**
 * SHEHSWAR ONE360 - Procurement & Vendor Management Module
 *
 * Encapsulates the entire operational procurement lifecycle:
 * Vendor Master & Approvals -> PR -> RFQ -> Quotations ->
 * Quotation Comparison & Selection -> Purchase Orders -> Goods Receipt Notes -> Vendor Performance
 */
import { Module } from '@nestjs/common';
import { CoreModule } from '../core/core.module';
import { PlatformModule } from '../platform/platform.module';

// Controllers
import { VendorController } from './vendor/vendor.controller';
import { PurchaseRequisitionController } from './purchase-requisition/purchase-requisition.controller';
import { RfqController } from './rfq/rfq.controller';
import { QuotationController } from './quotation/quotation.controller';
import { QuotationComparisonController } from './quotation-comparison/quotation-comparison.controller';
import { PurchaseOrderController } from './purchase-order/purchase-order.controller';
import { GoodsReceiptController } from './goods-receipt/goods-receipt.controller';
import { VendorPerformanceController } from './vendor-performance/vendor-performance.controller';

// Services
import { VendorService } from './vendor/vendor.service';
import { PurchaseRequisitionService } from './purchase-requisition/purchase-requisition.service';
import { RfqService } from './rfq/rfq.service';
import { QuotationService } from './quotation/quotation.service';
import { QuotationComparisonService } from './quotation-comparison/quotation-comparison.service';
import { PurchaseOrderService } from './purchase-order/purchase-order.service';
import { GoodsReceiptService } from './goods-receipt/goods-receipt.service';
import { VendorPerformanceService } from './vendor-performance/vendor-performance.service';

@Module({
  imports: [CoreModule, PlatformModule],
  controllers: [
    VendorController,
    PurchaseRequisitionController,
    RfqController,
    QuotationController,
    QuotationComparisonController,
    PurchaseOrderController,
    GoodsReceiptController,
    VendorPerformanceController,
  ],
  providers: [
    VendorService,
    PurchaseRequisitionService,
    RfqService,
    QuotationService,
    QuotationComparisonService,
    PurchaseOrderService,
    GoodsReceiptService,
    VendorPerformanceService,
  ],
  exports: [
    VendorService,
    PurchaseRequisitionService,
    RfqService,
    QuotationService,
    QuotationComparisonService,
    PurchaseOrderService,
    GoodsReceiptService,
    VendorPerformanceService,
  ],
})
export class ProcurementModule {}
