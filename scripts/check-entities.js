const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const match = await p.finishedProduct.findMany({
    where: {
      productName: { contains: 'Lambda', mode: 'insensitive' }
    }
  });
  console.log('Lambda products:', match);
  await p.$disconnect();
})();
