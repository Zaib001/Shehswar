const { PrismaClient } = require('@prisma/client');
const url = 'postgresql://shehswar_user:PHHDD5jvPcZsDCX2LH7mKrcO5GBtobti@dpg-dbc8moafngtc739dhgkg-a.oregon-postgres.render.com/shehswar_one360?sslmode=require';
const prisma = new PrismaClient({ datasources: { db: { url } } });

async function test() {
  const companyId = '30872089-360b-463b-98cf-f4224862fb15';
  const so = await prisma.user.findFirst({ where: { email: 'sales.officer@shehswar.com' } });
  const territory = await prisma.territory.findFirst({ where: { code: 'TERR-MULTAN-CENTRAL' } });

  console.log('Testing getOfficerPerformance query logic:');
  const assignedDealers = await prisma.dealer.findMany({
    where: { companyId, assignedFieldOfficerId: so.id },
    select: { id: true, code: true, name: true, city: true, annualAgreementTarget: true, monthlySalesTarget: true },
  });

  console.log('Assigned Dealers found in getOfficerPerformance:', assignedDealers.length);
  assignedDealers.forEach((d) => console.log('  -', d.code, d.name));

  // Check getTerritoryPerformance query logic:
  const invoices = await prisma.salesInvoice.findMany({
    where: { companyId, territoryId: territory.id },
  });
  console.log('\nInvoices for territory:', invoices.length);

  // In getTerritoryPerformance:
  const officerMap = new Map();
  for (const inv of invoices) {
    const soId = inv.salesOfficerId || 'UNASSIGNED';
    officerMap.set(soId, { revenue: 0 });
  }

  console.log('Officers list returned by getTerritoryPerformance if invoices == 0:');
  console.log(Array.from(officerMap.entries()));

  await prisma.$disconnect();
}

test().catch(console.error);
