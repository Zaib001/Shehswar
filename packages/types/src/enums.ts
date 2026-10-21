/**
 * SHEHSWAR ONE360 - Global System Enums
 */

export enum Action {
  // Standard CRUD & Document Lifecycle
  VIEW = 'view',
  CREATE = 'create',
  EDIT = 'edit',
  DELETE = 'delete',
  ARCHIVE = 'archive',
  SUBMIT = 'submit',
  APPROVE = 'approve',
  REJECT = 'reject',
  SEND_BACK = 'send_back',
  HOLD = 'hold',
  RELEASE = 'release',
  CANCEL = 'cancel',
  REOPEN = 'reopen',
  PRINT = 'print',
  EXPORT = 'export',
  IMPORT = 'import',
  ASSIGN = 'assign',
  REASSIGN = 'reassign',
  OVERRIDE = 'override',

  // Sensitive & Domain Specific Permissions
  VIEW_COST = 'view_cost',
  VIEW_MARGIN = 'view_margin',
  VIEW_PRODUCT_COST = 'view_product_cost',
  VIEW_PARENT_MANUFACTURING_COST = 'view_parent_manufacturing_cost',
  VIEW_PARENT_MARGIN = 'view_parent_margin',
  VIEW_INTERCOMPANY_PRICE = 'view_intercompany_price',
  MODIFY_INTERCOMPANY_PRICE = 'modify_intercompany_price',
  APPROVE_INTERCOMPANY_PRICE = 'approve_intercompany_price',
  VIEW_CHILD_MARGIN = 'view_child_margin',
  VIEW_CONSOLIDATED_MARGIN = 'view_consolidated_margin',
  EDIT_FORMULA = 'edit_formula',
  APPROVE_FORMULA = 'approve_formula',
  MODIFY_PRICE = 'modify_price',
  MODIFY_CREDIT_LIMIT = 'modify_credit_limit',
  APPROVE_CREDIT_OVERRIDE = 'approve_credit_override',
  ADJUST_STOCK = 'adjust_stock',
  RELEASE_BATCH = 'release_batch',
  RECALL_BATCH = 'recall_batch',
  BACKDATE_TRANSACTION = 'backdate_transaction',
  REOPEN_APPROVED = 'reopen_approved',
  VIEW_AUDIT_LOGS = 'view_audit_logs',
}

export enum Resource {
  // Platform & Core
  TENANT = 'tenant',
  ORGANIZATION = 'organization',
  GROUP = 'group',
  COMPANY = 'company',
  PLANT = 'plant',
  BRANCH = 'branch',
  DEPARTMENT = 'department',
  WAREHOUSE = 'warehouse',
  REGION = 'region',
  ZONE = 'zone',
  TERRITORY = 'territory',
  USER = 'user',
  ROLE = 'role',
  PERMISSION = 'permission',
  AUDIT_LOG = 'audit_log',
  SETTING = 'setting',
  FEATURE_FLAG = 'feature_flag',
  FILE = 'file',
  DOCUMENT_SEQUENCE = 'document_sequence',
  APPROVAL_WORKFLOW = 'approval_workflow',
  NOTIFICATION = 'notification',

  // Master Data Expansion (Phase 4.5)
  UNIT_OF_MEASURE = 'unit_of_measure',
  UOM_CONVERSION = 'uom_conversion',
  MATERIAL_CATEGORY = 'material_category',
  RAW_MATERIAL = 'raw_material',
  PACKING_MATERIAL = 'packing_material',
  PRODUCT_CATEGORY = 'product_category',
  FINISHED_PRODUCT = 'finished_product',
  PACK_SIZE = 'pack_size',
  WAREHOUSE_LOCATION = 'warehouse_location',
  PRODUCTION_LINE = 'production_line',
  SHIFT = 'shift',
  QC_SPECIFICATION = 'qc_specification',
  PAYMENT_TERM = 'payment_term',
  TAX_CATEGORY = 'tax_category',
  INTERCOMPANY_PRICING = 'intercompany_pricing',
  REASON_CODE = 'reason_code',

