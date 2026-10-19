const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function showAuth() {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      isSuperAdmin: true,
      userRoles: {
        include: { role: true }
      }
    }
  });
  console.log('--- CURRENT USERS ---');
  for (const u of users) {
    const roles = u.userRoles.map(ur => ur.role.code).join(', ');
    console.log(`- ${u.email} (${u.firstName} ${u.lastName}) | Roles: [${roles}]`);
  }

  const rolesCount = await prisma.role.count();
  const permsCount = await prisma.permission.count();
  const rolePermsCount = await prisma.rolePermission.count();
  console.log(`\nRoles: ${rolesCount}, Permissions: ${permsCount}, RolePermissions: ${rolePermsCount}`);

  const warehouses = await prisma.warehouse.findMany({
    select: { id: true, code: true, name: true, type: true }
  });
  console.log('\n--- CURRENT WAREHOUSES ---');
  for (const w of warehouses) {
    console.log(`- ${w.code}: ${w.name} (${w.type})`);
  }
}

showAuth()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
