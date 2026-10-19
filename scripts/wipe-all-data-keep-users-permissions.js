/**
 * SHEHSWAR ONE360 - Complete Data Purge
 * Removes ALL data from database while strictly preserving Users, Roles, Permissions, and Auth Structure.
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const PRESERVED_TABLES = new Set([
  'users',
  'roles',
  'permissions',
  'role_permissions',
  'user_roles',
  'organizations',
  'companies',
  'platform_tenants',
  '_prisma_migrations',
]);

async function main() {
  console.log('\n=============================================================');
  console.log('SHEHSWAR ONE360 - PURGING ALL DATA (PRESERVING USERS & PERMS)');
  console.log('=============================================================\n');

  // 1. Snapshot Auth
  const [usersCount, rolesCount, permsCount, userRolesCount] = await Promise.all([
    prisma.user.count(),
    prisma.role.count(),
    prisma.permission.count(),
    prisma.userRole.count(),
  ]);

  console.log('--- PRE-PURGE AUTH SNAPSHOT ---');
  console.log(`Users: ${usersCount} | Roles: ${rolesCount} | Permissions: ${permsCount} | UserRoles: ${userRolesCount}\n`);

  // 2. Disconnect users from optional FKs before table truncation
  console.log('Unlinking nullable references on users (employeeId)...');
  await prisma.$executeRawUnsafe(`UPDATE "users" SET "employeeId" = NULL;`);

  // 3. Query all tables in public schema
  const allTables = await prisma.$queryRaw`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
    ORDER BY table_name;
  `;

  const tablesToTruncate = allTables
    .map((t) => t.table_name)
    .filter((name) => !PRESERVED_TABLES.has(name));

  console.log(`\nFound ${tablesToTruncate.length} tables to truncate.`);

  // Truncate tables using CASCADE
  for (const table of tablesToTruncate) {
    try {
      await prisma.$executeRawUnsafe(`TRUNCATE TABLE "${table}" CASCADE;`);
      console.log(`  ✓ Truncated: ${table}`);
    } catch (err) {
      console.warn(`  ! Warning on ${table}: ${err.message}`);
    }
  }

  // 4. Reset document sequence counters if table exists
  try {
    await prisma.$executeRawUnsafe(`UPDATE "document_sequences" SET "currentNumber" = 0;`);
    console.log('\n  ✓ Document sequences reset to 0');
  } catch (err) {
    // If document_sequences was truncated, that is also fine
  }

  // 5. Audit all tables
  console.log('\n=============================================================');
  console.log('AUDIT POST-PURGE: VERIFYING TABLE COUNTS');
  console.log('=============================================================');

  let nonZeroDataTables = 0;
  for (const t of allTables) {
    const tblName = t.table_name;
    const isPreserved = PRESERVED_TABLES.has(tblName);
    try {
      const countRes = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int as cnt FROM "${tblName}"`);
      const cnt = countRes[0]?.cnt || 0;
      if (isPreserved) {
        console.log(`  [PRESERVED] ${tblName.padEnd(32)}: ${cnt} ✅`);
      } else if (cnt > 0) {
        console.log(`  [REMAINING] ${tblName.padEnd(32)}: ${cnt} ⚠️`);
        nonZeroDataTables++;
      }
    } catch (e) {
      console.log(`  [ERROR]     ${tblName.padEnd(32)}: ${e.message}`);
    }
  }

  console.log('\n=============================================================');
  if (nonZeroDataTables === 0) {
    console.log('SUCCESS: All operational & business data has been completely removed!');
    console.log('Only Users, Roles, Permissions, and core organization anchors remain.');
  } else {
    console.log(`COMPLETED with ${nonZeroDataTables} non-empty data tables.`);
  }
  console.log('=============================================================\n');
}

main()
  .catch((e) => {
    console.error('Purge error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
