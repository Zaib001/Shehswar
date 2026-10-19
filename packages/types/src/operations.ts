/**
 * SHEHSWAR ONE360 - Operational Business Types
 *
 * Types shared across: Purchase, Sales, Inventory, Ledgers, Costing,
 * Dealer Payments, Intercompany, and Mobile APIs.
 *
 * These types ensure all modules reference the same master IDs
 * and never duplicate business data.
 */

// ============================================================
// INVENTORY / STOCK TYPES
// ============================================================

export type StockMovementType =
  | 'PURCHASE'
  | 'PURCHASE_RETURN'
  | 'SALE'
  | 'SALES_RETURN'
  | 'PRODUCTION_CONSUMPTION'
  | 'PRODUCTION_OUTPUT'
  | 'INTERCOMPANY_OUT'
  | 'INTERCOMPANY_IN'
  | 'ADJUSTMENT';

export type ItemType = 'RAW_MATERIAL' | 'PACKING_MATERIAL' | 'FINISHED_PRODUCT';

export interface StockMovementInput {
  organizationId: string;
  companyId: string;
  warehouseId: string;
  itemType: ItemType;
  rawMaterialId?: string;
  packingMaterialId?: string;
  finishedProductId?: string;
  quantityChange: number; // positive = in, negative = out
  unitCost?: number;
  transactionType: StockMovementType;
  referenceId: string;
  referenceNumber: string;
  notes?: string;
}

export interface StockBalance {
  warehouseId: string;
  itemType: ItemType;
  rawMaterialId?: string;
  packingMaterialId?: string;
  finishedProductId?: string;
  quantityOnHand: number;
  averageCost: number;
  lastUpdated: Date;
}

// ============================================================
// LEDGER TYPES
// ============================================================

export type DealerLedgerEntryType =
  | 'SALE_INVOICE'
  | 'PAYMENT_RECEIPT'
  | 'SALES_RETURN'
  | 'OPENING_BALANCE'
  | 'ADJUSTMENT'
  | 'PR_ALLOCATION'
  | 'PR_REVERSAL';

export type VendorLedgerEntryType =
  | 'PURCHASE_INVOICE'
  | 'VENDOR_PAYMENT'
  | 'PURCHASE_RETURN'
  | 'OPENING_BALANCE'
  | 'ADJUSTMENT';

export interface DealerLedgerInput {
  organizationId: string;
  companyId: string;
  dealerId: string;
  entryType: DealerLedgerEntryType;
  referenceId: string;
  voucherNumber: string;
  description?: string;
  debit: number;  // amount dealer owes (sale)
  credit: number; // amount dealer paid (payment/return)
  entryDate?: Date;
  salesInvoiceId?: string;
  dealerPaymentId?: string;
  salesReturnId?: string;
  provisionalReceiptAllocationId?: string;
}

export interface VendorLedgerInput {
  organizationId: string;
  companyId: string;
  vendorId: string;
  entryType: VendorLedgerEntryType;
  referenceId: string;
  voucherNumber: string;
  description?: string;
  credit: number;  // amount we owe vendor (purchase)
  debit: number;   // amount we paid (payment/return)
  entryDate?: Date;
  purchaseInvoiceId?: string;
  vendorPaymentId?: string;
  purchaseReturnId?: string;
}

// ============================================================
// PURCHASE TYPES
// ============================================================

export type PurchasePostingStatus = 'DRAFT' | 'REVIEWED' | 'POSTED' | 'CANCELLED';

export interface CreatePurchaseItemDto {
  materialType: 'RAW_MATERIAL' | 'PACKING_MATERIAL' | 'FINISHED_PRODUCT';
  rawMaterialId?: string;
  packingMaterialId?: string;
  finishedProductId?: string;
  itemName: string;
  packing?: string;
  unit?: string;
  quantity: number;
  rate: number;
  grossAmount: number;
  discountRate?: number;
  discountAmount?: number;
  taxPercent?: number;
  taxAmount?: number;
  netAmount: number;
  phaseCategory?: string;
}

