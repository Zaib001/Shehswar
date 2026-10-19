const { PrismaClient } = require('@prisma/client');
const { v7: uuidv7 } = require('uuid');

const prisma = new PrismaClient();

async function main() {
  console.log('🔄 Unifying dealers, sales data, and credit limits across Shehswar entities...');

  const compShehswar = await prisma.company.findFirst({ where: { code: 'COMP-SHEHSWAR' } });
  const coShehswarParent = await prisma.company.findFirst({ where: { code: 'CO-SHEHSWAR-PARENT' } });

  if (!compShehswar && !coShehswarParent) {
    console.log('No parent company found');
    return;
  }

  const primaryCompany = compShehswar || coShehswarParent;
  console.log(`Primary company selected: ${primaryCompany.name} (${primaryCompany.code})`);

  // 1. Get all dealers currently in the database
  const allDealers = await prisma.dealer.findMany({
    include: {
      territory: true,
      assignedOfficer: true,
    },
  });
  console.log(`Found ${allDealers.length} total dealers in database.`);

  // 2. If COMP-SHEHSWAR has 0 dealers, duplicate/seed dealers for COMP-SHEHSWAR
  if (compShehswar) {
    const existingCompDealers = await prisma.dealer.count({ where: { companyId: compShehswar.id } });
    if (existingCompDealers === 0) {
      console.log('Seeding dealers for COMP-SHEHSWAR...');
      
      // Let's create dealers for COMP-SHEHSWAR
      const sampleDealers = [
        { code: 'DLR-SHEH-01', name: 'Al-Madina Agro Chemicals & Seeds', creditLimit: 15000000, currentBalance: 8500000 },
        { code: 'DLR-SHEH-02', name: 'Ittehad Zarai Markaz Multan', creditLimit: 25000000, currentBalance: 19500000 },
        { code: 'DLR-SHEH-03', name: 'Bismillah Kisan Agrochemicals', creditLimit: 10000000, currentBalance: 10500000 }, // Credit Hold
        { code: 'DLR-SHEH-04', name: 'Punjab Zarai Services Sahiwal', creditLimit: 12000000, currentBalance: 4200000 },
        { code: 'DLR-SHEH-05', name: 'Rehman Fertilizer & Crop Solutions', creditLimit: 18000000, currentBalance: 16500000 }, // Near limit
      ];

      for (const d of sampleDealers) {
        const dealer = await prisma.dealer.create({
          data: {
            id: uuidv7(),
            organizationId: compShehswar.organizationId,
            companyId: compShehswar.id,
            code: d.code,
            name: d.name,
            creditLimit: d.creditLimit,
            currentBalance: d.currentBalance,
            status: 'ACTIVE',
            address: 'Industrial & Agri Hub, Punjab',
            city: 'Multan',
            contactPerson: 'Malik Tariq',
            phone: '+92 300 1234567',
          },
        });

        // Create active CreditLimit config
        await prisma.creditLimit.create({
          data: {
            id: uuidv7(),
            organizationId: compShehswar.organizationId,
            companyId: compShehswar.id,
            level: 'DEALER',
            entityId: dealer.id,
            creditLimit: d.creditLimit,
            nearLimitThresholdPercent: 85,
            effectiveFrom: new Date(),
            status: 'ACTIVE',
            notes: `${d.name} Seeded Exposure Policy`,
          },
        });

        console.log(`  ✓ Created dealer ${d.name} (${d.code}) with limit PKR ${d.creditLimit.toLocaleString()}`);
      }
    }
  }

  // 3. Ensure CO-SHEHSWAR-PARENT also has CreditLimit records for its dealers
  if (coShehswarParent) {
    const parentDealers = await prisma.dealer.findMany({ where: { companyId: coShehswarParent.id } });
    for (const d of parentDealers) {
      const existingLimit = await prisma.creditLimit.findFirst({
        where: { companyId: coShehswarParent.id, level: 'DEALER', entityId: d.id, status: 'ACTIVE' },
      });
      if (!existingLimit) {
        const limitAmt = Number(d.creditLimit) || 10000000;
        await prisma.creditLimit.create({
          data: {
            id: uuidv7(),
            organizationId: coShehswarParent.organizationId,
            companyId: coShehswarParent.id,
            level: 'DEALER',
            entityId: d.id,
            creditLimit: limitAmt,
            nearLimitThresholdPercent: 85,
            effectiveFrom: new Date(),
            status: 'ACTIVE',
            notes: `Auto-initialized limit for ${d.name}`,
          },
        });
        console.log(`  ✓ Created CreditLimit record for ${d.name} (PKR ${limitAmt.toLocaleString()})`);
      }
    }
  }

  console.log('\n🎉 Finished dealer & credit control verification.');
}

main()
  .catch((e) => {
    console.error('Error unifying dealers:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
