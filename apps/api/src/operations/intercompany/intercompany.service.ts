/**
 * SHEHSWAR ONE360 - Intercompany Transfer Service
 *
 * Implements the client's canonical Parent -> Child Company Flow:
 * - Parent Company (Shehswar): Manufacturing company holding actual finished product stock and product cost.
 * - Sells finished goods to dynamic child companies (ConsceptAG, Nectar, AgriventurePakistan, Excelium SEEd, etc.).
 * - Sets intercompany profit/markup percentage (e.g. 10%, 15%, 20% or custom, not hardcoded).
 * - Multi-product transfer with independent product-level calculations:
 *     Selling Rate = Cost + (Cost * Markup%)
 *     Total Sales = Qty * Selling Rate
 *     Total Cost = Qty * Cost
 *     Profit = Total Sales - Total Cost
 * - Atomic transaction:
 *     1. Parent: Sales Invoice + Warehouse Stock OUT (-)
 *     2. Child: Purchase Invoice + Warehouse Stock IN (+)
 * - Strictly validates that Shehswar has sufficient stock before allowing transfer.
 * - Child references the SAME FinishedProduct record (no duplicate product masters).
 */
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { TransactionService } from '../../common/services/transaction.service';
import { InventoryService } from '../inventory/inventory.service';
import { DocumentNumberingService } from '../../platform/document-numbering/document-numbering.service';
import { uuidv7 } from '@shehswar/shared';
import { AuthUser } from '@shehswar/types';

export interface IntercompanyTransferItemDto {
  finishedProductId: string;
  batchNumber?: string;
  quantity: number;
  unitCost?: number;
  markupPercent?: number;
  sellingPrice?: number;
}

export interface IntercompanyTransferDto {
  parentCompanyId: string;
  childCompanyId: string;
  parentWarehouseId: string;
  childWarehouseId: string;
  defaultMarkupPercent?: number;
  items?: IntercompanyTransferItemDto[];
  notes?: string;
  status?: 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'POSTED' | 'CANCELLED';

  // Backward compatibility fields for single-item calls:
  finishedProductId?: string;
  quantity?: number;
  transferCost?: number;
  sellingPrice?: number;
  batchNumber?: string;
  markupPercent?: number;
}

@Injectable()
export class IntercompanyService {
  private readonly logger = new Logger(IntercompanyService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly transactionService: TransactionService,
    private readonly inventoryService: InventoryService,
    private readonly documentNumbering: DocumentNumberingService,
  ) {}

