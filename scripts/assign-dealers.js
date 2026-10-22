const { PrismaClient } = require('@prisma/client');
const { v7: uuidv7 } = require('uuid');

const remoteDbUrl = 'postgresql://shehswar_user:PHHDD5jvPcZsDCX2LH7mKrcO5GBtobti@dpg-dbc8moafngtc739dhgkg-a.oregon-postgres.render.com/shehswar_one360?sslmode=require';
const prisma = new PrismaClient({ datasources: { db: { url: remoteDbUrl } } });

async function main() {
  console.log('Fetching users and sales officers...');
  const users = await prisma.user.findMany({
    include: {
      userRoles: { include: { role: true } },
      marketAssignments: true,
    },
  });

  console.log('\n--- ALL USERS IN SYSTEM ---');
  const salesOfficers = [];
  users.forEach((u) => {
    const roles = u.userRoles.map((ur) => ur.role.code);
    console.log(`• ID: ${u.id} | Email: ${u.email} | Name: ${u.firstName} ${u.lastName} | Roles: [${roles.join(', ')}]`);
    if (roles.includes('ROLE_SALES_OFFICER') || u.email.includes('sales.officer')) {
      salesOfficers.push(u);
    }
  });

  if (salesOfficers.length === 0) {
    console.error('No sales officers found!');
    return;
  }

  const primarySalesOfficer = salesOfficers[0];
  console.log(`\nAvailable Sales Officer to assign: ${primarySalesOfficer.firstName} ${primarySalesOfficer.lastName} (${primarySalesOfficer.email}) [ID: ${primarySalesOfficer.id}]`);

  // Fetch all dealers in the database
  const dealers = await prisma.dealer.findMany({
    include: {
      territory: true,
      officerAssignments: true,
    },
  });

  console.log(`\nFound ${dealers.length} total dealer(s) in database. Assigning to ${primarySalesOfficer.email}...`);

  for (const dealer of dealers) {
    // 1. Update dealer.assignedFieldOfficerId
    await prisma.dealer.update({
      where: { id: dealer.id },
      data: {
        assignedFieldOfficerId: primarySalesOfficer.id,
      },
    });

    // 2. Ensure SalesOfficerDealerAssignment row exists
    await prisma.salesOfficerDealerAssignment.upsert({
      where: {
        userId_dealerId: {
          userId: primarySalesOfficer.id,
          dealerId: dealer.id,
        },
      },
      update: {},
      create: {
        id: uuidv7(),
        userId: primarySalesOfficer.id,
        dealerId: dealer.id,
      },
    });

    // 3. Ensure territory is assigned to this sales officer if territory exists
    if (dealer.territoryId) {
      await prisma.territory.update({
        where: { id: dealer.territoryId },
        data: {
          managerId: primarySalesOfficer.id,
        },
      });

      // Also ensure UserMarketAssignment exists for this territory
      const existingMarketAssign = await prisma.userMarketAssignment.findFirst({
        where: {
          userId: primarySalesOfficer.id,
          territoryId: dealer.territoryId,
        },
      });

      if (!existingMarketAssign) {
        await prisma.userMarketAssignment.create({
          data: {
            id: uuidv7(),
            organizationId: dealer.organizationId,
            companyId: dealer.companyId,
            userId: primarySalesOfficer.id,
            territoryId: dealer.territoryId,
            roleScope: 'SALES_OFFICER',
            isPrimary: true,
            status: 'ACTIVE',
          },
        });
      }
    }

    console.log(`✓ Assigned Dealer [${dealer.code}] "${dealer.name}" -> Sales Officer [${primarySalesOfficer.email}]`);
  }

  // 4. Verify assignment via mobile API query directly
  const verifiedDealers = await prisma.dealer.findMany({
    where: {
      OR: [
        { assignedFieldOfficerId: primarySalesOfficer.id },
        { officerAssignments: { some: { userId: primarySalesOfficer.id } } },
      ],
    },
    include: {
      assignedOfficer: true,
      officerAssignments: { include: { user: true } },
      territory: true,
    },
  });

  console.log(`\n=============================================================`);
  console.log(`CONFIRMATION: ${verifiedDealers.length} Dealer(s) Assigned to Sales Officer:`);
  console.log(`=============================================================`);
  verifiedDealers.forEach((d) => {
    console.log(`• [${d.code}] ${d.name} (${d.city || 'N/A'})`);
    console.log(`  Assigned Field Officer: ${d.assignedOfficer?.firstName} ${d.assignedOfficer?.lastName} (${d.assignedOfficer?.email})`);
    console.log(`  Credit Limit: PKR ${Number(d.creditLimit).toLocaleString()} | Outstanding: PKR ${Number(d.currentBalance).toLocaleString()}`);
  });
  console.log(`=============================================================\n`);
}

main()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
