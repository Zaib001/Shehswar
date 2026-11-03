/**
 * SHEHSWAR ONE360 - Product Batch Number Management Service
 *
 * Implements:
 * 1. Finished Product -> Batch Number -> Manufacturing/Expiry Data
 * 2. Manual Batch Number entry and editing (no fake or auto-invented batches)
 * 3. Multiple batches per finished product with active batch switching
 * 4. Expiry validation (flags expired batches and prevents invoicing)
 * 5. Real database persistence and stock tracking against batches
 * 6. Batch uniqueness per finished product
 */
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { AuthUser } from '@shehswar/types';
import { v7 as uuidv7 } from 'uuid';

export interface CreateBatchDto {
  finishedProductId: string;
  batchNumber: string;
  manufacturingDate: string | Date;
  expiryDate?: string | Date | null;
  initialQuantity?: number;
  availableQuantity?: number;
  isActive?: boolean;
  notes?: string;
}

export interface UpdateBatchDto {
  batchNumber?: string;
  manufacturingDate?: string | Date;
  expiryDate?: string | Date | null;
  availableQuantity?: number;
  isActive?: boolean;
  status?: string;
  notes?: string;
}

@Injectable()
export class BatchesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Retrieve all batches for a specific finished product
   */
  async getBatchesForProduct(finishedProductId: string, companyId: string) {
    const product = await this.prisma.finishedProduct.findFirst({
      where: { id: finishedProductId, companyId },
      select: {
        id: true,
        productCode: true,
        productName: true,
        mType: true,
        packingQuantity: true,
        packingUnit: true,
        packSize: { select: { name: true } },
      },
    });

    if (!product) {
      throw new NotFoundException(`Finished product '${finishedProductId}' not found`);
    }

    const batches = await this.prisma.productBatch.findMany({
      where: { finishedProductId, companyId },
      orderBy: [{ isActive: 'desc' }, { manufacturingDate: 'desc' }, { createdAt: 'desc' }],
    });

    const now = new Date();

    return batches.map((b) => {
      const isExpired = b.expiryDate ? new Date(b.expiryDate) < now : false;
      return {
        ...b,
        isExpired,
        availableQuantity: Number(b.availableQuantity),
        initialQuantity: Number(b.initialQuantity),
        allocatedQuantity: Number(b.allocatedQuantity),
        finishedProduct: product,
      };
    });
  }

  /**
   * Retrieve single batch details
   */
  async getBatchById(id: string, companyId?: string) {
    const where: any = { id };
    if (companyId) where.companyId = companyId;

    const batch = await this.prisma.productBatch.findFirst({
      where,
      include: {
        finishedProduct: {
          select: {
            id: true,
            productCode: true,
            productName: true,
            mType: true,
            packingQuantity: true,
            packingUnit: true,
            packSize: { select: { name: true } },
          },
        },
      },
    });

    if (!batch) {
      throw new NotFoundException(`Batch '${id}' not found`);
    }

    const isExpired = batch.expiryDate ? new Date(batch.expiryDate) < new Date() : false;

    return {
      ...batch,
      isExpired,
      availableQuantity: Number(batch.availableQuantity),
      initialQuantity: Number(batch.initialQuantity),
      allocatedQuantity: Number(batch.allocatedQuantity),
    };
  }

  /**
   * Create a new Batch for a Finished Product (Requirement 2, 3, 4, 5, 6, 23)
   */
  async createBatch(dto: CreateBatchDto, actor: AuthUser) {
    if (!dto.finishedProductId) {
      throw new BadRequestException('Finished Product ID is required');
    }
    const cleanBatchNumber = (dto.batchNumber || '').trim().toUpperCase();
    if (!cleanBatchNumber) {
      throw new BadRequestException('Batch Number is required and cannot be empty');
    }
    if (!dto.manufacturingDate) {
      throw new BadRequestException('Manufacturing Date is required');
    }

    // Verify finished product exists in company
    const product = await this.prisma.finishedProduct.findFirst({
      where: { id: dto.finishedProductId, companyId: actor.companyId },
    });
    if (!product) {
      throw new NotFoundException('Finished Product not found in this company');
    }

    // Enforce uniqueness per product (Requirement 23)
    const existing = await this.prisma.productBatch.findFirst({
      where: {
        finishedProductId: dto.finishedProductId,
        batchNumber: cleanBatchNumber,
      },
    });
    if (existing) {
      throw new BadRequestException(
        `Batch '${cleanBatchNumber}' already exists for product ${product.productCode} - ${product.productName}`
      );
    }

    const shouldBeActive = dto.isActive !== false;

    // If marked active, set other batches of this product to inactive
    if (shouldBeActive) {
      await this.prisma.productBatch.updateMany({
        where: { finishedProductId: dto.finishedProductId, isActive: true },
        data: { isActive: false },
      });
    }

    const qty = Number(dto.availableQuantity ?? dto.initialQuantity ?? 0);

    const created = await this.prisma.productBatch.create({
      data: {
        id: uuidv7(),
        organizationId: actor.organizationId,
        companyId: actor.companyId,
        finishedProductId: dto.finishedProductId,
        batchNumber: cleanBatchNumber,
        manufacturingDate: new Date(dto.manufacturingDate),
        expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : null,
        initialQuantity: qty,
        availableQuantity: qty,
        allocatedQuantity: 0,
        isActive: shouldBeActive,
        status: 'RELEASED',
        notes: dto.notes ? dto.notes.trim() : null,
      },
      include: {
        finishedProduct: {
          select: {
            id: true,
            productCode: true,
            productName: true,
            mType: true,
          },
        },
      },
    });

    return {
      ...created,
      availableQuantity: Number(created.availableQuantity),
      initialQuantity: Number(created.initialQuantity),
    };
  }

  /**
   * Update an existing Batch (Requirement 2, 7, 23)
   * Product association is permanent and read-only.
   */
  async updateBatch(id: string, dto: UpdateBatchDto, actor: AuthUser) {
    const batch = await this.prisma.productBatch.findFirst({
      where: { id, companyId: actor.companyId },
      include: { finishedProduct: true },
    });
    if (!batch) {
      throw new NotFoundException(`Batch '${id}' not found`);
    }

    const data: any = {};

    if (dto.batchNumber !== undefined) {
      const cleanNumber = dto.batchNumber.trim().toUpperCase();
      if (!cleanNumber) {
        throw new BadRequestException('Batch number cannot be empty');
      }
      if (cleanNumber !== batch.batchNumber) {
        const duplicate = await this.prisma.productBatch.findFirst({
          where: {
            finishedProductId: batch.finishedProductId,
            batchNumber: cleanNumber,
            id: { not: id },
          },
        });
        if (duplicate) {
          throw new BadRequestException(`Batch '${cleanNumber}' already exists for this product`);
        }
        data.batchNumber = cleanNumber;
      }
    }

    if (dto.manufacturingDate !== undefined) {
      data.manufacturingDate = new Date(dto.manufacturingDate);
    }
    if (dto.expiryDate !== undefined) {
      data.expiryDate = dto.expiryDate ? new Date(dto.expiryDate) : null;
    }
    if (dto.availableQuantity !== undefined) {
      data.availableQuantity = Number(dto.availableQuantity);
    }
    if (dto.status !== undefined) {
      data.status = dto.status;
    }
    if (dto.notes !== undefined) {
      data.notes = dto.notes ? dto.notes.trim() : null;
    }

    if (dto.isActive !== undefined) {
      data.isActive = Boolean(dto.isActive);
      if (data.isActive) {
        // Deactivate all other batches for this product
        await this.prisma.productBatch.updateMany({
          where: { finishedProductId: batch.finishedProductId, id: { not: id }, isActive: true },
          data: { isActive: false },
        });
      }
    }

    const updated = await this.prisma.productBatch.update({
      where: { id },
      data,
      include: {
        finishedProduct: {
          select: {
            id: true,
            productCode: true,
            productName: true,
            mType: true,
          },
        },
      },
    });

    return {
      ...updated,
      availableQuantity: Number(updated.availableQuantity),
      initialQuantity: Number(updated.initialQuantity),
    };
  }

  /**
   * Switch the active batch for a finished product (Requirement 9)
   */
  async setActiveBatch(id: string, actor: AuthUser) {
    const batch = await this.prisma.productBatch.findFirst({
      where: { id, companyId: actor.companyId },
    });
    if (!batch) {
      throw new NotFoundException(`Batch '${id}' not found`);
    }

    // Set all other batches of this product to inactive
    await this.prisma.productBatch.updateMany({
      where: { finishedProductId: batch.finishedProductId, isActive: true },
      data: { isActive: false },
    });

    const updated = await this.prisma.productBatch.update({
      where: { id },
      data: { isActive: true },
    });

    return updated;
  }

  /**
   * Delete a batch
   */
  async deleteBatch(id: string, actor: AuthUser) {
    const batch = await this.prisma.productBatch.findFirst({
      where: { id, companyId: actor.companyId },
      include: {
        _count: {
          select: {
            salesInvoiceItems: true,
            salesOrderItems: true,
          },
        },
      },
    });

    if (!batch) {
      throw new NotFoundException(`Batch '${id}' not found`);
    }

    if (batch._count.salesInvoiceItems > 0 || batch._count.salesOrderItems > 0) {
      // Preserve historical invoices! (Requirement 18) Mark depleted instead of hard delete
      await this.prisma.productBatch.update({
        where: { id },
        data: { status: 'DEPLETED', isActive: false },
      });
      return { success: true, message: 'Batch has historical invoices; marked as DEPLETED' };
    }

    await this.prisma.productBatch.delete({ where: { id } });
    return { success: true, message: 'Batch deleted successfully' };
  }
}

