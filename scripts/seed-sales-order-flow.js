/**
 * Seed real reference data for Sales Order flow:
 * - Nectar Warehouse 01
 * - Market Hierarchy (Region -> Zone -> Territory)
 * - Dealer: TTA Alyas Zari Pesticide Traders
 * - Product: Vilson 1000ML
 * - Batch: B-2026-001 with 200 units stock in Nectar Warehouse 01
 * - Schemes: SS, CA, ABC, NNR, MCCM
 * - Rate List: SR-2026-001 linked to SS containing Vilson 1000ML @ 1299
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const crypto = require('crypto');

function uuidv7() {
  return crypto.randomUUID();
}

async function main() {
  console.log('Seeding Sales Order Reference Data...');

  // 1. Find Nectar and Shehswar companies
  const nectar = await prisma.company.findFirst({
    where: { OR: [{ code: 'COMP-NECTAR' }, { name: { contains: 'Nectar', mode: 'insensitive' } }] },
  });
  if (!nectar) throw new Error('Nectar company not found');

  const shehswar = await prisma.company.findFirst({
    where: { OR: [{ code: 'COMP-SHEHSWAR' }, { isParent: true }] },
  });

  const orgId = nectar.organizationId;
  console.log(`Operating under Org: ${orgId}, Nectar ID: ${nectar.id}`);

  // 2. Ensure Pack Size '1 LTR' exists
  let packSize1L = await prisma.packSize.findFirst({
    where: { organizationId: orgId, name: { contains: '1 LTR', mode: 'insensitive' } },
  });
  if (!packSize1L) {
    packSize1L = await prisma.packSize.findFirst({
      where: { organizationId: orgId, quantity: 1 },
    });
  }
  if (!packSize1L) {
    let uomLtr = await prisma.unitOfMeasure.findFirst({
      where: { organizationId: orgId, symbol: 'LTR' },
    });
    if (!uomLtr) {
      uomLtr = await prisma.unitOfMeasure.create({
        data: {
          id: uuidv7(),
          organizationId: orgId,
          code: 'UOM-LTR',
          name: 'Liter',
          symbol: 'LTR',
          category: 'VOLUME',
          isBaseUnit: true,
          systemDefault: true,
        },
      });
    }
    packSize1L = await prisma.packSize.create({
      data: {
        id: uuidv7(),
        organizationId: orgId,
        code: 'PS-1LTR',
        name: '1 LTR',
        quantity: 1,
        uomId: uomLtr.id,
        status: 'ACTIVE',
      },
    });
  }
  console.log(`PackSize 1 LTR: ${packSize1L.name} (${packSize1L.id})`);

  // 3. Ensure Nectar Warehouse 01 exists
  let whNectar01 = await prisma.warehouse.findFirst({
    where: { companyId: nectar.id, name: 'Nectar Warehouse 01' },
  });
  if (!whNectar01) {
    whNectar01 = await prisma.warehouse.create({
      data: {
        id: uuidv7(),
        companyId: nectar.id,
        code: 'WH-NEC-01',
        name: 'Nectar Warehouse 01',
        type: 'DISTRIBUTION',
        location: 'Faisalabad Industrial Area',
        isActive: true,
      },
    });
  }
  console.log(`Nectar Warehouse: ${whNectar01.name} (${whNectar01.id})`);

  // 4. Market Hierarchy: South Region -> Faisalabad Zone -> Faisalabad Territory
  let regionSouth = await prisma.region.findFirst({
    where: { companyId: nectar.id, name: { contains: 'South', mode: 'insensitive' } },
  });
  if (!regionSouth) {
    regionSouth = await prisma.region.create({
      data: {
        id: uuidv7(),
        companyId: nectar.id,
        code: 'REG-SOUTH',
        name: 'South Region',
      },
    });
  }

  let zoneFaisalabad = await prisma.zone.findFirst({
    where: { regionId: regionSouth.id, name: { contains: 'Faisalabad', mode: 'insensitive' } },
  });
  if (!zoneFaisalabad) {
    zoneFaisalabad = await prisma.zone.create({
      data: {
        id: uuidv7(),
        regionId: regionSouth.id,
        code: 'ZONE-FSD',
        name: 'Faisalabad Zone',
      },
    });
  }

  let territoryFaisalabad = await prisma.territory.findFirst({
    where: { zoneId: zoneFaisalabad.id, name: { contains: 'Faisalabad', mode: 'insensitive' } },
  });
  if (!territoryFaisalabad) {
    territoryFaisalabad = await prisma.territory.create({
      data: {
        id: uuidv7(),
        zoneId: zoneFaisalabad.id,
        code: 'TERR-FSD-01',
        name: 'Faisalabad Territory',
      },
    });
  }
  console.log(`Hierarchy: Region=${regionSouth.name}, Zone=${zoneFaisalabad.name}, Terr=${territoryFaisalabad.name}`);

  // 5. Ensure Sales Officer exists
  let salesOfficer = await prisma.user.findFirst({
    where: { companyId: nectar.id, isActive: true },
  });
  if (!salesOfficer) {
    salesOfficer = await prisma.user.findFirst({ where: { isActive: true } });
  }

  // 6. Ensure Dealer: TTA Alyas Zari Pesticide Traders
  let dealer = await prisma.dealer.findFirst({
    where: { companyId: nectar.id, name: { contains: 'Alyas', mode: 'insensitive' } },
  });
  if (!dealer) {
    dealer = await prisma.dealer.create({
      data: {
        id: uuidv7(),
        organizationId: orgId,
        companyId: nectar.id,
        code: 'DLR-NEC-001',
        name: 'TTA Alyas Zari Pesticide Traders',
        territoryId: territoryFaisalabad.id,
        assignedFieldOfficerId: salesOfficer ? salesOfficer.id : null,
        creditLimit: 1000000,
        currentBalance: 700000,
        phone: '0300-1234567',
        address: 'Chiniot Bazaar, Faisalabad',
        status: 'ACTIVE',
      },
    });
  } else {
    dealer = await prisma.dealer.update({
      where: { id: dealer.id },
      data: {
        territoryId: territoryFaisalabad.id,
        creditLimit: 1000000,
        currentBalance: 700000,
        status: 'ACTIVE',
      },
    });
  }
  console.log(`Dealer: ${dealer.name} (${dealer.code}) | Credit Limit: PKR ${dealer.creditLimit} | Balance: PKR ${dealer.currentBalance}`);

  // 7. Ensure Finished Product: Vilson 1000ML for Nectar
  let prodVilson = await prisma.finishedProduct.findFirst({
    where: { companyId: nectar.id, productName: { contains: 'Vilson', mode: 'insensitive' } },
  });
  if (!prodVilson) {
    prodVilson = await prisma.finishedProduct.create({
      data: {
        id: uuidv7(),
        organizationId: orgId,
        companyId: nectar.id,
        productCode: 'FG-000036',
        productName: 'Vilson 1000ML',
        urduName: 'ولسن 1000 ملی لیٹر',
        productType: 'FINISHED_PRODUCT',
        packSizeId: packSize1L.id,
        packingQuantity: 1,
        packingUnit: 'LTR',
        defaultSellingPrice: 1299,
        standardCost: 950,
        status: 'ACTIVE',
      },
    });
  } else {
    prodVilson = await prisma.finishedProduct.update({
      where: { id: prodVilson.id },
      data: {
        packSizeId: packSize1L.id,
        packingUnit: 'LTR',
        defaultSellingPrice: 1299,
        status: 'ACTIVE',
      },
    });
  }
  console.log(`Product: ${prodVilson.productName} (${prodVilson.productCode}) | Price: PKR ${prodVilson.defaultSellingPrice}`);

  // 8. Ensure Batch B-2026-001 for Vilson 1000ML
  let batchVilson = await prisma.productBatch.findFirst({
    where: { finishedProductId: prodVilson.id, batchNumber: 'B-2026-001' },
  });
  if (!batchVilson) {
    batchVilson = await prisma.productBatch.create({
      data: {
        id: uuidv7(),
        organizationId: orgId,
        companyId: nectar.id,
        finishedProductId: prodVilson.id,
        batchNumber: 'B-2026-001',
        manufacturingDate: new Date('2026-01-15'),
        expiryDate: new Date('2028-01-15'),
        initialQuantity: 500,
        availableQuantity: 200,
        allocatedQuantity: 0,
        isActive: true,
        status: 'RELEASED',
      },
    });
  } else {
    batchVilson = await prisma.productBatch.update({
      where: { id: batchVilson.id },
      data: {
        availableQuantity: 200,
        isActive: true,
        status: 'RELEASED',
        expiryDate: new Date('2028-01-15'),
      },
    });
  }
  console.log(`Batch: ${batchVilson.batchNumber} | Available: ${batchVilson.availableQuantity}`);

  // 9. Ensure Warehouse Stock in Nectar Warehouse 01 for Vilson 1000ML
  let stockRecord = await prisma.warehouseStock.findFirst({
    where: {
      warehouseId: whNectar01.id,
      finishedProductId: prodVilson.id,
      itemType: 'FINISHED_PRODUCT',
    },
  });
  if (!stockRecord) {
    stockRecord = await prisma.warehouseStock.create({
      data: {
        id: uuidv7(),
        organizationId: orgId,
        companyId: nectar.id,
        warehouseId: whNectar01.id,
        itemType: 'FINISHED_PRODUCT',
        finishedProductId: prodVilson.id,
        quantityOnHand: 200,
        averageCost: 950,
      },
    });
  } else {
    stockRecord = await prisma.warehouseStock.update({
      where: { id: stockRecord.id },
      data: {
        quantityOnHand: 200,
        averageCost: 950,
      },
    });
  }
  console.log(`Warehouse Stock in ${whNectar01.name}: ${stockRecord.quantityOnHand} units`);

  // 10. Commercial Schemes for Nectar:
  const schemesToSeed = [
    {
      code: 'SS',
      shortCode: 'SS',
      schemeTypeCode: 'SS',
      name: 'SS — Seasonal Rate',
      discountPct: 15,
      defaultDiscountPct: 15,
      cashDiscountPct: 0,
      paymentTerm: 'ANY',
      schemeType: 'SEASONAL',
    },
    {
      code: 'CA',
      shortCode: 'CA',
      schemeTypeCode: 'CA',
      name: 'CA — Cash Advance',
      discountPct: 15,
      defaultDiscountPct: 15,
      cashDiscountPct: 15,
      paymentTerm: 'CASH',
      schemeType: 'CASH_DISCOUNT',
    },
    {
      code: 'ABC',
      shortCode: 'ABC',
      schemeTypeCode: 'ABC',
      name: 'ABC — Advance Booking',
      discountPct: 20,
      defaultDiscountPct: 20,
      cashDiscountPct: 15,
      additionalBookingPct: 5,
      paymentTerm: 'ADVANCE',
      schemeType: 'ADVANCE_BOOKING',
    },
    {
      code: 'NNR',
      shortCode: 'NNR',
      schemeTypeCode: 'NNR',
      name: 'NNR — Net Net Rate',
      discountPct: 0,
      defaultDiscountPct: 0,
      cashDiscountPct: 0,
      paymentTerm: 'ANY',
      schemeType: 'NET_RATE',
    },
    {
      code: 'MCCM',
      shortCode: 'MCCM',
      schemeTypeCode: 'MCCM',
      name: 'MCCM — Mega Carnival Open Mela',
      discountPct: 15,
      defaultDiscountPct: 15,
      cashDiscountPct: 0,
      paymentTerm: 'ANY',
      schemeType: 'MELA_EVENT',
    },
  ];

  const targetCompanies = [nectar];
  if (shehswar && shehswar.id !== nectar.id) {
    targetCompanies.push(shehswar);
  }

  for (const comp of targetCompanies) {
    let seasonalRateList = await prisma.rateList.findFirst({
      where: { companyId: comp.id, code: 'SR-2026-001' },
    });

    if (!seasonalRateList) {
      seasonalRateList = await prisma.rateList.create({
        data: {
          id: uuidv7(),
          organizationId: orgId,
          companyId: comp.id,
          code: 'SR-2026-001',
          name: 'Seasonal Rate List 2026',
          category: 'SEASONAL',
          currency: 'PKR',
          status: 'ACTIVE',
        },
      });
    }

    // Ensure Version 1 exists
    let v1 = await prisma.rateListVersion.findFirst({
      where: { rateListId: seasonalRateList.id, versionNumber: 1 },
    });
    if (!v1) {
      v1 = await prisma.rateListVersion.create({
        data: {
          id: uuidv7(),
          rateListId: seasonalRateList.id,
          versionNumber: 1,
          status: 'ACTIVE',
          effectiveFrom: new Date('2026-01-01'),
        },
      });
    }

    // Ensure Vilson 1000ML is in Version 1
    let itemVilson = await prisma.rateListItem.findFirst({
      where: { rateListVersionId: v1.id, finishedProductId: prodVilson.id },
    });
    if (!itemVilson) {
      itemVilson = await prisma.rateListItem.create({
        data: {
          id: uuidv7(),
          rateListVersionId: v1.id,
          finishedProductId: prodVilson.id,
          baseRate: 1299,
          discountPercent: 15,
          schemeRate: 1104.15,
          fixedNetRate: 1104.15,
          isActive: true,
        },
      });
    } else {
      await prisma.rateListItem.update({
        where: { id: itemVilson.id },
        data: {
          baseRate: 1299,
          discountPercent: 15,
          schemeRate: 1104.15,
          fixedNetRate: 1104.15,
        },
      });
    }

    for (const s of schemesToSeed) {
      let scheme = await prisma.pricingScheme.findFirst({
        where: { companyId: comp.id, code: s.code },
      });
      const dataToSave = {
        name: s.name,
        shortCode: s.shortCode,
        schemeTypeCode: s.schemeTypeCode,
        schemeType: s.schemeType,
        discountPct: s.discountPct,
        defaultDiscountPct: s.defaultDiscountPct,
        cashDiscountPct: s.cashDiscountPct || 0,
        additionalBookingPct: s.additionalBookingPct || 0,
        paymentTerm: s.paymentTerm,
        baseRateListId: seasonalRateList.id,
        effectiveFrom: new Date('2026-01-01'),
        status: 'ACTIVE',
      };

      if (!scheme) {
        scheme = await prisma.pricingScheme.create({
          data: {
            id: uuidv7(),
            organizationId: orgId,
            companyId: comp.id,
            code: s.code,
            ...dataToSave,
          },
        });
      } else {
        scheme = await prisma.pricingScheme.update({
          where: { id: scheme.id },
          data: dataToSave,
        });
      }
      console.log(`Scheme in ${comp.name}: ${scheme.name} (${scheme.code}) -> BaseRL: ${seasonalRateList.code}`);
    }
  }

  console.log('Sales order reference data successfully seeded!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
