/**
 * SHEHSWAR ONE360 - Enterprise Procurement & Vendor Management Types
 *
 * Covers end-to-end procurement lifecycle:
 * Vendor Master -> PR -> RFQ -> Quotations -> Quotation Comparison -> PO -> GRN -> Performance
 */

// ==========================================
// 1. VENDOR MASTER TYPES & ENUMS
// ==========================================

export enum VendorType {
  RAW_MATERIAL = 'RAW_MATERIAL',
  PACKING_MATERIAL = 'PACKING_MATERIAL',
  SERVICE = 'SERVICE',
  TRANSPORT = 'TRANSPORT',
  MACHINERY = 'MACHINERY',
}

export enum VendorStatus {
  DRAFT = 'DRAFT',
  PENDING_APPROVAL = 'PENDING_APPROVAL',
  APPROVED = 'APPROVED',
  BLOCKED = 'BLOCKED',
  INACTIVE = 'INACTIVE',
}

export enum PaymentTermType {
  ADVANCE_PAYMENT = 'ADVANCE_PAYMENT',
  CREDIT_30_DAYS = 'CREDIT_30_DAYS',
  CREDIT_60_DAYS = 'CREDIT_60_DAYS',
  CREDIT_90_DAYS = 'CREDIT_90_DAYS',
  CUSTOM_TERMS = 'CUSTOM_TERMS',
}

export enum VendorDocumentType {
  CONTRACT = 'CONTRACT',
  AGREEMENT = 'AGREEMENT',
  TAX_DOC = 'TAX_DOC',
  CERTIFICATE = 'CERTIFICATE',
  LICENSE = 'LICENSE',
}

export interface BankDetails {
  bankName: string;
  accountTitle: string;
  accountNumber: string;
  iban?: string;
  branchCode?: string;
  swiftCode?: string;
}

export interface VendorDocumentDto {
  id?: string;
  documentType: VendorDocumentType;
  title: string;
  fileName: string;
  fileUrl: string;
  fileSize?: number;
  expiryDate?: string;
  notes?: string;
}

export interface CreateVendorDto {
  organizationId: string;
  companyId: string;
  code: string;
  name: string;
  legalName?: string;
  vendorType: VendorType;
  category?: string;
  ntn?: string;
  strn?: string;
  registrationNo?: string;
  country?: string;
  city?: string;
  address?: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  website?: string;
  currency?: string;
  paymentTerms?: string;
  creditLimit?: number;
  bankDetails?: BankDetails;
  notes?: string;
  documents?: VendorDocumentDto[];
}

export interface UpdateVendorDto {
  name?: string;
  legalName?: string;
  vendorType?: VendorType;
  category?: string;
  ntn?: string;
  strn?: string;
  registrationNo?: string;
  country?: string;
  city?: string;
  address?: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  website?: string;
  currency?: string;
  paymentTerms?: string;
  creditLimit?: number;
  bankDetails?: BankDetails;
  notes?: string;
}

export interface VendorFilterDto {
  organizationId?: string;
  companyId?: string;
  search?: string;
  vendorType?: VendorType;
  status?: VendorStatus;
  category?: string;
  page?: number;
  limit?: number;
}

// ==========================================
// 2. PURCHASE REQUISITION (PR) TYPES
// ==========================================

export enum PurchaseRequisitionStatus {
  DRAFT = 'DRAFT',
  SUBMITTED = 'SUBMITTED',
  PENDING_APPROVAL = 'PENDING_APPROVAL',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
}

export enum RequisitionPriority {
  LOW = 'LOW',
  NORMAL = 'NORMAL',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
}

export interface PurchaseRequisitionItemDto {
  id?: string;
  itemName: string;
  category?: string;
  quantity: number;
  unit: string;
  requiredDate: string;
  specification?: string;
  estimatedRate?: number;
  estimatedAmount?: number;
  notes?: string;
}

