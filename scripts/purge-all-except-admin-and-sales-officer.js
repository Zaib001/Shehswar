/**
 * SHEHSWAR ONE360 - Complete Data Purge (Remote & Local)
 *
 * Removes ALL operational, transactional, and dummy data.
 * Keeps strictly:
 *   1. Super Administrator (admin@shehswar.com)
 *   2. Sales Officer (sales.officer@shehswar.com)
 *   3. Foundational Organization, Company, System Roles, and Permissions.
 */
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const remoteDbUrl = 'postgresql://shehswar_user:PHHDD5jvPcZsDCX2LH7mKrcO5GBtobti@dpg-dbc8moafngtc739dhgkg-a.oregon-postgres.render.com/shehswar_one360?sslmode=require';

async function purgeTarget(label, url) {
  console.log('\n=============================================================');
  console.log(`PURGING ALL DATA EXCEPT ADMIN & SALES OFFICER ON: [${label}]`);
  console.log('=============================================================\n');

  const prisma = new PrismaClient({ datasources: { db: { url } } });

  try {
    // 1. Truncate operational and transactional tables
    const tables = [
      'sales_return_items',
      'sales_returns',
      'sales_invoice_items',
      'sales_invoices',
      'sales_order_items',
      'sales_orders',
      'sales_officer_dealer_assignments',
      'dealer_payment_receipts',
      'dealer_ledger_entries',
      'dealers',
      'vendor_payments',
      'vendor_ledger_entries',
      'stock_ledger_entries',
      'warehouse_stocks',
      'purchase_return_items',
      'purchase_returns',
      'purchase_invoice_items',
      'purchase_invoices',
      'goods_receipt_note_items',
      'goods_receipt_notes',
      'purchase_order_items',
      'purchase_orders',
      'vendor_quotation_items',
      'vendor_quotations',
      'rfq_vendors',
      'request_for_quotations',
      'purchase_requisition_items',
      'purchase_requisitions',
      'vendor_performances',
      'vendor_documents',
      'vendors',
      'formula_bom_components',
      'formula_boms',
      'finished_products',
      'raw_materials',
      'packing_materials',
      'pack_sizes',
      'qc_parameters',
      'qc_specifications',
      'intercompany_pricing_rules',
      'gate_pass_items',
      'gate_passes',
      'document_extractions',
      'approval_history',
      'approval_requests',
      'audit_logs',
      'user_notifications',
      'user_sessions',
      'password_reset_tokens',
      'user_market_assignments',
      'employees',
    ];

    for (const t of tables) {
      try {
        await prisma.$executeRawUnsafe(`TRUNCATE TABLE "${t}" CASCADE;`);
      } catch (e) {
        // Ignored if table doesn't exist
      }
    }
    console.log('  ✓ Truncated all operational and business data tables.');

    // 2. Remove all non-essential users
    await prisma.$executeRawUnsafe(`
      DELETE FROM "users" 
      WHERE LOWER("email") NOT IN ('admin@shehswar.com', 'sales.officer@shehswar.com');
    `);
    console.log('  ✓ Removed all users except admin@shehswar.com and sales.officer@shehswar.com.');

    // 3. Reset document sequences
    try {
      await prisma.$executeRawUnsafe(`UPDATE "document_sequences" SET "currentNumber" = 0;`);
      console.log('  ✓ Document sequences reset to 0.');
    } catch {}

    // 4. Upsert Admin and Sales Officer to guarantee credentials and roles
    let org = await prisma.organization.findFirst({ where: { code: 'ORG-SHEHSWAR-GRP' } });
    let comp = await prisma.company.findFirst({ where: { code: 'COMP-SHEHSWAR' } });

    if (!org) {
      org = await prisma.organization.create({
        data: {
          code: 'ORG-SHEHSWAR-GRP',
          name: 'Shehswar Group',
          taxId: 'STRN-0987654321',
          currency: 'PKR',
          country: 'Pakistan',
          isActive: true,
        },
      });
    }

    if (!comp) {
      comp = await prisma.company.create({
        data: {
          organizationId: org.id,
          code: 'COMP-SHEHSWAR',
          name: 'Shehswar Group (Parent)',
          taxId: 'STRN-1122334455',
          currency: 'PKR',
          country: 'Pakistan',
          isParent: true,
          isActive: true,
        },
      });
    }

    let superAdminRole = await prisma.role.findFirst({
      where: { organizationId: org.id, code: 'ROLE_SUPER_ADMIN' },
    });
    if (!superAdminRole) {
      superAdminRole = await prisma.role.create({
        data: {
          organizationId: org.id,
          code: 'ROLE_SUPER_ADMIN',
          name: 'Super Administrator',
          isSystem: true,
        },
      });
    }

    let salesOfficerRole = await prisma.role.findFirst({
      where: { organizationId: org.id, code: 'ROLE_SALES_OFFICER' },
    });
    if (!salesOfficerRole) {
      salesOfficerRole = await prisma.role.create({
        data: {
          organizationId: org.id,
          code: 'ROLE_SALES_OFFICER',
          name: 'Sales Officer',
          isSystem: false,
        },
      });
    }

    const passwordHash = await bcrypt.hash('Shehswar@2026!', 10);

    // Upsert Admin
    const admin = await prisma.user.upsert({
      where: { email: 'admin@shehswar.com' },
      update: {
        passwordHash,
        firstName: 'System',
        lastName: 'Administrator',
        isSuperAdmin: true,
        isActive: true,
        status: 'ACTIVE',
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
      create: {
        organizationId: org.id,
        companyId: comp.id,
        email: 'admin@shehswar.com',
        passwordHash,
        firstName: 'System',
        lastName: 'Administrator',
        isSuperAdmin: true,
        isActive: true,
        status: 'ACTIVE',
        failedLoginAttempts: 0,
      },
    });

    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: admin.id, roleId: superAdminRole.id } },
      update: { companyId: comp.id },
      create: { userId: admin.id, roleId: superAdminRole.id, companyId: comp.id },
    });

    // Upsert Sales Officer
    const so = await prisma.user.upsert({
      where: { email: 'sales.officer@shehswar.com' },
      update: {
        passwordHash,
        firstName: 'Sales',
        lastName: 'Officer',
        isSuperAdmin: false,
        isActive: true,
        status: 'ACTIVE',
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
      create: {
        organizationId: org.id,
        companyId: comp.id,
        email: 'sales.officer@shehswar.com',
        passwordHash,
        firstName: 'Sales',
        lastName: 'Officer',
        isSuperAdmin: false,
        isActive: true,
        status: 'ACTIVE',
        failedLoginAttempts: 0,
      },
    });

    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: so.id, roleId: salesOfficerRole.id } },
      update: { companyId: comp.id },
      create: { userId: so.id, roleId: salesOfficerRole.id, companyId: comp.id },
    });

    console.log('  ✓ Admin and Sales Officer accounts verified and active.');

    // 5. Audit
    const finalUsers = await prisma.user.findMany({
      select: { email: true, firstName: true, lastName: true, status: true, isActive: true },
    });
    const [ordersCount, dealersCount, productsCount] = await Promise.all([
      prisma.salesOrder.count(),
      prisma.dealer.count(),
      prisma.finishedProduct.count(),
    ]);

    console.log(`\nAudit [${label}]:`);
    console.log(`  Users remaining (${finalUsers.length}):`, finalUsers.map(u => `${u.email} (${u.status})`).join(', '));
    console.log(`  Orders: ${ordersCount} | Dealers: ${dealersCount} | Products: ${productsCount} (All 0 = Pure Clean ✅)`);
  } catch (err) {
    console.error(`Error purging ${label}:`, err.message);
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  // Purge Remote Render DB
  await purgeTarget('Render Production PostgreSQL', remoteDbUrl);

  // Purge Local DB if available
  const localUrl = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/shehswar_one360?schema=public';
  await purgeTarget('Local Development PostgreSQL', localUrl);

  console.log('\n=============================================================');
  console.log('PURGE OPERATION FINISHED: ALL DATA REMOVED EXCEPT ADMIN & SALES OFFICER');
  console.log('=============================================================\n');
}

main();
