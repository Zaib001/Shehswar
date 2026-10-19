import { PrismaClient } from '@prisma/client';
import { v7 as uuidv7 } from 'uuid';

const prisma = new PrismaClient();

async function seedOrdersAndInvoices() {
  console.log('Seeding Realistic Sales Orders & Posted Invoices for Market Reports...');

  const company = await prisma.company.findFirst({
    where: { code: { in: ['COMP-SHEHSWAR', 'CO-SHEHSWAR-PARENT'] } },
  });
  if (!company) throw new Error('Company not found');
  const organizationId = company.organizationId;
  const companyId = company.id;

  // 1. Fetch Warehouse
  const warehouse = await prisma.warehouse.findFirst({ where: { companyId } });
  if (!warehouse) throw new Error('Warehouse not found');

  // 2. Fetch or create Finished Products
  let products = await prisma.finishedProduct.findMany({ where: { companyId }, take: 3 });
  if (products.length === 0) {
    const p1 = await prisma.finishedProduct.create({
      data: {
        id: uuidv7(),
        organizationId,
        companyId,
        productCode: 'PROD-ZINC-33',
        productName: 'Premium Zinc Sulphate 33%',
        defaultSellingPrice: 4000,
        status: 'ACTIVE',
      },
    });
    const p2 = await prisma.finishedProduct.create({
      data: {
        id: uuidv7(),
        organizationId,
        companyId,
        productCode: 'PROD-NPK-BOOST',
        productName: 'Bio-NPK Liquid Formula 500ml',
        defaultSellingPrice: 2500,
        status: 'ACTIVE',
      },
    });
    products = [p1, p2];
  }
  const prod1 = products[0];
  const prod2 = products[1] || products[0];

  // 3. Locate Hierarchy
  const region = await prisma.region.findFirst({ where: { companyId } });
  if (!region) throw new Error('Region not found. Run previous seed/test.');
  const zone = await prisma.zone.findFirst({ where: { regionId: region.id } });
  if (!zone) throw new Error('Zone not found');
  const territories = await prisma.territory.findMany({ where: { zoneId: zone.id } });
  const terr1 = territories[0];
  const terr2 = territories[1] || territories[0];
  if (!terr1 || !terr2) throw new Error('Territories not found');

  // 4. Locate Users
  const userAli = await prisma.user.findFirst({ where: { email: { contains: 'ali.so' } } });
  const userUsman = await prisma.user.findFirst({ where: { email: { contains: 'usman.so' } } });
  const userHamza = await prisma.user.findFirst({ where: { email: { contains: 'hamza.so' } } });
  const userBilal = await prisma.user.findFirst({ where: { email: { contains: 'bilal.am' } } });
  const userAhmed = await prisma.user.findFirst({ where: { email: { contains: 'ahmed.bm' } } });

  if (!userAli || !userUsman || !userHamza || !userBilal || !userAhmed) {
    throw new Error('Test users missing. Please ensure previous setup ran.');
  }

  // 5. Locate Dealers
  const dealerSS = await prisma.dealer.findFirst({ where: { name: { contains: 'SS Traders' } } });
  const dealerABC = await prisma.dealer.findFirst({ where: { name: { contains: 'ABC Traders' } } });
  const dealerXYZ = await prisma.dealer.findFirst({ where: { name: { contains: 'XYZ Traders' } } });
  const dealerGreen = await prisma.dealer.findFirst({ where: { name: { contains: 'Green Farm' } } });

  if (!dealerSS || !dealerABC || !dealerXYZ || !dealerGreen) {
    throw new Error('Dealers missing.');
  }

  console.log(`✓ Operating Company: ${company.name}`);
  console.log(`✓ Hierarchy: ${region.name} → ${zone.name} → ${terr1.name} & ${terr2.name}`);

  // Helper to create and post an invoice
  const createOrderAndInvoice = async (params: {
    orderNo: string;
    invNo: string;
    dealerId: string;
    officerId: string;
    territoryId: string;
    product: any;
    qty: number;
    rate: number;
    date: Date;
    createdById: string;
    post: boolean;
  }) => {
    const totalAmount = params.qty * params.rate;

    const order = await prisma.salesOrder.create({
      data: {
        id: uuidv7(),
        organizationId,
        companyId,
        orderNumber: params.orderNo,
        dealerId: params.dealerId,
        salesOfficerId: params.officerId,
        territoryId: params.territoryId,
        zoneId: zone.id,
        areaManagerId: userBilal.id,
        regionId: region.id,
        businessManagerId: userAhmed.id,
        createdById: params.createdById,
        warehouseId: warehouse.id,
        orderDate: params.date,
        status: params.post ? 'CONVERTED_TO_SALE' : 'PENDING',
        totalAmount,
        pricingPhase: 'CASH',
        items: {
          create: [
            {
              id: uuidv7(),
              finishedProductId: params.product.id,
              productName: params.product.productName,
              quantity: params.qty,
              unitPrice: params.rate,
              totalPrice: totalAmount,
            },
          ],
        },
      },
    });

    if (params.post) {
      const invoice = await prisma.salesInvoice.create({
        data: {
          id: uuidv7(),
          organizationId,
          companyId,
          invoiceNumber: params.invNo,
          salesOrderId: order.id,
          dealerId: params.dealerId,
          // IMMUTABLE SNAPSHOT
          salesOfficerId: params.officerId,
          territoryId: params.territoryId,
          zoneId: zone.id,
          areaManagerId: userBilal.id,
          regionId: region.id,
          businessManagerId: userAhmed.id,
          createdById: params.createdById,
          warehouseId: warehouse.id,
          invoiceDate: params.date,
          postingStatus: 'POSTED',
          grossAmount: totalAmount,
          discountAmount: 0,
          taxAmount: 0,
          netAmount: totalAmount,
          items: {
            create: [
              {
                id: uuidv7(),
                finishedProductId: params.product.id,
                productName: params.product.productName,
                quantity: params.qty,
                rate: params.rate,
                grossAmount: totalAmount,
                discountAmount: 0,
                taxAmount: 0,
                netAmount: totalAmount,
              },
            ],
          },
        },
      });

      // Update dealer balance & ledger
      await prisma.dealerLedgerEntry.create({
        data: {
          id: uuidv7(),
          organizationId,
          companyId,
          dealerId: params.dealerId,
          salesInvoiceId: invoice.id,
          entryType: 'SALE_INVOICE',
          referenceId: invoice.id,
          voucherNumber: params.invNo,
          description: `Sales Invoice ${params.invNo} (${params.product.productName})`,
          debit: totalAmount,
          credit: 0,
          runningBalance: totalAmount,
          entryDate: params.date,
        },
      });

      await prisma.dealer.update({
        where: { id: params.dealerId },
        data: { currentBalance: { increment: totalAmount } },
      });

      console.log(`✓ Posted Invoice: ${params.invNo} | Amount: PKR ${totalAmount.toLocaleString()} | SO: ${params.officerId === userAli.id ? 'Ali' : params.officerId === userUsman.id ? 'Usman' : 'Hamza'}`);
      return { order, invoice };
    } else {
      console.log(`✓ Pending Sales Order: ${params.orderNo} | Amount: PKR ${totalAmount.toLocaleString()}`);
      return { order, invoice: null };
    }
  };

  const octNow = new Date(); // Current date (October 2026)
  const ts = Date.now().toString().slice(-4);

  // 1. Ali Orders for SS Traders (Territory 01)
  await createOrderAndInvoice({
    orderNo: `SO-ALI-01-${ts}`,
    invNo: `SINV-ALI-01-${ts}`,
    dealerId: dealerSS.id,
    officerId: userAli.id,
    territoryId: terr1.id,
    product: prod1,
    qty: 250,
    rate: 4000,
    date: new Date(2026, 9, 5, 10, 0),
    createdById: userAli.id,
    post: true,
  });

  await createOrderAndInvoice({
    orderNo: `SO-ALI-02-${ts}`,
    invNo: `SINV-ALI-02-${ts}`,
    dealerId: dealerSS.id,
    officerId: userAli.id,
    territoryId: terr1.id,
    product: prod2,
    qty: 400,
    rate: 2500,
    date: new Date(2026, 9, 8, 14, 30),
    createdById: userAli.id,
    post: true,
  });

  // 2. Ali Orders for Green Farm (Territory 02)
  await createOrderAndInvoice({
    orderNo: `SO-ALI-T2-01-${ts}`,
    invNo: `SINV-ALI-T2-01-${ts}`,
    dealerId: dealerGreen.id,
    officerId: userAli.id,
    territoryId: terr2.id,
    product: prod1,
    qty: 350,
    rate: 4000,
    date: new Date(2026, 9, 10, 11, 0),
    createdById: userAli.id,
    post: true,
  });

  // 3. Usman Orders for ABC Traders (Territory 01)
  await createOrderAndInvoice({
    orderNo: `SO-USMAN-01-${ts}`,
    invNo: `SINV-USMAN-01-${ts}`,
    dealerId: dealerABC.id,
    officerId: userUsman.id,
    territoryId: terr1.id,
    product: prod1,
    qty: 200,
    rate: 4000,
    date: new Date(2026, 9, 6, 9, 30),
    createdById: userUsman.id,
    post: true,
  });

  await createOrderAndInvoice({
    orderNo: `SO-USMAN-02-${ts}`,
    invNo: `SINV-USMAN-02-${ts}`,
    dealerId: dealerABC.id,
    officerId: userUsman.id,
    territoryId: terr1.id,
    product: prod2,
    qty: 280,
    rate: 2500,
    date: new Date(2026, 9, 11, 15, 0),
    createdById: userUsman.id,
    post: true,
  });

  // 4. Hamza Orders for XYZ Traders (Territory 01)
  await createOrderAndInvoice({
    orderNo: `SO-HAMZA-01-${ts}`,
    invNo: `SINV-HAMZA-01-${ts}`,
    dealerId: dealerXYZ.id,
    officerId: userHamza.id,
    territoryId: terr1.id,
    product: prod1,
    qty: 150,
    rate: 4000,
    date: new Date(2026, 9, 7, 12, 0),
    createdById: userHamza.id,
    post: true,
  });

  await createOrderAndInvoice({
    orderNo: `SO-HAMZA-02-${ts}`,
    invNo: `SINV-HAMZA-02-${ts}`,
    dealerId: dealerXYZ.id,
    officerId: userHamza.id,
    territoryId: terr1.id,
    product: prod2,
    qty: 200,
    rate: 2500,
    date: new Date(2026, 9, 12, 16, 0),
    createdById: userHamza.id,
    post: true,
  });

  // 5. Active Pending Orders (Drafts/Pending in Sales Orders list)
  await createOrderAndInvoice({
    orderNo: `SO-PENDING-01-${ts}`,
    invNo: ``,
    dealerId: dealerSS.id,
    officerId: userAli.id,
    territoryId: terr1.id,
    product: prod1,
    qty: 100,
    rate: 4000,
    date: octNow,
    createdById: userAhmed.id, // Created by BM Ahmed for SO Ali!
    post: false,
  });

  await createOrderAndInvoice({
    orderNo: `SO-PENDING-02-${ts}`,
    invNo: ``,
    dealerId: dealerGreen.id,
    officerId: userAli.id,
    territoryId: terr2.id,
    product: prod2,
    qty: 120,
    rate: 2500,
    date: octNow,
    createdById: userAli.id,
    post: false,
  });

  console.log('\n🎉 ALL REAL SAMPLE SALES ORDERS & INVOICES SEEDED SUCCESSFULLY!');
}

seedOrdersAndInvoices().finally(() => prisma.$disconnect());
