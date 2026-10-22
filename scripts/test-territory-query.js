const { PrismaClient } = require('@prisma/client');
const url = 'postgresql://shehswar_user:PHHDD5jvPcZsDCX2LH7mKrcO5GBtobti@dpg-dbc8moafngtc739dhgkg-a.oregon-postgres.render.com/shehswar_one360?sslmode=require';
const prisma = new PrismaClient({ datasources: { db: { url } } });

async function test() {
  const territory = await prisma.territory.findFirst({
    where: { code: 'TERR-MULTAN-CENTRAL' },
    include: {
      zone: { include: { region: true } },
      salesOfficer: true,
      dealers: true,
    },
  });

  const so = await prisma.user.findFirst({ where: { email: 'sales.officer@shehswar.com' } });

  console.log('Territory:', territory.name, territory.id);
  console.log('Territory Manager:', territory.salesOfficer?.firstName, territory.salesOfficer?.email);
  console.log('Dealers in territory relation:', territory.dealers.length);

  // Check getOfficerPerformance query
  const assignedDealers = await prisma.dealer.findMany({
    where: { companyId: territory.companyId, assignedFieldOfficerId: so.id },
  });
  console.log('Dealers with assignedFieldOfficerId == so.id:', assignedDealers.length);
  assignedDealers.forEach((d) => console.log('  -', d.code, d.name, d.city));

  await prisma.$disconnect();
}
test().catch(console.error);
