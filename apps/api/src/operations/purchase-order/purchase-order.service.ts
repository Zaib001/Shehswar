/**
 * SHEHSWAR ONE360 - Operational Purchase Order Service
 *
 * Implements the client's canonical flow:
 *  - Primary: Upload PO -> OCR -> Review -> Structured Database Save
 *  - Secondary: Manual entry -> Structured Database Save
 *  - Statuses: DRAFT, CONFIRMED, CONVERTED_TO_PURCHASE, CANCELLED
 *  - Does NOT affect stock or ledgers until converted into an actual Purchase!
 */
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { DocumentNumberingService } from '../../platform/document-numbering/document-numbering.service';
import { CodeGenerationService } from '../../platform/code-generation/code-generation.service';
import { InventoryService } from '../inventory/inventory.service';
import { VendorLedgerService } from '../ledger/vendor-ledger.service';
import { uuidv7 } from '@shehswar/shared';
import { AuthUser } from '@shehswar/types';

/**
 * Standard clean pack size helper:
 * Extracts only the actual commercial pack size (e.g. "200 LTR", "25 KG", "1 LTR").
 * Strips multipliers, "(qty...)", and "/ Bulk" junk.
 */
export function cleanPackSize(raw?: string | null, fallbackUnit = 'KG'): string {
  if (!raw) return `1 ${fallbackUnit}`.trim();
  let s = String(raw).trim();
  if (!s || s === '—' || s === '-') return `1 ${fallbackUnit}`.trim();

  // Strip "Pack Size:" or "Packs:" or "Pack:" prefix
  s = s.replace(/^(?:Packs?|Pack\s*Size)\s*:\s*/i, '').trim();

  // Strip trailing parenthesized info like "(250 KG)" or "(qty...)"
  s = s.replace(/\s*\([^)]*\)\s*$/, '').trim();

  // Strip "/ Bulk" or "/Bulk" or "Bulk /"
  s = s.replace(/\s*\/\s*Bulk/i, '').replace(/Bulk\s*\/\s*/i, '').trim();

  // If expression has multipliers (e.g. "20 × 10 × 200 LTR" or "10 * 25 KG" or "10 x 25 KG")
  if (/[×*]|(?:\s+[xX]\s+)/.test(s)) {
    const parts = s.split(/[×*]|(?:\s+[xX]\s+)/);
    const lastPart = parts[parts.length - 1].trim();
    if (lastPart) {
      s = lastPart;
    }
  }

  // If it's literally "Bulk" or "Item" or "Unit"
  if (/^(?:Bulk|Item|Unit)$/i.test(s)) {
    return `1 ${fallbackUnit}`.trim();
  }

  // Normalize spacing between number and unit (e.g. "25KG" -> "25 KG", "200LTR" -> "200 LTR")
  const numUnitMatch = s.match(/^([\d.]+)\s*([a-zA-Z%]+)$/);
  if (numUnitMatch) {
    return `${parseFloat(numUnitMatch[1])} ${numUnitMatch[2].toUpperCase()}`.trim();
  }

  return s;
}

/**
 * Timezone-safe calendar date parser:
 * Parses YYYY-MM-DD into a UTC midday timestamp so it never crosses
 * date boundaries regardless of local timezone.
 */
export function parseDateOnly(val?: string | Date | null): Date {
  if (!val) return new Date();
  if (val instanceof Date) return val;
  const s = String(val).trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) {
    const year = parseInt(m[1], 10);
    const month = parseInt(m[2], 10) - 1;
    const day = parseInt(m[3], 10);
    return new Date(Date.UTC(year, month, day, 12, 0, 0));
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? new Date() : d;
}

