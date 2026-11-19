const { PrismaClient } = require('@prisma/client');

const renderUrl = 'postgresql://shehswar_user:PHHDD5jvPcZsDCX2LH7mKrcO5GBtobti@dpg-dbc8moafngtc739dhgkg-a.oregon-postgres.render.com/shehswar_one360?sslmode=require';
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: renderUrl
    }
  }
});

async function main() {
  const territories = await prisma.territory.findMany({
    include: { zone: { include: { region: true } } }
  });
  console.log('Total territories in Render DB:', territories.length);
  for (const t of territories) {
    console.log(`ID: ${t.id} | Name: "${t.name}" | Code: "${t.code}" | Zone: "${t.zone?.name}" | Region: "${t.zone?.region?.name}"`);
  }

  const dealers = await prisma.dealer.findMany({
    include: { territory: true }
  });
  console.log('\nTotal dealers in Render DB:', dealers.length);
  for (const d of dealers) {
    console.log(`ID: ${d.id} | Name: "${d.name}" | Shop: "${d.businessName}" | Code: "${d.code}" | Territory: "${d.territory?.name}" (${d.territory?.code}) | City: "${d.city}"`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
