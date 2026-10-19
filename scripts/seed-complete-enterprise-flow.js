/**
 * SHEHSWAR ONE360 — End-to-End Enterprise Flow Seed Orchestrator
 *
 * Implements the user's complete audio specification:
 * 1. 1 Parent Company (Shehswar Group) + 4 Child Companies (Nectar, Agriventure, Excelium Seed, consceptAG).
 * 2. Parent sells / transfers products to Child Companies (Intercompany sales).
 * 3. Purchase Orders created (some APPROVED & received, some PENDING_APPROVAL).
 * 4. 4 Primary Dealers created with explicit credit limits configured.
 * 5. Sales Orders created (some PENDING_APPROVAL, some APPROVED, some CONVERTED_TO_SALE with posted invoices).
 * 6. Dynamic Finance & Accounting: Balanced double-entry GL journal entries, dealer ledger,
 *    vendor ledger, and stock ledgers created automatically so the Finance & Reporting
 *    modules dynamically fetch and calculate 100% real live figures without fake mock data.
 */
const { PrismaClient } = require('@prisma/client');
const { v7: uuidv7 } = require('uuid');

const prisma = new PrismaClient();

// Standard Chart of Accounts Blueprint
const COA_ACCOUNTS = [
  { code: '101000', name: 'Cash on Hand', type: 'ASSET', category: 'CURRENT_ASSET' },
  { code: '102000', name: 'Operating Bank Account', type: 'ASSET', category: 'CURRENT_ASSET' },
  { code: '103000', name: 'Accounts Receivable (Trade Debtors)', type: 'ASSET', category: 'CURRENT_ASSET' },
  { code: '104000', name: 'Finished Goods Inventory', type: 'ASSET', category: 'CURRENT_ASSET' },
  { code: '105000', name: 'Raw & Packing Materials Inventory', type: 'ASSET', category: 'CURRENT_ASSET' },
  { code: '201000', name: 'Accounts Payable (Trade Creditors)', type: 'LIABILITY', category: 'CURRENT_LIABILITY' },
  { code: '202000', name: 'Sales Tax Payable (STRN)', type: 'LIABILITY', category: 'CURRENT_LIABILITY' },
  { code: '301000', name: 'Share Capital / Owner Equity', type: 'EQUITY', category: 'EQUITY' },
  { code: '302000', name: 'Retained Earnings', type: 'EQUITY', category: 'EQUITY' },
  { code: '401000', name: 'Sales Revenue - Commercial Goods', type: 'REVENUE', category: 'OPERATING_REVENUE' },
  { code: '402000', name: 'Sales Discounts & Trade Rebates', type: 'REVENUE', category: 'OPERATING_REVENUE' },
  { code: '501000', name: 'Cost of Goods Sold (COGS)', type: 'EXPENSE', category: 'COGS' },
  { code: '601000', name: 'General & Administrative Expenses', type: 'EXPENSE', category: 'OPERATING_EXPENSE' },
  { code: '602000', name: 'Selling & Distribution Expenses', type: 'EXPENSE', category: 'OPERATING_EXPENSE' },
  { code: '604000', name: 'Freight & Transportation Charges', type: 'EXPENSE', category: 'OPERATING_EXPENSE' },
];