export interface CreatePurchaseDto {
  organizationId?: string;
  companyId?: string;
  date: string;
  receivedOn?: string;
  reference?: string;
  vendorInvoiceNo?: string;
  vendorId: string;
  warehouseId: string;
  items: CreatePurchaseItemDto[];
  grossAmount?: number;
  discountRate?: number;
  discountAmount?: number;
  salesTaxPercent?: number;
  taxAmount?: number;
  netAmount?: number;
  notes?: string;
  // OCR source document IDs for attachment
  documentAttachments?: {
    documentType: string;
    documentNumber?: string;
    fileName: string;
    fileUrl: string;
    fileSizeBytes?: number;
    mimeType?: string;
    extractedData?: Record<string, unknown>;
  }[];
}

export interface CreatePurchaseReturnDto {
  organizationId?: string;
  companyId?: string;
  purchaseInvoiceId?: string;
  date: string;
  vendorId: string;
  warehouseId: string;
  reason?: string;
  notes?: string;
  items: {
    materialType: 'RAW_MATERIAL' | 'PACKING_MATERIAL' | 'FINISHED_PRODUCT';
    rawMaterialId?: string;
    packingMaterialId?: string;
    finishedProductId?: string;
    warehouseId?: string;
    itemName: string;
    quantity: number;
    rate: number;
    netAmount: number;
  }[];
}

// ============================================================
// SALES ORDER TYPES
// ============================================================

export type SalesOrderStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CONVERTED_TO_SALE';

export interface CreateSalesOrderItemDto {
  finishedProductId?: string;
  rateListId?: string;
  rateListVersionId?: string;
  schemeId?: string;
  productName: string;
  packing?: string;
  quantity: number;
  baseRate?: number;
  unitPrice?: number;
  discountPercent?: number;
  discountAmount?: number;
  freeQuantity?: number;
  totalPrice?: number;
  commercialCondition?: string;
  pricingBreakdown?: any;
}

export interface CreateSalesOrderDto {
  organizationId?: string;
  companyId?: string;
  dealerId: string;
  salesOfficerId?: string;
  warehouseId?: string;
  rateListId?: string;
  rateListVersionId?: string;
  schemeId?: string;
  paymentTerm?: string;
  orderDate?: string;
  notes?: string;
  pricingPhase?: 'CASH' | 'SEASONAL' | 'ADVANCE_BOOKING' | 'VD' | 'NET_RATE' | string;
  commercialCondition?: string;
  documentFormat?: 'BASIC_DELIVERY' | 'STANDARD_SALES' | 'COMMERCIAL_FULL' | string;
  items: CreateSalesOrderItemDto[];
}

export interface ApproveSalesOrderDto {
  approved: boolean;
  rejectionReason?: string;
}

// ============================================================
// SALES INVOICE TYPES
// ============================================================

export interface CreateSalesInvoiceItemDto {
  finishedProductId?: string;
  productName: string;
  packing?: string;
  quantity: number;
  rate: number;
  grossAmount: number;
  discountAmount?: number;
  taxAmount?: number;
  netAmount: number;
}

export interface CreateSalesInvoiceDto {
  organizationId?: string;
  companyId?: string;
  salesOrderId?: string;
  dealerId: string;
  salesOfficerId?: string;
  warehouseId: string;
  invoiceDate?: string;
  notes?: string;
  grossAmount?: number;
  discountAmount?: number;
  taxAmount?: number;
  netAmount?: number;
  pricingPhase?: 'CASH' | 'SEASONAL' | 'ADVANCE_BOOKING' | 'VD' | 'NET_RATE' | string;
  commercialCondition?: string;
  documentFormat?: 'BASIC_DELIVERY' | 'STANDARD_SALES' | 'COMMERCIAL_FULL' | string;
  isDeliveryChallan?: boolean;
  batchNumber?: string;
  cartons?: number;
  schemeDescription?: string;
  items: CreateSalesInvoiceItemDto[];
}

