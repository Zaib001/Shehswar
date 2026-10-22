const { PrismaClient } = require('@prisma/client');
const url = 'postgresql://shehswar_user:PHHDD5jvPcZsDCX2LH7mKrcO5GBtobti@dpg-dbc8moafngtc739dhgkg-a.oregon-postgres.render.com/shehswar_one360?sslmode=require';
const prisma = new PrismaClient({ datasources: { db: { url } } });

// Simulate the updated service logic
async function verify() {
  const companyId = '30872089-360b-463b-98cf-f4224862fb15';
  const zone = await prisma.zone.findFirst({ where: { code: 'ZONE-MULTAN' } });
  const territory = await prisma.territory.findFirst({
    where: { code: 'TERR-MULTAN-CENTRAL' },
    include: { salesOfficer: true, dealers: { where: { status: 'ACTIVE' } } },
  });
  const so = await prisma.user.findFirst({ where: { email: 'sales.officer@shehswar.com' } });

  console.log('1. Zone View Simulation:');
  console.log('Territory:', territory.name);
  console.log('Assigned active dealers count:', territory.dealers.length);

  console.log('\n2. Territory View Simulation (when invoices == 0):');
  const officerMap = new Map();
  if (territory.salesOfficer) {
    officerMap.set(territory.salesOfficer.id, {
      officerName: `${territory.salesOfficer.firstName} ${territory.salesOfficer.lastName}`.trim(),
      activeDealers: territory.dealers.length,
    });
  }
  console.log('Officers list for territory:', Array.from(officerMap.values()));

  console.log('\n3. Officer View Simulation (drill-down into Sales Officer):');
  const assignedDealers = await prisma.dealer.findMany({
    where: {
      companyId,
      OR: [
        { assignedFieldOfficerId: so.id },
        { officerAssignments: { some: { userId: so.id } } },
      ],
    },
  });
  console.log(`Dealers listed under ${so.email}: ${assignedDealers.length}`);
  assignedDealers.forEach((d) => console.log(`  • [${d.code}] ${d.name} (${d.city})`));

  await prisma.$disconnect();
}

verify().catch(console.error);
