/**
 * SHEHSWAR ONE360 - Phase 4.5 Master Data Expansion DTOs
 */
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsNumber,
  IsUUID,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

// 1. Unit of Measure
export class CreateUnitOfMeasureDto {
  @IsUUID()
  @IsOptional()
  organizationId?: string;

  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsOptional()
  category?: string; // WEIGHT, VOLUME, COUNT, LENGTH

  @IsString()
  @IsOptional()
  type?: string;

  @IsString()
  @IsOptional()
  symbol?: string;

  @IsNumber()
  @IsOptional()
  decimalPlaces?: number;

  @IsBoolean()
  @IsOptional()
  isBaseUnit?: boolean;
}

export class UpdateUnitOfMeasureDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  category?: string;

  @IsString()
  @IsOptional()
  symbol?: string;

  @IsNumber()
  @IsOptional()
  decimalPlaces?: number;

  @IsBoolean()
  @IsOptional()
  isBaseUnit?: boolean;

  @IsString()
  @IsOptional()
  status?: string;
}

// 2. UOM Conversion
export class CreateUomConversionDto {
  @IsUUID()
  @IsOptional()
  organizationId?: string;

  @IsUUID()
  @IsNotEmpty()
  fromUomId!: string;

  @IsUUID()
  @IsNotEmpty()
  toUomId!: string;

  @IsNumber()
  @IsNotEmpty()
  conversionFactor!: number;

  @IsUUID()
  @IsOptional()
  rawMaterialId?: string;

  @IsUUID()
  @IsOptional()
  packingMaterialId?: string;

  @IsUUID()
  @IsOptional()
  finishedProductId?: string;
}

// 3. Material Category
export class CreateMaterialCategoryDto {
  @IsUUID()
  @IsOptional()
  organizationId?: string;

  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsOptional()
  categoryType?: string; // RAW_MATERIAL, PACKING_MATERIAL, BOTH

  @IsString()
  @IsOptional()
  type?: string;

  @IsString()
  @IsOptional()
  description?: string;
}

export class UpdateMaterialCategoryDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  categoryType?: string;

  @IsString()
  @IsOptional()
  type?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  status?: string;
}

// 4. Raw Material
export class CreateRawMaterialDto {
  @IsUUID()
  @IsOptional()
  organizationId?: string;

  @IsUUID()
  @IsOptional()
  companyId?: string;

  @IsUUID()
  @IsOptional()
  categoryId?: string;

  @IsUUID()
  @IsOptional()
  baseUomId?: string;

  @IsUUID()
  @IsOptional()
  purchaseUomId?: string;

  @IsString()
  @IsNotEmpty()
  materialCode!: string;

  @IsString()
  @IsNotEmpty()
  materialName!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber()
  @IsOptional()
  purchaseConversionFactor?: number;

  @IsBoolean()
  @IsOptional()
  batchControlled?: boolean;

  @IsBoolean()
  @IsOptional()
  expiryControlled?: boolean;

  @IsNumber()
  @IsOptional()
  shelfLifeDays?: number;

  @IsBoolean()
  @IsOptional()
  qcRequired?: boolean;

  @IsNumber()
  @IsOptional()
  minimumStock?: number;

  @IsNumber()
  @IsOptional()
  maximumStock?: number;

  @IsNumber()
  @IsOptional()
  reorderLevel?: number;

  @IsNumber()
  @IsOptional()
  minStock?: number;

  @IsNumber()
  @IsOptional()
  reorderPoint?: number;

  @IsString()
  @IsOptional()
  grade?: string;

  @IsString()
  @IsOptional()
  specifications?: string;

  @IsBoolean()
  @IsOptional()
  isHazardous?: boolean;

  @IsString()
  @IsOptional()
  storageRequirements?: string;

  @IsNumber()
  @IsOptional()
  standardCost?: number;

  @IsNumber()
  @IsOptional()
  lastPurchaseCost?: number;

  @IsString()
  @IsOptional()
  hsCode?: string;

  @IsString()
  @IsOptional()
  status?: string;

  @IsString()
  @IsOptional()
  approvalStatus?: string;
}

