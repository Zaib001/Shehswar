const { PrismaClient } = require('@shehswar/database');
const prisma = new PrismaClient();

async function main() {
  console.log('Checking current dealer and related records count...');

  const dealerCount = await prisma.dealer.count();
  const salesOrderCount = await prisma.salesOrder.count();
  const salesOrderItemCount = await prisma.salesOrderItem.count();
  const salesInvoiceCount = await prisma.salesInvoice.count();
  const salesInvoiceItemCount = await prisma.salesInvoiceItem.count();
  const salesReturnCount = await prisma.salesReturn.count();
  const salesReturnItemCount = await prisma.salesReturnItem.count();
  const dealerPaymentCount = await prisma.dealerPaymentReceipt.count();
  const dealerLedgerCount = await prisma.dealerLedgerEntry.count();
  const officerAssignmentCount = await prisma.salesOfficerDealerAssignment.count();
  const assignmentHistoryCount = await prisma.dealerAssignmentHistory.count();
  const prAllocationCount = await prisma.provisionalReceiptAllocation.count();

  console.log({
    dealers: dealerCount,
    salesOrders: salesOrderCount,
    salesOrderItems: salesOrderItemCount,
    salesInvoices: salesInvoiceCount,
    salesInvoiceItems: salesInvoiceItemCount,
    salesReturns: salesReturnCount,
    salesReturnItems: salesReturnItemCount,
    dealerPayments: dealerPaymentCount,
    dealerLedgers: dealerLedgerCount,
    officerAssignments: officerAssignmentCount,
    assignmentHistories: assignmentHistoryCount,
    prAllocations: prAllocationCount,
  });

  if (dealerCount === 0) {
    console.log('No dealers exist in the database.');
    return;
  }

  console.log('Purging all dealers and related operational records...');

  await prisma.$transaction(async (tx) => {
    // 1. GatePass references dealer
    await tx.gatePassItem.deleteMany({
      where: {
        gatePass: { dealerId: { not: null } }
      }
    });
    await tx.gatePass.deleteMany({
      where: { dealerId: { not: null } }
    });

    // 2. Provisional Receipt Allocations
    await tx.provisionalReceiptAllocation.deleteMany({});
    // Nullify any partyDealerId on ProvisionalReceipt
    await tx.provisionalReceipt.updateMany({
      where: { partyDealerId: { not: null } },
      data: { partyDealerId: null }
    });

    // 3. Dealer Ledger Entries
    await tx.dealerLedgerEntry.deleteMany({});

    // 4. Dealer Payment Receipts
    await tx.dealerPaymentReceipt.deleteMany({});

    // 5. Sales Returns & Items
    await tx.salesReturnItem.deleteMany({});
    await tx.salesReturn.deleteMany({});

    // 6. Sales Invoices & Items
    await tx.salesInvoiceItem.deleteMany({});
    await tx.salesInvoice.deleteMany({});

    // 7. Sales Orders & Items
    await tx.salesOrderItem.deleteMany({});
    await tx.salesOrder.deleteMany({});

    // 8. Officer Assignments & History
    await tx.salesOfficerDealerAssignment.deleteMany({});
    await tx.dealerAssignmentHistory.deleteMany({});

    // 9. Credit limits for dealers
    await tx.creditLimit.deleteMany({
      where: { level: 'DEALER' }
    });

    // 10. Performance targets for dealers if any
    try {
      await tx.salesTarget.deleteMany({
        where: { level: 'DEALER' }
      });
    } catch (e) {
      // If table doesn't have level or records, ignore
    }

    // 11. Finally delete all dealers
    const deletedDealers = await tx.dealer.deleteMany({});
    console.log(`Deleted ${deletedDealers.count} dealers successfully.`);
  });

  const finalDealerCount = await prisma.dealer.count();
  console.log(`Remaining dealers count: ${finalDealerCount}`);
}

main()
  .catch((err) => {
    console.error('Error deleting dealers:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