export interface CreateSalesReturnDto {
  organizationId?: string;
  companyId?: string;
  salesInvoiceId?: string;
  dealerId: string;
  warehouseId: string;
  returnDate?: string;
  reason?: string;
  notes?: string;
  items: {
    finishedProductId?: string;
    productName: string;
    quantity: number;
    rate: number;
    netAmount: number;
  }[];
}

// ============================================================
// PAYMENT TYPES
// ============================================================

export interface CreateDealerPaymentDto {
  organizationId?: string;
  companyId?: string;
  dealerId: string;
  salesOfficerId?: string;
  paymentType: 'BANK' | 'CASH';
  amount: number;
  paymentDate?: string;
  bankName?: string;
  referenceNumber?: string;
  receiptImageUrl?: string;
  extractedDetails?: Record<string, unknown>;
  notes?: string;
}

export interface CreateVendorPaymentDto {
  organizationId?: string;
  companyId?: string;
  vendorId: string;
  paymentType: 'BANK' | 'CASH';
  amount: number;
  paymentDate?: string;
  bankName?: string;
  referenceNumber?: string;
  notes?: string;
}

// ============================================================
// DEALER TYPES
// ============================================================

export interface CreateDealerDto {
  organizationId?: string;
  companyId?: string;
  code: string;
  name: string;
  businessName?: string;
  contactPerson?: string;
  phone: string;
  email?: string;
  city?: string;
  address?: string;
  creditLimit?: number;
  notes?: string;
}

export interface UpdateDealerDto {
  name?: string;
  businessName?: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  city?: string;
  address?: string;
  creditLimit?: number;
  status?: string;
  notes?: string;
}

export interface AssignSalesOfficerDto {
  userId: string;
  dealerIds: string[];
}

// ============================================================
// COSTING TYPES
// ============================================================

export type CostingMethod = 'LATEST_PURCHASE' | 'WEIGHTED_AVERAGE' | 'STANDARD';

export interface CostingComponent {
  componentType: 'RAW_MATERIAL' | 'PACKING_MATERIAL';
  rawMaterialId?: string;
  packingMaterialId?: string;
  name: string;
  consumptionQty: number;
  unitCost: number;
  totalCost: number;
}

export interface FinishedProductCostResult {
  finishedProductId: string;
  productName: string;
  components: CostingComponent[];
  rawMaterialCost: number;
  packagingCost: number;
  overheadCost: number;
  totalCostPerUnit: number;
  costingMethod: CostingMethod;
  calculatedAt: Date;
}

// ============================================================
// OCR / DOCUMENT TYPES
// ============================================================

export interface OcrExtractedPurchase {
  vendorName?: string;
  vendorCode?: string;
  invoiceNumber?: string;
  date?: string;
  reference?: string;
  gatePassNumber?: string;
  vehicleNumber?: string;
  items: {
    itemName: string;
    packing?: string;
    uom?: string;
    quantity?: number;
    rate?: number;
    grossAmount?: number;
    discount?: number;
    tax?: number;
    netAmount?: number;
  }[];
  grossAmount?: number;
  discountAmount?: number;
  taxAmount?: number;
  netAmount?: number;
  confidence: number; // 0-1
}

export interface OcrExtractedBankReceipt {
  amount?: number;
  date?: string;
  bankName?: string;
  transactionReference?: string;
  accountNumber?: string;
  description?: string;
  confidence: number;
}

// ============================================================
// MOBILE API TYPES
// ============================================================

export interface MobileLoginDto {
  email: string;
  password: string;
  deviceId?: string;
  deviceType?: 'ANDROID' | 'IOS';
}