export class UpdateRawMaterialDto {
  @IsUUID()
  @IsOptional()
  categoryId?: string;

  @IsUUID()
  @IsOptional()
  baseUomId?: string;

  @IsUUID()
  @IsOptional()
  purchaseUomId?: string;

  @IsString()
  @IsOptional()
  materialName?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber()
  @IsOptional()
  purchaseConversionFactor?: number;

  @IsBoolean()
  @IsOptional()
  batchControlled?: boolean;

  @IsBoolean()
  @IsOptional()
  expiryControlled?: boolean;

  @IsNumber()
  @IsOptional()
  shelfLifeDays?: number;

  @IsBoolean()
  @IsOptional()
  qcRequired?: boolean;

  @IsNumber()
  @IsOptional()
  minimumStock?: number;

  @IsNumber()
  @IsOptional()
  maximumStock?: number;

  @IsNumber()
  @IsOptional()
  reorderLevel?: number;

  @IsNumber()
  @IsOptional()
  minStock?: number;

  @IsNumber()
  @IsOptional()
  reorderPoint?: number;

  @IsString()
  @IsOptional()
  grade?: string;

  @IsString()
  @IsOptional()
  specifications?: string;

  @IsBoolean()
  @IsOptional()
  isHazardous?: boolean;

  @IsString()
  @IsOptional()
  storageRequirements?: string;

  @IsNumber()
  @IsOptional()
  standardCost?: number;

  @IsNumber()
  @IsOptional()
  lastPurchaseCost?: number;

  @IsString()
  @IsOptional()
  hsCode?: string;

  @IsString()
  @IsOptional()
  status?: string;

  @IsString()
  @IsOptional()
  approvalStatus?: string;
}

// 5. Packing Material
export class CreatePackingMaterialDto {
  @IsUUID()
  @IsOptional()
  organizationId?: string;

  @IsUUID()
  @IsOptional()
  companyId?: string;

  @IsUUID()
  @IsOptional()
  categoryId?: string;

  @IsUUID()
  @IsOptional()
  baseUomId?: string;

  @IsUUID()
  @IsOptional()
  purchaseUomId?: string;

  @IsString()
  @IsNotEmpty()
  materialCode!: string;

  @IsString()
  @IsNotEmpty()
  materialName!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  packCompatibility?: string;

  @IsBoolean()
  @IsOptional()
  batchControlled?: boolean;

  @IsNumber()
  @IsOptional()
  minimumStock?: number;

  @IsNumber()
  @IsOptional()
  maximumStock?: number;

  @IsNumber()
  @IsOptional()
  reorderLevel?: number;

  @IsNumber()
  @IsOptional()
  standardCost?: number;

  @IsNumber()
  @IsOptional()
  lastPurchaseCost?: number;

  @IsString()
  @IsOptional()
  status?: string;
}

export class UpdatePackingMaterialDto {
  @IsUUID()
  @IsOptional()
  categoryId?: string;

  @IsUUID()
  @IsOptional()
  baseUomId?: string;

  @IsUUID()
  @IsOptional()
  purchaseUomId?: string;

  @IsString()
  @IsOptional()
  materialName?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  packCompatibility?: string;

  @IsBoolean()
  @IsOptional()
  batchControlled?: boolean;

  @IsNumber()
  @IsOptional()
  minimumStock?: number;

  @IsNumber()
  @IsOptional()
  maximumStock?: number;

  @IsNumber()
  @IsOptional()
  reorderLevel?: number;

  @IsNumber()
  @IsOptional()
  standardCost?: number;

  @IsNumber()
  @IsOptional()
  lastPurchaseCost?: number;

  @IsString()
  @IsOptional()
  status?: string;
}

// 6. Product Category
export class CreateProductCategoryDto {
  @IsUUID()
  @IsOptional()
  organizationId?: string;

  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  taxClassification?: string;

  @IsNumber()
  @IsOptional()
  taxRate?: number;

  @IsString()
  @IsOptional()
  status?: string;
}

export class UpdateProductCategoryDto {
  @IsString()
  @IsOptional()
  code?: string;

  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  taxClassification?: string;

