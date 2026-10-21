const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const emps = await prisma.employee.findMany({
    include: {
      users: { select: { id: true, email: true, firstName: true, lastName: true } },
      currentVehicles: { select: { id: true, vehicleNumber: true, vehicleModel: true } },
      marketAssignments: {
        include: {
          region: { select: { id: true, name: true } },
          zone: { select: { id: true, name: true } },
          territory: { select: { id: true, name: true } },
        },
      },
      salaryPayments: true,
      vehicleExpenses: true,
    },
  });

  console.log('Total Employees:', emps.length);
  for (const e of emps) {
    console.log({
      id: e.id,
      code: e.employeeCode,
      name: `${e.firstName} ${e.lastName}`,
      position: e.position,
      salary: Number(e.salary || 0),
      users: e.users,
      vehicles: e.currentVehicles,
      assignments: e.marketAssignments.map((m) => ({
        roleScope: m.roleScope,
        region: m.region?.name,
        zone: m.zone?.name,
        territory: m.territory?.name,
      })),
      salaryCount: e.salaryPayments.length,
      salaries: e.salaryPayments.map((s) => ({ month: s.salaryMonth, net: Number(s.netPaid) })),
      vehicleExpensesCount: e.vehicleExpenses.length,
      vehicleExpenses: e.vehicleExpenses.map((v) => ({
        type: v.expenseType,
        amt: Number(v.totalAmount),
        remarks: v.remarks,
      })),
    });
  }

  // Also check SalesInvoices to see how sales are attributed
  const invoices = await prisma.salesInvoice.findMany({
    where: { postingStatus: 'POSTED' },
    select: {
      id: true,
      invoiceNumber: true,
      netAmount: true,
      salesOfficerId: true,
      territoryId: true,
      zoneId: true,
      regionId: true,
      dealer: { select: { id: true, businessName: true } },
    },
  });
  console.log('\nTotal Posted Invoices:', invoices.length);
  console.log(invoices);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
