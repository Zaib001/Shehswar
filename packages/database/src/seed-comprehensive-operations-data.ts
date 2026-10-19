/**
 * SHEHSWAR ONE360 - Comprehensive Operations Data Seeder
 *
 * Populates realistic, interconnected enterprise data across:
 * 1. Multi-Company Structure (Shehswar, Nectar, AgriventurePakistan, ConsceptAG, Excelium SEEd)
 * 2. Standard Chart of Accounts (COA) for all companies
 * 3. 5-Tier Hierarchical Market Structure & Users
 * 4. 5-Tier Credit Limits (Region, Zone, Territory, Sales Officer, Dealer)
 * 5. Independent Sales Targets (2026) vs Credit Limits
 * 6. Credit Override Requests (Pending, Approved, Rejected)
 * 7. Sales Orders across full lifecycle (PENDING, APPROVED, CREDIT_HOLD, INVOICED)
 * 8. Posted Sales Invoices & Balanced Double-Entry GL Journals
 * 9. Posted Procurement / Purchase Invoices & Vendor Balances
 * 10. Dealer Collection Payments & Dynamic Credit Exposure Release
 * 11. Categorized Operating Expenses with balanced GL postings
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { v7 as uuidv7 } from 'uuid';

const prisma = new PrismaClient();

async function main() {
  console.log('========================================================================');
  console.log('🌱 SHEHSWAR ONE360 - POPULATING REALISTIC OPERATIONAL & FINANCIAL DATA');
  console.log('========================================================================\n');

  // 1. Locate Organization
  const org = await prisma.organization.findFirst({
    where: { code: 'ORG-SHEHSWAR-GRP' },
  });
  if (!org) {
    throw new Error('Organization ORG-SHEHSWAR-GRP not found! Run base seed first.');
  }
  const orgId = org.id;
  console.log(`✅ Organization: ${org.name} (${orgId})`);

  // 2. Ensure All 5 Companies Exist
  const companyDefs = [
    { code: 'CO-SHEHSWAR-PARENT', name: 'Shehswar Manufacturing (Parent)', type: 'PARENT_MANUFACTURING' },
    { code: 'CO-NECTAR', name: 'Nectar Agrochemicals', type: 'CHILD_COMPANY' },
    { code: 'CO-AGRIVENTURE', name: 'Agriventure Pakistan', type: 'CHILD_COMPANY' },
    { code: 'CO-CONSCEPAG', name: 'ConsceptAG Crop Sciences', type: 'CHILD_COMPANY' },
    { code: 'CO-EXCELIUM', name: 'Excelium SEEd Technologies', type: 'CHILD_COMPANY' },
  ];

  const companies: Record<string, any> = {};
  for (const cDef of companyDefs) {
    const comp = await prisma.company.upsert({
      where: {
        organizationId_code: {
          organizationId: orgId,
          code: cDef.code,
        },
      },
      update: { name: cDef.name, companyType: cDef.type },
      create: {
        id: uuidv7(),
        organizationId: orgId,
        code: cDef.code,
        name: cDef.name,
        companyType: cDef.type,
        currencyCode: 'PKR',
        isActive: true,
        status: 'ACTIVE',
      },
    });
    companies[cDef.code] = comp;
  }
  console.log(`✅ Verified ${Object.keys(companies).length} Corporate Entities.`);

  // 3. Ensure Chart of Accounts (COA) for all Companies
  const DEFAULT_ACCOUNTS = [
    { code: '101000', name: 'Cash on Hand', type: 'ASSET', category: 'CURRENT_ASSET' },
    { code: '102000', name: 'Operating Bank Account (Meezan/HBL)', type: 'ASSET', category: 'CURRENT_ASSET' },
    { code: '103000', name: 'Accounts Receivable (Trade Debtors)', type: 'ASSET', category: 'CURRENT_ASSET' },
    { code: '104000', name: 'Finished Goods Inventory', type: 'ASSET', category: 'CURRENT_ASSET' },
    { code: '201000', name: 'Accounts Payable (Trade Creditors)', type: 'LIABILITY', category: 'CURRENT_LIABILITY' },
    { code: '202000', name: 'Sales Tax Payable (FBR/PRA)', type: 'LIABILITY', category: 'CURRENT_LIABILITY' },
    { code: '301000', name: 'Owner Equity & Retained Earnings', type: 'EQUITY', category: 'EQUITY' },
    { code: '401000', name: 'Sales Revenue - Commercial Agri Goods', type: 'REVENUE', category: 'OPERATING_REVENUE' },
    { code: '501000', name: 'Cost of Goods Sold (COGS)', type: 'EXPENSE', category: 'COGS' },
    { code: '601000', name: 'Operating & Admin Expenses', type: 'EXPENSE', category: 'OPERATING_EXPENSE' },
  ];

  const accountsMap: Record<string, any> = {};
  for (const comp of Object.values(companies)) {
    for (const acc of DEFAULT_ACCOUNTS) {
      const dbAcc = await prisma.account.upsert({
        where: {
          organizationId_accountCode: {
            organizationId: orgId,
            accountCode: acc.code,
          },
        },
        update: { accountName: acc.name, accountType: acc.type, category: acc.category },
        create: {
          id: uuidv7(),
          organizationId: orgId,
          companyId: comp.id,
          accountCode: acc.code,
          accountName: acc.name,
          accountType: acc.type,
          category: acc.category,
          currentBalance: 0,
          currency: 'PKR',
          isActive: true,
          isSystem: true,
        },
      });
      accountsMap[acc.code] = dbAcc;
    }
  }
  console.log('✅ Chart of Accounts provisioned for all companies.');

  // 4. Ensure Warehouses and Finished Products
  const nectar = companies['CO-NECTAR'];
  const shehswar = companies['CO-SHEHSWAR-PARENT'];

  const warehouseNectar = await prisma.warehouse.upsert({
    where: { companyId_code: { companyId: nectar.id, code: 'WH-NECTAR-CENTRAL' } },
    update: {},
    create: {
      id: uuidv7(),
      companyId: nectar.id,
      code: 'WH-NECTAR-CENTRAL',
      name: 'Nectar Multan Central Logistics Hub',
      type: 'FINISHED_GOODS',
      address: 'Multan Industrial Estate, Phase 2, Multan',
      isActive: true,
    },
  });

  await prisma.warehouse.upsert({
    where: { companyId_code: { companyId: shehswar.id, code: 'WH-SHEHSWAR-HQ' } },
    update: {},
    create: {
      id: uuidv7(),
      companyId: shehswar.id,
      code: 'WH-SHEHSWAR-HQ',
      name: 'Shehswar Parent Manufacturing Plant & Depot',
      type: 'FINISHED_GOODS',
      address: 'Plot 45-B, Sundar Industrial Estate, Lahore',
      isActive: true,
    },
  });

  const productsData = [
    { code: 'PROD-ZINC-33', name: 'Premium Zinc Sulphate 33% 10kg', price: 4200, companyId: nectar.id },
    { code: 'PROD-NPK-BOOST', name: 'Bio-NPK Liquid Formula 1 Litre', price: 2800, companyId: nectar.id },
    { code: 'PROD-BORON-20', name: 'Agri-Boron Soluble 20% 500g', price: 1750, companyId: nectar.id },
    { code: 'PROD-UREA-PLUS', name: 'Super Urea Slow Release 50kg', price: 5400, companyId: shehswar.id },
    { code: 'PROD-PEST-ULTRA', name: 'Pesticide Ultra Defender 1L', price: 3600, companyId: nectar.id },
  ];

  const products: Record<string, any> = {};
  for (const p of productsData) {
    const prod = await prisma.finishedProduct.upsert({
      where: { companyId_productCode: { companyId: p.companyId, productCode: p.code } },
      update: { defaultSellingPrice: p.price },
      create: {
        id: uuidv7(),
        organizationId: orgId,
        companyId: p.companyId,
        productCode: p.code,
        productName: p.name,
        defaultSellingPrice: p.price,
        status: 'ACTIVE',
      },
    });
    products[p.code] = prod;
  }
  console.log(`✅ Provisioned ${Object.keys(products).length} Finished Agricultural Products.`);

  // 5. Establish Multi-Tier Market Hierarchy
  // REGIONS
  const regionCentral = await prisma.region.upsert({
    where: { companyId_code: { companyId: nectar.id, code: 'REG-CENTRAL-PUNJAB' } },
    update: { name: 'Central Punjab Region' },
    create: {
      id: uuidv7(),
      companyId: nectar.id,
      code: 'REG-CENTRAL-PUNJAB',
      name: 'Central Punjab Region',
      isActive: true,
    },
  });

  const regionSouth = await prisma.region.upsert({
    where: { companyId_code: { companyId: nectar.id, code: 'REG-SOUTH-PUNJAB' } },
    update: { name: 'South Punjab & Bahawalpur Region' },
    create: {
      id: uuidv7(),
      companyId: nectar.id,
      code: 'REG-SOUTH-PUNJAB',
      name: 'South Punjab & Bahawalpur Region',
      isActive: true,
    },
  });

  // ZONES
  const zoneMultan = await prisma.zone.upsert({
    where: { regionId_code: { regionId: regionCentral.id, code: 'ZONE-MULTAN' } },
    update: { name: 'Multan Industrial Zone' },
    create: {
      id: uuidv7(),
      regionId: regionCentral.id,
      code: 'ZONE-MULTAN',
      name: 'Multan Industrial Zone',
      isActive: true,
    },
  });

  const zoneSahiwal = await prisma.zone.upsert({
    where: { regionId_code: { regionId: regionCentral.id, code: 'ZONE-SAHIWAL' } },
    update: { name: 'Sahiwal & Okara Zone' },
    create: {
      id: uuidv7(),
      regionId: regionCentral.id,
      code: 'ZONE-SAHIWAL',
      name: 'Sahiwal & Okara Zone',
      isActive: true,
    },
  });

  // TERRITORIES
  const terrShujabad = await prisma.territory.upsert({
    where: { zoneId_code: { zoneId: zoneMultan.id, code: 'TERR-SHUJABAD' } },
    update: { name: 'Shujabad Agri Territory' },
    create: {
      id: uuidv7(),
      zoneId: zoneMultan.id,
      code: 'TERR-SHUJABAD',
      name: 'Shujabad Agri Territory',
      isActive: true,
    },
  });

  const terrLodhran = await prisma.territory.upsert({
    where: { zoneId_code: { zoneId: zoneMultan.id, code: 'TERR-LODHRAN' } },
    update: { name: 'Lodhran Fertile Territory' },
    create: {
      id: uuidv7(),
      zoneId: zoneMultan.id,
      code: 'TERR-LODHRAN',
      name: 'Lodhran Fertile Territory',
      isActive: true,
    },
  });

  const terrChichawatni = await prisma.territory.upsert({
    where: { zoneId_code: { zoneId: zoneSahiwal.id, code: 'TERR-CHICHAWATNI' } },
    update: { name: 'Chichawatni Commercial Territory' },
    create: {
      id: uuidv7(),
      zoneId: zoneSahiwal.id,
      code: 'TERR-CHICHAWATNI',
      name: 'Chichawatni Commercial Territory',
      isActive: true,
    },
  });

  // Locate Sales Officer User
  const salesOfficer = (await prisma.user.findFirst({
    where: { email: { contains: 'ali.so' } },
  })) || (await prisma.user.findFirst());
  if (!salesOfficer) throw new Error('No user found to act as Sales Officer.');

  // DEALERS with diverse real-world profiles
  const dealerDefs = [
    {
      code: 'DLR-SS-TRADERS',
      name: 'SS Traders & Agri Solutions',
      territoryId: terrShujabad.id,
      balance: 1450000,
      creditLimit: 5000000, // 29% utilization (Healthy)
      phone: '+92 300 1234567',
    },
    {
      code: 'DLR-AL-RAZA',
      name: 'Al-Raza Agro Chemicals & Seeds',
      territoryId: terrShujabad.id,
      balance: 3600000,
      creditLimit: 4000000, // 90% utilization (Warning Threshold Active!)
      phone: '+92 301 2345678',
    },
    {
      code: 'DLR-KISAN-DOST',
      name: 'Kisan Dost Fertilizer Centre',
      territoryId: terrLodhran.id,
      balance: 2400000,
      creditLimit: 2000000, // 120% utilization (Automatic CREDIT_HOLD!)
      phone: '+92 302 3456789',
    },
    {
      code: 'DLR-BISMILLAH',
      name: 'Bismillah Zarai Mall & Agency',
      territoryId: terrChichawatni.id,
      balance: 1850000,
      creditLimit: 8000000, // 23% utilization (Healthy)
      phone: '+92 303 4567890',
    },
    {
      code: 'DLR-GREEN-VALLEY',
      name: 'Green Valley Agriculture Store',
      territoryId: terrLodhran.id,
      balance: 450000,
      creditLimit: 3000000, // 15% utilization (Healthy)
      phone: '+92 304 5678901',
    },
  ];

  const dealers: Record<string, any> = {};
  for (const d of dealerDefs) {
    const dealer = await prisma.dealer.upsert({
      where: {
        companyId_code: {
          companyId: nectar.id,
          code: d.code,
        },
      },
      update: {
        name: d.name,
        territoryId: d.territoryId,
        assignedFieldOfficerId: salesOfficer.id,
        currentBalance: d.balance,
        phone: d.phone,
        status: 'ACTIVE',
      },
      create: {
        id: uuidv7(),
        organizationId: orgId,
        companyId: nectar.id,
        code: d.code,
        name: d.name,
        territoryId: d.territoryId,
        assignedFieldOfficerId: salesOfficer.id,
        currentBalance: d.balance,
        creditLimit: d.creditLimit,
        phone: d.phone,
        status: 'ACTIVE',
      },
    });
    dealers[d.code] = dealer;
  }
  console.log(`✅ Provisioned ${Object.keys(dealers).length} Active Dealers across 3 Territories.`);

  // 6. Set 5-Tier Hierarchical Credit Limits in CreditLimit table
  const creditLimitConfigs = [
    { level: 'REGION', entityId: regionCentral.id, limit: 50000000, warnPct: 85, notes: 'Central Region Aggregate Cap' },
    { level: 'REGION', entityId: regionSouth.id, limit: 30000000, warnPct: 85, notes: 'South Region Aggregate Cap' },
    { level: 'ZONE', entityId: zoneMultan.id, limit: 25000000, warnPct: 85, notes: 'Multan Industrial Zone Cap' },
    { level: 'ZONE', entityId: zoneSahiwal.id, limit: 15000000, warnPct: 85, notes: 'Sahiwal/Okara Zone Cap' },
    { level: 'TERRITORY', entityId: terrShujabad.id, limit: 12000000, warnPct: 85, notes: 'Shujabad Territory Cap' },
    { level: 'TERRITORY', entityId: terrLodhran.id, limit: 8000000, warnPct: 85, notes: 'Lodhran Territory Cap' },
    { level: 'TERRITORY', entityId: terrChichawatni.id, limit: 10000000, warnPct: 85, notes: 'Chichawatni Territory Cap' },
    { level: 'SALES_OFFICER', entityId: salesOfficer.id, limit: 7500000, warnPct: 85, notes: 'Sales Officer Field Risk Cap' },
    { level: 'DEALER', entityId: dealers['DLR-SS-TRADERS'].id, limit: 5000000, warnPct: 85, notes: 'SS Traders Limit' },
    { level: 'DEALER', entityId: dealers['DLR-AL-RAZA'].id, limit: 4000000, warnPct: 85, notes: 'Al-Raza Agro Limit (At Warning Threshold)' },
    { level: 'DEALER', entityId: dealers['DLR-KISAN-DOST'].id, limit: 2000000, warnPct: 85, notes: 'Kisan Dost Limit (Exceeded -> Credit Hold)' },
    { level: 'DEALER', entityId: dealers['DLR-BISMILLAH'].id, limit: 8000000, warnPct: 85, notes: 'Bismillah Mall Limit' },
    { level: 'DEALER', entityId: dealers['DLR-GREEN-VALLEY'].id, limit: 3000000, warnPct: 85, notes: 'Green Valley Limit' },
  ];

  for (const cl of creditLimitConfigs) {
    const existing = await prisma.creditLimit.findFirst({
      where: {
        companyId: nectar.id,
        level: cl.level as any,
        entityId: cl.entityId,
      },
    });

    if (existing) {
      await prisma.creditLimit.update({
        where: { id: existing.id },
        data: { creditLimit: cl.limit, nearLimitThresholdPercent: cl.warnPct, notes: cl.notes },
      });
    } else {
      await prisma.creditLimit.create({
        data: {
          id: uuidv7(),
          organizationId: orgId,
          companyId: nectar.id,
          level: cl.level as any,
          entityId: cl.entityId,
          creditLimit: cl.limit,
          nearLimitThresholdPercent: cl.warnPct,
          notes: cl.notes,
          status: 'ACTIVE',
        },
      });
    }
  }
  console.log('✅ 5-Tier Hierarchical Credit Limits configured.');

  // 7. Configure Sales Targets for 2026 (Completely Separate from Credit Limits)
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  const targetConfigs = [
    { level: 'COMPANY', entityId: nectar.id, target: 80000000 },
    { level: 'REGION', entityId: regionCentral.id, target: 45000000 },
    { level: 'ZONE', entityId: zoneMultan.id, target: 25000000 },
    { level: 'TERRITORY', entityId: terrShujabad.id, target: 12000000 },
    { level: 'SALES_OFFICER', entityId: salesOfficer.id, target: 10000000 },
  ];

  for (const tc of targetConfigs) {
    await prisma.salesTarget.upsert({
      where: {
        companyId_level_entityId_periodYear_periodMonth: {
          companyId: nectar.id,
          level: tc.level as any,
          entityId: tc.entityId,
          periodYear: currentYear,
          periodMonth: currentMonth,
        },
      },
      update: { targetAmount: tc.target },
      create: {
        id: uuidv7(),
        organizationId: orgId,
        companyId: nectar.id,
        level: tc.level as any,
        entityId: tc.entityId,
        periodYear: currentYear,
        periodMonth: currentMonth,
        targetAmount: tc.target,
      },
    });
  }
  console.log('✅ Independent Sales Targets stored for 2026.');

  // 8. Create Realistic Sales Orders Across Full Lifecycle
  // Order 1: CREDIT_HOLD Order (Dealer Kisan Dost exceeded limit)
  const ordCreditHold = await prisma.salesOrder.create({
    data: {
      id: uuidv7(),
      organizationId: orgId,
      companyId: nectar.id,
      orderNumber: `SO-HOLD-${Date.now().toString().slice(-5)}`,
      orderDate: new Date(),
      dealerId: dealers['DLR-KISAN-DOST'].id,
      salesOfficerId: salesOfficer.id,
      territoryId: terrLodhran.id,
      zoneId: zoneMultan.id,
      regionId: regionCentral.id,
      status: 'CREDIT_HOLD',
      paymentTerm: 'CREDIT',
      totalAmount: 850000,
      notes: 'Credit Hold: Exceeded dealer credit limit (2,400,000 + 850,000 > 2,000,000 limit)',
      items: {
        create: [
          {
            id: uuidv7(),
            finishedProductId: products['PROD-ZINC-33'].id,
            productName: products['PROD-ZINC-33'].productName,
            quantity: 150,
            unitPrice: 4200,
            totalPrice: 630000,
          },
          {
            id: uuidv7(),
            finishedProductId: products['PROD-BORON-20'].id,
            productName: products['PROD-BORON-20'].productName,
            quantity: 125,
            unitPrice: 1760,
            totalPrice: 220000,
          },
        ],
      },
    },
  });

  // Order 2: APPROVED Credit Order (Within limits, ready for dispatch)
  await prisma.salesOrder.create({
    data: {
      id: uuidv7(),
      organizationId: orgId,
      companyId: nectar.id,
      orderNumber: `SO-APPR-${Date.now().toString().slice(-5)}`,
      orderDate: new Date(),
      dealerId: dealers['DLR-SS-TRADERS'].id,
      salesOfficerId: salesOfficer.id,
      territoryId: terrShujabad.id,
      zoneId: zoneMultan.id,
      regionId: regionCentral.id,
      status: 'APPROVED',
      paymentTerm: 'CREDIT',
      totalAmount: 640000,
      items: {
        create: [
          {
            id: uuidv7(),
            finishedProductId: products['PROD-NPK-BOOST'].id,
            productName: products['PROD-NPK-BOOST'].productName,
            quantity: 200,
            unitPrice: 2800,
            totalPrice: 560000,
          },
          {
            id: uuidv7(),
            finishedProductId: products['PROD-BORON-20'].id,
            productName: products['PROD-BORON-20'].productName,
            quantity: 45,
            unitPrice: 1777.77,
            totalPrice: 80000,
          },
        ],
      },
    },
  });

  // Order 3: CASH Order (Exempt from credit control)
  await prisma.salesOrder.create({
    data: {
      id: uuidv7(),
      organizationId: orgId,
      companyId: nectar.id,
      orderNumber: `SO-CASH-${Date.now().toString().slice(-5)}`,
      orderDate: new Date(),
      dealerId: dealers['DLR-AL-RAZA'].id,
      salesOfficerId: salesOfficer.id,
      territoryId: terrShujabad.id,
      zoneId: zoneMultan.id,
      regionId: regionCentral.id,
      status: 'APPROVED',
      paymentTerm: 'CASH',
      totalAmount: 420000,
      items: {
        create: [
          {
            id: uuidv7(),
            finishedProductId: products['PROD-ZINC-33'].id,
            productName: products['PROD-ZINC-33'].productName,
            quantity: 100,
            unitPrice: 4200,
            totalPrice: 420000,
          },
        ],
      },
    },
  });

  // Order 4: INVOICED Order (Fully completed lifecycle)
  const ordInvoiced = await prisma.salesOrder.create({
    data: {
      id: uuidv7(),
      organizationId: orgId,
      companyId: nectar.id,
      orderNumber: `SO-INV-${Date.now().toString().slice(-5)}`,
      orderDate: new Date(Date.now() - 3 * 24 * 3600 * 1000),
      dealerId: dealers['DLR-BISMILLAH'].id,
      salesOfficerId: salesOfficer.id,
      territoryId: terrChichawatni.id,
      zoneId: zoneSahiwal.id,
      regionId: regionCentral.id,
      status: 'CONVERTED_TO_SALE',
      paymentTerm: 'CREDIT',
      totalAmount: 1250000,
      items: {
        create: [
          {
            id: uuidv7(),
            finishedProductId: products['PROD-ZINC-33'].id,
            productName: products['PROD-ZINC-33'].productName,
            quantity: 200,
            unitPrice: 4200,
            totalPrice: 840000,
          },
          {
            id: uuidv7(),
            finishedProductId: products['PROD-PEST-ULTRA'].id,
            productName: products['PROD-PEST-ULTRA'].productName,
            quantity: 114,
            unitPrice: 3596.49,
            totalPrice: 410000,
          },
        ],
      },
    },
  });

  console.log('✅ Seeded 4 Sales Orders spanning CREDIT_HOLD, APPROVED, CASH, and INVOICED.');

  // 9. Credit Override Requests (Formal Audit Trail)
  await prisma.creditOverrideRequest.createMany({
    data: [
      {
        id: uuidv7(),
        organizationId: orgId,
        companyId: nectar.id,
        salesOrderId: ordCreditHold.id,
        level: 'DEALER',
        entityId: dealers['DLR-KISAN-DOST'].id,
        entityName: dealers['DLR-KISAN-DOST'].name,
        currentLimit: 2000000,
        currentExposure: 2400000,
        orderAmount: 850000,
        projectedExposure: 3250000,
        exceededAmount: 1250000,
        reason: 'Urgent wheat sowing season requirement in Lodhran belt. Dealer promised bank cheque within 7 days.',
        requestedById: salesOfficer.id,
        status: 'PENDING',
      },
      {
        id: uuidv7(),
        organizationId: orgId,
        companyId: nectar.id,
        salesOrderId: ordCreditHold.id,
        level: 'DEALER',
        entityId: dealers['DLR-AL-RAZA'].id,
        entityName: dealers['DLR-AL-RAZA'].name,
        currentLimit: 4000000,
        currentExposure: 3600000,
        orderAmount: 900000,
        projectedExposure: 4500000,
        exceededAmount: 500000,
        reason: 'Special government subsidy distribution contract for cotton crops.',
        requestedById: salesOfficer.id,
        status: 'APPROVED',
        approvedById: salesOfficer.id,
        approvedAt: new Date(Date.now() - 24 * 3600 * 1000),
      },
      {
        id: uuidv7(),
        organizationId: orgId,
        companyId: nectar.id,
        salesOrderId: ordCreditHold.id,
        level: 'DEALER',
        entityId: dealers['DLR-KISAN-DOST'].id,
        entityName: dealers['DLR-KISAN-DOST'].name,
        currentLimit: 2000000,
        currentExposure: 2800000,
        orderAmount: 1500000,
        projectedExposure: 4300000,
        exceededAmount: 2300000,
        reason: 'High volume bulk request without collateral.',
        requestedById: salesOfficer.id,
        status: 'REJECTED',
        rejectionReason: 'Rejected: Excessive previous overdue invoices older than 60 days.',
      },
    ],
  });
  console.log('✅ Seeded 3 Credit Override Requests (Pending, Approved, Rejected).');

  // 10. Posted Sales Invoice & Balanced Double-Entry GL Journal
  const invoiceNumber = `INV-2026-${Date.now().toString().slice(-5)}`;
  const invoiceAmount = 1250000;
  const invoiceDate = new Date(Date.now() - 2 * 24 * 3600 * 1000);

  const salesInv = await prisma.salesInvoice.create({
    data: {
      id: uuidv7(),
      organizationId: orgId,
      companyId: nectar.id,
      salesOrderId: ordInvoiced.id,
      warehouseId: warehouseNectar.id,
      invoiceNumber,
      invoiceDate,
      dealerId: dealers['DLR-BISMILLAH'].id,
      grossAmount: invoiceAmount,
      discountAmount: 0,
      taxAmount: 0,
      netAmount: invoiceAmount,
      postingStatus: 'POSTED',
      postedAt: invoiceDate,
      salesOfficerId: salesOfficer.id,
      territoryId: terrChichawatni.id,
      zoneId: zoneSahiwal.id,
      regionId: regionCentral.id,
      items: {
        create: [
          {
            id: uuidv7(),
            finishedProductId: products['PROD-ZINC-33'].id,
            productName: products['PROD-ZINC-33'].productName,
            quantity: 200,
            rate: 4200,
            grossAmount: 840000,
            netAmount: 840000,
          },
          {
            id: uuidv7(),
            finishedProductId: products['PROD-PEST-ULTRA'].id,
            productName: products['PROD-PEST-ULTRA'].productName,
            quantity: 114,
            rate: 3596.49,
            grossAmount: 410000,
            netAmount: 410000,
          },
        ],
      },
    },
  });

  // Post Dealer Ledger Entry
  await prisma.dealerLedgerEntry.create({
    data: {
      id: uuidv7(),
      organizationId: orgId,
      companyId: nectar.id,
      dealerId: dealers['DLR-BISMILLAH'].id,
      entryDate: invoiceDate,
      entryType: 'SALE_INVOICE',
      referenceId: salesInv.id,
      voucherNumber: invoiceNumber,
      debit: invoiceAmount,
      credit: 0,
      runningBalance: dealers['DLR-BISMILLAH'].currentBalance + invoiceAmount,
      description: `Sales Invoice ${invoiceNumber} - Fertile Agri Supplies`,
    },
  });

  // Post Balanced GL Journal Voucher for Sales Invoice
  await prisma.journalEntry.create({
    data: {
      id: uuidv7(),
      organizationId: orgId,
      companyId: nectar.id,
      entryNumber: `JV-SALE-${Date.now().toString().slice(-5)}`,
      entryDate: invoiceDate,
      sourceType: 'SALES_INVOICE',
      sourceId: salesInv.id,
      referenceNumber: invoiceNumber,
      description: `Sales revenue recognition for Invoice ${invoiceNumber}`,
      status: 'POSTED',
      totalDebit: invoiceAmount,
      totalCredit: invoiceAmount,
      isBalanced: true,
      lines: {
        create: [
          {
            id: uuidv7(),
            accountId: accountsMap['103000'].id, // Accounts Receivable (Debit)
            description: `Trade Receivable - ${dealers['DLR-BISMILLAH'].name}`,
            debit: invoiceAmount,
            credit: 0,
            dealerId: dealers['DLR-BISMILLAH'].id,
            salesOfficerId: salesOfficer.id,
            territoryId: terrChichawatni.id,
            zoneId: zoneSahiwal.id,
            regionId: regionCentral.id,
          },
          {
            id: uuidv7(),
            accountId: accountsMap['401000'].id, // Sales Revenue (Credit)
            description: `Commercial Agri Sales - ${invoiceNumber}`,
            debit: 0,
            credit: invoiceAmount,
            salesOfficerId: salesOfficer.id,
            territoryId: terrChichawatni.id,
            zoneId: zoneSahiwal.id,
            regionId: regionCentral.id,
          },
        ],
      },
    },
  });

  // Update Account Balances
  await prisma.account.update({
    where: { id: accountsMap['103000'].id },
    data: { currentBalance: { increment: invoiceAmount } },
  });
  await prisma.account.update({
    where: { id: accountsMap['401000'].id },
    data: { currentBalance: { increment: invoiceAmount } },
  });

  console.log(`✅ Posted Sales Invoice ${invoiceNumber} with balanced GL Journal Voucher.`);

  // 11. Vendor Purchase Bills (Procurement Audit Trace)
  // Ensure Vendor
  const vendor = await prisma.vendor.upsert({
    where: { companyId_code: { companyId: nectar.id, code: 'VND-ENGRO-CORP' } },
    update: {},
    create: {
      id: uuidv7(),
      organizationId: orgId,
      companyId: nectar.id,
      code: 'VND-ENGRO-CORP',
      name: 'Engro Fertilisers & Chemical Raw Materials Corp',
      category: 'RAW_MATERIAL',
      contactPerson: 'Khurram Shehzad',
      phone: '+92 300 8765432',
      email: 'sales@engrochem.pk',
      status: 'ACTIVE',
      currency: 'PKR',
    },
  });

  const purchaseAmount = 2800000;
  const grnNumber = `GRN-2026-${Date.now().toString().slice(-5)}`;
  const purchaseDate = new Date(Date.now() - 5 * 24 * 3600 * 1000);

  const purchaseBill = await prisma.purchaseInvoice.create({
    data: {
      id: uuidv7(),
      organizationId: orgId,
      companyId: nectar.id,
      vendorId: vendor.id,
      warehouseId: warehouseNectar.id,
      voucherNumber: grnNumber,
      date: purchaseDate,
      postingStatus: 'POSTED',
      isComplete: true,
      grossAmount: purchaseAmount,
      netAmount: purchaseAmount,
      items: {
        create: [
          {
            id: uuidv7(),
            itemName: 'Zinc Sulphate Raw Chemical Concentrate 98%',
            quantity: 5000,
            rate: 560,
            grossAmount: purchaseAmount,
            netAmount: purchaseAmount,
          },
        ],
      },
    },
  });

  // Post Vendor Ledger
  await prisma.vendorLedgerEntry.create({
    data: {
      id: uuidv7(),
      organizationId: orgId,
      companyId: nectar.id,
      vendorId: vendor.id,
      entryDate: purchaseDate,
      entryType: 'PURCHASE_INVOICE',
      referenceId: purchaseBill.id,
      voucherNumber: grnNumber,
      debit: 0,
      credit: purchaseAmount,
      runningBalance: purchaseAmount,
      description: `Purchase Bill ${grnNumber} - Raw Chemical Supplies`,
    },
  });

  // Post Balanced GL Journal for Purchase
  await prisma.journalEntry.create({
    data: {
      id: uuidv7(),
      organizationId: orgId,
      companyId: nectar.id,
      entryNumber: `JV-PURCH-${Date.now().toString().slice(-5)}`,
      entryDate: purchaseDate,
      sourceType: 'PURCHASE_INVOICE',
      sourceId: purchaseBill.id,
      referenceNumber: grnNumber,
      description: `Inventory addition & vendor payable for ${grnNumber}`,
      status: 'POSTED',
      totalDebit: purchaseAmount,
      totalCredit: purchaseAmount,
      isBalanced: true,
      lines: {
        create: [
          {
            id: uuidv7(),
            accountId: accountsMap['104000'].id, // Finished Goods / Raw Inventory (Debit)
            description: 'Stock receipt into central warehouse',
            debit: purchaseAmount,
            credit: 0,
            vendorId: vendor.id,
          },
          {
            id: uuidv7(),
            accountId: accountsMap['201000'].id, // Accounts Payable (Credit)
            description: `Trade Creditor - ${vendor.name}`,
            debit: 0,
            credit: purchaseAmount,
            vendorId: vendor.id,
          },
        ],
      },
    },
  });

  await prisma.account.update({
    where: { id: accountsMap['104000'].id },
    data: { currentBalance: { increment: purchaseAmount } },
  });
  await prisma.account.update({
    where: { id: accountsMap['201000'].id },
    data: { currentBalance: { increment: purchaseAmount } },
  });

  console.log(`✅ Posted Procurement Purchase Bill ${grnNumber} (PKR 2,800,000) with GL Journal.`);

  // 12. Dealer Payment Collection Receipts (Dynamic Credit Release)
  const collectionAmount = 600000;
  const receiptNumber = `RCP-2026-${Date.now().toString().slice(-5)}`;
  const paymentDate = new Date(Date.now() - 1 * 24 * 3600 * 1000);

  const dealerPayment = await prisma.dealerPaymentReceipt.create({
    data: {
      id: uuidv7(),
      organizationId: orgId,
      companyId: nectar.id,
      dealerId: dealers['DLR-AL-RAZA'].id,
      salesOfficerId: salesOfficer.id,
      paymentDate,
      amount: collectionAmount,
      paymentType: 'BANK',
      bankName: 'Meezan Bank Shujabad Branch',
      receiptNumber,
      status: 'CONFIRMED',
      notes: 'Recovery collection for agrochemicals order.',
    },
  });

  // Credit Dealer Ledger
  await prisma.dealerLedgerEntry.create({
    data: {
      id: uuidv7(),
      organizationId: orgId,
      companyId: nectar.id,
      dealerId: dealers['DLR-AL-RAZA'].id,
      entryDate: paymentDate,
      entryType: 'PAYMENT_RECEIPT',
      referenceId: dealerPayment.id,
      voucherNumber: receiptNumber,
      debit: 0,
      credit: collectionAmount,
      runningBalance: dealers['DLR-AL-RAZA'].currentBalance - collectionAmount,
      description: `Payment Receipt ${receiptNumber} via Meezan Bank`,
    },
  });

  // Reduce Dealer's actual balance to dynamically release credit!
  await prisma.dealer.update({
    where: { id: dealers['DLR-AL-RAZA'].id },
    data: { currentBalance: { decrement: collectionAmount } },
  });

  // Post Balanced GL Journal for Collection
  await prisma.journalEntry.create({
    data: {
      id: uuidv7(),
      organizationId: orgId,
      companyId: nectar.id,
      entryNumber: `JV-RCP-${Date.now().toString().slice(-5)}`,
      entryDate: paymentDate,
      sourceType: 'DEALER_PAYMENT',
      sourceId: dealerPayment.id,
      referenceNumber: receiptNumber,
      description: `Cash collection received from ${dealers['DLR-AL-RAZA'].name}`,
      status: 'POSTED',
      totalDebit: collectionAmount,
      totalCredit: collectionAmount,
      isBalanced: true,
      lines: {
        create: [
          {
            id: uuidv7(),
            accountId: accountsMap['102000'].id, // Operating Bank Account (Debit)
            description: 'Funds cleared in Meezan Bank',
            debit: collectionAmount,
            credit: 0,
            dealerId: dealers['DLR-AL-RAZA'].id,
            salesOfficerId: salesOfficer.id,
          },
          {
            id: uuidv7(),
            accountId: accountsMap['103000'].id, // Accounts Receivable (Credit)
            description: `Settlement of receivables for ${dealers['DLR-AL-RAZA'].name}`,
            debit: 0,
            credit: collectionAmount,
            dealerId: dealers['DLR-AL-RAZA'].id,
            salesOfficerId: salesOfficer.id,
          },
        ],
      },
    },
  });

  await prisma.account.update({
    where: { id: accountsMap['102000'].id },
    data: { currentBalance: { increment: collectionAmount } },
  });
  await prisma.account.update({
    where: { id: accountsMap['103000'].id },
    data: { currentBalance: { decrement: collectionAmount } },
  });

  console.log(`✅ Seeded Collection Receipt ${receiptNumber} (PKR 600,000) dynamically releasing credit.`);

  // 13. Operating Expenses with Direct General Ledger Postings
  const expensesToSeed = [
    {
      category: 'LOGISTICS',
      amount: 185000,
      payee: 'Faisal Movers Cargo Freight Service',
      ref: 'EXP-FRT-9921',
      desc: 'Finished goods inter-city distribution & depot freight charges',
      date: new Date(Date.now() - 4 * 24 * 3600 * 1000),
    },
    {
      category: 'MARKETING',
      amount: 140000,
      payee: 'AgriExpo Media & Farmer Field Days',
      ref: 'EXP-MKT-3342',
      desc: 'Farmer convention seminar & promotional banners in Multan',
      date: new Date(Date.now() - 3 * 24 * 3600 * 1000),
    },
    {
      category: 'UTILITIES',
      amount: 95000,
      payee: 'Multan Electric Power Company (MEPCO)',
      ref: 'EXP-UTL-1102',
      desc: 'Depot & cold-storage electricity bill payment',
      date: new Date(Date.now() - 2 * 24 * 3600 * 1000),
    },
    {
      category: 'SALARIES',
      amount: 320000,
      payee: 'Sales Team Field Daily Allowances & Fuel TA/DA',
      ref: 'EXP-TADA-4091',
      desc: 'Field travel allowances for Shujabad and Lodhran sales officers',
      date: new Date(Date.now() - 1 * 24 * 3600 * 1000),
    },
  ];

  for (const exp of expensesToSeed) {
    const expenseEntry = await prisma.expenseEntry.create({
      data: {
        id: uuidv7(),
        organizationId: orgId,
        companyId: nectar.id,
        voucherNumber: exp.ref,
        expenseDate: exp.date,
        expenseAccountId: accountsMap['601000'].id,
        paymentAccountId: accountsMap['102000'].id,
        paymentMethod: 'BANK',
        amount: exp.amount,
        payee: exp.payee,
        referenceNumber: exp.ref,
        description: exp.desc,
        category: exp.category,
      },
    });

    // Balanced GL Journal Voucher for Operating Expense
    await prisma.journalEntry.create({
      data: {
        id: uuidv7(),
        organizationId: orgId,
        companyId: nectar.id,
        entryNumber: `JV-EXP-${Date.now().toString().slice(-5)}`,
        entryDate: exp.date,
        sourceType: 'EXPENSE',
        sourceId: expenseEntry.id,
        referenceNumber: exp.ref,
        description: exp.desc,
        status: 'POSTED',
        totalDebit: exp.amount,
        totalCredit: exp.amount,
        isBalanced: true,
        lines: {
          create: [
            {
              id: uuidv7(),
              accountId: accountsMap['601000'].id, // Operating Expense (Debit)
              description: exp.desc,
              debit: exp.amount,
              credit: 0,
            },
            {
              id: uuidv7(),
              accountId: accountsMap['102000'].id, // Bank Account (Credit)
              description: `Payment to ${exp.payee}`,
              debit: 0,
              credit: exp.amount,
            },
          ],
        },
      },
    });

    await prisma.account.update({
      where: { id: accountsMap['601000'].id },
      data: { currentBalance: { increment: exp.amount } },
    });
    await prisma.account.update({
      where: { id: accountsMap['102000'].id },
      data: { currentBalance: { decrement: exp.amount } },
    });
  }
  console.log(`✅ Seeded ${expensesToSeed.length} Operating Expenses with balanced GL postings.`);

  // 14. Seed Data for Second Company (AgriventurePakistan) to verify Group Multi-Company Drill-Down
  const agriventure = companies['CO-AGRIVENTURE'];
  const regSindh = await prisma.region.upsert({
    where: { companyId_code: { companyId: agriventure.id, code: 'REG-SINDH-LOWER' } },
    update: { name: 'Lower Sindh & Hyderabad Region' },
    create: {
      id: uuidv7(),
      companyId: agriventure.id,
      code: 'REG-SINDH-LOWER',
      name: 'Lower Sindh & Hyderabad Region',
      isActive: true,
    },
  });

  const zoneSukkur = await prisma.zone.upsert({
    where: { regionId_code: { regionId: regSindh.id, code: 'ZONE-SUKKUR' } },
    update: { name: 'Sukkur Agro Belt Zone' },
    create: {
      id: uuidv7(),
      regionId: regSindh.id,
      code: 'ZONE-SUKKUR',
      name: 'Sukkur Agro Belt Zone',
      isActive: true,
    },
  });

  const terrGhotki = await prisma.territory.upsert({
    where: { zoneId_code: { zoneId: zoneSukkur.id, code: 'TERR-GHOTKI' } },
    update: { name: 'Ghotki Sugarcane & Wheat Territory' },
    create: {
      id: uuidv7(),
      zoneId: zoneSukkur.id,
      code: 'TERR-GHOTKI',
      name: 'Ghotki Sugarcane & Wheat Territory',
      isActive: true,
    },
  });

  const dealerSindh = await prisma.dealer.upsert({
    where: { companyId_code: { companyId: agriventure.id, code: 'DLR-SINDH-GREEN' } },
    update: { currentBalance: 980000 },
    create: {
      id: uuidv7(),
      organizationId: orgId,
      companyId: agriventure.id,
      code: 'DLR-SINDH-GREEN',
      name: 'Sindh Green Agro Traders & Fertilizer',
      territoryId: terrGhotki.id,
      assignedFieldOfficerId: salesOfficer.id,
      currentBalance: 980000,
      creditLimit: 3500000,
      phone: '+92 305 6789012',
      status: 'ACTIVE',
    },
  });

  // Sales Order for Agriventure
  const ordAgriventure = await prisma.salesOrder.create({
    data: {
      id: uuidv7(),
      organizationId: orgId,
      companyId: agriventure.id,
      orderNumber: `SO-AGRI-${Date.now().toString().slice(-5)}`,
      orderDate: new Date(),
      dealerId: dealerSindh.id,
      salesOfficerId: salesOfficer.id,
      territoryId: terrGhotki.id,
      zoneId: zoneSukkur.id,
      regionId: regSindh.id,
      status: 'CONVERTED_TO_SALE',
      paymentTerm: 'CREDIT',
      totalAmount: 1800000,
    },
  });

  const warehouseAgri = await prisma.warehouse.upsert({
    where: { companyId_code: { companyId: agriventure.id, code: 'WH-AGRI-SUKKUR' } },
    update: {},
    create: {
      id: uuidv7(),
      companyId: agriventure.id,
      code: 'WH-AGRI-SUKKUR',
      name: 'Agriventure Sukkur Warehouse',
      type: 'FINISHED_GOODS',
      address: 'Sukkur Bypass Agro Zone',
      isActive: true,
    },
  });

  // Invoice for Agriventure
  const invAgriNum = `INV-AGRI-${Date.now().toString().slice(-5)}`;
  const invAgri = await prisma.salesInvoice.create({
    data: {
      id: uuidv7(),
      organizationId: orgId,
      companyId: agriventure.id,
      salesOrderId: ordAgriventure.id,
      warehouseId: warehouseAgri.id,
      invoiceNumber: invAgriNum,
      invoiceDate: new Date(),
      dealerId: dealerSindh.id,
      grossAmount: 1800000,
      discountAmount: 0,
      taxAmount: 0,
      netAmount: 1800000,
      postingStatus: 'POSTED',
      postedAt: new Date(),
      salesOfficerId: salesOfficer.id,
      territoryId: terrGhotki.id,
      zoneId: zoneSukkur.id,
      regionId: regSindh.id,
      items: {
        create: [
          {
            id: uuidv7(),
            finishedProductId: products['PROD-ZINC-33'].id,
            productName: products['PROD-ZINC-33'].productName,
            quantity: 400,
            rate: 4500,
            grossAmount: 1800000,
            netAmount: 1800000,
          },
        ],
      },
    },
  });

  // Balanced GL entry for Agriventure
  await prisma.journalEntry.create({
    data: {
      id: uuidv7(),
      organizationId: orgId,
      companyId: agriventure.id,
      entryNumber: `JV-AGRI-${Date.now().toString().slice(-5)}`,
      entryDate: new Date(),
      sourceType: 'SALES_INVOICE',
      sourceId: invAgri.id,
      referenceNumber: invAgriNum,
      description: `Agriventure Sindh commercial sales revenue`,
      status: 'POSTED',
      totalDebit: 1800000,
      totalCredit: 1800000,
      isBalanced: true,
      lines: {
        create: [
          {
            id: uuidv7(),
            accountId: accountsMap['103000'].id,
            description: `Trade Receivable - ${dealerSindh.name}`,
            debit: 1800000,
            credit: 0,
            dealerId: dealerSindh.id,
            salesOfficerId: salesOfficer.id,
            territoryId: terrGhotki.id,
            zoneId: zoneSukkur.id,
            regionId: regSindh.id,
          },
          {
            id: uuidv7(),
            accountId: accountsMap['401000'].id,
            description: `Commercial Sales - ${invAgriNum}`,
            debit: 0,
            credit: 1800000,
            salesOfficerId: salesOfficer.id,
            territoryId: terrGhotki.id,
            zoneId: zoneSukkur.id,
            regionId: regSindh.id,
          },
        ],
      },
    },
  });

  console.log(`✅ Seeded Agriventure Pakistan transactions to demonstrate Multi-Company Group Consolidation.`);

  console.log('\n========================================================================');
  console.log('🎉 COMPREHENSIVE SEEDING COMPLETED WITH COMPLETE DATA FLOW!');
  console.log('========================================================================\n');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