  // Business Modules (Procurement & Operations)
  VENDOR = 'vendor',
  PURCHASE_REQUISITION = 'purchase_requisition',
  RFQ = 'rfq',
  QUOTATION = 'quotation',
  QUOTATION_COMPARISON = 'quotation_comparison',
  PURCHASE_ORDER = 'purchase_order',
  GOODS_RECEIPT = 'goods_receipt',
  VENDOR_PERFORMANCE = 'vendor_performance',
  QC_INSPECTION = 'qc_inspection',
  FORMULA_BOM = 'formula_bom',
  PRODUCTION_ORDER = 'production_order',
  PRODUCTION_BATCH = 'production_batch',
  FINISHED_BATCH = 'finished_batch',
  PACKING = 'packing',
  COSTING = 'costing',
  INTERCOMPANY_ORDER = 'intercompany_order',
  DEALER = 'dealer',
  SALES_ORDER = 'sales_order',
  DISPATCH = 'dispatch',
  COLLECTION = 'collection',
  INVOICE = 'invoice',
  ACCOUNTING = 'accounting',
  REPORT = 'report',
  INTEGRATION = 'integration',
  EMPLOYEE = 'employee',
  VEHICLE = 'vehicle',
  CREDIT_CONTROL = 'credit_control',
  EMPLOYEE_COST = 'employee_cost',
  EXPENSE_CONTROL = 'expense_control',
}

export enum EmployeeCostStatus {
  WITHIN_LIMIT = 'WITHIN_LIMIT',
  NEAR_LIMIT = 'NEAR_LIMIT',
  LIMIT_REACHED = 'LIMIT_REACHED',
  LIMIT_EXCEEDED = 'LIMIT_EXCEEDED',
  NO_SALES = 'NO_SALES',
  REVIEW_REQUIRED = 'REVIEW_REQUIRED',
  PENDING_APPROVAL = 'PENDING_APPROVAL',
  BLOCKED = 'BLOCKED',
}

export enum PercentageCreditStatus {
  WITHIN_LIMIT = 'WITHIN_LIMIT',
  NEAR_LIMIT = 'NEAR_LIMIT',
  LIMIT_REACHED = 'LIMIT_REACHED',
  LIMIT_EXCEEDED = 'LIMIT_EXCEEDED',
  CREDIT_LOCK = 'CREDIT_LOCK',
  PENDING_APPROVAL = 'PENDING_APPROVAL',
}

export enum ApprovalStatus {
  DRAFT = 'draft',
  SUBMITTED = 'submitted',
  PENDING_APPROVAL = 'pending_approval',
  APPROVED = 'approved',
  PARTIALLY_APPROVED = 'partially_approved',
  REJECTED = 'rejected',
  SENT_BACK = 'sent_back',
  ON_HOLD = 'on_hold',
  CANCELLED = 'cancelled',
  REOPENED = 'reopened',
}

export enum DocumentType {
  PR = 'PR', // Purchase Requisition
  RFQ = 'RFQ', // Request For Quotation
  PO = 'PO', // Purchase Order
  GRN = 'GRN', // Goods Received Note
  QC = 'QC', // QC Inspection Report
  PROD_ORDER = 'PROD_ORDER', // Production Order
  BATCH = 'BATCH', // Manufacturing Batch
  PACKING_ORDER = 'PACKING_ORDER', // Packing Order
  SO = 'SO', // Sales Order
  DISPATCH_NOTE = 'DISPATCH_NOTE', // Dispatch Note
  INVOICE = 'INVOICE', // Sales / Intercompany Invoice
  COLLECTION = 'COLLECTION', // Payment Collection
  INTERCOMPANY_REQ = 'IC_REQ', // Intercompany Requisition
  STOCK_ADJUSTMENT = 'STOCK_ADJ', // Stock Adjustment
}

export enum DataClassification {
  PUBLIC = 'public',
  INTERNAL = 'internal',
  CONFIDENTIAL = 'confidential',
  HIGHLY_SENSITIVE = 'highly_sensitive',
}

export enum UnitOfMeasure {
  KG = 'kg',
  TON = 'ton',
  BAG = 'bag',
  LITER = 'liter',
  PIECE = 'piece',
  PACK = 'pack',
}

export enum StorageProvider {
  S3 = 's3',
  R2 = 'r2',
  MINIO = 'minio',
  LOCAL = 'local',
}

export enum NotificationChannel {
  IN_APP = 'in_app',
  EMAIL = 'email',
  SMS = 'sms',
  WHATSAPP = 'whatsapp',
  PUSH = 'push',
}

export enum ConfigurationScope {
  PLATFORM = 'platform',
  ORGANIZATION = 'organization',
  COMPANY = 'company',
  BRANCH = 'branch',
  USER = 'user',
}
