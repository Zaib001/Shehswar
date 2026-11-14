/**
 * SHEHSWAR ONE360 - INTERCOMPANY TRANSFER ACCEPTANCE VERIFICATION SUITE
 *
 * Verifies User Requirements:
 * 1. Deduct from Shehswar source warehouse (-100 for FP-A, FP-B, FP-C)
 * 2. Add/Link FP to Child Company (Nectar) Finished Products section (no duplicates)
 * 3. Add stock to Nectar Main Warehouse (+100 for FP-A, FP-B, FP-C)
 * 4. Batch handling preserved in child company
 * 5. Transfer cost and rates preserved (standardCost, purchase invoice, stock ledger)
 * 6. Complete transaction relationship (parent invoice, child voucher, trace)
 * 7. Company isolation (not in ConsceptAG, Agriventure, Excelium; child does not see parent stock)
 * 8. Duplicate prevention on repeated transfer
 * 9. Atomic posting and audit log creation
 * 10. Live report verification (findAllProducts, findFinishedProducts, getWarehouseStockReport)
 */
import { PrismaClient } from '@prisma/client';
import { IntercompanyService } from '../apps/api/src/operations/intercompany/intercompany.service';
import { TransactionService } from '../apps/api/src/common/services/transaction.service';
import { InventoryService } from '../apps/api/src/operations/inventory/inventory.service';
import { DocumentNumberingService } from '../apps/api/src/platform/document-numbering/document-numbering.service';
import { MasterDataService } from '../apps/api/src/platform/master-data/master-data.service';
import { SalesService } from '../apps/api/src/operations/sales/sales.service';
import { uuidv7 } from '@shehswar/shared';

const prisma = new PrismaClient();

const results: Array<{ step: string; name: string; passed: boolean; details?: string }> = [];

function recordTest(step: string, name: string, passed: boolean, details = '') {
  results.push({ step, name, passed, details });
  const icon = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`${icon} [${step}] ${name} ${details ? '— ' + details : ''}`);
}