export interface MobileDealerSummary {
  id: string;
  code: string;
  name: string;
  businessName?: string;
  phone: string;
  city?: string;
  currentBalance: number;
  creditLimit: number;
  status: string;
}

export interface MobileSalesOfficerProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  companyId: string;
  companyName: string;
  dealerCount: number;
}

// ============================================================
// DYNAMIC RATE LIST, SCHEME & PRICE RESOLUTION TYPES
// ============================================================

export type RateListCategory =
  | 'SEASONAL'
  | 'CASH'
  | 'ADVANCE_BOOKING'
  | 'VD'
  | 'NET_RATE'
  | 'PACKAGE'
  | 'SPECIAL'
  | 'MELA'
  | 'GENERAL'
  | string;

export type SchemeType =
  | 'CASH_DISCOUNT'
  | 'ADVANCE_BOOKING'
  | 'PACKAGE'
  | 'SPECIAL_RATE'
  | 'VOLUME_DISCOUNT'
  | 'NET_RATE'
  | 'MELA_EVENT'
  | 'CREDIT_COMMERCIAL'
  | 'OTHER'
  | string;

export interface DiscountComponent {
  name: string;
  type: 'PERCENTAGE' | 'FLAT';
  value: number;
}

export interface CreateRateListDto {
  organizationId?: string;
  companyId?: string;
  code: string;
  name: string;
  description?: string;
  category?: RateListCategory;
  currency?: string;
  isMobileVisible?: boolean;
  isMobileSelectable?: boolean;
  isInternalOnly?: boolean;
  priority?: number;
  effectiveFrom?: string;
  effectiveTo?: string;
  notes?: string;
  items?: CreateRateListItemDto[];
}

export interface UpdateRateListDto {
  name?: string;
  description?: string;
  category?: RateListCategory;
  currency?: string;
  status?: 'DRAFT' | 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
  isMobileVisible?: boolean;
  isMobileSelectable?: boolean;
  isInternalOnly?: boolean;
  priority?: number;
}

export interface CreateRateListItemDto {
  finishedProductId: string;
  packSizeId?: string;
  baseRate: number;
  unit?: string;
  discountType?: 'PERCENTAGE' | 'FLAT';
  discountValue?: number;
  fixedNetRate?: number;
  minAllowedRate?: number;
  quantityFrom?: number;
  quantityTo?: number;
  freeQuantity?: number;
  commercialCondition?: string;
  isActive?: boolean;
}

export interface CreateRateListVersionDto {
  rateListId: string;
  versionNumber?: number;
  effectiveFrom: string;
  effectiveTo?: string;
  notes?: string;
  items?: CreateRateListItemDto[];
}

export interface CreatePricingSchemeDto {
  organizationId?: string;
  companyId?: string;
  code: string;
  name: string;
  description?: string;
  schemeType: SchemeType;
  calculationMethod?: 'ADDITIVE' | 'SEQUENTIAL';
  discountComponents?: DiscountComponent[];
  baseRateListId?: string;
  paidQuantity?: number;
  freeQuantity?: number;
  minQuantity?: number;
  maxQuantity?: number;
  applicableDealerTier?: string;
  paymentTerm?: string;
  effectiveFrom: string;
  effectiveTo?: string;
  isMobileVisible?: boolean;
  isMobileSelectable?: boolean;
  isInternalOnly?: boolean;
  priority?: number;
  status?: string;
}

export interface UpdatePricingSchemeDto {
  name?: string;
  description?: string;
  schemeType?: SchemeType;
  calculationMethod?: 'ADDITIVE' | 'SEQUENTIAL';
  discountComponents?: DiscountComponent[];
  baseRateListId?: string;
  paidQuantity?: number;
  freeQuantity?: number;
  minQuantity?: number;
  maxQuantity?: number;
  applicableDealerTier?: string;
  paymentTerm?: string;
  effectiveFrom?: string;
  effectiveTo?: string;
  isMobileVisible?: boolean;
  isMobileSelectable?: boolean;
  isInternalOnly?: boolean;
  priority?: number;
  status?: string;
}

