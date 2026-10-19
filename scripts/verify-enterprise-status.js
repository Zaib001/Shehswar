const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('\n=== 1. COMPANIES (Exactly 5: 1 Parent + 4 Children) ===');
  const companies = await prisma.company.findMany({
    orderBy: { createdAt: 'asc' },
    select: { id: true, code: true, name: true, isParent: true },
  });
  console.table(companies);

  console.log('\n=== 2. PRIMARY DEALERS & CREDIT PROFILES (Exactly 4 Core Dealers) ===');
  const dealers = await prisma.dealer.findMany({
    where: { code: { in: ['DLR-001', 'DLR-002', 'DLR-003', 'DLR-004'] } },
    select: {
      code: true,
      name: true,
      creditLimit: true,
      currentBalance: true,
      status: true,
      company: { select: { name: true } },
    },
    orderBy: { code: 'asc' },
  });
  console.table(dealers.map(d => ({
    code: d.code,
    name: d.name,
    limit: Number(d.creditLimit).toLocaleString(),
    balance: Number(d.currentBalance).toLocaleString(),
    exposure: `${((Number(d.currentBalance) / Number(d.creditLimit)) * 100).toFixed(1)}%`,
    company: d.company?.name,
  })));

  console.log('\n=== 3. TRANSACTION DOCUMENT COUNTS ===');
  const salesOrders = await prisma.salesOrder.count();
  const salesInvoices = await prisma.salesInvoice.count();
  const purchaseOrders = await prisma.purchaseOrder.count();
  const paymentReceipts = await prisma.dealerPaymentReceipt.count();
  const journalEntries = await prisma.journalEntry.count();
  const overrideRequests = await prisma.creditOverrideRequest.count();

  console.table([{
    salesOrders,
    salesInvoices,
    purchaseOrders,
    paymentReceipts,
    journalEntries,
    overrideRequests,
  }]);

  console.log('\n=== 4. FINANCIAL GL SUMMARY (Double Entry Balancing) ===');
  const entries = await prisma.journalEntry.findMany({
    select: { entryNumber: true, sourceType: true, totalDebit: true, totalCredit: true, description: true }
  });
  console.table(entries.map(e => ({
    entry: e.entryNumber,
    type: e.sourceType,
    debit: Number(e.totalDebit).toLocaleString(),
    credit: Number(e.totalCredit).toLocaleString(),
    desc: e.description?.substring(0, 45),
  })));

  const debitsCredits = await prisma.journalEntry.aggregate({
    _sum: { totalDebit: true, totalCredit: true },
  });
  console.log('Total GL Debits :', Number(debitsCredits._sum.totalDebit).toLocaleString(), 'PKR');
  console.log('Total GL Credits:', Number(debitsCredits._sum.totalCredit).toLocaleString(), 'PKR');
  console.log('GL Books Balanced:', debitsCredits._sum.totalDebit.equals(debitsCredits._sum.totalCredit) ? 'YES (100% In Equilibrium)' : 'NO');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
