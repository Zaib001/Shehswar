const { PrismaClient } = require('@prisma/client');
const url = 'postgresql://shehswar_user:PHHDD5jvPcZsDCX2LH7mKrcO5GBtobti@dpg-dbc8moafngtc739dhgkg-a.oregon-postgres.render.com/shehswar_one360?sslmode=require';
const prisma = new PrismaClient({ datasources: { db: { url } } });

async function test() {
  const comp = await prisma.company.findFirst({ where: { code: 'COMP-SHEHSWAR' } });
  const zone = await prisma.zone.findFirst({ where: { code: 'ZONE-MULTAN' } });
  const territory = await prisma.territory.findFirst({ where: { code: 'TERR-MULTAN-CENTRAL' } });
  const so = await prisma.user.findFirst({ where: { email: 'sales.officer@shehswar.com' } });

  console.log('Company:', comp.id, comp.name);
  console.log('Zone:', zone?.id, zone?.name);
  console.log('Territory:', territory?.id, territory?.name, 'managerId:', territory?.managerId);
  console.log('Sales Officer:', so?.id, so?.email);

  const assignedDealers = await prisma.dealer.findMany({
    where: { territoryId: territory?.id },
  });
  console.log('\nAssigned Dealers in Territory:', assignedDealers.length);
  assignedDealers.forEach((d) => console.log(`• [${d.code}] ${d.name} (${d.city}) | status: ${d.status}`));

  const invoices = await prisma.salesInvoice.findMany({
    where: { companyId: comp.id },
  });
  console.log('\nTotal Sales Invoices in DB:', invoices.length);

  await prisma.$disconnect();
}
test().catch(console.error);
