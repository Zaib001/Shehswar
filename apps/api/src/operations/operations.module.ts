/**
 * SHEHSWAR ONE360 - Operations Business Module
 *
 * Encapsulates the complete authoritative operational lifecycle:
 * - Inventory & Warehouse Stock (Centralized stock movements & ledger)
 * - Dealer & Vendor Running Balances & Sub-Ledgers
 * - Authoritative BOM-based Product Costing
 * - Purchases (Draft -> Reviewed -> Atomic Posted, Auto-create RM, Returns)
 * - Sales (Dealers, Orders -> Invoices -> Atomic Posted, Returns, Payments)
 * - Gate Passes (Inward / Outward)
 * - Sales Officer Mobile Application APIs
 */
import { Module } from '@nestjs/common';
import { CoreModule } from '../core/core.module';
import { PlatformModule } from '../platform/platform.module';

// Controllers
import { PurchaseController, PurchaseReturnsController } from './purchase/purchase.controller';
import {
  DealersController,
  SalesOrdersController,
  SalesInvoicesController,
  SalesReturnsController,
  DealerPaymentsController,
  VendorPaymentsController,
  WarehouseStockController,
} from './sales/sales.controller';
import { CostingController } from './costing/costing.controller';
import { GatePassController } from './gate-pass/gate-pass.controller';
import { MobileController } from './mobile/mobile.controller';
import { OperationalPoController } from './purchase-order/purchase-order.controller';
import { OcrController } from './ocr/ocr.controller';
import { IntercompanyController } from './intercompany/intercompany.controller';
import { PricingController } from './pricing/pricing.controller';
import { MarketPerformanceController } from './sales/market-performance.controller';
import { FinanceController } from './finance/finance.controller';
import { CreditControlController } from './credit/credit-control.controller';
import { ControlAuditController } from './audit-control/control-audit.controller';
import { ConsolidatedReportingController } from './reporting/consolidated-reporting.controller';
import { VehiclesController } from './vehicles/vehicles.controller';
import { FinancialTransactionsController } from './finance/financial-transactions.controller';
import { ProvisionalReceiptsController } from './provisional-receipts/provisional-receipts.controller';
import { EmployeeCostController } from './employee-cost/employee-cost.controller';

// Services
import { InventoryService } from './inventory/inventory.service';
import { DealerLedgerService } from './ledger/dealer-ledger.service';
import { VendorLedgerService } from './ledger/vendor-ledger.service';
import { CostingService } from './costing/costing.service';
import { PurchaseService } from './purchase/purchase.service';
import { SalesService } from './sales/sales.service';
import { GatePassService } from './gate-pass/gate-pass.service';
import { OperationalPoService } from './purchase-order/purchase-order.service';
import { OcrService } from './ocr/ocr.service';
import { IntercompanyService } from './intercompany/intercompany.service';
import { PricingService } from './pricing/pricing.service';
import { MarketPerformanceService } from './sales/market-performance.service';
import { FinanceService } from './finance/finance.service';
import { CreditControlService } from './credit/credit-control.service';
import { ControlAuditService } from './audit-control/control-audit.service';
import { ConsolidatedReportingService } from './reporting/consolidated-reporting.service';
import { VehiclesService } from './vehicles/vehicles.service';
import { FinancialTransactionsService } from './finance/financial-transactions.service';
import { ProvisionalReceiptsService } from './provisional-receipts/provisional-receipts.service';
import { EmployeeCostService } from './employee-cost/employee-cost.service';

@Module({
  imports: [CoreModule, PlatformModule],
  controllers: [
    PurchaseController,
    PurchaseReturnsController,
    OperationalPoController,
    OcrController,
    IntercompanyController,
    DealersController,
    SalesOrdersController,
    SalesInvoicesController,
    SalesReturnsController,
    DealerPaymentsController,
    VendorPaymentsController,
    WarehouseStockController,
    CostingController,
    GatePassController,
    MobileController,
    PricingController,
    MarketPerformanceController,
    FinanceController,
    CreditControlController,
    ControlAuditController,
    ConsolidatedReportingController,
    VehiclesController,
    FinancialTransactionsController,
    ProvisionalReceiptsController,
    EmployeeCostController,
  ],
  providers: [
    InventoryService,
    DealerLedgerService,
    VendorLedgerService,
    CostingService,
    PurchaseService,
    OperationalPoService,
    OcrService,
    IntercompanyService,
    SalesService,
    GatePassService,
    PricingService,
    MarketPerformanceService,
    FinanceService,
    CreditControlService,
    ControlAuditService,
    ConsolidatedReportingService,
    VehiclesService,
    FinancialTransactionsService,
    ProvisionalReceiptsService,
    EmployeeCostService,
  ],
  exports: [
    InventoryService,
    DealerLedgerService,
    VendorLedgerService,
    CostingService,
    PurchaseService,
    OperationalPoService,
    OcrService,
    PricingService,
    MarketPerformanceService,
    IntercompanyService,
    SalesService,
    GatePassService,
    FinanceService,
    CreditControlService,
    ControlAuditService,
    ConsolidatedReportingService,
    VehiclesService,
    FinancialTransactionsService,
    ProvisionalReceiptsService,
    EmployeeCostService,
  ],
})
export class OperationsModule {}