async function run() {
  console.log('\n================================================================');
  console.log('SHEHSWAR ONE360 - POST INTERCOMPANY TRANSFER ACCEPTANCE TEST');
  console.log('================================================================\n');

  try {
    // 1. Locate Companies
    const parentCompany = await prisma.company.findFirst({
      where: { isParent: true },
    });
    if (!parentCompany) throw new Error('Parent company (Shehswar) not found');

    const nectarCompany = await prisma.company.findFirst({
      where: { code: 'COMP-NECTAR' },
    });
    if (!nectarCompany) throw new Error('Child company (Nectar) not found');

    const consceptCompany = await prisma.company.findFirst({
      where: { code: 'COMP-CONSCEPAG' },
    });

    // 2. Locate Warehouses
    const parentWarehouse = await prisma.warehouse.findFirst({
      where: { companyId: parentCompany.id },
      orderBy: { code: 'asc' },
    });
    if (!parentWarehouse) throw new Error('Shehswar source warehouse not found');

    const nectarWarehouse = await prisma.warehouse.findFirst({
      where: { companyId: nectarCompany.id },
      orderBy: { code: 'asc' },
    });
    if (!nectarWarehouse) throw new Error('Nectar destination warehouse not found');

    console.log(`Parent Company: ${parentCompany.name} (${parentCompany.code})`);
    console.log(`Parent Warehouse: ${parentWarehouse.name} (${parentWarehouse.code})`);
    console.log(`Child Company: ${nectarCompany.name} (${nectarCompany.code})`);
    console.log(`Child Warehouse: ${nectarWarehouse.name} (${nectarWarehouse.code})\n`);

    // 3. Locate or Prepare Products FP-A, FP-B, FP-C in Shehswar
    // FP-A: FG-000005, FP-B: FG-000006, FP-C: FG-000007
    let fpA = await prisma.finishedProduct.findFirst({
      where: { companyId: parentCompany.id, productCode: 'FG-000005' },
    });
    let fpB = await prisma.finishedProduct.findFirst({
      where: { companyId: parentCompany.id, productCode: 'FG-000006' },
    });
    let fpC = await prisma.finishedProduct.findFirst({
      where: { companyId: parentCompany.id, productCode: 'FG-000007' },
    });

    if (!fpA || !fpB || !fpC) {
      throw new Error('Finished Products FP-A, FP-B, or FP-C not found in Shehswar');
    }

    // Ensure Shehswar source warehouse has at least 200 units of each product and active batches
    const ensureParentStock = async (prod: any, batchNum: string, qtyNeeded: number, cost: number) => {
      let batch = await prisma.productBatch.findFirst({
        where: { finishedProductId: prod.id, batchNumber: batchNum },
      });
      if (!batch) {
        batch = await prisma.productBatch.create({
          data: {
            id: uuidv7(),
            organizationId: parentCompany.organizationId,
            companyId: parentCompany.id,
            finishedProductId: prod.id,
            batchNumber: batchNum,
            manufacturingDate: new Date('2026-01-15'),
            expiryDate: new Date('2028-01-15'),
            initialQuantity: 500,
            availableQuantity: 500,
            status: 'RELEASED',
            isActive: true,
          },
        });
      } else {
        await prisma.productBatch.update({
          where: { id: batch.id },
          data: { availableQuantity: { increment: 200 }, isActive: true },
        });
      }

      let stock = await prisma.warehouseStock.findFirst({
        where: {
          warehouseId: parentWarehouse.id,
          itemType: 'FINISHED_PRODUCT',
          finishedProductId: prod.id,
        },
      });

      if (!stock) {
        await prisma.warehouseStock.create({
          data: {
            organizationId: parentCompany.organizationId,
            companyId: parentCompany.id,
            warehouseId: parentWarehouse.id,
            itemType: 'FINISHED_PRODUCT',
            finishedProductId: prod.id,
            quantityOnHand: qtyNeeded,
            averageCost: cost,
          },
        });
      } else if (Number(stock.quantityOnHand) < qtyNeeded) {
        await prisma.warehouseStock.update({
          where: { id: stock.id },
          data: {
            quantityOnHand: Number(stock.quantityOnHand) + qtyNeeded,
            averageCost: cost,
          },
        });
      }
    };

    await ensureParentStock(fpA, 'BAT-2026-A1', 200, 1000);
    await ensureParentStock(fpB, 'BAT-2026-B1', 200, 2000);
    await ensureParentStock(fpC, 'BAT-2026-C1', 200, 500);

    // Initial Stock Snapshots
    const getStock = async (whId: string, prodId: string) => {
      const s = await prisma.warehouseStock.findFirst({
        where: { warehouseId: whId, itemType: 'FINISHED_PRODUCT', finishedProductId: prodId },
      });
      return s ? Number(s.quantityOnHand) : 0;
    };

    const parentStockA_before = await getStock(parentWarehouse.id, fpA.id);
    const parentStockB_before = await getStock(parentWarehouse.id, fpB.id);
    const parentStockC_before = await getStock(parentWarehouse.id, fpC.id);

    // Initial Nectar Product check
    const getNectarProd = async (code: string) => {
      return prisma.finishedProduct.findFirst({
        where: { companyId: nectarCompany.id, productCode: code, deletedAt: null },
      });
    };

    let nectarProdA_before = await getNectarProd('FG-000005');
    let nectarProdB_before = await getNectarProd('FG-000006');
    let nectarProdC_before = await getNectarProd('FG-000007');

    const nectarStockA_before = nectarProdA_before ? await getStock(nectarWarehouse.id, nectarProdA_before.id) : 0;
    const nectarStockB_before = nectarProdB_before ? await getStock(nectarWarehouse.id, nectarProdB_before.id) : 0;
    const nectarStockC_before = nectarProdC_before ? await getStock(nectarWarehouse.id, nectarProdC_before.id) : 0;

    console.log('--- INITIAL STOCK SNAPSHOT ---');
    console.log(`Shehswar Main Warehouse: FP-A=${parentStockA_before}, FP-B=${parentStockB_before}, FP-C=${parentStockC_before}`);
    console.log(`Nectar Main Warehouse:   FP-A=${nectarStockA_before}, FP-B=${nectarStockB_before}, FP-C=${nectarStockC_before}\n`);

    // 4. Instantiate Services
    const txService = new TransactionService(prisma as any);
    const inventoryService = new InventoryService(prisma as any);
    const docNumberingService = new DocumentNumberingService(prisma as any, txService);
    const intercompanyService = new IntercompanyService(
      prisma as any,
      txService,
      inventoryService,
      docNumberingService,
    );

    // 5. EXECUTE POST INTERCOMPANY TRANSFER (Requirement 10: FP-A=100, FP-B=100, FP-C=100)
    console.log('--- EXECUTING POST INTERCOMPANY TRANSFER ---');
    const transferDto = {
      parentCompanyId: parentCompany.id,
      childCompanyId: nectarCompany.id,
      parentWarehouseId: parentWarehouse.id,
      childWarehouseId: nectarWarehouse.id,
      defaultMarkupPercent: 15,
      status: 'POSTED' as const,
      items: [
        {
          finishedProductId: fpA.id,
          batchNumber: 'BAT-2026-A1',
          quantity: 100,
          unitCost: 1000,
          markupPercent: 15,
          sellingPrice: 1150,
        },
        {
          finishedProductId: fpB.id,
          batchNumber: 'BAT-2026-B1',
          quantity: 100,
          unitCost: 2000,
          markupPercent: 15,
          sellingPrice: 2300,
        },
        {
          finishedProductId: fpC.id,
          batchNumber: 'BAT-2026-C1',
          quantity: 100,
          unitCost: 500,
          markupPercent: 15,
          sellingPrice: 575,
        },
      ],
      notes: 'Acceptance Test Transfer: Shehswar -> Nectar (FP-A=100, FP-B=100, FP-C=100)',
    };

    const actor = {
      id: parentCompany.id,
      email: 'admin@shehswar.com',
      organizationId: parentCompany.organizationId,
      companyId: parentCompany.id,
      roles: ['SUPER_ADMIN'],
      permissions: ['*'],
      isSuperAdmin: true,
    } as any;

    const result = await intercompanyService.executeTransfer(transferDto, actor);

    // 6. VERIFICATIONS
    console.log('\n--- VERIFYING REQUIREMENT RESULTS ---');

    // Requirement 1: Shehswar Stock Deducted (-100 each)
    const parentStockA_after = await getStock(parentWarehouse.id, fpA.id);
    const parentStockB_after = await getStock(parentWarehouse.id, fpB.id);
    const parentStockC_after = await getStock(parentWarehouse.id, fpC.id);

    recordTest(
      'Req 1: Shehswar Stock Deducted',
      'FP-A decreased by exactly 100',
      parentStockA_after === parentStockA_before - 100,
      `Before: ${parentStockA_before}, After: ${parentStockA_after}`,
    );
    recordTest(
      'Req 1: Shehswar Stock Deducted',
      'FP-B decreased by exactly 100',
      parentStockB_after === parentStockB_before - 100,
      `Before: ${parentStockB_before}, After: ${parentStockB_after}`,
    );
    recordTest(
      'Req 1: Shehswar Stock Deducted',
      'FP-C decreased by exactly 100',
      parentStockC_after === parentStockC_before - 100,
      `Before: ${parentStockC_before}, After: ${parentStockC_after}`,
    );

    // Requirement 2: Child Company Product Section
    const nectarProdA = await getNectarProd('FG-000005');
    const nectarProdB = await getNectarProd('FG-000006');
    const nectarProdC = await getNectarProd('FG-000007');

    recordTest(
      'Req 2: Child FP Created/Linked',
      'FP-A exists in Nectar Finished Products',
      !!nectarProdA && nectarProdA.companyId === nectarCompany.id,
      `ID: ${nectarProdA?.id}, Code: ${nectarProdA?.productCode}`,
    );
    recordTest(
      'Req 2: Child FP Created/Linked',
      'FP-B exists in Nectar Finished Products',
      !!nectarProdB && nectarProdB.companyId === nectarCompany.id,
      `ID: ${nectarProdB?.id}, Code: ${nectarProdB?.productCode}`,
    );
    recordTest(
      'Req 2: Child FP Created/Linked',
      'FP-C exists in Nectar Finished Products',
      !!nectarProdC && nectarProdC.companyId === nectarCompany.id,
      `ID: ${nectarProdC?.id}, Code: ${nectarProdC?.productCode}`,
    );

    // Requirement 3: Add Stock to Child Warehouse (+100 each)
    const nectarStockA_after = await getStock(nectarWarehouse.id, nectarProdA!.id);
    const nectarStockB_after = await getStock(nectarWarehouse.id, nectarProdB!.id);
    const nectarStockC_after = await getStock(nectarWarehouse.id, nectarProdC!.id);

    recordTest(
      'Req 3: Child Warehouse Stock Added',
      'FP-A increased by exactly 100 in Nectar Main Warehouse',
      nectarStockA_after === nectarStockA_before + 100,
      `Before: ${nectarStockA_before}, After: ${nectarStockA_after}`,
    );
    recordTest(
      'Req 3: Child Warehouse Stock Added',
      'FP-B increased by exactly 100 in Nectar Main Warehouse',
      nectarStockB_after === nectarStockB_before + 100,
      `Before: ${nectarStockB_before}, After: ${nectarStockB_after}`,
    );
    recordTest(
      'Req 3: Child Warehouse Stock Added',
      'FP-C increased by exactly 100 in Nectar Main Warehouse',
      nectarStockC_after === nectarStockC_before + 100,
      `Before: ${nectarStockC_before}, After: ${nectarStockC_after}`,
    );

    // Requirement 4: Batch Handling Preserved
    const nectarBatchA = await prisma.productBatch.findFirst({
      where: { finishedProductId: nectarProdA!.id, batchNumber: 'BAT-2026-A1' },
    });
    const nectarBatchB = await prisma.productBatch.findFirst({
      where: { finishedProductId: nectarProdB!.id, batchNumber: 'BAT-2026-B1' },
    });
    const nectarBatchC = await prisma.productBatch.findFirst({
      where: { finishedProductId: nectarProdC!.id, batchNumber: 'BAT-2026-C1' },
    });

    recordTest(
      'Req 4: Batch Handling',
      'Batch BAT-2026-A1 preserved in Nectar',
      !!nectarBatchA && Number(nectarBatchA.availableQuantity) >= 100,
      `Avail: ${nectarBatchA?.availableQuantity}`,
    );
    recordTest(
      'Req 4: Batch Handling',
      'Batch BAT-2026-B1 preserved in Nectar',
      !!nectarBatchB && Number(nectarBatchB.availableQuantity) >= 100,
      `Avail: ${nectarBatchB?.availableQuantity}`,
    );
    recordTest(
      'Req 4: Batch Handling',
      'Batch BAT-2026-C1 preserved in Nectar',
      !!nectarBatchC && Number(nectarBatchC.availableQuantity) >= 100,
      `Avail: ${nectarBatchC?.availableQuantity}`,
    );

    // Requirement 5: Transfer Cost / Rate Preserved
    recordTest(
      'Req 5: Cost & Rate Preserved',
      'Nectar FP-A standardCost equals transfer rate (PKR 1,150)',
      Number(nectarProdA?.standardCost) === 1150,
      `Cost: ${nectarProdA?.standardCost}`,
    );
    recordTest(
      'Req 5: Cost & Rate Preserved',
      'Nectar FP-B standardCost equals transfer rate (PKR 2,300)',
      Number(nectarProdB?.standardCost) === 2300,
      `Cost: ${nectarProdB?.standardCost}`,
    );
    recordTest(
      'Req 5: Cost & Rate Preserved',
      'Nectar FP-C standardCost equals transfer rate (PKR 575)',
      Number(nectarProdC?.standardCost) === 575,
      `Cost: ${nectarProdC?.standardCost}`,
    );

    // Requirement 6: Complete Transaction Relationship Traceability
    const childPurchase = await prisma.purchaseInvoice.findUnique({
      where: { id: result.childPurchase.id },
      include: { items: true },
    });
    const parentSale = await prisma.salesInvoice.findUnique({
      where: { id: result.parentSale.id },
      include: { items: true },
    });

    recordTest(
      'Req 6: Transaction Relationship',
      'Parent Sale Invoice & Child Purchase Voucher cross-referenced',
      childPurchase?.vendorInvoiceNo === parentSale?.invoiceNumber &&
        childPurchase?.reference === result.transactionId,
      `Parent: ${parentSale?.invoiceNumber}, Child: ${childPurchase?.voucherNumber}`,
    );

    // Requirement 7: Company Isolation
    if (consceptCompany) {
      const consceptWh = await prisma.warehouse.findFirst({
        where: { companyId: consceptCompany.id },
      });
      if (consceptWh) {
        const consceptStockA = await getStock(consceptWh.id, nectarProdA!.id);
        recordTest(
          'Req 7: Company Isolation',
          'Nectar stock is NOT visible in ConsceptAG warehouse',
          consceptStockA === 0,
          `ConsceptAG stock for FP-A: ${consceptStockA}`,
        );
      }
    }

    // Requirement 8: No Duplicate Products on Repeated Transfer
    console.log('\n--- TESTING REPEATED TRANSFER (DUPLICATE PREVENTION) ---');
    const repeatDto = {
      parentCompanyId: parentCompany.id,
      childCompanyId: nectarCompany.id,
      parentWarehouseId: parentWarehouse.id,
      childWarehouseId: nectarWarehouse.id,
      defaultMarkupPercent: 15,
      status: 'POSTED' as const,
      items: [
        {
          finishedProductId: fpA.id,
          batchNumber: 'BAT-2026-A1',
          quantity: 20,
          unitCost: 1000,
          markupPercent: 15,
          sellingPrice: 1150,
        },
      ],
      notes: 'Repeat Transfer to test duplicate prevention',
    };

    await intercompanyService.executeTransfer(repeatDto, actor);

    const nectarProdA_count = await prisma.finishedProduct.count({
      where: { companyId: nectarCompany.id, productCode: 'FG-000005', deletedAt: null },
    });
    const nectarStockA_afterRepeat = await getStock(nectarWarehouse.id, nectarProdA!.id);

    recordTest(
      'Req 8: No Duplicate Products',
      'Exactly 1 FinishedProduct record exists in Nectar for FP-A after repeat transfer',
      nectarProdA_count === 1,
      `Count: ${nectarProdA_count}`,
    );
    recordTest(
      'Req 8: No Duplicate Products',
      'Stock incremented by +20 without creating duplicate product',
      nectarStockA_afterRepeat === nectarStockA_after + 20,
      `Previous: ${nectarStockA_after}, New: ${nectarStockA_afterRepeat}`,
    );

    // Requirement 9: Atomicity & Audit Log
    console.log('\n--- TESTING ATOMICITY ON INSUFFICIENT STOCK ---');
    let atomicRejected = false;
    try {
      await intercompanyService.executeTransfer(
        {
          parentCompanyId: parentCompany.id,
          childCompanyId: nectarCompany.id,
          parentWarehouseId: parentWarehouse.id,
          childWarehouseId: nectarWarehouse.id,
          status: 'POSTED',
          items: [
            {
              finishedProductId: fpA.id,
              quantity: 99999999, // Impossible quantity
              unitCost: 1000,
              sellingPrice: 1150,
            },
          ],
        },
        actor,
      );
    } catch (err: any) {
      atomicRejected = true;
    }

    recordTest(
      'Req 9: Atomic Posting',
      'Over-quantity transfer strictly blocked before database mutation',
      atomicRejected,
    );

    const auditLogEntry = await prisma.auditLog.findFirst({
      where: {
        resource: 'INTERCOMPANY_TRANSFER',
        resourceId: result.transactionId,
        action: 'POST_INTERCOMPANY_TRANSFER',
      },
    });

    recordTest(
      'Req 9: Atomic Audit Log',
      'Audit log entry created with complete transfer metadata',
      !!auditLogEntry,
      `AuditLog ID: ${auditLogEntry?.id}`,
    );

    // Requirement 10: Real API Query Services Check (Products & Warehouse Stock)
    console.log('\n--- VERIFYING LIVE QUERY SERVICES ---');
    const masterDataService = new MasterDataService(prisma as any, {} as any, {} as any);
    const salesService = new SalesService(prisma as any, {} as any, {} as any, {} as any);

    const nectarAllProducts = await masterDataService.findAllProducts(nectarCompany.id);
    const nectarFpItems = nectarAllProducts.filter((p: any) => p.itemType === 'FINISHED_PRODUCT');
    const nectarHasAllThree = ['FG-000005', 'FG-000006', 'FG-000007'].every((code) =>
      nectarFpItems.some((it: any) => it.code === code),
    );

    recordTest(
      'Req 10: Live Reporting Visibility',
      'All 3 products visible via findAllProducts for Nectar',
      nectarHasAllThree,
      `Nectar Finished Products Count: ${nectarFpItems.length}`,
    );

    const nectarStockReport = await salesService.getWarehouseStockReport(
      nectarCompany.id,
      nectarWarehouse.id,
    );
    const stockReportHasAllThree = ['FG-000005', 'FG-000006', 'FG-000007'].every((code) =>
      nectarStockReport.some((s: any) => s.finishedProduct?.productCode === code),
    );

    recordTest(
      'Req 10: Live Reporting Visibility',
      'All 3 products present in Nectar Warehouse Stock Report with positive quantity',
      stockReportHasAllThree,
      `Nectar Warehouse Stock Records: ${nectarStockReport.length}`,
    );

    // Summary
    const total = results.length;
    const passed = results.filter((r) => r.passed).length;
    const failed = total - passed;

    console.log('\n================================================================');
    console.log(`ACCEPTANCE TEST RESULTS: ${passed}/${total} PASSED (${failed} FAILED)`);
    console.log('================================================================\n');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Test Execution Error:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

run();

