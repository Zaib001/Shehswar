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
import { uuidv7 } from '@shehswar/shared';
import { AuthUser } from '@shehswar/types';

export interface CreateOperationalPoDto {
  poNumber?: string;
  poDate?: string;
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
      orderBy: { createdAt: 'desc' },
    });

    return pos.map((po) => ({
      ...po,
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
    const creationDate = dto.poDate ? new Date(dto.poDate) : new Date();

    const itemsData = await Promise.all(
      dto.items.map(async (item: any) => {
        let materialId = item.materialId || item.rawMaterialId || item.packingMaterialId || item.finishedProductId || null;
        const materialType = item.materialType || 'RAW_MATERIAL';
        const cleanName = (item.itemName || '').trim();
        let materialCodeSnapshot = item.materialCodeSnapshot || null;

        // Auto-match or link with master database
        if (materialType === 'FINISHED_PRODUCT') {
          let fp = materialId
            ? await this.prisma.finishedProduct.findUnique({ where: { id: materialId } })
            : null;
          if (!fp && cleanName) {
            fp = await this.prisma.finishedProduct.findFirst({
              where: { companyId, productName: { equals: cleanName, mode: 'insensitive' } },
            });
          }
          if (fp) {
            materialId = fp.id;
            materialCodeSnapshot = fp.productCode;
          }
        } else if (materialType === 'PACKING_MATERIAL') {
          let pm = materialId
            ? await this.prisma.packingMaterial.findUnique({ where: { id: materialId } })
            : null;
          if (!pm && cleanName) {
            pm = await this.prisma.packingMaterial.findFirst({
              where: { companyId, materialName: { equals: cleanName, mode: 'insensitive' } },
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
              });
            }
          }
          if (pm) {
            materialId = pm.id;
            materialCodeSnapshot = pm.materialCode;
            if (Number(item.unitRate) > 0) {
              await this.prisma.packingMaterial.update({
                where: { id: pm.id },
                data: { lastPurchaseCost: Number(item.unitRate) },
              }).catch(() => null);
            }
          }
        } else if (materialType === 'FINISHED_PRODUCT') {
          let fp = materialId
            ? await this.prisma.finishedProduct.findUnique({ where: { id: materialId } })
            : null;
          if (!fp && cleanName) {
            fp = await this.prisma.finishedProduct.findFirst({
              where: { companyId, productName: { equals: cleanName, mode: 'insensitive' } },
            });
          }
          if (fp) {
            materialId = fp.id;
            materialCodeSnapshot = fp.productCode;
            if (Number(item.unitRate) > 0) {
              await this.prisma.finishedProduct.update({
                where: { id: fp.id },
                data: { standardCost: Number(item.unitRate) },
              }).catch(() => null);
            }
          }
        } else if (materialType === 'OTHER' || materialType === 'OTHER_PRODUCT') {
          // Check if materialId is in rawMaterial or packingMaterial
          let othRm = materialId ? await this.prisma.rawMaterial.findUnique({ where: { id: materialId } }) : null;
          let othPm = (!othRm && materialId) ? await this.prisma.packingMaterial.findUnique({ where: { id: materialId } }) : null;

          if (!othRm && !othPm && cleanName) {
            othRm = await this.prisma.rawMaterial.findFirst({
              where: { companyId, materialName: { equals: cleanName, mode: 'insensitive' } },
            });
            if (!othRm) {
              othPm = await this.prisma.packingMaterial.findFirst({
                where: { companyId, materialName: { equals: cleanName, mode: 'insensitive' } },
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
              });
            }
          }
          if (othRm) {
            materialId = othRm.id;
            materialCodeSnapshot = othRm.materialCode;
            if (Number(item.unitRate) > 0) {
              await this.prisma.rawMaterial.update({
                where: { id: othRm.id },
                data: { lastPurchaseCost: Number(item.unitRate) },
              }).catch(() => null);
            }
          } else if (othPm) {
            materialId = othPm.id;
            materialCodeSnapshot = othPm.materialCode;
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
            ? await this.prisma.rawMaterial.findUnique({ where: { id: materialId } })
            : null;
          if (!rm && cleanName) {
            rm = await this.prisma.rawMaterial.findFirst({
              where: { companyId, materialName: { equals: cleanName, mode: 'insensitive' } },
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
              });
            }
          }
          if (rm) {
            materialId = rm.id;
            materialCodeSnapshot = rm.materialCode;
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

        return {
          id: uuidv7(),
          materialId,
          materialType,
          itemName: item.itemName,
          category: materialType,
          unit: item.unit || 'KG',
          quantity: qty,
          unitRate: rate,
          discountAmount: disc,
          taxAmount: tax,
          lineTotal: line,
          materialCodeSnapshot,
          materialNameSnapshot: item.itemName,
          specificationSnapshot: item.packing
            ? item.packing
            : item.packSize && item.numberOfPacks
            ? `Packs: ${item.numberOfPacks} × ${item.packSize} (${qty} ${item.unit || 'KG'})`
            : item.packSize
            ? `Pack Size: ${item.packSize}`
            : null,
          createdAt: creationDate,
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
        vendorId: dto.vendorId,
        warehouseId: dto.warehouseId || null,
        deliveryLocation: dto.deliveryLocation || null,
        paymentTerms: dto.paymentTerms || '30_DAYS_CREDIT',
        expectedDeliveryDate: dto.expectedDeliveryDate ? new Date(dto.expectedDeliveryDate) : null,
        subtotal,
        taxAmount: taxTotal,
        discountAmount: discountTotal,
        totalAmount,
        status: dto.status || 'CONFIRMED',
        notes: finalNotes || null,
        createdAt: creationDate,
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
