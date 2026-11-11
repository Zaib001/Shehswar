const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('--- Inspecting ProductCosting relations and existing records ---');
  const org = await prisma.organization.findFirst();
  const comp = await prisma.company.findFirst();
  const user = await prisma.user.findFirst();
  const fp = await prisma.finishedProduct.findFirst();
  const rm = await prisma.rawMaterial.findFirst();
  const pm = await prisma.packingMaterial.findFirst();

  console.log('Org:', org?.id);
  console.log('Company:', comp?.id);
  console.log('User:', user?.id);
  console.log('FinishedProduct:', fp?.id, fp?.productName);
  console.log('RawMaterial:', rm?.id, rm?.materialName);
  console.log('PackingMaterial:', pm?.id, pm?.materialName);

  // Let's test what happens when creating ProductCosting with various payloads:
  // Case 1: finishedProductId is null/undefined
  // Case 2: materialLines contains a materialId that might or might not exist
  // Case 3: packagingLines contains a packingMaterialId that might or might not exist
  // Case 4: createdById
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
