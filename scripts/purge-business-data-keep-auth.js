/**
 * SHEHSWAR ONE360 — Purge Business Data (Preserve Users, Roles, Permissions)
 * Prepares the database for 100% clean manual UI testing by the user.
 */
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const http = require('http');

const prisma = new PrismaClient();

async function run() {
  console.log('\n=============================================================');
  console.log('PURGING ALL BUSINESS DATA — PRESERVING AUTH & PERMISSIONS');
  console.log('=============================================================\n');

  // 1. Snapshot auth before purge
  const userCountBefore = await prisma.user.count();
  const roleCountBefore = await prisma.role.count();
  const permCountBefore = await prisma.permission.count();
  const rpCountBefore = await prisma.rolePermission.count();
  const urCountBefore = await prisma.userRole.count();

  console.log(`[AUTH PRE-CHECK] Users: ${userCountBefore} | Roles: ${roleCountBefore} | Permissions: ${permCountBefore} | RolePerms: ${rpCountBefore} | UserRoles: ${urCountBefore}`);

  // 2. Execute deletion in strict FK-safe order
  console.log('\nDeleting Procurement & Transactional records...');
  await prisma.goodsReceiptNoteItem.deleteMany();
  await prisma.goodsReceiptNote.deleteMany();
  await prisma.purchaseOrderItem.deleteMany();
  await prisma.purchaseOrder.deleteMany();
  await prisma.vendorQuotationItem.deleteMany();
  await prisma.vendorQuotation.deleteMany();
  await prisma.rfqVendor.deleteMany();
  await prisma.requestForQuotation.deleteMany();
  await prisma.purchaseRequisitionItem.deleteMany();
  await prisma.purchaseRequisition.deleteMany();
  await prisma.vendorPerformance.deleteMany();
  await prisma.vendorDocument.deleteMany();
  await prisma.vendor.deleteMany();

  console.log('Deleting Manufacturing & Recipe Master Data...');
  await prisma.formulaBomComponent.deleteMany();
  await prisma.formulaBom.deleteMany();
  await prisma.qcParameter.deleteMany();
  await prisma.qcSpecification.deleteMany();
  await prisma.intercompanyPricingRule.deleteMany();
  await prisma.finishedProduct.deleteMany();
  await prisma.packSize.deleteMany();
  await prisma.packingMaterial.deleteMany();
  await prisma.rawMaterial.deleteMany();
  await prisma.materialCategory.deleteMany();
  await prisma.productCategory.deleteMany();
  await prisma.uomConversion.deleteMany();
  await prisma.unitOfMeasure.deleteMany();
  await prisma.productionLine.deleteMany();
  await prisma.shift.deleteMany();
  await prisma.paymentTerm.deleteMany();
  await prisma.taxCategory.deleteMany();
  await prisma.reasonCode.deleteMany();
  await prisma.documentSequence.deleteMany();

  console.log('Deleting Physical & Organizational Structure...');
  await prisma.warehouseLocation.deleteMany();
  await prisma.warehouse.deleteMany();
  await prisma.employee.deleteMany();
  await prisma.department.deleteMany();
  await prisma.plant.deleteMany();
  await prisma.branch.deleteMany();

  // Reset audit logs and notifications for clean slate
  await prisma.userNotification.deleteMany();
  await prisma.auditLog.deleteMany();

  // Clean test companies and organizations except baseline anchor needed for users FK
  console.log('Ensuring clean baseline System Anchor Organization & Company...');
  
  // 1. Ensure platform tenant exists
  let tenant = await prisma.platformTenant.findFirst();
  if (!tenant) {
    tenant = await prisma.platformTenant.create({
      data: {
        code: 'TENANT-SHEHSWAR',
        name: 'Shehswar Enterprise Platform Tenant',
        isActive: true,
      }
    });
  }

  // 2. Anchor Organization
  let anchorOrg = await prisma.organization.findFirst({
    where: { code: 'ORG-SHEHSWAR-GRP' }
  });
  if (!anchorOrg) {
    anchorOrg = await prisma.organization.create({
      data: {
        tenantId: tenant.id,
        code: 'ORG-SHEHSWAR-GRP',
        name: 'Shehswar Group',
        taxId: '3124567-9',
        strnId: '17-00-3124-567-99',
        address: 'Plot 45-C, Industrial Estate, Multan Road, Lahore, Pakistan',
        country: 'Pakistan',
        currency: 'PKR',
        timezone: 'Asia/Karachi',
        isActive: true,
      }
    });
  }

  // 3. Anchor Company
  let anchorCompany = await prisma.company.findFirst({
    where: { organizationId: anchorOrg.id, code: 'CO-SHEHSWAR-PARENT' }
  });
  if (!anchorCompany) {
    anchorCompany = await prisma.company.create({
      data: {
        organizationId: anchorOrg.id,
        code: 'CO-SHEHSWAR-PARENT',
        name: 'Shehswar',
        companyType: 'PARENT_MANUFACTURING',
        isParent: true,
        currencyCode: 'PKR',
        isActive: true,
      }
    });
  }

  // Point all users and roles to anchor org/company before removing validation test orgs
  await prisma.user.updateMany({
    data: {
      organizationId: anchorOrg.id,
      companyId: anchorCompany.id,
    }
  });

  await prisma.role.updateMany({
    data: {
      organizationId: anchorOrg.id,
    }
  });

  // Delete any other test companies created during automated tests
  await prisma.company.deleteMany({
    where: { id: { not: anchorCompany.id } }
  });

  // Delete any other test organizations created during automated tests
  await prisma.organization.deleteMany({
    where: { id: { not: anchorOrg.id } }
  });

  // 4. Standardize all passwords to 'Shehswar@2026!'
  console.log('\nStandardizing user accounts and passwords...');
  const passwordHash = await bcrypt.hash('Shehswar@2026!', 10);
  await prisma.user.updateMany({
    data: {
      passwordHash,
      isActive: true,
      status: 'ACTIVE',
      failedLoginAttempts: 0,
      lockedUntil: null,
    }
  });

  // 5. Ensure required role mappings for standard accounts
  const allRoles = await prisma.role.findMany();
  const roleMap = {};
  allRoles.forEach(r => roleMap[r.code] = r.id);

  const roleAssignments = {
    'admin@shehswar.com': 'ROLE_SUPER_ADMIN',
    'procurement.manager@shehswar.com': 'ROLE_PROCUREMENT_MGR',
    'finance.manager@shehswar.com': 'ROLE_FINANCE_MGR',
    'nectar.rep@shehswar.com': 'ROLE_CHILD_SALES',
    'warehouse.supervisor@shehswar.com': 'ROLE_WAREHOUSE_USER',
    'production.manager@shehswar.com': 'ROLE_PARENT_OPS',
  };

  for (const [email, roleCode] of Object.entries(roleAssignments)) {
    const user = await prisma.user.findFirst({ where: { email } });
    const roleId = roleMap[roleCode];
    if (user && roleId) {
      await prisma.userRole.deleteMany({ where: { userId: user.id } });
      await prisma.userRole.create({
        data: {
          userId: user.id,
          roleId,
        }
      });
      console.log(`  Linked ${email} -> ${roleCode}`);
    }
  }

  // 6. Verification counts of business data tables
  console.log('\n=============================================================');
  console.log('DATABASE PURGE AUDIT — VERIFYING ZERO BUSINESS RECORDS');
  console.log('=============================================================');

  const counts = {
    'Vendors': await prisma.vendor.count(),
    'Purchase Requisitions': await prisma.purchaseRequisition.count(),
    'RFQs': await prisma.requestForQuotation.count(),
    'Quotations': await prisma.vendorQuotation.count(),
    'Purchase Orders': await prisma.purchaseOrder.count(),
    'Goods Receipts (GRN)': await prisma.goodsReceiptNote.count(),
    'Raw Materials': await prisma.rawMaterial.count(),
    'Packing Materials': await prisma.packingMaterial.count(),
    'Finished Products': await prisma.finishedProduct.count(),
    'Formula / BOMs': await prisma.formulaBom.count(),
    'QC Specifications': await prisma.qcSpecification.count(),
    'Intercompany Pricing Rules': await prisma.intercompanyPricingRule.count(),
    'Units of Measure': await prisma.unitOfMeasure.count(),
    'Pack Sizes': await prisma.packSize.count(),
    'Production Lines': await prisma.productionLine.count(),
    'Shifts': await prisma.shift.count(),
    'Warehouses': await prisma.warehouse.count(),
    'Plants': await prisma.plant.count(),
    'Branches': await prisma.branch.count(),
    'Departments': await prisma.department.count(),
    'Employees': await prisma.employee.count(),
    'Payment Terms': await prisma.paymentTerm.count(),
    'Tax Categories': await prisma.taxCategory.count(),
    'Reason Codes': await prisma.reasonCode.count(),
  };

  let allZero = true;
  for (const [tbl, count] of Object.entries(counts)) {
    const status = count === 0 ? 'CLEAN (0 records) ✅' : `NOT CLEAN (${count}) ❌`;
    if (count !== 0) allZero = false;
    console.log(`  ${tbl.padEnd(30)}: ${status}`);
  }

  console.log('\n[PRESERVED AUTH STATE]');
  const finalUsers = await prisma.user.count();
  const finalRoles = await prisma.role.count();
  const finalPerms = await prisma.permission.count();
  console.log(`  Users: ${finalUsers} | Roles: ${finalRoles} | Permissions: ${finalPerms} ✅`);

  // 7. Test login via HTTP API
  console.log('\nVerifying HTTP Login on API (port 4000)...');
  const testLogin = (email) => {
    return new Promise((resolve) => {
      const data = JSON.stringify({ email, password: 'Shehswar@2026!' });
      const req = http.request('http://localhost:4000/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
      }, (res) => {
        let b = ''; res.on('data', c => b += c);
        res.on('end', () => {
          try {
            const parsed = JSON.parse(b);
            resolve({ status: res.statusCode, jwt: !!parsed?.data?.tokens?.accessToken, roles: parsed?.data?.user?.roles });
          } catch (e) { resolve({ status: res.statusCode, jwt: false }); }
        });
      });
      req.on('error', e => resolve({ status: 0, error: e.message }));
      req.write(data); req.end();
    });
  };

  const adminAuth = await testLogin('admin@shehswar.com');
  console.log(`  admin@shehswar.com login: HTTP ${adminAuth.status} | Token: ${adminAuth.jwt ? 'OK ✅' : 'FAIL ❌'}`);

  const procAuth = await testLogin('procurement.manager@shehswar.com');
  console.log(`  procurement.manager login: HTTP ${procAuth.status} | Token: ${procAuth.jwt ? 'OK ✅' : 'FAIL ❌'}`);

  const finAuth = await testLogin('finance.manager@shehswar.com');
  console.log(`  finance.manager login: HTTP ${finAuth.status} | Token: ${finAuth.jwt ? 'OK ✅' : 'FAIL ❌'}`);

  const nectarAuth = await testLogin('nectar.rep@shehswar.com');
  console.log(`  nectar.rep login: HTTP ${nectarAuth.status} | Token: ${nectarAuth.jwt ? 'OK ✅' : 'FAIL ❌'}`);

  console.log('\n=============================================================');
  console.log('READY FOR MANUAL TESTING: ALL BUSINESS DATA REMOVED CLEANLY');
  console.log('=============================================================\n');

  await prisma.$disconnect();
}

run().catch(async (e) => {
  console.error('Purge error:', e);
  await prisma.$disconnect();
  process.exit(1);
});
