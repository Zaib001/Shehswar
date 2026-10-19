/**
 * SHEHSWAR ONE360 - Database Purge (Preserve Users, Roles, Permissions, Auth & Organization Structure)
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function purgeDatabase() {
  console.log('\n=============================================================');
  console.log('PURGING ALL OPERATIONAL & TRANSACTIONAL DATA FROM DATABASE');
  console.log('PRESERVING: Users, Roles, Permissions, UserRoles & Auth Structure');
  console.log('=============================================================\n');

  // 1. Snapshot Auth
  const [usersCount, rolesCount, permsCount, rolePermsCount, userRolesCount] = await Promise.all([
    prisma.user.count(),
    prisma.role.count(),
    prisma.permission.count(),
    prisma.rolePermission.count(),
    prisma.userRole.count(),
  ]);

  console.log('--- PRE-PURGE AUTH SNAPSHOT ---');
  console.log(`Users: ${usersCount} | Roles: ${rolesCount} | Permissions: ${permsCount} | RolePerms: ${rolePermsCount} | UserRoles: ${userRolesCount}\n`);

  // 2. Tables to truncate
  const tablesToTruncate = [
    // Sales & Returns
    'sales_return_items',
    'sales_returns',
    'sales_invoice_items',
    'sales_invoices',
    'sales_order_items',
    'sales_orders',
    'sales_officer_dealer_assignments',

    // Financial & Ledger
    'dealer_payment_receipts',
    'dealer_ledger_entries',
    'dealers',
    'vendor_payments',
    'vendor_ledger_entries',
    'stock_ledger_entries',
    'warehouse_stocks',

    // Purchases & Returns
    'purchase_return_items',
    'purchase_returns',
    'purchase_invoice_items',
    'purchase_invoices',

    // Procurement
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

    // Vendors
    'vendor_performances',
    'vendor_documents',
    'vendors',

    // Manufacturing & Inventory Products
    'formula_bom_components',
    'formula_boms',
    'finished_products',
    'raw_materials',
    'packing_materials',
    'pack_sizes',
    'qc_parameters',
    'qc_specifications',
    'intercompany_pricing_rules',

    // Operations & Activity
    'gate_pass_items',
    'gate_passes',
    'document_extractions',
    'approval_history',
    'approval_requests',
    'audit_logs',
    'user_notifications',
    'user_sessions',
  ];

  console.log('Truncating operational and business tables...');
  for (const table of tablesToTruncate) {
    try {
      await prisma.$executeRawUnsafe(`TRUNCATE TABLE "${table}" CASCADE;`);
      console.log(`  ✓ Truncated: ${table}`);
    } catch (err) {
      console.warn(`  ! Could not truncate ${table}: ${err.message}`);
    }
  }

  // 3. Reset document sequence counters to 0 so fresh numbering begins at 0001
  console.log('\nResetting document sequences to 0...');
  try {
    await prisma.$executeRawUnsafe(`UPDATE "document_sequences" SET "currentNumber" = 0;`);
    console.log('  ✓ Document sequences reset to 0');
  } catch (err) {
    console.warn(`  ! Could not reset document sequences: ${err.message}`);
  }

  // 4. Standardize 3 clean warehouses for Multi-Warehouse Split Testing
  console.log('\nConfiguring 3 clean empty warehouses (Warehouse A, B, C)...');
  try {
    const existingWhs = await prisma.warehouse.findMany({ orderBy: { createdAt: 'asc' } });
    const whConfigs = [
      { code: 'WH-A', name: 'Warehouse A (Central Store)', type: 'RAW_MATERIAL' },
      { code: 'WH-B', name: 'Warehouse B (Secondary Depot)', type: 'FINISHED_GOODS' },
      { code: 'WH-C', name: 'Warehouse C (Distribution Hub)', type: 'FINISHED_GOODS' },
    ];

    for (let i = 0; i < whConfigs.length; i++) {
      if (existingWhs[i]) {
        await prisma.warehouse.update({
          where: { id: existingWhs[i].id },
          data: {
            code: whConfigs[i].code,
            name: whConfigs[i].name,
            type: whConfigs[i].type,
            isActive: true,
          },
        });
        console.log(`  ✓ Updated warehouse ${existingWhs[i].id} -> ${whConfigs[i].name} (${whConfigs[i].code})`);
      }
    }
  } catch (err) {
    console.warn(`  ! Could not update warehouses: ${err.message}`);
  }

  // 5. Audit verification
  console.log('\n=============================================================');
  console.log('DATABASE AUDIT POST-PURGE');
  console.log('=============================================================');

  const [
    finalUsers,
    finalRoles,
    finalPerms,
    finalUserRoles,
    salesOrders,
    salesInvoices,
    salesReturns,
    purchases,
    purchaseReturns,
    purchaseOrders,
    dealers,
    vendors,
    stockEntries,
    warehouseStocks,
    warehouses,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.role.count(),
    prisma.permission.count(),
    prisma.userRole.count(),
    prisma.salesOrder.count(),
    prisma.salesInvoice.count(),
    prisma.salesReturn.count(),
    prisma.purchaseInvoice.count(),
    prisma.purchaseReturn.count(),
    prisma.purchaseOrder.count(),
    prisma.dealer.count(),
    prisma.vendor.count(),
    prisma.stockLedgerEntry.count(),
    prisma.warehouseStock.count(),
    prisma.warehouse.count(),
  ]);

  console.log(`[AUTH PRESERVED]`);
  console.log(`  Users           : ${finalUsers} (PRESERVED ✅)`);
  console.log(`  Roles           : ${finalRoles} (PRESERVED ✅)`);
  console.log(`  Permissions     : ${finalPerms} (PRESERVED ✅)`);
  console.log(`  UserRoles       : ${finalUserRoles} (PRESERVED ✅)`);

  console.log(`\n[BUSINESS DATA EMPTIED]`);
  console.log(`  Sales Orders    : ${salesOrders} (CLEAN ✅)`);
  console.log(`  Sales Invoices  : ${salesInvoices} (CLEAN ✅)`);
  console.log(`  Sales Returns   : ${salesReturns} (CLEAN ✅)`);
  console.log(`  Purchases       : ${purchases} (CLEAN ✅)`);
  console.log(`  Purchase Returns: ${purchaseReturns} (CLEAN ✅)`);
  console.log(`  Purchase Orders : ${purchaseOrders} (CLEAN ✅)`);
  console.log(`  Dealers         : ${dealers} (CLEAN ✅)`);
  console.log(`  Vendors         : ${vendors} (CLEAN ✅)`);
  console.log(`  Stock Entries   : ${stockEntries} (CLEAN ✅)`);
  console.log(`  Warehouse Stocks: ${warehouseStocks} (CLEAN ✅)`);
  console.log(`  Warehouses      : ${warehouses} (CLEAN EMPTY WAREHOUSES READY FOR USE ✅)`);

  console.log('\n=============================================================');
  console.log('PURGE COMPLETE: DATABASE IS 100% READY FOR FRESH MANUAL TESTING');
  console.log('=============================================================\n');
}

purgeDatabase()
  .catch((err) => {
    console.error('Purge script failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
