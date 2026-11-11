const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const orgs = await prisma.organization.findMany();
  console.log('Organizations:', JSON.stringify(orgs, null, 2));

  const comps = await prisma.company.findMany();
  console.log('Companies:', JSON.stringify(comps, null, 2));

  const uoms = await prisma.unitOfMeasure.findMany();
  console.log('UOMs:', JSON.stringify(uoms, null, 2));

  const cats = await prisma.materialCategory.findMany();
  console.log('Material Categories:', JSON.stringify(cats, null, 2));

  const rms = await prisma.rawMaterial.findMany({
    include: {
      category: true,
      baseUom: true,
      purchaseUom: true,
    }
  });
  console.log('Current Raw Materials:', JSON.stringify(rms, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());

