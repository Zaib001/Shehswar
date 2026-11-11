const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const items = await prisma.purchaseOrderItem.findMany({
    select: {
      id: true,
      itemName: true,
      materialId: true,
      materialType: true,
      order: { select: { poNumber: true } },
    },
  });

  console.log('Purchase Order Items in DB:');
  for (const it of items) {
    let rmExists = false;
    let pmExists = false;
    if (it.materialId) {
      const rm = await prisma.rawMaterial.findUnique({ where: { id: it.materialId } });
      rmExists = !!rm;
      const pm = await prisma.packingMaterial.findUnique({ where: { id: it.materialId } });
      pmExists = !!pm;
    }
    console.log({
      po: it.order?.poNumber,
      itemName: it.itemName,
      materialType: it.materialType,
      materialId: it.materialId,
      rmExists,
      pmExists,
    });
  }
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
