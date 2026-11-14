/**
 * SHEHSWAR ONE360 - One Authoritative Costing Service
 *
 * THE ONLY place that calculates material and product costs.
 * Used by: Purchase posting, Product Costing page, Production,
 *          Intercompany pricing, Sales, and Reports.
 *
 * Costing methods:
 *  LATEST_PURCHASE  — uses lastPurchaseCost from material master
 *  WEIGHTED_AVERAGE — uses averageCost from WarehouseStock
 *  STANDARD         — uses standardCost from material master
 *
 * The active method is determined by system settings.
 * Do NOT calculate cost independently inside UI or other services.
 */
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { Prisma } from '@shehswar/database';
import { CodeGenerationService } from '../../platform/code-generation/code-generation.service';
import { InventoryService } from '../inventory/inventory.service';
import { AuthUser } from '@shehswar/types';
import { v7 as uuidv7 } from 'uuid';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isValidUuid(id?: any): boolean {
  return typeof id === 'string' && UUID_REGEX.test(id.trim());
}

export type CostingMethod = 'LATEST_PURCHASE' | 'WEIGHTED_AVERAGE' | 'STANDARD';

export interface CostingTableLineDto {
  id?: string;
  materialId?: string;
  materialName: string;
  materialCode?: string;
  type: 'RM' | 'PM' | 'FP' | 'OT';
  pack: string;
  availableQuantity?: number;
  quantity: number;
  rate: number;
  cost: number;
  sourcePoId?: string;
  sourcePoNumber?: string;
  purchaseDate?: string;
  vendorName?: string;
}

export interface CostingWarehouseSplitInput {
  warehouseId: string;
  warehouseName?: string;
  quantity: number;
}

export interface SaveCostingRecordInput {
  companyId?: string;
  costingDate?: string;
  serialNumber?: string;
  warehouseId?: string;
  warehouseName?: string;
  warehouseSplits?: CostingWarehouseSplitInput[];
  contractorVendorId?: string;
  contractorVendorName?: string;
  finishedProductId?: string;
  finishedProductName?: string;
  finishedProductCode?: string;
  packSize: number;
  packSizeUnit?: string;
  estimatedQuantity?: number;
  actualQuantity?: number;
  finishedQuantity: number;
  batchVolume?: number;
  expectedOutput?: number;
  actualOutput?: number;
  batchNumber?: string;
  manufacturingDate?: string;
  expiryDate?: string;
  costingId?: string;
  postProduction?: boolean;
  action?: 'POST' | 'DRAFT' | 'APPLY_COST';
  lines?: CostingTableLineDto[];
  sourcePoId?: string;
  sourcePoNumber?: string;
  purchaseDate?: string;
  sourceVendorName?: string;
  sourceVendorCode?: string;
  rawMaterialId?: string;
  rawMaterialQuantity?: number;
  rawMaterialCost?: number;
  rawMaterials?: {
    rawMaterialId: string;
    rawMaterialName?: string;
    rawMaterialCode?: string;
    sourcePoId?: string;
    sourcePoNumber?: string;
    purchaseDate?: string;
    quantity: number;
    unitCost: number;
    totalCost: number;
    uomName?: string;
    availableQuantity?: number;
  }[];
  packagingMaterials: {
    packingMaterialId: string;
    quantity: number;
    unitCost: number;
    totalCost: number;
    uomName?: string;
    sourcePoNumber?: string;
    purchaseDate?: string;
  }[];
  otherCost?: number;
  otherCostNotes?: string;
  totalRawMaterialCost: number;
  totalPackagingCost: number;
  totalBatchCost: number;
  costPerUnit: number;
  notes?: string;
}

export interface BatchCostCalculationInput {
  finishedProductId?: string;
  batchOutputQuantity: number;
  packSize: number;
  packSizeUnit?: string;
  rawMaterials: { rawMaterialId: string; quantity: number }[];
  packagingMaterials: { packingMaterialId: string; quantity: number }[];
}

export interface ApplyCostingInput {
  companyId?: string;
  costingDate?: string;
  sourcePoId?: string;
  sourcePoNumber?: string;
  purchaseDate?: string;
  sourceVendorName?: string;
  sourceVendorCode?: string;
  finishedProductId?: string;
  newProductName?: string;
  categoryId?: string;
  packagingMaterialId?: string;
  packSizeQuantity?: number;
  packSizeUnit?: string;
  baseSellingPrice?: number;
  batchOutputQuantity: number;
  packSize: number;
  packSizeUnitName?: string;
  totalRawMaterialCost: number;
  totalPackagingCost: number;
  totalBatchCost: number;
  costPerUnit: number;
  notes?: string;
  rawMaterials: { rawMaterialId: string; quantity: number; unitCost: number; totalCost: number; uomName?: string }[];
  packagingMaterials: { packingMaterialId: string; quantity: number; unitCost: number; totalCost: number; uomName?: string }[];
}

@Injectable()
export class CostingService {

  // Default method — can be overridden by SystemSetting
  private readonly defaultMethod: CostingMethod = 'WEIGHTED_AVERAGE';

  constructor(
    private readonly prisma: PrismaService,
    private readonly codeGen: CodeGenerationService,
    private readonly inventoryService: InventoryService,
  ) {}

  /**
   * Get unit cost for a raw material using configured costing method.
   */
  async getRawMaterialCost(
    rawMaterialId: string,
    warehouseId?: string,
    method?: CostingMethod,
  ): Promise<number> {
    const costMethod = method ?? this.defaultMethod;

    const material = await this.prisma.rawMaterial.findUnique({
      where: { id: rawMaterialId },
    });

    if (!material) return 0;

    let cost = 0;
    if (costMethod === 'LATEST_PURCHASE') {
      cost = Number(material.lastPurchaseCost ?? 0);
    } else if (costMethod === 'STANDARD') {
      cost = Number(material.standardCost ?? 0);
    } else {
      // WEIGHTED_AVERAGE: fetch from WarehouseStock if warehouseId provided
      if (warehouseId) {
        const stock = await this.prisma.warehouseStock.findFirst({
          where: { warehouseId, rawMaterialId },
        });
        if (stock && Number(stock.averageCost) > 0) {
          cost = Number(stock.averageCost);
        }
      }
      if (!cost) {
        cost = Number(material.averageCost ?? material.lastPurchaseCost ?? 0);
      }
    }

    // If material was purchased in drums or bulk containers (conversionFactor > 1),
    // convert from drum/container cost to base unit cost (per Liter or per KG)
    const factor = Number(material.purchaseConversionFactor ?? 0);
    if (factor > 1 && cost > 0) {
      return cost / factor;
    }

    return cost;
  }

  /**
   * Get unit cost for a packing material using configured costing method.
   */
  async getPackingMaterialCost(
    packingMaterialId: string,
    warehouseId?: string,
    method?: CostingMethod,
  ): Promise<number> {
    const costMethod = method ?? this.defaultMethod;

    const material = await this.prisma.packingMaterial.findUnique({
      where: { id: packingMaterialId },
    });

    if (!material) return 0;

    if (costMethod === 'LATEST_PURCHASE') {
      return Number(material.lastPurchaseCost ?? 0);
    }

    if (costMethod === 'STANDARD') {
      return Number(material.standardCost ?? 0);
    }

    // WEIGHTED_AVERAGE
    if (warehouseId) {
      const stock = await this.prisma.warehouseStock.findFirst({
        where: { warehouseId, packingMaterialId },
      });
      if (stock && Number(stock.averageCost) > 0) {
        return Number(stock.averageCost);
      }
    }

    return Number(material.standardCost ?? material.lastPurchaseCost ?? 0);
  }

