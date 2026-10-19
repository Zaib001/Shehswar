/**
 * SHEHSWAR ONE360 - Admin Credentials Seed Script
 *
 * Ensures the primary platform Administrator account is seeded, active,
 * unlocked, and assigned full Super Admin privileges.
 *
 * Credentials:
 *   Email:    admin@shehswar.com
 *   Password: Password123!
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

export async function seedAdmin() {
  console.log('🔐 Seeding Administrator credentials for Shehswar ONE360...');

  const email = 'admin@shehswar.com';
  const plainPassword = 'Password123!';
  const passwordHash = await bcrypt.hash(plainPassword, 10);

  let org = await prisma.organization.findFirst({
    where: { code: 'ORG-SHEHSWAR-GRP' },
  });
  let company = await prisma.company.findFirst({
    where: { code: 'COMP-SHEHSWAR' },
  });

  if (!org || !company) {
    console.log('⚡ Initial organization not found. Automatically running system and client seeds...');
    const { seedSystem } = await import('./seeds/system.seed');
    const { seedClient } = await import('./seeds/client.seed');
    await seedSystem(prisma);
    await seedClient(prisma);

    org = await prisma.organization.findFirst({
      where: { code: 'ORG-SHEHSWAR-GRP' },
    });
    company = await prisma.company.findFirst({
      where: { code: 'COMP-SHEHSWAR' },
    });

    if (!org || !company) {
      throw new Error('Failed to bootstrap organization or company.');
    }
  }

  // 2. Resolve or create Super Admin Role
  let superAdminRole = await prisma.role.findFirst({
    where: { organizationId: org.id, code: 'ROLE_SUPER_ADMIN' },
  });

  if (!superAdminRole) {
    superAdminRole = await prisma.role.create({
      data: {
        organizationId: org.id,
        code: 'ROLE_SUPER_ADMIN',
        name: 'Super Administrator',
        description: 'Complete unrestricted access across all enterprise modules',
        isSystem: true,
      },
    });
  }

  // 3. Upsert Admin User
  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  let adminUser;
  if (existingUser) {
    adminUser = await prisma.user.update({
      where: { email },
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
    console.log(`✅ Admin user [${email}] updated and unlocked.`);
  } else {
    adminUser = await prisma.user.create({
      data: {
        organizationId: org.id,
        companyId: company.id,
        email,
        passwordHash,
        firstName: 'System',
        lastName: 'Administrator',
        isSuperAdmin: true,
        isActive: true,
        status: 'ACTIVE',
        failedLoginAttempts: 0,
      },
    });
    console.log(`✅ Admin user [${email}] created.`);
  }

  // 4. Ensure UserRole mapping
  const existingUserRole = await prisma.userRole.findFirst({
    where: {
      userId: adminUser.id,
      roleId: superAdminRole.id,
    },
  });

  if (!existingUserRole) {
    await prisma.userRole.create({
      data: {
        userId: adminUser.id,
        roleId: superAdminRole.id,
      },
    });
    console.log(`✅ Super Admin role assigned to [${email}].`);
  }

  console.log('\n======================================================');
  console.log('🔑 SHEHSWAR ONE360 - PRIMARY ADMIN CREDENTIALS');
  console.log('======================================================');
  console.log(`   Email:    ${email}`);
  console.log(`   Password: ${plainPassword}`);
  console.log(`   Role:     Super Administrator (Full System Scope)`);
  console.log(`   Status:   ACTIVE / UNLOCKED`);
  console.log('======================================================\n');
}

seedAdmin()
  .catch((e) => {
    console.error('❌ Failed to seed admin credentials:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