export interface UpdatePricingAuthorityLimitDto {
  roleCode: string;
  maxDiscountPct: number;
  canSetNetRate?: boolean;
  canApplySpecialRate?: boolean;
  canApproveOwnOverride?: boolean;
  requiresApproval?: boolean;
  companyScope?: string;
  status?: string;
}

export interface ResolvePriceDto {
  companyId?: string;
  dealerId?: string;
  finishedProductId: string;
  packSizeId?: string;
  quantity?: number;
  orderDate?: string | Date;
  paymentTerm?: string; // CASH, CREDIT, ADVANCE
  requestedCondition?: string;
  requestedSchemeId?: string;
  requestedRateListId?: string;
  requestedRate?: number;
  pricingPhase?: 'CASH' | 'SEASONAL' | 'ADVANCE_BOOKING' | 'VD' | 'NET_RATE' | string;
}

export interface ResolvedPriceResult {
  finishedProductId: string;
  productCode: string;
  productName: string;
  baseRate: number;
  rateListId?: string;
  rateListName?: string;
  rateListVersionId?: string;
  versionNumber?: number;
  schemeId?: string;
  schemeName?: string;
  schemeType?: string;
  calculationMethod?: string;
  discountComponents: Array<{ name: string; type: string; value: number; calculatedAmount: number }>;
  discountPercent: number;
  discountAmount: number;
  freeQuantity: number;
  finalUnitRate: number;
  quantity: number;
  grossAmount: number;
  totalDiscountAmount: number;
  finalAmount: number;
  paymentTerm: string;
  authorityRequired: string;
  approvalRequired: boolean;
  isCustomRate: boolean;
  isAuthorized: boolean;
  reason?: string;
  commercialCondition?: string;
  effectiveFrom?: string;
  effectiveTo?: string;
}

// ============================================================
// FINANCIAL ACCOUNTING & GENERAL LEDGER (GL) TYPES
// ============================================================

export interface AccountRecord {
  id: string;
  organizationId: string;
  companyId?: string | null;
  accountCode: string;
  accountName: string;
  accountType: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';
  category: string;
  currency: string;
  isSystem: boolean;
  isActive: boolean;
  currentBalance: number;
  notes?: string | null;
}

export interface JournalEntryLineRecord {
  id: string;
  journalEntryId: string;
  accountId: string;
  account?: AccountRecord;
  debit: number;
  credit: number;
  description?: string | null;
  dealerId?: string | null;
  vendorId?: string | null;
  salesOfficerId?: string | null;
  regionId?: string | null;
  zoneId?: string | null;
  territoryId?: string | null;
}

export interface JournalEntryRecord {
  id: string;
  organizationId: string;
  companyId: string;
  entryNumber: string;
  entryDate: string | Date;
  sourceType: 'SALES_INVOICE' | 'PURCHASE_INVOICE' | 'DEALER_PAYMENT' | 'VENDOR_PAYMENT' | 'EXPENSE' | 'MANUAL_JOURNAL';
  sourceId?: string | null;
  referenceNumber?: string | null;
  description?: string | null;
  totalDebit: number;
  totalCredit: number;
  isBalanced: boolean;
  status: 'POSTED' | 'DRAFT' | 'REVERSED';
  createdById?: string | null;
  lines: JournalEntryLineRecord[];
  createdAt: string | Date;
}

export interface ExpenseEntryRecord {
  id: string;
  organizationId: string;
  companyId: string;
  voucherNumber: string;
  expenseDate: string | Date;
  expenseAccountId: string;
  expenseAccount?: AccountRecord;
  paymentAccountId: string;
  paymentAccount?: AccountRecord;
  paymentMethod: 'CASH' | 'BANK' | 'PAYABLE';
  amount: number;
  taxAmount: number;
  payee?: string | null;
  referenceNumber?: string | null;
  category?: string | null;
  description?: string | null;
  regionId?: string | null;
  zoneId?: string | null;
  territoryId?: string | null;
  status: string;
  createdById?: string | null;
  createdAt: string | Date;
}

