/**
 * SHEHSWAR ONE360 - Seed Data for Mobile App Testing
 * 
 * Specifically Seeds:
 * 1. Dealers with Credit Limits, Balances & Sales Officer Assignment
 * 2. Dedicated CreditLimit records for Dealers & Sales Officer
 * 3. Products with Pack Sizes, Rates, Categories & Real-time Warehouse Stock
 * 4. Market Territory & Zone for Field Visibility
 * 5. Active Published Pricing Scheme & Seasonal Rate List for Mobile Order Booking
 */
const { PrismaClient } = require('@prisma/client');
const { v7: uuidv7 } = require('uuid');

const remoteDbUrl = 'postgresql://shehswar_user:PHHDD5jvPcZsDCX2LH7mKrcO5GBtobti@dpg-dbc8moafngtc739dhgkg-a.oregon-postgres.render.com/shehswar_one360?sslmode=require';

async function seedMobileDataFor(label, url) {
  console.log(`\n=============================================================`);
  console.log(`SEEDING MOBILE TESTING DATA ON: [${label}]`);
  console.log(`=============================================================\n`);

  const prisma = new PrismaClient({ datasources: { db: { url } } });

  try {
    // 1. Get Organization, Company, and Sales Officer
    const org = await prisma.organization.findFirst({ where: { code: 'ORG-SHEHSWAR-GRP' } });
    const comp = await prisma.company.findFirst({ where: { code: 'COMP-SHEHSWAR' } });
    const salesOfficer = await prisma.user.findFirst({ where: { email: 'sales.officer@shehswar.com' } });

    if (!org || !comp || !salesOfficer) {
      console.warn(`[${label}] Organization, Company, or Sales Officer not found in DB! Skipping...`);
      return;
    }

    console.log(`✓ Organization: ${org.name} (${org.id})`);
    console.log(`✓ Company: ${comp.name} (${comp.id})`);
    console.log(`✓ Sales Officer: ${salesOfficer.firstName} ${salesOfficer.lastName} (${salesOfficer.id})`);

    // 2. Seed Clean Market Territory Hierarchy
    const region = await prisma.region.upsert({
      where: { companyId_code: { companyId: comp.id, code: 'REG-SOUTH-PUNJAB' } },
      update: { name: 'South Punjab Region', isActive: true },
      create: {
        id: uuidv7(),
        companyId: comp.id,
        code: 'REG-SOUTH-PUNJAB',
        name: 'South Punjab Region',
        isActive: true,
      },
    });

    const zone = await prisma.zone.upsert({
      where: { regionId_code: { regionId: region.id, code: 'ZONE-MULTAN' } },
      update: { name: 'Multan Division Zone', isActive: true },
      create: {
        id: uuidv7(),
        regionId: region.id,
        code: 'ZONE-MULTAN',
        name: 'Multan Division Zone',
        isActive: true,
      },
    });

    const territory = await prisma.territory.upsert({
      where: { zoneId_code: { zoneId: zone.id, code: 'TERR-MULTAN-CENTRAL' } },
      update: { name: 'Multan Central Territory', managerId: salesOfficer.id, isActive: true },
      create: {
        id: uuidv7(),
        zoneId: zone.id,
        managerId: salesOfficer.id,
        code: 'TERR-MULTAN-CENTRAL',
        name: 'Multan Central Territory',
        isActive: true,
      },
    });

    // Assign Sales Officer Market Scope
    const existingAssignment = await prisma.userMarketAssignment.findFirst({
      where: {
        userId: salesOfficer.id,
        territoryId: territory.id,
      },
    });

    if (!existingAssignment) {
      await prisma.userMarketAssignment.create({
        data: {
          id: uuidv7(),
          organizationId: org.id,
          companyId: comp.id,
          userId: salesOfficer.id,
          regionId: region.id,
          zoneId: zone.id,
          territoryId: territory.id,
          roleScope: 'SALES_OFFICER',
          isPrimary: true,
          status: 'ACTIVE',
        },
      });
    }
    console.log('✓ Market territory & sales officer assignment established.');

    // 3. Seed Warehouse for Product Stock (No organizationId on Warehouse model)
    const warehouse = await prisma.warehouse.upsert({
      where: { companyId_code: { companyId: comp.id, code: 'WH-MAIN' } },
      update: { name: 'Shehswar Central Warehouse (Multan)', type: 'FINISHED_GOODS', isActive: true },
      create: {
        id: uuidv7(),
        companyId: comp.id,
        code: 'WH-MAIN',
        name: 'Shehswar Central Warehouse (Multan)',
        type: 'FINISHED_GOODS',
        isActive: true,
      },
    });

    // 4. Seed Product Categories & Pack Sizes (Unique on organizationId_code)
    const catFertilizer = await prisma.productCategory.upsert({
      where: { organizationId_code: { organizationId: org.id, code: 'CAT-FERT' } },
      update: { name: 'Chemical & Compound Fertilizers', status: 'ACTIVE' },
      create: {
        id: uuidv7(),
        organizationId: org.id,
        code: 'CAT-FERT',
        name: 'Chemical & Compound Fertilizers',
        status: 'ACTIVE',
      },
    });

    const catBio = await prisma.productCategory.upsert({
      where: { organizationId_code: { organizationId: org.id, code: 'CAT-BIO' } },
      update: { name: 'Biologicals & Micronutrients', status: 'ACTIVE' },
      create: {
        id: uuidv7(),
        organizationId: org.id,
        code: 'CAT-BIO',
        name: 'Biologicals & Micronutrients',
        status: 'ACTIVE',
      },
    });

    const pack50kg = await prisma.packSize.upsert({
      where: { organizationId_code: { organizationId: org.id, code: 'PACK-50KG' } },
      update: { name: '50 KG HDPE Bag', quantity: 50, status: 'ACTIVE' },
      create: {
        id: uuidv7(),
        organizationId: org.id,
        code: 'PACK-50KG',
        name: '50 KG HDPE Bag',
        quantity: 50,
        status: 'ACTIVE',
      },
    });

    const pack10kg = await prisma.packSize.upsert({
      where: { organizationId_code: { organizationId: org.id, code: 'PACK-10KG' } },
      update: { name: '10 KG Multi-Wall Bag', quantity: 10, status: 'ACTIVE' },
      create: {
        id: uuidv7(),
        organizationId: org.id,
        code: 'PACK-10KG',
        name: '10 KG Multi-Wall Bag',
        quantity: 10,
        status: 'ACTIVE',
      },
    });

    const pack20L = await prisma.packSize.upsert({
      where: { organizationId_code: { organizationId: org.id, code: 'PACK-20L' } },
      update: { name: '20 Liters Jerry Can', quantity: 20, status: 'ACTIVE' },
      create: {
        id: uuidv7(),
        organizationId: org.id,
        code: 'PACK-20L',
        name: '20 Liters Jerry Can',
        quantity: 20,
        status: 'ACTIVE',
      },
    });

    // 5. Seed Finished Products with Real Stock
    const productsData = [
      {
        code: 'FP-UREA-46',
        name: 'Shehswar Urea 46% N (Prilled)',
        categoryId: catFertilizer.id,
        packSizeId: pack50kg.id,
        fertilizerType: 'UREA',
        bagWeight: 50,
        defaultSellingPrice: 4500,
        standardCost: 3800,
        stock: 2500, // 2,500 bags
      },
      {
        code: 'FP-DAP-GR',
        name: 'Shehswar DAP Granular 18-46-0',
        categoryId: catFertilizer.id,
        packSizeId: pack50kg.id,
        fertilizerType: 'DAP',
        bagWeight: 50,
        defaultSellingPrice: 11800,
        standardCost: 10200,
        stock: 1200, // 1,200 bags
      },
      {
        code: 'FP-NPK-151515',
        name: 'Shehswar NPK 15-15-15 Balanced Compound',
        categoryId: catFertilizer.id,
        packSizeId: pack50kg.id,
        fertilizerType: 'NPK',
        bagWeight: 50,
        defaultSellingPrice: 8500,
        standardCost: 7200,
        stock: 850, // 850 bags
      },
      {
        code: 'FP-ZINC-33',
        name: 'Shehswar Zinc Plus 33% (Micronutrient)',
        categoryId: catBio.id,
        packSizeId: pack10kg.id,
        fertilizerType: 'MICRONUTRIENT',
        bagWeight: 10,
        defaultSellingPrice: 2400,
        standardCost: 1900,
        stock: 1800, // 1,800 packs
      },
      {
        code: 'FP-HUMIC-20L',
        name: 'Shehswar Bio-Humic Acid Liquid Formula',
        categoryId: catBio.id,
        packSizeId: pack20L.id,
        fertilizerType: 'BIO_STIMULANT',
        bagWeight: 22,
        defaultSellingPrice: 3600,
        standardCost: 2800,
        stock: 650, // 650 cans
      },
    ];

    const seededProducts = [];
    for (const p of productsData) {
      const prod = await prisma.finishedProduct.upsert({
        where: { companyId_productCode: { companyId: comp.id, productCode: p.code } },
        update: {
          productName: p.name,
          categoryId: p.categoryId,
          packSizeId: p.packSizeId,
          fertilizerType: p.fertilizerType,
          bagWeight: p.bagWeight,
          defaultSellingPrice: p.defaultSellingPrice,
          standardCost: p.standardCost,
          status: 'ACTIVE',
        },
        create: {
          id: uuidv7(),
          organizationId: org.id,
          companyId: comp.id,
          productCode: p.code,
          productName: p.name,
          categoryId: p.categoryId,
          packSizeId: p.packSizeId,
          fertilizerType: p.fertilizerType,
          bagWeight: p.bagWeight,
          defaultSellingPrice: p.defaultSellingPrice,
          standardCost: p.standardCost,
          status: 'ACTIVE',
        },
      });

      // Real-time stock record
      const existingStock = await prisma.warehouseStock.findFirst({
        where: {
          companyId: comp.id,
          warehouseId: warehouse.id,
          itemType: 'FINISHED_PRODUCT',
          finishedProductId: prod.id,
        },
      });

      if (existingStock) {
        await prisma.warehouseStock.update({
          where: { id: existingStock.id },
          data: { quantityOnHand: p.stock, averageCost: p.standardCost },
        });
      } else {
        await prisma.warehouseStock.create({
          data: {
            id: uuidv7(),
            organizationId: org.id,
            companyId: comp.id,
            warehouseId: warehouse.id,
            itemType: 'FINISHED_PRODUCT',
            finishedProductId: prod.id,
            quantityOnHand: p.stock,
            averageCost: p.standardCost,
          },
        });
      }

      seededProducts.push(prod);
    }
    console.log(`✓ Seeded ${seededProducts.length} finished products with warehouse stock.`);

    // 6. Seed Seasonal Rate List with Versions & Active Items
    const rateList = await prisma.rateList.upsert({
      where: { companyId_code: { companyId: comp.id, code: 'RL-SEASON-2026' } },
      update: { name: 'Kharif 2026 Seasonal Official Rate List', status: 'ACTIVE', isMobileVisible: true },
      create: {
        id: uuidv7(),
        organizationId: org.id,
        companyId: comp.id,
        code: 'RL-SEASON-2026',
        name: 'Kharif 2026 Seasonal Official Rate List',
        category: 'SEASONAL',
        status: 'ACTIVE',
        isMobileVisible: true,
        isMobileSelectable: true,
      },
    });

    const rlVersion = await prisma.rateListVersion.upsert({
      where: { rateListId_versionNumber: { rateListId: rateList.id, versionNumber: 1 } },
      update: { status: 'ACTIVE' },
      create: {
        id: uuidv7(),
        rateListId: rateList.id,
        versionNumber: 1,
        status: 'ACTIVE',
        effectiveFrom: new Date('2026-01-01'),
        effectiveTo: new Date('2026-12-31'),
      },
    });

    for (const prod of seededProducts) {
      const existingItem = await prisma.rateListItem.findFirst({
        where: { rateListVersionId: rlVersion.id, finishedProductId: prod.id },
      });

      if (existingItem) {
        await prisma.rateListItem.update({
          where: { id: existingItem.id },
          data: { baseRate: prod.defaultSellingPrice, isActive: true },
        });
      } else {
        await prisma.rateListItem.create({
          data: {
            id: uuidv7(),
            rateListVersionId: rlVersion.id,
            finishedProductId: prod.id,
            packSizeId: prod.packSizeId,
            baseRate: prod.defaultSellingPrice,
            isActive: true,
          },
        });
      }
    }

    // 7. Seed Active Published Mobile Pricing Scheme (Requirement 24)
    await prisma.pricingScheme.upsert({
      where: { companyId_code: { companyId: comp.id, code: 'SCHEME-EARLY-BOOKING' } },
      update: {
        name: 'Kharif Early Booking 5% Cash Discount',
        status: 'ACTIVE',
        isMobileVisible: true,
        isMobileSelectable: true,
      },
      create: {
        id: uuidv7(),
        organizationId: org.id,
        companyId: comp.id,
        code: 'SCHEME-EARLY-BOOKING',
        name: 'Kharif Early Booking 5% Cash Discount',
        description: 'Instant 5% discount on prompt settlement for booked orders',
        schemeType: 'CASH_DISCOUNT',
        paymentTerm: 'CASH',
        status: 'ACTIVE',
        priority: 10,
        isMobileVisible: true,
        isMobileSelectable: true,
        effectiveFrom: new Date('2026-01-01'),
        effectiveTo: new Date('2026-12-31'),
        discountComponents: [
          { type: 'PERCENTAGE', value: 5.0, description: 'Early season advance discount' },
        ],
      },
    });
    console.log('✓ Published mobile pricing scheme seeded.');

    // 8. Seed Dealers with Specific Credit Limits & Balances
    const dealersData = [
      {
        code: 'DLR-MUL-001',
        name: 'Haji Muhammad & Sons Zarai Markaz',
        businessName: 'Haji Muhammad Agro Chemicals',
        contactPerson: 'Haji Muhammad Aslam',
        phone: '0300-8654321',
        city: 'Multan',
        address: 'Bosan Road, Opposite Grain Market, Multan',
        creditLimit: 5000000,      // 5,000,000 PKR
        currentBalance: 850000,     // 850,000 PKR outstanding
        annualTarget: 25000000,
      },
      {
        code: 'DLR-KHN-002',
        name: 'Rehman Brothers Agri Services',
        businessName: 'Rehman Khad & Beej Store',
        contactPerson: 'Chaudhry Abdul Rehman',
        phone: '0301-7654321',
        city: 'Khanewal',
        address: 'Main Kacha Khuh Road, Khanewal',
        creditLimit: 3500000,      // 3,500,000 PKR
        currentBalance: 0,          // 0 outstanding -> 100% available credit
        annualTarget: 18000000,
      },
      {
        code: 'DLR-VHR-003',
        name: 'Ittehad Kissan Corporation',
        businessName: 'Ittehad Agro Traders',
        contactPerson: 'Malik Tariq Mehmood',
        phone: '0302-6543210',
        city: 'Vehari',
        address: 'Club Road, Near Sabzi Mandi, Vehari',
        creditLimit: 8000000,      // 8,000,000 PKR
        currentBalance: 2400000,    // 2,400,000 PKR outstanding
        annualTarget: 40000000,
      },
      {
        code: 'DLR-LOD-004',
        name: 'Bismillah Zarai Agency',
        businessName: 'Bismillah Pesticides & Fertilizer',
        contactPerson: 'Rana Shahid Iqbal',
        phone: '0303-5432109',
        city: 'Lodhran',
        address: 'Bahawalpur Road, Lodhran Bypass',
        creditLimit: 10000000,     // 10,000,000 PKR
        currentBalance: 4200000,    // 4,200,000 PKR outstanding
        annualTarget: 50000000,
      },
    ];

    const seededDealers = [];
    for (const d of dealersData) {
      const dealer = await prisma.dealer.upsert({
        where: { companyId_code: { companyId: comp.id, code: d.code } },
        update: {
          name: d.name,
          businessName: d.businessName,
          contactPerson: d.contactPerson,
          phone: d.phone,
          city: d.city,
          address: d.address,
          territoryId: territory.id,
          assignedFieldOfficerId: salesOfficer.id,
          creditLimit: d.creditLimit,
          currentBalance: d.currentBalance,
          annualAgreementTarget: d.annualTarget,
          status: 'ACTIVE',
        },
        create: {
          id: uuidv7(),
          organizationId: org.id,
          companyId: comp.id,
          code: d.code,
          name: d.name,
          businessName: d.businessName,
          contactPerson: d.contactPerson,
          phone: d.phone,
          city: d.city,
          address: d.address,
          territoryId: territory.id,
          assignedFieldOfficerId: salesOfficer.id,
          creditLimit: d.creditLimit,
          currentBalance: d.currentBalance,
          annualAgreementTarget: d.annualTarget,
          status: 'ACTIVE',
        },
      });

      // Ensure explicit SalesOfficerDealerAssignment mapping for mobile filtering
      await prisma.salesOfficerDealerAssignment.upsert({
        where: { userId_dealerId: { userId: salesOfficer.id, dealerId: dealer.id } },
        update: {},
        create: {
          id: uuidv7(),
          userId: salesOfficer.id,
          dealerId: dealer.id,
        },
      });

      // Seed Dedicated CreditLimit record for dealer
      const existingCreditLimit = await prisma.creditLimit.findFirst({
        where: {
          companyId: comp.id,
          level: 'DEALER',
          entityId: dealer.id,
        },
      });

      if (existingCreditLimit) {
        await prisma.creditLimit.update({
          where: { id: existingCreditLimit.id },
          data: {
            creditLimit: d.creditLimit,
            status: 'ACTIVE',
          },
        });
      } else {
        await prisma.creditLimit.create({
          data: {
            id: uuidv7(),
            organizationId: org.id,
            companyId: comp.id,
            level: 'DEALER',
            entityId: dealer.id,
            creditLimit: d.creditLimit,
            maxCreditPercentage: 25.00,
            creditControlMode: 'BOTH',
            status: 'ACTIVE',
            notes: `Authorized Credit Limit for ${dealer.name}`,
          },
        });
      }

      // Seed opening ledger entry if balance > 0
      if (d.currentBalance > 0) {
        const existingEntry = await prisma.dealerLedgerEntry.findFirst({
          where: { dealerId: dealer.id, entryType: 'OPENING_BALANCE' },
        });

        if (!existingEntry) {
          await prisma.dealerLedgerEntry.create({
            data: {
              id: uuidv7(),
              organizationId: org.id,
              companyId: comp.id,
              dealerId: dealer.id,
              entryType: 'OPENING_BALANCE',
              referenceId: `OB-${d.code}`,
              voucherNumber: `V-OB-${d.code}`,
              description: 'Opening Balance for Fiscal Year 2026',
              debit: d.currentBalance,
              credit: 0,
              runningBalance: d.currentBalance,
              entryDate: new Date('2026-01-01'),
            },
          });
        }
      }

      seededDealers.push(dealer);
    }

    // Seed Sales Officer Overall Credit Limit
    const existingSoCreditLimit = await prisma.creditLimit.findFirst({
      where: {
        companyId: comp.id,
        level: 'SALES_OFFICER',
        entityId: salesOfficer.id,
      },
    });

    if (existingSoCreditLimit) {
      await prisma.creditLimit.update({
        where: { id: existingSoCreditLimit.id },
        data: { creditLimit: 50000000, status: 'ACTIVE' },
      });
    } else {
      await prisma.creditLimit.create({
        data: {
          id: uuidv7(),
          organizationId: org.id,
          companyId: comp.id,
          level: 'SALES_OFFICER',
          entityId: salesOfficer.id,
          creditLimit: 50000000,
          maxCreditPercentage: 30.00,
          creditControlMode: 'BOTH',
          status: 'ACTIVE',
          notes: 'Sales Officer Field Portfolio Overall Credit Allocation Pool',
        },
      });
    }

    console.log(`✓ Seeded ${seededDealers.length} dealers with full credit limits and sales officer assignment.`);

    // 9. Summary & Audit Output
    console.log('\n=============================================================');
    console.log('MOBILE APP TESTING DATA VERIFICATION:');
    console.log('=============================================================');
    console.log('\n--- 1. AUTHORIZED DEALERS & CREDIT LIMITS ---');
    for (const d of seededDealers) {
      const limit = Number(d.creditLimit);
      const balance = Number(d.currentBalance);
      const avail = limit - balance;
      console.log(`• [${d.code}] ${d.name} (${d.city})`);
      console.log(`  Credit Limit:     PKR ${limit.toLocaleString()}`);
      console.log(`  Current Balance:  PKR ${balance.toLocaleString()}`);
      console.log(`  Available Credit: PKR ${avail.toLocaleString()}`);
      console.log(`  Assigned Officer: ${salesOfficer.email}`);
    }

    console.log('\n--- 2. PRODUCTS & REAL-TIME STOCK ---');
    for (const p of productsData) {
      console.log(`• [${p.code}] ${p.name}`);
      console.log(`  Selling Price: PKR ${p.defaultSellingPrice.toLocaleString()}`);
      console.log(`  Stock on Hand: ${p.stock.toLocaleString()} units`);
    }

    console.log('\n=============================================================');
    console.log(`SUCCESS: Mobile app data ready on [${label}]!`);
    console.log('=============================================================\n');
  } catch (err) {
    console.error(`Error seeding mobile data on ${label}:`, err);
    throw err;
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  await seedMobileDataFor('Render Production PostgreSQL', remoteDbUrl);
}

main().catch((err) => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
