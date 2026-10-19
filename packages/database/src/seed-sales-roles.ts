import { PrismaClient } from '@prisma/client';
import { v7 as uuidv7 } from 'uuid';

const prisma = new PrismaClient();

async function seedSalesRoles() {
  console.log('Seeding Market & Sales RBAC Roles...');

  const org = await prisma.organization.findFirst();
  if (!org) throw new Error('Organization not found');

  // 1. ROLE_SALES_OFFICER
  const salesOfficerRole = await prisma.role.upsert({
    where: {
      organizationId_code: {
        organizationId: org.id,
        code: 'ROLE_SALES_OFFICER',
      },
    },
    update: {
      name: 'Sales Officer / Field Officer',
      description: 'Field execution: Dealer order booking, visit logging, territory performance',
    },
    create: {
      id: uuidv7(),
      organizationId: org.id,
      code: 'ROLE_SALES_OFFICER',
      name: 'Sales Officer / Field Officer',
      description: 'Field execution: Dealer order booking, visit logging, territory performance',
      isSystem: false,
    },
  });

  // 2. ROLE_AREA_MANAGER
  const areaMgrRole = await prisma.role.upsert({
    where: {
      organizationId_code: {
        organizationId: org.id,
        code: 'ROLE_AREA_MANAGER',
      },
    },
    update: {
      name: 'Area Manager',
      description: 'Zone-level management: Order approval, sales officer supervision, zone performance',
    },
    create: {
      id: uuidv7(),
      organizationId: org.id,
      code: 'ROLE_AREA_MANAGER',
      name: 'Area Manager',
      description: 'Zone-level management: Order approval, sales officer supervision, zone performance',
      isSystem: false,
    },
  });

  // 3. ROLE_BUSINESS_MANAGER
  const businessMgrRole = await prisma.role.upsert({
    where: {
      organizationId_code: {
        organizationId: org.id,
        code: 'ROLE_BUSINESS_MANAGER',
      },
    },
    update: {
      name: 'Business Manager',
      description: 'Regional leadership: Commercial policy, credit approvals, regional performance',
    },
    create: {
      id: uuidv7(),
      organizationId: org.id,
      code: 'ROLE_BUSINESS_MANAGER',
      name: 'Business Manager',
      description: 'Regional leadership: Commercial policy, credit approvals, regional performance',
      isSystem: false,
    },
  });

  // Attach relevant permissions to each role
  const permissions = await prisma.permission.findMany();

  const soPerms = permissions.filter((p) =>
    ['dealer:view', 'dealer:create', 'dealer:edit', 'sales_order:view', 'sales_order:create', 'sales_order:edit', 'sales_order:submit'].includes(p.code)
  );
  for (const perm of soPerms) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: salesOfficerRole.id, permissionId: perm.id } },
      update: {},
      create: { roleId: salesOfficerRole.id, permissionId: perm.id },
    });
  }

  const amPerms = permissions.filter((p) =>
    ['dealer:view', 'dealer:create', 'dealer:edit', 'sales_order:view', 'sales_order:create', 'sales_order:edit', 'sales_order:submit', 'sales_order:approve', 'sales_order:export', 'dealer:export'].includes(p.code)
  );
  for (const perm of amPerms) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: areaMgrRole.id, permissionId: perm.id } },
      update: {},
      create: { roleId: areaMgrRole.id, permissionId: perm.id },
    });
  }

  const bmPerms = permissions.filter((p) =>
    p.code.startsWith('dealer:') || p.code.startsWith('sales_order:') || p.code.startsWith('customer:')
  );
  for (const perm of bmPerms) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: businessMgrRole.id, permissionId: perm.id } },
      update: {},
      create: { roleId: businessMgrRole.id, permissionId: perm.id },
    });
  }

  // Also bind our test sales users to their dedicated roles if they aren't already
  const ali = await prisma.user.findFirst({ where: { email: { contains: 'ali.so' } } });
  if (ali) {
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: ali.id, roleId: salesOfficerRole.id } },
      update: {},
      create: { userId: ali.id, roleId: salesOfficerRole.id, companyId: ali.companyId },
    });
  }

  const bilal = await prisma.user.findFirst({ where: { email: { contains: 'bilal.am' } } });
  if (bilal) {
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: bilal.id, roleId: areaMgrRole.id } },
      update: {},
      create: { userId: bilal.id, roleId: areaMgrRole.id, companyId: bilal.companyId },
    });
  }

  const ahmed = await prisma.user.findFirst({ where: { email: { contains: 'ahmed.bm' } } });
  if (ahmed) {
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: ahmed.id, roleId: businessMgrRole.id } },
      update: {},
      create: { userId: ahmed.id, roleId: businessMgrRole.id, companyId: ahmed.companyId },
    });
  }

  console.log('✓ Successfully seeded:');
  console.log(`  - ${salesOfficerRole.name} (${salesOfficerRole.code}) [${salesOfficerRole.id}]`);
  console.log(`  - ${areaMgrRole.name} (${areaMgrRole.code}) [${areaMgrRole.id}]`);
  console.log(`  - ${businessMgrRole.name} (${businessMgrRole.code}) [${businessMgrRole.id}]`);
}

seedSalesRoles().finally(() => prisma.$disconnect());
