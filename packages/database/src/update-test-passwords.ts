import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function update() {
  const hash = await bcrypt.hash('Shehswar@2026!', 10);
  const res = await prisma.user.updateMany({
    where: { email: { contains: 'shehswar.test' } },
    data: { passwordHash: hash },
  });
  console.log(`Updated passwords for ${res.count} test users to 'Shehswar@2026!'`);

  // Also print the exact emails of these users
  const users = await prisma.user.findMany({
    where: { email: { contains: 'shehswar.test' } },
    select: { email: true, firstName: true, lastName: true },
  });
  console.log('Available test users:');
  users.forEach((u) => console.log(`- ${u.firstName} ${u.lastName}: ${u.email}`));
}

update().finally(() => prisma.$disconnect());
