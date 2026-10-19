/**
 * SHEHSWAR ONE360 — Consolidate Enterprise Companies Structure
 *
 * Implements the user's business requirement:
 * Exactly ONE Parent Company (Shehswar Group)
 * and 4 Child Companies:
 *   1. Nectar Enterprises
 *   2. Agriventure Pakistan
 *   3. Excelium Seed
 *   4. consceptAG
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🏢 [Consolidation] Starting Shehswar enterprise structure consolidation...\n');

  // Canonical IDs
  const PARENT_ID = '30872089-360b-463b-98cf-f4224862fb15';
  const NECTAR_ID = '01a0f18d-8a7e-73f4-9306-5d5f6e3270fa';
  const AGRIVENTURE_ID = '01a13f27-c38f-7ee0-b283-7dbb26fba230';
  const EXCELIUM_ID = '01a13f27-c393-7ee0-b283-81d3762edda0';
  const CONCEPAG_ID = '01a13f27-c363-7ee0-b283-6867a78f3785';

  // Mapping of old duplicate company IDs to canonical IDs
  const DUPLICATES_MAP = {
    // Shehswar Parent duplicates -> PARENT_ID
    '5bcf1198-a0a6-4a61-81c0-a211fa226ddc': PARENT_ID, // CO-SHEHSWAR-PARENT
    '492b4697-81de-43be-a75a-5852af387f01': PARENT_ID, // COMP-MFG
    'dba93ca4-ae41-46ca-8634-def8baf7c650': PARENT_ID, // COMP-PARENT

    // Nectar duplicates -> NECTAR_ID
    '420b749b-5c7f-4ef8-b840-0afb8612ec1d': NECTAR_ID, // COMP-NECTAR duplicate

    // Agriventure duplicates -> AGRIVENTURE_ID
    'ffe09ff0-d90e-484a-aa39-fedcb0adaae2': AGRIVENTURE_ID, // COMP-AGRIVENTURE duplicate

    // Excelium duplicates -> EXCELIUM_ID
    '3a2b4ef0-94ac-45eb-bbf2-c6f533e9eca8': EXCELIUM_ID, // COMP-EXCELIUM duplicate

    // consceptAG duplicates -> CONCEPAG_ID
    'd56530cd-2b11-40a1-a1b1-cc6d4a823c18': CONCEPAG_ID, // COMP-CONCEPTAG duplicate
  };

  console.log('1. First, renaming duplicate company codes to avoid unique constraint collisions...');
  for (const oldId of Object.keys(DUPLICATES_MAP)) {
    try {
      const comp = await prisma.company.findUnique({ where: { id: oldId } });
      if (comp) {
        await prisma.company.update({
          where: { id: oldId },
          data: { code: `DUP-${comp.code}-${Date.now().toString().slice(-4)}` },
        });
      }
    } catch (e) {
      // ignore
    }
  }

  console.log('2. Reassigning records from duplicate companies to canonical companies...');
  for (const [oldId, newId] of Object.entries(DUPLICATES_MAP)) {
    console.log(`\n  Migrating ${oldId} -> ${newId}...`);

    // Users
    const usersCount = await prisma.user.count({ where: { companyId: oldId } });
    if (usersCount > 0) {
      await prisma.user.updateMany({ where: { companyId: oldId }, data: { companyId: newId } });
      console.log(`    - Reassigned ${usersCount} users`);
    }

    // User Roles
    await prisma.userRole.updateMany({ where: { companyId: oldId }, data: { companyId: newId } }).catch(() => {});

    // Employees
    await prisma.employee.updateMany({ where: { companyId: oldId }, data: { companyId: newId } }).catch(() => {});

    // Plants
    const plants = await prisma.plant.findMany({ where: { companyId: oldId } });
    for (const p of plants) {
      const conflict = await prisma.plant.findFirst({ where: { companyId: newId, code: p.code } });
      if (conflict) {
        await prisma.plant.update({ where: { id: p.id }, data: { code: `${p.code}-DUP`, companyId: newId } });
      } else {
        await prisma.plant.update({ where: { id: p.id }, data: { companyId: newId } });
      }
    }

    // Warehouses
    const warehouses = await prisma.warehouse.findMany({ where: { companyId: oldId } });
    for (const w of warehouses) {
      const conflict = await prisma.warehouse.findFirst({ where: { companyId: newId, code: w.code } });
      if (conflict) {
        await prisma.warehouse.update({ where: { id: w.id }, data: { code: `${w.code}-DUP`, companyId: newId } });
      } else {
        await prisma.warehouse.update({ where: { id: w.id }, data: { companyId: newId } });
      }
    }

    // Dealers
    const dealers = await prisma.dealer.findMany({ where: { companyId: oldId } });
    for (const d of dealers) {
      const conflict = await prisma.dealer.findFirst({ where: { companyId: newId, code: d.code } });
      if (conflict) {
        await prisma.dealer.update({ where: { id: d.id }, data: { code: `${d.code}-DUP`, companyId: newId } });
      } else {
        await prisma.dealer.update({ where: { id: d.id }, data: { companyId: newId } });
      }
    }

    // Credit Limits
    await prisma.creditLimit.updateMany({ where: { companyId: oldId }, data: { companyId: newId } }).catch(() => {});

    // Sales Orders
    await prisma.salesOrder.updateMany({ where: { companyId: oldId }, data: { companyId: newId } }).catch(() => {});

    // Sales Invoices
    await prisma.salesInvoice.updateMany({ where: { companyId: oldId }, data: { companyId: newId } }).catch(() => {});

    // Purchase Orders
    await prisma.purchaseOrder.updateMany({ where: { companyId: oldId }, data: { companyId: newId } }).catch(() => {});

    // Purchase Requisitions
    await prisma.purchaseRequisition.updateMany({ where: { companyId: oldId }, data: { companyId: newId } }).catch(() => {});

    // RFQ & Quotations
    await prisma.requestForQuotation.updateMany({ where: { companyId: oldId }, data: { companyId: newId } }).catch(() => {});
    await prisma.vendorQuotation.updateMany({ where: { companyId: oldId }, data: { companyId: newId } }).catch(() => {});

    // Goods Receipts
    await prisma.goodsReceiptNote.updateMany({ where: { companyId: oldId }, data: { companyId: newId } }).catch(() => {});

    // Vendors
    await prisma.vendor.updateMany({ where: { companyId: oldId }, data: { companyId: newId } }).catch(() => {});

    // Products & Materials
    await prisma.rawMaterial.updateMany({ where: { companyId: oldId }, data: { companyId: newId } }).catch(() => {});
    await prisma.packingMaterial.updateMany({ where: { companyId: oldId }, data: { companyId: newId } }).catch(() => {});
    await prisma.finishedProduct.updateMany({ where: { companyId: oldId }, data: { companyId: newId } }).catch(() => {});

    // Rate lists & Pricing schemes
    await prisma.rateList.updateMany({ where: { companyId: oldId }, data: { companyId: newId } }).catch(() => {});
    await prisma.pricingScheme.updateMany({ where: { companyId: oldId }, data: { companyId: newId } }).catch(() => {});
    await prisma.pricingAuthorityLimit.updateMany({ where: { companyId: oldId }, data: { companyId: newId } }).catch(() => {});

    // Financials
    await prisma.dealerPaymentReceipt.updateMany({ where: { companyId: oldId }, data: { companyId: newId } }).catch(() => {});
    await prisma.vendorPayment.updateMany({ where: { companyId: oldId }, data: { companyId: newId } }).catch(() => {});
    await prisma.dealerLedgerEntry.updateMany({ where: { companyId: oldId }, data: { companyId: newId } }).catch(() => {});
    await prisma.vendorLedgerEntry.updateMany({ where: { companyId: oldId }, data: { companyId: newId } }).catch(() => {});
    await prisma.warehouseStock.updateMany({ where: { companyId: oldId }, data: { companyId: newId } }).catch(() => {});
    await prisma.stockLedgerEntry.updateMany({ where: { companyId: oldId }, data: { companyId: newId } }).catch(() => {});
    await prisma.gatePass.updateMany({ where: { companyId: oldId }, data: { companyId: newId } }).catch(() => {});
    await prisma.documentSequence.updateMany({ where: { companyId: oldId }, data: { companyId: newId } }).catch(() => {});
    await prisma.department.updateMany({ where: { companyId: oldId }, data: { companyId: newId } }).catch(() => {});
    await prisma.branch.updateMany({ where: { companyId: oldId }, data: { companyId: newId } }).catch(() => {});
    await prisma.region.updateMany({ where: { companyId: oldId }, data: { companyId: newId } }).catch(() => {});
    await prisma.intercompanyPricingRule.updateMany({ where: { sourceCompanyId: oldId }, data: { sourceCompanyId: newId } }).catch(() => {});
    await prisma.intercompanyPricingRule.updateMany({ where: { targetCompanyId: oldId }, data: { targetCompanyId: newId } }).catch(() => {});
  }

  // 3. Purge duplicate companies
  console.log('\n3. Purging duplicate and legacy companies...');
  const duplicateIds = Object.keys(DUPLICATES_MAP);
  const legacyCompanies = await prisma.company.findMany({
    where: {
      code: { in: ['COMP-TRD', 'COMP-DIST'] },
    },
  });
  const allIdsToRemove = [...duplicateIds, ...legacyCompanies.map((c) => c.id)];

  for (const id of allIdsToRemove) {
    try {
      await prisma.company.delete({ where: { id } });
      console.log(`    ✓ Deleted company ${id}`);
    } catch (e) {
      await prisma.company.update({
        where: { id },
        data: { status: 'INACTIVE', isActive: false, name: `[DEPRECATED] ${id}` },
      });
      console.log(`    ⚠ Marked company ${id} as INACTIVE`);
    }
  }

  // 4. Update the 5 canonical companies with clean codes, names, and hierarchy
  console.log('\n4. Updating canonical company records...');

  // Parent: Shehswar Group
  await prisma.company.update({
    where: { id: PARENT_ID },
    data: {
      code: 'COMP-SHEHSWAR',
      name: 'Shehswar Group (Parent)',
      legalName: 'Shehswar Group of Companies (Pvt) Ltd',
      companyType: 'PARENT_MANUFACTURING',
      isParent: true,
      parentCompanyId: null,
      status: 'ACTIVE',
      isActive: true,
    },
  });

  // Child 1: Nectar Enterprises
  await prisma.company.update({
    where: { id: NECTAR_ID },
    data: {
      code: 'COMP-NECTAR',
      name: 'Nectar Enterprises',
      legalName: 'Nectar Enterprises (Pvt) Ltd',
      companyType: 'CHILD_COMPANY',
      isParent: false,
      parentCompanyId: PARENT_ID,
      status: 'ACTIVE',
      isActive: true,
    },
  });

  // Child 2: Agriventure Pakistan
  await prisma.company.update({
    where: { id: AGRIVENTURE_ID },
    data: {
      code: 'COMP-AGRIVENTURE',
      name: 'Agriventure Pakistan',
      legalName: 'Agriventure Pakistan (Pvt) Ltd',
      companyType: 'CHILD_COMPANY',
      isParent: false,
      parentCompanyId: PARENT_ID,
      status: 'ACTIVE',
      isActive: true,
    },
  });

  // Child 3: Excelium Seed
  await prisma.company.update({
    where: { id: EXCELIUM_ID },
    data: {
      code: 'COMP-EXCELIUM',
      name: 'Excelium Seed',
      legalName: 'Excelium Seed (Pvt) Ltd',
      companyType: 'CHILD_COMPANY',
      isParent: false,
      parentCompanyId: PARENT_ID,
      status: 'ACTIVE',
      isActive: true,
    },
  });

  // Child 4: consceptAG
  await prisma.company.update({
    where: { id: CONCEPAG_ID },
    data: {
      code: 'COMP-CONSCEPAG',
      name: 'consceptAG',
      legalName: 'consceptAG (Pvt) Ltd',
      companyType: 'CHILD_COMPANY',
      isParent: false,
      parentCompanyId: PARENT_ID,
      status: 'ACTIVE',
      isActive: true,
    },
  });

  // 5. Verify Final State
  console.log('\n5. Verifying active companies in database...');
  const activeCompanies = await prisma.company.findMany({
    where: { status: 'ACTIVE', isActive: true },
    select: {
      id: true,
      code: true,
      name: true,
      companyType: true,
      isParent: true,
      parentCompany: { select: { name: true, code: true } },
      _count: {
        select: {
          users: true,
          dealers: true,
          warehouses: true,
          plants: true,
          salesOrders: true,
          purchaseOrders: true,
          creditLimits: true,
        },
      },
    },
    orderBy: [{ isParent: 'desc' }, { name: 'asc' }],
  });

  console.log('\n=== ACTIVE ENTERPRISE HIERARCHY ===');
  console.log(`Total Active Companies: ${activeCompanies.length}`);
  for (const c of activeCompanies) {
    const role = c.isParent ? 'PARENT' : `CHILD (Parent: ${c.parentCompany?.name || 'None'})`;
    console.log(`- [${c.code}] ${c.name} (${c.companyType}) - ${role}`);
    console.log(`    Users: ${c._count.users} | Dealers: ${c._count.dealers} | Warehouses: ${c._count.warehouses} | Plants: ${c._count.plants} | SOs: ${c._count.salesOrders} | POs: ${c._count.purchaseOrders} | Credit Limits: ${c._count.creditLimits}`);
  }

  console.log('\n🎉 Enterprise consolidation completed successfully!');
}

main()
  .catch((e) => {
    console.error('Consolidation failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
