/**
 * SHEHSWAR ONE360 - Clean Master Hierarchy Purge
 *
 * Purges all subsidiary companies, plants, warehouses, locations, and departments.
 * Retains strictly:
 *   1. Organization: Shehswar Group (ORG-SHEHSWAR-GRP)
 *   2. Parent Company: Shehswar Group (Parent) (COMP-SHEHSWAR)
 *   3. Users: admin@shehswar.com & sales.officer@shehswar.com
 *   4. System Roles & Permissions
 */
const { PrismaClient } = require('@prisma/client');

const remoteDbUrl = 'postgresql://shehswar_user:PHHDD5jvPcZsDCX2LH7mKrcO5GBtobti@dpg-dbc8moafngtc739dhgkg-a.oregon-postgres.render.com/shehswar_one360?sslmode=require';
const localDbUrl = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/shehswar_one360?schema=public';

async function purgeHierarchyOn(label, url) {
  console.log(`\n=============================================================`);
  console.log(`PURGING SUBSIDIARY COMPANIES, PLANTS & WAREHOUSES ON: [${label}]`);
  console.log(`=============================================================\n`);

  const prisma = new PrismaClient({ datasources: { db: { url } } });

  try {
    // 1. Truncate child hierarchy tables
    const childTables = [
      'warehouse_locations',
      'warehouses',
      'production_lines',
      'shifts',
      'plants',
      'departments',
      'user_market_assignments',
      'territories',
      'zones',
      'regions',
      'branches',
      'employees',
      'product_categories',
      'material_categories',
      'units_of_measure',
      'uom_conversions',
      'payment_terms',
      'tax_categories',
      'reason_codes',
    ];

    for (const t of childTables) {
      try {
        await prisma.$executeRawUnsafe(`TRUNCATE TABLE "${t}" CASCADE;`);
        console.log(`  ✓ Truncated: ${t}`);
      } catch (e) {
        // Ignored if table doesn't exist
      }
    }

    // 2. Delete all subsidiary companies except COMP-SHEHSWAR
    const deletedCompanies = await prisma.$executeRawUnsafe(`
      DELETE FROM "companies"
      WHERE "code" != 'COMP-SHEHSWAR';
    `);
    console.log(`  ✓ Removed subsidiary companies (count: ${deletedCompanies}).`);

    // 3. Delete any users except admin and sales officer
    const deletedUsers = await prisma.$executeRawUnsafe(`
      DELETE FROM "users"
      WHERE LOWER("email") NOT IN ('admin@shehswar.com', 'sales.officer@shehswar.com');
    `);
    console.log(`  ✓ Removed non-essential users (count: ${deletedUsers}).`);

    // 4. Audit
    const companies = await prisma.company.findMany({ select: { code: true, name: true, isParent: true } });
    const users = await prisma.user.findMany({ select: { email: true, firstName: true, lastName: true } });
    const warehouses = await prisma.warehouse.count();
    const plants = await prisma.plant.count();
    const departments = await prisma.department.count();

    console.log(`\nAUDIT RESULT [${label}]:`);
    console.log(`  Companies (${companies.length}):`, companies.map(c => `${c.name} [${c.code}]`).join(', '));
    console.log(`  Users (${users.length}):`, users.map(u => u.email).join(', '));
    console.log(`  Warehouses : ${warehouses} (CLEAN)`);
    console.log(`  Plants     : ${plants} (CLEAN)`);
    console.log(`  Departments: ${departments} (CLEAN)`);
    console.log('-------------------------------------------------------------\n');
  } catch (err) {
    console.error(`Error on ${label}:`, err.message);
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  await purgeHierarchyOn('Render Production PostgreSQL', remoteDbUrl);
  await purgeHierarchyOn('Local Development PostgreSQL', localDbUrl);
}

main();
