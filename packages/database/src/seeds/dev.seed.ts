/**
 * SHEHSWAR ONE360 - Development & Demo Seed
 *
 * Seeds fake development accounts and demo entities for local testing.
 * MUST NEVER be executed in production environments.
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

export async function seedDev(prisma: PrismaClient) {
  console.log('🧪 [Dev Seed] Seeding demo development accounts...');

  const org = await prisma.organization.findUnique({
    where: { code: 'ORG-SHEHSWAR-GRP' },
  });

  if (!org) {
    console.warn('⚠️ [Dev Seed] Shehswar organization not found. Run client seed first.');
    return;
  }

  const [parentCompany, childCompany, childSalesRole, parentOpsRole] = await Promise.all([
    prisma.company.findFirst({ where: { organizationId: org.id, isParent: true } }),
    prisma.company.findFirst({ where: { organizationId: org.id, isParent: false } }),
    prisma.role.findFirst({ where: { organizationId: org.id, code: 'ROLE_CHILD_SALES' } }),
    prisma.role.findFirst({ where: { organizationId: org.id, code: 'ROLE_PARENT_OPS' } }),
  ]);

  if (!parentCompany || !childCompany || !childSalesRole || !parentOpsRole) {
    console.warn('⚠️ [Dev Seed] Required companies or roles missing.');
    return;
  }

  const defaultPasswordHash = await bcrypt.hash('Shehswar@Dev2026!', 8);

  // 1. Child Sales Demo User
  const salesUser = await prisma.user.upsert({
    where: { email: 'sales@childco.com' },
    update: {},
    create: {
      organizationId: org.id,
      companyId: childCompany.id,
      email: 'sales@childco.com',
      passwordHash: defaultPasswordHash,
      firstName: 'Tariq',
      lastName: 'Salesman',
      isSuperAdmin: false,
      isActive: true,
    },
  });

  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: salesUser.id,
        roleId: childSalesRole.id,
      },
    },
    update: {},
    create: {
      userId: salesUser.id,
      roleId: childSalesRole.id,
      companyId: childCompany.id,
    },
  });

  // 2. Parent Operations Demo User
  const opsUser = await prisma.user.upsert({
    where: { email: 'plant.head@shehswar.com' },
    update: {},
    create: {
      organizationId: org.id,
      companyId: parentCompany.id,
      email: 'plant.head@shehswar.com',
      passwordHash: defaultPasswordHash,
      firstName: 'Kamran',
      lastName: 'PlantHead',
      isSuperAdmin: false,
      isActive: true,
    },
  });

  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: opsUser.id,
        roleId: parentOpsRole.id,
      },
    },
    update: {},
    create: {
      userId: opsUser.id,
      roleId: parentOpsRole.id,
      companyId: parentCompany.id,
    },
  });

  console.log('✓ [Dev Seed] Demo accounts created (sales@childco.com, plant.head@shehswar.com)');
}

// Standalone runner
if (require.main === module) {
  const prisma = new PrismaClient();
  seedDev(prisma)
    .then(async () => {
      await prisma.$disconnect();
    })
    .catch(async (e) => {
      console.error(e);
      await prisma.$disconnect();
      process.exit(1);
    });
}
