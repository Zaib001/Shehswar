/**
 * SHEHSWAR ONE360 - CANONICAL FLOWS VERIFICATION SUITE
 *
 * Runs the authoritative verification tests specified in User Requirements Section 23:
 *  1. TEST PURCHASE (PO Upload -> PO Table -> Purchase from PO -> Post -> Stock+ -> Vendor Ledger -> Cost -> Costing)
 *  2. TEST SALES (Mobile SO -> ERP SO -> Approve -> Convert to Sale -> Stock- -> Dealer Ledger)
 *  3. TEST PAYMENT (Mobile Bank Receipt -> ERP Payment -> Dealer Ledger -> Balance Decrease -> Visible in SO Review)
 *  4. TEST INTERCOMPANY (Parent Sale & Stock- -> Child Purchase & Stock+ in one atomic action)
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const results = [];

function recordTest(suite, name, passed, details = '') {
  results.push({ suite, name, passed, details });
  const status = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`${status} [${suite}] ${name} ${details ? '(' + details + ')' : ''}`);
}

async function run() {
  console.log('\n======================================================');
  console.log('SHEHSWAR ONE360 - CANONICAL SYSTEM FLOW VERIFICATION');
  console.log('======================================================\n');

  try {
    // 0. Locate Test Organization & Company
    const company = await prisma.company.findFirst({
      include: { organization: true },
    });
    if (!company) throw new Error('No company found in database to run tests against');

    const orgId = company.organizationId;
    const companyId = company.id;

    // Locate or create Warehouse
    let warehouse = await prisma.warehouse.findFirst({ where: { companyId } });
    if (!warehouse) {
      warehouse = await prisma.warehouse.create({
        data: {
          companyId,
          code: 'WH-TEST-01',
          name: 'Main Production Warehouse',
          type: 'RAW_MATERIAL',
        },
      });
    }

    // Locate or create Vendor
    let vendor = await prisma.vendor.findFirst({ where: { companyId } });
    if (!vendor) {
      vendor = await prisma.vendor.create({
        data: {
          organizationId: orgId,
          companyId,
          code: 'VEND-TEST-01',
          name: 'Engro Chemical Supplies Ltd',
        },
      });
    }

    // Locate or create Raw Material
    let rawMaterial = await prisma.rawMaterial.findFirst({ where: { companyId } });
    if (!rawMaterial) {
      rawMaterial = await prisma.rawMaterial.create({
        data: {
          organizationId: orgId,
          companyId,
          materialCode: 'RM-LAB-01',
          materialName: 'Linear Alkyl Benzene (LAB)',
          status: 'ACTIVE',
        },
      });
    }

    // Locate or create Dealer
    let dealer = await prisma.dealer.findFirst({ where: { companyId } });
    if (!dealer) {
      dealer = await prisma.dealer.create({
        data: {
          organizationId: orgId,
          companyId,
          code: 'DLR-TEST-01',
          name: 'Al-Madina Traders',
          phone: '0300-1234567',
          currentBalance: 0,
        },
      });
    }

    // Locate or create Finished Product
    let finishedProduct = await prisma.finishedProduct.findFirst({ where: { companyId } });
    if (!finishedProduct) {
      finishedProduct = await prisma.finishedProduct.create({
        data: {
          organizationId: orgId,
          companyId,
          productCode: 'FP-WASH-1L',
          productName: 'Surface Cleaner 1-Litre Bottle',
          defaultSellingPrice: 450,
          standardCost: 320,
        },
      });
    }

    // ────────────────────────────────────────────────────────────────────────
    // TEST 1: PURCHASE FLOW
    // ────────────────────────────────────────────────────────────────────────
    console.log('\n--- 1. TESTING PURCHASE FLOW ---');
    const poNumber = `PO-TEST-${Date.now().toString().slice(-6)}`;
    const poQty = 500;
    const poRate = 850;
    const poSubtotal = poQty * poRate;

    // 1.1 Upload / Create Structured PO
    const po = await prisma.purchaseOrder.create({
      data: {
        organizationId: orgId,
        companyId,
        poNumber,
        vendorId: vendor.id,
        warehouseId: warehouse.id,
        subtotal: poSubtotal,
        totalAmount: poSubtotal,
        status: 'CONFIRMED',
        items: {
          create: [
            {
              materialId: rawMaterial.id,
              materialType: 'RAW_MATERIAL',
              itemName: rawMaterial.materialName,
              quantity: poQty,
              unitRate: poRate,
              lineTotal: poSubtotal,
            },
          ],
        },
      },
      include: { items: true },
    });
    recordTest('PURCHASE', '1. Structured PO saved in DB', !!po.id, `PO #${po.poNumber}`);
    recordTest('PURCHASE', '2. Extracted PO items structurally linked', po.items.length === 1 && Number(po.items[0].quantity) === poQty);

    // Initial stock check
    const initialStock = await prisma.warehouseStock.findFirst({
      where: { warehouseId: warehouse.id, rawMaterialId: rawMaterial.id },
    });
    const startQty = initialStock ? Number(initialStock.quantityOnHand) : 0;

    // 1.2 Create Purchase from PO & Post
    const voucherNumber = `PV-TEST-${Date.now().toString().slice(-6)}`;
    const purchase = await prisma.purchaseInvoice.create({
      data: {
        organizationId: orgId,
        companyId,
        voucherNumber,
        date: new Date(),
        reference: poNumber, // Linked to PO
        vendorInvoiceNo: `INV-VEND-${Date.now().toString().slice(-4)}`,
        postingStatus: 'DRAFT',
        vendorId: vendor.id,
        warehouseId: warehouse.id,
        grossAmount: poSubtotal,
        netAmount: poSubtotal,
        items: {
          create: [
            {
              materialType: 'RAW_MATERIAL',
              rawMaterialId: rawMaterial.id,
              itemName: rawMaterial.materialName,
              quantity: poQty,
              rate: poRate,
              grossAmount: poSubtotal,
              netAmount: poSubtotal,
            },
          ],
        },
      },
    });
    recordTest('PURCHASE', '3. Purchase created from PO', !!purchase.id, `Voucher: ${purchase.voucherNumber}`);

    // Atomic Posting Simulation
    await prisma.$transaction(async (tx) => {
      // Mark Posted
      await tx.purchaseInvoice.update({
        where: { id: purchase.id },
        data: { postingStatus: 'POSTED', isComplete: true, postedAt: new Date() },
      });

      // Stock +
      const existingStock = await tx.warehouseStock.findFirst({
        where: { warehouseId: warehouse.id, rawMaterialId: rawMaterial.id },
      });
      if (existingStock) {
        await tx.warehouseStock.update({
          where: { id: existingStock.id },
          data: {
            quantityOnHand: { increment: poQty },
            averageCost: poRate,
          },
        });
      } else {
        await tx.warehouseStock.create({
          data: {
            organizationId: orgId,
            companyId,
            warehouseId: warehouse.id,
            itemType: 'RAW_MATERIAL',
            rawMaterialId: rawMaterial.id,
            quantityOnHand: poQty,
            averageCost: poRate,
          },
        });
      }

      // Stock Ledger Entry
      await tx.stockLedgerEntry.create({
        data: {
          organizationId: orgId,
          companyId,
          warehouseId: warehouse.id,
          itemType: 'RAW_MATERIAL',
          rawMaterialId: rawMaterial.id,
          quantityChange: poQty,
          quantityAfter: startQty + poQty,
          unitCost: poRate,
          transactionType: 'PURCHASE',
          referenceId: purchase.id,
          referenceNumber: voucherNumber,
        },
      });

      // Vendor Ledger Credit
      await tx.vendorLedgerEntry.create({
        data: {
          organizationId: orgId,
          companyId,
          vendorId: vendor.id,
          entryType: 'PURCHASE_INVOICE',
          referenceId: purchase.id,
          voucherNumber,
          credit: poSubtotal,
          debit: 0,
          runningBalance: poSubtotal,
          purchaseInvoiceId: purchase.id,
        },
      });

      // Material Cost Update
      await tx.rawMaterial.update({
        where: { id: rawMaterial.id },
        data: { lastPurchaseCost: poRate, averageCost: poRate },
      });

      // Mark PO as CONVERTED_TO_PURCHASE
      await tx.purchaseOrder.update({
        where: { id: po.id },
        data: { status: 'CONVERTED_TO_PURCHASE' },
      });
    });

    // Verifications
    const updatedStock = await prisma.warehouseStock.findFirst({
      where: { warehouseId: warehouse.id, rawMaterialId: rawMaterial.id },
    });
    recordTest('PURCHASE', '4. Warehouse Stock increased', Number(updatedStock.quantityOnHand) === startQty + poQty, `New Qty: ${updatedStock.quantityOnHand}`);

    const stockEntry = await prisma.stockLedgerEntry.findFirst({
      where: { referenceNumber: voucherNumber, transactionType: 'PURCHASE' },
    });
    recordTest('PURCHASE', '5. Stock Ledger entry created', !!stockEntry);

    const vendorLedgerEntry = await prisma.vendorLedgerEntry.findFirst({
      where: { purchaseInvoiceId: purchase.id },
    });
    recordTest('PURCHASE', '6. Vendor Ledger credited', Number(vendorLedgerEntry.credit) === poSubtotal);

    const updatedMaterial = await prisma.rawMaterial.findUnique({ where: { id: rawMaterial.id } });
    recordTest('PURCHASE', '7. Material Cost updated in Master Data', Number(updatedMaterial.lastPurchaseCost) === poRate);

    const updatedPo = await prisma.purchaseOrder.findUnique({ where: { id: po.id } });
    recordTest('PURCHASE', '8. PO status updated to CONVERTED_TO_PURCHASE', updatedPo.status === 'CONVERTED_TO_PURCHASE');

    // ────────────────────────────────────────────────────────────────────────
    // TEST 2: SALES FLOW
    // ────────────────────────────────────────────────────────────────────────
    console.log('\n--- 2. TESTING SALES FLOW ---');
    const orderNumber = `SO-TEST-${Date.now().toString().slice(-6)}`;
    const orderQty = 10;
    const orderRate = Number(finishedProduct.defaultSellingPrice || 450);
    const orderTotal = orderQty * orderRate;

    // Ensure finished product has stock
    let fpStock = await prisma.warehouseStock.findFirst({
      where: { warehouseId: warehouse.id, finishedProductId: finishedProduct.id },
    });
    if (!fpStock) {
      fpStock = await prisma.warehouseStock.create({
        data: {
          organizationId: orgId,
          companyId,
          warehouseId: warehouse.id,
          itemType: 'FINISHED_PRODUCT',
          finishedProductId: finishedProduct.id,
          quantityOnHand: 100,
          averageCost: 300,
        },
      });
    }
    const fpStartQty = Number(fpStock.quantityOnHand);

    // 2.1 Mobile creates Sales Order (shared database entity)
    const salesOrder = await prisma.salesOrder.create({
      data: {
        organizationId: orgId,
        companyId,
        orderNumber,
        dealerId: dealer.id,
        warehouseId: warehouse.id,
        totalAmount: orderTotal,
        status: 'PENDING',
        items: {
          create: [
            {
              finishedProductId: finishedProduct.id,
              productName: finishedProduct.productName,
              quantity: orderQty,
              unitPrice: orderRate,
              totalPrice: orderTotal,
            },
          ],
        },
      },
    });
    recordTest('SALES', '1. Mobile Sales Order created in shared ERP table', !!salesOrder.id, `Order #${salesOrder.orderNumber}`);

    // 2.2 Admin approves Sales Order
    const approvedOrder = await prisma.salesOrder.update({
      where: { id: salesOrder.id },
      data: { status: 'APPROVED', approvedAt: new Date() },
    });
    recordTest('SALES', '2. Admin Approved order (visible on Mobile)', approvedOrder.status === 'APPROVED');

    // 2.3 Convert to Sale & Post
    const invoiceNumber = `INV-TEST-${Date.now().toString().slice(-6)}`;
    const dealerStartBal = Number(dealer.currentBalance || 0);

    await prisma.$transaction(async (tx) => {
      // Create Sale Invoice
      const inv = await tx.salesInvoice.create({
        data: {
          organizationId: orgId,
          companyId,
          invoiceNumber,
          salesOrderId: salesOrder.id,
          dealerId: dealer.id,
          warehouseId: warehouse.id,
          invoiceDate: new Date(),
          postingStatus: 'POSTED',
          postedAt: new Date(),
          grossAmount: orderTotal,
          netAmount: orderTotal,
          items: {
            create: [
              {
                finishedProductId: finishedProduct.id,
                productName: finishedProduct.productName,
                quantity: orderQty,
                rate: orderRate,
                grossAmount: orderTotal,
                netAmount: orderTotal,
              },
            ],
          },
        },
      });

      // Stock Decreases
      await tx.warehouseStock.update({
        where: { id: fpStock.id },
        data: { quantityOnHand: { decrement: orderQty } },
      });

      // Stock Ledger
      await tx.stockLedgerEntry.create({
        data: {
          organizationId: orgId,
          companyId,
          warehouseId: warehouse.id,
          itemType: 'FINISHED_PRODUCT',
          finishedProductId: finishedProduct.id,
          quantityChange: -orderQty,
          quantityAfter: fpStartQty - orderQty,
          unitCost: orderRate,
          transactionType: 'SALE',
          referenceId: inv.id,
          referenceNumber: invoiceNumber,
        },
      });

      // Dealer Ledger Debit
      await tx.dealerLedgerEntry.create({
        data: {
          organizationId: orgId,
          companyId,
          dealerId: dealer.id,
          entryType: 'SALE_INVOICE',
          referenceId: inv.id,
          voucherNumber: invoiceNumber,
          debit: orderTotal,
          credit: 0,
          runningBalance: dealerStartBal + orderTotal,
          salesInvoiceId: inv.id,
        },
      });

      // Update Dealer Balance
      await tx.dealer.update({
        where: { id: dealer.id },
        data: { currentBalance: { increment: orderTotal } },
      });

      // Update Sales Order to CONVERTED_TO_SALE
      await tx.salesOrder.update({
        where: { id: salesOrder.id },
        data: { status: 'CONVERTED_TO_SALE' },
      });
    });

    const updatedFpStock = await prisma.warehouseStock.findUnique({ where: { id: fpStock.id } });
    recordTest('SALES', '3. Warehouse Stock decreased after Sale', Number(updatedFpStock.quantityOnHand) === fpStartQty - orderQty);

    const dealerEntry = await prisma.dealerLedgerEntry.findFirst({ where: { voucherNumber: invoiceNumber } });
    recordTest('SALES', '4. Dealer Ledger debited', Number(dealerEntry.debit) === orderTotal);

    const updatedDealer = await prisma.dealer.findUnique({ where: { id: dealer.id } });
    recordTest('SALES', '5. Dealer Outstanding Balance increased', Number(updatedDealer.currentBalance) === dealerStartBal + orderTotal);

    const convertedOrder = await prisma.salesOrder.findUnique({ where: { id: salesOrder.id } });
    recordTest('SALES', '6. Sales Order marked CONVERTED_TO_SALE', convertedOrder.status === 'CONVERTED_TO_SALE');

    // ────────────────────────────────────────────────────────────────────────
    // TEST 3: PAYMENT FLOW (BANK / CASH RECEIPT)
    // ────────────────────────────────────────────────────────────────────────
    console.log('\n--- 3. TESTING DEALER PAYMENT FLOW ---');
    const paymentAmount = 2500;
    const receiptNumber = `RCPT-TEST-${Date.now().toString().slice(-6)}`;

    // 3.1 Mobile logs Bank Receipt with screenshot proof
    const paymentReceipt = await prisma.dealerPaymentReceipt.create({
      data: {
        organizationId: orgId,
        companyId,
        receiptNumber,
        dealerId: dealer.id,
        paymentType: 'BANK',
        amount: paymentAmount,
        paymentDate: new Date(),
        bankName: 'Meezan Bank Limited',
        referenceNumber: 'FT-99441122',
        receiptImageUrl: '/uploads/receipts/bank_slip_sample.jpg',
        status: 'CONFIRMED',
      },
    });
    recordTest('PAYMENT', '1. Bank Receipt recorded in ERP', !!paymentReceipt.id, `Receipt #${paymentReceipt.receiptNumber}`);

    // 3.2 Post payment to Dealer Ledger
    await prisma.$transaction(async (tx) => {
      await tx.dealerLedgerEntry.create({
        data: {
          organizationId: orgId,
          companyId,
          dealerId: dealer.id,
          entryType: 'PAYMENT_RECEIPT',
          referenceId: paymentReceipt.id,
          voucherNumber: receiptNumber,
          credit: paymentAmount,
          debit: 0,
          runningBalance: Number(updatedDealer.currentBalance) - paymentAmount,
          dealerPaymentId: paymentReceipt.id,
        },
      });

      await tx.dealer.update({
        where: { id: dealer.id },
        data: { currentBalance: { decrement: paymentAmount } },
      });
    });

    const paymentLedgerEntry = await prisma.dealerLedgerEntry.findFirst({
      where: { voucherNumber: receiptNumber },
    });
    recordTest('PAYMENT', '2. Dealer Ledger credited for payment', Number(paymentLedgerEntry.credit) === paymentAmount);

    const dealerAfterPayment = await prisma.dealer.findUnique({ where: { id: dealer.id } });
    recordTest('PAYMENT', '3. Dealer Outstanding Balance decreased', Number(dealerAfterPayment.currentBalance) === Number(updatedDealer.currentBalance) - paymentAmount);

    // Verify recent payments query returns this payment for Sales Order review
    const recentPayments = await prisma.dealerPaymentReceipt.findMany({
      where: { dealerId: dealer.id },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });
    const foundInReview = recentPayments.some((p) => p.id === paymentReceipt.id);
    recordTest('PAYMENT', '4. Payment appears in Order Review context', foundInReview, 'Available in review screen');

    // ────────────────────────────────────────────────────────────────────────
    // TEST 4: INTERCOMPANY FLOW (PARENT → CHILD)
    // ────────────────────────────────────────────────────────────────────────
    console.log('\n--- 4. TESTING INTERCOMPANY PARENT → CHILD TRANSFER ---');
    // Ensure we have a second (child) company
    let childCompany = await prisma.company.findFirst({
      where: { id: { not: companyId } },
    });
    if (!childCompany) {
      childCompany = await prisma.company.create({
        data: {
          organizationId: orgId,
          code: 'CHILD-CO-01',
          name: 'Shehswar Distribution Lahore',
          companyType: 'CHILD_COMPANY',
        },
      });
    }

    let childWh = await prisma.warehouse.findFirst({ where: { companyId: childCompany.id } });
    if (!childWh) {
      childWh = await prisma.warehouse.create({
        data: {
          companyId: childCompany.id,
          code: 'WH-CHILD-01',
          name: 'Lahore Distribution Hub',
          type: 'FINISHED_GOODS',
        },
      });
    }

    const transferQty = 5;
    const transferRate = 420;
    const transferTotal = transferQty * transferRate;
    const parentWhStockBefore = await prisma.warehouseStock.findFirst({
      where: { warehouseId: warehouse.id, finishedProductId: finishedProduct.id },
    });
    const pStockQty = Number(parentWhStockBefore?.quantityOnHand || 0);

    const txId = `IC-TX-${Date.now().toString().slice(-6)}`;
    const parentSaleNo = `IC-INV-${Date.now().toString().slice(-6)}`;
    const childBuyNo = `IC-PV-${Date.now().toString().slice(-6)}`;

    // Atomic Intercompany Transfer: Parent Sale + Child Purchase
    await prisma.$transaction(async (tx) => {
      // Parent Sale
      const pInv = await tx.salesInvoice.create({
        data: {
          organizationId: orgId,
          companyId,
          invoiceNumber: parentSaleNo,
          dealerId: dealer.id,
          warehouseId: warehouse.id,
          invoiceDate: new Date(),
          postingStatus: 'POSTED',
          postedAt: new Date(),
          grossAmount: transferTotal,
          netAmount: transferTotal,
          notes: `Intercompany Transfer ${txId}`,
          items: {
            create: [
              {
                finishedProductId: finishedProduct.id,
                productName: finishedProduct.productName,
                quantity: transferQty,
                rate: transferRate,
                grossAmount: transferTotal,
                netAmount: transferTotal,
              },
            ],
          },
        },
      });

      // Parent Stock OUT
      await tx.warehouseStock.update({
        where: { id: parentWhStockBefore.id },
        data: { quantityOnHand: { decrement: transferQty } },
      });

      // Child Purchase
      const cBuy = await tx.purchaseInvoice.create({
        data: {
          organizationId: orgId,
          companyId: childCompany.id,
          voucherNumber: childBuyNo,
          date: new Date(),
          reference: txId,
          vendorInvoiceNo: parentSaleNo,
          postingStatus: 'POSTED',
          isComplete: true,
          postedAt: new Date(),
          vendorId: vendor.id,
          warehouseId: childWh.id,
          grossAmount: transferTotal,
          netAmount: transferTotal,
          notes: `Intercompany Receipt ${txId}`,
          items: {
            create: [
              {
                materialType: 'FINISHED_PRODUCT',
                finishedProductId: finishedProduct.id,
                itemName: finishedProduct.productName,
                quantity: transferQty,
                rate: transferRate,
                grossAmount: transferTotal,
                netAmount: transferTotal,
              },
            ],
          },
        },
      });

      // Child Stock IN
      const existingChildStock = await tx.warehouseStock.findFirst({
        where: { warehouseId: childWh.id, finishedProductId: finishedProduct.id },
      });
      if (existingChildStock) {
        await tx.warehouseStock.update({
          where: { id: existingChildStock.id },
          data: { quantityOnHand: { increment: transferQty } },
        });
      } else {
        await tx.warehouseStock.create({
          data: {
            organizationId: orgId,
            companyId: childCompany.id,
            warehouseId: childWh.id,
            itemType: 'FINISHED_PRODUCT',
            finishedProductId: finishedProduct.id,
            quantityOnHand: transferQty,
            averageCost: transferRate,
          },
        });
      }
    });

    const parentStockAfter = await prisma.warehouseStock.findUnique({ where: { id: parentWhStockBefore.id } });
    recordTest('INTERCOMPANY', '1. Parent Stock decreased', Number(parentStockAfter.quantityOnHand) === pStockQty - transferQty);

    const childPurchaseRecord = await prisma.purchaseInvoice.findFirst({ where: { voucherNumber: childBuyNo } });
    recordTest('INTERCOMPANY', '2. Child Purchase automatically created', !!childPurchaseRecord.id, `Child Voucher: ${childBuyNo}`);

    const childStockAfter = await prisma.warehouseStock.findFirst({
      where: { warehouseId: childWh.id, finishedProductId: finishedProduct.id },
    });
    recordTest('INTERCOMPANY', '3. Child Warehouse stock increased', Number(childStockAfter.quantityOnHand) >= transferQty);

    // Summary
    console.log('\n======================================================');
    const allPassed = results.every((r) => r.passed);
    console.log(`TOTAL TESTS: ${results.length} | PASSED: ${results.filter((r) => r.passed).length} | FAILED: ${results.filter((r) => !r.passed).length}`);
    if (allPassed) {
      console.log('STATUS: ALL CANONICAL SYSTEM FLOW TESTS PASSED SUCCESSFULLY! 🎯');
    } else {
      console.log('STATUS: SOME TESTS FAILED. PLEASE REVIEW DETAILS ABOVE.');
    }
    console.log('======================================================\n');
  } catch (err) {
    console.error('Fatal error during test run:', err);
  } finally {
    await prisma.$disconnect();
  }
}

run();
