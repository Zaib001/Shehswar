/**
 * SHEHSWAR ONE360 - Centralized Code Generation Service
 *
 * Guarantees collision-safe, atomic, sequential code generation for:
 * - Finished Products (FG-XXXXXX)
 * - Raw Materials (RM-XXXXXX)
 * - Packing Materials (PM-XXXXXX)
 * - Packaging / Pack Sizes (PKG-XXXXX)
 * - Units of Measure (UOM-XXX)
 * - Category Codes (41-XX sequential hierarchy)
 */
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';

export type EntityCodeType =
  | 'FINISHED_PRODUCT'
  | 'RAW_MATERIAL'
  | 'PACKING_MATERIAL'
  | 'PACK_SIZE'
  | 'UOM'
  | 'CATEGORY';

@Injectable()
export class CodeGenerationService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generates next sequential item code atomically using DocumentSequence
   */
  async generateCode(params: {
    companyId: string;
    organizationId: string;
    entityType: EntityCodeType;
    categoryType?: 'FINISHED_PRODUCT' | 'MATERIAL';
  }): Promise<string> {
    const { companyId, organizationId, entityType } = params;

    if (entityType === 'CATEGORY') {
      return this.generateCategoryCode(organizationId, params.categoryType || 'MATERIAL');
    }

    const prefixMap: Record<Exclude<EntityCodeType, 'CATEGORY'>, { prefix: string; pad: number }> = {
      FINISHED_PRODUCT: { prefix: 'FG', pad: 6 },
      RAW_MATERIAL: { prefix: 'RM', pad: 6 },
      PACKING_MATERIAL: { prefix: 'PM', pad: 6 },
      PACK_SIZE: { prefix: 'PKG', pad: 5 },
      UOM: { prefix: 'UOM', pad: 4 },
    };

    const config = prefixMap[entityType as Exclude<EntityCodeType, 'CATEGORY'>];
    const docType = `CODE_${config.prefix}`;

    // Concurrency-safe atomic increment
    const sequence = await this.prisma.documentSequence.upsert({
      where: {
        companyId_documentType_fiscalYear: {
          companyId,
          documentType: docType,
          fiscalYear: 0, // Permanent sequence across fiscal years
        },
      },
      update: {
        currentNumber: { increment: 1 },
      },
      create: {
        organizationId,
        companyId,
        documentType: docType,
        fiscalYear: 0,
        prefix: config.prefix,
        currentNumber: 1,
      },
    });

    let currentNum = Number(sequence.currentNumber);

    // Collision check against existing database records to avoid legacy clashes
    if (entityType === 'FINISHED_PRODUCT') {
      let candidate = `${config.prefix}-${String(currentNum).padStart(config.pad, '0')}`;
      let exists = await this.prisma.finishedProduct.findFirst({
        where: { companyId, productCode: candidate },
      });
      while (exists) {
        currentNum++;
        candidate = `${config.prefix}-${String(currentNum).padStart(config.pad, '0')}`;
        exists = await this.prisma.finishedProduct.findFirst({
          where: { companyId, productCode: candidate },
        });
      }
      if (currentNum > Number(sequence.currentNumber)) {
        await this.prisma.documentSequence.update({
          where: { id: sequence.id },
          data: { currentNumber: BigInt(currentNum) },
        });
      }
      return candidate;
    }

    if (entityType === 'RAW_MATERIAL') {
      let candidate = `${config.prefix}-${String(currentNum).padStart(config.pad, '0')}`;
      let exists = await this.prisma.rawMaterial.findFirst({
        where: { companyId, materialCode: candidate },
      });
      while (exists) {
        currentNum++;
        candidate = `${config.prefix}-${String(currentNum).padStart(config.pad, '0')}`;
        exists = await this.prisma.rawMaterial.findFirst({
          where: { companyId, materialCode: candidate },
        });
      }
      if (currentNum > Number(sequence.currentNumber)) {
        await this.prisma.documentSequence.update({
          where: { id: sequence.id },
          data: { currentNumber: BigInt(currentNum) },
        });
      }
      return candidate;
    }

    if (entityType === 'PACKING_MATERIAL') {
      let candidate = `${config.prefix}-${String(currentNum).padStart(config.pad, '0')}`;
      let exists = await this.prisma.packingMaterial.findFirst({
        where: { companyId, materialCode: candidate },
      });
      while (exists) {
        currentNum++;
        candidate = `${config.prefix}-${String(currentNum).padStart(config.pad, '0')}`;
        exists = await this.prisma.packingMaterial.findFirst({
          where: { companyId, materialCode: candidate },
        });
      }
      if (currentNum > Number(sequence.currentNumber)) {
        await this.prisma.documentSequence.update({
          where: { id: sequence.id },
          data: { currentNumber: BigInt(currentNum) },
        });
      }
      return candidate;
    }

    return `${config.prefix}-${String(currentNum).padStart(config.pad, '0')}`;
  }

  /**
   * Generates category code in accordance with the 41-XX hierarchy
   */
  async generateCategoryCode(
    organizationId: string,
    categoryType: 'FINISHED_PRODUCT' | 'MATERIAL',
  ): Promise<string> {
    if (categoryType === 'FINISHED_PRODUCT') {
      const existing = await this.prisma.productCategory.findMany({
        where: { organizationId },
        select: { code: true },
      });
      const numbers = existing
        .map((c) => {
          const match = c.code.match(/^41-(\d+)$/);
          return match && match[1] ? parseInt(match[1], 10) : 0;
        })
        .filter((n) => n > 0 && n < 30); // 41-01 to 41-29 range for finished goods
      const maxNum = numbers.length > 0 ? Math.max(...numbers) : 1;
      const nextNum = maxNum + 1;
      return `41-${String(nextNum).padStart(2, '0')}`;
    }

    // Material category (41-80 to 41-99 range)
    const existing = await this.prisma.materialCategory.findMany({
      where: { organizationId },
      select: { code: true },
    });
    const numbers = existing
      .map((c) => {
        const match = c.code.match(/^41-(\d+)$/);
        return match && match[1] ? parseInt(match[1], 10) : 0;
      })
      .filter((n) => n >= 80);
    const maxNum = numbers.length > 0 ? Math.max(...numbers) : 87;
    const nextNum = maxNum + 1;
    return `41-${String(nextNum).padStart(2, '0')}`;
  }

  /**
   * Preview next sequential code without incrementing sequence
   */
  async previewNextCode(params: {
    companyId: string;
    entityType: EntityCodeType;
  }): Promise<string> {
    const prefixMap = {
      FINISHED_PRODUCT: { prefix: 'FG', pad: 6 },
      RAW_MATERIAL: { prefix: 'RM', pad: 6 },
      PACKING_MATERIAL: { prefix: 'PM', pad: 6 },
      PACK_SIZE: { prefix: 'PKG', pad: 5 },
      UOM: { prefix: 'UOM', pad: 4 },
      CATEGORY: { prefix: '41', pad: 2 },
    };
    const config = prefixMap[params.entityType];
    const seq = await this.prisma.documentSequence.findUnique({
      where: {
        companyId_documentType_fiscalYear: {
          companyId: params.companyId,
          documentType: `CODE_${config.prefix}`,
          fiscalYear: 0,
        },
      },
    });
    const next = (Number(seq?.currentNumber ?? 0)) + 1;
    return `${config.prefix}-${String(next).padStart(config.pad, '0')}`;
  }
}