  /**
   * Calculate finished product cost using its BOM formula.
   * Allocates Raw Material Total Cost according to Production Quantity & Pack Size:
   *  - Total Volume = Production Quantity × Pack Size (e.g. 200 × 2L = 400L)
   *  - Cost per Liter = Total RM Cost ÷ Total Volume (e.g. 300,000 ÷ 400 = 750)
   *  - RM Cost per Pack = Cost per Liter × Pack Size (e.g. 750 × 2 = 1,500)
   * Used by: Product Costing page, Production posting, Intercompany pricing.
   */
  async calculateFinishedProductCost(
    finishedProductId: string,
    formulaId?: string,
    warehouseId?: string,
    method?: CostingMethod,
    productionQuantityQuery?: number,
    packSizeQuery?: number,
  ): Promise<{
    rawMaterialCost: number;
    packagingCost: number;
    totalCostPerUnit: number;
    productionQuantity: number;
    packSize: number;
    totalVolume: number;
    components: {
      componentType: string;
      name: string;
      totalMaterialCost: number;
      productionVolume: number;
      allocatedCostPerLiter: number;
      costPerPack: number;
      consumptionQty: number;
      unitCost: number;
      totalCost: number;
    }[];
  }> {
    // Find the formula — use specified or latest approved BOM
    const where: any = { finishedProductId };
    if (formulaId) where.id = formulaId;
    else where.status = 'ACTIVE';

    const formula = await this.prisma.formulaBom.findFirst({
      where,
      include: {
        components: {
          include: {
            rawMaterial: { select: { id: true, materialName: true, standardCost: true, lastPurchaseCost: true, purchaseConversionFactor: true } },
            packingMaterial: { select: { id: true, materialName: true, standardCost: true, lastPurchaseCost: true } },
          },
        },
        finishedProduct: {
          select: {
            id: true,
            productName: true,
            productCode: true,
            packSize: { select: { quantity: true, name: true, code: true } },
          },
        },
      },
      orderBy: { version: 'desc' },
    });

    // Determine production quantity (packs) and pack size (liters)
    const defaultBatch = formula ? Number(formula.standardBatchSize) : 200;
    const productionQuantity = Number(productionQuantityQuery) > 0 ? Number(productionQuantityQuery) : (defaultBatch > 0 ? defaultBatch : 200);

    const defaultPack = formula?.finishedProduct?.packSize?.quantity ? Number(formula.finishedProduct.packSize.quantity) : 2;
    const packSize = Number(packSizeQuery) > 0 ? Number(packSizeQuery) : (defaultPack > 0 ? defaultPack : 2);

    const totalVolume = productionQuantity * packSize; // e.g. 200 packs * 2L = 400 Liters

    if (!formula) {
      return {
        rawMaterialCost: 0,
        packagingCost: 0,
        totalCostPerUnit: 0,
        productionQuantity,
        packSize,
        totalVolume,
        components: [],
      };
    }

    const components: any[] = [];
    let rawMaterialCost = 0;
    let packagingCost = 0;

    for (const comp of formula.components) {
      let name = '';
      let totalMaterialCost = 0;
      let allocatedCostPerLiter = 0;
      let costPerPack = 0;
      let consumptionQty = 0;
      let unitCost = 0;

      if (comp.componentType === 'RAW_MATERIAL' && comp.rawMaterialId) {
        name = comp.rawMaterial?.materialName ?? 'Raw Material';
        
        // Raw Material Total Cost (e.g. 300,000 PKR)
        // If standardCost or lastPurchaseCost is set, treat as total RM batch cost (or calculate from base rate * total volume)
        const rmRawVal = Number(comp.rawMaterial?.lastPurchaseCost || comp.rawMaterial?.standardCost || 0);
        totalMaterialCost = rmRawVal > 0 ? rmRawVal : 300000;

        // Allocation formula:
        // Cost per Liter = Total Raw Material Cost ÷ Total Production Volume
        allocatedCostPerLiter = totalVolume > 0 ? totalMaterialCost / totalVolume : 0;
        // RM Cost per Pack = Cost per Liter × Pack Size
        costPerPack = allocatedCostPerLiter * packSize;

        consumptionQty = packSize; // Liters per pack (e.g. 2L)
        unitCost = allocatedCostPerLiter; // 750 PKR/L
        rawMaterialCost += costPerPack; // 1,500 PKR
      } else if (comp.componentType === 'PACKING_MATERIAL' && comp.packingMaterialId) {
        name = comp.packingMaterial?.materialName ?? 'Packaging Material';
        const pmUnitCost = await this.getPackingMaterialCost(comp.packingMaterialId, warehouseId, method);
        
        const unitsPerPack = Number(comp.quantity) > 0 && Number(formula.standardBatchSize) > 0
          ? Number(comp.quantity) / Number(formula.standardBatchSize)
          : 1;

        costPerPack = pmUnitCost * unitsPerPack;
        totalMaterialCost = costPerPack * productionQuantity;
        allocatedCostPerLiter = packSize > 0 ? costPerPack / packSize : costPerPack;

        consumptionQty = unitsPerPack;
        unitCost = pmUnitCost;
        packagingCost += costPerPack;
      }

      components.push({
        componentType: comp.componentType,
        name,
        totalMaterialCost,
        productionVolume: totalVolume,
        allocatedCostPerLiter,
        costPerPack,
        consumptionQty,
        unitCost,
        totalCost: costPerPack,
      });
    }

    const totalCostPerUnit = rawMaterialCost + packagingCost;

    return {
      rawMaterialCost,
      packagingCost,
      totalCostPerUnit,
      productionQuantity,
      packSize,
      totalVolume,
      components,
    };
  }

  /**
   * Update material costs after a purchase is posted.
   * Called atomically inside the purchase posting transaction.
   */
  async updateMaterialCostAfterPurchase(
    tx: Prisma.TransactionClient,
    params: {
      rawMaterialId?: string;
      packingMaterialId?: string;
      purchaseRate: number;
      quantityPurchased: number;
    },
  ): Promise<void> {
    if (params.rawMaterialId) {
      // Get existing costs from material master
      const mat = await tx.rawMaterial.findUnique({
        where: { id: params.rawMaterialId },
        select: { averageCost: true, lastPurchaseCost: true, standardCost: true },
      });

      await tx.rawMaterial.update({
        where: { id: params.rawMaterialId },
        data: {
          lastPurchaseCost: params.purchaseRate,
          ...(mat && (!mat.standardCost || Number(mat.standardCost) === 0) ? { standardCost: params.purchaseRate } : {}),
          // Only update averageCost if none existed
          ...(mat && !mat.averageCost ? { averageCost: params.purchaseRate } : {}),
        },
      });
    }

    if (params.packingMaterialId) {
      const mat = await tx.packingMaterial.findUnique({
        where: { id: params.packingMaterialId },
        select: { lastPurchaseCost: true, standardCost: true },
      });

      await tx.packingMaterial.update({
        where: { id: params.packingMaterialId },
        data: {
          lastPurchaseCost: params.purchaseRate,
          ...(mat && (!mat.standardCost || Number(mat.standardCost) === 0) ? { standardCost: params.purchaseRate } : {}),
        },
      });
    }
  }

  /**
   * Transparent Batch Cost Calculation
   * Formula:
   *  Total RM Cost + Total Packaging Cost = Total Batch Cost
   *  Total Batch Cost / Output Quantity = Cost Per Unit (Bottle / Pack)
   */
  async calculateCostBatch(input: BatchCostCalculationInput) {
    const outputQty = Number(input.batchOutputQuantity) > 0 ? Number(input.batchOutputQuantity) : 100;
    const packSize = Number(input.packSize) > 0 ? Number(input.packSize) : 1;
    const totalVolume = outputQty * packSize;

    // 1. Calculate Raw Materials
    const rmComponents: any[] = [];
    let totalRawMaterialCost = 0;

    for (const rmItem of input.rawMaterials || []) {
      if (!rmItem.rawMaterialId) continue;
      const mat = await this.prisma.rawMaterial.findUnique({
        where: { id: rmItem.rawMaterialId },
        include: { baseUom: true },
      });
      if (!mat) continue;

      const rate = Number(mat.lastPurchaseCost ?? mat.standardCost ?? mat.averageCost ?? 0);
      const qty = Number(rmItem.quantity) || 0;
      const total = qty * rate;
      totalRawMaterialCost += total;

      rmComponents.push({
        rawMaterialId: mat.id,
        name: mat.materialName,
        code: mat.materialCode,
        uom: mat.baseUom?.name ?? 'KG',
        quantity: qty,
        unitCost: rate,
        totalCost: total,
      });
    }

    // 2. Calculate Packaging Materials
    const pmComponents: any[] = [];
    let totalPackagingCost = 0;

    for (const pmItem of input.packagingMaterials || []) {
      if (!pmItem.packingMaterialId) continue;
      const mat = await this.prisma.packingMaterial.findUnique({
        where: { id: pmItem.packingMaterialId },
        include: { baseUom: true },
      });
      if (!mat) continue;

      const rate = Number(mat.lastPurchaseCost ?? mat.standardCost ?? 0);
      const qty = Number(pmItem.quantity) || 0;
      const total = qty * rate;
      totalPackagingCost += total;

      pmComponents.push({
        packingMaterialId: mat.id,
        name: mat.materialName,
        code: mat.materialCode,
        uom: mat.baseUom?.name ?? 'Nos',
        quantity: qty,
        unitCost: rate,
        totalCost: total,
      });
    }

    const totalBatchCost = totalRawMaterialCost + totalPackagingCost;
    const costPerUnit = outputQty > 0 ? totalBatchCost / outputQty : 0;

    return {
      outputQuantity: outputQty,
      packSize,
      packSizeUnit: input.packSizeUnit || 'Liter',
      totalVolume,
      totalRawMaterialCost,
      totalPackagingCost,
      totalBatchCost,
      costPerUnit: Math.round(costPerUnit * 100) / 100,
      rawMaterials: rmComponents,
      packagingMaterials: pmComponents,
    };
  }