export interface CreatePurchaseRequisitionDto {
  organizationId: string;
  companyId: string;
  departmentId?: string;
  requestedById: string;
  requestedByName?: string;
  requiredDate: string;
  priority?: RequisitionPriority;
  purpose: string;
  notes?: string;
  items: PurchaseRequisitionItemDto[];
}

export interface UpdatePurchaseRequisitionDto {
  departmentId?: string;
  requiredDate?: string;
  priority?: RequisitionPriority;
  purpose?: string;
  notes?: string;
  items?: PurchaseRequisitionItemDto[];
}

export interface PurchaseRequisitionFilterDto {
  organizationId?: string;
  companyId?: string;
  departmentId?: string;
  status?: PurchaseRequisitionStatus;
  priority?: RequisitionPriority;
  search?: string;
  page?: number;
  limit?: number;
}

// ==========================================
// 3. REQUEST FOR QUOTATION (RFQ) TYPES
// ==========================================

export enum RfqStatus {
  DRAFT = 'DRAFT',
  SENT = 'SENT',
  QUOTATIONS_RECEIVED = 'QUOTATIONS_RECEIVED',
  COMPARISON_COMPLETED = 'COMPARISON_COMPLETED',
  CLOSED = 'CLOSED',
}

export enum RfqVendorStatus {
  INVITED = 'INVITED',
  SUBMITTED = 'SUBMITTED',
  DECLINED = 'DECLINED',
}

export interface CreateRfqDto {
  organizationId: string;
  companyId: string;
  prId?: string;
  title: string;
  deadline: string;
  notes?: string;
  vendorIds: string[];
  createdById?: string;
}

export interface RfqFilterDto {
  organizationId?: string;
  companyId?: string;
  prId?: string;
  status?: RfqStatus;
  search?: string;
  page?: number;
  limit?: number;
}

// ==========================================
// 4. VENDOR QUOTATION TYPES
// ==========================================

export enum QuotationStatus {
  RECEIVED = 'RECEIVED',
  UNDER_REVIEW = 'UNDER_REVIEW',
  SELECTED = 'SELECTED',
  REJECTED = 'REJECTED',
}

export interface QuotationItemDto {
  id?: string;
  itemName: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  taxRate?: number;
  discountRate?: number;
  lineTotal?: number;
  notes?: string;
}

export interface CreateQuotationDto {
  organizationId: string;
  companyId: string;
  rfqId: string;
  vendorId: string;
  quotationNumber: string;
  currency?: string;
  deliveryLeadDays: number;
  paymentTerms?: string;
  validityDate: string;
  warranty?: string;
  notes?: string;
  items: QuotationItemDto[];
}

export interface QuotationFilterDto {
  organizationId?: string;
  companyId?: string;
  rfqId?: string;
  vendorId?: string;
  status?: QuotationStatus;
  page?: number;
  limit?: number;
}

// ==========================================
// 5. QUOTATION COMPARISON & SELECTION TYPES
// ==========================================

export interface QuotationComparisonColumn {
  quotationId: string;
  vendorId: string;
  vendorName: string;
  vendorCode: string;
  quotationNumber: string;
  currency: string;
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  netAmount: number;
  deliveryLeadDays: number;
  paymentTerms: string;
  validityDate: string;
  warranty?: string;
  status: QuotationStatus;
  isSelected: boolean;
  itemPrices: Record<string, { unitPrice: number; lineTotal: number; quantity: number }>;
}

export interface QuotationComparisonMatrix {
  rfqId: string;
  rfqNumber: string;
  rfqTitle: string;
  prNumber?: string;
  vendors: QuotationComparisonColumn[];
  items: {
    itemName: string;
    quantity: number;
    unit: string;
    lowestPrice: number;
    lowestVendorId: string;
  }[];
  summary: {
    totalQuotations: number;
    lowestTotalAmount: number;
    lowestTotalVendorId: string;
    fastestLeadDays: number;
    fastestVendorId: string;
  };
}

export interface SelectQuotationWinnerDto {
  rfqId: string;
  quotationId: string;
  vendorId: string;
  selectionJustification: string;
  selectedById: string;
}

