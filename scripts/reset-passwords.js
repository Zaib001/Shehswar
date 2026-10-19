const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function run() {
  const hash = await bcrypt.hash('Shehswar@2026!', 10);
  const result = await prisma.user.updateMany({
    data: {
      passwordHash: hash,
      failedLoginAttempts: 0,
      lockedUntil: null,
      isActive: true,
      status: 'ACTIVE'
    }
  });
  console.log('Updated user passwords count:', result.count);
  await prisma.$disconnect();
}

run().catch(e => {
  console.error(e);
  process.exit(1);
});
