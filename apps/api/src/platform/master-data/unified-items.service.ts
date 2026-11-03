/**
 * SHEHSWAR ONE360 - Unified Items Service
 *
 * Handles creation from "+ Add Item", category-driven routing,
 * duplicate detection, and the Global Product Lookup Service.
 */
import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { CodeGenerationService } from '../code-generation/code-generation.service';
import { CategoryRouterService, TargetEntityType } from './category-router.service';
import { AuthUser } from '@shehswar/types';

export interface CreateUnifiedItemDto {
  categoryId: string;
  itemName: string;
  urduName?: string;
  brand?: string;
  grade?: string;
  description?: string;

  // Finished Product Specific Fields
  productType?: string;
  mType?: string;
  fertilizerType?: string;
  productForm?: string;
  packagingMaterialId?: string; // Physical PackingMaterial (e.g. 2L HDPE Bottle)
  packagingContainer?: number;  // Numeric Container (e.g. 100, 200)
  packSizeQuantity?: number;    // Numeric Pack Size (e.g. 2)
  packSizeUnit?: string;        // Unit (e.g. Liter)
  packSizeId?: string;          // Optional PackSize reference
  ppc?: number;                 // Pack Per Carton
  baseSellingPrice?: number;    // defaultSellingPrice
  baseUomId?: string;
  salesUomId?: string;

  // Raw Material Specific Fields
  purchaseUomId?: string;
  purchaseConversionFactor?: number;
  batchControlled?: boolean;
  expiryControlled?: boolean;
  shelfLifeDays?: number;
  qcRequired?: boolean;
  storageRequirements?: string;

  // Packing Material Specific Fields
  packCompatibility?: string;

  // Common Stock Fields
  minimumStock?: number;
  maximumStock?: number;
  reorderLevel?: number;

  // Dynamic Unknown Fields (from import or user extension)
  customFields?: Record<string, any>;
}