  @IsNumber()
  @IsOptional()
  taxRate?: number;

  @IsString()
  @IsOptional()
  status?: string;
}

// 7. Pack Size
export class CreatePackSizeDto {
  @IsUUID()
  @IsOptional()
  organizationId?: string;

  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsNumber()
  @IsNotEmpty()
  quantity!: number;

  @IsUUID()
  @IsOptional()
  uomId?: string;
}

export class UpdatePackSizeDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsNumber()
  @IsOptional()
  quantity?: number;

  @IsUUID()
  @IsOptional()
  uomId?: string;

  @IsString()
  @IsOptional()
  status?: string;
}

// 8. Finished Product
export class CreateFinishedProductDto {
  @IsUUID()
  @IsOptional()
  organizationId?: string;

  @IsUUID()
  @IsOptional()
  companyId?: string;

  @IsUUID()
  @IsOptional()
  categoryId?: string;

  @IsUUID()
  @IsOptional()
  packSizeId?: string;

  @IsUUID()
  @IsOptional()
  baseUomId?: string;

  @IsUUID()
  @IsOptional()
  salesUomId?: string;

  @IsString()
  @IsNotEmpty()
  productCode!: string;

  @IsString()
  @IsOptional()
  sku?: string;

  @IsString()
  @IsNotEmpty()
  productName!: string;

  @IsString()
  @IsOptional()
  brand?: string;

  @IsString()
  @IsOptional()
  grade?: string;

  @IsString()
  @IsOptional()
  fertilizerType?: string;

  @IsString()
  @IsOptional()
  productForm?: string;

  @IsNumber()
  @IsOptional()
  bagWeight?: number;

  @IsString()
  @IsOptional()
  barcode?: string;

  @IsBoolean()
  @IsOptional()
  batchControlled?: boolean;

  @IsBoolean()
  @IsOptional()
  expiryControlled?: boolean;

  @IsNumber()
  @IsOptional()
  shelfLifeDays?: number;

  @IsNumber()
  @IsOptional()
  minimumStock?: number;

  @IsNumber()
  @IsOptional()
  reorderLevel?: number;

  @IsNumber()
  @IsOptional()
  standardCost?: number;

  @IsNumber()
  @IsOptional()
  defaultSellingPrice?: number;

  @IsString()
  @IsOptional()
  hsCode?: string;

  @IsString()
  @IsOptional()
  status?: string;
}

export class UpdateFinishedProductDto {
  @IsUUID()
  @IsOptional()
  categoryId?: string;

  @IsUUID()
  @IsOptional()
  packSizeId?: string;

  @IsUUID()
  @IsOptional()
  baseUomId?: string;

  @IsUUID()
  @IsOptional()
  salesUomId?: string;

  @IsString()
  @IsOptional()
  productName?: string;

  @IsString()
  @IsOptional()
  brand?: string;

  @IsString()
  @IsOptional()
  grade?: string;

  @IsString()
  @IsOptional()
  fertilizerType?: string;

  @IsString()
  @IsOptional()
  productForm?: string;

  @IsNumber()
  @IsOptional()
  bagWeight?: number;

  @IsString()
  @IsOptional()
  barcode?: string;

  @IsBoolean()
  @IsOptional()
  batchControlled?: boolean;

  @IsBoolean()
  @IsOptional()
  expiryControlled?: boolean;

  @IsNumber()
  @IsOptional()
  shelfLifeDays?: number;

  @IsNumber()
  @IsOptional()
  minimumStock?: number;

  @IsNumber()
  @IsOptional()
  reorderLevel?: number;

  @IsNumber()
  @IsOptional()
  standardCost?: number;

  @IsNumber()
  @IsOptional()
  defaultSellingPrice?: number;

  @IsString()
  @IsOptional()
  hsCode?: string;

  @IsString()
  @IsOptional()
  status?: string;
}

// 9. Warehouse Location
export class CreateWarehouseLocationDto {
  @IsUUID()
  @IsNotEmpty()
  warehouseId!: string;

  @IsUUID()
  @IsOptional()
  parentLocationId?: string;

  @IsString()
  @IsNotEmpty()
  locationCode!: string;

