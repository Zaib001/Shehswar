/**
 * SHEHSWAR ONE360 - Database Seed Script
 *
 * Seeds platform tenant, organization, parent & child companies,
 * foundational plants/warehouses, baseline permissions, system roles,
 * and the initial Super Admin account.
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { Action, Resource } from '@shehswar/types';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting SHEHSWAR ONE360 database seed...');

  // 1. Platform Tenant
  const tenant = await prisma.platformTenant.upsert({
    where: { code: 'TENANT-SHEHSWAR' },
    update: {},
    create: {
      code: 'TENANT-SHEHSWAR',
      name: 'Shehswar Enterprise Platform Tenant',
      isActive: true,
    },
  });
  console.log(`✓ Tenant created: ${tenant.name}`);

  // 2. Organization (Shehswar Group)
  const organization = await prisma.organization.upsert({
    where: { code: 'ORG-SHEHSWAR-GRP' },
    update: {},
    create: {
      tenantId: tenant.id,
      code: 'ORG-SHEHSWAR-GRP',
      name: 'Shehswar Group of Companies',
      isActive: true,
    },
  });
  console.log(`✓ Organization created: ${organization.name}`);

  // 3. Parent Company
  const parentCompany = await prisma.company.upsert({
    where: {
      organizationId_code: {
        organizationId: organization.id,
        code: 'COMP-PARENT',
      },
    },
    update: {},
    create: {
      organizationId: organization.id,
      code: 'COMP-PARENT',
      name: 'Shehswar Industries (Parent Manufacturing Co)',
      isParent: true,
      currencyCode: 'PKR',
      taxId: 'NTN-1234567-8',
      isActive: true,
    },
  });
  console.log(`✓ Parent Company created: ${parentCompany.name}`);

  // 4. Child Companies
  const childCompany1 = await prisma.company.upsert({
    where: {
      organizationId_code: {
        organizationId: organization.id,
        code: 'COMP-CHILD-DIST',
      },
    },
    update: {},
    create: {
      organizationId: organization.id,
      code: 'COMP-CHILD-DIST',
      name: 'Shehswar Distribution Co (Child)',
      isParent: false,
      currencyCode: 'PKR',
      taxId: 'NTN-7654321-0',
      isActive: true,
    },
  });
  console.log(`✓ Child Company created: ${childCompany1.name}`);

  // 5. Parent Manufacturing Plant & Warehouses
  const plant = await prisma.plant.upsert({
    where: {
      companyId_code: {
        companyId: parentCompany.id,
        code: 'PLANT-MAIN',
      },
    },
    update: {},
    create: {
      companyId: parentCompany.id,
      code: 'PLANT-MAIN',
      name: 'Shehswar Central Feed & Chemical Plant',
      location: 'Industrial Area, Punjab',
      isActive: true,
    },
  });

  await prisma.warehouse.upsert({
    where: {
      companyId_code: {
        companyId: parentCompany.id,
        code: 'WH-PARENT-RM',
      },
    },
    update: {},
    create: {
      companyId: parentCompany.id,
      plantId: plant.id,
      code: 'WH-PARENT-RM',
      name: 'Parent Raw Materials Silo & Warehouse',
      type: 'RAW_MATERIAL',
    },
  });

  await prisma.warehouse.upsert({
    where: {
      companyId_code: {
        companyId: parentCompany.id,
        code: 'WH-PARENT-FG',
      },
    },
    update: {},
    create: {
      companyId: parentCompany.id,
      plantId: plant.id,
      code: 'WH-PARENT-FG',
      name: 'Parent Finished Goods Central Warehouse',
      type: 'FINISHED_GOODS',
    },
  });

  // 6. Permissions Seed
  console.log('Generating system permissions...');
  const permissionsToSeed: {
    resource: string;
    action: string;
    code: string;
    isSensitive: boolean;
    description: string;
  }[] = [];

  // Generate standard permissions for all resources
  for (const resource of Object.values(Resource)) {
    for (const action of [
      Action.VIEW,
      Action.CREATE,
      Action.EDIT,
      Action.DELETE,
      Action.SUBMIT,
      Action.APPROVE,
      Action.EXPORT,
    ]) {
      permissionsToSeed.push({
        resource,
        action,
        code: `${resource}:${action}`,
        isSensitive: false,
        description: `Can ${action} ${resource}`,
      });
    }
  }

  // Add sensitive domain-specific permissions
  const sensitivePermissions = [
    {
      resource: Resource.COSTING,
      action: Action.VIEW_COST,
      code: 'costing:view_cost',
      desc: 'Can view parent manufacturing cost',
    },
    {
      resource: Resource.COSTING,
      action: Action.VIEW_MARGIN,
      code: 'costing:view_margin',
      desc: 'Can view parent margins and profit breakdown',
    },
    {
      resource: Resource.FORMULA_BOM,
      action: Action.EDIT_FORMULA,
      code: 'formula_bom:edit_formula',
      desc: 'Can create or modify production formulas',
    },
    {
      resource: Resource.FORMULA_BOM,
      action: Action.APPROVE_FORMULA,
      code: 'formula_bom:approve_formula',
      desc: 'Can approve and lock production formulas',
    },
    {
      resource: Resource.SALES_ORDER,
      action: Action.MODIFY_PRICE,
      code: 'sales_order:modify_price',
      desc: 'Can override base price list',
    },
    {
      resource: Resource.DEALER,
      action: Action.MODIFY_CREDIT_LIMIT,
      code: 'dealer:modify_credit_limit',
      desc: 'Can modify dealer credit limits',
    },
    {
      resource: Resource.DEALER,
      action: Action.APPROVE_CREDIT_OVERRIDE,
      code: 'dealer:approve_credit_override',
      desc: 'Can approve sales order exceeding credit limit',
    },
    {
      resource: Resource.FINISHED_BATCH,
      action: Action.RELEASE_BATCH,
      code: 'finished_batch:release_batch',
      desc: 'Can release finished product batch for dispatch',
    },
    {
      resource: Resource.FINISHED_BATCH,
      action: Action.RECALL_BATCH,
      code: 'finished_batch:recall_batch',
      desc: 'Can recall batch from distribution',
    },
    {
      resource: Resource.AUDIT_LOG,
      action: Action.VIEW_AUDIT_LOGS,
      code: 'audit_log:view_audit_logs',
      desc: 'Can view immutable security audit logs',
    },
  ];

  for (const sp of sensitivePermissions) {
    permissionsToSeed.push({
      resource: sp.resource,
      action: sp.action,
      code: sp.code,
      isSensitive: true,
      description: sp.desc,
    });
  }

  for (const perm of permissionsToSeed) {
    await prisma.permission.upsert({
      where: { code: perm.code },
      update: { description: perm.description, isSensitive: perm.isSensitive },
      create: {
        resource: perm.resource,
        action: perm.action,
        code: perm.code,
        description: perm.description,
        isSensitive: perm.isSensitive,
      },
    });
  }
  console.log(`✓ Seeded ${permissionsToSeed.length} permissions.`);

  // 7. System Roles
  const superAdminRole = await prisma.role.upsert({
    where: {
      organizationId_code: {
        organizationId: organization.id,
        code: 'ROLE_SUPER_ADMIN',
      },
    },
    update: {},
    create: {
      organizationId: organization.id,
      code: 'ROLE_SUPER_ADMIN',
      name: 'Super Administrator',
      description: 'Full unconstrained platform and group governance access',
      isSystem: true,
    },
  });

  // Attach all permissions to SUPER_ADMIN role
  const allPerms = await prisma.permission.findMany({ select: { id: true } });
  for (const p of allPerms) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: superAdminRole.id,
          permissionId: p.id,
        },
      },
      update: {},
      create: {
        roleId: superAdminRole.id,
        permissionId: p.id,
      },
    });
  }

  // 8. Super Admin User
  const passwordHash = await bcrypt.hash('ShehswarAdmin2026!', 12);
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@shehswar.com' },
    update: {},
    create: {
      organizationId: organization.id,
      companyId: parentCompany.id,
      email: 'admin@shehswar.com',
      passwordHash,
      firstName: 'Ata',
      lastName: 'Architect',
      isSuperAdmin: true,
      isActive: true,
    },
  });

  await prisma.userRole.create({
    data: {
      userId: adminUser.id,
      roleId: superAdminRole.id,
      companyId: parentCompany.id,
    },
  });

  console.log(`✓ Super Admin user seeded: ${adminUser.email} (password: ShehswarAdmin2026!)`);
  console.log('✅ Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error executing database seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
