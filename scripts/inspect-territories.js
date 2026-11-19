const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  datasources: { db: { url: 'postgresql://shehswar_user:PHHDD5jvPcZsDCX2LH7mKrcO5GBtobti@dpg-dbc8moafngtc739dhgkg-a.oregon-postgres.render.com/shehswar_one360?sslmode=require' } }
});
async function main() {
  const territories = await prisma.territory.findMany({
    include: {
      zone: {
        include: {
          region: {
            include: {
              company: true,
              businessManager: true,
            },
          },
          areaManager: true,
        },
      },
      salesOfficer: true,
      dealers: {
        select: { id: true, name: true, businessName: true, code: true, city: true, address: true },
      },
    },
  });
  console.log('TERRITORIES COUNT:', territories.length);
  for (const t of territories) {
    console.log(JSON.stringify({
      id: t.id,
      name: t.name,
      code: t.code,
      zone: t.zone?.name,
      region: t.zone?.region?.name,
      province: t.zone?.region?.province?.name,
      dealersCount: t.dealers.length,
      dealers: t.dealers,
    }, null, 2));
  }
}
main().finally(() => prisma.$disconnect());