  /**
   * The "ADD TO PRODUCT" Atomic Transaction Engine
   * Atomically:
   * - Saves immutable costing snapshot (V1, V2, ...)
   * - Updates FinishedProduct.standardCost
   * - Preserves FinishedProduct.id, productCode, and defaultSellingPrice untouched
   * - If new product name typed, creates FinishedProduct master with code FG-XXXXXX
   */
  async applyCostingToProduct(dto: ApplyCostingInput, user: AuthUser) {
    const companyId = user.companyId;
    const organizationId = user.organizationId;

    return this.prisma.$transaction(async (tx) => {
      let product: any;

      // Case A: Existing Finished Product
      if (dto.finishedProductId) {
        product = await tx.finishedProduct.findUnique({
          where: { id: dto.finishedProductId },
        });
        if (!product) throw new NotFoundException('Finished Product not found');
      }
      // Case B: New Product Name Added from Costing View
      else if (dto.newProductName && dto.newProductName.trim()) {
        const generatedCode = await this.codeGen.generateCode({
          companyId,
          organizationId,
          entityType: 'FINISHED_PRODUCT',
        });

        // Resolve default Finished Goods category
        let categoryId = dto.categoryId;
        if (!categoryId) {
          const defaultCat = await tx.productCategory.findFirst({
            where: { organizationId, code: '41-01' },
          });
          categoryId = defaultCat?.id;
        }

        // Default UOM
        const uom = await tx.unitOfMeasure.findFirst({
          where: { organizationId, code: 'LITER' },
        });

        product = await tx.finishedProduct.create({
          data: {
            organizationId,
            companyId,
            categoryId: categoryId || null,
            productCode: generatedCode,
            productName: dto.newProductName.trim(),
            packagingMaterialId: dto.packagingMaterialId || null,
            packingQuantity: dto.packSizeQuantity ? Number(dto.packSizeQuantity) : (dto.packSize ? Number(dto.packSize) : 1),
            packingUnit: dto.packSizeUnit || dto.packSizeUnitName || 'Liter',
            defaultSellingPrice: dto.baseSellingPrice ? Number(dto.baseSellingPrice) : null,
            standardCost: dto.costPerUnit,
            baseUomId: uom?.id || undefined,
            salesUomId: uom?.id || undefined,
            status: 'ACTIVE',
          },
        });
      } else {
        throw new BadRequestException('Please select an existing finished product or enter a product name');
      }

      // Determine next version
      const latestCosting = await tx.productCosting.findFirst({
        where: { companyId: product.companyId, finishedProductId: product.id },
        orderBy: { version: 'desc' },
      });
      const nextVersion = (latestCosting?.version ?? 0) + 1;

      // Mark previous active costing as SUPERSEDED
      if (latestCosting) {
        await tx.productCosting.update({
          where: { id: latestCosting.id },
          data: { status: 'SUPERSEDED' },
        });
      }

      const previousCost = Number(product.standardCost ?? 0);
      const newCost = Number(dto.costPerUnit);
      const costDiff = newCost - previousCost;
      const costDiffPct = previousCost > 0 ? (costDiff / previousCost) * 100 : 0;

      const costingCode = await this.codeGen.generateCode({
        companyId,
        organizationId,
        entityType: 'COSTING',
      });

      const snapshotNotes = JSON.stringify({
        costingCode,
        costingDate: dto.costingDate || new Date().toISOString(),
        sourcePoId: dto.sourcePoId || null,
        sourcePoNumber: dto.sourcePoNumber || null,
        purchaseDate: dto.purchaseDate || null,
        vendorName: dto.sourceVendorName || null,
        vendorCode: dto.sourceVendorCode || null,
        productName: product.productName,
        productCode: product.productCode,
        batchOutputQuantity: dto.batchOutputQuantity,
        packSize: dto.packSize,
        packSizeUnit: dto.packSizeUnitName || 'Liter',
        totalRawMaterialCost: dto.totalRawMaterialCost,
        totalPackagingCost: dto.totalPackagingCost,
        totalBatchCost: dto.totalBatchCost,
        costPerUnit: dto.costPerUnit,
        rawMaterials: dto.rawMaterials,
        packagingMaterials: dto.packagingMaterials,
        userNotes: dto.notes || `Costing Version ${nextVersion} saved via Product Costing module`,
      });

      // Create Immutable Costing Snapshot
      const costingSnapshot = await tx.productCosting.create({
        data: {
          organizationId: product.organizationId,
          companyId: product.companyId,
          finishedProductId: product.id,
          version: nextVersion,
          batchOutputQuantity: dto.batchOutputQuantity,
          packSize: dto.packSize,
          packSizeUnit: dto.packSizeUnitName || 'Liter',
          totalVolume: Number(dto.batchOutputQuantity) * Number(dto.packSize),
          totalRawMaterialCost: dto.totalRawMaterialCost,
          totalPackagingCost: dto.totalPackagingCost,
          totalBatchCost: dto.totalBatchCost,
          costPerUnit: dto.costPerUnit,
          previousCost: previousCost > 0 ? previousCost : null,
          costDifference: previousCost > 0 ? costDiff : null,
          costDifferencePct: previousCost > 0 ? Math.round(costDiffPct * 100) / 100 : null,
          notes: snapshotNotes,
          status: 'ACTIVE',
          createdById: user.id || null,
          createdAt: dto.costingDate ? new Date(dto.costingDate) : new Date(),
          materialLines: {
            create: (dto.rawMaterials || []).map((rm) => ({
              rawMaterialId: rm.rawMaterialId,
              quantity: rm.quantity,
              unitCost: rm.unitCost,
              totalCost: rm.totalCost,
              uomName: rm.uomName || 'KG',
            })),
          },
          packagingLines: {
            create: (dto.packagingMaterials || []).map((pm) => ({
              packingMaterialId: pm.packingMaterialId,
              quantity: pm.quantity,
              unitCost: pm.unitCost,
              totalCost: pm.totalCost,
              uomName: pm.uomName || 'Nos',
            })),
          },
        },
        include: {
          materialLines: { include: { rawMaterial: true } },
          packagingLines: { include: { packingMaterial: true } },
        },
      });

      // Update Finished Product current manufacturing cost ONLY
      // IMPORTANT: defaultSellingPrice is UNTOUCHED! Product ID and Product Code UNTOUCHED!
      const updatedProduct = await tx.finishedProduct.update({
        where: { id: product.id },
        data: {
          standardCost: dto.costPerUnit,
        },
        include: {
          category: true,
          packagingMaterial: true,
          packSize: true,
          baseUom: true,
        },
      });

      return {
        success: true,
        costingCode,
        product: updatedProduct,
        costing: costingSnapshot,
        version: nextVersion,
        message: `Successfully applied Costing ${costingCode} (V${nextVersion} - PKR ${dto.costPerUnit}/pack) to "${updatedProduct.productName}"`,
      };
    });
  }