export interface BalanceSheetReport {
  asOfDate: string;
  companyId?: string;
  companyName?: string;
  currentAssets: {
    cashAndBank: number;
    accountsReceivable: number;
    inventory: number;
    otherAssets: number;
    total: number;
  };
  nonCurrentAssets: {
    fixedAssets: number;
    total: number;
  };
  totalAssets: number;
  currentLiabilities: {
    accountsPayable: number;
    taxesPayable: number;
    otherLiabilities: number;
    total: number;
  };
  totalLiabilities: number;
  equity: {
    shareCapital: number;
    retainedEarnings: number;
    currentPeriodProfit: number;
    total: number;
  };
  totalLiabilitiesAndEquity: number;
  isBalanced: boolean;
  variance: number;
}

export interface ProfitAndLossReport {
  period: string;
  startDate: string;
  endDate: string;
  companyId?: string;
  companyName?: string;
  revenue: {
    grossSales: number;
    discounts: number;
    netSales: number;
  };
  costOfGoodsSold: {
    cogs: number;
  };
  grossProfit: number;
  grossMarginPercent: number;
  operatingExpenses: {
    sellingAndDistribution: number;
    marketingAndSchemes: number;
    administrative: number;
    otherExpenses: number;
    total: number;
  };
  operatingProfit: number;
  netProfit: number;
  netMarginPercent: number;
}

// ============================================================
// HIERARCHICAL CREDIT CONTROL TYPES
// ============================================================

export type CreditLevel = 'DEALER' | 'SALES_OFFICER' | 'TERRITORY' | 'ZONE' | 'REGION' | 'COMPANY';

export type CreditStatus =
  | 'WITHIN_LIMIT'
  | 'NEAR_LIMIT'
  | 'LIMIT_REACHED'
  | 'LIMIT_EXCEEDED'
  | 'CREDIT_HOLD'
  | 'PENDING_CREDIT_APPROVAL';

export interface CreditLimitRecord {
  id: string;
  organizationId: string;
  companyId: string;
  level: CreditLevel;
  entityId: string;
  entityName?: string;
  creditLimit: number;
  effectiveFrom: string | Date;
  effectiveTo?: string | Date | null;
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  approvalAuthority?: string | null;
  nearLimitThresholdPercent: number;
  notes?: string | null;
}

export interface CreditCheckLevelResult {
  level: CreditLevel;
  entityId: string;
  entityName: string;
  limit: number;
  currentExposure: number;
  orderAmount: number;
  projectedExposure: number;
  availableCredit: number;
  utilizationPercent: number;
  status: CreditStatus;
  allowed: boolean;
  approvalRequired: boolean;
}

export interface CreditCheckResult {
  dealer: CreditCheckLevelResult;
  salesOfficer?: CreditCheckLevelResult;
  territory?: CreditCheckLevelResult;
  zone?: CreditCheckLevelResult;
  region?: CreditCheckLevelResult;
  overall: {
    allowed: boolean;
    approvalRequired: boolean;
    blockingLevel?: CreditLevel | null;
    reason?: string | null;
    status: CreditStatus;
  };
  allowed: boolean;
  approvalRequired: boolean;
  blockingLevel?: CreditLevel | null;
  reason?: string | null;
}

export interface CreditOverrideRequestRecord {
  id: string;
  organizationId: string;
  companyId: string;
  salesOrderId: string;
  orderNumber?: string;
  level: CreditLevel;
  entityId: string;
  entityName: string;
  currentLimit: number;
  currentExposure: number;
  orderAmount: number;
  projectedExposure: number;
  exceededAmount: number;
  requestedById?: string | null;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  approvedById?: string | null;
  approvedAt?: string | Date | null;
  rejectionReason?: string | null;
  createdAt: string | Date;
}

