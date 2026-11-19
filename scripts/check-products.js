const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://shehswar_user:PHHDD5jvPcZsDCX2LH7mKrcO5GBtobti@dpg-dbc8moafngtc739dhgkg-a.oregon-postgres.render.com/shehswar_one360?sslmode=require'
    }
  }
});

async function main() {
  const prods = await prisma.finishedProduct.findMany({
    take: 10,
    include: { packSize: true }
  });
  console.log('Sample Finished Products:');
  for (const p of prods) {
    console.log(`ID: ${p.id} | Name: "${p.productName}" | PackSize: "${p.packSize?.name}" | Code: "${p.productCode}"`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