@Injectable()
export class UnifiedItemsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly codeGen: CodeGenerationService,
    private readonly router: CategoryRouterService,
  ) {}

  /**
   * Pre-save duplicate check
   */
  async checkDuplicate(params: {
    companyId: string;
    itemName: string;
    targetEntity: TargetEntityType;
    excludeId?: string;
  }) {
    const trimmed = (params.itemName || '').trim().toLowerCase();
    if (!trimmed) return { hasDuplicate: false, isDuplicate: false };

    if (params.targetEntity === 'FINISHED_PRODUCT') {
      const where: any = {
        companyId: params.companyId,
        productName: { equals: params.itemName.trim(), mode: 'insensitive' },
      };
      if (params.excludeId) {
        where.id = { not: params.excludeId };
      }
      const existing = await this.prisma.finishedProduct.findFirst({
        where,
        select: { id: true, productCode: true, productName: true },
      });
      if (existing) {
        return {
          hasDuplicate: true,
          isDuplicate: true,
          matchedItem: {
            id: existing.id,
            code: existing.productCode,
            name: existing.productName,
            entityType: 'FINISHED_PRODUCT',
          },
        };
      }
    } else if (params.targetEntity === 'RAW_MATERIAL') {
      const where: any = {
        companyId: params.companyId,
        materialName: { equals: params.itemName.trim(), mode: 'insensitive' },
      };
      if (params.excludeId) {
        where.id = { not: params.excludeId };
      }
      const existing = await this.prisma.rawMaterial.findFirst({
        where,
        select: { id: true, materialCode: true, materialName: true },
      });
      if (existing) {
        return {
          hasDuplicate: true,
          isDuplicate: true,
          matchedItem: {
            id: existing.id,
            code: existing.materialCode,
            name: existing.materialName,
            entityType: 'RAW_MATERIAL',
          },
        };
      }
    } else {
      const where: any = {
        companyId: params.companyId,
        materialName: { equals: params.itemName.trim(), mode: 'insensitive' },
      };
      if (params.excludeId) {
        where.id = { not: params.excludeId };
      }
      const existing = await this.prisma.packingMaterial.findFirst({
        where,
        select: { id: true, materialCode: true, materialName: true },
      });
      if (existing) {
        return {
          hasDuplicate: true,
          isDuplicate: true,
          matchedItem: {
            id: existing.id,
            code: existing.materialCode,
            name: existing.materialName,
            entityType: 'PACKING_MATERIAL',
          },
        };
      }
    }

    return { hasDuplicate: false, isDuplicate: false };
  }

  /**
   * Main "+ Add Item" Handler
   */
  async createUnifiedItem(dto: CreateUnifiedItemDto, user: AuthUser) {
    if (!dto.categoryId) {
      throw new BadRequestException('Item Category is required');
    }
    if (!dto.itemName || !dto.itemName.trim()) {
      throw new BadRequestException('Item Name is required');
    }

    const companyId = user.companyId;
    const organizationId = user.organizationId;

    // 1. Resolve Category Routing
    const routeInfo = await this.router.resolveCategory(dto.categoryId);

    // 2. Generate Collision-Safe Sequential Code
    const generatedCode = await this.codeGen.generateCode({
      companyId,
      organizationId,
      entityType: routeInfo.targetEntity,
    });

    // 3. Create Record in the appropriate Database Table
    if (routeInfo.targetEntity === 'FINISHED_PRODUCT') {
      // Find fallback UOM if not supplied
      let baseUomId = dto.baseUomId;
      if (!baseUomId) {
        const uom = await this.prisma.unitOfMeasure.findFirst({
          where: { organizationId, code: { in: ['LITER', 'KG', 'NOS'] } },
        });
        baseUomId = uom?.id;
      }

      // Dynamic PackSize Resolution & Auto Code Generation
      let packSizeId = dto.packSizeId;
      const packQty = dto.packSizeQuantity !== undefined ? Number(dto.packSizeQuantity) : 1;
      const packUnit = dto.packSizeUnit?.trim() || 'Liter';

      if (!packSizeId && packQty && packUnit) {
        const uom = await this.prisma.unitOfMeasure.findFirst({
          where: {
            OR: [
              { code: { equals: packUnit, mode: 'insensitive' } },
              { symbol: { equals: packUnit, mode: 'insensitive' } },
              { name: { equals: packUnit, mode: 'insensitive' } },
            ],
          },
        });
        const uomId = uom?.id;

        let existingPs = uomId
          ? await this.prisma.packSize.findFirst({
              where: { organizationId, quantity: packQty, uomId },
              include: { uom: true },
            })
          : null;

        if (!existingPs) {
          const psCode = await this.codeGen.generateCode({
            companyId,
            organizationId,
            entityType: 'PACK_SIZE',
          });
          existingPs = await this.prisma.packSize.create({
            data: {
              organizationId,
              code: psCode,
              name: `${packQty} ${uom?.name || packUnit}`,
              quantity: packQty,
              uomId: uomId || undefined,
              status: 'ACTIVE',
            },
            include: { uom: true },
          });
        }
        packSizeId = existingPs.id;
      }

      const product = await this.prisma.finishedProduct.create({
        data: {
          organizationId,
          companyId,
          categoryId: routeInfo.categoryId,
          productCode: generatedCode,
          productName: dto.itemName.trim(),
          urduName: dto.urduName?.trim() || null,
          brand: dto.brand?.trim() || 'Shehswar Agro',
          grade: dto.grade?.trim() || 'Standard',
          productType: dto.productType?.trim() || 'Insecticide',
          mType: dto.mType?.trim() || 'Insecticides',
          fertilizerType: dto.fertilizerType?.trim() || null,
          productForm: dto.productForm?.trim() || 'LIQUID',
          packagingMaterialId: dto.packagingMaterialId || null,
          packingQuantity: packQty,
          packingUnit: packUnit,
          packSizeId: packSizeId || null,
          ppc: dto.ppc ? Number(dto.ppc) : 1,
          baseUomId: baseUomId || undefined,
          salesUomId: dto.salesUomId || baseUomId || undefined,
          minimumStock: dto.minimumStock ? Number(dto.minimumStock) : 0,
          reorderLevel: dto.reorderLevel ? Number(dto.reorderLevel) : 0,
          defaultSellingPrice: dto.baseSellingPrice ? Number(dto.baseSellingPrice) : null,
          standardCost: null, // Zero or null until costed in Product Costing!
          status: 'ACTIVE',
          customFields: {
            ...(dto.customFields || {}),
            ...(dto.packagingContainer !== undefined ? { packagingContainer: Number(dto.packagingContainer) } : {}),
          },
        },
        include: {
          category: true,
          packagingMaterial: true,
          packSize: { include: { uom: true } },
          baseUom: true,
        },
      });

      return {
        success: true,
        entityType: 'FINISHED_PRODUCT',
        item: product,
        code: generatedCode,
        destinationUrl: routeInfo.destinationUrl,
        destinationLabel: routeInfo.destinationLabel,
        message: `Finished Product "${product.productName}" created with Code ${generatedCode}`,
      };
    }

    if (routeInfo.targetEntity === 'RAW_MATERIAL') {
      let baseUomId = dto.baseUomId;
      if (!baseUomId) {
        const uom = await this.prisma.unitOfMeasure.findFirst({
          where: { organizationId, code: { in: ['KG', 'LITER'] } },
        });
        baseUomId = uom?.id;
      }

      const rawMat = await this.prisma.rawMaterial.create({
        data: {
          organizationId,
          companyId,
          categoryId: routeInfo.categoryId,
          materialCode: generatedCode,
          materialName: dto.itemName.trim(),
          urduName: dto.urduName?.trim() || null,
          description: dto.description?.trim() || null,
          grade: dto.grade?.trim() || 'Technical Grade',
          baseUomId: baseUomId || undefined,
          purchaseUomId: dto.purchaseUomId || baseUomId || undefined,
          purchaseConversionFactor: dto.purchaseConversionFactor ? Number(dto.purchaseConversionFactor) : 1,
          batchControlled: dto.batchControlled !== undefined ? dto.batchControlled : true,
          expiryControlled: dto.expiryControlled !== undefined ? dto.expiryControlled : false,
          shelfLifeDays: dto.shelfLifeDays ? Number(dto.shelfLifeDays) : null,
          qcRequired: dto.qcRequired !== undefined ? dto.qcRequired : false,
          storageRequirements: dto.storageRequirements?.trim() || null,
          minimumStock: dto.minimumStock ? Number(dto.minimumStock) : 0,
          reorderLevel: dto.reorderLevel ? Number(dto.reorderLevel) : 0,
          status: 'ACTIVE',
          customFields: {
            ...(dto.customFields || {}),
            ...(dto.packagingContainer !== undefined ? { packagingContainer: Number(dto.packagingContainer) } : {}),
          },
        },
        include: {
          category: true,
          baseUom: true,
        },
      });

      return {
        success: true,
        entityType: 'RAW_MATERIAL',
        item: rawMat,
        code: generatedCode,
        destinationUrl: routeInfo.destinationUrl,
        destinationLabel: routeInfo.destinationLabel,
        message: `Raw Material "${rawMat.materialName}" created with Code ${generatedCode}`,
      };
    }

    // PACKING_MATERIAL (Bottles, Cartons, Shrink, Tape, Glue, Others)
    let baseUomId = dto.baseUomId;
    if (!baseUomId) {
      const uom = await this.prisma.unitOfMeasure.findFirst({
        where: { organizationId, code: 'NOS' },
      });
      baseUomId = uom?.id;
    }

    const packMat = await this.prisma.packingMaterial.create({
      data: {
        organizationId,
        companyId,
        categoryId: routeInfo.categoryId,
        materialCode: generatedCode,
        materialName: dto.itemName.trim(),
        urduName: dto.urduName?.trim() || null,
        description: dto.description?.trim() || null,
        packCompatibility: dto.packCompatibility?.trim() || null,
        baseUomId: baseUomId || undefined,
        purchaseUomId: dto.purchaseUomId || baseUomId || undefined,
        minimumStock: dto.minimumStock ? Number(dto.minimumStock) : 0,
        reorderLevel: dto.reorderLevel ? Number(dto.reorderLevel) : 0,
        status: 'ACTIVE',
        customFields: dto.customFields || undefined,
      },
      include: {
        category: true,
        baseUom: true,
      },
    });

    return {
      success: true,
      entityType: 'PACKING_MATERIAL',
      item: packMat,
      code: generatedCode,
      destinationUrl: routeInfo.destinationUrl,
      destinationLabel: routeInfo.destinationLabel,
      message: `Packing Material "${packMat.materialName}" created with Code ${generatedCode}`,
    };
  }

  /**
   * Central Global Product Master Lookup Service
   * Used by: Sales, Purchases, BOM, Costing, Warehouse, Inventory, etc.
   */
  async lookupByCode(code: string, companyId?: string) {
    if (!code || !code.trim()) {
      throw new BadRequestException('Code is required for lookup');
    }
    const cleanCode = code.trim();

    // 1. Search Finished Products
    const fpWhere: any = { productCode: cleanCode };
    if (companyId) fpWhere.companyId = companyId;

    const fp = await this.prisma.finishedProduct.findFirst({
      where: fpWhere,
      include: {
        category: true,
        packagingMaterial: true,
        packSize: { include: { uom: true } },
        baseUom: true,
        salesUom: true,
      },
    });

    if (fp) {
      const commercialVol = fp.packingQuantity !== null && fp.packingQuantity !== undefined
        ? Number(fp.packingQuantity)
        : (fp.packSize?.quantity ? Number(fp.packSize.quantity) : 1);
      const volUnit = fp.packingUnit ?? fp.packSize?.uom?.name ?? fp.baseUom?.name ?? 'Liter';
      const commercialPack = fp.packSize?.name ?? `${commercialVol} ${volUnit}`;

      return {
        found: true,
        entityType: 'FINISHED_PRODUCT',
        id: fp.id,

        // Rule 12 Canonical Product Lookup Fields
        productCode: fp.productCode,
        productName: fp.productName,
        category: fp.category?.name ?? 'Finished Goods',
        categoryCode: fp.category?.code ?? '41-01',
        commercialPackSize: commercialPack,
        packSizeCode: fp.packSize?.code ?? null,
        commercialVolume: commercialVol,
        volumeUnit: volUnit,
        packagingMaterial: fp.packagingMaterial?.materialName ?? null,
        packagingMaterialCode: fp.packagingMaterial?.materialCode ?? null,
        unit: volUnit,
        ppc: fp.ppc ?? 1,
        mType: fp.mType,
        productType: fp.productType,
        price: fp.defaultSellingPrice ? Number(fp.defaultSellingPrice) : null,
        standardCost: fp.standardCost ? Number(fp.standardCost) : null,

        // Backwards Compatibility Fields
        code: fp.productCode,
        name: fp.productName,
        urduName: fp.urduName,
        categoryName: fp.category?.name ?? 'Finished Goods',
        packagingMaterialId: fp.packagingMaterialId,
        packagingMaterialName: fp.packagingMaterial?.materialName,
        packSizeQuantity: commercialVol,
        packSizeUnit: volUnit,
        baseSellingPrice: fp.defaultSellingPrice ? Number(fp.defaultSellingPrice) : null,
        currentManufacturingCost: fp.standardCost ? Number(fp.standardCost) : null,
        companyId: fp.companyId,
        organizationId: fp.organizationId,
        status: fp.status,
      };
    }

    // 2. Search Raw Materials
    const rmWhere: any = { materialCode: cleanCode };
    if (companyId) rmWhere.companyId = companyId;

    const rm = await this.prisma.rawMaterial.findFirst({
      where: rmWhere,
      include: { category: true, baseUom: true },
    });

    if (rm) {
      return {
        found: true,
        entityType: 'RAW_MATERIAL',
        id: rm.id,
        code: rm.materialCode,
        name: rm.materialName,
        urduName: rm.urduName,
        categoryCode: rm.category?.code ?? '41-51',
        categoryName: rm.category?.name ?? 'Raw Material',
        unit: rm.baseUom?.name ?? 'KG',
        standardCost: rm.standardCost ? Number(rm.standardCost) : null,
        lastPurchaseCost: rm.lastPurchaseCost ? Number(rm.lastPurchaseCost) : null,
        averageCost: rm.averageCost ? Number(rm.averageCost) : null,
        companyId: rm.companyId,
        status: rm.status,
      };
    }

    // 3. Search Packing Materials
    const pmWhere: any = { materialCode: cleanCode };
    if (companyId) pmWhere.companyId = companyId;

    const pm = await this.prisma.packingMaterial.findFirst({
      where: pmWhere,
      include: { category: true, baseUom: true },
    });

    if (pm) {
      return {
        found: true,
        entityType: 'PACKING_MATERIAL',
        id: pm.id,
        code: pm.materialCode,
        name: pm.materialName,
        urduName: pm.urduName,
        categoryCode: pm.category?.code ?? '41-81',
        categoryName: pm.category?.name ?? 'Packing Material',
        unit: pm.baseUom?.name ?? 'Nos',
        standardCost: pm.standardCost ? Number(pm.standardCost) : null,
        lastPurchaseCost: pm.lastPurchaseCost ? Number(pm.lastPurchaseCost) : null,
        companyId: pm.companyId,
        status: pm.status,
      };
    }

    return { found: false, message: `Item with code "${code}" not found` };
  }
}