// ============================================================
// SALES TARGET TYPES
// ============================================================

export interface SalesTargetRecord {
  id: string;
  organizationId: string;
  companyId: string;
  level: CreditLevel;
  entityId: string;
  entityName?: string;
  periodYear: number;
  periodMonth: number;
  targetAmount: number;
  targetQuantity: number;
  targetType: 'REVENUE' | 'QUANTITY' | 'HYBRID';
  status: string;
  notes?: string | null;
}

// ============================================================
// VEHICLE & FLEET MANAGEMENT TYPES
// ============================================================

export type VehicleStatus = 'AVAILABLE' | 'ASSIGNED' | 'UNDER_MAINTENANCE' | 'SOLD' | 'DISPOSED' | 'INACTIVE';

export interface VehicleRecord {
  id: string;
  organizationId: string;
  companyId: string;
  vehicleNumber: string;
  companyName?: string;
  vehicleModel: string;
  registrationYear: number;
  engineNumber?: string | null;
  chassisNumber?: string | null;
  status: VehicleStatus;
  currentEmployeeId?: string | null;
  currentEmployee?: {
    id: string;
    employeeCode: string;
    firstName: string;
    lastName: string;
    position: string;
    phone?: string | null;
  } | null;
  assignmentDate?: string | Date | null;
  currentLocation?: string | null;
  notes?: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
  assignments?: VehicleAssignmentRecord[];
  expenses?: VehicleExpenseRecord[];
}

export interface VehicleAssignmentRecord {
  id: string;
  organizationId: string;
  companyId: string;
  vehicleId: string;
  employeeId: string;
  assignedById?: string | null;
  assignmentDate: string | Date;
  returnDate?: string | Date | null;
  returnReason?: string | null;
  returnCondition?: string | null;
  status: 'ACTIVE' | 'RETURNED';
  notes?: string | null;
  vehicle?: Partial<VehicleRecord>;
  employee?: {
    id: string;
    employeeCode: string;
    firstName: string;
    lastName: string;
    position: string;
    phone?: string | null;
  };
  createdAt: string | Date;
}

export interface VehicleExpenseRecord {
  id: string;
  organizationId: string;
  companyId: string;
  vehicleId: string;
  employeeId?: string | null;
  voucherNumber: string;
  expenseType: 'FUEL' | 'MAINTENANCE' | 'REPAIR' | 'TOLL_TAX' | 'INSURANCE' | 'OTHER';
  expenseDate: string | Date;
  fuelStation?: string | null;
  quantity: number;
  rate: number;
  totalAmount: number;
  paymentMethod: 'CASH' | 'BANK' | 'PAYABLE';
  remarks?: string | null;
  attachmentUrl?: string | null;
  expenseEntryId?: string | null;
  journalEntryId?: string | null;
  status: string;
  vehicle?: Partial<VehicleRecord>;
  employee?: {
    id: string;
    employeeCode: string;
    firstName: string;
    lastName: string;
  } | null;
}

export interface EmployeeSalaryPaymentRecord {
  id: string;
  organizationId: string;
  companyId: string;
  employeeId: string;
  voucherNumber: string;
  salaryMonth: string;
  paymentDate: string | Date;
  grossSalary: number;
  adjustments: number;
  netPaid: number;
  paymentMethod: 'CASH' | 'BANK';
  referenceNumber?: string | null;
  remarks?: string | null;
  attachmentUrl?: string | null;
  status: string;
  employee?: {
    id: string;
    employeeCode: string;
    firstName: string;
    lastName: string;
    position: string;
  };
}

// ============================================================
// FINANCIAL TRANSACTIONS (5 TRANSACTION TYPES)
// ============================================================

