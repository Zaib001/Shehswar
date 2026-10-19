const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function run() {
  console.log('--- Setting up required System Tenant, Org, and Company for Auth ---');
  
  // 1. Tenant
  const tenant = await prisma.platformTenant.upsert({
    where: { code: 'TENANT-SHEHSWAR' },
    update: { name: 'Shehswar Enterprise Platform Tenant' },
    create: {
      code: 'TENANT-SHEHSWAR',
      name: 'Shehswar Enterprise Platform Tenant',
      isActive: true,
    }
  });

  // 2. Organization
  const organization = await prisma.organization.upsert({
    where: { code: 'ORG-SHEHSWAR-GRP' },
    update: { tenantId: tenant.id, name: 'Shehswar Group', legalName: 'Shehswar Group of Companies (Pvt) Ltd' },
    create: {
      tenantId: tenant.id,
      code: 'ORG-SHEHSWAR-GRP',
      name: 'Shehswar Group',
      legalName: 'Shehswar Group of Companies (Pvt) Ltd',
      country: 'Pakistan',
      currency: 'PKR',
      timezone: 'Asia/Karachi',
      isActive: true,
    }
  });

  // 3. Parent Company
  const company = await prisma.company.upsert({
    where: {
      organizationId_code: {
        organizationId: organization.id,
        code: 'COMP-SHEHSWAR',
      }
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
    }
  });

  console.log('Org ID:', organization.id, 'Company ID:', company.id);

  // 4. Update existing Roles with the correct organizationId
  await prisma.role.updateMany({
    data: {
      organizationId: organization.id
    }
  });

  // 5. Update existing Users with organizationId and companyId
  await prisma.user.updateMany({
    data: {
      organizationId: organization.id,
      companyId: company.id
    }
  });

  // 6. Reset known passwords
  const adminHash = await bcrypt.hash('Admin@123', 10);
  const shehswarHash = await bcrypt.hash('Shehswar@2026!', 10);

  await prisma.user.update({
    where: { email: 'admin@shehswar.com' },
    data: {
      passwordHash: adminHash,
      isActive: true,
      failedLoginAttempts: 0,
      lockedUntil: null
    }
  });

  const otherEmails = [
    'procurement.manager@shehswar.com',
    'finance.manager@shehswar.com',
    'dept.user@shehswar.com',
    'warehouse.user@shehswar.com',
    'sales@childco.com',
    'plant.head@shehswar.com',
    'nectar.rep@shehswar.com'
  ];

  for (const email of otherEmails) {
    await prisma.user.updateMany({
      where: { email },
      data: {
        passwordHash: shehswarHash,
        isActive: true,
        failedLoginAttempts: 0,
        lockedUntil: null
      }
    });
  }

  console.log('Successfully linked users & roles to system org and company!');
  await prisma.$disconnect();
}

run().catch(e => {
  console.error(e);
  process.exit(1);
});