export interface CreateOperationalPoDto {
  poNumber?: string;
  poDate?: string;
  orderDate?: string;
  companyId?: string;
  vendorId: string;
  warehouseId?: string;
  deliveryLocation?: string;
  paymentTerms?: string;
  expectedDeliveryDate?: string;
  notes?: string;
  extraFields?: Record<string, any>;
  items: Array<{
    materialId?: string;
    materialType?: string;
    itemName: string;
    packSize?: string;
    numberOfPacks?: number;
    packing?: string;
    unit?: string;
    quantity: number;
    unitRate: number;
    totalPurchaseAmount?: number;
    costPerPack?: number;
    discountAmount?: number;
    taxAmount?: number;
    lineTotal?: number;
  }>;
  status?: string;
}

@Injectable()
export class OperationalPoService {
  private readonly logger = new Logger(OperationalPoService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly documentNumbering: DocumentNumberingService,
    private readonly codeGen: CodeGenerationService,
    private readonly inventoryService: InventoryService,
    private readonly vendorLedger: VendorLedgerService,
  ) {}

  async findAll(companyId?: string, filters?: { status?: string; vendorId?: string; search?: string }) {
    const where: any = {};
    if (companyId) where.companyId = companyId;
    if (filters?.status) where.status = filters.status;
    if (filters?.vendorId) where.vendorId = filters.vendorId;
    if (filters?.search) {
      where.OR = [
        { poNumber: { contains: filters.search, mode: 'insensitive' } },
        { vendor: { name: { contains: filters.search, mode: 'insensitive' } } },
      ];
    }

    const pos = await this.prisma.purchaseOrder.findMany({
      where,
      include: {
        vendor: { select: { id: true, name: true, code: true } },
        warehouse: { select: { id: true, name: true, code: true } },
        items: true,
      },
      orderBy: [{ orderDate: 'desc' }, { createdAt: 'desc' }],
    });

    return pos.map((po) => ({
      ...po,
      orderDate: po.orderDate || po.createdAt,
      poDate: po.orderDate ? po.orderDate.toISOString().slice(0, 10) : po.createdAt.toISOString().slice(0, 10),
      subtotal: Number(po.subtotal),
      taxAmount: Number(po.taxAmount),
      discountAmount: Number(po.discountAmount),
      totalAmount: Number(po.totalAmount),
      items: po.items.map((i) => ({
        ...i,
        packSize: cleanPackSize(i.specificationSnapshot, i.unit),
        specificationSnapshot: cleanPackSize(i.specificationSnapshot, i.unit),
        quantity: Number(i.quantity),
        unitRate: Number(i.unitRate),
        lineTotal: Number(i.lineTotal),
        taxAmount: Number(i.taxAmount),
        discountAmount: Number(i.discountAmount),
      })),
    }));
  }