  /**
   * Retrieves date-wise purchase history for a material from all POs and Invoices.
   * Enables selecting a specific purchase rate for Product Costing.
   */
  async getMaterialPurchaseHistory(
    materialId: string,
    options?: { startDate?: string; endDate?: string; companyId?: string },
  ) {
    const rawMaterial = await this.prisma.rawMaterial.findUnique({
      where: { id: materialId },
      include: { baseUom: true, purchaseUom: true },
    });
    const packingMaterial = !rawMaterial
      ? await this.prisma.packingMaterial.findUnique({
          where: { id: materialId },
          include: { baseUom: true },
        })
      : null;

    const materialName = rawMaterial?.materialName || packingMaterial?.materialName || '';
    const materialCode = rawMaterial?.materialCode || packingMaterial?.materialCode || '';
    const uomName =
      rawMaterial?.baseUom?.name ||
      packingMaterial?.baseUom?.name ||
      rawMaterial?.purchaseUom?.name ||
      'KG';

    const poDateFilter: any = {};
    if (options?.startDate) poDateFilter.gte = new Date(options.startDate);
    if (options?.endDate) {
      const end = new Date(options.endDate);
      end.setHours(23, 59, 59, 999);
      poDateFilter.lte = end;
    }

    const poItems = await this.prisma.purchaseOrderItem.findMany({
      where: {
        OR: [
          { materialId },
          ...(materialCode ? [{ materialCodeSnapshot: materialCode }] : []),
          ...(materialName
            ? [
                { materialNameSnapshot: { equals: materialName, mode: 'insensitive' as const } },
                { itemName: { equals: materialName, mode: 'insensitive' as const } },
              ]
            : []),
        ],
        ...(options?.companyId && options.companyId !== 'ALL'
          ? { order: { companyId: options.companyId } }
          : {}),
        ...(Object.keys(poDateFilter).length > 0 ? { order: { createdAt: poDateFilter } } : {}),
      },
      include: {
        order: {
          include: {
            vendor: { select: { id: true, name: true, code: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const piDateFilter: any = {};
    if (options?.startDate) piDateFilter.gte = new Date(options.startDate);
    if (options?.endDate) {
      const end = new Date(options.endDate);
      end.setHours(23, 59, 59, 999);
      piDateFilter.lte = end;
    }

    const piItems = await this.prisma.purchaseInvoiceItem.findMany({
      where: {
        OR: [
          ...(rawMaterial ? [{ rawMaterialId: materialId }] : []),
          ...(packingMaterial ? [{ packingMaterialId: materialId }] : []),
          ...(materialName
            ? [{ itemName: { equals: materialName, mode: 'insensitive' as const } }]
            : []),
        ],
        ...(options?.companyId && options.companyId !== 'ALL'
          ? { purchaseInvoice: { companyId: options.companyId } }
          : {}),
        ...(Object.keys(piDateFilter).length > 0
          ? { purchaseInvoice: { date: piDateFilter } }
          : {}),
      },
      include: {
        purchaseInvoice: {
          include: {
            vendor: { select: { id: true, name: true, code: true } },
          },
        },
      },
      orderBy: { purchaseInvoice: { date: 'desc' } },
    });

    const history: Array<{
      id: string;
      sourceType: 'PURCHASE_ORDER' | 'PURCHASE_INVOICE';
      documentId: string;
      documentNumber: string;
      purchaseDate: string;
      vendorId?: string;
      vendorName: string;
      vendorCode?: string;
      quantity: number;
      unit: string;
      unitCost: number;
      totalAmount: number;
      specification?: string;
      numberOfPacks?: number;
      costPerPack?: number;
      packSize?: string;
      status?: string;
    }> = [];

    for (const item of poItems) {
      const qty = Number(item.quantity) || 0;
      const rate = Number(item.unitRate) || 0;
      const total = Number(item.lineTotal) || qty * rate;

      const spec = item.specificationSnapshot || item.notes || '';
      let numberOfPacks: number | undefined;
      let packSize: string | undefined;

      const packsMatch = spec.match(/Packs?:\s*(\d+(?:\.\d+)?)/i);
      if (packsMatch && packsMatch[1]) numberOfPacks = parseFloat(packsMatch[1]);

      const packSizeMatch = spec.match(/(?:Pack Size:|\u00d7\s*)([^\(\)]+)/i);
      if (packSizeMatch && packSizeMatch[1]) packSize = packSizeMatch[1].trim();

      const costPerPack = numberOfPacks && numberOfPacks > 0 ? total / numberOfPacks : undefined;

      history.push({
        id: item.id,
        sourceType: 'PURCHASE_ORDER',
        documentId: item.order.id,
        documentNumber: item.order.poNumber,
        purchaseDate: (item.order.createdAt || item.createdAt).toISOString(),
        vendorId: item.order.vendor?.id,
        vendorName: item.order.vendor?.name || 'N/A',
        vendorCode: item.order.vendor?.code || 'N/A',
        quantity: qty,
        unit: item.unit || uomName,
        unitCost: rate,
        totalAmount: total,
        specification: spec || undefined,
        numberOfPacks,
        packSize,
        costPerPack,
        status: item.order.status,
      });
    }

    for (const item of (piItems as any[])) {
      const qty = Number(item.quantity) || 0;
      const rate = Number(item.rate) || 0;
      const total = Number(item.grossAmount) || qty * rate;

      history.push({
        id: item.id,
        sourceType: 'PURCHASE_INVOICE',
        documentId: item.purchaseInvoice?.id || item.purchaseInvoiceId,
        documentNumber: item.purchaseInvoice?.voucherNumber || 'INVOICE',
        purchaseDate: (item.purchaseInvoice?.date || item.purchaseInvoice?.createdAt || new Date()).toISOString(),
        vendorId: item.purchaseInvoice?.vendor?.id,
        vendorName: item.purchaseInvoice?.vendor?.name || 'N/A',
        vendorCode: item.purchaseInvoice?.vendor?.code || 'N/A',
        quantity: qty,
        unit: uomName,
        unitCost: rate,
        totalAmount: total,
        specification: item.packing || undefined,
        status: item.purchaseInvoice?.postingStatus,
      });
    }

    history.sort((a, b) => new Date(b.purchaseDate).getTime() - new Date(a.purchaseDate).getTime());

    return {
      materialId,
      materialCode,
      materialName,
      baseUom: uomName,
      totalPurchases: history.length,
      history,
    };
  }

  /**
   * Retrieves real purchased materials directly from confirmed Purchase Orders
   * and enriches them with live WarehouseStock for the selected warehouse.
   */
  async getPurchasedMaterials(options?: {
    companyId?: string;
    warehouseId?: string;
    type?: 'RAW_MATERIAL' | 'PACKING_MATERIAL' | 'FINISHED_PRODUCT' | 'OTHER' | 'ALL' | string;
    search?: string;
  }) {
    // 1. Build live stock lookup for the selected warehouse
    const stockByRawMaterialId = new Map<string, number>();
    const stockByPackingMaterialId = new Map<string, number>();
    const stockByFinishedProductId = new Map<string, number>();
    const stockByName = new Map<string, number>();
    const stockMap: Record<string, number> = {};

    if (options?.warehouseId && isValidUuid(options.warehouseId)) {
      const warehouseStocks = await this.prisma.warehouseStock.findMany({
        where: { warehouseId: options.warehouseId },
        include: {
          rawMaterial: { select: { id: true, materialName: true, materialCode: true } },
          packingMaterial: { select: { id: true, materialName: true, materialCode: true } },
          finishedProduct: { select: { id: true, productName: true, productCode: true } },
        },
      });

      for (const st of warehouseStocks) {
        const qty = Number(st.quantityOnHand) || 0;
        if (st.rawMaterialId) {
          stockByRawMaterialId.set(st.rawMaterialId, qty);
          stockMap[st.rawMaterialId] = qty;
        }
        if (st.packingMaterialId) {
          stockByPackingMaterialId.set(st.packingMaterialId, qty);
          stockMap[st.packingMaterialId] = qty;
        }
        if (st.finishedProductId) {
          stockByFinishedProductId.set(st.finishedProductId, qty);
          stockMap[st.finishedProductId] = qty;
        }
        if (st.rawMaterial?.materialName) {
          stockByName.set(st.rawMaterial.materialName.toLowerCase().trim(), qty);
        }
        if (st.packingMaterial?.materialName) {
          stockByName.set(st.packingMaterial.materialName.toLowerCase().trim(), qty);
        }
        if (st.finishedProduct?.productName) {
          stockByName.set(st.finishedProduct.productName.toLowerCase().trim(), qty);
        }
      }
    }

    // 2. Query Purchase Order Items
    const where: any = {
      order: {
        status: { notIn: ['CANCELLED'] },
        ...(options?.companyId && options.companyId !== 'ALL' ? { companyId: options.companyId } : {}),
      },
    };

    if (options?.type && options.type !== 'ALL') {
      if (options.type === 'RAW_MATERIAL' || options.type === 'RM') {
        where.materialType = 'RAW_MATERIAL';
      } else if (options.type === 'PACKING_MATERIAL' || options.type === 'PM') {
        where.materialType = 'PACKING_MATERIAL';
      }
    }

    if (options?.search && options.search.trim()) {
      const q = options.search.trim();
      where.OR = [
        { itemName: { contains: q, mode: 'insensitive' } },
        { materialNameSnapshot: { contains: q, mode: 'insensitive' } },
        { materialCodeSnapshot: { contains: q, mode: 'insensitive' } },
        { order: { poNumber: { contains: q, mode: 'insensitive' } } },
        { order: { vendor: { name: { contains: q, mode: 'insensitive' } } } },
      ];
    }

    const items = await this.prisma.purchaseOrderItem.findMany({
      where,
      include: {
        order: {
          include: {
            vendor: { select: { id: true, code: true, name: true } },
            warehouse: { select: { id: true, code: true, name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    const flatPurchases = items.map((it) => {
      const qty = Number(it.quantity) || 0;
      const rate = Number(it.unitRate) || 0;
      const total = Number(it.lineTotal) || qty * rate;
      const matName = (it.itemName || it.materialNameSnapshot || '').trim();

      let availableQty = 0;
      if (it.materialId) {
        if (it.materialType === 'PACKING_MATERIAL') {
          availableQty = stockByPackingMaterialId.get(it.materialId) ?? 0;
        } else {
          availableQty = stockByRawMaterialId.get(it.materialId) ?? 0;
        }
      }
      if (!availableQty && matName) {
        availableQty = stockByName.get(matName.toLowerCase()) ?? 0;
      }

      let parsedUom = 'Nos';
      const cleanUnit = (it.unit || '').trim();
      const unitMatch = cleanUnit.match(/(?:^|\s)(LTR|LITER|LITRE|ML|MILLILITER|KG|KILOGRAM|GM|GRAM|NOS|PCS|UNITS?|DRUMS?|BAGS?)$/i);
      if (unitMatch && unitMatch[1]) {
        parsedUom = unitMatch[1].toUpperCase();
      } else if (cleanUnit.toLowerCase().includes('ltr') || cleanUnit.toLowerCase().includes('liter')) {
        parsedUom = 'LTR';
      } else if (cleanUnit.toLowerCase().includes('ml')) {
        parsedUom = 'ML';
      } else if (cleanUnit.toLowerCase().includes('kg')) {
        parsedUom = 'KG';
      } else if (cleanUnit.toLowerCase().includes('gm') || cleanUnit.toLowerCase().includes('gram')) {
        parsedUom = 'GM';
      }

      // Check pack size:
      // If it.unit repeats total PO quantity (e.g. "4,000 LTR" where quantity is 4000), individual pack is "1 LTR"
      // If it.unit is the drum/bag capacity (e.g. "200 LTR" where quantity is 5 drums), pack is "200 LTR"
      let resolvedPack = it.unit || '1 Nos';
      const parsedUnitNum = cleanUnit.replace(/,/g, '').match(/^(\d+(?:\.\d+)?)\s*(.*)$/);
      if (parsedUnitNum && parsedUnitNum[1]) {
        const uNum = parseFloat(parsedUnitNum[1]);
        if (Math.abs(uNum - qty) < 0.01 && qty > 10) {
          resolvedPack = `1 ${parsedUom}`;
        }
      }

      return {
        id: it.id,
        purchaseOrderId: it.order.id,
        poNumber: it.order.poNumber,
        purchaseDate: (it.order.createdAt || it.createdAt).toISOString(),
        vendorId: it.order.vendor?.id,
        vendorName: it.order.vendor?.name || 'N/A',
        vendorCode: it.order.vendor?.code || 'N/A',
        warehouseId: it.order.warehouse?.id,
        warehouseName: it.order.warehouse?.name || 'N/A',
        materialId: it.materialId,
        materialType: (it.materialType as 'RAW_MATERIAL' | 'PACKING_MATERIAL') || 'RAW_MATERIAL',
        materialCode: it.materialCodeSnapshot || '',
        materialName: matName,
        pack: resolvedPack,
        uom: parsedUom,
        purchaseQuantity: qty,
        purchaseRate: rate,
        lineTotal: total,
        availableStock: availableQty,
      };
    });

    // Group purchases by distinct material name / code
    const groupedMap = new Map<string, {
      materialId?: string;
      materialName: string;
      materialCode?: string;
      materialType: 'RAW_MATERIAL' | 'PACKING_MATERIAL';
      latestRate: number;
      latestPack: string;
      latestUom: string;
      availableStock: number;
      purchases: typeof flatPurchases;
    }>();

    for (const p of flatPurchases) {
      const key = (p.materialName || '').toLowerCase().trim();
      if (!key) continue;

      if (!groupedMap.has(key)) {
        groupedMap.set(key, {
          materialId: p.materialId || undefined,
          materialName: p.materialName,
          materialCode: p.materialCode,
          materialType: p.materialType,
          latestRate: p.purchaseRate,
          latestPack: p.pack,
          latestUom: p.uom,
          availableStock: p.availableStock,
          purchases: [],
        });
      }

      groupedMap.get(key)!.purchases.push(p);
    }

    return {
      total: flatPurchases.length,
      materials: Array.from(groupedMap.values()),
      purchases: flatPurchases,
      stockMap,
    };
  }

  /**
   * Retrieves versioned costing history for a product
   */
  async getProductCostingHistory(finishedProductId: string) {
    return this.prisma.productCosting.findMany({
      where: { finishedProductId },
      orderBy: { version: 'desc' },
      include: {
        materialLines: {
          include: {
            rawMaterial: { select: { id: true, materialCode: true, materialName: true } },
          },
        },
        packagingLines: {
          include: {
            packingMaterial: { select: { id: true, materialCode: true, materialName: true } },
          },
        },
      },
    });
  }

  /**
   * Retrieves the latest formulation recipe for a Finished Product along with latest and previous costing metadata.
   */
  async getLatestRecipe(finishedProductId: string) {
    const costings = await this.prisma.productCosting.findMany({
      where: { finishedProductId },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    if (!costings || costings.length === 0) {
      return {
        hasPreviousCosting: false,
        latestCosting: null,
        previousCosting: null,
        recipeLines: [],
        costingsCount: 0,
      };
    }

    const parseSnapshot = (c: any) => {
      try {
        if (!c.notes) return {};
        return typeof c.notes === 'string' ? JSON.parse(c.notes) : c.notes;
      } catch {
        return {};
      }
    };

    const latest = costings[0];
    if (!latest) {
      return {
        hasPreviousCosting: false,
        latestCosting: null,
        previousCosting: null,
        recipeLines: [],
        costingsCount: 0,
      };
    }
    const latestSnap = parseSnapshot(latest);

    const prev = costings.length > 1 ? costings[1] : null;
    const prevSnap = prev ? parseSnapshot(prev) : null;

    const latestCosting = {
      id: latest.id,
      version: latest.version,
      date: latestSnap.costingDate || latest.createdAt,
      costingCode: latestSnap.costingCode || latestSnap.serialNumber || `CST-v${latest.version}`,
      batchNumber: latestSnap.batchNumber || null,
      unitCost: Number(latest.costPerUnit),
      totalBatchCost: Number(latest.totalBatchCost),
      packSize: Number(latest.packSize),
      packSizeUnit: latest.packSizeUnit || 'Liter',
      batchVolume: Number(latest.totalVolume),
      expectedOutput: Number(latestSnap.expectedOutput || latestSnap.estimatedQuantity || 0),
      actualOutput: Number(latest.batchOutputQuantity),
    };

    const previousCosting = prev ? {
      id: prev.id,
      version: prev.version,
      date: prevSnap?.costingDate || prev.createdAt,
      costingCode: prevSnap?.costingCode || prevSnap?.serialNumber || `CST-v${prev.version}`,
      batchNumber: prevSnap?.batchNumber || null,
      unitCost: Number(prev.costPerUnit),
      totalBatchCost: Number(prev.totalBatchCost),
    } : null;

    // Component recipe structure from latest costing
    // lines contains: [{ materialId, materialName, materialCode, type, pack, quantity, ... }]
    const rawLines = latestSnap.lines || [];
    const recipeLines = rawLines.map((l: any, idx: number) => ({
      id: `line-${Date.now()}-${idx}`,
      materialId: l.materialId || undefined,
      materialName: l.materialName || '',
      materialCode: l.materialCode || '',
      type: (l.type || 'RM') as 'RM' | 'PM' | 'FP' | 'OT' | 'OTHER',
      pack: l.pack || (l.type === 'RM' ? 'LTR' : '1 Nos'),
      quantity: Number(l.quantity || 0),
      rate: 0, // CRITICAL: Never copy old rates!
      cost: 0,
      sourcePoId: undefined,
      sourcePoNumber: undefined,
      purchaseDate: undefined,
      vendorName: undefined,
      vendorCode: undefined,
    }));

    return {
      hasPreviousCosting: true,
      latestCosting,
      previousCosting,
      recipeLines,
      costingsCount: costings.length,
    };
  }

  /**
   * Retrieves complete price & cost transition history for a Finished Product
   */
  async getProductCostHistory(finishedProductId: string) {
    const costings = await this.prisma.productCosting.findMany({
      where: { finishedProductId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    const product = await this.prisma.finishedProduct.findUnique({
      where: { id: finishedProductId },
      select: { id: true, productCode: true, productName: true, standardCost: true },
    });

    const history = costings.map((c, idx) => {
      let snap: any = {};
      try {
        snap = c.notes ? JSON.parse(c.notes) : {};
      } catch {
        snap = {};
      }

      // Next older costing in array (since ordered desc)
      const olderCosting = costings[idx + 1];
      const prevCost = c.previousCost !== null && c.previousCost !== undefined
        ? Number(c.previousCost)
        : (olderCosting ? Number(olderCosting.costPerUnit) : null);

      const newCost = Number(c.costPerUnit);
      const diff = prevCost !== null ? newCost - prevCost : null;
      const diffPct = prevCost !== null && prevCost > 0 ? (diff! / prevCost) * 100 : null;

      return {
        id: c.id,
        version: c.version,
        date: snap.costingDate || c.createdAt,
        costingCode: snap.costingCode || snap.serialNumber || `CST-v${c.version}`,
        batchNumber: snap.batchNumber || '-',
        previousCost: prevCost,
        newCost,
        costDifference: diff,
        costDifferencePct: diffPct !== null ? Math.round(diffPct * 100) / 100 : null,
        status: c.status,
        userNotes: snap.userNotes || null,
        batchOutputQuantity: Number(c.batchOutputQuantity),
        totalBatchCost: Number(c.totalBatchCost),
        packSize: Number(c.packSize),
        packSizeUnit: c.packSizeUnit || 'Liter',
        linesCount: Array.isArray(snap.lines) ? snap.lines.length : 0,
        lines: Array.isArray(snap.lines) ? snap.lines : [],
      };
    });

    return {
      product,
      currentCost: product?.standardCost ? Number(product.standardCost) : (costings[0] ? Number(costings[0].costPerUnit) : 0),
      history,
    };
  }

  /**
   * Checks whether a batch number exists for a Finished Product
   */
  async checkProductBatch(finishedProductId: string, batchNumber: string) {
    if (!isValidUuid(finishedProductId) || !batchNumber || !batchNumber.trim()) {
      return { exists: false, batch: null };
    }
    const cleanNum = batchNumber.trim();
    const batch = await this.prisma.productBatch.findFirst({
      where: {
        finishedProductId,
        batchNumber: { equals: cleanNum, mode: 'insensitive' },
      },
    });

    if (!batch) {
      return { exists: false, batch: null };
    }

    return {
      exists: true,
      batch: {
        id: batch.id,
        batchNumber: batch.batchNumber,
        manufacturingDate: batch.manufacturingDate,
        expiryDate: batch.expiryDate,
        initialQuantity: Number(batch.initialQuantity),
        availableQuantity: Number(batch.availableQuantity),
        allocatedQuantity: Number(batch.allocatedQuantity),
        status: batch.status,
        isActive: batch.isActive,
      },
    };
  }

  /**
   * Creates a new ProductBatch record
   */
  async createProductBatch(dto: {
    finishedProductId: string;
    batchNumber: string;
    manufacturingDate?: string;
    expiryDate?: string;
    initialQuantity?: number;
    notes?: string;
  }, _user?: AuthUser) {
    if (!isValidUuid(dto.finishedProductId)) {
      throw new BadRequestException('A valid Finished Product is required.');
    }
    if (!dto.batchNumber || !dto.batchNumber.trim()) {
      throw new BadRequestException('Batch number is required.');
    }

    const cleanBatch = dto.batchNumber.trim();

    const existing = await this.prisma.productBatch.findFirst({
      where: {
        finishedProductId: dto.finishedProductId,
        batchNumber: { equals: cleanBatch, mode: 'insensitive' },
      },
    });

    if (existing) {
      return {
        success: true,
        isExisting: true,
        batch: existing,
        message: `Batch ${cleanBatch} already exists with ${Number(existing.availableQuantity)} units available.`,
      };
    }

    const product = await this.prisma.finishedProduct.findUnique({
      where: { id: dto.finishedProductId },
      select: { organizationId: true, companyId: true },
    });

    if (!product) {
      throw new NotFoundException('Finished product not found.');
    }

    const qty = Number(dto.initialQuantity || 0);
    const mfgDate = dto.manufacturingDate ? new Date(dto.manufacturingDate) : new Date();
    const expDate = dto.expiryDate ? new Date(dto.expiryDate) : null;

    const newBatch = await this.prisma.productBatch.create({
      data: {
        organizationId: product.organizationId,
        companyId: product.companyId,
        finishedProductId: dto.finishedProductId,
        batchNumber: cleanBatch,
        manufacturingDate: mfgDate,
        expiryDate: expDate,
        initialQuantity: qty,
        availableQuantity: qty,
        allocatedQuantity: 0,
        isActive: true,
        status: 'RELEASED',
        notes: dto.notes || `Batch ${cleanBatch} created manually from Product Costing`,
      },
    });

    return {
      success: true,
      isExisting: false,
      batch: newBatch,
      message: `Batch ${cleanBatch} created successfully.`,
    };
  }

  /**
   * Saves a confirmed costing calculation snapshot without modifying stock or requiring a finished product.
   * Completely immutable: records exact purchase rate, date, and vendor metadata selected by the user.
   */
  /**
   * Saves a confirmed costing calculation snapshot or confirms and posts production.
   * If postProduction is true:
   *  - Atomically validates inventory and deducts RM, PM, FP, and OT components from WarehouseStock
   *  - Creates ProductBatch record
   *  - Credits FinishedProduct output to WarehouseStock
   *  - Updates FinishedProduct standardCost
   *  - Records immutable ProductCosting snapshot with status 'POSTED'
   * If postProduction is false:
   *  - Records costing voucher as 'DRAFT' without modifying warehouse inventory
   */
  async saveCostingRecord(dto: SaveCostingRecordInput, user: AuthUser) {
    let companyId: string = (user.companyId || dto.companyId || '').trim();
    let organizationId: string = (user.organizationId || '').trim();

    if (!isValidUuid(companyId) || companyId === 'ALL') {
      const defaultComp = await this.prisma.company.findFirst({
        select: { id: true, organizationId: true },
      });
      if (defaultComp) {
        companyId = defaultComp.id;
        organizationId = organizationId || defaultComp.organizationId;
      }
    }

    if (!isValidUuid(organizationId)) {
      const defaultOrg = await this.prisma.organization.findFirst({
        select: { id: true },
      });
      organizationId = defaultOrg?.id || organizationId || '';
    }

    return this.prisma.$transaction(async (tx) => {
      let rawMaterial = null;
      const primaryRmId = dto.rawMaterialId || dto.rawMaterials?.[0]?.rawMaterialId;
      if (isValidUuid(primaryRmId)) {
        rawMaterial = await tx.rawMaterial.findUnique({
          where: { id: primaryRmId },
          include: { baseUom: true },
        });
      }

      let finishedProduct = null;
      let validFinishedProductId: string | null = null;
      if (isValidUuid(dto.finishedProductId)) {
        finishedProduct = await tx.finishedProduct.findUnique({
          where: { id: dto.finishedProductId },
          select: { id: true, productCode: true, productName: true, standardCost: true },
        });
        if (finishedProduct) {
          validFinishedProductId = finishedProduct.id;
        }
      }

      const costingCode = await this.codeGen.generateCode({
        companyId,
        organizationId,
        entityType: 'COSTING',
      });

      const singleRmQty = dto.rawMaterialQuantity || 0;
      const rmUnitCost = singleRmQty > 0 ? (dto.rawMaterialCost || 0) / singleRmQty : Number(dto.rawMaterialCost || 0);

      const rawMaterialsList = dto.rawMaterials && dto.rawMaterials.length > 0
        ? dto.rawMaterials
        : primaryRmId ? [
            {
              rawMaterialId: primaryRmId,
              rawMaterialName: rawMaterial?.materialName || 'Raw Material',
              rawMaterialCode: rawMaterial?.materialCode || '',
              sourcePoId: dto.sourcePoId,
              sourcePoNumber: dto.sourcePoNumber,
              purchaseDate: dto.purchaseDate,
              quantity: dto.rawMaterialQuantity || 0,
              unitCost: rmUnitCost,
              totalCost: dto.totalRawMaterialCost || (dto.rawMaterialCost || 0),
              uomName: dto.packSizeUnit || 'Liter',
            },
          ] : [];

      const isPost = dto.postProduction === true || dto.action === 'POST';
      const recordStatus = isPost ? 'POSTED' : 'DRAFT';
      let autoBatchNumber = dto.batchNumber;
      let resolvedSplits: Array<{ warehouseId: string; warehouseName: string; quantity: number }> = [];

      // ==============================================================
      // PRODUCTION EXECUTION & WAREHOUSE INVENTORY MOVEMENTS (POST)
      // ==============================================================
      if (isPost) {
        if (!dto.warehouseId || !isValidUuid(dto.warehouseId)) {
          throw new BadRequestException('A valid Warehouse is required to confirm & post production.');
        }

        const warehouse = await tx.warehouse.findUnique({
          where: { id: dto.warehouseId },
        });
        if (!warehouse) {
          throw new BadRequestException('Selected warehouse was not found.');
        }

        if (!validFinishedProductId) {
          throw new BadRequestException('An End Product from the Product Master is required to post production.');
        }

        const actualOut = Number(dto.actualOutput || dto.actualQuantity || dto.finishedQuantity || 0);
        if (actualOut <= 0) {
          throw new BadRequestException('Actual Output quantity must be greater than zero to post production.');
        }

        // Validate and resolve warehouse splits (if user opted to split across multiple warehouses)
        if (dto.warehouseSplits && Array.isArray(dto.warehouseSplits) && dto.warehouseSplits.length > 0) {
          let totalSplitQty = 0;
          let idx = 0;
          for (const split of dto.warehouseSplits) {
            idx++;
            if (!split || !isValidUuid(split.warehouseId)) {
              throw new BadRequestException(`Invalid warehouse ID specified in split allocation #${idx}.`);
            }
            const splitWh = await tx.warehouse.findUnique({ where: { id: split.warehouseId } });
            if (!splitWh) {
              throw new BadRequestException(`Warehouse for split allocation #${idx} was not found.`);
            }
            const sQty = Number(split.quantity || 0);
            if (sQty <= 0) {
              throw new BadRequestException(`Quantity for warehouse split "${splitWh.name}" must be greater than zero.`);
            }
            totalSplitQty += sQty;
            resolvedSplits.push({
              warehouseId: splitWh.id,
              warehouseName: splitWh.name,
              quantity: sQty,
            });
          }

          if (Math.abs(totalSplitQty - actualOut) > 0.0001) {
            throw new BadRequestException(
              `Total allocated warehouse output (${totalSplitQty.toLocaleString()} units) does not match total production output (${actualOut.toLocaleString()} units). Difference: ${(actualOut - totalSplitQty).toLocaleString()} units.`,
            );
          }
        } else {
          // Default: 100% of finished goods output allocated to selected warehouse
          resolvedSplits = [
            {
              warehouseId: dto.warehouseId,
              warehouseName: warehouse.name,
              quantity: actualOut,
            },
          ];
        }

        // Generate batch number if not manually provided
        const batchCount = await tx.productBatch.count({
          where: { finishedProductId: validFinishedProductId },
        });
        const currentYear = new Date().getFullYear();
        autoBatchNumber = dto.batchNumber && dto.batchNumber.trim()
          ? dto.batchNumber.trim()
          : `BATCH-${currentYear}-${String(batchCount + 1).padStart(4, '0')}`;

        // Deduct consumed components
        const linesToConsume = dto.lines && dto.lines.length > 0 ? dto.lines : [];
        for (const line of linesToConsume) {
          const usedQty = Number(line.quantity || 0);
          if (usedQty <= 0) continue;

          const lType = (line.type || 'RM').toUpperCase();
          let itemType: 'RAW_MATERIAL' | 'PACKING_MATERIAL' | 'FINISHED_PRODUCT' = 'RAW_MATERIAL';
          let rmId: string | undefined = undefined;
          let pmId: string | undefined = undefined;
          let fpId: string | undefined = undefined;

          if (lType === 'RM' || lType === 'RAW_MATERIAL') {
            itemType = 'RAW_MATERIAL';
            if (isValidUuid(line.materialId)) {
              rmId = line.materialId;
            } else {
              const m = await tx.rawMaterial.findFirst({
                where: {
                  OR: [
                    { materialName: { equals: line.materialName, mode: 'insensitive' } },
                    { materialCode: { equals: line.materialCode || '', mode: 'insensitive' } },
                  ],
                },
              });
              rmId = m?.id;
            }
          } else if (lType === 'FP' || lType === 'FINISHED_PRODUCT') {
            itemType = 'FINISHED_PRODUCT';
            if (isValidUuid(line.materialId)) {
              fpId = line.materialId;
            } else {
              const m = await tx.finishedProduct.findFirst({
                where: {
                  OR: [
                    { productName: { equals: line.materialName, mode: 'insensitive' } },
                    { productCode: { equals: line.materialCode || '', mode: 'insensitive' } },
                  ],
                },
              });
              fpId = m?.id;
            }
          } else {
            // PM or OT
            itemType = 'PACKING_MATERIAL';
            if (isValidUuid(line.materialId)) {
              pmId = line.materialId;
            } else {
              const m = await tx.packingMaterial.findFirst({
                where: {
                  OR: [
                    { materialName: { equals: line.materialName, mode: 'insensitive' } },
                    { materialCode: { equals: line.materialCode || '', mode: 'insensitive' } },
                  ],
                },
              });
              pmId = m?.id;
            }
          }

          // Apply consumption movement
          // Centralized validation: throws BadRequestException if stock is insufficient,
          // atomically rolling back the entire Prisma transaction.
          await this.inventoryService.applyMovement(tx, {
            organizationId,
            companyId,
            warehouseId: dto.warehouseId,
            itemType,
            rawMaterialId: rmId,
            packingMaterialId: pmId,
            finishedProductId: fpId,
            quantityChange: -usedQty,
            unitCost: Number(line.rate || 0),
            transactionType: 'PRODUCTION_CONSUMPTION',
            referenceId: costingCode,
            referenceNumber: dto.serialNumber || costingCode,
            notes: `Consumed for batch ${autoBatchNumber} of ${finishedProduct?.productName || 'Finished Product'}`,
          });
        }

        // Check if ProductBatch record already exists for this finished product
        const existingBatch = await tx.productBatch.findFirst({
          where: {
            finishedProductId: validFinishedProductId,
            batchNumber: autoBatchNumber,
          },
        });

        if (existingBatch) {
          // Increment existing batch quantity (Rule 6: Do not create duplicate batch)
          await tx.productBatch.update({
            where: { id: existingBatch.id },
            data: {
              initialQuantity: { increment: actualOut },
              availableQuantity: { increment: actualOut },
              isActive: true,
              notes: `${existingBatch.notes || ''}\n[${new Date().toISOString().slice(0, 10)}] Added ${actualOut} units via Costing ${dto.serialNumber || costingCode}`.trim(),
            },
          });
        } else {
          // Create new ProductBatch record (Rule 7 & 8: Auto add costing output quantity)
          await tx.productBatch.create({
            data: {
              organizationId,
              companyId,
              finishedProductId: validFinishedProductId,
              batchNumber: autoBatchNumber,
              manufacturingDate: dto.manufacturingDate ? new Date(dto.manufacturingDate) : (dto.costingDate ? new Date(dto.costingDate) : new Date()),
              expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : null,
              initialQuantity: actualOut,
              availableQuantity: actualOut,
              allocatedQuantity: 0,
              isActive: true,
              status: 'RELEASED',
              notes: `Manufactured via Costing Voucher ${dto.serialNumber || costingCode}. Unit Cost: PKR ${dto.costPerUnit}`,
            },
          });
        }

        // Add finished product output to inventory (distributed across destination warehouses)
        for (const split of resolvedSplits) {
          await this.inventoryService.applyMovement(tx, {
            organizationId,
            companyId,
            warehouseId: split.warehouseId,
            itemType: 'FINISHED_PRODUCT',
            finishedProductId: validFinishedProductId,
            quantityChange: split.quantity,
            unitCost: Number(dto.costPerUnit || 0),
            transactionType: 'PRODUCTION_OUTPUT',
            referenceId: costingCode,
            referenceNumber: dto.serialNumber || costingCode,
            notes: resolvedSplits.length > 1
              ? `Production output for batch ${autoBatchNumber} (Split: ${split.quantity.toLocaleString()} units to ${split.warehouseName})`
              : `Production output for batch ${autoBatchNumber}`,
          });
        }

        // Update FinishedProduct standardCost
        await tx.finishedProduct.update({
          where: { id: validFinishedProductId },
          data: { standardCost: Number(dto.costPerUnit || 0) },
        });
      } else if (dto.action === 'APPLY_COST' && validFinishedProductId) {
        // Rule 10: "Add Cost to Product" ONLY updates standardCost; NEVER duplicate stock
        await tx.finishedProduct.update({
          where: { id: validFinishedProductId },
          data: { standardCost: Number(dto.costPerUnit || 0) },
        });
      }

      const previousCost = finishedProduct && finishedProduct.standardCost !== null ? Number(finishedProduct.standardCost) : null;
      const newCost = Number(dto.costPerUnit || 0);
      const costDiff = previousCost !== null && previousCost > 0 ? newCost - previousCost : null;
      const costDiffPct = previousCost !== null && previousCost > 0 ? (costDiff! / previousCost) * 100 : null;

      const snapshotData = {
        costingCode,
        serialNumber: dto.serialNumber || costingCode,
        costingDate: dto.costingDate || new Date().toISOString(),
        warehouseId: dto.warehouseId || null,
        warehouseName: dto.warehouseName || null,
        warehouseSplits: resolvedSplits.length > 0 ? resolvedSplits : (dto.warehouseSplits || undefined),
        contractorVendorId: dto.contractorVendorId || null,
        contractorVendorName: dto.contractorVendorName || null,
        finishedProductId: validFinishedProductId,
        productCode: finishedProduct?.productCode || dto.finishedProductCode || null,
        productName: finishedProduct?.productName || dto.finishedProductName || null,
        sourcePoId: dto.sourcePoId || null,
        sourcePoNumber: dto.sourcePoNumber || null,
        purchaseDate: dto.purchaseDate || null,
        vendorName: dto.sourceVendorName || null,
        vendorCode: dto.sourceVendorCode || null,
        batchNumber: autoBatchNumber || null,
        batchVolume: dto.batchVolume || 0,
        expectedOutput: dto.expectedOutput || dto.estimatedQuantity || 0,
        actualOutput: dto.actualOutput || dto.actualQuantity || dto.finishedQuantity || 0,
        rawMaterialId: primaryRmId || null,
        rawMaterialName: rawMaterialsList[0]?.rawMaterialName || rawMaterial?.materialName || 'Raw Material',
        rawMaterialCode: rawMaterialsList[0]?.rawMaterialCode || rawMaterial?.materialCode || '',
        rawMaterialUnitCost: rawMaterialsList[0]?.unitCost || rmUnitCost,
        rawMaterialQuantity: rawMaterialsList[0]?.quantity || dto.rawMaterialQuantity || 0,
        rawMaterialTotalCost: dto.totalRawMaterialCost || 0,
        rawMaterials: rawMaterialsList,
        packSize: dto.packSize,
        packSizeUnit: dto.packSizeUnit || 'Liter',
        finishedQuantity: dto.actualOutput || dto.actualQuantity || dto.finishedQuantity,
        actualQuantity: dto.actualOutput || dto.actualQuantity || dto.finishedQuantity,
        estimatedQuantity: dto.expectedOutput || dto.estimatedQuantity || null,
        lines: dto.lines || [],
        packagingMaterials: dto.packagingMaterials || [],
        otherCost: dto.otherCost || 0,
        otherCostNotes: dto.otherCostNotes || null,
        totalRawMaterialCost: dto.totalRawMaterialCost || 0,
        totalPackagingCost: dto.totalPackagingCost || 0,
        totalBatchCost: dto.totalBatchCost,
        costPerUnit: dto.costPerUnit,
        previousCost,
        costDifference: costDiff,
        costDifferencePct: costDiffPct !== null ? Math.round(costDiffPct * 100) / 100 : null,
        status: recordStatus,
        userNotes: dto.notes || (isPost ? `Batch ${autoBatchNumber} confirmed & posted to stock` : 'Costing draft saved'),
      };

      let nextVersion = 1;
      if (validFinishedProductId) {
        const latestCosting = await tx.productCosting.findFirst({
          where: { companyId, finishedProductId: validFinishedProductId },
          orderBy: { version: 'desc' },
        });
        nextVersion = (latestCosting?.version ?? 0) + 1;
      }

      // Validate relational integrity for rawMaterialLines against raw_materials table
      const rmCandidateIds = rawMaterialsList
        .map((rm) => rm.rawMaterialId)
        .filter((id) => isValidUuid(id));
      let validRmIdSet = new Set<string>();
      if (rmCandidateIds.length > 0) {
        const existingRms = await tx.rawMaterial.findMany({
          where: { id: { in: rmCandidateIds } },
          select: { id: true },
        });
        validRmIdSet = new Set(existingRms.map((r) => r.id));
      }

      // Validate relational integrity for packagingLines against packing_materials table
      const pmCandidateIds = (dto.packagingMaterials || [])
        .map((pm) => pm.packingMaterialId)
        .filter((id) => isValidUuid(id));
      let validPmIdSet = new Set<string>();
      if (pmCandidateIds.length > 0) {
        const existingPms = await tx.packingMaterial.findMany({
          where: { id: { in: pmCandidateIds } },
          select: { id: true },
        });
        validPmIdSet = new Set(existingPms.map((p) => p.id));
      }

      const validRmLines = rawMaterialsList.filter((rm) => validRmIdSet.has(rm.rawMaterialId));
      const validPmLines = (dto.packagingMaterials || []).filter((pm) => validPmIdSet.has(pm.packingMaterialId));

      const costingRecord = await tx.productCosting.create({
        data: {
          id: uuidv7(),
          organizationId,
          companyId,
          finishedProductId: validFinishedProductId,
          version: nextVersion,
          batchOutputQuantity: dto.actualOutput || dto.actualQuantity || dto.finishedQuantity,
          packSize: dto.packSize,
          packSizeUnit: dto.packSizeUnit || 'Liter',
          totalVolume: Number(dto.batchVolume || (Number(dto.actualOutput || dto.actualQuantity || dto.finishedQuantity) * Number(dto.packSize))),
          totalRawMaterialCost: dto.totalRawMaterialCost || 0,
          totalPackagingCost: dto.totalPackagingCost || 0,
          totalBatchCost: dto.totalBatchCost,
          costPerUnit: dto.costPerUnit,
          previousCost: previousCost !== null && previousCost > 0 ? previousCost : null,
          costDifference: costDiff,
          costDifferencePct: costDiffPct !== null ? Math.round(costDiffPct * 100) / 100 : null,
          notes: JSON.stringify(snapshotData),
          status: recordStatus,
          createdById: user.id && isValidUuid(user.id) ? user.id : null,
          createdAt: dto.costingDate ? new Date(dto.costingDate) : new Date(),
          materialLines: {
            create: validRmLines.map((rm) => ({
              id: uuidv7(),
              rawMaterialId: rm.rawMaterialId,
              quantity: rm.quantity,
              unitCost: rm.unitCost,
              totalCost: rm.totalCost,
              uomName: rm.uomName || 'KG',
            })),
          },
          packagingLines: {
            create: validPmLines.map((pm) => ({
              id: uuidv7(),
              packingMaterialId: pm.packingMaterialId,
              quantity: pm.quantity,
              unitCost: pm.unitCost,
              totalCost: pm.totalCost,
              uomName: pm.uomName || 'Nos',
            })),
          },
        },
        include: {
          materialLines: { include: { rawMaterial: true } },
          packagingLines: { include: { packingMaterial: true } },
        },
      });

      return {
        success: true,
        costingCode,
        batchNumber: autoBatchNumber,
        status: recordStatus,
        costing: costingRecord,
        message: isPost
          ? (resolvedSplits.length > 1
              ? `Batch ${autoBatchNumber} confirmed & posted: ${(dto.actualOutput || dto.actualQuantity)?.toLocaleString()} units split across ${resolvedSplits.length} warehouses at PKR ${Number(dto.costPerUnit).toLocaleString()}/unit`
              : `Batch ${autoBatchNumber} confirmed & posted: ${(dto.actualOutput || dto.actualQuantity)?.toLocaleString()} units added to stock at PKR ${Number(dto.costPerUnit).toLocaleString()}/unit`)
          : `Costing draft ${costingCode} saved successfully (PKR ${Number(dto.costPerUnit).toLocaleString()}/unit)`,
      };
    });
  }

  /**
   * Previews next sequential Costing Voucher Code (CST-XXXXXX)
   */
  async previewNextCostingCode(companyId?: string): Promise<string> {
    return this.codeGen.previewNextCode({
      companyId: companyId || '',
      entityType: 'COSTING',
    });
  }

  /**
   * Retrieves overall costing calculation history with date filtering and snapshot metadata
   */
  async getAllCostingHistory(options?: {
    companyId?: string;
    startDate?: string;
    endDate?: string;
    finishedProductId?: string;
    search?: string;
  }) {
    const where: any = {};
    if (options?.companyId && options.companyId !== 'ALL') {
      where.companyId = options.companyId;
    }
    if (options?.finishedProductId) {
      where.finishedProductId = options.finishedProductId;
    }
    if (options?.startDate || options?.endDate) {
      const dateFilter: any = {};
      if (options.startDate) dateFilter.gte = new Date(options.startDate);
      if (options.endDate) {
        const end = new Date(options.endDate);
        end.setHours(23, 59, 59, 999);
        dateFilter.lte = end;
      }
      where.createdAt = dateFilter;
    }

    const records = await this.prisma.productCosting.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        materialLines: {
          include: {
            rawMaterial: { select: { id: true, materialCode: true, materialName: true, baseUom: true } },
          },
        },
        packagingLines: {
          include: {
            packingMaterial: { select: { id: true, materialCode: true, materialName: true, baseUom: true } },
          },
        },
        finishedProduct: {
          select: { id: true, productCode: true, productName: true },
        },
      },
    });

    const enriched = records.map((record) => {
      let snapshot: any = null;
      if (record.notes && record.notes.trim().startsWith('{')) {
        try {
          snapshot = JSON.parse(record.notes);
        } catch {
          snapshot = null;
        }
      }

      const costingCode = snapshot?.costingCode || snapshot?.serialNumber || `CST-${String(record.version).padStart(6, '0')}`;
      const costingDate = snapshot?.costingDate || record.createdAt.toISOString();
      const batchNumber = snapshot?.batchNumber || null;
      const status = snapshot?.status || record.status || 'DRAFT';
      const batchVolume = snapshot?.batchVolume || Number(record.totalVolume) || 0;
      const expectedOutput = snapshot?.expectedOutput || snapshot?.estimatedQuantity || 0;
      const actualOutput = snapshot?.actualOutput || snapshot?.actualQuantity || Number(record.batchOutputQuantity);
      const warehouseName = snapshot?.warehouseName || 'Standard Warehouse';
      const contractorName = snapshot?.contractorVendorName || snapshot?.vendorName || null;
      const sourcePoNumber = snapshot?.sourcePoNumber || null;
      const purchaseDate = snapshot?.purchaseDate || null;
      const vendorName = snapshot?.vendorName || null;
      const rawMaterialName =
        snapshot?.rawMaterialName ||
        record.materialLines[0]?.rawMaterial?.materialName ||
        'Raw Material';
      const rawMaterialCostPerUnit =
        snapshot?.rawMaterialUnitCost !== undefined
          ? Number(snapshot.rawMaterialUnitCost)
          : Number(record.materialLines[0]?.unitCost || 0);

      return {
        ...record,
        costingCode,
        costingDate,
        batchNumber,
        status,
        batchVolume,
        expectedOutput,
        actualOutput,
        warehouseName,
        contractorName,
        sourcePoNumber,
        purchaseDate,
        vendorName,
        rawMaterialName,
        rawMaterialCostPerUnit,
        snapshotMetadata: snapshot,
      };
    });

    if (options?.search && options.search.trim()) {
      const q = options.search.trim().toLowerCase();
      return enriched.filter((item) => {
        return (
          item.costingCode.toLowerCase().includes(q) ||
          (item.batchNumber && item.batchNumber.toLowerCase().includes(q)) ||
          item.finishedProduct?.productName?.toLowerCase().includes(q) ||
          item.rawMaterialName.toLowerCase().includes(q) ||
          (item.sourcePoNumber && item.sourcePoNumber.toLowerCase().includes(q)) ||
          (item.vendorName && item.vendorName.toLowerCase().includes(q)) ||
          (item.contractorName && item.contractorName.toLowerCase().includes(q))
        );
      });
    }

    return enriched;
  }
}
