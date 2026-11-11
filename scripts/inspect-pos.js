const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const pos = await p.purchaseOrder.findMany({
    include: {
      vendor: { select: { id: true, name: true, code: true } },
      warehouse: { select: { id: true, name: true, code: true } },
      items: true,
    },
  });
  console.log('Total POs in DB:', pos.length);
  pos.forEach((po) => {
    console.log(`\nPO: ${po.poNumber} | Status: ${po.status} | Date: ${po.createdAt.toISOString().split('T')[0]} | Vendor: ${po.vendor?.name} | Warehouse: ${po.warehouse?.name}`);
    po.items.forEach((it) => {
      console.log(`   - Item: "${it.itemName}" | Type: ${it.materialType} | MaterialId: ${it.materialId} | Qty: ${it.quantity} | Unit: ${it.unit} | Rate: PKR ${it.unitRate} | Total: PKR ${it.lineTotal}`);
    });
  });
  await p.$disconnect();
})();