  @IsString()
  @IsNotEmpty()
  locationName!: string;

  @IsString()
  @IsNotEmpty()
  locationType!: string; // ZONE, RACK, BIN, SHELF

  @IsNumber()
  @IsOptional()
  capacity?: number;

  @IsString()
  @IsOptional()
  capacityUom?: string;

  @IsString()
  @IsOptional()
  allowedMaterialCategory?: string;
}

export class UpdateWarehouseLocationDto {
  @IsUUID()
  @IsOptional()
  parentLocationId?: string;

  @IsString()
  @IsOptional()
  locationName?: string;

  @IsString()
  @IsOptional()
  locationType?: string;

  @IsNumber()
  @IsOptional()
  capacity?: number;

  @IsString()
  @IsOptional()
  capacityUom?: string;

  @IsString()
  @IsOptional()
  allowedMaterialCategory?: string;

  @IsString()
  @IsOptional()
  status?: string;
}

// 10. Production Line
export class CreateProductionLineDto {
  @IsUUID()
  @IsOptional()
  companyId?: string;

  @IsUUID()
  @IsOptional()
  plantId?: string;

  @IsString()
  @IsNotEmpty()
  lineCode!: string;

  @IsString()
  @IsNotEmpty()
  lineName!: string;

  @IsNumber()
  @IsOptional()
  capacity?: number;

  @IsUUID()
  @IsOptional()
  capacityUomId?: string;

  @IsString()
  @IsOptional()
  productCompatibility?: string;
}

export class UpdateProductionLineDto {
  @IsUUID()
  @IsOptional()
  plantId?: string;

  @IsString()
  @IsOptional()
  lineName?: string;

  @IsNumber()
  @IsOptional()
  capacity?: number;

  @IsUUID()
  @IsOptional()
  capacityUomId?: string;

  @IsString()
  @IsOptional()
  productCompatibility?: string;

  @IsString()
  @IsOptional()
  status?: string;
}

// 11. Shift
export class CreateShiftDto {
  @IsUUID()
  @IsOptional()
  companyId?: string;

  @IsUUID()
  @IsOptional()
  plantId?: string;

  @IsString()
  @IsNotEmpty()
  shiftCode!: string;

  @IsString()
  @IsNotEmpty()
  shiftName!: string;

  @IsString()
  @IsNotEmpty()
  startTime!: string;

  @IsString()
  @IsNotEmpty()
  endTime!: string;
}

export class UpdateShiftDto {
  @IsUUID()
  @IsOptional()
  plantId?: string;

  @IsString()
  @IsOptional()
  shiftName?: string;

  @IsString()
  @IsOptional()
  startTime?: string;

  @IsString()
  @IsOptional()
  endTime?: string;

  @IsString()
  @IsOptional()
  status?: string;
}

// 12. QC Specification
export class CreateQcParameterDto {
  @IsString()
  @IsNotEmpty()
  parameterName!: string;

  @IsNumber()
  @IsOptional()
  minimumValue?: number;

  @IsNumber()
  @IsOptional()
  maximumValue?: number;

  @IsNumber()
  @IsOptional()
  targetValue?: number;

  @IsString()
  @IsOptional()
  uom?: string;

  @IsString()
  @IsOptional()
  testMethod?: string;

  @IsBoolean()
  @IsOptional()
  mandatory?: boolean;

  @IsNumber()
  @IsOptional()
  sortOrder?: number;
}

export class CreateQcSpecificationDto {
  @IsUUID()
  @IsOptional()
  organizationId?: string;

  @IsUUID()
  @IsOptional()
  companyId?: string;

  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  appliesToType!: string; // RAW_MATERIAL | FINISHED_PRODUCT

  @IsUUID()
  @IsOptional()
  rawMaterialId?: string;

  @IsUUID()
  @IsOptional()
  finishedProductId?: string;

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => CreateQcParameterDto)
  parameters?: CreateQcParameterDto[];
}

export class UpdateQcSpecificationDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  status?: string;

  @IsString()
  @IsOptional()
  approvalStatus?: string;
}

