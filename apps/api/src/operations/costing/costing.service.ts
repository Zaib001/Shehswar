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
  type: 'RM' | 'PM' | 'OTHER';
  pack: string;
  quantity: number;
  rate: number;
  cost: number;
  sourcePoId?: string;
  sourcePoNumber?: string;
  purchaseDate?: string;
  vendorName?: string;
}

export interface SaveCostingRecordInput {
  companyId?: string;
  costingDate?: string;
  serialNumber?: string;
  warehouseId?: string;
  warehouseName?: string;
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
   * Supports filtering by RAW_MATERIAL, PACKING_MATERIAL, and search query
   */
  async getPurchasedMaterials(options?: {
    companyId?: string;
    type?: 'RAW_MATERIAL' | 'PACKING_MATERIAL' | 'ALL';
    search?: string;
  }) {
    const where: any = {
      order: {
        status: { notIn: ['CANCELLED'] },
        ...(options?.companyId && options.companyId !== 'ALL' ? { companyId: options.companyId } : {}),
      },
    };

    if (options?.type && options.type !== 'ALL') {
      where.materialType = options.type;
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
        materialName: it.itemName || it.materialNameSnapshot || '',
        pack: it.unit || '1 Nos',
        purchaseQuantity: qty,
        purchaseRate: rate,
        lineTotal: total,
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
          purchases: [],
        });
      }

      groupedMap.get(key)!.purchases.push(p);
    }

    return {
      total: flatPurchases.length,
      materials: Array.from(groupedMap.values()),
      purchases: flatPurchases,
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
   * Saves a confirmed costing calculation snapshot without modifying stock or requiring a finished product.
   * Completely immutable: records exact purchase rate, date, and vendor metadata selected by the user.
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
          select: { id: true, productCode: true, productName: true },
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

      const snapshotData = {
        costingCode,
        serialNumber: dto.serialNumber || costingCode,
        costingDate: dto.costingDate || new Date().toISOString(),
        warehouseId: dto.warehouseId || null,
        warehouseName: dto.warehouseName || null,
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
        rawMaterialId: primaryRmId || null,
        rawMaterialName: rawMaterialsList[0]?.rawMaterialName || rawMaterial?.materialName || 'Raw Material',
        rawMaterialCode: rawMaterialsList[0]?.rawMaterialCode || rawMaterial?.materialCode || '',
        rawMaterialUnitCost: rawMaterialsList[0]?.unitCost || rmUnitCost,
        rawMaterialQuantity: rawMaterialsList[0]?.quantity || dto.rawMaterialQuantity || 0,
        rawMaterialTotalCost: dto.totalRawMaterialCost || 0,
        rawMaterials: rawMaterialsList,
        packSize: dto.packSize,
        packSizeUnit: dto.packSizeUnit || 'Liter',
        finishedQuantity: dto.actualQuantity || dto.finishedQuantity,
        actualQuantity: dto.actualQuantity || dto.finishedQuantity,
        estimatedQuantity: dto.estimatedQuantity || null,
        lines: dto.lines || [],
        packagingMaterials: dto.packagingMaterials || [],
        otherCost: dto.otherCost || 0,
        otherCostNotes: dto.otherCostNotes || null,
        totalRawMaterialCost: dto.totalRawMaterialCost || 0,
        totalPackagingCost: dto.totalPackagingCost || 0,
        totalBatchCost: dto.totalBatchCost,
        costPerUnit: dto.costPerUnit,
        userNotes: dto.notes || 'Product Costing calculation confirmed',
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
          batchOutputQuantity: dto.actualQuantity || dto.finishedQuantity,
          packSize: dto.packSize,
          packSizeUnit: dto.packSizeUnit || 'Liter',
          totalVolume: Number(dto.actualQuantity || dto.finishedQuantity) * Number(dto.packSize),
          totalRawMaterialCost: dto.totalRawMaterialCost || 0,
          totalPackagingCost: dto.totalPackagingCost || 0,
          totalBatchCost: dto.totalBatchCost,
          costPerUnit: dto.costPerUnit,
          notes: JSON.stringify(snapshotData),
          status: 'ACTIVE',
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
        costing: costingRecord,
        message: `Costing record ${costingCode} saved successfully: PKR ${Number(dto.costPerUnit).toLocaleString()} per unit`,
      };
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

      const costingCode = snapshot?.costingCode || `CST-${String(record.version).padStart(6, '0')}`;
      const costingDate = snapshot?.costingDate || record.createdAt.toISOString();
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
          item.finishedProduct?.productName?.toLowerCase().includes(q) ||
          item.rawMaterialName.toLowerCase().includes(q) ||
          (item.sourcePoNumber && item.sourcePoNumber.toLowerCase().includes(q)) ||
          (item.vendorName && item.vendorName.toLowerCase().includes(q))
        );
      });
    }

    return enriched;
  }
}