// ==========================================
// 6. PURCHASE ORDER (PO) TYPES
// ==========================================

export enum PurchaseOrderStatus {
  DRAFT = 'DRAFT',
  SUBMITTED = 'SUBMITTED',
  APPROVED = 'APPROVED',
  SENT_TO_VENDOR = 'SENT_TO_VENDOR',
  PARTIALLY_RECEIVED = 'PARTIALLY_RECEIVED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export interface PurchaseOrderItemDto {
  id?: string;
  itemName: string;
  category?: string;
  quantity: number;
  unit: string;
  unitRate: number;
  taxRate?: number;
  taxAmount?: number;
  discountRate?: number;
  discountAmount?: number;
  lineTotal?: number;
  notes?: string;
}

export interface CreatePurchaseOrderDto {
  organizationId: string;
  companyId: string;
  departmentId?: string;
  vendorId: string;
  warehouseId?: string;
  prId?: string;
  rfqId?: string;
  currency?: string;
  paymentTerms?: string;
  deliveryLocation?: string;
  expectedDeliveryDate?: string;
  notes?: string;
  createdById?: string;
  items: PurchaseOrderItemDto[];
}

export interface PurchaseOrderFilterDto {
  organizationId?: string;
  companyId?: string;
  vendorId?: string;
  status?: PurchaseOrderStatus;
  search?: string;
  page?: number;
  limit?: number;
}

// ==========================================
// 7. GOODS RECEIPT NOTE (GRN) TYPES
// ==========================================

export enum GoodsReceiptStatus {
  DRAFT = 'DRAFT',
  RECEIVED = 'RECEIVED',
  QUALITY_PENDING = 'QUALITY_PENDING',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
}

export enum QcStatus {
  PENDING = 'PENDING',
  PASSED = 'PASSED',
  PARTIALLY_ACCEPTED = 'PARTIALLY_ACCEPTED',
  REJECTED = 'REJECTED',
  WAIVED = 'WAIVED',
}

export enum PackageCondition {
  INTACT = 'INTACT',
  DAMAGED = 'DAMAGED',
  LEAKING = 'LEAKING',
  SEAL_BROKEN = 'SEAL_BROKEN',
}

export interface GoodsReceiptNoteItemDto {
  id?: string;
  poItemId?: string;
  itemName: string;
  orderedQuantity?: number;
  receivedQuantity: number;
  acceptedQuantity?: number;
  rejectedQuantity?: number;
  unit?: string;
  packageCondition?: PackageCondition;
  batchNumber?: string;
  expiryDate?: string;
  notes?: string;
}

export interface CreateGoodsReceiptNoteDto {
  organizationId: string;
  companyId: string;
  poId: string;
  vendorId: string;
  warehouseId: string;
  receivedDate?: string;
  receivedById: string;
  receivedByName?: string;
  carrierName?: string;
  vehicleNumber?: string;
  deliveryNoteNumber?: string;
  notes?: string;
  items: GoodsReceiptNoteItemDto[];
}

export interface UpdateQcStatusDto {
  grnId: string;
  qcStatus: QcStatus;
  qcNotes?: string;
  acceptedQuantities?: Record<string, number>;
  rejectedQuantities?: Record<string, number>;
}

export interface GoodsReceiptFilterDto {
  organizationId?: string;
  companyId?: string;
  poId?: string;
  vendorId?: string;
  warehouseId?: string;
  status?: GoodsReceiptStatus;
  qcStatus?: QcStatus;
  search?: string;
  page?: number;
  limit?: number;
}

// ==========================================
// 8. VENDOR PERFORMANCE TYPES
// ==========================================

export interface VendorPerformanceDto {
  vendorId: string;
  companyId: string;
  totalOrders: number;
  completedOrders: number;
  onTimeDeliveryRate: number; // e.g. 98.5%
  rejectionRate: number; // e.g. 0.8%
  averageLeadDays: number; // e.g. 6.2 days
  overallRating: number; // 1.0 - 5.0
  lastEvaluatedAt: string;
  evaluationNotes?: string;
}