  async findOne(id: string, companyId: string) {
    const po = await this.prisma.purchaseOrder.findFirst({
      where: { id, companyId },
      include: {
        vendor: true,
        warehouse: true,
        items: true,
      },
    });
    if (!po) throw new NotFoundException('Purchase Order not found');

    return {
      ...po,
      orderDate: po.orderDate || po.createdAt,
      poDate: po.orderDate ? po.orderDate.toISOString().slice(0, 10) : po.createdAt.toISOString().slice(0, 10),
      subtotal: Number(po.subtotal),
      taxAmount: Number(po.taxAmount),
      discountAmount: Number(po.discountAmount),
      totalAmount: Number(po.totalAmount),
      items: po.items.map((i) => ({
        ...i,
        packSize: cleanPackSize(i.specificationSnapshot, i.unit),
        specificationSnapshot: cleanPackSize(i.specificationSnapshot, i.unit),
        quantity: Number(i.quantity),
        unitRate: Number(i.unitRate),
        lineTotal: Number(i.lineTotal),
        taxAmount: Number(i.taxAmount),
        discountAmount: Number(i.discountAmount),
      })),
    };
      subtotal: Number(po.subtotal),
      taxAmount: Number(po.taxAmount),
      discountAmount: Number(po.discountAmount),
      totalAmount: Number(po.totalAmount),
      items: po.items.map((i) => ({
        ...i,
        quantity: Number(i.quantity),
        unitRate: Number(i.unitRate),
        lineTotal: Number(i.lineTotal),
        taxAmount: Number(i.taxAmount),
        discountAmount: Number(i.discountAmount),
      })),
    };
  }

  async getNextPoNumber(companyId: string, orgId?: string): Promise<string> {
    let organizationId = orgId;
    if (!organizationId) {
      const company = await this.prisma.company.findUnique({
        where: { id: companyId },
        select: { organizationId: true },
      });
      organizationId = company?.organizationId;
    }
    if (!organizationId) throw new BadRequestException('Organization context required');

    return this.documentNumbering.getNextDocumentNumber({
      organizationId,
      companyId,
      documentType: 'PO',
      prefixOverride: `PO-${new Date().getFullYear()}`,
    });
  }

  async quickCreateVendor(
    params: { name: string; code?: string; vendorType?: string; phone?: string; email?: string; address?: string },
    user: AuthUser,
  ) {
    const companyId = user.companyId;
    const organizationId = user.organizationId;
    if (!companyId || !organizationId) throw new BadRequestException('Organization and Company context required');

    const cleanName = params.name.trim();
    const existing = await this.prisma.vendor.findFirst({
      where: { companyId, name: { equals: cleanName, mode: 'insensitive' } },
    });
    if (existing) return existing;

    let code = (params.code || '').trim().toUpperCase();
    if (!code || code === 'AUTO') {
      code = await this.codeGen.generateCode({
        companyId,
        organizationId,
        entityType: 'VENDOR',
      });
    }

    const newVendor = await this.prisma.vendor.create({
      data: {
        id: uuidv7(),
        organizationId,
        companyId,
        code,
        name: cleanName,
        vendorType: (params.vendorType as any) || 'RAW_MATERIAL',
        status: 'APPROVED',
        currency: 'PKR',
        paymentTerms: '30_DAYS_CREDIT',
        phone: params.phone || null,
        email: params.email || null,
        address: params.address || null,
      },
    });

    this.logger.log(`Vendor quick-created: ${newVendor.name} (${newVendor.code})`);
    return newVendor;
  }

  async quickCreateMaterial(
    params: { itemName: string; materialType?: 'RAW_MATERIAL' | 'PACKING_MATERIAL' | 'OTHER' | 'FINISHED_PRODUCT'; packing?: string; unit?: string; purchaseRate?: number },
    user: AuthUser,
  ) {
    const companyId = user.companyId;
    const organizationId = user.organizationId;
    if (!companyId || !organizationId) throw new BadRequestException('Organization and Company context required');

    const cleanName = params.itemName.trim();
    const matType = params.materialType || 'RAW_MATERIAL';

    if (matType === 'OTHER') {
      const othersCat = await this.prisma.materialCategory.findFirst({
        where: { OR: [{ code: '41-87' }, { name: { contains: 'Other', mode: 'insensitive' } }] },
      });
      const existing = await this.prisma.rawMaterial.findFirst({
        where: { companyId, materialName: { equals: cleanName, mode: 'insensitive' } },
      });
      if (existing) return existing;

      const code = await this.codeGen.generateCode({
        companyId,
        organizationId,
        entityType: 'RAW_MATERIAL',
      });
      const rm = await this.prisma.rawMaterial.create({
        data: {
          id: uuidv7(),
          organizationId,
          companyId,
          categoryId: othersCat?.id || undefined,
          materialCode: code,
          materialName: cleanName,
          status: 'ACTIVE',
          approvalStatus: 'APPROVED',
          lastPurchaseCost: Number(params.purchaseRate) || undefined,
          standardCost: Number(params.purchaseRate) || undefined,
          specifications: params.packing || undefined,
        },
      });
      this.logger.log(`Other material quick-created: ${rm.materialName} (${rm.materialCode})`);
      return rm;
    }

    if (matType === 'PACKING_MATERIAL') {
      const existing = await this.prisma.packingMaterial.findFirst({
        where: { companyId, materialName: { equals: cleanName, mode: 'insensitive' } },
      });
      if (existing) return existing;

      const code = await this.codeGen.generateCode({
        companyId,
        organizationId,
        entityType: 'PACKING_MATERIAL',
      });
      const pm = await this.prisma.packingMaterial.create({
        data: {
          id: uuidv7(),
          organizationId,
          companyId,
          materialCode: code,
          materialName: cleanName,
          status: 'ACTIVE',
          lastPurchaseCost: Number(params.purchaseRate) || undefined,
          standardCost: Number(params.purchaseRate) || undefined,
          description: params.packing || undefined,
        },
      });
      this.logger.log(`Packing material quick-created: ${pm.materialName} (${pm.materialCode})`);
      return pm;
    }

    const existing = await this.prisma.rawMaterial.findFirst({
      where: { companyId, materialName: { equals: cleanName, mode: 'insensitive' } },
    });
    if (existing) return existing;

    const code = await this.codeGen.generateCode({
      companyId,
      organizationId,
      entityType: 'RAW_MATERIAL',
    });
    const rm = await this.prisma.rawMaterial.create({
      data: {
        id: uuidv7(),
        organizationId,
        companyId,
        materialCode: code,
        materialName: cleanName,
        status: 'ACTIVE',
        approvalStatus: 'APPROVED',
        lastPurchaseCost: Number(params.purchaseRate) || undefined,
        standardCost: Number(params.purchaseRate) || undefined,
        specifications: params.packing || undefined,
      },
    });
    this.logger.log(`Raw material quick-created: ${rm.materialName} (${rm.materialCode})`);
    return rm;
  }

  async create(dto: CreateOperationalPoDto, user: AuthUser) {
    const companyId = dto.companyId || user.companyId;
    if (!companyId) throw new BadRequestException('Company ID is required');

    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { organizationId: true },
    });
    if (!company) throw new NotFoundException('Company not found');

    // Auto-generate sequential PO Number if not explicitly provided or if temporary placeholder
    const isAutoNumber = !dto.poNumber || dto.poNumber.trim() === '' || dto.poNumber === 'AUTO' || dto.poNumber.startsWith('PO-TEMP');
    const poNumber = isAutoNumber
      ? await this.documentNumbering.getNextDocumentNumber({
          organizationId: company.organizationId,
          companyId,
          documentType: 'PO',
          prefixOverride: `PO-${new Date().getFullYear()}`,
        })
      : dto.poNumber!;

    // Calculate totals and ensure materials are saved in master database
    let subtotal = 0;
    let taxTotal = 0;
    let discountTotal = 0;
    const rawPoDate = dto.poDate || dto.orderDate;
    const orderDate = rawPoDate ? parseDateOnly(rawPoDate) : new Date();
    const createdAt = new Date(); // Document creation audit timestamp

    const itemsData = await Promise.all(
      dto.items.map(async (item: any) => {
        let materialId = item.materialId || item.rawMaterialId || item.packingMaterialId || item.finishedProductId || null;
        const materialType = item.materialType || 'RAW_MATERIAL';
        const cleanName = (item.itemName || '').trim();
        let materialCodeSnapshot = item.materialCodeSnapshot || null;
        let resolvedUnit = item.unit ? String(item.unit).trim() : '';
        let resolvedPackSize = item.packSize ? String(item.packSize).trim() : '';

        // Auto-match or link with master database
        if (materialType === 'FINISHED_PRODUCT') {
          let fp = materialId
            ? await this.prisma.finishedProduct.findUnique({
                where: { id: materialId },
                include: { baseUom: true, salesUom: true, packSize: true },
              })
            : null;
          if (!fp && cleanName) {
            fp = await this.prisma.finishedProduct.findFirst({
              where: { companyId, productName: { equals: cleanName, mode: 'insensitive' } },
              include: { baseUom: true, salesUom: true, packSize: true },
            });
          }
          if (fp) {
            materialId = fp.id;
            materialCodeSnapshot = fp.productCode;
            const masterUnit = fp.salesUom?.symbol || fp.baseUom?.symbol || fp.packingUnit;
            if (!resolvedUnit || resolvedUnit === 'KG') {
              resolvedUnit = masterUnit || resolvedUnit || 'Units';
            }
            if (!resolvedPackSize) {
              resolvedPackSize = fp.packSize?.name || (fp.packingQuantity ? `${Number(fp.packingQuantity)} ${fp.packingUnit || resolvedUnit}` : '');
            }
            if (Number(item.unitRate) > 0) {
              await this.prisma.finishedProduct.update({
                where: { id: fp.id },
                data: { standardCost: Number(item.unitRate) },
              }).catch(() => null);
            }
          }
        } else if (materialType === 'PACKING_MATERIAL') {
          let pm = materialId
            ? await this.prisma.packingMaterial.findUnique({
                where: { id: materialId },
                include: { baseUom: true },
              })
            : null;
          if (!pm && cleanName) {
            pm = await this.prisma.packingMaterial.findFirst({
              where: { companyId, materialName: { equals: cleanName, mode: 'insensitive' } },
              include: { baseUom: true },
            });
            if (!pm) {
              const code = await this.codeGen.generateCode({
                companyId,
                organizationId: company.organizationId,
                entityType: 'PACKING_MATERIAL',
              });
              pm = await this.prisma.packingMaterial.create({
                data: {
                  id: uuidv7(),
                  organizationId: company.organizationId,
                  companyId,
                  materialCode: code,
                  materialName: cleanName,
                  status: 'ACTIVE',
                  lastPurchaseCost: Number(item.unitRate) || undefined,
                  standardCost: Number(item.unitRate) || undefined,
                  description: item.packing || undefined,
                },
                include: { baseUom: true },
              });
            }
          }
          if (pm) {
            materialId = pm.id;
            materialCodeSnapshot = pm.materialCode;
            const masterUnit = pm.baseUom?.symbol || pm.baseUom?.code;
            if (!resolvedUnit || resolvedUnit === 'KG') {
              resolvedUnit = masterUnit || resolvedUnit || 'PCS';
            }
            if (!resolvedPackSize) {
              resolvedPackSize = pm.packCompatibility || pm.description || '';
            }
            if (Number(item.unitRate) > 0) {
              await this.prisma.packingMaterial.update({
                where: { id: pm.id },
                data: { lastPurchaseCost: Number(item.unitRate) },
              }).catch(() => null);
            }
          }
        } else if (materialType === 'OTHER' || materialType === 'OTHER_PRODUCT') {
          // Check if materialId is in rawMaterial or packingMaterial
          let othRm = materialId ? await this.prisma.rawMaterial.findUnique({ where: { id: materialId }, include: { baseUom: true } }) : null;
          let othPm = (!othRm && materialId) ? await this.prisma.packingMaterial.findUnique({ where: { id: materialId }, include: { baseUom: true } }) : null;

          if (!othRm && !othPm && cleanName) {
            othRm = await this.prisma.rawMaterial.findFirst({
              where: { companyId, materialName: { equals: cleanName, mode: 'insensitive' } },
              include: { baseUom: true },
            });
            if (!othRm) {
              othPm = await this.prisma.packingMaterial.findFirst({
                where: { companyId, materialName: { equals: cleanName, mode: 'insensitive' } },
                include: { baseUom: true },
              });
            }
            if (!othRm && !othPm) {
              const othersCat = await this.prisma.materialCategory.findFirst({
                where: { OR: [{ code: '41-87' }, { name: { contains: 'Other', mode: 'insensitive' } }] },
              });
              const code = await this.codeGen.generateCode({
                companyId,
                organizationId: company.organizationId,
                entityType: 'RAW_MATERIAL',
              });
              othRm = await this.prisma.rawMaterial.create({
                data: {
                  id: uuidv7(),
                  organizationId: company.organizationId,
                  companyId,
                  categoryId: othersCat?.id || undefined,
                  materialCode: code,
                  materialName: cleanName,
                  status: 'ACTIVE',
                  approvalStatus: 'APPROVED',
                  lastPurchaseCost: Number(item.unitRate) || undefined,
                  standardCost: Number(item.unitRate) || undefined,
                  specifications: item.packing || (item.packSize ? `Pack Size: ${item.packSize}` : undefined),
                },
                include: { baseUom: true },
              });
            }
          }
          if (othRm) {
            materialId = othRm.id;
            materialCodeSnapshot = othRm.materialCode;
            const masterUnit = othRm.baseUom?.symbol || othRm.baseUom?.code;
            if (!resolvedUnit) resolvedUnit = masterUnit || 'Unit';
            if (!resolvedPackSize) resolvedPackSize = othRm.specifications || '';
            if (Number(item.unitRate) > 0) {
              await this.prisma.rawMaterial.update({
                where: { id: othRm.id },
                data: { lastPurchaseCost: Number(item.unitRate) },
              }).catch(() => null);
            }
          } else if (othPm) {
            materialId = othPm.id;
            materialCodeSnapshot = othPm.materialCode;
            const masterUnit = othPm.baseUom?.symbol || othPm.baseUom?.code;
            if (!resolvedUnit) resolvedUnit = masterUnit || 'Unit';
            if (!resolvedPackSize) resolvedPackSize = othPm.description || '';
            if (Number(item.unitRate) > 0) {
              await this.prisma.packingMaterial.update({
                where: { id: othPm.id },
                data: { lastPurchaseCost: Number(item.unitRate) },
              }).catch(() => null);
            }
          }
        } else {
          // RAW_MATERIAL
          let rm = materialId
            ? await this.prisma.rawMaterial.findUnique({
                where: { id: materialId },
                include: { baseUom: true },
              })
            : null;
          if (!rm && cleanName) {
            rm = await this.prisma.rawMaterial.findFirst({
              where: { companyId, materialName: { equals: cleanName, mode: 'insensitive' } },
              include: { baseUom: true },
            });
            if (!rm) {
              const code = await this.codeGen.generateCode({
                companyId,
                organizationId: company.organizationId,
                entityType: 'RAW_MATERIAL',
              });
              rm = await this.prisma.rawMaterial.create({
                data: {
                  id: uuidv7(),
                  organizationId: company.organizationId,
                  companyId,
                  materialCode: code,
                  materialName: cleanName,
                  status: 'ACTIVE',
                  approvalStatus: 'APPROVED',
                  lastPurchaseCost: Number(item.unitRate) || undefined,
                  standardCost: Number(item.unitRate) || undefined,
                  specifications: item.packing || undefined,
                },
                include: { baseUom: true },
              });
            }
          }
          if (rm) {
            materialId = rm.id;
            materialCodeSnapshot = rm.materialCode;
            const masterUnit = rm.baseUom?.symbol || rm.baseUom?.code;
            if (!resolvedUnit) {
              resolvedUnit = masterUnit || 'KG';
            } else if (masterUnit && (resolvedUnit === 'KG' || resolvedUnit === 'Bulk') && masterUnit !== 'KG') {
              resolvedUnit = masterUnit;
            }
            if (!resolvedPackSize) {
              resolvedPackSize = rm.specifications || (rm.purchaseConversionFactor && Number(rm.purchaseConversionFactor) > 0 ? `${Number(rm.purchaseConversionFactor)} ${resolvedUnit}` : '');
            }
            if (Number(item.unitRate) > 0) {
              await this.prisma.rawMaterial.update({
                where: { id: rm.id },
                data: { lastPurchaseCost: Number(item.unitRate) },
              }).catch(() => null);
            }
          }
        }

        const qty = Number(item.quantity) || 1;
        const rate = Number(item.unitRate) || 0;
        const gross = qty * rate;
        const disc = Number(item.discountAmount) || 0;
        const tax = Number(item.taxAmount) || 0;
        const line = gross + tax - disc;

        subtotal += gross;
        taxTotal += tax;
        discountTotal += disc;

        resolvedUnit = (resolvedUnit || item.unit || 'KG').trim();
        const commercialPackSize = cleanPackSize(resolvedPackSize || item.packSize || item.packing, resolvedUnit);

        return {
          id: uuidv7(),
          materialId,
          materialType,
          itemName: item.itemName,
          category: materialType,
          unit: resolvedUnit,
          quantity: qty,
          unitRate: rate,
          discountAmount: disc,
          taxAmount: tax,
          lineTotal: line,
          materialCodeSnapshot,
          materialNameSnapshot: item.itemName,
          uomCodeSnapshot: resolvedUnit,
          specificationSnapshot: commercialPackSize,
          createdAt: orderDate,
        };
      }),
    );

    const totalAmount = subtotal + taxTotal - discountTotal;

    // Serialize dynamic extraFields into notes so no vendor properties are lost
    let finalNotes = dto.notes || '';
    if (dto.extraFields && Object.keys(dto.extraFields).length > 0) {
      const extraSummary = Object.entries(dto.extraFields)
        .map(([k, v]) => `${k}: ${v}`)
        .join(' | ');
      if (!finalNotes.includes('[Properties]')) {
        finalNotes = finalNotes ? `${finalNotes}\n[Properties] ${extraSummary}` : `[Properties] ${extraSummary}`;
      }
    }

    const po = await this.prisma.purchaseOrder.create({
      data: {
        id: uuidv7(),
        organizationId: company.organizationId,
        companyId,
        poNumber,
        orderDate,
        vendorId: dto.vendorId,
        warehouseId: dto.warehouseId || null,
        deliveryLocation: dto.deliveryLocation || null,
        paymentTerms: dto.paymentTerms || '30_DAYS_CREDIT',
        expectedDeliveryDate: dto.expectedDeliveryDate ? parseDateOnly(dto.expectedDeliveryDate) : null,
        subtotal,
        taxAmount: taxTotal,
        discountAmount: discountTotal,
        totalAmount,
        status: dto.status || 'CONFIRMED',
        notes: finalNotes || null,
        createdAt,
        createdById: user.id || null,
        items: {
          create: itemsData,
        },
      },
      include: {
        vendor: { select: { id: true, name: true, code: true } },
        warehouse: { select: { id: true, name: true, code: true } },
        items: true,
      },
    });

    this.logger.log(`Purchase Order ${po.poNumber} created structurally in DB`);

    // Automatically receive items into warehouse inventory if confirmed with warehouse
    if (po.warehouseId && (po.status === 'CONFIRMED' || !dto.status)) {
      for (const item of po.items) {
        if (Number(item.quantity) > 0) {
          let rawMaterialId: string | undefined = undefined;
          let packingMaterialId: string | undefined = undefined;
          let finishedProductId: string | undefined = undefined;

          if (item.materialType === 'RAW_MATERIAL') {
            rawMaterialId = item.materialId ?? undefined;
          } else if (item.materialType === 'PACKING_MATERIAL') {
            packingMaterialId = item.materialId ?? undefined;
          } else if (item.materialType === 'FINISHED_PRODUCT') {
            finishedProductId = item.materialId ?? undefined;
          } else {
            // OTHER or other product types
            if (item.materialId) {
              const [isRm, isPm, isFp] = await Promise.all([
                this.prisma.rawMaterial.findUnique({ where: { id: item.materialId }, select: { id: true } }),
                this.prisma.packingMaterial.findUnique({ where: { id: item.materialId }, select: { id: true } }),
                this.prisma.finishedProduct.findUnique({ where: { id: item.materialId }, select: { id: true } }),
              ]);
              if (isRm) rawMaterialId = isRm.id;
              else if (isPm) packingMaterialId = isPm.id;
              else if (isFp) finishedProductId = isFp.id;
            }
          }

          await this.inventoryService.applyMovement(this.prisma, {
            organizationId: po.organizationId,
            companyId: po.companyId,
            warehouseId: po.warehouseId,
            itemType: (item.materialType as any) || 'RAW_MATERIAL',
            rawMaterialId,
            packingMaterialId,
            finishedProductId,
            quantityChange: Number(item.quantity),
            unitCost: Number(item.unitRate) || 0,
            transactionType: 'PURCHASE',
            referenceId: po.id,
            referenceNumber: po.poNumber,
            notes: `Purchase Order receipt from ${po.vendor?.name || 'Vendor'}`,
          }).catch((err) => {
            this.logger.warn(`Could not apply inventory movement for PO item ${item.itemName}: ${err.message}`);
          });
        }
      }
    }

    // Automatically post to Vendor Ledger so PO is visible and traceable directly from Vendor Ledger (Final Acceptance Test & Req 1-3)
    if (po.vendorId && (po.status === 'CONFIRMED' || !dto.status)) {
      const netAmount = Number(po.totalAmount || 0);
      if (netAmount > 0) {
        await this.vendorLedger
          .postEntry(this.prisma as any, {
            organizationId: po.organizationId,
            companyId: po.companyId,
            vendorId: po.vendorId,
            entryType: 'PURCHASE_ORDER',
            referenceId: po.id,
            voucherNumber: po.poNumber,
            sourceType: 'PURCHASE_ORDER',
            sourceId: po.id,
            sourceNumber: po.poNumber,
            description: `Purchase Order ${po.poNumber} (${po.items?.length || 0} items)`,
            credit: netAmount,
            debit: 0,
            entryDate: (po as any).orderDate ? new Date((po as any).orderDate) : po.createdAt,
          })
          .catch((err) => {
            this.logger.warn(`Could not post PO ${po.poNumber} to Vendor Ledger: ${err.message}`);
          });
      }
    }

    return po;
  }

  async createBatch(dtos: CreateOperationalPoDto[], user: AuthUser) {
    if (!dtos || dtos.length === 0) throw new BadRequestException('At least one Purchase Order is required');
    const results = [];
    for (const dto of dtos) {
      const po = await this.create(dto, user);
      results.push(po);
    }
    return {
      success: true,
      count: results.length,
      purchaseOrders: results,
    };
  }

  async updateStatus(id: string, status: string, companyId: string) {
    const po = await this.prisma.purchaseOrder.findFirst({
      where: { id, companyId },
    });
    if (!po) throw new NotFoundException('Purchase Order not found');

    return this.prisma.purchaseOrder.update({
      where: { id },
      data: { status },
    });
  }

  async delete(id: string, companyId?: string) {
    const where: any = { id };
    if (companyId) where.companyId = companyId;

    const po = await this.prisma.purchaseOrder.findFirst({
      where,
      include: { items: true },
    });
    if (!po) throw new NotFoundException('Purchase Order not found');

    // Delete line items first, then PO record
    await this.prisma.purchaseOrderItem.deleteMany({
      where: { poId: id },
    });

    await this.prisma.purchaseOrder.delete({
      where: { id },
    });

    this.logger.log(`Purchase Order ${po.poNumber} (${id}) deleted successfully`);
    return { success: true, message: `Purchase Order ${po.poNumber} deleted successfully` };
  }
}
