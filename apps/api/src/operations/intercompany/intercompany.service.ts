/**
 * SHEHSWAR ONE360 - Intercompany Transfer Service
 *
 * Implements the client's canonical Parent -> Child Company Flow:
 * ONE action creates:
 *  1. Parent Company: Sale Invoice + Warehouse Stock OUT (-)
 *  2. Child Company: Purchase Invoice + Warehouse Stock IN (+)
 *
 * Both records reference the same transaction ID (`INTERCOMPANY_TRANSFER`).
 * Perfectly atomic transaction.
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

export interface IntercompanyTransferDto {
  parentCompanyId: string;
  childCompanyId: string;
  finishedProductId: string;
  parentWarehouseId: string;
  childWarehouseId: string;
  quantity: number;
  transferCost: number; // Parent's internal transfer cost
  sellingPrice: number; // Transfer/selling price to child
  notes?: string;
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
   * Execute Parent Sale & Child Purchase simultaneously in one atomic transaction
   */
  async executeTransfer(dto: IntercompanyTransferDto, actor: AuthUser) {
    const {
      parentCompanyId,
      childCompanyId,
      finishedProductId,
      parentWarehouseId,
      childWarehouseId,
      quantity,
      sellingPrice,
      notes,
    } = dto;

    if (quantity <= 0) throw new BadRequestException('Quantity must be greater than zero');
    if (parentCompanyId === childCompanyId) throw new BadRequestException('Parent and Child company cannot be the same');

    // 1. Validate Parent and Child Companies
    const [parentCompany, childCompany, product, parentWarehouse, childWarehouse] = await Promise.all([
      this.prisma.company.findUnique({ where: { id: parentCompanyId } }),
      this.prisma.company.findUnique({ where: { id: childCompanyId } }),
      this.prisma.finishedProduct.findUnique({ where: { id: finishedProductId } }),
      this.prisma.warehouse.findUnique({ where: { id: parentWarehouseId } }),
      this.prisma.warehouse.findUnique({ where: { id: childWarehouseId } }),
    ]);

    if (!parentCompany) throw new NotFoundException('Parent company not found');
    if (!childCompany) throw new NotFoundException('Child company not found');
    if (!product) throw new NotFoundException('Finished product not found');
    if (!parentWarehouse) throw new NotFoundException('Parent warehouse not found');
    if (!childWarehouse) throw new NotFoundException('Child warehouse not found');

    // 2. Find or create dummy/internal intercompany dealer (for Parent) & vendor (for Child)
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
    const totalAmount = quantity * sellingPrice;

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

    // 3. ATOMIC TRANSACTION
    return this.transactionService.runInTransaction(async (tx) => {
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
          grossAmount: totalAmount,
          taxAmount: 0,
          discountAmount: 0,
          netAmount: totalAmount,
          postingStatus: 'POSTED',
          postedAt: new Date(),
          notes: `Intercompany Transfer to ${childCompany.name} (Tx: ${transferTxId}). ${notes || ''}`,
          items: {
            create: [
              {
                id: uuidv7(),
                finishedProductId: product.id,
                productName: product.productName,
                quantity,
                rate: sellingPrice,
                grossAmount: totalAmount,
                netAmount: totalAmount,
              },
            ],
          },
        },
      });

      // Decrement Parent Stock
      await this.inventoryService.applyMovement(tx, {
        organizationId: parentCompany.organizationId,
        companyId: parentCompanyId,
        warehouseId: parentWarehouseId,
        itemType: 'FINISHED_PRODUCT',
        finishedProductId: product.id,
        quantityChange: -quantity,
        unitCost: dto.transferCost || sellingPrice,
        transactionType: 'SALE',
        referenceId: parentInvoice.id,
        referenceNumber: parentInvoiceNo,
        notes: `Intercompany dispatch to ${childCompany.name}`,
      });

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
          postingStatus: 'POSTED',
          isComplete: true,
          vendorId: parentVendor.id,
          warehouseId: childWarehouseId,
          grossAmount: totalAmount,
          taxAmount: 0,
          discountAmount: 0,
          netAmount: totalAmount,
          notes: `Intercompany Purchase from ${parentCompany.name} (Tx: ${transferTxId}). ${notes || ''}`,
          postedAt: new Date(),
          postedById: actor.id,
          items: {
            create: [
              {
                id: uuidv7(),
                materialType: 'FINISHED_PRODUCT',
                finishedProductId: product.id,
                itemName: product.productName,
                quantity,
                rate: sellingPrice,
                grossAmount: totalAmount,
                netAmount: totalAmount,
              },
            ],
          },
        },
      });

      // Increment Child Stock
      await this.inventoryService.applyMovement(tx, {
        organizationId: childCompany.organizationId,
        companyId: childCompanyId,
        warehouseId: childWarehouseId,
        itemType: 'FINISHED_PRODUCT',
        finishedProductId: product.id,
        quantityChange: quantity,
        unitCost: sellingPrice,
        transactionType: 'PURCHASE',
        referenceId: childPurchase.id,
        referenceNumber: childVoucherNo,
        notes: `Intercompany stock receipt from ${parentCompany.name}`,
      });

      this.logger.log(
        `Intercompany Transfer Complete: ${transferTxId} | Parent Sale ${parentInvoiceNo} | Child Purchase ${childVoucherNo}`,
      );

      return {
        transactionId: transferTxId,
        parentSale: {
          id: parentInvoice.id,
          invoiceNumber: parentInvoiceNo,
          company: parentCompany.name,
          warehouse: parentWarehouse.name,
          quantityDeducted: quantity,
        },
        childPurchase: {
          id: childPurchase.id,
          voucherNumber: childVoucherNo,
          company: childCompany.name,
          warehouse: childWarehouse.name,
          quantityAdded: quantity,
        },
        product: product.productName,
        totalAmount,
      };
    });
  }

  async getTransferHistory(companyId: string) {
    const transfers = await this.prisma.salesInvoice.findMany({
      where: {
        companyId,
        notes: { contains: 'Intercompany Transfer' },
      },
      include: {
        dealer: { select: { name: true } },
        warehouse: { select: { name: true } },
        items: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    return transfers.map((t) => ({
      id: t.id,
      invoiceNumber: t.invoiceNumber,
      date: t.invoiceDate,
      targetCompany: t.dealer?.name,
      warehouse: t.warehouse?.name,
      amount: Number(t.netAmount),
      items: t.items.map((i) => ({
        productName: i.productName,
        quantity: Number(i.quantity),
        rate: Number(i.rate),
      })),
      notes: t.notes,
    }));
  }
}
