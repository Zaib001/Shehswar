const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { v7: uuidv7 } = require('uuid');

async function testCreate(name, data) {
  try {
    console.log(`\nTesting: ${name}...`);
    const res = await prisma.productCosting.create({ data });
    console.log(`SUCCESS: ${res.id}`);
    await prisma.productCosting.delete({ where: { id: res.id } });
  } catch (err) {
    console.log(`FAILED with code ${err.code}: ${err.message}`);
  }
}

async function main() {
  const org = await prisma.organization.findFirst();
  const comp = await prisma.company.findFirst();
  const fp = await prisma.finishedProduct.findFirst();
  const rm = await prisma.rawMaterial.findFirst();

  const baseData = {
    id: uuidv7(),
    organizationId: org.id,
    companyId: comp.id,
    version: 999,
    batchOutputQuantity: 100,
    packSize: 1,
    packSizeUnit: 'Liter',
    totalVolume: 100,
    totalRawMaterialCost: 15000,
    totalPackagingCost: 4000,
    totalBatchCost: 19000,
    costPerUnit: 190,
    status: 'ACTIVE',
  };

  // Test 1: finishedProductId is null
  await testCreate('finishedProductId is null', {
    ...baseData,
    id: uuidv7(),
    finishedProductId: null,
  });

  // Test 2: finishedProductId is empty string ''
  await testCreate('finishedProductId is empty string', {
    ...baseData,
    id: uuidv7(),
    finishedProductId: '',
  });

  // Test 3: materialLines with rawMaterialId null or empty string
  await testCreate('materialLine with empty rawMaterialId', {
    ...baseData,
    id: uuidv7(),
    finishedProductId: fp.id,
    materialLines: {
      create: [{
        id: uuidv7(),
        rawMaterialId: '',
        quantity: 10,
        unitCost: 100,
        totalCost: 1000,
      }],
    },
  });

  // Test 4: materialLines with a dummy rawMaterialId that does not exist
  await testCreate('materialLine with non-existent rawMaterialId', {
    ...baseData,
    id: uuidv7(),
    finishedProductId: fp.id,
    materialLines: {
      create: [{
        id: uuidv7(),
        rawMaterialId: '00000000-0000-0000-0000-000000000000',
        quantity: 10,
        unitCost: 100,
        totalCost: 1000,
      }],
    },
  });

  // Test 5: What if user didn't select an End Product, so finishedProductId is empty string ''
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });

