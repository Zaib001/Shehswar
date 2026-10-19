/**
 * SHEHSWAR ONE360 - Database Seed Orchestrator
 *
 * Runs sequentially:
 *   1. System Seed (universal platform permissions & reference definitions)
 *   2. Client Bootstrap (Shehswar Group customer account)
 *   3. Development Demo Seed (only in non-production environments)
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { seedSystem } from './seeds/system.seed';
import { seedClient } from './seeds/client.seed';
import { seedDev } from './seeds/dev.seed';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting SHEHSWAR ONE360 database seed orchestrator...\n');

  try {
    // 1. System Seed (generic SaaS reference metadata)
    await seedSystem(prisma);

    // 2. Client Bootstrap (Shehswar Group customer structure)
    await seedClient(prisma);

    // 3. Dev Demo Data (if non-production)
    if (process.env.NODE_ENV !== 'production') {
      await seedDev(prisma);
    }

    console.log('\n🎉 Database seeding completed successfully.');
  } catch (error) {
    console.error('❌ Seeding failed with error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
