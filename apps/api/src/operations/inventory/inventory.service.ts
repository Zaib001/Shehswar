/**
 * SHEHSWAR ONE360 - Centralized Inventory Service
 *
 * THE ONLY place that modifies WarehouseStock and creates StockLedgerEntry.
 * All modules (Purchase, Sale, Return, Production, Intercompany) MUST call
 * this service — never write to warehouse_stocks directly from controllers.
 *
 * Stock rules:
 *  Purchase          → +quantity
 *  Purchase Return   → -quantity
 *  Sale              → -quantity
 *  Sales Return      → +quantity
 *  Production In     → +quantity (Finished Product)
 *  Production Out    → -quantity (Raw + Packing)
 *  Intercompany Out  → -quantity
 *  Intercompany In   → +quantity
 */
import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { Prisma } from '@shehswar/database';
import { StockMovementInput, StockBalance } from '@shehswar/types';

@Injectable()
export class InventoryService {
  private readonly logger = new Logger(InventoryService.name);

  /**
   * Apply a stock movement atomically within a transaction context.
   * Must be called inside a prisma.$transaction() block.
   *
   * @param tx  Prisma transaction client
   * @param input Stock movement parameters
   * @returns Updated stock balance
   */
  async applyMovement(
    tx: Prisma.TransactionClient,
    input: StockMovementInput,
  ): Promise<StockBalance> {
    const {
      organizationId,
      companyId,
      warehouseId,
      itemType,
      rawMaterialId,
      packingMaterialId,
      finishedProductId,
      quantityChange,
      unitCost,
      transactionType,
      referenceId,
      referenceNumber,
      notes,
    } = input;

    // 1. Find or create current stock record
    let stock = await tx.warehouseStock.findFirst({
      where: {
        warehouseId,
        itemType,
        rawMaterialId: rawMaterialId ?? null,
        packingMaterialId: packingMaterialId ?? null,
        finishedProductId: finishedProductId ?? null,
      },
    });

    let currentQty = stock ? Number(stock.quantityOnHand) : 0;
    let currentAvgCost = stock ? Number(stock.averageCost) : 0;

    // 2. Validate: prevent negative stock for outbound movements
    const isOutbound = quantityChange < 0;
    if (isOutbound && currentQty + quantityChange < 0) {
      throw new BadRequestException(
        `Insufficient stock. Available: ${currentQty}, Required: ${Math.abs(quantityChange)}`,
      );
    }

    // 3. Calculate new average cost (weighted average) for inbound movements
    let newAvgCost = currentAvgCost;
    if (quantityChange > 0 && unitCost !== undefined && unitCost > 0) {
      const totalValue = currentQty * currentAvgCost + quantityChange * unitCost;
      const newQty = currentQty + quantityChange;
      newAvgCost = newQty > 0 ? totalValue / newQty : unitCost;
    }

    const newQty = currentQty + quantityChange;

    // 4. Upsert WarehouseStock
    if (stock) {
      stock = await tx.warehouseStock.update({
        where: { id: stock.id },
        data: {
          quantityOnHand: newQty,
          averageCost: newAvgCost,
          lastUpdated: new Date(),
        },
      });
    } else {
      try {
        stock = await tx.warehouseStock.create({
          data: {
            organizationId,
            companyId,
            warehouseId,
            itemType,
            rawMaterialId: rawMaterialId ?? null,
            packingMaterialId: packingMaterialId ?? null,
            finishedProductId: finishedProductId ?? null,
            quantityOnHand: newQty,
            averageCost: newAvgCost,
            lastUpdated: new Date(),
          },
        });
      } catch (err: any) {
        if (err?.code === 'P2002') {
          // If a stock record already exists in this warehouse, find and increment its count
          const existingStock = await tx.warehouseStock.findFirst({
            where: {
              warehouseId,
              itemType,
              rawMaterialId: rawMaterialId ?? null,
              packingMaterialId: packingMaterialId ?? null,
              finishedProductId: finishedProductId ?? null,
            },
          });
          if (existingStock) {
            const reCalculatedQty = Number(existingStock.quantityOnHand) + quantityChange;
            stock = await tx.warehouseStock.update({
              where: { id: existingStock.id },
              data: {
                quantityOnHand: reCalculatedQty,
                averageCost: newAvgCost,
                lastUpdated: new Date(),
              },
            });
          } else {
            throw err;
          }
        } else {
          throw err;
        }
      }
    }

    // 5. Create immutable StockLedgerEntry
    await tx.stockLedgerEntry.create({
      data: {
        organizationId,
        companyId,
        warehouseId,
        transactionType,
        referenceId,
        referenceNumber,
        itemType,
        rawMaterialId: rawMaterialId ?? null,
        packingMaterialId: packingMaterialId ?? null,
        finishedProductId: finishedProductId ?? null,
        quantityChange,
        quantityAfter: newQty,
        unitCost: unitCost ?? null,
        notes: notes ?? null,
      },
    });

    this.logger.log(
      `Stock movement: ${transactionType} | ${itemType} | qty=${quantityChange} | newQty=${newQty} | ref=${referenceNumber}`,
    );

    return {
      warehouseId,
      itemType,
      rawMaterialId,
      packingMaterialId,
      finishedProductId,
      quantityOnHand: newQty,
      averageCost: newAvgCost,
      lastUpdated: new Date(),
    };
  }

  /**
   * Check available stock without modifying it.
   */
  async getStock(
    tx: Prisma.TransactionClient,
    params: {
      warehouseId: string;
      itemType: string;
      rawMaterialId?: string;
      packingMaterialId?: string;
      finishedProductId?: string;
    },
  ): Promise<{ quantityOnHand: number; averageCost: number }> {
    const stock = await tx.warehouseStock.findFirst({
      where: {
        warehouseId: params.warehouseId,
        itemType: params.itemType,
        rawMaterialId: params.rawMaterialId ?? null,
        packingMaterialId: params.packingMaterialId ?? null,
        finishedProductId: params.finishedProductId ?? null,
      },
    });

    return {
      quantityOnHand: stock ? Number(stock.quantityOnHand) : 0,
      averageCost: stock ? Number(stock.averageCost) : 0,
    };
  }

  /**
   * Get all stock balances for a warehouse (non-transactional, for display).
   */
  async getWarehouseStock(prisma: any, warehouseId: string) {
    return prisma.warehouseStock.findMany({
      where: {
        warehouseId,
        quantityOnHand: { gt: 0 },
      },
      include: {
        warehouse: { select: { id: true, name: true, code: true } },
        rawMaterial: { select: { id: true, materialCode: true, materialName: true } },
        packingMaterial: { select: { id: true, materialCode: true, materialName: true } },
        finishedProduct: { select: { id: true, productCode: true, productName: true } },
      },
      orderBy: { lastUpdated: 'desc' },
    });
  }
}
