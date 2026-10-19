/**
 * SHEHSWAR ONE360 - Procurement Types & Initial Empty Collections
 * All data is loaded directly from PostgreSQL via backend REST APIs.
 */
import {
  VendorType,
  VendorStatus,
  PurchaseRequisitionStatus,
  RequisitionPriority,
  RfqStatus,
  RfqVendorStatus,
  QuotationStatus,
  PurchaseOrderStatus,
  GoodsReceiptStatus,
  QcStatus,
  PackageCondition,
} from '@shehswar/types';

export interface ProcurementVendor {
  id: string;
  organizationId: string;
  companyId: string;
  code: string;
  name: string;
  legalName?: string;
  vendorType: VendorType | string;
  category: string;
  status: VendorStatus | string;
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
  rating?: number;
  bankDetails?: {
    bankName?: string;
    accountTitle?: string;
    accountNumber?: string;
    iban?: string;
    branchCode?: string;
  };
  notes?: string;
  documents?: {
    id: string;
    documentType: string;
    title: string;
    fileName: string;
    fileSize: number;
    expiryDate?: string;
  }[];
  purchaseHistory?: {
    poNumber: string;
    date: string;
    amount: number;
    status: string;
  }[];
  performance?: {
    totalOrders?: number;
    completedOrders?: number;
    onTimeDeliveryRate?: number;
    rejectionRate?: number;
    averageLeadDays?: number;
    overallRating?: number;
    lastEvaluatedAt?: string;
  };
}

export const INITIAL_PROCUREMENT_VENDORS: ProcurementVendor[] = [];

export interface ProcurementPR {
  id: string;
  organizationId: string;
  companyId: string;
  departmentId?: string;
  departmentName?: string;
  prNumber: string;
  requestedById?: string;
  requestedByName?: string;
  requiredDate: string;
  priority: RequisitionPriority | string;
  purpose: string;
  notes?: string;
  status: PurchaseRequisitionStatus | string;
  totalEstimatedAmount: number;
  approvedAt?: string;
  approvedByName?: string;
  createdAt: string;
  items: {
    id: string;
    itemName: string;
    category?: string;
    quantity: number;
    unit: string;
    requiredDate?: string;
    specification?: string;
    estimatedRate: number;
    estimatedAmount: number;
    notes?: string;
  }[];
}

export const INITIAL_PURCHASE_REQUISITIONS: ProcurementPR[] = [];

export interface ProcurementRFQ {
  id: string;
  organizationId: string;
  companyId: string;
  rfqNumber: string;
  prId?: string;
  prNumber?: string;
  title: string;
  issueDate: string;
  deadline: string;
  status: RfqStatus | string;
  notes?: string;
  invitedVendors: {
    vendorId: string;
    vendorCode?: string;
    vendorName?: string;
    status: RfqVendorStatus | string;
    hasQuotation?: boolean;
  }[];
}

export const INITIAL_RFQS: ProcurementRFQ[] = [];

export interface ProcurementQuotation {
  id: string;
  organizationId: string;
  companyId: string;
  rfqId: string;
  rfqNumber?: string;
  vendorId: string;
  vendorCode?: string;
  vendorName?: string;
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
  status: QuotationStatus | string;
  isSelected?: boolean;
  selectionJustification?: string;
  items: {
    itemName: string;
    quantity: number;
    unit: string;
    unitPrice: number;
    taxRate: number;
    discountRate?: number;
    lineTotal: number;
  }[];
}

export const INITIAL_QUOTATIONS: ProcurementQuotation[] = [];

export interface ProcurementPO {
  id: string;
  organizationId: string;
  companyId: string;
  departmentName?: string;
  vendorId: string;
  vendorName?: string;
  vendorCode?: string;
  poNumber: string;
  currency: string;
  paymentTerms?: string;
  deliveryLocation?: string;
  expectedDeliveryDate?: string;
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
  status: PurchaseOrderStatus | string;
  approvedByName?: string;
  approvedAt?: string;
  createdAt: string;
  items: {
    id: string;
    itemName: string;
    category?: string;
    quantity: number;
    unit: string;
    unitRate: number;
    taxRate: number;
    taxAmount: number;
    discountRate?: number;
    discountAmount?: number;
    lineTotal: number;
    receivedQuantity: number;
  }[];
}

export const INITIAL_PURCHASE_ORDERS: ProcurementPO[] = [];

export interface ProcurementGRN {
  id: string;
  organizationId: string;
  companyId: string;
  grnNumber: string;
  poNumber?: string;
  poId: string;
  vendorName?: string;
  vendorCode?: string;
  warehouseName?: string;
  receivedDate: string;
  receivedByName?: string;
  carrierName?: string;
  vehicleNumber?: string;
  deliveryNoteNumber?: string;
  status: GoodsReceiptStatus | string;
  qcStatus: QcStatus | string;
  qcNotes?: string;
  notes?: string;
  items: {
    id: string;
    poItemId?: string;
    itemName: string;
    orderedQuantity: number;
    receivedQuantity: number;
    acceptedQuantity: number;
    rejectedQuantity: number;
    unit: string;
    packageCondition: PackageCondition | string;
    batchNumber?: string;
    expiryDate?: string;
    notes?: string;
  }[];
}

export const INITIAL_GOODS_RECEIPTS: ProcurementGRN[] = [];

export interface VendorScorecard {
  vendorId: string;
  vendorName: string;
  vendorCode: string;
  category: string;
  totalSpend: number;
  activeContracts: number;
  overallScore: number;
  onTimeDeliveryRate: number;
  qualityRate: number;
  pricingCompetitiveness: number;
  complianceRating: number;
  trend: 'UP' | 'DOWN' | 'STABLE';
}

export const INITIAL_VENDOR_SCORECARDS: VendorScorecard[] = [];