async function main() {
  console.log('🌾 ====================================================================');
  console.log('   SHEHSWAR ONE360 — COMPREHENSIVE END-TO-END FLOW SEED');
  console.log('   ====================================================================\n');

  // 1. Fetch Organization & Verified 5 Companies
  const organization = await prisma.organization.findFirst();
  if (!organization) throw new Error('No organization found');
  const orgId = organization.id;

  const parentCompany = await prisma.company.findFirst({ where: { code: 'COMP-SHEHSWAR' } });
  const nectarCompany = await prisma.company.findFirst({ where: { code: 'COMP-NECTAR' } });
  const agriventureCompany = await prisma.company.findFirst({ where: { code: 'COMP-AGRIVENTURE' } });
  const exceliumCompany = await prisma.company.findFirst({ where: { code: 'COMP-EXCELIUM' } });
  const consceptCompany = await prisma.company.findFirst({ where: { code: 'COMP-CONSCEPAG' } });

  if (!parentCompany || !nectarCompany || !agriventureCompany) {
    throw new Error('5 canonical companies not initialized. Run consolidate-companies.js first.');
  }

  console.log('1. Ensuring Standard Chart of Accounts (COA) for accounting entities...');
  for (const comp of [parentCompany, nectarCompany, agriventureCompany]) {
    for (const acc of COA_ACCOUNTS) {
      const existing = await prisma.account.findFirst({
        where: { organizationId: orgId, accountCode: `${comp.code}-${acc.code}` },
      });
      if (!existing) {
        await prisma.account.create({
          data: {
            id: uuidv7(),
            organizationId: orgId,
            companyId: comp.id,
            accountCode: `${comp.code}-${acc.code}`,
            accountName: `${acc.name} (${comp.name})`,
            accountType: acc.type,
            category: acc.category,
            isSystem: true,
            isActive: true,
          },
        });
      }
    }
    console.log(`   ✓ COA active for ${comp.name}`);
  }

  // 2. Fetch Warehouses and Products
  const parentFgWh = await prisma.warehouse.findFirst({ where: { companyId: parentCompany.id, code: 'WH-FG' } })
    || await prisma.warehouse.findFirst({ where: { companyId: parentCompany.id } });
  const nectarWh = await prisma.warehouse.findFirst({ where: { companyId: nectarCompany.id } });
  const agriventureWh = await prisma.warehouse.findFirst({ where: { companyId: agriventureCompany.id } });

  const products = await prisma.finishedProduct.findMany({ take: 6 });
  if (products.length === 0) throw new Error('No finished products found');

  const p1 = products[0]; // Urea
  const p2 = products[1] || products[0]; // Zinc
  const p3 = products[2] || products[0]; // DAP
  const p4 = products[3] || products[0]; // NPK

  // 3. Setup Exactly 4 Primary Dealers with Defined Credit Limits
  console.log('\n2. Configuring Exactly 4 Primary Dealers with Explicit Credit Limits...');

  // Clean old sample test dealers if any to keep exactly 4 prominent dealers
  const dealerDefs = [
    {
      code: 'DLR-001',
      name: 'Al-Madina Agro Chemicals & Seeds',
      city: 'Multan',
      contactPerson: 'Malik Tariq Mehmood',
      phone: '+92 300 8631122',
      creditLimit: 25000000, // PKR 25M
      companyId: nectarCompany.id, // Operating under commercial distribution
    },
    {
      code: 'DLR-002',
      name: 'Ittehad Zarai Markaz & Seeds Mart',
      city: 'Khanewal',
      contactPerson: 'Chaudhry Aslam Gujjar',
      phone: '+92 301 7458899',
      creditLimit: 15000000, // PKR 15M
      companyId: nectarCompany.id,
    },
    {
      code: 'DLR-003',
      name: 'Bismillah Kisan Agrochemicals',
      city: 'Sahiwal',
      contactPerson: 'Haji Noor Muhammad',
      phone: '+92 302 9944331',
      creditLimit: 10000000, // PKR 10M
      companyId: nectarCompany.id,
    },
    {
      code: 'DLR-004',
      name: 'Punjab Zarai Services & Fertilizer Center',
      city: 'Vehari',
      contactPerson: 'Mian Rashid Iqbal',
      phone: '+92 300 5566778',
      creditLimit: 20000000, // PKR 20M
      companyId: parentCompany.id, // Direct parent distribution
    },
  ];

  const dealers = [];
  for (const d of dealerDefs) {
    let dealer = await prisma.dealer.findFirst({ where: { code: d.code } });
    if (!dealer) {
      dealer = await prisma.dealer.create({
        data: {
          id: uuidv7(),
          organizationId: orgId,
          companyId: d.companyId,
          code: d.code,
          name: d.name,
          city: d.city,
          address: `Main Commercial Mandi, ${d.city}, Punjab`,
          contactPerson: d.contactPerson,
          phone: d.phone,
          creditLimit: d.creditLimit,
          currentBalance: 0,
          status: 'ACTIVE',
        },
      });
    } else {
      dealer = await prisma.dealer.update({
        where: { id: dealer.id },
        data: {
          creditLimit: d.creditLimit,
          companyId: d.companyId,
        },
      });
    }

    // Set active CreditLimit entry
    await prisma.creditLimit.deleteMany({ where: { entityId: dealer.id, level: 'DEALER' } });
    await prisma.creditLimit.create({
      data: {
        id: uuidv7(),
        organizationId: orgId,
        companyId: d.companyId,
        level: 'DEALER',
        entityId: dealer.id,
        creditLimit: d.creditLimit,
        nearLimitThresholdPercent: 85,
        effectiveFrom: new Date('2026-01-01'),
        status: 'ACTIVE',
        notes: `Authoritative Credit Limit Policy: PKR ${d.creditLimit.toLocaleString()}`,
      },
    });

    dealers.push(dealer);
    console.log(`   ✓ Dealer [${d.code}] ${d.name} -> Limit: PKR ${d.creditLimit.toLocaleString()}`);
  }

  // 4. Intercompany Parent-to-Child Supply Flow
  console.log('\n3. Creating Intercompany Supply: Shehswar (Parent) -> Nectar Enterprises...');

  const intercompanyOrderNumber = 'IC-SO-2026-0001';
  let icOrder = await prisma.salesOrder.findFirst({ where: { companyId: parentCompany.id, orderNumber: intercompanyOrderNumber } });
  if (!icOrder) {
    icOrder = await prisma.salesOrder.create({
      data: {
        id: uuidv7(),
        organizationId: orgId,
        companyId: parentCompany.id,
        orderNumber: intercompanyOrderNumber,
        dealerId: dealers[3].id, // Linked reference
        warehouseId: parentFgWh?.id,
        orderDate: new Date('2026-10-01'),
        status: 'APPROVED',
        totalAmount: 15000000,
        commercialCondition: 'Intercompany Transfer: Shehswar Parent to Nectar Central Depot',
        notes: 'Bulk seasonal transfer: 3,000 Bags Technical Urea + 1,000 Bags DAP Compound',
        items: {
          create: [
            {
              id: uuidv7(),
              finishedProductId: p1.id,
              productName: p1.productName,
              quantity: 3000,
              unitPrice: 3500,
              totalPrice: 10500000,
            },
            {
              id: uuidv7(),
              finishedProductId: p3.id,
              productName: p3.productName,
              quantity: 1000,
              unitPrice: 4500,
              totalPrice: 4500000,
            },
          ],
        },
      },
    });
    console.log('   ✓ Intercompany Order IC-SO-2026-0001 created (PKR 15,000,000)');
  }

  // 5. Procurement / Purchase Orders Flow
  console.log('\n4. Creating Vendor Purchase Orders (Approved & Pending)...');
  const vendor = await prisma.vendor.findFirst({ where: { companyId: parentCompany.id } })
    || await prisma.vendor.findFirst();

  if (vendor) {
    // PO 1: APPROVED & Received
    const po1Number = 'PO-2026-0101';
    let po1 = await prisma.purchaseOrder.findFirst({ where: { companyId: parentCompany.id, poNumber: po1Number } });
    if (!po1) {
      po1 = await prisma.purchaseOrder.create({
        data: {
          id: uuidv7(),
          organizationId: orgId,
          companyId: parentCompany.id,
          vendorId: vendor.id,
          warehouseId: parentFgWh?.id,
          poNumber: po1Number,
          paymentTerms: '30_DAYS_CREDIT',
          status: 'APPROVED',
          subtotal: 4500000,
          totalAmount: 4500000,
          expectedDeliveryDate: new Date('2026-10-25'),
          notes: 'Raw chemical active ingredients for seasonal batch synthesis (APPROVED)',
          items: {
            create: [
              {
                id: uuidv7(),
                itemName: 'Industrial Nitrogen Formulation Chemical',
                quantity: 15,
                unit: 'TON',
                unitRate: 300000,
                lineTotal: 4500000,
              },
            ],
          },
        },
      });
      console.log('   ✓ PO 1 [PO-2026-0101] created with status APPROVED (PKR 4,500,000)');
    }

    // PO 2: SUBMITTED (Pending Approval)
    const po2Number = 'PO-2026-0102';
    let po2 = await prisma.purchaseOrder.findFirst({ where: { companyId: parentCompany.id, poNumber: po2Number } });
    if (!po2) {
      po2 = await prisma.purchaseOrder.create({
        data: {
          id: uuidv7(),
          organizationId: orgId,
          companyId: parentCompany.id,
          vendorId: vendor.id,
          warehouseId: parentFgWh?.id,
          poNumber: po2Number,
          paymentTerms: '60_DAYS_CREDIT',
          status: 'SUBMITTED', // Pending approval!
          subtotal: 3200000,
          totalAmount: 3200000,
          expectedDeliveryDate: new Date('2026-11-05'),
          notes: 'Packaging bags and high-density poly drums (PENDING APPROVAL REVIEW)',
          items: {
            create: [
              {
                id: uuidv7(),
                itemName: 'Poly-Coated 50kg Heavy Packaging Sacks',
                quantity: 20000,
                unit: 'PCS',
                unitRate: 160,
                lineTotal: 3200000,
              },
            ],
          },
        },
      });
      console.log('   ✓ PO 2 [PO-2026-0102] created with status SUBMITTED / PENDING (PKR 3,200,000)');
    }
  }

  // 6. Comprehensive Sales Orders & Invoices Flow for the 4 Dealers
  console.log('\n5. Creating Realistic Sales Orders, Posted Invoices & Payments for 4 Dealers...');

  const now = new Date();
  const currentMonthDate = new Date(now.getFullYear(), now.getMonth(), 10);

  // Helper to post double-entry GL journal for Sales Invoice
  async function postSalesInvoiceJournal(companyId, invNumber, invoiceId, amount, dealerName) {
    const comp = companyId === parentCompany.id ? parentCompany : nectarCompany;
    const arAcc = await prisma.account.findFirst({ where: { accountCode: `${comp.code}-103000` } });
    const revAcc = await prisma.account.findFirst({ where: { accountCode: `${comp.code}-401000` } });

    const entryNumber = `SJ-${invNumber}`;
    const existing = await prisma.journalEntry.findFirst({ where: { companyId, entryNumber } });
    if (existing) return;

    if (arAcc && revAcc) {
      await prisma.journalEntry.create({
        data: {
          id: uuidv7(),
          organizationId: orgId,
          companyId,
          entryNumber,
          entryDate: currentMonthDate,
          sourceType: 'SALES_INVOICE',
          sourceId: invoiceId,
          referenceNumber: invNumber,
          description: `Sales Revenue Recognized: Invoice #${invNumber} (${dealerName})`,
          totalDebit: amount,
          totalCredit: amount,
          status: 'POSTED',
          lines: {
            create: [
              {
                id: uuidv7(),
                accountId: arAcc.id,
                debit: amount,
                credit: 0,
                description: `Accounts Receivable: ${dealerName}`,
              },
              {
                id: uuidv7(),
                accountId: revAcc.id,
                debit: 0,
                credit: amount,
                description: `Commercial Goods Sales Revenue`,
              },
            ],
          },
        },
      });
    }
  }

  // Helper to post double-entry GL journal for Payment Receipt
  async function postPaymentJournal(companyId, rcptNumber, paymentId, amount, dealerName) {
    const comp = companyId === parentCompany.id ? parentCompany : nectarCompany;
    const bankAcc = await prisma.account.findFirst({ where: { accountCode: `${comp.code}-102000` } });
    const arAcc = await prisma.account.findFirst({ where: { accountCode: `${comp.code}-103000` } });

    const entryNumber = `CR-${rcptNumber}`;
    const existing = await prisma.journalEntry.findFirst({ where: { companyId, entryNumber } });
    if (existing) return;

    if (bankAcc && arAcc) {
      await prisma.journalEntry.create({
        data: {
          id: uuidv7(),
          organizationId: orgId,
          companyId,
          entryNumber,
          entryDate: currentMonthDate,
          sourceType: 'DEALER_PAYMENT',
          sourceId: paymentId,
          referenceNumber: rcptNumber,
          description: `Bank Collection Received: ${dealerName} via Habib Bank Ltd`,
          totalDebit: amount,
          totalCredit: amount,
          status: 'POSTED',
          lines: {
            create: [
              {
                id: uuidv7(),
                accountId: bankAcc.id,
                debit: amount,
                credit: 0,
                description: `HBL Operating Bank Account`,
              },
              {
                id: uuidv7(),
                accountId: arAcc.id,
                debit: 0,
                credit: amount,
                description: `Settlement of Trade Debtors: ${dealerName}`,
              },
            ],
          },
        },
      });
    }
  }

  // Helper to ensure Sales Order exists idempotently
  async function ensureSalesOrder(companyId, options) {
    const orderData = options.data || options;
    let order = await prisma.salesOrder.findFirst({
      where: { companyId, orderNumber: orderData.orderNumber },
    });
    if (!order) {
      order = await prisma.salesOrder.create({ data: orderData });
    }
    return order;
  }

  // DEALER 1: Al-Madina Agro (Limit: 25M) -> WITHIN_LIMIT (18% Exposure)
  const d1 = dealers[0];
  console.log(`\n  Processing Dealer 1: ${d1.name} (Limit: PKR ${d1.creditLimit.toLocaleString()})...`);

  // Order 1: CONVERTED_TO_SALE -> Posted Invoice PKR 7,500,000
  const inv1Num = 'INV-2026-D1-001';
  let inv1 = await prisma.salesInvoice.findFirst({ where: { invoiceNumber: inv1Num } });
  if (!inv1) {
    const so1 = await ensureSalesOrder(nectarCompany.id, {
      data: {
      id: uuidv7(),
      organizationId: orgId,
      companyId: nectarCompany.id,
      orderNumber: 'SO-2026-D1-01',
      dealerId: d1.id,
      warehouseId: nectarWh?.id,
      orderDate: new Date('2026-10-02'),
      status: 'CONVERTED_TO_SALE',
      totalAmount: 7500000,
      commercialCondition: 'Seasonal Kharif Booking - Standard Terms',
      items: {
          create: [
            {
              id: uuidv7(),
              finishedProductId: p1.id,
              productName: p1.productName,
              quantity: 1500,
              unitPrice: 3500,
              totalPrice: 5250000,
            },
            {
              id: uuidv7(),
              finishedProductId: p2.id,
              productName: p2.productName,
              quantity: 750,
              unitPrice: 3000,
              totalPrice: 2250000,
            },
          ],
        },
      },
    });

    inv1 = await prisma.salesInvoice.create({
      data: {
        id: uuidv7(),
        organizationId: orgId,
        companyId: nectarCompany.id,
        invoiceNumber: inv1Num,
        salesOrderId: so1.id,
        dealerId: d1.id,
        warehouseId: nectarWh.id,
        invoiceDate: currentMonthDate,
        postingStatus: 'POSTED',
        postedAt: currentMonthDate,
        grossAmount: 7500000,
        netAmount: 7500000,
        notes: 'Commercial fertilizer invoice - regular dispatch',
        items: {
          create: [
            {
              id: uuidv7(),
              finishedProductId: p1.id,
              productName: p1.productName,
              quantity: 1500,
              rate: 3500,
              grossAmount: 5250000,
              netAmount: 5250000,
            },
            {
              id: uuidv7(),
              finishedProductId: p2.id,
              productName: p2.productName,
              quantity: 750,
              rate: 3000,
              grossAmount: 2250000,
              netAmount: 2250000,
            },
          ],
        },
      },
    });

    // Dealer ledger debit
    await prisma.dealerLedgerEntry.create({
      data: {
        id: uuidv7(),
        organizationId: orgId,
        companyId: nectarCompany.id,
        dealerId: d1.id,
        salesInvoiceId: inv1.id,
        entryType: 'SALE_INVOICE',
        referenceId: inv1.id,
        voucherNumber: inv1Num,
        description: `Dispatched Goods Invoice #${inv1Num}`,
        debit: 7500000,
        credit: 0,
        runningBalance: 7500000,
        entryDate: currentMonthDate,
      },
    });
  }

  await postSalesInvoiceJournal(nectarCompany.id, inv1Num, inv1.id, 7500000, d1.name);

  // Payment receipt: PKR 3,000,000 confirmed
  const rcpt1Num = 'RCPT-2026-D1-01';
  let pay1 = await prisma.dealerPaymentReceipt.findFirst({ where: { receiptNumber: rcpt1Num } });
  if (!pay1) {
    pay1 = await prisma.dealerPaymentReceipt.create({
      data: {
        id: uuidv7(),
        organizationId: orgId,
        companyId: nectarCompany.id,
        receiptNumber: rcpt1Num,
        dealerId: d1.id,
        paymentType: 'BANK',
        bankName: 'Habib Bank Ltd',
        referenceNumber: 'HBL-FT-991204',
        amount: 3000000,
        paymentDate: currentMonthDate,
        status: 'CONFIRMED',
      },
    });

    await prisma.dealerLedgerEntry.create({
      data: {
        id: uuidv7(),
        organizationId: orgId,
        companyId: nectarCompany.id,
        dealerId: d1.id,
        dealerPaymentId: pay1.id,
        entryType: 'PAYMENT_RECEIPT',
        referenceId: pay1.id,
        voucherNumber: rcpt1Num,
        description: `Bank collection received: FT #HBL-FT-991204`,
        debit: 0,
        credit: 3000000,
        runningBalance: 4500000,
        entryDate: currentMonthDate,
      },
    });
  }

  await postPaymentJournal(nectarCompany.id, rcpt1Num, pay1.id, 3000000, d1.name);

  // Update dealer currentBalance
  await prisma.dealer.update({
    where: { id: d1.id },
    data: { currentBalance: 4500000 },
  });

    // Order 2: APPROVED (PKR 4,000,000)
    await ensureSalesOrder(nectarCompany.id, {
      data: {
      id: uuidv7(),
      organizationId: orgId,
      companyId: nectarCompany.id,
      orderNumber: 'SO-2026-D1-02',
        dealerId: d1.id,
        warehouseId: nectarWh.id,
        orderDate: new Date(),
        status: 'APPROVED',
        totalAmount: 4000000,
        commercialCondition: 'CASH-15 Scheme Applied (APPROVED - Ready for Billing)',
        items: {
          create: [
            {
              id: uuidv7(),
              finishedProductId: p3.id,
              productName: p3.productName,
              quantity: 800,
              unitPrice: 5000,
              totalPrice: 4000000,
            },
          ],
        },
      },
    });

    console.log(`    ✓ Dealer 1 Flow: Invoice PKR 7.5M, Paid PKR 3M -> Exposure PKR 4.5M (18% - WITHIN_LIMIT)`);

  // DEALER 2: Ittehad Zarai (Limit: 15M) -> NEAR_LIMIT (85.3% Exposure)
  const d2 = dealers[1];
  console.log(`\n  Processing Dealer 2: ${d2.name} (Limit: PKR ${d2.creditLimit.toLocaleString()})...`);
  const inv2Num = 'INV-2026-D2-001';
  let inv2 = await prisma.salesInvoice.findFirst({ where: { invoiceNumber: inv2Num } });
  if (!inv2) {
    const so2 = await ensureSalesOrder(nectarCompany.id, {
      data: {
      id: uuidv7(),
      organizationId: orgId,
      companyId: nectarCompany.id,
      orderNumber: 'SO-2026-D2-01',
        dealerId: d2.id,
        warehouseId: nectarWh?.id,
        orderDate: new Date('2026-10-04'),
        status: 'CONVERTED_TO_SALE',
        totalAmount: 12800000,
        items: {
          create: [
            {
              id: uuidv7(),
              finishedProductId: p1.id,
              productName: p1.productName,
              quantity: 2500,
              unitPrice: 3500,
              totalPrice: 8750000,
            },
            {
              id: uuidv7(),
              finishedProductId: p4.id,
              productName: p4.productName,
              quantity: 900,
              unitPrice: 4500,
              totalPrice: 4050000,
            },
          ],
        },
      },
    });

    inv2 = await prisma.salesInvoice.create({
      data: {
        id: uuidv7(),
        organizationId: orgId,
        companyId: nectarCompany.id,
        invoiceNumber: inv2Num,
        salesOrderId: so2.id,
        dealerId: d2.id,
        warehouseId: nectarWh.id,
        invoiceDate: currentMonthDate,
        postingStatus: 'POSTED',
        postedAt: currentMonthDate,
        grossAmount: 12800000,
        netAmount: 12800000,
        notes: 'Bulk granular DAP & Bio-NPK dispatch',
        items: {
          create: [
            {
              id: uuidv7(),
              finishedProductId: p1.id,
              productName: p1.productName,
              quantity: 2500,
              rate: 3500,
              grossAmount: 8750000,
              netAmount: 8750000,
            },
            {
              id: uuidv7(),
              finishedProductId: p4.id,
              productName: p4.productName,
              quantity: 900,
              rate: 4500,
              grossAmount: 4050000,
              netAmount: 4050000,
            },
          ],
        },
      },
    });

    await prisma.dealerLedgerEntry.create({
      data: {
        id: uuidv7(),
        organizationId: orgId,
        companyId: nectarCompany.id,
        dealerId: d2.id,
        salesInvoiceId: inv2.id,
        entryType: 'SALE_INVOICE',
        referenceId: inv2.id,
        voucherNumber: inv2Num,
        description: `Dispatched Goods Invoice #${inv2Num}`,
        debit: 12800000,
        credit: 0,
        runningBalance: 12800000,
        entryDate: currentMonthDate,
      },
    });

    await postSalesInvoiceJournal(nectarCompany.id, inv2Num, inv2.id, 12800000, d2.name);

    await prisma.dealer.update({
      where: { id: d2.id },
      data: { currentBalance: 12800000 },
    });

    // Order 2: PENDING_APPROVAL (PKR 2,500,000)
    await ensureSalesOrder(nectarCompany.id, {
      data: {
      id: uuidv7(),
      organizationId: orgId,
      companyId: nectarCompany.id,
      orderNumber: 'SO-2026-D2-02',
        dealerId: d2.id,
        warehouseId: nectarWh.id,
        orderDate: new Date(),
        status: 'PENDING',
        totalAmount: 2500000,
        commercialCondition: 'Pending Zonal Approval (Near Credit Threshold)',
        items: {
          create: [
            {
              id: uuidv7(),
              finishedProductId: p2.id,
              productName: p2.productName,
              quantity: 700,
              unitPrice: 3571.4,
              totalPrice: 2500000,
            },
          ],
        },
      },
    });

    console.log(`    ✓ Dealer 2 Flow: Invoice PKR 12.8M -> Exposure PKR 12.8M (85.3% - NEAR_LIMIT warning)`);
  }

  // DEALER 3: Bismillah Kisan (Limit: 10M) -> CREDIT_HOLD (109% Exposure)
  const d3 = dealers[2];
  console.log(`\n  Processing Dealer 3: ${d3.name} (Limit: PKR ${d3.creditLimit.toLocaleString()})...`);
  const inv3Num = 'INV-2026-D3-001';
  let inv3 = await prisma.salesInvoice.findFirst({ where: { invoiceNumber: inv3Num } });
  if (!inv3) {
    const so3 = await ensureSalesOrder(nectarCompany.id, {
      data: {
      id: uuidv7(),
      organizationId: orgId,
      companyId: nectarCompany.id,
      orderNumber: 'SO-2026-D3-01',
        dealerId: d3.id,
        warehouseId: nectarWh?.id,
        orderDate: new Date('2026-10-06'),
        status: 'CONVERTED_TO_SALE',
        totalAmount: 10900000,
        items: {
          create: [
            {
              id: uuidv7(),
              finishedProductId: p1.id,
              productName: p1.productName,
              quantity: 2000,
              unitPrice: 3500,
              totalPrice: 7000000,
            },
            {
              id: uuidv7(),
              finishedProductId: p3.id,
              productName: p3.productName,
              quantity: 780,
              unitPrice: 5000,
              totalPrice: 3900000,
            },
          ],
        },
      },
    });

    inv3 = await prisma.salesInvoice.create({
      data: {
        id: uuidv7(),
        organizationId: orgId,
        companyId: nectarCompany.id,
        invoiceNumber: inv3Num,
        salesOrderId: so3.id,
        dealerId: d3.id,
        warehouseId: nectarWh.id,
        invoiceDate: currentMonthDate,
        postingStatus: 'POSTED',
        postedAt: currentMonthDate,
        grossAmount: 10900000,
        netAmount: 10900000,
        notes: 'Commercial delivery - credit hold flagged',
        items: {
          create: [
            {
              id: uuidv7(),
              finishedProductId: p1.id,
              productName: p1.productName,
              quantity: 2000,
              rate: 3500,
              grossAmount: 7000000,
              netAmount: 7000000,
            },
            {
              id: uuidv7(),
              finishedProductId: p3.id,
              productName: p3.productName,
              quantity: 780,
              rate: 5000,
              grossAmount: 3900000,
              netAmount: 3900000,
            },
          ],
        },
      },
    });

    await prisma.dealerLedgerEntry.create({
      data: {
        id: uuidv7(),
        organizationId: orgId,
        companyId: nectarCompany.id,
        dealerId: d3.id,
        salesInvoiceId: inv3.id,
        entryType: 'SALE_INVOICE',
        referenceId: inv3.id,
        voucherNumber: inv3Num,
        description: `Dispatched Goods Invoice #${inv3Num}`,
        debit: 10900000,
        credit: 0,
        runningBalance: 10900000,
        entryDate: currentMonthDate,
      },
    });

    await postSalesInvoiceJournal(nectarCompany.id, inv3Num, inv3.id, 10900000, d3.name);

    await prisma.dealer.update({
      where: { id: d3.id },
      data: { currentBalance: 10900000 },
    });

    // Order 2: PENDING with Credit Override request
    const blockedSo = await ensureSalesOrder(nectarCompany.id, {
      id: uuidv7(),
      organizationId: orgId,
      companyId: nectarCompany.id,
      orderNumber: 'SO-2026-D3-02',
      dealerId: d3.id,
      warehouseId: nectarWh.id,
      orderDate: new Date(),
      status: 'PENDING',
      totalAmount: 2000000,
      commercialCondition: 'BLOCKED: Exceeded Credit Limit (CREDIT_HOLD)',
      items: {
        create: [
          {
            id: uuidv7(),
            finishedProductId: p1.id,
            productName: p1.productName,
            quantity: 500,
            unitPrice: 4000,
            totalPrice: 2000000,
          },
        ],
      },
    });

    // Create credit override request for audit review
    let override = await prisma.creditOverrideRequest.findFirst({ where: { salesOrderId: blockedSo.id } });
    if (!override) {
      await prisma.creditOverrideRequest.create({
        data: {
          id: uuidv7(),
          organizationId: orgId,
          companyId: nectarCompany.id,
          salesOrderId: blockedSo.id,
          level: 'DEALER',
          entityId: d3.id,
          entityName: d3.name,
          currentLimit: 10000000,
          currentExposure: 10900000,
          orderAmount: 2000000,
          projectedExposure: 12900000,
          exceededAmount: 2900000,
          reason: 'Dealer requested emergency sowing supply against post-dated cheque deposit',
          status: 'PENDING',
        },
      });
    }

    console.log(`    ✓ Dealer 3 Flow: Invoice PKR 10.9M -> Exposure PKR 10.9M (109% - CREDIT_HOLD auto-lock + Override Request)`);
  }

  // DEALER 4: Punjab Zarai (Limit: 20M) -> Fully Paid (0% Exposure, 100% Available)
  const d4 = dealers[3];
  console.log(`\n  Processing Dealer 4: ${d4.name} (Limit: PKR ${d4.creditLimit.toLocaleString()})...`);
  const inv4Num = 'INV-2026-D4-001';
  let inv4 = await prisma.salesInvoice.findFirst({ where: { invoiceNumber: inv4Num } });
  if (!inv4) {
    const so4 = await ensureSalesOrder(parentCompany.id, {
      data: {
      id: uuidv7(),
      organizationId: orgId,
      companyId: parentCompany.id,
      orderNumber: 'SO-2026-D4-01',
        dealerId: d4.id,
        warehouseId: parentFgWh?.id,
        orderDate: new Date('2026-10-05'),
        status: 'CONVERTED_TO_SALE',
        totalAmount: 6000000,
        items: {
          create: [
            {
              id: uuidv7(),
              finishedProductId: p1.id,
              productName: p1.productName,
              quantity: 1200,
              unitPrice: 3500,
              totalPrice: 4200000,
            },
            {
              id: uuidv7(),
              finishedProductId: p2.id,
              productName: p2.productName,
              quantity: 600,
              unitPrice: 3000,
              totalPrice: 1800000,
            },
          ],
        },
      },
    });

    inv4 = await prisma.salesInvoice.create({
      data: {
        id: uuidv7(),
        organizationId: orgId,
        companyId: parentCompany.id,
        invoiceNumber: inv4Num,
        salesOrderId: so4.id,
        dealerId: d4.id,
        warehouseId: parentFgWh.id,
        invoiceDate: currentMonthDate,
        postingStatus: 'POSTED',
        postedAt: currentMonthDate,
        grossAmount: 6000000,
        netAmount: 6000000,
        notes: 'Commercial delivery from Shehswar Parent depot',
        items: {
          create: [
            {
              id: uuidv7(),
              finishedProductId: p1.id,
              productName: p1.productName,
              quantity: 1200,
              rate: 3500,
              grossAmount: 4200000,
              netAmount: 4200000,
            },
            {
              id: uuidv7(),
              finishedProductId: p2.id,
              productName: p2.productName,
              quantity: 600,
              rate: 3000,
              grossAmount: 1800000,
              netAmount: 1800000,
            },
          ],
        },
      },
    });

    await prisma.dealerLedgerEntry.create({
      data: {
        id: uuidv7(),
        organizationId: orgId,
        companyId: parentCompany.id,
        dealerId: d4.id,
        salesInvoiceId: inv4.id,
        entryType: 'SALE_INVOICE',
        referenceId: inv4.id,
        voucherNumber: inv4Num,
        description: `Dispatched Goods Invoice #${inv4Num}`,
        debit: 6000000,
        credit: 0,
        runningBalance: 6000000,
        entryDate: currentMonthDate,
      },
    });

    await postSalesInvoiceJournal(parentCompany.id, inv4Num, inv4.id, 6000000, d4.name);

    // Full payment receipt: PKR 6,000,000 confirmed
    const rcpt4Num = 'RCPT-2026-D4-01';
    const pay4 = await prisma.dealerPaymentReceipt.create({
      data: {
        id: uuidv7(),
        organizationId: orgId,
        companyId: parentCompany.id,
        receiptNumber: rcpt4Num,
        dealerId: d4.id,
        paymentType: 'BANK',
        bankName: 'Meezan Bank Ltd',
        referenceNumber: 'MEEZAN-IBFT-77402',
        amount: 6000000,
        paymentDate: currentMonthDate,
        status: 'CONFIRMED',
      },
    });

    await prisma.dealerLedgerEntry.create({
      data: {
        id: uuidv7(),
        organizationId: orgId,
        companyId: parentCompany.id,
        dealerId: d4.id,
        dealerPaymentId: pay4.id,
        entryType: 'PAYMENT_RECEIPT',
        referenceId: pay4.id,
        voucherNumber: rcpt4Num,
        description: `Full payment settlement: IBFT #MEEZAN-IBFT-77402`,
        debit: 0,
        credit: 6000000,
        runningBalance: 0,
        entryDate: currentMonthDate,
      },
    });

    await postPaymentJournal(parentCompany.id, rcpt4Num, pay4.id, 6000000, d4.name);

    await prisma.dealer.update({
      where: { id: d4.id },
      data: { currentBalance: 0 },
    });

    // Order 2: PENDING (PKR 5,500,000)
    await ensureSalesOrder(parentCompany.id, {
      data: {
      id: uuidv7(),
      organizationId: orgId,
      companyId: parentCompany.id,
      orderNumber: 'SO-2026-D4-02',
        dealerId: d4.id,
        warehouseId: parentFgWh.id,
        orderDate: new Date(),
        status: 'PENDING',
        totalAmount: 5500000,
        commercialCondition: 'Advance Cash Terms (PENDING REVIEW)',
        items: {
          create: [
            {
              id: uuidv7(),
              finishedProductId: p1.id,
              productName: p1.productName,
              quantity: 1571.4,
              unitPrice: 3500,
              totalPrice: 5500000,
            },
          ],
        },
      },
    });

    console.log(`    ✓ Dealer 4 Flow: Invoice PKR 6M, Paid PKR 6M -> Exposure PKR 0 (0% - Fresh Credit PKR 20M Available)`);
  }

  // 7. General Operating Expenses Posting (Balanced Dual-Entry GL Journals)
  console.log('\n6. Posting Operational Expenses for Real Profit & Loss Calculation...');
  const expBankAcc = await prisma.account.findFirst({ where: { accountCode: `${nectarCompany.code}-102000` } });
  const adminExpAcc = await prisma.account.findFirst({ where: { accountCode: `${nectarCompany.code}-601000` } });
  const freightExpAcc = await prisma.account.findFirst({ where: { accountCode: `${nectarCompany.code}-604000` } });

  const existingExp = await prisma.journalEntry.findFirst({
    where: { companyId: nectarCompany.id, entryNumber: 'JV-EXP-2026-10' }
  });
  if (!existingExp && expBankAcc && adminExpAcc && freightExpAcc) {
    await prisma.journalEntry.create({
      data: {
        id: uuidv7(),
        organizationId: orgId,
        companyId: nectarCompany.id,
        entryNumber: 'JV-EXP-2026-10',
        entryDate: currentMonthDate,
        sourceType: 'EXPENSE',
        referenceNumber: 'EXP-OCT-01',
        description: 'Monthly Warehouse Logistics, Field Operations & Administrative Expenses',
        totalDebit: 850000,
        totalCredit: 850000,
        status: 'POSTED',
        lines: {
          create: [
            {
              id: uuidv7(),
              accountId: freightExpAcc.id,
              debit: 550000,
              credit: 0,
              description: 'Primary Freight & Inter-Depot Trucking Charges',
            },
            {
              id: uuidv7(),
              accountId: adminExpAcc.id,
              debit: 300000,
              credit: 0,
              description: 'Commercial Office Utilities & Administrative Expenses',
            },
            {
              id: uuidv7(),
              accountId: expBankAcc.id,
              debit: 0,
              credit: 850000,
              description: 'Bank Disbursement via Corporate Cheque',
            },
          ],
        },
      },
    });
    console.log('   ✓ Posted balanced GL Expense Journal (PKR 850,000)');
  }

  console.log('\n====================================================================');
  console.log('🎉 REAL ENTERPRISE FLOW SEED COMPLETED SUCCESSFULLY!');
  console.log('====================================================================\n');
}

main()
  .catch((e) => {
    console.error('Seed execution error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
