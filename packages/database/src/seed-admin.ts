/**
 * SHEHSWAR ONE360 - Production Core Credentials Seed Script
 *
 * Seeds strictly:
 *   1. Super Administrator (admin@shehswar.com)
 *   2. Sales Officer (sales.officer@shehswar.com)
 *
 * Credentials:
 *   Admin:         admin@shehswar.com          / Shehswar@2026!
 *   Sales Officer: sales.officer@shehswar.com  / Shehswar@2026!
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { v7 as uuidv7 } from 'uuid';

const prisma = new PrismaClient();

export async function seedAdmin() {
  console.log('🔐 Seeding Production Credentials (Admin & Sales Officer)...');

  const defaultPassword = process.env.INITIAL_ADMIN_PASSWORD || 'Shehswar@2026!';
  const passwordHash = await bcrypt.hash(defaultPassword, 10);

  // 1. Ensure Foundational Tenant, Organization & Primary Company (Shehswar Parent ONLY)
  let tenant = await prisma.platformTenant.findFirst({
    where: { code: 'TENANT-SHEHSWAR' },
  });
  if (!tenant) {
    tenant = await prisma.platformTenant.create({
      data: {
        code: 'TENANT-SHEHSWAR',
        name: 'Shehswar Enterprise Platform Tenant',
        isActive: true,
      },
    });
  }

  let org = await prisma.organization.findFirst({
    where: { code: 'ORG-SHEHSWAR-GRP' },
  });
  if (!org) {
    org = await prisma.organization.create({
      data: {
        tenantId: tenant.id,
        code: 'ORG-SHEHSWAR-GRP',
        name: 'Shehswar Group',
        legalName: 'Shehswar Group of Companies (Pvt) Ltd',
        taxId: '3124567-9',
        currency: 'PKR',
        country: 'Pakistan',
        isActive: true,
      },
    });
  }

  let company = await prisma.company.findFirst({
    where: { code: 'COMP-SHEHSWAR' },
  });
  if (!company) {
    company = await prisma.company.create({
      data: {
        organizationId: org.id,
        code: 'COMP-SHEHSWAR',
        name: 'Shehswar Group (Parent)',
        currency: 'PKR',
        country: 'Pakistan',
        isParent: true,
        isActive: true,
      },
    });
  }

  // Ensure system permissions exist without seeding any dummy client data
  const permCount = await prisma.permission.count();
  if (permCount === 0) {
    const { seedSystem } = await import('./seeds/system.seed');
    await seedSystem(prisma);
  }

  // 1. Super Admin Role
  let superAdminRole = await prisma.role.findFirst({
    where: { organizationId: org.id, code: 'ROLE_SUPER_ADMIN' },
  });

  if (!superAdminRole) {
    superAdminRole = await prisma.role.create({
      data: {
        id: uuidv7(),
        organizationId: org.id,
        code: 'ROLE_SUPER_ADMIN',
        name: 'Super Administrator',
        description: 'Complete unrestricted access across all enterprise modules',
        isSystem: true,
      },
    });
  }

  // 2. Sales Officer Role
  let salesOfficerRole = await prisma.role.findFirst({
    where: { organizationId: org.id, code: 'ROLE_SALES_OFFICER' },
  });

  if (!salesOfficerRole) {
    salesOfficerRole = await prisma.role.create({
      data: {
        id: uuidv7(),
        organizationId: org.id,
        code: 'ROLE_SALES_OFFICER',
        name: 'Sales Officer / Field Officer',
        description: 'Field execution: Dealer order booking, visit logging, territory performance',
        isSystem: false,
      },
    });
  }

  // Attach relevant permissions to Sales Officer
  const permissions = await prisma.permission.findMany();
  const soPermCodes = [
    'dealer:view', 'dealer:create', 'dealer:edit', 'dealer:export',
    'sales_order:view', 'sales_order:create', 'sales_order:edit', 'sales_order:submit', 'sales_order:export',
    'dealer_payment:view', 'dealer_payment:create',
    'financial_transaction:view', 'financial_transaction:create',
    'provisional_receipt:view', 'provisional_receipt:create',
    'credit_limit:view', 'credit_limit:check'
  ];
  const matchingPerms = permissions.filter((p) => soPermCodes.includes(p.code));
  for (const perm of matchingPerms) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: salesOfficerRole.id, permissionId: perm.id } },
      update: {},
      create: { roleId: salesOfficerRole.id, permissionId: perm.id },
    });
  }

  // 3. Upsert Admin User
  const adminEmail = 'admin@shehswar.com';
  let adminUser = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (adminUser) {
    adminUser = await prisma.user.update({
      where: { email: adminEmail },
      data: {
        passwordHash,
        firstName: 'System',
        lastName: 'Administrator',
        isSuperAdmin: true,
        isActive: true,
        status: 'ACTIVE',
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });
    console.log(`✅ Admin user [${adminEmail}] updated and active.`);
  } else {
    adminUser = await prisma.user.create({
      data: {
        id: uuidv7(),
        organizationId: org.id,
        companyId: company.id,
        email: adminEmail,
        passwordHash,
        firstName: 'System',
        lastName: 'Administrator',
        isSuperAdmin: true,
        isActive: true,
        status: 'ACTIVE',
        failedLoginAttempts: 0,
      },
    });
    console.log(`✅ Admin user [${adminEmail}] created.`);
  }

  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: adminUser.id, roleId: superAdminRole.id } },
    update: { companyId: company.id },
    create: { userId: adminUser.id, roleId: superAdminRole.id, companyId: company.id },
  });

  // 4. Upsert Sales Officer User
  const soEmail = 'sales.officer@shehswar.com';
  let soUser = await prisma.user.findUnique({ where: { email: soEmail } });
  if (soUser) {
    soUser = await prisma.user.update({
      where: { email: soEmail },
      data: {
        passwordHash,
        firstName: 'Sales',
        lastName: 'Officer',
        isSuperAdmin: false,
        isActive: true,
        status: 'ACTIVE',
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });
    console.log(`✅ Sales Officer user [${soEmail}] updated and active.`);
  } else {
    soUser = await prisma.user.create({
      data: {
        id: uuidv7(),
        organizationId: org.id,
        companyId: company.id,
        email: soEmail,
        passwordHash,
        firstName: 'Sales',
        lastName: 'Officer',
        isSuperAdmin: false,
        isActive: true,
        status: 'ACTIVE',
        failedLoginAttempts: 0,
      },
    });
    console.log(`✅ Sales Officer user [${soEmail}] created.`);
  }

  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: soUser.id, roleId: salesOfficerRole.id } },
    update: { companyId: company.id },
    create: { userId: soUser.id, roleId: salesOfficerRole.id, companyId: company.id },
  });

  console.log('\n======================================================');
  console.log('🔑 PRODUCTION USERS SEEDED');
  console.log('======================================================');
  console.log(`1. Super Admin:   ${adminEmail}         | ${defaultPassword}`);
  console.log(`2. Sales Officer: ${soEmail} | ${defaultPassword}`);
  console.log('======================================================\n');
}

seedAdmin()
  .catch((e) => {
    console.error('❌ Failed to seed production credentials:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
