/**
 * SHEHSWAR ONE360 - Category Router Service
 *
 * Explicitly resolves Category -> Target Entity, Code Prefix, and Destination View.
 * Mandate: No generic fallbacks. Every category has an explicit mapping.
 */
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';

export type TargetEntityType = 'FINISHED_PRODUCT' | 'RAW_MATERIAL' | 'PACKING_MATERIAL';

export interface CategoryRoutingResult {
  categoryId: string;
  categoryCode: string;
  categoryName: string;
  targetEntity: TargetEntityType;
  codePrefix: 'FG' | 'RM' | 'PM';
  destinationUrl: string;
  destinationLabel: string;
  subCategoryName?: string;
}

export interface UnifiedCategoryItem {
  id: string;
  code: string;
  name: string;
  entityType: TargetEntityType;
  badge: string;
  description?: string | null;
}

@Injectable()
export class CategoryRouterService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Resolves category to entity, code prefix, and UI destination
   */
  async resolveCategory(categoryId: string): Promise<CategoryRoutingResult> {
    // 1. Check Finished Product category table
    const prodCat = await this.prisma.productCategory.findUnique({
      where: { id: categoryId },
    });

    if (prodCat) {
      return {
        categoryId: prodCat.id,
        categoryCode: prodCat.code,
        categoryName: prodCat.name,
        targetEntity: 'FINISHED_PRODUCT',
        codePrefix: 'FG',
        destinationUrl: '/master-data/finished-products',
        destinationLabel: 'Finished Products Catalog',
      };
    }

    // 2. Check Material Category table
    const matCat = await this.prisma.materialCategory.findUnique({
      where: { id: categoryId },
    });

    if (!matCat) {
      throw new NotFoundException(`Category not found with ID: ${categoryId}`);
    }

    // Explicit Mapping Rules
    switch (matCat.code) {
      case '41-51': // Raw Material
        return {
          categoryId: matCat.id,
          categoryCode: matCat.code,
          categoryName: matCat.name,
          targetEntity: 'RAW_MATERIAL',
          codePrefix: 'RM',
          destinationUrl: '/master-data/raw-materials',
          destinationLabel: 'Raw Materials',
        };

      case '41-31': // Wastage
        return {
          categoryId: matCat.id,
          categoryCode: matCat.code,
          categoryName: matCat.name,
          targetEntity: 'RAW_MATERIAL',
          codePrefix: 'RM',
          destinationUrl: '/master-data/raw-materials?category=41-31',
          destinationLabel: 'Materials → Wastage',
          subCategoryName: 'Wastage',
        };

      case '41-81': // Packing Material (General)
        return {
          categoryId: matCat.id,
          categoryCode: matCat.code,
          categoryName: matCat.name,
          targetEntity: 'PACKING_MATERIAL',
          codePrefix: 'PM',
          destinationUrl: '/master-data/packing-materials',
          destinationLabel: 'Packing Materials',
        };

      case '41-82': // Bottles
        return {
          categoryId: matCat.id,
          categoryCode: matCat.code,
          categoryName: matCat.name,
          targetEntity: 'PACKING_MATERIAL',
          codePrefix: 'PM',
          destinationUrl: '/master-data/packing-materials?category=41-82',
          destinationLabel: 'Packing Materials → Bottles',
          subCategoryName: 'Bottles',
        };

      case '41-83': // Cartons
        return {
          categoryId: matCat.id,
          categoryCode: matCat.code,
          categoryName: matCat.name,
          targetEntity: 'PACKING_MATERIAL',
          codePrefix: 'PM',
          destinationUrl: '/master-data/packing-materials?category=41-83',
          destinationLabel: 'Packing Materials → Cartons',
          subCategoryName: 'Cartons',
        };

      case '41-84': // Shrink
        return {
          categoryId: matCat.id,
          categoryCode: matCat.code,
          categoryName: matCat.name,
          targetEntity: 'PACKING_MATERIAL',
          codePrefix: 'PM',
          destinationUrl: '/master-data/packing-materials?category=41-84',
          destinationLabel: 'Packing Materials → Shrink',
          subCategoryName: 'Shrink',
        };

      case '41-85': // Tape
        return {
          categoryId: matCat.id,
          categoryCode: matCat.code,
          categoryName: matCat.name,
          targetEntity: 'PACKING_MATERIAL',
          codePrefix: 'PM',
          destinationUrl: '/master-data/packing-materials?category=41-85',
          destinationLabel: 'Packing Materials → Tape',
          subCategoryName: 'Tape',
        };

      case '41-86': // Glue
        return {
          categoryId: matCat.id,
          categoryCode: matCat.code,
          categoryName: matCat.name,
          targetEntity: 'PACKING_MATERIAL',
          codePrefix: 'PM',
          destinationUrl: '/master-data/packing-materials?category=41-86',
          destinationLabel: 'Packing Materials → Glue',
          subCategoryName: 'Glue',
        };

      case '41-87': // Others
        return {
          categoryId: matCat.id,
          categoryCode: matCat.code,
          categoryName: matCat.name,
          targetEntity: 'PACKING_MATERIAL',
          codePrefix: 'PM',
          destinationUrl: '/master-data/packing-materials?category=41-87',
          destinationLabel: 'Packing Materials → Others',
          subCategoryName: 'Others',
        };

      default:
        // For custom user-created categories, inspect explicit categoryType
        if (matCat.categoryType === 'RAW_MATERIAL') {
          return {
            categoryId: matCat.id,
            categoryCode: matCat.code,
            categoryName: matCat.name,
            targetEntity: 'RAW_MATERIAL',
            codePrefix: 'RM',
            destinationUrl: `/master-data/raw-materials?category=${matCat.code}`,
            destinationLabel: `Raw Materials → ${matCat.name}`,
          };
        }
        return {
          categoryId: matCat.id,
          categoryCode: matCat.code,
          categoryName: matCat.name,
          targetEntity: 'PACKING_MATERIAL',
          codePrefix: 'PM',
          destinationUrl: `/master-data/packing-materials?category=${matCat.code}`,
          destinationLabel: `Packing Materials → ${matCat.name}`,
        };
    }
  }

  /**
   * Retrieves unified dynamic categories from the database
   */
  async getUnifiedCategories(organizationId: string): Promise<UnifiedCategoryItem[]> {
    const [productCats, materialCats] = await Promise.all([
      this.prisma.productCategory.findMany({
        where: { organizationId, status: 'ACTIVE' },
        orderBy: { code: 'asc' },
      }),
      this.prisma.materialCategory.findMany({
        where: { organizationId, status: 'ACTIVE' },
        orderBy: { code: 'asc' },
      }),
    ]);

    const result: UnifiedCategoryItem[] = [];

    // Finished Goods categories
    for (const pc of productCats) {
      result.push({
        id: pc.id,
        code: pc.code,
        name: pc.name,
        entityType: 'FINISHED_PRODUCT',
        badge: 'Finished Goods',
        description: pc.description,
      });
    }

    // Material categories with explicit badges
    for (const mc of materialCats) {
      let entityType: TargetEntityType = 'PACKING_MATERIAL';
      let badge = 'Packing Material';

      if (mc.code === '41-51' || mc.categoryType === 'RAW_MATERIAL') {
        entityType = 'RAW_MATERIAL';
        badge = 'Raw Material';
      } else if (mc.code === '41-31') {
        entityType = 'RAW_MATERIAL';
        badge = 'Wastage';
      } else if (['41-82', '41-83', '41-84', '41-85', '41-86', '41-87'].includes(mc.code)) {
        badge = `Packing: ${mc.name}`;
      }

      result.push({
        id: mc.id,
        code: mc.code,
        name: mc.name,
        entityType,
        badge,
        description: mc.description,
      });
    }

    return result;
  }
}

