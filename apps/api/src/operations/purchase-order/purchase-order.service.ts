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
    packing?: string;
    unit?: string;
    quantity: number;
    unitRate: number;
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

    const code =
      params.code ||
      `VEND-${cleanName.replace(/[^A-Za-z0-9]/g, '').slice(0, 5).toUpperCase() || 'VEND'}-${Math.floor(100 + Math.random() * 900)}`;

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
    params: { itemName: string; materialType?: 'RAW_MATERIAL' | 'PACKING_MATERIAL'; packing?: string; unit?: string; purchaseRate?: number },
    user: AuthUser,
  ) {
    const companyId = user.companyId;
    const organizationId = user.organizationId;
    if (!companyId || !organizationId) throw new BadRequestException('Organization and Company context required');

    const cleanName = params.itemName.trim();
    const matType = params.materialType || 'RAW_MATERIAL';

    if (matType === 'PACKING_MATERIAL') {
      const existing = await this.prisma.packingMaterial.findFirst({
        where: { companyId, materialName: { equals: cleanName, mode: 'insensitive' } },
      });
      if (existing) return existing;

      const code = `PM-${cleanName.replace(/[^A-Za-z0-9]/g, '').slice(0, 5).toUpperCase() || 'PACK'}-${Math.floor(100 + Math.random() * 900)}`;
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

    const code = `RM-${cleanName.replace(/[^A-Za-z0-9]/g, '').slice(0, 5).toUpperCase() || 'RAW'}-${Math.floor(100 + Math.random() * 900)}`;
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

    const itemsData = await Promise.all(
      dto.items.map(async (item) => {
        let materialId = item.materialId || null;
        const materialType = item.materialType || 'RAW_MATERIAL';
        const cleanName = item.itemName.trim();

        // If materialId not already linked, auto-match or auto-create in Master Data
        if (!materialId && cleanName) {
          if (materialType === 'PACKING_MATERIAL') {
            let pm = await this.prisma.packingMaterial.findFirst({
              where: { companyId, materialName: { equals: cleanName, mode: 'insensitive' } },
            });
            if (!pm) {
              const code = `PM-${cleanName.replace(/[^A-Za-z0-9]/g, '').slice(0, 5).toUpperCase() || 'PACK'}-${Math.floor(100 + Math.random() * 900)}`;
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
            materialId = pm.id;
          } else {
            let rm = await this.prisma.rawMaterial.findFirst({
              where: { companyId, materialName: { equals: cleanName, mode: 'insensitive' } },
            });
            if (!rm) {
              const code = `RM-${cleanName.replace(/[^A-Za-z0-9]/g, '').slice(0, 5).toUpperCase() || 'RAW'}-${Math.floor(100 + Math.random() * 900)}`;
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
            materialId = rm.id;
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
          materialNameSnapshot: item.itemName,
          specificationSnapshot: item.packing ? `Packing: ${item.packing}` : null,
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
