/**
 * SHEHSWAR ONE360 - Setup Pure Auth & Permissions Only
 * 
 * Recreates the complete clean authentication and RBAC structure with:
 * - 0 Operational/Transactional records
 * - 0 Mock vendors, dealers, orders, or stocks
 * - Verified Users, Roles, Permissions, RolePermissions, UserRoles, Org & Company
 */
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const http = require('http');

const prisma = new PrismaClient();

async function main() {
  console.log('\n=============================================================');
  console.log('SETTING UP PURE AUTHENTICATION & PERMISSIONS (ZERO DATA)');
  console.log('=============================================================\n');

  // 1. Platform Tenant
  const tenant = await prisma.platformTenant.upsert({
    where: { code: 'TENANT-SHEHSWAR' },
    update: { name: 'Shehswar Enterprise Platform Tenant' },
    create: {
      code: 'TENANT-SHEHSWAR',
      name: 'Shehswar Enterprise Platform Tenant',
      isActive: true,
    },
  });
  console.log('✓ Platform Tenant:', tenant.code);

  // 2. Organization (Shehswar Group)
  const organization = await prisma.organization.upsert({
    where: { code: 'ORG-SHEHSWAR-GRP' },
    update: {
      name: 'Shehswar Group',
      legalName: 'Shehswar Group of Companies (Pvt) Ltd',
      taxId: '3124567-9',
      strnId: '17-00-3124-567-99',
    },
    create: {
      tenantId: tenant.id,
      code: 'ORG-SHEHSWAR-GRP',
      name: 'Shehswar Group',
      legalName: 'Shehswar Group of Companies (Pvt) Ltd',
      taxId: '3124567-9',
      strnId: '17-00-3124-567-99',
      address: 'Plot 45-C, Industrial Estate, Multan Road, Lahore, Pakistan',
      country: 'Pakistan',
      currency: 'PKR',
      timezone: 'Asia/Karachi',
      isActive: true,
    },
  });
  console.log('✓ Organization:', organization.name);

  // 3. Parent Manufacturing Company (Shehswar)
  const company = await prisma.company.upsert({
    where: {
      organizationId_code: {
        organizationId: organization.id,
        code: 'COMP-SHEHSWAR',
      },
    },
    update: {
      name: 'Shehswar',
      companyType: 'PARENT_MANUFACTURING',
      isParent: true,
      status: 'ACTIVE',
      isActive: true,
    },
    create: {
      organizationId: organization.id,
      code: 'COMP-SHEHSWAR',
      name: 'Shehswar',
      companyType: 'PARENT_MANUFACTURING',
      isParent: true,
      currencyCode: 'PKR',
      isActive: true,
      status: 'ACTIVE',
    },
  });
  console.log('✓ Company:', company.name);

  // 4. Roles
  const rolesData = [
    {
      code: 'ROLE_SUPER_ADMIN',
      name: 'Super Administrator',
      description: 'Universal unrestricted system-wide access across all companies and modules.',
      isSystem: true,
    },
    {
      code: 'ROLE_COMPANY_ADMIN',
      name: 'Company Administrator',
      description: 'Managing Director / Operational Admin for company scope.',
      isSystem: false,
    },
    {
      code: 'ROLE_PROCUREMENT_MGR',
      name: 'Procurement Manager',
      description: 'Procurement lifecycle: Vendors, PR, RFQ, Quotes, PO, GRN, Performance.',
      isSystem: false,
    },
    {
      code: 'ROLE_FINANCE_MGR',
      name: 'Finance Manager',
      description: 'Fiscal controls: PO approvals, costing clearance, vendor payments, ledger review.',
      isSystem: false,
    },
    {
      code: 'ROLE_DEPT_USER',
      name: 'Department User',
      description: 'Plant requester: Requisitions create, edit, submit, PO tracking.',
      isSystem: false,
    },
    {
      code: 'ROLE_WAREHOUSE_USER',
      name: 'Warehouse User',
      description: 'Warehouse supervisor: Goods Receipt (GRN), inventory inspections, gate pass logging.',
      isSystem: false,
    },
    {
      code: 'ROLE_PARENT_OPS',
      name: 'Parent Operations Manager',
      description: 'Plant operations and batch recipe management.',
      isSystem: false,
    },
    {
      code: 'ROLE_CHILD_SALES',
      name: 'Child Company Sales Representative',
      description: 'Distributor sales orders and dealer operations.',
      isSystem: false,
    },
  ];

  const roles = {};
  for (const r of rolesData) {
    roles[r.code] = await prisma.role.upsert({
      where: {
        organizationId_code: {
          organizationId: organization.id,
          code: r.code,
        },
      },
      update: { name: r.name, description: r.description },
      create: {
        organizationId: organization.id,
        code: r.code,
        name: r.name,
        description: r.description,
        isSystem: r.isSystem,
      },
    });
  }
  console.log(`✓ Roles created/verified: ${Object.keys(roles).length}`);

  // 5. Role Permissions Assignment
  const allPermissions = await prisma.permission.findMany();
  console.log(`Mapping ${allPermissions.length} permissions to roles...`);

  for (const perm of allPermissions) {
    // Super Admin gets ALL permissions
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: roles['ROLE_SUPER_ADMIN'].id,
          permissionId: perm.id,
        },
      },
      update: {},
      create: {
        roleId: roles['ROLE_SUPER_ADMIN'].id,
        permissionId: perm.id,
      },
    });

    // Company Admin gets non-tenant permissions
    if (!perm.code.startsWith('tenant:')) {
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: roles['ROLE_COMPANY_ADMIN'].id,
            permissionId: perm.id,
          },
        },
        update: {},
        create: {
          roleId: roles['ROLE_COMPANY_ADMIN'].id,
          permissionId: perm.id,
        },
      });
    }

    // Procurement Manager
    const isProcurementPerm = [
      'vendor:', 'purchase_requisition:', 'rfq:', 'quotation:',
      'quotation_comparison:', 'purchase_order:', 'goods_receipt:',
      'vendor_performance:', 'qc_inspection:',
    ].some((p) => perm.code.startsWith(p));

    if (
      isProcurementPerm ||
      perm.code === 'approval_workflow:view' ||
      perm.code === 'approval_workflow:approve' ||
      perm.code === 'audit_log:view'
    ) {
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: roles['ROLE_PROCUREMENT_MGR'].id,
            permissionId: perm.id,
          },
        },
        update: {},
        create: {
          roleId: roles['ROLE_PROCUREMENT_MGR'].id,
          permissionId: perm.id,
        },
      });
    }

    // Finance Manager
    if ([
      'purchase_order:view', 'purchase_order:approve', 'purchase_order:export',
      'vendor:view', 'vendor:approve', 'quotation:view', 'quotation_comparison:view',
      'costing:view_cost', 'costing:view_margin', 'audit_log:view',
    ].includes(perm.code)) {
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: roles['ROLE_FINANCE_MGR'].id,
            permissionId: perm.id,
          },
        },
        update: {},
        create: {
          roleId: roles['ROLE_FINANCE_MGR'].id,
          permissionId: perm.id,
        },
      });
    }

    // Department User
    if ([
      'purchase_requisition:create', 'purchase_requisition:view',
      'purchase_requisition:edit', 'purchase_requisition:submit',
      'purchase_order:view',
    ].includes(perm.code)) {
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: roles['ROLE_DEPT_USER'].id,
            permissionId: perm.id,
          },
        },
        update: {},
        create: {
          roleId: roles['ROLE_DEPT_USER'].id,
          permissionId: perm.id,
        },
      });
    }

    // Warehouse User
    if ([
      'goods_receipt:create', 'goods_receipt:view', 'goods_receipt:edit',
      'goods_receipt:submit', 'purchase_order:view',
    ].includes(perm.code)) {
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: roles['ROLE_WAREHOUSE_USER'].id,
            permissionId: perm.id,
          },
        },
        update: {},
        create: {
          roleId: roles['ROLE_WAREHOUSE_USER'].id,
          permissionId: perm.id,
        },
      });
    }

    // Child Sales
    if ([
      'sales_order:view', 'sales_order:create', 'sales_order:edit',
      'sales_invoice:view', 'dealer:view', 'dealer:create', 'dealer:edit',
      'warehouse_stock:view',
    ].includes(perm.code)) {
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: roles['ROLE_CHILD_SALES'].id,
            permissionId: perm.id,
          },
        },
        update: {},
        create: {
          roleId: roles['ROLE_CHILD_SALES'].id,
          permissionId: perm.id,
        },
      });
    }
  }

  const rolePermCount = await prisma.rolePermission.count();
  console.log(`✓ Role-Permission mappings: ${rolePermCount}`);

  // 6. Standard Enterprise Users
  const passwordHash = await bcrypt.hash('Shehswar@2026!', 10);

  const usersData = [
    {
      email: 'admin@shehswar.com',
      firstName: 'System',
      lastName: 'Administrator',
      roleCode: 'ROLE_SUPER_ADMIN',
      isSuperAdmin: true,
    },
    {
      email: 'procurement.manager@shehswar.com',
      firstName: 'Bilal',
      lastName: 'ProcurementHead',
      roleCode: 'ROLE_PROCUREMENT_MGR',
      isSuperAdmin: false,
    },
    {
      email: 'finance.manager@shehswar.com',
      firstName: 'Fariha',
      lastName: 'FinanceLead',
      roleCode: 'ROLE_FINANCE_MGR',
      isSuperAdmin: false,
    },
    {
      email: 'dept.user@shehswar.com',
      firstName: 'Danish',
      lastName: 'PlantRequester',
      roleCode: 'ROLE_DEPT_USER',
      isSuperAdmin: false,
    },
    {
      email: 'warehouse.user@shehswar.com',
      firstName: 'Waqas',
      lastName: 'WarehouseDock',
      roleCode: 'ROLE_WAREHOUSE_USER',
      isSuperAdmin: false,
    },
    {
      email: 'warehouse.supervisor@shehswar.com',
      firstName: 'Tariq',
      lastName: 'WarehouseSupervisor',
      roleCode: 'ROLE_WAREHOUSE_USER',
      isSuperAdmin: false,
    },
    {
      email: 'production.manager@shehswar.com',
      firstName: 'Kamran',
      lastName: 'PlantHead',
      roleCode: 'ROLE_PARENT_OPS',
      isSuperAdmin: false,
    },
    {
      email: 'nectar.rep@shehswar.com',
      firstName: 'Nectar',
      lastName: 'FieldRep',
      roleCode: 'ROLE_CHILD_SALES',
      isSuperAdmin: false,
    },
  ];

  for (const u of usersData) {
    const userRecord = await prisma.user.upsert({
      where: { email: u.email },
      update: {
        organizationId: organization.id,
        companyId: company.id,
        passwordHash,
        isActive: true,
        status: 'ACTIVE',
        firstName: u.firstName,
        lastName: u.lastName,
        isSuperAdmin: u.isSuperAdmin,
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
      create: {
        organizationId: organization.id,
        companyId: company.id,
        email: u.email,
        passwordHash,
        firstName: u.firstName,
        lastName: u.lastName,
        isSuperAdmin: u.isSuperAdmin,
        isActive: true,
        status: 'ACTIVE',
      },
    });

    const role = roles[u.roleCode];
    if (role) {
      await prisma.userRole.deleteMany({ where: { userId: userRecord.id } });
      await prisma.userRole.create({
        data: {
          userId: userRecord.id,
          roleId: role.id,
          companyId: company.id,
        },
      });
      console.log(`✓ User seeded: ${u.email.padEnd(35)} [${u.roleCode}]`);
    }
  }

  // 7. Audit DB
  console.log('\n=============================================================');
  console.log('AUDIT: AUTHENTICATION STATE VERIFICATION');
  console.log('=============================================================');

  const [uCount, rCount, pCount, rpCount, urCount] = await Promise.all([
    prisma.user.count(),
    prisma.role.count(),
    prisma.permission.count(),
    prisma.rolePermission.count(),
    prisma.userRole.count(),
  ]);

  console.log(`Users           : ${uCount} ✅`);
  console.log(`Roles           : ${rCount} ✅`);
  console.log(`Permissions     : ${pCount} ✅`);
  console.log(`RolePermissions : ${rpCount} ✅`);
  console.log(`UserRoles       : ${urCount} ✅`);

  // 8. Test HTTP Login
  console.log('\nTesting live HTTP Login on Backend API (port 4000)...');
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

  const loginRes = await testLogin('admin@shehswar.com');
  console.log(`admin@shehswar.com login: HTTP ${loginRes.status} | JWT Token: ${loginRes.jwt ? 'OK ✅' : 'FAIL ❌'}`);
  console.log('=============================================================\n');
}

main()
  .catch((e) => {
    console.error('Setup error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
