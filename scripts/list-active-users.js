const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    include: {
      company: true,
      roles: { include: { role: true } },
    }
  });
  console.log(`Found ${users.length} users:`);
  for (const u of users) {
    console.log(`- ${u.username} (${u.email}) [Company: ${u.company?.name || 'None'}] isSuperAdmin: ${u.isSuperAdmin}`);
  }
}

main().finally(() => prisma.$disconnect());