// 13. Formula / BOM
export class CreateFormulaComponentDto {
  @IsString()
  @IsNotEmpty()
  componentType!: string; // RAW_MATERIAL | PACKING_MATERIAL

  @IsUUID()
  @IsOptional()
  rawMaterialId?: string;

  @IsUUID()
  @IsOptional()
  packingMaterialId?: string;

  @IsNumber()
  @IsNotEmpty()
  quantity!: number;

  @IsUUID()
  @IsOptional()
  uomId?: string;

  @IsNumber()
  @IsOptional()
  expectedWastagePercent?: number;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsNumber()
  @IsOptional()
  sortOrder?: number;
}

export class CreateFormulaBomDto {
  @IsUUID()
  @IsOptional()
  organizationId?: string;

  @IsUUID()
  @IsOptional()
  companyId?: string;

  @IsUUID()
  @IsNotEmpty()
  finishedProductId!: string;

  @IsString()
  @IsNotEmpty()
  formulaCode!: string;

  @IsNumber()
  @IsNotEmpty()
  standardBatchSize!: number;

  @IsUUID()
  @IsOptional()
  batchSizeUomId?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => CreateFormulaComponentDto)
  components?: CreateFormulaComponentDto[];
}

export class UpdateFormulaBomDto {
  @IsNumber()
  @IsOptional()
  standardBatchSize?: number;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsString()
  @IsOptional()
  status?: string;

  @IsString()
  @IsOptional()
  approvalStatus?: string;
}

// 14. Payment Term
export class CreatePaymentTermDto {
  @IsUUID()
  @IsOptional()
  companyId?: string;

  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsNumber()
  @IsNotEmpty()
  days!: number;

  @IsString()
  @IsNotEmpty()
  paymentType!: string; // ADVANCE | CASH | CREDIT | CUSTOM

  @IsString()
  @IsOptional()
  description?: string;
}

export class UpdatePaymentTermDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsNumber()
  @IsOptional()
  days?: number;

  @IsString()
  @IsOptional()
  paymentType?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  status?: string;
}

// 15. Tax Category
export class CreateTaxCategoryDto {
  @IsUUID()
  @IsOptional()
  companyId?: string;

  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsNumber()
  @IsNotEmpty()
  rate!: number;

  @IsString()
  @IsOptional()
  description?: string;
}

export class UpdateTaxCategoryDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsNumber()
  @IsOptional()
  rate?: number;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  status?: string;
}

// 16. Intercompany Pricing Rule
export class CreateIntercompanyPricingRuleDto {
  @IsUUID()
  @IsOptional()
  organizationId?: string;

  @IsUUID()
  @IsNotEmpty()
  sourceCompanyId!: string;

  @IsUUID()
  @IsNotEmpty()
  targetCompanyId!: string;

  @IsUUID()
  @IsOptional()
  finishedProductId?: string;

  @IsUUID()
  @IsOptional()
  productCategoryId?: string;

  @IsString()
  @IsNotEmpty()
  pricingMethod!: string; // PERCENTAGE | FIXED_AMOUNT | MANUAL_APPROVED_PRICE

  @IsNumber()
  @IsOptional()
  markupPercent?: number;

  @IsNumber()
  @IsOptional()
  fixedMarkupAmount?: number;

  @IsNumber()
  @IsOptional()
  manualApprovedPrice?: number;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class UpdateIntercompanyPricingRuleDto {
  @IsString()
  @IsOptional()
  pricingMethod?: string;

  @IsNumber()
  @IsOptional()
  markupPercent?: number;

  @IsNumber()
  @IsOptional()
  fixedMarkupAmount?: number;

  @IsNumber()
  @IsOptional()
  manualApprovedPrice?: number;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsString()
  @IsOptional()
  status?: string;

  @IsString()
  @IsOptional()
  approvalStatus?: string;
}

// 17. Reason Code
export class CreateReasonCodeDto {
  @IsUUID()
  @IsOptional()
  organizationId?: string;

  @IsString()
  @IsNotEmpty()
  category!: string; // RETURN | ADJUSTMENT | WASTAGE | REJECTION | OTHER

  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class UpdateReasonCodeDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
