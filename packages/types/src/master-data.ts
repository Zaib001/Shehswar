/**
 * SHEHSWAR ONE360 - Master Data & Organization Hierarchy Types
 */

export interface OrganizationDto {
  id: string;
  tenantId: string;
  code: string;
  name: string;
  legalName?: string | null;
  taxId?: string | null;
  strnId?: string | null;
  logoUrl?: string | null;
  industry?: string | null;
  country: string;
  currency: string;
  timezone: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  createdBy?: string | null;
  isActive: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface CompanyDto {
  id: string;
  organizationId: string;
  parentCompanyId?: string | null;
  code: string;
  name: string;
  legalName?: string | null;
  companyType: 'PARENT_MANUFACTURING' | 'CHILD_COMPANY' | 'TRADING' | 'DISTRIBUTION' | string;
  isParent: boolean;
  taxId?: string | null;
  strnId?: string | null;
  currencyCode: string;
  financialYear?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  managerName?: string | null;
  isActive: boolean;
  status: 'ACTIVE' | 'INACTIVE' | 'ARCHIVED' | string;
  parentCompany?: CompanyDto | null;
  childCompanies?: CompanyDto[];
  plants?: PlantDto[];
  branches?: BranchDto[];
  warehouses?: WarehouseDto[];
  departments?: DepartmentDto[];
  employees?: EmployeeDto[];
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface PlantDto {
  id: string;
  companyId: string;
  code: string;
  name: string;
  location?: string | null;
  address?: string | null;
  managerName?: string | null;
  isActive: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface BranchDto {
  id: string;
  companyId: string;
  code: string;
  name: string;
  address?: string | null;
  city?: string | null;
  regionName?: string | null;
  managerName?: string | null;
  isActive: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface DepartmentDto {
  id: string;
  companyId: string;
  code: string;
  name: string;
  managerName?: string | null;
  isActive: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export type WarehouseType =
  | 'RAW_MATERIAL'
  | 'FINISHED_GOODS'
  | 'PACKING_MATERIAL'
  | 'TRANSIT'
  | 'RETURNS'
  | 'QUARANTINE'
  | 'GENERAL';

export interface WarehouseDto {
  id: string;
  companyId: string;
  plantId?: string | null;
  branchId?: string | null;
  code: string;
  name: string;
  type: WarehouseType | string;
  location?: string | null;
  address?: string | null;
  managerName?: string | null;
  isActive: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface EmployeeDto {
  id: string;
  organizationId: string;
  companyId: string;
  departmentId?: string | null;
  plantId?: string | null;
  branchId?: string | null;
  employeeCode: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  email?: string | null;
  position: string;
  joiningDate: Date | string;
  status: 'ACTIVE' | 'ON_LEAVE' | 'TERMINATED' | string;
  managerId?: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface RoleDto {
  id: string;
  organizationId: string;
  code: string;
  name: string;
  description?: string | null;
  isSystem: boolean;
  permissions?: string[];
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface PermissionDto {
  id: string;
  resource: string;
  action: string;
  code: string;
  description?: string | null;
  isSensitive: boolean;
  createdAt: Date | string;
}

export interface DocumentSequenceDto {
  id: string;
  organizationId: string;
  companyId: string;
  documentType: string;
  fiscalYear: number;
  prefix: string;
  currentNumber: number | string;
  nextFormattedNumber?: string;
  updatedAt: Date | string;
}

// ==========================================
// PHASE 4.5 — EXPANDED MASTER DATA DTOS
// ==========================================

export interface UnitOfMeasureDto {
  id: string;
  organizationId: string;
  code: string;
  name: string;
  category: 'WEIGHT' | 'VOLUME' | 'COUNT' | 'LENGTH' | string;
  symbol?: string | null;
  decimalPlaces: number;
  isBaseUnit: boolean;
  status: 'ACTIVE' | 'INACTIVE' | 'ARCHIVED' | string;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface UomConversionDto {
  id: string;
  organizationId: string;
  fromUomId: string;
  toUomId: string;
  conversionFactor: number;
  rawMaterialId?: string | null;
  packingMaterialId?: string | null;
  finishedProductId?: string | null;
  effectiveFrom?: Date | string | null;
  effectiveTo?: Date | string | null;
  status: 'ACTIVE' | 'INACTIVE' | string;
  fromUom?: UnitOfMeasureDto;
  toUom?: UnitOfMeasureDto;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface MaterialCategoryDto {
  id: string;
  organizationId: string;
  code: string;
  name: string;
  description?: string | null;
  categoryType?: 'RAW_MATERIAL' | 'PACKING_MATERIAL' | 'BOTH' | string;
  type?: string;
  status: 'ACTIVE' | 'INACTIVE' | string;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface RawMaterialDto {
  id: string;
  organizationId: string;
  companyId: string;
  categoryId?: string | null;
  baseUomId?: string | null;
  purchaseUomId?: string | null;
  materialCode: string;
  materialName: string;
  description?: string | null;
  purchaseConversionFactor?: number | null;
  batchControlled: boolean;
  expiryControlled: boolean;
  shelfLifeDays?: number | null;
  qcRequired: boolean;
  minimumStock?: number | null;
  maximumStock?: number | null;
  reorderLevel?: number | null;
  storageRequirements?: string | null;
  standardCost?: number | null;
  lastPurchaseCost?: number | null;
  averageCost?: number | null;
  hsCode?: string | null;
  status: 'ACTIVE' | 'INACTIVE' | 'BLOCKED' | 'ARCHIVED' | string;
  approvalStatus: 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | string;
  category?: MaterialCategoryDto | null;
  baseUom?: UnitOfMeasureDto | null;
  purchaseUom?: UnitOfMeasureDto | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface PackingMaterialDto {
  id: string;
  organizationId: string;
  companyId: string;
  categoryId?: string | null;
  baseUomId?: string | null;
  purchaseUomId?: string | null;
  materialCode: string;
  materialName: string;
  description?: string | null;
  packCompatibility?: string | null;
  batchControlled: boolean;
  minimumStock?: number | null;
  maximumStock?: number | null;
  reorderLevel?: number | null;
  standardCost?: number | null;
  lastPurchaseCost?: number | null;
  status: 'ACTIVE' | 'INACTIVE' | string;
  approvalStatus: 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | string;
  category?: MaterialCategoryDto | null;
  baseUom?: UnitOfMeasureDto | null;
  purchaseUom?: UnitOfMeasureDto | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface ProductCategoryDto {
  id: string;
  organizationId: string;
  code: string;
  name: string;
  description?: string | null;
  status: 'ACTIVE' | 'INACTIVE' | string;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface PackSizeDto {
  id: string;
  organizationId: string;
  code: string;
  name: string;
  quantity: number;
  uomId?: string | null;
  status: 'ACTIVE' | 'INACTIVE' | string;
  uom?: UnitOfMeasureDto | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface FinishedProductDto {
  id: string;
  organizationId: string;
  companyId: string;
  categoryId?: string | null;
  packSizeId?: string | null;
  baseUomId?: string | null;
  salesUomId?: string | null;
  productCode: string;
  sku?: string | null;
  productName: string;
  brand?: string | null;
  grade?: string | null;
  fertilizerType?: string | null;
  productForm?: string | null;
  bagWeight?: number | null;
  barcode?: string | null;
  batchControlled: boolean;
  expiryControlled: boolean;
  shelfLifeDays?: number | null;
  minimumStock?: number | null;
  reorderLevel?: number | null;
  standardCost?: number | null;
  defaultSellingPrice?: number | null;
  hsCode?: string | null;
  status: 'ACTIVE' | 'INACTIVE' | string;
  approvalStatus: 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | string;
  category?: ProductCategoryDto | null;
  packSize?: PackSizeDto | null;
  baseUom?: UnitOfMeasureDto | null;
  salesUom?: UnitOfMeasureDto | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface WarehouseLocationDto {
  id: string;
  warehouseId: string;
  parentLocationId?: string | null;
  locationCode: string;
  locationName: string;
  locationType: 'ZONE' | 'RACK' | 'BIN' | 'SHELF' | string;
  capacity?: number | null;
  capacityUom?: string | null;
  allowedMaterialCategory?: string | null;
  status: 'ACTIVE' | 'INACTIVE' | string;
  parentLocation?: WarehouseLocationDto | null;
  childLocations?: WarehouseLocationDto[];
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface ProductionLineDto {
  id: string;
  companyId: string;
  plantId?: string | null;
  lineCode: string;
  lineName: string;
  capacity?: number | null;
  capacityUomId?: string | null;
  productCompatibility?: string | null;
  status: 'ACTIVE' | 'INACTIVE' | string;
  plant?: PlantDto | null;
  capacityUom?: UnitOfMeasureDto | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface ShiftDto {
  id: string;
  companyId: string;
  plantId?: string | null;
  shiftCode: string;
  shiftName: string;
  startTime: string;
  endTime: string;
  status: 'ACTIVE' | 'INACTIVE' | string;
  plant?: PlantDto | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface QcParameterDto {
  id: string;
  specificationId: string;
  parameterName: string;
  minimumValue?: number | null;
  maximumValue?: number | null;
  targetValue?: number | null;
  uom?: string | null;
  testMethod?: string | null;
  mandatory: boolean;
  sortOrder: number;
  createdAt: Date | string;
}

export interface QcSpecificationDto {
  id: string;
  organizationId: string;
  companyId: string;
  code: string;
  name: string;
  appliesToType: 'RAW_MATERIAL' | 'FINISHED_PRODUCT' | string;
  rawMaterialId?: string | null;
  finishedProductId?: string | null;
  version: number;
  effectiveFrom?: Date | string | null;
  effectiveTo?: Date | string | null;
  status: 'DRAFT' | 'ACTIVE' | 'INACTIVE' | string;
  approvalStatus: 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | string;
  parameters?: QcParameterDto[];
  rawMaterial?: RawMaterialDto | null;
  finishedProduct?: FinishedProductDto | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface FormulaBomComponentDto {
  id: string;
  formulaId: string;
  componentType: 'RAW_MATERIAL' | 'PACKING_MATERIAL' | string;
  rawMaterialId?: string | null;
  packingMaterialId?: string | null;
  quantity: number;
  uomId?: string | null;
  expectedWastagePercent: number;
  notes?: string | null;
  sortOrder: number;
  rawMaterial?: RawMaterialDto | null;
  packingMaterial?: PackingMaterialDto | null;
  uom?: UnitOfMeasureDto | null;
  createdAt: Date | string;
}

export interface FormulaBomDto {
  id: string;
  organizationId: string;
  companyId: string;
  finishedProductId: string;
  formulaCode: string;
  version: number;
  standardBatchSize: number;
  batchSizeUomId?: string | null;
  effectiveFrom?: Date | string | null;
  effectiveTo?: Date | string | null;
  notes?: string | null;
  status: 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'ACTIVE' | 'SUPERSEDED' | string;
  approvalStatus: 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | string;
  approvedAt?: Date | string | null;
  approvedById?: string | null;
  finishedProduct?: FinishedProductDto;
  batchSizeUom?: UnitOfMeasureDto | null;
  components?: FormulaBomComponentDto[];
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface PaymentTermDto {
  id: string;
  companyId: string;
  code: string;
  name: string;
  days: number;
  paymentType: 'ADVANCE' | 'CASH' | 'CREDIT' | 'CUSTOM' | string;
  description?: string | null;
  status: 'ACTIVE' | 'INACTIVE' | string;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface TaxCategoryDto {
  id: string;
  companyId: string;
  code: string;
  name: string;
  rate: number;
  effectiveFrom: Date | string;
  effectiveTo?: Date | string | null;
  description?: string | null;
  status: 'ACTIVE' | 'INACTIVE' | string;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface IntercompanyPricingRuleDto {
  id: string;
  organizationId: string;
  sourceCompanyId: string;
  targetCompanyId: string;
  finishedProductId?: string | null;
  productCategoryId?: string | null;
  pricingMethod: 'PERCENTAGE' | 'FIXED_AMOUNT' | 'MANUAL_APPROVED_PRICE' | string;
  markupPercent?: number | null;
  fixedMarkupAmount?: number | null;
  manualApprovedPrice?: number | null;
  effectiveFrom?: Date | string | null;
  effectiveTo?: Date | string | null;
  approvalStatus: 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | string;
  approvedAt?: Date | string | null;
  approvedById?: string | null;
  notes?: string | null;
  status: 'ACTIVE' | 'INACTIVE' | string;
  sourceCompany?: CompanyDto;
  targetCompany?: CompanyDto;
  finishedProduct?: FinishedProductDto | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface ReasonCodeDto {
  id: string;
  organizationId: string;
  category: 'RETURN' | 'ADJUSTMENT' | 'WASTAGE' | 'REJECTION' | 'OTHER' | string;
  code: string;
  name: string;
  description?: string | null;
  isActive: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface RegionDto {
  id: string;
  companyId: string;
  code: string;
  name: string;
  managerId?: string | null;
  isActive: boolean;
  company?: CompanyDto;
  businessManager?: { id: string; firstName: string; lastName: string; email?: string; phone?: string } | null;
  zones?: ZoneDto[];
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface ZoneDto {
  id: string;
  regionId: string;
  code: string;
  name: string;
  managerId?: string | null;
  isActive: boolean;
  region?: RegionDto;
  areaManager?: { id: string; firstName: string; lastName: string; email?: string; phone?: string } | null;
  territories?: TerritoryDto[];
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface TerritoryDto {
  id: string;
  zoneId: string;
  code: string;
  name: string;
  managerId?: string | null;
  isActive: boolean;
  zone?: ZoneDto;
  salesOfficer?: { id: string; firstName: string; lastName: string; email?: string; phone?: string } | null;
  dealers?: any[];
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface UserMarketAssignmentDto {
  id: string;
  organizationId: string;
  companyId: string;
  userId: string;
  employeeId?: string | null;
  regionId?: string | null;
  zoneId?: string | null;
  territoryId?: string | null;
  roleScope: 'BUSINESS_MANAGER' | 'AREA_MANAGER' | 'SALES_OFFICER' | string;
  isPrimary: boolean;
  effectiveFrom: Date | string;
  effectiveTo?: Date | string | null;
  status: 'ACTIVE' | 'INACTIVE' | string;
  region?: RegionDto | null;
  zone?: ZoneDto | null;
  territory?: TerritoryDto | null;
  user?: { id: string; firstName: string; lastName: string; email: string };
  employee?: { id: string; employeeCode: string; firstName: string; lastName: string };
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface DealerAssignmentHistoryDto {
  id: string;
  dealerId: string;
  salesOfficerId?: string | null;
  territoryId?: string | null;
  effectiveFrom: Date | string;
  effectiveTo?: Date | string | null;
  assignedById?: string | null;
  notes?: string | null;
  salesOfficer?: { id: string; firstName: string; lastName: string } | null;
  territory?: { id: string; name: string; code: string } | null;
  createdAt: Date | string;
}

export interface UserContextDto {
  userId: string;
  employeeId?: string | null;
  employeeCode?: string | null;
  email: string;
  firstName: string;
  lastName: string;
  company: { id: string; code: string; name: string; isParent: boolean };
  department?: { id: string; code: string; name: string } | null;
  role: string;
  roles: string[];
  permissions: string[];
  marketAssignments: Array<{
    id: string;
    roleScope: string;
    isPrimary: boolean;
    companyId: string;
    regionId?: string | null;
    regionName?: string | null;
    zoneId?: string | null;
    zoneName?: string | null;
    territoryId?: string | null;
    territoryName?: string | null;
    effectiveFrom: Date | string;
    effectiveTo?: Date | string | null;
    status: string;
  }>;
  responsibleManagers: {
    businessManager?: { id: string; name: string; phone?: string | null } | null;
    areaManager?: { id: string; name: string; phone?: string | null } | null;
  };
  authorizedTerritoryIds: string[];
  authorizedDealerIds: string[];
}