  /**
   * Get available Finished Product stock for the selected source warehouse
   */
  async getSourceStock(warehouseId: string) {
    if (!warehouseId) return [];

    const stocks = await this.prisma.warehouseStock.findMany({
      where: {
        warehouseId,
        itemType: 'FINISHED_PRODUCT',
        quantityOnHand: { gt: 0 },
      },
      include: {
        finishedProduct: {
          include: {
            packSize: true,
            baseUom: true,
            batches: {
              where: { isActive: true },
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
          },
        },
      },
      orderBy: { quantityOnHand: 'desc' },
    });

    return stocks
      .filter((s) => s.finishedProduct)
      .map((s) => {
        const p = s.finishedProduct!;
        const activeBatch = p.batches?.[0];
        const packDesc =
          p.packSize?.name ||
          (p.packingQuantity ? `${p.packingQuantity} ${p.packingUnit || ''}`.trim() : '');
        const cost = Number(p.standardCost || s.averageCost || 0);

        return {
          id: p.id,
          finishedProductId: p.id,
          productCode: p.productCode,
          productName: p.productName,
          packSize: packDesc || '-',
          uom: p.baseUom?.code || p.packingUnit || 'Units',
          availableStock: Number(s.quantityOnHand),
          unitCost: cost,
          batchNumber: activeBatch?.batchNumber || 'STD-BATCH',
          mfgDate: activeBatch?.manufacturingDate,
          expiryDate: activeBatch?.expiryDate,
        };
      });
  }

  /**
   * Execute Parent Sale & Child Purchase simultaneously in one atomic transaction
   * Supports multi-product items with custom markup % and stock validation
   */
  async executeTransfer(dto: IntercompanyTransferDto, actor: AuthUser) {
    const {
      parentCompanyId,
      childCompanyId,
      parentWarehouseId,
      childWarehouseId,
      defaultMarkupPercent,
      notes,
    } = dto;

    if (!parentCompanyId || !childCompanyId) {
      throw new BadRequestException('Parent and Child company IDs are required');
    }
    if (parentCompanyId === childCompanyId) {
      throw new BadRequestException('Parent and Child company cannot be the same');
    }
    if (!parentWarehouseId || !childWarehouseId) {
      throw new BadRequestException('Source and Destination warehouse IDs are required');
    }

    const transferStatus = dto.status || 'POSTED';
    const isPosted = transferStatus === 'POSTED';

    // Normalize items array (support multi-line and legacy single-product)
    const rawItems: IntercompanyTransferItemDto[] =
      dto.items && dto.items.length > 0
        ? dto.items
        : dto.finishedProductId && dto.quantity
        ? [
            {
              finishedProductId: dto.finishedProductId,
              batchNumber: dto.batchNumber,
              quantity: dto.quantity,
              unitCost: dto.transferCost,
              markupPercent: dto.markupPercent,
              sellingPrice: dto.sellingPrice,
            },
          ]
        : [];

    if (rawItems.length === 0) {
      throw new BadRequestException('At least one product item is required for transfer');
    }

    // 1. Validate Parent and Child Companies & Warehouses
    const [parentCompany, childCompany, parentWarehouse, childWarehouse] = await Promise.all([
      this.prisma.company.findUnique({ where: { id: parentCompanyId } }),
      this.prisma.company.findUnique({ where: { id: childCompanyId } }),
      this.prisma.warehouse.findUnique({ where: { id: parentWarehouseId } }),
      this.prisma.warehouse.findUnique({ where: { id: childWarehouseId } }),
    ]);

    if (!parentCompany) throw new NotFoundException('Parent company not found');
    if (!childCompany) throw new NotFoundException('Child company not found');
    if (!parentWarehouse) throw new NotFoundException('Parent source warehouse not found');
    if (!childWarehouse) throw new NotFoundException('Child destination warehouse not found');

    if (parentWarehouse.companyId !== parentCompanyId) {
      throw new BadRequestException(`Source warehouse does not belong to parent company (${parentCompany.name})`);
    }
    if (childWarehouse.companyId !== childCompanyId) {
      throw new BadRequestException(`Destination warehouse does not belong to child company (${childCompany.name})`);
    }

    // 2. Fetch products and validate source warehouse stock
    const productIds = rawItems.map((i) => i.finishedProductId);
    const products = await this.prisma.finishedProduct.findMany({
      where: { id: { in: productIds } },
      include: {
        category: true,
        packSize: true,
        baseUom: true,
        salesUom: true,
        packagingMaterial: true,
      },
    });
    const productMap = new Map(products.map((p) => [p.id, p]));

    const sourceStocks = await this.prisma.warehouseStock.findMany({
      where: {
        warehouseId: parentWarehouseId,
        itemType: 'FINISHED_PRODUCT',
        finishedProductId: { in: productIds },
      },
    });
    const stockMap = new Map(sourceStocks.map((s) => [s.finishedProductId!, s]));

    const globalMarkup = defaultMarkupPercent !== undefined && defaultMarkupPercent !== null
      ? Number(defaultMarkupPercent)
      : 15;

    // Pre-validate aggregated stock requirement per product across all transfer items
    if (isPosted) {
      const aggregatedQtyByProduct = new Map<string, number>();
      for (const item of rawItems) {
        aggregatedQtyByProduct.set(
          item.finishedProductId,
          (aggregatedQtyByProduct.get(item.finishedProductId) || 0) + Number(item.quantity || 0),
        );
      }
      for (const [prodId, reqQty] of aggregatedQtyByProduct.entries()) {
        const prod = productMap.get(prodId);
        const stock = stockMap.get(prodId);
        const availableQty = stock ? Number(stock.quantityOnHand) : 0;
        if (availableQty < reqQty) {
          throw new BadRequestException(
            `Insufficient stock available in ${parentCompany.name} for ${prod?.productName || prodId}. Available: ${availableQty}, Total Requested: ${reqQty}`,
          );
        }
      }
    }

    // Process and calculate each line item
    const processedItems = rawItems.map((item, idx) => {
      const prod = productMap.get(item.finishedProductId);
      if (!prod) {
        throw new NotFoundException(`Product not found for line #${idx + 1}`);
      }
      if (!item.quantity || item.quantity <= 0) {
        throw new BadRequestException(`Quantity for product "${prod.productName}" must be greater than zero`);
      }

      const stock = stockMap.get(item.finishedProductId);

      // Unit Cost from item, or stock avg, or product standardCost
      const costRate =
        item.unitCost !== undefined && item.unitCost > 0
          ? Number(item.unitCost)
          : Number(stock?.averageCost || prod.standardCost || 0);

      // Markup %
      const markupPercent =
        item.markupPercent !== undefined && item.markupPercent !== null
          ? Number(item.markupPercent)
          : globalMarkup;

      // Selling Rate = Cost + (Cost * Markup%)
      const calculatedSellingRate = Math.round(costRate * (1 + markupPercent / 100) * 100) / 100;
      const sellingRate =
        item.sellingPrice !== undefined && item.sellingPrice > 0
          ? Number(item.sellingPrice)
          : calculatedSellingRate;

      const lineCost = Math.round(item.quantity * costRate * 100) / 100;
      const lineSales = Math.round(item.quantity * sellingRate * 100) / 100;
      const lineProfit = Math.round((lineSales - lineCost) * 100) / 100;

      const packDesc =
        prod.packSize?.name ||
        (prod.packingQuantity ? `${prod.packingQuantity} ${prod.packingUnit || ''}`.trim() : '');

      return {
        finishedProductId: prod.id,
        productCode: prod.productCode,
        productName: prod.productName,
        packSize: packDesc || '-',
        batchNumber: item.batchNumber || 'STD-BATCH',
        quantity: Number(item.quantity),
        unitCost: costRate,
        markupPercent,
        sellingPrice: sellingRate,
        totalCost: lineCost,
        totalSales: lineSales,
        profit: lineProfit,
      };
    });

    const totalBatchCost = Math.round(processedItems.reduce((acc, i) => acc + i.totalCost, 0) * 100) / 100;
    const totalBatchSales = Math.round(processedItems.reduce((acc, i) => acc + i.totalSales, 0) * 100) / 100;
    const totalBatchProfit = Math.round((totalBatchSales - totalBatchCost) * 100) / 100;
    const effectiveMarkup = totalBatchCost > 0
      ? Math.round(((totalBatchSales - totalBatchCost) / totalBatchCost) * 1000) / 10
      : 0;

    // 3. Find or create internal intercompany dealer (for Parent) & vendor (for Child)
    let childDealer = await this.prisma.dealer.findFirst({
      where: { companyId: parentCompanyId, name: childCompany.name },
    });
    if (!childDealer) {
      childDealer = await this.prisma.dealer.create({
        data: {
          id: uuidv7(),
          organizationId: parentCompany.organizationId,
          companyId: parentCompanyId,
          code: `IC-D-${childCompany.code}`,
          name: childCompany.name,
          city: 'Intercompany',
          contactPerson: 'Internal Transfer',
          phone: '0000-0000000',
        },
      });
    }

    let parentVendor = await this.prisma.vendor.findFirst({
      where: { companyId: childCompanyId, name: parentCompany.name },
    });
    if (!parentVendor) {
      parentVendor = await this.prisma.vendor.create({
        data: {
          id: uuidv7(),
          organizationId: childCompany.organizationId,
          companyId: childCompanyId,
          code: `IC-V-${parentCompany.code}`,
          name: parentCompany.name,
          contactPerson: 'Internal Transfer',
          phone: '0000-0000000',
        },
      });
    }

    const transferTxId = `IC-TX-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

    // Generate Document Numbers
    const [parentInvoiceNo, childVoucherNo] = await Promise.all([
      this.documentNumbering.getNextDocumentNumber({
        organizationId: parentCompany.organizationId,
        companyId: parentCompanyId,
        documentType: 'SALES_INVOICE',
      }),
      this.documentNumbering.getNextDocumentNumber({
        organizationId: childCompany.organizationId,
        companyId: childCompanyId,
        documentType: 'PURCHASE',
      }),
    ]);

    // Structured metadata for permanent history & reporting
    const metadataPayload = {
      txId: transferTxId,
      transferType: 'Inter Company Sale',
      parentCompany: { id: parentCompany.id, name: parentCompany.name, code: parentCompany.code },
      childCompany: { id: childCompany.id, name: childCompany.name, code: childCompany.code },
      parentWarehouse: { id: parentWarehouse.id, name: parentWarehouse.name },
      childWarehouse: { id: childWarehouse.id, name: childWarehouse.name },
      totalCost: totalBatchCost,
      totalSales: totalBatchSales,
      totalProfit: totalBatchProfit,
      markupPercent: effectiveMarkup,
      items: processedItems,
    };
    const structuredNotes = `[INTERCOMPANY_TRANSFER] ${JSON.stringify(metadataPayload)} | ${notes || 'Standard dispatch'}`;

    // 4. ATOMIC TRANSACTION
    return this.transactionService.runInTransaction(async (tx) => {
      // ── Step 0: Resolve or Create Child Company Finished Products ────
      const childProductMap = new Map<string, any>();

      for (const item of processedItems) {
        if (childProductMap.has(item.finishedProductId)) {
          continue;
        }

        const parentProd = productMap.get(item.finishedProductId)!;

        // REQUIREMENT 2, 7 & 8: Check whether this product already exists in the destination child company
        // Check by productCode (case-insensitive) first, then by productName (case-insensitive)
        let childProd = await tx.finishedProduct.findFirst({
          where: {
            companyId: childCompanyId,
            productCode: { equals: parentProd.productCode, mode: 'insensitive' },
          },
        });

        if (!childProd) {
          childProd = await tx.finishedProduct.findFirst({
            where: {
              companyId: childCompanyId,
              productName: { equals: parentProd.productName, mode: 'insensitive' },
            },
          });
        }

        if (childProd) {
          // REQUIREMENT 2 & 8: Product exists in destination company - DO NOT duplicate!
          // Un-delete if soft-deleted, ensure ACTIVE, and update latest standardCost / transfer rate
          childProd = await tx.finishedProduct.update({
            where: { id: childProd.id },
            data: {
              standardCost: item.sellingPrice,
              defaultSellingPrice: childProd.defaultSellingPrice || item.sellingPrice,
              status: 'ACTIVE',
              approvalStatus: 'APPROVED',
              deletedAt: null,
              customFields: {
                ...(typeof childProd.customFields === 'object' && childProd.customFields
                  ? (childProd.customFields as any)
                  : {}),
                lastTransferRate: item.sellingPrice,
                lastOriginalCost: item.unitCost,
                lastMarkupPercent: item.markupPercent,
                batchNumber: item.batchNumber,
                lastTransferredAt: new Date().toISOString(),
              },
            },
          });
          this.logger.log(
            `Reused existing child FinishedProduct for ${childCompany.name}: ${childProd.productName} (${childProd.productCode})`,
          );
        } else {
          // REQUIREMENT 2 & 8: Product does not exist - automatically create complete child FinishedProduct record
          let childPackagingMaterialId = parentProd.packagingMaterialId;
          if (parentProd.packagingMaterialId) {
            const parentPm = await tx.packingMaterial.findUnique({
              where: { id: parentProd.packagingMaterialId },
            });
            if (parentPm) {
              const childPm = await tx.packingMaterial.findFirst({
                where: {
                  companyId: childCompanyId,
                  materialCode: { equals: parentPm.materialCode, mode: 'insensitive' },
                  deletedAt: null,
                },
              });
              if (childPm) {
                childPackagingMaterialId = childPm.id;
              }
            }
          }

          childProd = await tx.finishedProduct.create({
            data: {
              id: uuidv7(),
              organizationId: childCompany.organizationId,
              companyId: childCompanyId,
              categoryId: parentProd.categoryId,
              packSizeId: parentProd.packSizeId,
              baseUomId: parentProd.baseUomId,
              salesUomId: parentProd.salesUomId,
              productCode: parentProd.productCode,
              sku: parentProd.sku,
              productName: parentProd.productName,
              urduName: parentProd.urduName,
              brand: parentProd.brand,
              grade: parentProd.grade,
              productType: parentProd.productType || 'FINISHED_PRODUCT',
              mType: parentProd.mType,
              fertilizerType: parentProd.fertilizerType,
              productForm: parentProd.productForm,
              packagingMaterialId: childPackagingMaterialId,
              packingQuantity: parentProd.packingQuantity,
              packingUnit: parentProd.packingUnit,
              ppc: parentProd.ppc,
              bagWeight: parentProd.bagWeight,
              barcode: parentProd.barcode,
              batchControlled: parentProd.batchControlled ?? true,
              expiryControlled: parentProd.expiryControlled ?? false,
              shelfLifeDays: parentProd.shelfLifeDays,
              minimumStock: parentProd.minimumStock,
              reorderLevel: parentProd.reorderLevel,
              standardCost: item.sellingPrice, // Intercompany purchase cost
              defaultSellingPrice: parentProd.defaultSellingPrice || item.sellingPrice,
              status: 'ACTIVE',
              approvalStatus: 'APPROVED',
              customFields: {
                sourceCompanyId: parentCompanyId,
                sourceCompanyName: parentCompany.name,
                sourceProductId: parentProd.id,
                intercompanyTransferRate: item.sellingPrice,
                originalManufacturingCost: item.unitCost,
                markupPercent: item.markupPercent,
                batchNumber: item.batchNumber,
                transferredAt: new Date().toISOString(),
              },
            },
          });
          this.logger.log(
            `Created child FinishedProduct for ${childCompany.name}: ${childProd.productName} (${childProd.productCode})`,
          );
        }

        // Migrate any previous legacy child stock in this warehouse that referenced parent product ID
        const legacyStocks = await tx.warehouseStock.findMany({
          where: {
            warehouseId: childWarehouseId,
            itemType: 'FINISHED_PRODUCT',
            finishedProductId: parentProd.id,
          },
        });
        for (const legacyStock of legacyStocks) {
          const existingChildStock = await tx.warehouseStock.findFirst({
            where: {
              warehouseId: childWarehouseId,
              itemType: 'FINISHED_PRODUCT',
              finishedProductId: childProd.id,
            },
          });
          if (existingChildStock && existingChildStock.id !== legacyStock.id) {
            await tx.warehouseStock.update({
              where: { id: existingChildStock.id },
              data: {
                quantityOnHand:
                  Number(existingChildStock.quantityOnHand) + Number(legacyStock.quantityOnHand),
              },
            });
            await tx.warehouseStock.delete({ where: { id: legacyStock.id } });
          } else {
            await tx.warehouseStock.update({
              where: { id: legacyStock.id },
              data: {
                finishedProductId: childProd.id,
              },
            });
          }
        }

        childProductMap.set(item.finishedProductId, childProd);
      }

      // ── A. PARENT COMPANY: Sales Invoice & Stock OUT ─────────────────
      const parentInvoice = await tx.salesInvoice.create({
        data: {
          id: uuidv7(),
          organizationId: parentCompany.organizationId,
          companyId: parentCompanyId,
          invoiceNumber: parentInvoiceNo,
          invoiceDate: new Date(),
          dealerId: childDealer.id,
          warehouseId: parentWarehouseId,
          grossAmount: totalBatchSales,
          taxAmount: 0,
          discountAmount: 0,
          netAmount: totalBatchSales,
          postingStatus: transferStatus,
          postedAt: isPosted ? new Date() : null,
          notes: structuredNotes,
          items: {
            create: processedItems.map((item) => ({
              id: uuidv7(),
              finishedProductId: item.finishedProductId,
              productName: item.productName,
              packing: item.packSize,
              batchNumber: item.batchNumber,
              quantity: item.quantity,
              rate: item.sellingPrice,
              grossAmount: item.totalSales,
              netAmount: item.totalSales,
            })),
          },
        },
      });

      // Decrement Parent Stock for each product if POSTED
      if (isPosted) {
        for (const item of processedItems) {
          await this.inventoryService.applyMovement(tx, {
            organizationId: parentCompany.organizationId,
            companyId: parentCompanyId,
            warehouseId: parentWarehouseId,
            itemType: 'FINISHED_PRODUCT',
            finishedProductId: item.finishedProductId,
            quantityChange: -item.quantity,
            unitCost: item.unitCost,
            transactionType: 'SALE',
            referenceId: parentInvoice.id,
            referenceNumber: parentInvoiceNo,
            notes: `Intercompany dispatch to ${childCompany.name} (Dest WH: ${childWarehouse.name}, Batch: ${item.batchNumber}, Rate: PKR ${item.sellingPrice})`,
          });

          // If batch exists in parent, decrement available quantity
          if (item.batchNumber && item.batchNumber !== 'STD-BATCH') {
            const pb = await tx.productBatch.findFirst({
              where: { finishedProductId: item.finishedProductId, batchNumber: item.batchNumber },
            });
            if (pb) {
              const currentAvail = Number(pb.availableQuantity);
              await tx.productBatch.update({
                where: { id: pb.id },
                data: {
                  availableQuantity: Math.max(0, currentAvail - item.quantity),
                },
              });
            }
          }
        }
      }

      // ── B. CHILD COMPANY: Purchase Invoice & Stock IN ────────────────
      const childPurchase = await tx.purchaseInvoice.create({
        data: {
          id: uuidv7(),
          organizationId: childCompany.organizationId,
          companyId: childCompanyId,
          voucherNumber: childVoucherNo,
          date: new Date(),
          receivedOn: new Date(),
          reference: transferTxId,
          vendorInvoiceNo: parentInvoiceNo,
          postingStatus: transferStatus,
          isComplete: isPosted,
          vendorId: parentVendor.id,
          warehouseId: childWarehouseId,
          grossAmount: totalBatchSales,
          taxAmount: 0,
          discountAmount: 0,
          netAmount: totalBatchSales,
          notes: structuredNotes,
          postedAt: isPosted ? new Date() : null,
          postedById: actor.id,
          items: {
            create: processedItems.map((item) => {
              const childProd = childProductMap.get(item.finishedProductId)!;
              return {
                id: uuidv7(),
                materialType: 'FINISHED_PRODUCT',
                finishedProductId: childProd.id, // Linked to Child's FinishedProduct!
                itemName: childProd.productName,
                packing: item.packSize
                  ? `${item.packSize}${item.batchNumber ? ' | Batch: ' + item.batchNumber : ''}`
                  : item.batchNumber
                  ? `Batch: ${item.batchNumber}`
                  : undefined,
                quantity: item.quantity,
                rate: item.sellingPrice,
                grossAmount: item.totalSales,
                netAmount: item.totalSales,
              };
            }),
          },
        },
      });

      // Increment Child Stock for each product if POSTED
      if (isPosted) {
        for (const item of processedItems) {
          const childProd = childProductMap.get(item.finishedProductId)!;

          // Fetch parent batch info (mfgDate, expiryDate) to preserve
          let sourceBatch: any = null;
          if (item.batchNumber) {
            sourceBatch = await tx.productBatch.findFirst({
              where: { finishedProductId: item.finishedProductId, batchNumber: item.batchNumber },
            });
          }
          if (!sourceBatch) {
            sourceBatch = await tx.productBatch.findFirst({
              where: { finishedProductId: item.finishedProductId, isActive: true },
              orderBy: { createdAt: 'desc' },
            });
          }

          // Add physical stock to destination child warehouse
          await this.inventoryService.applyMovement(tx, {
            organizationId: childCompany.organizationId,
            companyId: childCompanyId,
            warehouseId: childWarehouseId,
            itemType: 'FINISHED_PRODUCT',
            finishedProductId: childProd.id, // <-- Child company's FP ID!
            quantityChange: item.quantity,
            unitCost: item.sellingPrice, // Intercompany transfer purchase cost
            transactionType: 'PURCHASE',
            referenceId: childPurchase.id,
            referenceNumber: childVoucherNo,
            notes: `Intercompany stock receipt from ${parentCompany.name} (Source WH: ${parentWarehouse.name}, Batch: ${item.batchNumber}, Rate: PKR ${item.sellingPrice})`,
          });

          // REQUIREMENT 4: Batch handling in Child Company - preserve batch information
          const effectiveBatchNumber = item.batchNumber || sourceBatch?.batchNumber || 'STD-BATCH';
          const childBatch = await tx.productBatch.findFirst({
            where: {
              finishedProductId: childProd.id,
              batchNumber: effectiveBatchNumber,
            },
          });

          if (childBatch) {
            await tx.productBatch.update({
              where: { id: childBatch.id },
              data: {
                availableQuantity: Number(childBatch.availableQuantity) + item.quantity,
                initialQuantity: Number(childBatch.initialQuantity) + item.quantity,
                isActive: true,
                status: 'RELEASED',
              },
            });
          } else {
            await tx.productBatch.create({
              data: {
                id: uuidv7(),
                organizationId: childCompany.organizationId,
                companyId: childCompanyId,
                finishedProductId: childProd.id,
                batchNumber: effectiveBatchNumber,
                manufacturingDate: sourceBatch?.manufacturingDate || new Date(),
                expiryDate: sourceBatch?.expiryDate || null,
                initialQuantity: item.quantity,
                availableQuantity: item.quantity,
                allocatedQuantity: 0,
                isActive: true,
                status: 'RELEASED',
                notes: `Transferred from ${parentCompany.name} (Source WH: ${parentWarehouse.name}, Source Batch: ${effectiveBatchNumber})`,
              },
            });
          }

          // Update child product customFields.batchNumber for direct display fallback
          await tx.finishedProduct.update({
            where: { id: childProd.id },
            data: {
              customFields: {
                ...(typeof childProd.customFields === 'object' && childProd.customFields
                  ? (childProd.customFields as any)
                  : {}),
                batchNumber: effectiveBatchNumber,
                lastTransferRate: item.sellingPrice,
              },
            },
          });
        }

        // REQUIREMENT 9: Audit record created atomically within transaction
        await tx.auditLog.create({
          data: {
            id: uuidv7(),
            organizationId: parentCompany.organizationId,
            companyId: parentCompanyId,
            actorId: actor?.id || parentCompanyId,
            actorEmail: actor?.email || 'system@shehswar.com',
            resource: 'INTERCOMPANY_TRANSFER',
            resourceId: transferTxId,
            action: 'POST_INTERCOMPANY_TRANSFER',
            correlationId: transferTxId,
            metadata: {
              transferTxId,
              parentCompany: { id: parentCompany.id, name: parentCompany.name, code: parentCompany.code },
              childCompany: { id: childCompany.id, name: childCompany.name, code: childCompany.code },
              parentWarehouse: { id: parentWarehouse.id, name: parentWarehouse.name },
              childWarehouse: { id: childWarehouse.id, name: childWarehouse.name },
              parentInvoiceNo,
              childVoucherNo,
              totalCost: totalBatchCost,
              totalSales: totalBatchSales,
              totalProfit: totalBatchProfit,
              itemsCount: processedItems.length,
              items: processedItems.map((i) => ({
                productCode: i.productCode,
                productName: i.productName,
                quantity: i.quantity,
                unitCost: i.unitCost,
                sellingPrice: i.sellingPrice,
                batchNumber: i.batchNumber,
                childProductId: childProductMap.get(i.finishedProductId)?.id,
              })),
            },
          },
        });
      }

      this.logger.log(
        `Intercompany Transfer Successful: ${transferTxId} | Parent Sale: ${parentInvoiceNo} | Child Purchase: ${childVoucherNo} | Cost: PKR ${totalBatchCost} | Sales: PKR ${totalBatchSales} | Profit: PKR ${totalBatchProfit}`,
      );

      return {
        transactionId: transferTxId,
        parentSale: {
          id: parentInvoice.id,
          invoiceNumber: parentInvoiceNo,
          company: parentCompany.name,
          warehouse: parentWarehouse.name,
        },
        childPurchase: {
          id: childPurchase.id,
          voucherNumber: childVoucherNo,
          company: childCompany.name,
          warehouse: childWarehouse.name,
        },
        totalCost: totalBatchCost,
        totalSales: totalBatchSales,
        totalProfit: totalBatchProfit,
        effectiveMarkupPercent: effectiveMarkup,
        items: processedItems.map((item) => ({
          ...item,
          childProductId: childProductMap.get(item.finishedProductId)?.id,
        })),
      };
    });
  }

  /**
   * Shehswar Profit Reporting
   * Returns: Product | Qty | Cost | Selling Rate | Sales | Profit + Totals
   */
  async getProfitReport(params: { companyId?: string; startDate?: string; endDate?: string }) {
    const { companyId, startDate, endDate } = params;

    const where: any = {
      notes: { contains: 'INTERCOMPANY', mode: 'insensitive' },
    };
    if (companyId) {
      where.companyId = companyId;
    }
    if (startDate || endDate) {
      where.invoiceDate = {};
      if (startDate) where.invoiceDate.gte = new Date(startDate);
      if (endDate) where.invoiceDate.lte = new Date(endDate);
    }

    const sales = await this.prisma.salesInvoice.findMany({
      where,
      include: {
        company: { select: { name: true, code: true } },
        dealer: { select: { name: true } },
        warehouse: { select: { name: true } },
        items: {
          include: {
            finishedProduct: {
              select: {
                id: true,
                productCode: true,
                productName: true,
                standardCost: true,
                packSize: { select: { name: true } },
              },
            },
          },
        },
      },
      orderBy: { invoiceDate: 'desc' },
      take: 100,
    });

    const detailedRows: any[] = [];
    const productAggregation = new Map<string, any>();

    let grandTotalCost = 0;
    let grandTotalSales = 0;
    let grandTotalProfit = 0;
    let grandTotalQty = 0;

    for (const inv of sales) {
      // Attempt to extract structured metadata if available
      let parsedMeta: any = null;
      if (inv.notes && inv.notes.includes('[INTERCOMPANY_TRANSFER]')) {
        try {
          const jsonStr = inv.notes.split('[INTERCOMPANY_TRANSFER]')[1]?.split('|')[0]?.trim();
          if (jsonStr) parsedMeta = JSON.parse(jsonStr);
        } catch {
          // fallback to item parsing
        }
      }

      for (const item of inv.items) {
        const prod = item.finishedProduct;
        const metaItem = parsedMeta?.items?.find(
          (m: any) => m.finishedProductId === item.finishedProductId || m.productName === item.productName,
        );

        const qty = Number(item.quantity);
        const sellingRate = Number(item.rate);
        const lineSales = Number(item.netAmount);

        const unitCost = metaItem?.unitCost !== undefined
          ? Number(metaItem.unitCost)
          : Number(prod?.standardCost || 0);

        const lineCost = metaItem?.totalCost !== undefined
          ? Number(metaItem.totalCost)
          : Math.round(qty * unitCost * 100) / 100;

        const lineProfit = Math.round((lineSales - lineCost) * 100) / 100;
        const markupPercent = unitCost > 0
          ? Math.round(((sellingRate - unitCost) / unitCost) * 1000) / 10
          : 0;

        const row = {
          invoiceId: inv.id,
          invoiceNumber: inv.invoiceNumber,
          date: inv.invoiceDate,
          childCompany: inv.dealer?.name || 'Child Company',
          warehouse: inv.warehouse?.name || 'Central',
          productId: item.finishedProductId,
          productCode: prod?.productCode || 'N/A',
          productName: item.productName,
          packSize: item.packing || prod?.packSize?.name || '-',
          batchNumber: item.batchNumber || metaItem?.batchNumber || '-',
          quantity: qty,
          unitCost,
          sellingRate,
          lineCost,
          lineSales,
          profit: lineProfit,
          markupPercent,
        };

        detailedRows.push(row);

        grandTotalCost += lineCost;
        grandTotalSales += lineSales;
        grandTotalProfit += lineProfit;
        grandTotalQty += qty;

        // Group by product
        const prodKey = prod?.id || item.productName;
        if (!productAggregation.has(prodKey)) {
          productAggregation.set(prodKey, {
            productId: prodKey,
            productCode: prod?.productCode || 'N/A',
            productName: item.productName,
            packSize: row.packSize,
            totalQuantity: 0,
            unitCost: unitCost,
            weightedSellingRateTotal: 0,
            totalCost: 0,
            totalSales: 0,
            totalProfit: 0,
          });
        }
        const pAgg = productAggregation.get(prodKey)!;
        pAgg.totalQuantity += qty;
        pAgg.totalCost += lineCost;
        pAgg.totalSales += lineSales;
        pAgg.totalProfit += lineProfit;
        pAgg.weightedSellingRateTotal += lineSales;
      }
    }

    const aggregatedProducts = Array.from(productAggregation.values()).map((p) => {
      const avgSellingRate = p.totalQuantity > 0 ? Math.round((p.totalSales / p.totalQuantity) * 100) / 100 : 0;
      const marginPct = p.totalCost > 0 ? Math.round(((p.totalSales - p.totalCost) / p.totalCost) * 1000) / 10 : 0;
      return {
        ...p,
        averageSellingRate: avgSellingRate,
        marginPercent: marginPct,
      };
    });

    const overallMargin = grandTotalCost > 0
      ? Math.round(((grandTotalSales - grandTotalCost) / grandTotalCost) * 1000) / 10
      : 0;

    return {
      summary: {
        totalCost: Math.round(grandTotalCost * 100) / 100,
        totalSales: Math.round(grandTotalSales * 100) / 100,
        totalProfit: Math.round(grandTotalProfit * 100) / 100,
        overallMarginPercent: overallMargin,
        totalUnits: grandTotalQty,
        transfersCount: sales.length,
      },
      productPerformance: aggregatedProducts,
      detailedTransactions: detailedRows,
    };
  }

  /**
   * Child Company Received Goods & Intercompany Payable Report
   */
  async getChildReport(params: { childCompanyId: string; warehouseId?: string }) {
    const { childCompanyId, warehouseId } = params;
    if (!childCompanyId) {
      throw new BadRequestException('Child company ID is required');
    }

    const where: any = {
      companyId: childCompanyId,
      reference: { startsWith: 'IC-TX-' },
    };
    if (warehouseId) {
      where.warehouseId = warehouseId;
    }

    const purchases = await this.prisma.purchaseInvoice.findMany({
      where,
      include: {
        vendor: { select: { name: true } },
        warehouse: { select: { name: true } },
        items: {
          include: {
            finishedProduct: {
              select: {
                id: true,
                productCode: true,
                productName: true,
                packSize: { select: { name: true } },
              },
            },
          },
        },
      },
      orderBy: { date: 'desc' },
      take: 100,
    });

    // Query current stock in child warehouses
    const productIds = new Set<string>();
    purchases.forEach((p) => {
      p.items.forEach((it) => {
        if (it.finishedProductId) productIds.add(it.finishedProductId);
      });
    });

    const childStocks = await this.prisma.warehouseStock.findMany({
      where: {
        companyId: childCompanyId,
        itemType: 'FINISHED_PRODUCT',
        finishedProductId: { in: Array.from(productIds) },
        ...(warehouseId ? { warehouseId } : {}),
      },
      include: {
        warehouse: { select: { name: true } },
        finishedProduct: { select: { productName: true, productCode: true } },
      },
    });

    const stockMap = new Map<string, number>();
    childStocks.forEach((s) => {
      const current = stockMap.get(s.finishedProductId!) || 0;
      stockMap.set(s.finishedProductId!, current + Number(s.quantityOnHand));
    });

    let totalPayables = 0;
    const receivedItems: any[] = [];

    for (const pur of purchases) {
      totalPayables += Number(pur.netAmount);

      for (const item of pur.items) {
        const prod = item.finishedProduct;
        const currentStock = stockMap.get(item.finishedProductId || '') || 0;

        receivedItems.push({
          voucherNumber: pur.voucherNumber,
          date: pur.date,
          vendorInvoiceNo: pur.vendorInvoiceNo,
          warehouse: pur.warehouse?.name,
          productId: item.finishedProductId,
          productCode: prod?.productCode || 'N/A',
          productName: item.itemName,
          packSize: item.packing || prod?.packSize?.name || '-',
          quantityReceived: Number(item.quantity),
          purchaseRate: Number(item.rate),
          totalValue: Number(item.netAmount),
          currentStockInChildWarehouse: currentStock,
        });
      }
    }

    return {
      intercompanyPayable: totalPayables,
      receivedItems,
      childStockStatus: childStocks.map((s) => ({
        warehouse: s.warehouse.name,
        productCode: s.finishedProduct?.productCode || 'N/A',
        productName: s.finishedProduct?.productName || 'N/A',
        quantityOnHand: Number(s.quantityOnHand),
        averageCost: Number(s.averageCost),
      })),
    };
  }

  /**
   * Transfer History for auditing & list views
   */
  async getTransferHistory(companyId?: string) {
    const where: any = {
      notes: { contains: 'INTERCOMPANY', mode: 'insensitive' },
    };
    if (companyId) {
      where.companyId = companyId;
    }

    const transfers = await this.prisma.salesInvoice.findMany({
      where,
      include: {
        dealer: { select: { name: true } },
        warehouse: { select: { name: true } },
        company: { select: { name: true, code: true } },
        items: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return transfers.map((t) => {
      let parsedMeta: any = null;
      if (t.notes && t.notes.includes('[INTERCOMPANY_TRANSFER]')) {
        try {
          const jsonStr = t.notes.split('[INTERCOMPANY_TRANSFER]')[1]?.split('|')[0]?.trim();
          if (jsonStr) parsedMeta = JSON.parse(jsonStr);
        } catch {
          // ignore
        }
      }

      return {
        id: t.id,
        invoiceNumber: t.invoiceNumber,
        date: t.invoiceDate,
        sourceCompany: t.company?.name || 'Shehswar',
        targetCompany: t.dealer?.name || parsedMeta?.childCompany?.name || 'Child Company',
        warehouse: t.warehouse?.name,
        targetWarehouse: parsedMeta?.childWarehouse?.name || 'Child Central',
        amount: Number(t.netAmount),
        cost: parsedMeta?.totalCost || 0,
        profit: parsedMeta?.totalProfit || 0,
        markupPercent: parsedMeta?.markupPercent || 0,
        status: t.postingStatus || 'POSTED',
        itemsCount: t.items.length,
        items: t.items.map((i) => ({
          productName: i.productName,
          packing: i.packing,
          batchNumber: i.batchNumber,
          quantity: Number(i.quantity),
          rate: Number(i.rate),
          netAmount: Number(i.netAmount),
        })),
        notes: t.notes,
      };
    });
  }
}
