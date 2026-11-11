const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const v = await p.vendor.findFirst({ where: { name: { contains: 'Al Nasar', mode: 'insensitive' } } });
  const rm = await p.rawMaterial.findFirst({ where: { materialName: { contains: 'Bifenthrin', mode: 'insensitive' } } });
  const fp = await p.finishedProduct.findFirst({ where: { productName: { contains: 'Bifenthrin', mode: 'insensitive' } } });
  console.log('Al Nasar vendor:', v);
  console.log('Bifenthrin RM:', rm);
  console.log('Bifenthrin FP:', fp);
  await p.$disconnect();
})();
