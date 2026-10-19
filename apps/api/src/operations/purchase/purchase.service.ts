/**
 * SHEHSWAR ONE360 - Purchase Service
 *
 * Manages the complete Purchase lifecycle:
 *  DRAFT → REVIEWED → POSTED → (CANCELLED)
 *
 * POSTED is atomic: Purchase + Stock + Vendor Ledger + Cost update.
 * Idempotent: posting twice has no effect after first success.
 *
 * Also handles:
 *  - Auto-create missing Raw/Packing Material from purchase items
 *  - Document attachment (vendor invoice, gate pass, bank receipt)
 *  - Purchase Return posting
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
import { VendorLedgerService } from '../ledger/vendor-ledger.service';
import { CostingService } from '../costing/costing.service';
import { DocumentNumberingService } from '../../platform/document-numbering/document-numbering.service';
import { uuidv7 } from '@shehswar/shared';
import {
  CreatePurchaseDto,
  CreatePurchaseReturnDto,
  AuthUser,
} from '@shehswar/types';
import { FinanceService } from '../finance/finance.service';

@Injectable()
export class PurchaseService {
  private readonly logger = new Logger(PurchaseService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly transactionService: TransactionService,
    private readonly inventoryService: InventoryService,
    private readonly vendorLedger: VendorLedgerService,
    private readonly costingService: CostingService,
    private readonly documentNumbering: DocumentNumberingService,
    private readonly financeService: FinanceService,
  ) {}

  // ============================
  // LIST / FIND
  // ============================

  async findAll(
    companyId: string,
    organizationId?: string,
    filters?: {
      vendorId?: string;
      warehouseId?: string;
      postingStatus?: string;
      fromDate?: string;
      toDate?: string;
      search?: string;
      limit?: number;
      offset?: number;
    },
  ) {
    const where: any = { companyId };
    if (organizationId) where.organizationId = organizationId;
    if (filters?.vendorId) where.vendorId = filters.vendorId;
    if (filters?.warehouseId) where.warehouseId = filters.warehouseId;
    if (filters?.postingStatus) where.postingStatus = filters.postingStatus;
    if (filters?.fromDate || filters?.toDate) {
      where.date = {};
      if (filters.fromDate) where.date.gte = new Date(filters.fromDate);
      if (filters.toDate) where.date.lte = new Date(filters.toDate);
    }
    if (filters?.search) {
      where.OR = [
        { voucherNumber: { contains: filters.search, mode: 'insensitive' } },
        { vendorInvoiceNo: { contains: filters.search, mode: 'insensitive' } },
        { reference: { contains: filters.search, mode: 'insensitive' } },
        { vendor: { name: { contains: filters.search, mode: 'insensitive' } } },
      ];
    }

    const [total, purchases] = await Promise.all([
      this.prisma.purchaseInvoice.count({ where }),
      this.prisma.purchaseInvoice.findMany({
        where,
        include: {
          vendor: { select: { id: true, name: true, code: true } },
          warehouse: { select: { id: true, name: true, code: true } },
          items: {
            select: {
              id: true, itemName: true, materialType: true,
              quantity: true, rate: true, netAmount: true,
              rawMaterialId: true, packingMaterialId: true, finishedProductId: true,
              phaseCategory: true,
            },
          },
          purchaseReturns: {
            include: { items: true },
          },
          documents: true,
          _count: { select: { items: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: filters?.limit ?? 50,
        skip: filters?.offset ?? 0,
      }),
    ]);

    return {
      total,
      data: purchases.map((p) => this.serializePurchase(p)),
    };
  }

  async findOne(id: string, companyId: string) {
    const purchase = await this.prisma.purchaseInvoice.findFirst({
      where: { id, companyId },
      include: {
        vendor: true,
        warehouse: { select: { id: true, name: true, code: true } },
        purchaseReturns: {
          include: { items: true },
        },
        items: {
          include: {
            rawMaterial: { select: { id: true, materialCode: true, materialName: true } },
            packingMaterial: { select: { id: true, materialCode: true, materialName: true } },
            finishedProduct: { select: { id: true, productCode: true, productName: true } },
          },
        },
        documents: true,
        gatePasses: { select: { id: true, gatePassNumber: true, vehicleNo: true, date: true } },
        vendorLedgerEntries: { select: { id: true, credit: true, runningBalance: true, entryDate: true } },
        stockLedgerEntries: { select: { id: true, itemType: true, quantityChange: true, quantityAfter: true } },
      },
    });

    if (!purchase) throw new NotFoundException(`Purchase not found`);
    return this.serializePurchase(purchase);
  }

  // ============================
  // CREATE (DRAFT)
  // ============================

  async create(dto: CreatePurchaseDto, actor: AuthUser) {
    const organizationId = dto.organizationId || actor.organizationId;
    const companyId = dto.companyId || actor.companyId;

    if (!organizationId || !companyId) {
      throw new BadRequestException('Organization and Company context required');
    }

    // Validate vendor exists in this company
    const vendor = await this.prisma.vendor.findFirst({
      where: { id: dto.vendorId, companyId },
    });
    if (!vendor) throw new NotFoundException('Vendor not found in this company');

    // Validate warehouse exists in this company
    const warehouse = await this.prisma.warehouse.findFirst({
      where: { id: dto.warehouseId, companyId },
    });
    if (!warehouse) throw new NotFoundException('Warehouse not found in this company');

    // Generate document number
    const voucherNumber = await this.documentNumbering.getNextDocumentNumber({
      organizationId,
      companyId,
      documentType: 'PURCHASE',
    });

    // Calculate totals from items if not provided
    const netAmount =
      dto.netAmount ??
      dto.items.reduce((sum, i) => sum + Number(i.netAmount), 0);

    // In-memory cache for items within the same purchase (prevents duplicate auto-creation and race conditions)
    const rmCache = new Map<string, any>();
    const pmCache = new Map<string, any>();
    const resolvedItems: any[] = [];

    for (const item of dto.items) {
      let rawMaterialId = item.rawMaterialId ?? null;
      let packingMaterialId = item.packingMaterialId ?? null;
      const purchaseRate = Number(item.rate) || 0;
      const normName = item.itemName ? item.itemName.trim().toLowerCase() : '';

      if (item.materialType === 'RAW_MATERIAL' && item.itemName) {
        let existingRm: any = null;
        if (rawMaterialId) {
          existingRm = await this.prisma.rawMaterial.findUnique({ where: { id: rawMaterialId } });
        }
        if (!existingRm && normName && rmCache.has(normName)) {
          existingRm = rmCache.get(normName);
        }
        if (!existingRm) {
          existingRm = await this.prisma.rawMaterial.findFirst({
            where: {
              companyId,
              materialName: { equals: item.itemName.trim(), mode: 'insensitive' },
            },
          });
        }

        if (existingRm) {
          rawMaterialId = existingRm.id;
          rmCache.set(normName, existingRm);
          const baseUomId = !existingRm.baseUomId ? await this.resolveUom(organizationId, item.unit, item.packing) : undefined;
          const categoryId = !existingRm.categoryId ? await this.resolveCategory(organizationId, 'RAW_MATERIAL') : undefined;

          const packingFactor = item.packing ? Number(item.packing.match(/(\d+(\.\d+)?)\s*(ltr|l|liter|kg|kilo|gm|g|ml)/i)?.[1] || 0) || null : null;
          await this.prisma.rawMaterial.update({
            where: { id: existingRm.id },
            data: {
              standardCost: existingRm.standardCost && Number(existingRm.standardCost) > 0 ? existingRm.standardCost : (purchaseRate || undefined),
              lastPurchaseCost: purchaseRate || undefined,
              averageCost: purchaseRate || undefined,
              ...(baseUomId ? { baseUomId, purchaseUomId: baseUomId } : {}),
              ...(categoryId ? { categoryId } : {}),
              ...(packingFactor ? { purchaseConversionFactor: packingFactor } : {}),
              ...(item.packing ? { specifications: item.packing, storageRequirements: `${item.packing} Container` } : {}),
            },
          });
        } else {
          const autoRm = await this.autoCreateMaterial(
            {
              organizationId,
              companyId,
              materialType: 'RAW_MATERIAL',
              itemName: item.itemName.trim(),
              packing: item.packing || undefined,
              unit: item.unit || undefined,
              purchaseRate: purchaseRate || undefined,
            },
            actor,
          );
          rawMaterialId = autoRm.id;
          rmCache.set(normName, autoRm);
        }
      } else if (item.materialType === 'PACKING_MATERIAL' && item.itemName) {
        let existingPm: any = null;
        if (packingMaterialId) {
          existingPm = await this.prisma.packingMaterial.findUnique({ where: { id: packingMaterialId } });
        }
        if (!existingPm && normName && pmCache.has(normName)) {
          existingPm = pmCache.get(normName);
        }
        if (!existingPm) {
          existingPm = await this.prisma.packingMaterial.findFirst({
            where: {
              companyId,
              materialName: { equals: item.itemName.trim(), mode: 'insensitive' },
            },
          });
        }

        if (existingPm) {
          packingMaterialId = existingPm.id;
          pmCache.set(normName, existingPm);
          const baseUomId = !existingPm.baseUomId ? await this.resolveUom(organizationId, item.unit, item.packing) : undefined;
          const categoryId = !existingPm.categoryId ? await this.resolveCategory(organizationId, 'PACKING_MATERIAL') : undefined;

          await this.prisma.packingMaterial.update({
            where: { id: existingPm.id },
            data: {
              standardCost: existingPm.standardCost && Number(existingPm.standardCost) > 0 ? existingPm.standardCost : (purchaseRate || undefined),
              lastPurchaseCost: purchaseRate || undefined,
              ...(baseUomId ? { baseUomId, purchaseUomId: baseUomId } : {}),
              ...(categoryId ? { categoryId } : {}),
              ...(item.packing && !existingPm.packCompatibility ? { packCompatibility: item.packing } : {}),
            },
          });
        } else {
          const autoPm = await this.autoCreateMaterial(
            {
              organizationId,
              companyId,
              materialType: 'PACKING_MATERIAL',
              itemName: item.itemName.trim(),
              packing: item.packing || undefined,
              unit: item.unit || undefined,
              purchaseRate: purchaseRate || undefined,
            },
            actor,
          );
          packingMaterialId = autoPm.id;
          pmCache.set(normName, autoPm);
        }
      }

      resolvedItems.push({
        ...item,
        rawMaterialId,
        packingMaterialId,
      });
    }

    const purchase = await this.prisma.purchaseInvoice.create({
      data: {
        id: uuidv7(),
        organizationId,
        companyId,
        voucherNumber,
        date: new Date(dto.date),
        receivedOn: dto.receivedOn ? new Date(dto.receivedOn) : null,
        reference: dto.reference ?? null,
        vendorInvoiceNo: dto.vendorInvoiceNo ?? null,
        postingStatus: 'DRAFT',
        vendorId: dto.vendorId,
        warehouseId: dto.warehouseId,
        grossAmount: dto.grossAmount ?? netAmount,
        discountRate: dto.discountRate ?? 0,
        discountAmount: dto.discountAmount ?? 0,
        salesTaxPercent: dto.salesTaxPercent ?? 0,
        taxAmount: dto.taxAmount ?? 0,
        netAmount,
        notes: dto.notes ?? null,
        createdById: actor.id,
        items: {
          create: resolvedItems.map((item) => ({
            id: uuidv7(),
            materialType: item.materialType,
            rawMaterialId: item.rawMaterialId ?? null,
            packingMaterialId: item.packingMaterialId ?? null,
            finishedProductId: item.finishedProductId ?? null,
            itemName: item.itemName,
            packing: item.packing ?? null,
            quantity: item.quantity,
            rate: item.rate,
            grossAmount: item.grossAmount,
            discountRate: item.discountRate ?? 0,
            discountAmount: item.discountAmount ?? 0,
            taxPercent: item.taxPercent ?? 0,
            taxAmount: item.taxAmount ?? 0,
            netAmount: item.netAmount,
            phaseCategory: (item as any).warehouseId ? `WH:${(item as any).warehouseId}` : (item.phaseCategory ?? null),
          })),
        },
        documents: dto.documentAttachments
          ? {
              create: dto.documentAttachments.map((doc) => ({
                id: uuidv7(),
                documentType: doc.documentType,
                documentNumber: doc.documentNumber ?? null,
                fileName: doc.fileName,
                fileUrl: doc.fileUrl,
                fileSizeBytes: doc.fileSizeBytes ? BigInt(doc.fileSizeBytes) : null,
                mimeType: doc.mimeType ?? null,
                extractedData: doc.extractedData ? (doc.extractedData as any) : undefined,
              })),
            }
          : undefined,
      },
      include: {
        vendor: { select: { id: true, name: true, code: true } },
        warehouse: { select: { id: true, name: true, code: true } },
        items: true,
        documents: true,
      },
    });

    this.logger.log(`Purchase created: ${voucherNumber} by ${actor.email}`);

    // Auto-post immediately: "we don't need to post in purchase section"
    if ((dto as any).autoPost !== false) {
      try {
        await this.postPurchase(purchase.id, actor);
        const posted = await this.findOne(purchase.id, companyId);
        return posted;
      } catch (postErr: any) {
        this.logger.warn(`Auto-posting purchase failed: ${postErr.message}`);
      }
    }

    return this.serializePurchase(purchase);
  }

  async createBatch(dtos: CreatePurchaseDto[], actor: AuthUser) {
    if (!dtos || dtos.length === 0) throw new BadRequestException('At least one purchase is required');
    const results = [];
    for (const dto of dtos) {
      const p = await this.create(dto, actor);
      results.push(p);
    }
    return {
      success: true,
      count: results.length,
      purchases: results,
    };
  }

  // ============================
  // DELETE PURCHASE & REVERSE
  // ============================
  async deletePurchase(id: string, actor: AuthUser) {
    const purchase = await this.prisma.purchaseInvoice.findFirst({
      where: { id, companyId: actor.companyId },
      include: {
        items: true,
        stockLedgerEntries: true,
        vendorLedgerEntries: true,
        gatePasses: true,
        documents: true,
      },
    });

    if (!purchase) throw new NotFoundException('Purchase not found');

    return this.transactionService.runInTransaction(async (tx) => {
      // 1. If purchase was POSTED, reverse inventory stock
      if (purchase.postingStatus === 'POSTED') {
        for (const item of purchase.items) {
          if (Number(item.quantity) > 0) {
            const targetWarehouseId =
              (item.phaseCategory?.startsWith('WH:') ? item.phaseCategory.substring(3) : null) ||
              purchase.warehouseId;

            await this.inventoryService.applyMovement(tx, {
              organizationId: purchase.organizationId,
              companyId: purchase.companyId,
              warehouseId: targetWarehouseId,
              itemType: item.materialType as any,
              rawMaterialId: item.rawMaterialId ?? undefined,
              packingMaterialId: item.packingMaterialId ?? undefined,
              finishedProductId: item.finishedProductId ?? undefined,
              quantityChange: -Number(item.quantity),
              unitCost: Number(item.rate) || 0,
              transactionType: 'PURCHASE_RETURN',
              referenceId: purchase.id,
              referenceNumber: `DEL-${purchase.voucherNumber}`,
              notes: `Stock reversal from deleted purchase ${purchase.voucherNumber}`,
            });
          }
        }

        // Revert Vendor Ledger
        await tx.vendorLedgerEntry.deleteMany({
          where: { purchaseInvoiceId: purchase.id },
        });
      }

      // 2. Revert linked PO status if this was created from a PO
      if (purchase.reference) {
        await tx.purchaseOrder.updateMany({
          where: {
            companyId: purchase.companyId,
            poNumber: purchase.reference,
          },
          data: { status: 'CONFIRMED' },
        });
      }

      // 3. Delete attachments & items
      await tx.purchaseDocumentAttachment.deleteMany({ where: { purchaseInvoiceId: id } });
      await tx.purchaseInvoiceItem.deleteMany({ where: { purchaseInvoiceId: id } });
      await tx.stockLedgerEntry.deleteMany({ where: { referenceId: id } });

      // 4. Delete the purchase itself
      await tx.purchaseInvoice.delete({ where: { id } });

      this.logger.log(`Purchase ${purchase.voucherNumber} deleted and stock/ledger reversed by ${actor.email}`);
      return {
        success: true,
        message: `Purchase ${purchase.voucherNumber} deleted successfully. Stock and ledger entries reversed.`,
      };
    });
  }

  // ============================
  // UPDATE (while DRAFT/REVIEWED)
  // ============================

  async update(id: string, dto: Partial<CreatePurchaseDto>, actor: AuthUser) {
    const purchase = await this.prisma.purchaseInvoice.findFirst({
      where: { id, companyId: actor.companyId },
    });
    if (!purchase) throw new NotFoundException('Purchase not found');
    if (purchase.postingStatus === 'POSTED') {
      throw new BadRequestException('Cannot edit a POSTED purchase');
    }

    return this.prisma.purchaseInvoice.update({
      where: { id },
      data: {
        reference: dto.reference ?? purchase.reference,
        notes: dto.notes ?? purchase.notes,
        editedById: actor.id,
      },
    });
  }

  // ============================
  // POST PURCHASE — ATOMIC
  // ============================

  /**
   * Posts a purchase: idempotent, atomic.
   * Triggers: Stock +, Vendor Ledger credit, Material cost update.
   */
  async postPurchase(id: string, actor: AuthUser): Promise<any> {
    const purchase = await this.prisma.purchaseInvoice.findFirst({
      where: { id, companyId: actor.companyId },
      include: { items: true, vendor: true, warehouse: true },
    });

    if (!purchase) throw new NotFoundException('Purchase not found');

    // Idempotency: already posted → return current state
    if (purchase.postingStatus === 'POSTED') {
      this.logger.warn(`Purchase ${purchase.voucherNumber} already POSTED — skipping duplicate`);
      return this.serializePurchase(purchase);
    }

    if (purchase.postingStatus === 'CANCELLED') {
      throw new BadRequestException('Cannot post a cancelled purchase');
    }

    // ── Atomic transaction ──────────────────────────────────────────
    return this.transactionService.runInTransaction(async (tx) => {
      // 1. Mark purchase as POSTED
      const posted = await tx.purchaseInvoice.update({
        where: { id },
        data: {
          postingStatus: 'POSTED',
          isComplete: true,
          postedAt: new Date(),
          postedById: actor.id,
        },
      });

      // 2. For each item: Stock + , Cost update
      for (const item of purchase.items) {
        const unitCost = Number(item.quantity) > 0
          ? Number(item.netAmount) / Number(item.quantity)
          : Number(item.rate);

        const targetWarehouseId =
          (item.phaseCategory?.startsWith('WH:') ? item.phaseCategory.substring(3) : null) ||
          purchase.warehouseId;

        await this.inventoryService.applyMovement(tx, {
          organizationId: purchase.organizationId,
          companyId: purchase.companyId,
          warehouseId: targetWarehouseId,
          itemType: item.materialType as any,
          rawMaterialId: item.rawMaterialId ?? undefined,
          packingMaterialId: item.packingMaterialId ?? undefined,
          finishedProductId: item.finishedProductId ?? undefined,
          quantityChange: Number(item.quantity),
          unitCost,
          transactionType: 'PURCHASE',
          referenceId: purchase.id,
          referenceNumber: purchase.voucherNumber,
          notes: `Purchase from ${purchase.vendor?.name}`,
        });

        // Update material cost (lastPurchaseCost, averageCost)
        await this.costingService.updateMaterialCostAfterPurchase(tx, {
          rawMaterialId: item.rawMaterialId ?? undefined,
          packingMaterialId: item.packingMaterialId ?? undefined,
          purchaseRate: unitCost,
          quantityPurchased: Number(item.quantity),
        });
      }

      // 3. Vendor Ledger: credit (we owe vendor the net amount)
      await this.vendorLedger.postEntry(tx, {
        organizationId: purchase.organizationId,
        companyId: purchase.companyId,
        vendorId: purchase.vendorId,
        entryType: 'PURCHASE_INVOICE',
        referenceId: purchase.id,
        voucherNumber: purchase.voucherNumber,
        description: `Purchase Invoice ${purchase.vendorInvoiceNo ?? purchase.voucherNumber}`,
        credit: Number(purchase.netAmount),
        debit: 0,
        purchaseInvoiceId: purchase.id,
      });

      // General Ledger: Double-entry balanced posting (Section 5 & 60)
      // Debit Inventory (Asset +), Credit Accounts Payable (Liability +)
      await this.financeService.postJournalEntry(tx, {
        organizationId: purchase.organizationId,
        companyId: purchase.companyId,
        entryNumber: `JV-${purchase.voucherNumber}`,
        entryDate: new Date(),
        entryType: 'PURCHASE_INVOICE',
        referenceType: 'PURCHASE_INVOICE',
        referenceId: purchase.id,
        referenceNumber: purchase.voucherNumber,
        description: `Purchase Invoice ${purchase.voucherNumber} from ${purchase.vendor?.name}`,
        createdById: actor.id,
        lines: [
          {
            accountCode: '1200', // Inventory (Asset)
            debit: Number(purchase.netAmount),
            credit: 0,
            vendorId: purchase.vendorId,
            description: `Inventory from ${purchase.vendor?.name}`,
          },
          {
            accountCode: '2000', // Accounts Payable (Liability)
            debit: 0,
            credit: Number(purchase.netAmount),
            vendorId: purchase.vendorId,
            description: `Payable to ${purchase.vendor?.name}`,
          },
        ],
      });

      // 4. If Purchase originated from a PO, mark PO as CONVERTED_TO_PURCHASE
      if (purchase.reference) {
        await tx.purchaseOrder.updateMany({
          where: {
            companyId: purchase.companyId,
            poNumber: purchase.reference,
          },
          data: { status: 'CONVERTED_TO_PURCHASE' },
        });
      }

      this.logger.log(
        `Purchase POSTED: ${purchase.voucherNumber} | Net: ${purchase.netAmount} | Items: ${purchase.items.length}`,
      );

      return this.serializePurchase(posted);
    });
  }

  // ============================
  // AUTO-CREATE MATERIAL FROM PURCHASE ITEM
  // ============================

  private async resolveUom(
    organizationId: string,
    unitHint?: string,
    packingHint?: string,
  ): Promise<string | null> {
    const hint = (unitHint || '').trim().toUpperCase();
    const pack = (packingHint || '').trim().toUpperCase();

    let targetCode = 'KG';
    if (hint.includes('LTR') || hint.includes('LIT') || hint === 'L' || pack.includes('LTR') || pack.includes('LITER')) {
      targetCode = 'LTR';
    } else if (hint.includes('TON') || hint.includes('MT') || pack.includes('TON')) {
      targetCode = 'TON';
    } else if (hint.includes('PCS') || hint.includes('PC') || hint.includes('BAG') || hint.includes('DRUM') || hint.includes('BOX') || pack.includes('BAG') || pack.includes('DRUM') || pack.includes('BOX')) {
      targetCode = 'PCS';
    } else if (hint.includes('KG') || pack.includes('KG')) {
      targetCode = 'KG';
    }

    const uom = await this.prisma.unitOfMeasure.findFirst({
      where: {
        organizationId,
        OR: [
          { code: targetCode },
          { code: { equals: hint, mode: 'insensitive' } },
          { symbol: { equals: hint, mode: 'insensitive' } },
        ],
      },
    });

    return uom?.id || null;
  }

  private async resolveCategory(
    organizationId: string,
    materialType: 'RAW_MATERIAL' | 'PACKING_MATERIAL',
  ): Promise<string | null> {
    const cat = await this.prisma.materialCategory.findFirst({
      where: {
        organizationId,
        categoryType: materialType,
        status: 'ACTIVE',
      },
      orderBy: { createdAt: 'asc' },
    });
    return cat?.id || null;
  }

  /**
   * If a purchase item references a material that doesn't exist yet,
   * create it automatically (after user confirms the type).
   */
  async autoCreateMaterial(
    params: {
      organizationId: string;
      companyId: string;
      materialType: 'RAW_MATERIAL' | 'PACKING_MATERIAL';
      itemName: string;
      packing?: string;
      unit?: string;
      purchaseRate?: number;
    },
    _actor: AuthUser,
  ): Promise<{ id: string; materialCode: string; materialName: string; type: string }> {
    const { organizationId, companyId, materialType, itemName, purchaseRate, packing, unit } = params;
    const cleanItemName = itemName.trim();

    // 1. First check if a material already exists by name (case-insensitive) to prevent duplicate creation
    if (materialType === 'RAW_MATERIAL') {
      const existingByName = await this.prisma.rawMaterial.findFirst({
        where: {
          companyId,
          materialName: { equals: cleanItemName, mode: 'insensitive' },
        },
      });
      if (existingByName) {
        return {
          id: existingByName.id,
          materialCode: existingByName.materialCode,
          materialName: existingByName.materialName,
          type: 'RAW_MATERIAL',
        };
      }
    } else {
      const existingByName = await this.prisma.packingMaterial.findFirst({
        where: {
          companyId,
          materialName: { equals: cleanItemName, mode: 'insensitive' },
        },
      });
      if (existingByName) {
        return {
          id: existingByName.id,
          materialCode: existingByName.materialCode,
          materialName: existingByName.materialName,
          type: 'PACKING_MATERIAL',
        };
      }
    }

    // 2. Generate a clean material code from the name
    const codeBase = cleanItemName
      .replace(/[^a-zA-Z0-9\s]/g, '')
      .split(' ')
      .filter(Boolean)
      .slice(0, 3)
      .map((w) => w.substring(0, 3).toUpperCase())
      .join('-');

    const basePrefix = (codeBase || (materialType === 'RAW_MATERIAL' ? 'RM' : 'PM')).substring(0, 15);

    // Check for code collisions and append unique suffix if needed
    const tryCode = async (base: string, attempt: number = 0): Promise<string> => {
      const suffix = attempt === 0 ? '' : `-${attempt}-${Math.floor(100 + Math.random() * 900)}`;
      const code = `${base}${suffix}`.substring(0, 40);
      const existing =
        materialType === 'RAW_MATERIAL'
          ? await this.prisma.rawMaterial.findFirst({ where: { companyId, materialCode: code } })
          : await this.prisma.packingMaterial.findFirst({ where: { companyId, materialCode: code } });
      if (existing) return tryCode(base, attempt + 1);
      return code;
    };

    const materialCode = await tryCode(basePrefix);
    const baseUomId = await this.resolveUom(organizationId, unit, packing);
    const categoryId = await this.resolveCategory(organizationId, materialType);

    const packingFactor = packing ? Number(packing.match(/(\d+(\.\d+)?)\s*(ltr|l|liter|kg|kilo|gm|g|ml)/i)?.[1] || 0) || null : null;

    if (materialType === 'RAW_MATERIAL') {
      try {
        const mat = await this.prisma.rawMaterial.create({
          data: {
            id: uuidv7(),
            organizationId,
            companyId,
            materialCode,
            materialName: cleanItemName,
            description: packing ? `${cleanItemName} (${packing})` : `Auto-created from purchase`,
            status: 'ACTIVE',
            approvalStatus: 'APPROVED',
            categoryId: categoryId || null,
            baseUomId: baseUomId || null,
            purchaseUomId: baseUomId || null,
            purchaseConversionFactor: packingFactor || null,
            standardCost: purchaseRate ?? null,
            lastPurchaseCost: purchaseRate ?? null,
            averageCost: purchaseRate ?? null,
            specifications: packing || null,
            storageRequirements: packing ? `${packing} Container` : null,
          },
        });
        return { id: mat.id, materialCode: mat.materialCode, materialName: mat.materialName, type: 'RAW_MATERIAL' };
      } catch (err: any) {
        if (err?.code === 'P2002') {
          // If collision occurred under concurrency, find existing or retry with guaranteed timestamp code
          const existing = await this.prisma.rawMaterial.findFirst({
            where: {
              companyId,
              OR: [
                { materialName: { equals: cleanItemName, mode: 'insensitive' } },
                { materialCode },
              ],
            },
          });
          if (existing) {
            return { id: existing.id, materialCode: existing.materialCode, materialName: existing.materialName, type: 'RAW_MATERIAL' };
          }
          const retryCode = `${basePrefix}-${Date.now().toString().slice(-6)}`;
          const mat = await this.prisma.rawMaterial.create({
            data: {
              id: uuidv7(),
              organizationId,
              companyId,
              materialCode: retryCode,
              materialName: cleanItemName,
              description: packing ? `${cleanItemName} (${packing})` : `Auto-created from purchase`,
              status: 'ACTIVE',
              approvalStatus: 'APPROVED',
              categoryId: categoryId || null,
              baseUomId: baseUomId || null,
              purchaseUomId: baseUomId || null,
              purchaseConversionFactor: packingFactor || null,
              standardCost: purchaseRate ?? null,
              lastPurchaseCost: purchaseRate ?? null,
              averageCost: purchaseRate ?? null,
              specifications: packing || null,
              storageRequirements: packing ? `${packing} Container` : null,
            },
          });
          return { id: mat.id, materialCode: mat.materialCode, materialName: mat.materialName, type: 'RAW_MATERIAL' };
        }
        throw err;
      }
    } else {
      try {
        const mat = await this.prisma.packingMaterial.create({
          data: {
            id: uuidv7(),
            organizationId,
            companyId,
            materialCode,
            materialName: cleanItemName,
            description: packing ? `${cleanItemName} (${packing})` : `Auto-created from purchase`,
            status: 'ACTIVE',
            approvalStatus: 'APPROVED',
            categoryId: categoryId || null,
            baseUomId: baseUomId || null,
            purchaseUomId: baseUomId || null,
            standardCost: purchaseRate ?? null,
            lastPurchaseCost: purchaseRate ?? null,
            packCompatibility: packing || null,
          },
        });
        return { id: mat.id, materialCode: mat.materialCode, materialName: mat.materialName, type: 'PACKING_MATERIAL' };
      } catch (err: any) {
        if (err?.code === 'P2002') {
          const existing = await this.prisma.packingMaterial.findFirst({
            where: {
              companyId,
              OR: [
                { materialName: { equals: cleanItemName, mode: 'insensitive' } },
                { materialCode },
              ],
            },
          });
          if (existing) {
            return { id: existing.id, materialCode: existing.materialCode, materialName: existing.materialName, type: 'PACKING_MATERIAL' };
          }
          const retryCode = `${basePrefix}-${Date.now().toString().slice(-6)}`;
          const mat = await this.prisma.packingMaterial.create({
            data: {
              id: uuidv7(),
              organizationId,
              companyId,
              materialCode: retryCode,
              materialName: cleanItemName,
              description: packing ? `${cleanItemName} (${packing})` : `Auto-created from purchase`,
              status: 'ACTIVE',
              approvalStatus: 'APPROVED',
              categoryId: categoryId || null,
              baseUomId: baseUomId || null,
              purchaseUomId: baseUomId || null,
              standardCost: purchaseRate ?? null,
              lastPurchaseCost: purchaseRate ?? null,
              packCompatibility: packing || null,
            },
          });
          return { id: mat.id, materialCode: mat.materialCode, materialName: mat.materialName, type: 'PACKING_MATERIAL' };
        }
        throw err;
      }
    }
  }

  /**
   * Fuzzy match item name against existing materials.
   * Returns best match or null if none found.
   */
  async matchMaterial(
    itemName: string,
    companyId: string,
  ): Promise<{
    found: boolean;
    id?: string;
    type?: string;
    materialCode?: string;
    materialName?: string;
    confidence?: number;
  }> {
    const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
    const needle = normalize(itemName);

    const [rawMaterials, packingMaterials] = await Promise.all([
      this.prisma.rawMaterial.findMany({
        where: { companyId, status: 'ACTIVE' },
        select: { id: true, materialCode: true, materialName: true },
      }),
      this.prisma.packingMaterial.findMany({
        where: { companyId, status: 'ACTIVE' },
        select: { id: true, materialCode: true, materialName: true },
      }),
    ]);

    const candidates = [
      ...rawMaterials.map((m) => ({ ...m, type: 'RAW_MATERIAL' })),
      ...packingMaterials.map((m) => ({ ...m, type: 'PACKING_MATERIAL' })),
    ];

    for (const c of candidates) {
      const haystack = normalize(c.materialName);
      // Exact match
      if (haystack === needle) {
        return { found: true, id: c.id, type: c.type, materialCode: c.materialCode, materialName: c.materialName, confidence: 1.0 };
      }
      // Contains match
      if (haystack.includes(needle) || needle.includes(haystack)) {
        return { found: true, id: c.id, type: c.type, materialCode: c.materialCode, materialName: c.materialName, confidence: 0.8 };
      }
    }

    return { found: false };
  }

  // ============================
  // PURCHASE RETURN
  // ============================

  async createReturn(dto: CreatePurchaseReturnDto, actor: AuthUser) {
    const organizationId = dto.organizationId || actor.organizationId;
    const companyId = dto.companyId || actor.companyId;

    if (!organizationId || !companyId) {
      throw new BadRequestException('Organization and Company context required');
    }

    const vendor = await this.prisma.vendor.findFirst({ where: { id: dto.vendorId, companyId } });
    if (!vendor) throw new NotFoundException('Vendor not found');

    const warehouse = await this.prisma.warehouse.findFirst({ where: { id: dto.warehouseId, companyId } });
    if (!warehouse) throw new NotFoundException('Warehouse not found');

    const voucherNumber = await this.documentNumbering.getNextDocumentNumber({
      organizationId,
      companyId,
      documentType: 'PRET', // Purchase Return
    });

    const parsedDate = dto.date ? new Date(dto.date) : new Date();
    const returnDate = isNaN(parsedDate.getTime()) ? new Date() : parsedDate;
    const netAmount = dto.items.reduce((sum: number, i: any) => sum + Number(i.netAmount), 0);

    // If original purchase invoice is linked, fetch its items and previous returns to validate customizable return quantities
    let origPurchase: any = null;
    let prevReturns: any[] = [];
    if (dto.purchaseInvoiceId) {
      origPurchase = await this.prisma.purchaseInvoice.findFirst({
        where: { id: dto.purchaseInvoiceId, companyId },
        include: { items: true },
      });
      prevReturns = await this.prisma.purchaseReturn.findMany({
        where: { purchaseInvoiceId: dto.purchaseInvoiceId, companyId },
        include: { items: true },
      });
    }

    // Validate that custom return quantities do not exceed available purchased stock
    if (origPurchase && Array.isArray(origPurchase.items)) {
      for (const item of dto.items) {
        const matchingOrigItems = origPurchase.items.filter(
          (oi: any) =>
            (item.rawMaterialId && oi.rawMaterialId === item.rawMaterialId) ||
            (item.packingMaterialId && oi.packingMaterialId === item.packingMaterialId) ||
            (item.finishedProductId && oi.finishedProductId === item.finishedProductId) ||
            (item.itemName && oi.itemName && oi.itemName.trim().toLowerCase() === item.itemName.trim().toLowerCase()),
        );

        if (matchingOrigItems.length > 0) {
          const totalOrigQty = matchingOrigItems.reduce((s: number, oi: any) => s + Number(oi.quantity || 0), 0);
          const alreadyReturned = prevReturns
            .flatMap((pr) => pr.items || [])
            .filter((pri: any) =>
              (pri.rawMaterialId && item.rawMaterialId && pri.rawMaterialId === item.rawMaterialId) ||
              (pri.packingMaterialId && item.packingMaterialId && pri.packingMaterialId === item.packingMaterialId) ||
              (pri.finishedProductId && item.finishedProductId && pri.finishedProductId === item.finishedProductId) ||
              (pri.itemName && item.itemName && pri.itemName.trim().toLowerCase() === item.itemName.trim().toLowerCase()),
            )
            .reduce((s: number, pri: any) => s + Number(pri.quantity || 0), 0);

          const maxAvailable = Math.max(0, totalOrigQty - alreadyReturned);
          if (Number(item.quantity) > maxAvailable + 0.0001) {
            throw new BadRequestException(
              `Cannot return ${item.quantity} for "${item.itemName}". Maximum returnable quantity is ${maxAvailable} (Original Purchased Total: ${totalOrigQty}, Already Returned: ${alreadyReturned}).`,
            );
          }
        }
      }
    }

    // Pre-resolve material IDs for all items
    const resolvedItems = await Promise.all(
      dto.items.map(async (item: any) => {
        let rawMaterialId = item.rawMaterialId ?? null;
        let packingMaterialId = item.packingMaterialId ?? null;
        let finishedProductId = item.finishedProductId ?? null;

        // Try to match from original purchase items
        if (!rawMaterialId && !packingMaterialId && !finishedProductId && origPurchase?.items) {
          const matched = origPurchase.items.find(
            (oi: any) =>
              oi.itemName &&
              item.itemName &&
              oi.itemName.trim().toLowerCase() === item.itemName.trim().toLowerCase(),
          );
          if (matched) {
            rawMaterialId = matched.rawMaterialId ?? null;
            packingMaterialId = matched.packingMaterialId ?? null;
            finishedProductId = matched.finishedProductId ?? null;
          }
        }

        // If still not resolved, query masters by itemName
        if (!rawMaterialId && !packingMaterialId && !finishedProductId && item.itemName) {
          const nameClean = item.itemName.trim();
          const rm = await this.prisma.rawMaterial.findFirst({
            where: { companyId, materialName: { equals: nameClean, mode: 'insensitive' } },
          });
          if (rm) {
            rawMaterialId = rm.id;
          } else {
            const pm = await this.prisma.packingMaterial.findFirst({
              where: { companyId, materialName: { equals: nameClean, mode: 'insensitive' } },
            });
            if (pm) packingMaterialId = pm.id;
          }
        }

        return {
          ...item,
          rawMaterialId,
          packingMaterialId,
          finishedProductId,
        };
      }),
    );

    return this.transactionService.runInTransaction(async (tx) => {
      // 1. Create purchase return record
      const pr = await tx.purchaseReturn.create({
        data: {
          id: uuidv7(),
          organizationId,
          companyId,
          voucherNumber,
          purchaseInvoiceId: dto.purchaseInvoiceId ?? null,
          date: returnDate,
          vendorId: dto.vendorId,
          warehouseId: dto.warehouseId,
          postingStatus: 'POSTED',
          netAmount,
          reason: dto.reason ?? null,
          createdById: actor.id,
          postedAt: new Date(),
          items: {
            create: resolvedItems.map((item: any) => ({
              id: uuidv7(),
              materialType: item.materialType,
              rawMaterialId: item.rawMaterialId,
              packingMaterialId: item.packingMaterialId,
              finishedProductId: item.finishedProductId,
              itemName: item.itemName,
              quantity: item.quantity,
              rate: item.rate,
              netAmount: item.netAmount,
            })),
          },
        },
        include: { items: true },
      });

      // 2. Decrease stock for each returned item (routing to designated item warehouse)
      for (const item of resolvedItems) {
        let targetWarehouseId = item.warehouseId || dto.warehouseId;
        if (!item.warehouseId && origPurchase?.items) {
          // If warehouse not explicitly specified, check which warehouse currently has stock
          const matchingStock = await tx.warehouseStock.findFirst({
            where: {
              companyId,
              rawMaterialId: item.rawMaterialId ?? undefined,
              packingMaterialId: item.packingMaterialId ?? undefined,
              finishedProductId: item.finishedProductId ?? undefined,
              quantityOnHand: { gte: Number(item.quantity) },
            },
          });
          if (matchingStock) {
            targetWarehouseId = matchingStock.warehouseId;
          } else {
            const matchedOrig = origPurchase.items.find(
              (oi: any) =>
                (item.rawMaterialId && oi.rawMaterialId === item.rawMaterialId) ||
                (item.packingMaterialId && oi.packingMaterialId === item.packingMaterialId) ||
                (item.finishedProductId && oi.finishedProductId === item.finishedProductId) ||
                (oi.itemName && item.itemName && oi.itemName.trim().toLowerCase() === item.itemName.trim().toLowerCase()),
            );
            if (matchedOrig?.phaseCategory?.startsWith('WH:')) {
              targetWarehouseId = matchedOrig.phaseCategory.substring(3);
            }
          }
        }

        await this.inventoryService.applyMovement(tx, {
          organizationId,
          companyId,
          warehouseId: targetWarehouseId,
          itemType: item.materialType as any,
          rawMaterialId: item.rawMaterialId ?? undefined,
          packingMaterialId: item.packingMaterialId ?? undefined,
          finishedProductId: item.finishedProductId ?? undefined,
          quantityChange: -Number(item.quantity), // negative = out
          transactionType: 'PURCHASE_RETURN',
          referenceId: pr.id,
          referenceNumber: voucherNumber,
          notes: dto.reason ?? 'Purchase return',
        });
      }

      // 3. Vendor Ledger: debit (vendor owes us a refund)
      await this.vendorLedger.postEntry(tx, {
        organizationId,
        companyId,
        vendorId: dto.vendorId,
        entryType: 'PURCHASE_RETURN',
        referenceId: pr.id,
        voucherNumber,
        description: `Purchase Return - ${dto.reason ?? ''}`,
        credit: 0,
        debit: netAmount,
        purchaseReturnId: pr.id,
      });

      // 4. Update Original Purchase Invoice with return status and notes
      if (origPurchase) {
        const totalOrigQty = origPurchase.items.reduce((s: number, i: any) => s + Number(i.quantity || 0), 0);
        const totalAllReturnedQty =
          prevReturns
            .flatMap((pr: any) => pr.items || [])
            .reduce((s: number, i: any) => s + Number(i.quantity || 0), 0) +
          resolvedItems.reduce((s: number, i: any) => s + Number(i.quantity || 0), 0);

        const isFullyReturned = totalAllReturnedQty >= totalOrigQty - 0.0001;

        await tx.purchaseInvoice.update({
          where: { id: origPurchase.id },
          data: {
            postingStatus: isFullyReturned ? 'RETURNED' : 'PARTIALLY_RETURNED',
            notes: origPurchase.notes
              ? `${origPurchase.notes} | Return ${voucherNumber} (-PKR ${Number(netAmount).toLocaleString()})`
              : `Return ${voucherNumber} (-PKR ${Number(netAmount).toLocaleString()})`,
          },
        });
      }

      this.logger.log(`Purchase Return POSTED: ${voucherNumber} | Net: ${netAmount}`);
      return pr;
    });
  }

  async findAllReturns(
    companyId: string,
    filters?: { vendorId?: string; limit?: number; offset?: number },
  ) {
    return this.prisma.purchaseReturn.findMany({
      where: { companyId, ...(filters?.vendorId ? { vendorId: filters.vendorId } : {}) },
      include: {
        vendor: { select: { id: true, name: true, code: true } },
        warehouse: { select: { id: true, name: true, code: true } },
        purchaseInvoice: { select: { id: true, voucherNumber: true, date: true, netAmount: true } },
        items: true,
      },
      orderBy: { createdAt: 'desc' },
      take: filters?.limit ?? 50,
      skip: filters?.offset ?? 0,
    });
  }

  async quickCreateWarehouse(
    params: { name: string; code?: string; location?: string },
    actor: AuthUser,
  ) {
    const code =
      params.code ||
      `WH-${params.name.replace(/[^A-Za-z0-9]/g, '').slice(0, 4).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`;

    return this.prisma.warehouse.create({
      data: {
        id: uuidv7(),
        companyId: actor.companyId,
        code,
        name: params.name,
        type: 'RAW_MATERIAL',
        address: params.location || 'Factory site',
      },
      select: {
        id: true,
        code: true,
        name: true,
      },
    });
  }

  // ============================
  // PRIVATE HELPERS
  // ============================

  private serializePurchase(p: any) {
    const returnItems = (p.purchaseReturns || []).flatMap((pr: any) => pr.items || []);
    const totalReturnedAmount = (p.purchaseReturns || []).reduce(
      (sum: number, pr: any) => sum + Number(pr.netAmount || 0),
      0,
    );

    // Track consumed return quantities per material key to avoid deducting the same return multiple times across split rows
    const consumedReturns = new Map<string, number>();

    const items = (p.items ?? []).map((i: any) => {
      const itemWarehouseId = i.phaseCategory?.startsWith('WH:')
        ? i.phaseCategory.substring(3)
        : p.warehouseId;

      const matKey =
        i.rawMaterialId ||
        i.packingMaterialId ||
        i.finishedProductId ||
        (i.itemName ? i.itemName.trim().toLowerCase() : i.id);

      const totalReturnedForMat = returnItems
        .filter((pri: any) =>
          (i.rawMaterialId && pri.rawMaterialId === i.rawMaterialId) ||
          (i.packingMaterialId && pri.packingMaterialId === i.packingMaterialId) ||
          (i.finishedProductId && pri.finishedProductId === i.finishedProductId) ||
          (pri.itemName && i.itemName && pri.itemName.trim().toLowerCase() === i.itemName.trim().toLowerCase()),
        )
        .reduce((s: number, pri: any) => s + Number(pri.quantity || 0), 0);

      const alreadyConsumed = consumedReturns.get(matKey) || 0;
      const unconsumedReturn = Math.max(0, totalReturnedForMat - alreadyConsumed);

      const origQty = Number(i.quantity);
      const returnedForThisLine = Math.min(origQty, unconsumedReturn);
      consumedReturns.set(matKey, alreadyConsumed + returnedForThisLine);

      const remQty = Math.max(0, origQty - returnedForThisLine);
      const unitRate = Number(i.rate);

      return {
        ...i,
        warehouseId: itemWarehouseId,
        originalQuantity: origQty,
        quantity: remQty, // Deducted active quantity
        returnedQuantity: returnedForThisLine,
        remainingQuantity: remQty,
        rate: unitRate,
        grossAmount: remQty * unitRate,
        discountAmount: Number(i.discountAmount || 0),
        taxAmount: Number(i.taxAmount || 0),
        netAmount: remQty * unitRate, // Deducted active net amount
        originalNetAmount: Number(i.netAmount),
      };
    });

    const originalNetAmount = Number(p.netAmount);
    const activeNetAmount = Math.max(0, originalNetAmount - totalReturnedAmount);

    let postingStatus = p.postingStatus;
    if (p.postingStatus === 'POSTED' || p.postingStatus === 'PARTIALLY_RETURNED' || p.postingStatus === 'RETURNED') {
      if (totalReturnedAmount >= originalNetAmount - 0.01 && originalNetAmount > 0) {
        postingStatus = 'RETURNED';
      } else if (totalReturnedAmount > 0) {
        postingStatus = 'PARTIALLY_RETURNED';
      }
    }

    return {
      ...p,
      originalNetAmount,
      totalReturnedAmount,
      activeNetAmount,
      netAmount: activeNetAmount, // Deducted active amount returned to client
      grossAmount: Number(p.grossAmount),
      discountAmount: Number(p.discountAmount),
      taxAmount: Number(p.taxAmount),
      postingStatus,
      items,
    };
  }
}
