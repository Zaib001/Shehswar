/**
 * SHEHSWAR ONE360 - Gate Pass Service
 * 
 * Manages Inward & Outward Gate Passes, linking them to:
 * - Purchase Invoices (Inward materials/goods)
 * - Sales Invoices (Outward dispatches to dealers)
 * - Transporters & Drivers
 */
import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { DocumentNumberingService } from '../../platform/document-numbering/document-numbering.service';
import { uuidv7 } from '@shehswar/shared';
import { AuthUser } from '@shehswar/types';

export interface CreateGatePassDto {
  organizationId?: string;
  companyId?: string;
  gatePassType: 'INWARD' | 'OUTWARD';
  vehicleNumber: string;
  driverName?: string;
  driverPhone?: string;
  transporter?: string;
  vendorId?: string;
  dealerId?: string;
  purchaseInvoiceId?: string;
  salesInvoiceId?: string;
  notes?: string;
  items: {
    description: string;
    quantity: number;
    uom?: string;
    notes?: string;
  }[];
}

@Injectable()
export class GatePassService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly documentNumbering: DocumentNumberingService,
  ) {}

  async findAll(
    companyId: string,
    filters?: {
      gatePassType?: string;
      status?: string;
      search?: string;
      limit?: number;
      offset?: number;
    },
  ) {
    const where: any = { companyId };
    if (filters?.gatePassType) where.passType = filters.gatePassType;
    if (filters?.status) where.status = filters.status;
    if (filters?.search) {
      where.OR = [
        { gatePassNumber: { contains: filters.search, mode: 'insensitive' } },
        { vehicleNo: { contains: filters.search, mode: 'insensitive' } },
        { driverName: { contains: filters.search, mode: 'insensitive' } },
        { transporter: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const [total, data] = await Promise.all([
      this.prisma.gatePass.count({ where }),
      this.prisma.gatePass.findMany({
        where,
        include: {
          vendor: { select: { id: true, name: true, code: true } },
          dealer: { select: { id: true, name: true, code: true } },
          items: true,
        },
        orderBy: { date: 'desc' },
        take: filters?.limit ?? 50,
        skip: filters?.offset ?? 0,
      }),
    ]);

    return { total, data };
  }

  async findOne(id: string, companyId: string) {
    const gatePass = await this.prisma.gatePass.findFirst({
      where: { id, companyId },
      include: {
        vendor: { select: { id: true, name: true, code: true } },
        dealer: { select: { id: true, name: true, code: true } },
        purchaseInvoice: { select: { id: true, voucherNumber: true } },
        salesInvoice: { select: { id: true, invoiceNumber: true } },
        items: true,
      },
    });

    if (!gatePass) throw new NotFoundException('Gate pass not found');
    return gatePass;
  }

  async create(dto: CreateGatePassDto, actor: AuthUser) {
    const organizationId = dto.organizationId || actor.organizationId;
    const companyId = dto.companyId || actor.companyId;

    const docType = dto.gatePassType === 'INWARD' ? 'GP_IN' : 'GP_OUT';
    const gatePassNumber = await this.documentNumbering.getNextDocumentNumber({
      organizationId,
      companyId,
      documentType: docType,
    });

    return this.prisma.gatePass.create({
      data: {
        id: uuidv7(),
        organizationId,
        companyId,
        gatePassNumber,
        passType: dto.gatePassType,
        vehicleNo: dto.vehicleNumber,
        driverName: dto.driverName ?? null,
        driverPhone: dto.driverPhone ?? null,
        transporter: dto.transporter ?? null,
        vendorId: dto.vendorId ?? null,
        dealerId: dto.dealerId ?? null,
        purchaseInvoiceId: dto.purchaseInvoiceId ?? null,
        salesInvoiceId: dto.salesInvoiceId ?? null,
        notes: dto.notes ?? null,
        status: 'VERIFIED',
        items: {
          create: dto.items.map((item) => ({
            id: uuidv7(),
            description: item.description,
            quantity: item.quantity,
            uom: item.uom ?? null,
            notes: item.notes ?? null,
          })),
        },
      },
      include: {
        items: true,
        vendor: { select: { id: true, name: true } },
        dealer: { select: { id: true, name: true } },
      },
    });
  }
}
