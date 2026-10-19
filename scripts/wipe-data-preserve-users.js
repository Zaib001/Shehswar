const { PrismaClient } = require('@shehswar/database');
const prisma = new PrismaClient();

async function cleanOperationalData() {
  console.log('--- Cleaning operational data while preserving Users, Roles, Permissions, and Company structure ---');

  // List of operational tables to truncate/clean
  const tablesToClean = [
    // Ledgers & Transactions
    'stock_ledger_entries',
    'warehouse_stocks',
    'vendor_ledger_entries',
    'dealer_ledger_entries',
    'dealer_payment_receipts',
    'vendor_payments',
    'gate_pass_items',
    'gate_passes',
    'document_extractions',

    // Purchases & Returns
    'purchase_return_items',
    'purchase_returns',
    'purchase_invoice_items',
    'purchase_invoices',

    // Purchase Orders & Procurement
    'purchase_order_items',
    'purchase_orders',
    'goods_receipt_note_items',
    'goods_receipt_notes',
    'vendor_quotation_items',
    'vendor_quotations',
    'rfq_vendors',
    'request_for_quotations',
    'purchase_requisition_items',
    'purchase_requisitions',

    // Sales & Returns
    'sales_return_items',
    'sales_returns',
    'sales_invoice_items',
    'sales_invoices',
    'sales_order_items',
    'sales_orders',
    'sales_officer_dealer_assignments',

    // Materials, Products & BOMs
    'bom_materials',
    'bills_of_materials',
    'finished_product_packings',
    'finished_products',
    'raw_materials',
    'packing_materials',

    // Vendors & Dealers
    'vendor_performances',
    'vendor_documents',
    'vendors',
    'dealers',
  ];

  for (const table of tablesToClean) {
    try {
      await prisma.$executeRawUnsafe(`TRUNCATE TABLE "${table}" CASCADE;`);
      console.log(`✓ Cleaned table: ${table}`);
    } catch (err) {
      console.warn(`! Table ${table} could not be truncated (may not exist or different name): ${err.message}`);
    }
  }

  // Count preserved entities
  const [usersCount, rolesCount, permissionsCount, companiesCount] = await Promise.all([
    prisma.user.count(),
    prisma.role.count(),
    prisma.permission.count(),
    prisma.company.count(),
  ]);

  console.log('--- CLEANUP COMPLETE ---');
  console.log(`Preserved Users: ${usersCount}`);
  console.log(`Preserved Roles: ${rolesCount}`);
  console.log(`Preserved Permissions: ${permissionsCount}`);
  console.log(`Preserved Companies: ${companiesCount}`);
}

cleanOperationalData()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('Cleanup failed:', e);
    process.exit(1);
  });
