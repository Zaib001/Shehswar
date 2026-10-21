import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { v7 as uuidv7 } from 'uuid';

const remoteDbUrl = 'postgresql://shehswar_user:PHHDD5jvPcZsDCX2LH7mKrcO5GBtobti@dpg-dbc8moafngtc739dhgkg-a.oregon-postgres.render.com/shehswar_one360?sslmode=require';
const prisma = new PrismaClient({ datasources: { db: { url: remoteDbUrl } } });

async function main() {
  console.log('🚀 Connecting to remote Render PostgreSQL database...');
  console.log('Target DB URL:', remoteDbUrl.replace(/:[^:]*@/, ':****@'));

  // 1. Get primary organization & company
  let org = await prisma.organization.findFirst({
    where: { code: 'ORG-SHEHSWAR-GRP' },
  });
  if (!org) {
    org = await prisma.organization.findFirst();
  }
  if (!org) {
    throw new Error('Organization not found in database');
  }

  let company = await prisma.company.findFirst({
    where: { organizationId: org.id, code: 'COMP-SHEHSWAR' },
  });
  if (!company) {
    company = await prisma.company.findFirst({ where: { organizationId: org.id } });
  }
  if (!company) {
    throw new Error('Company not found in database');
  }

  console.log(`✓ Using Organization: ${org.name} (${org.code}) [${org.id}]`);
  console.log(`✓ Using Company: ${company.name} (${company.code}) [${company.id}]`);

  // 2. Standard enterprise password
  const defaultPassword = 'Shehswar@2026!';
  const passwordHash = await bcrypt.hash(defaultPassword, 10);

  // 3. Ensure Super Admin Role exists
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
    console.log(`✓ Created role: ${superAdminRole.code}`);
  }

  // 4. Ensure Sales Officer Role exists
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
    console.log(`✓ Created role: ${salesOfficerRole.code}`);
  }

  // Ensure Sales Officer has all sales/dealer/payments permissions
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
  console.log(`✓ Attached ${matchingPerms.length} permissions to ${salesOfficerRole.code}`);

  // 5. Seed / Update Admin User
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
  }
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: adminUser.id, roleId: superAdminRole.id } },
    update: { companyId: company.id },
    create: { userId: adminUser.id, roleId: superAdminRole.id, companyId: company.id },
  });
  console.log(`✅ Admin user configured: ${adminEmail}`);

  // 6. Seed / Update Sales Officer User
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
  }
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: soUser.id, roleId: salesOfficerRole.id } },
    update: { companyId: company.id },
    create: { userId: soUser.id, roleId: salesOfficerRole.id, companyId: company.id },
  });
  console.log(`✅ Sales Officer user configured: ${soEmail}`);

  // 7. Remove or clean up extraneous test users so ONLY Admin and Sales Officer remain
  const allowedEmails = [adminEmail, soEmail];
  const extraneousUsers = await prisma.user.findMany({
    where: { email: { notIn: allowedEmails } },
  });

  console.log(`Cleaning up ${extraneousUsers.length} extraneous test users...`);
  for (const user of extraneousUsers) {
    try {
      await prisma.userRole.deleteMany({ where: { userId: user.id } });
      await prisma.userSession.deleteMany({ where: { userId: user.id } });
      await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });
      await prisma.userNotification.deleteMany({ where: { userId: user.id } });
      await prisma.userMarketAssignment.deleteMany({ where: { userId: user.id } });
      await prisma.dealerAssignmentHistory.deleteMany({ where: { salesOfficerId: user.id } });
      await prisma.salesOfficerDealerAssignment.deleteMany({ where: { salesOfficerId: user.id } });
      await prisma.auditLog.deleteMany({ where: { userId: user.id } });
      await prisma.user.delete({ where: { id: user.id } });
      console.log(`  - Deleted test user: ${user.email}`);
    } catch (e: any) {
      console.warn(`  - Could not delete ${user.email} (foreign key active). Deactivating instead...`);
      await prisma.user.update({
        where: { id: user.id },
        data: { isActive: false, status: 'INACTIVE', failedLoginAttempts: 999 },
      });
    }
  }

  // 8. Summary of active users in production database
  const activeUsers = await prisma.user.findMany({
    where: { isActive: true },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      isSuperAdmin: true,
      status: true,
      userRoles: {
        include: { role: true },
      },
    },
  });

  console.log('\n======================================================');
  console.log('🎉 PRODUCTION DATABASE SEED COMPLETE: ONLY ADMIN & SALES OFFICER');
  console.log('======================================================');
  activeUsers.forEach((u) => {
    console.log(`• [${u.email}]`);
    console.log(`  Name: ${u.firstName} ${u.lastName}`);
    console.log(`  Super Admin: ${u.isSuperAdmin}`);
    console.log(`  Status: ${u.status}`);
    console.log(`  Roles: ${u.userRoles.map((r) => r.role.code).join(', ') || 'None'}`);
    console.log(`  Default Password: ${defaultPassword}`);
    console.log('------------------------------------------------------');
  });
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