export type FinancialTransactionType =
  | 'CASH_RECEIPT'
  | 'CASH_PAYMENT'
  | 'BANK_RECEIPT'
  | 'BANK_PAYMENT';

export interface FinancialTransactionRecord {
  id: string;
  organizationId: string;
  companyId: string;
  voucherNumber: string;
  transactionType: FinancialTransactionType;
  transactionDate: string | Date;
  partyType?: 'DEALER' | 'VENDOR' | 'EMPLOYEE' | 'OTHER' | null;
  partyId?: string | null;
  partyName?: string | null;
  amount: number;
  paymentMethod: 'CASH' | 'BANK' | 'CHEQUE' | 'ONLINE' | 'DD' | 'OTHER';
  accountId: string;
  contraAccountId: string;
  bankName?: string | null;
  branchName?: string | null;
  referenceNumber?: string | null;
  remarks?: string | null;
  attachmentUrl?: string | null;
  status: 'DRAFT' | 'POSTED' | 'REVERSED';
  journalEntryId?: string | null;
  account?: {
    id: string;
    accountCode: string;
    accountName: string;
  };
  contraAccount?: {
    id: string;
    accountCode: string;
    accountName: string;
  };
}

// ============================================================
// PROVISIONAL RECEIPT (PR) TYPES
// ============================================================

export type PrAllocationStatus = 'UNALLOCATED' | 'PARTIALLY_ALLOCATED' | 'FULLY_ALLOCATED';
export type PrStatus = 'DRAFT' | 'PENDING_ALLOCATION' | 'POSTED' | 'REVERSED' | 'CANCELLED';

export interface ProvisionalReceiptProductRecord {
  id: string;
  provisionalReceiptId: string;
  srNo: number;
  finishedProductId?: string | null;
  productName: string;
  packSize: string;
  quantity: number;
  policyRate: number;
  amount: number;
}

export interface ProvisionalReceiptAllocationRecord {
  id: string;
  provisionalReceiptId: string;
  dealerId: string;
  partyCode?: string | null;
  dealerName?: string | null;
  regionId?: string | null;
  territoryId?: string | null;
  allocatedAmount: number;
  reference?: string | null;
  remarks?: string | null;
  status: 'POSTED' | 'REVERSED';
  dealerLedgerEntryId?: string | null;
  dealer?: {
    id: string;
    code: string;
    name: string;
    currentBalance: number;
    creditLimit: number;
  };
}

export interface ProvisionalReceiptRecord {
  id: string;
  organizationId: string;
  companyId: string;
  prNumber: string;
  receiptDate: string | Date;
  issueDate: string | Date;
  name?: string | null;
  receivedFrom: string;
  partyDealerId?: string | null;
  partyCode?: string | null;
  address?: string | null;
  salesOfficerId?: string | null;
  regionId?: string | null;
  territoryId?: string | null;
  paymentMethod: 'CASH' | 'CHEQUE' | 'DD' | 'ONLINE' | 'OTHER';
  paymentReferenceNumber?: string | null;
  bankName?: string | null;
  branchName?: string | null;
  totalAmount: number;
  totalAmountInWords?: string | null;
  allocatedAmount: number;
  unallocatedAmount: number;
  allocationStatus: PrAllocationStatus;
  status: PrStatus;
  remarks?: string | null;
  attachmentUrl?: string | null;
  journalEntryId?: string | null;
  createdById?: string | null;
  postedById?: string | null;
  postedAt?: string | Date | null;
  reversedById?: string | null;
  reversedAt?: string | Date | null;
  reversalReason?: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
  products?: ProvisionalReceiptProductRecord[];
  allocations?: ProvisionalReceiptAllocationRecord[];
  dealer?: {
    id: string;
    code: string;
    name: string;
  } | null;
  region?: {
    id: string;
    code: string;
    name: string;
  } | null;
  territory?: {
    id: string;
    code: string;
    name: string;
  } | null;
}


