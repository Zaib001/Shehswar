const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const uoms = await prisma.unitOfMeasure.findMany();
  console.log('All UOMs:', uoms.map(u => ({ id: u.id, code: u.code, name: u.name, symbol: u.symbol, category: u.category })));

  const cats = await prisma.materialCategory.findMany();
  console.log('All Categories:', cats.map(c => ({ id: c.id, code: c.code, name: c.name, type: c.categoryType })));

  const comps = await prisma.company.findMany();
  console.log('All Companies:', comps.map(c => ({ id: c.id, code: c.code, name: c.name, isParent: c.isParent })));
}

main().finally(() => prisma.$disconnect());

