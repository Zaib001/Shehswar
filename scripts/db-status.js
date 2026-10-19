const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.count();
  const roles = await prisma.role.count();
  const permissions = await prisma.permission.count();
  console.log(`Users: ${users}, Roles: ${roles}, Permissions: ${permissions}`);

  // Query all tables from postgres
  const tables = await prisma.$queryRaw`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
    ORDER BY table_name;
  `;
  
  console.log(`Total tables: ${tables.length}`);
  for (const t of tables) {
    const tblName = t.table_name;
    try {
      const countResult = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int as cnt FROM "${tblName}"`);
      const cnt = countResult[0]?.cnt || 0;
      if (cnt > 0) {
        console.log(`  ${tblName.padEnd(35)}: ${cnt}`);
      }
    } catch (e) {
      console.log(`  ${tblName.padEnd(35)}: ERROR: ${e.message}`);
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
