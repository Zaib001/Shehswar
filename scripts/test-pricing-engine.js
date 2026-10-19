/**
 * Test Central Price Resolution Engine End-to-End
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Testing Price Resolution Engine...');

  const company = await prisma.company.findFirst({
    where: { code: 'CO-SHEHSWAR-PARENT' },
  });
  if (!company) {
    console.error('Company not found');
    return;
  }

  const products = await prisma.finishedProduct.findMany({
    where: { companyId: company.id, status: 'ACTIVE' },
    take: 2,
  });
  if (products.length === 0) {
    console.error('No products found');
    return;
  }

  const product = products[0];
  console.log(`Testing Product: ${product.productName} (${product.productCode})`);

  const schemes = await prisma.pricingScheme.findMany({
    where: { companyId: company.id, status: 'ACTIVE' },
  });
  console.log(`Found ${schemes.length} schemes`);

  // 1. Test Base Rate
  const rateList = await prisma.rateList.findFirst({
    where: { companyId: company.id, code: 'SEASONAL-2026' },
    include: {
      versions: {
        where: { status: 'ACTIVE' },
        include: { items: { where: { finishedProductId: product.id } } },
      },
    },
  });
  console.log('Seasonal Rate List Version Items:', rateList?.versions[0]?.items);

  // 2. Test Schemes
  for (const s of schemes) {
    console.log(`\nScheme: ${s.name} (${s.code})`);
    console.log(`  Type: ${s.schemeType}, PaymentTerm: ${s.paymentTerm}, Calc: ${s.calculationMethod}`);
    console.log(`  Components:`, s.discountComponents);
    console.log(`  PaidQty: ${s.paidQuantity}, FreeQty: ${s.freeQuantity}`);
  }
}

main().finally(() => prisma.$disconnect());
