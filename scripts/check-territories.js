const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const territories = await prisma.territory.findMany({
    include: { zone: { include: { region: true } } }
  });
  console.log('Total territories:', territories.length);
  for (const t of territories) {
    console.log(`ID: ${t.id} | Name: "${t.name}" | Code: "${t.code}" | Zone: "${t.zone?.name}" | Region: "${t.zone?.region?.name}"`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
