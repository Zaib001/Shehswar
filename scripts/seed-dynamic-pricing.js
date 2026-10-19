/**
 * SHEHSWAR ONE360 - Database Dynamic Rate Lists & Commercial Schemes Seeder
 *
 * Populates real production-grade Rate Lists, Versions, Items, and Schemes:
 * - SEASONAL-2026 Rate List (Versions 1 with all finished products)
 * - CASH-15 Scheme (15% Cash Discount)
 * - PPG-ADV-JAN Scheme (15% Cash Discount + 5% Booking Benefit = 20% Additive)
 * - PACKAGE-10-1 Scheme (10 Paid + 1 Free Quantity)
 * - SPECIAL-AGREED Scheme (Negotiated special dealer rates)
 * - Role-based pricing authority limits
 */
const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');

const prisma = new PrismaClient();

function uuidv7() {
  return crypto.randomUUID();
}

async function main() {
  console.log('Seeding Dynamic Rate Lists & Commercial Schemes...');

  const companies = await prisma.company.findMany({
    select: { id: true, code: true, name: true, organizationId: true },
  });

  if (companies.length === 0) {
    console.log('No companies found in database.');
    return;
  }

  for (const company of companies) {
    console.log(`\nProcessing Company: ${company.name} (${company.code})`);

    // 1. Seed Pricing Authority Limits
    const roles = [
      { roleCode: 'SALES_OFFICER', maxDiscountPct: 5.0, canSetNetRate: false, canApplySpecialRate: false, canApproveOwnOverride: false, requiresApproval: true },
      { roleCode: 'AREA_MANAGER', maxDiscountPct: 15.0, canSetNetRate: false, canApplySpecialRate: true, canApproveOwnOverride: false, requiresApproval: true },
      { roleCode: 'BUSINESS_MANAGER', maxDiscountPct: 25.0, canSetNetRate: true, canApplySpecialRate: true, canApproveOwnOverride: true, requiresApproval: false },
      { roleCode: 'ADMIN', maxDiscountPct: 100.0, canSetNetRate: true, canApplySpecialRate: true, canApproveOwnOverride: true, requiresApproval: false },
    ];

    for (const r of roles) {
      await prisma.pricingAuthorityLimit.upsert({
        where: { companyId_roleCode: { companyId: company.id, roleCode: r.roleCode } },
        update: {
          maxDiscountPct: r.maxDiscountPct,
          canSetNetRate: r.canSetNetRate,
          canApplySpecialRate: r.canApplySpecialRate,
          canApproveOwnOverride: r.canApproveOwnOverride,
          requiresApproval: r.requiresApproval,
        },
        create: {
          id: uuidv7(),
          organizationId: company.organizationId,
          companyId: company.id,
          roleCode: r.roleCode,
          maxDiscountPct: r.maxDiscountPct,
          canSetNetRate: r.canSetNetRate,
          canApplySpecialRate: r.canApplySpecialRate,
          canApproveOwnOverride: r.canApproveOwnOverride,
          requiresApproval: r.requiresApproval,
          companyScope: 'COMPANY',
          status: 'ACTIVE',
        },
      });
    }
    console.log('  ✔ Authority Limits configured');

    // 2. Fetch Active Finished Products
    const products = await prisma.finishedProduct.findMany({
      where: { companyId: company.id, status: 'ACTIVE' },
    });
    console.log(`  Found ${products.length} active finished products.`);

    // 3. Create or Update SEASONAL-2026 Rate List
    let seasonalRateList = await prisma.rateList.findFirst({
      where: { companyId: company.id, code: 'SEASONAL-2026' },
    });

    if (!seasonalRateList) {
      seasonalRateList = await prisma.rateList.create({
        data: {
          id: uuidv7(),
          organizationId: company.organizationId,
          companyId: company.id,
          code: 'SEASONAL-2026',
          name: 'Seasonal Commercial Rate List 2026',
          description: 'Standard baseline seasonal pricing for all commercial fertilizer products',
          category: 'SEASONAL',
          currency: 'PKR',
          status: 'ACTIVE',
          isMobileVisible: true,
          isMobileSelectable: true,
          priority: 10,
        },
      });
    }

    // Check or create Version 1
    let version1 = await prisma.rateListVersion.findFirst({
      where: { rateListId: seasonalRateList.id, versionNumber: 1 },
    });

    if (!version1) {
      version1 = await prisma.rateListVersion.create({
        data: {
          id: uuidv7(),
          rateListId: seasonalRateList.id,
          versionNumber: 1,
          effectiveFrom: new Date('2026-01-01T00:00:00Z'),
          effectiveTo: new Date('2026-12-31T23:59:59Z'),
          status: 'ACTIVE',
          notes: 'Standard 2026 Seasonal Commercial Pricing',
          publishedAt: new Date(),
        },
      });
    }

    // Populate all active products into Version 1
    for (const prod of products) {
      const baseRate = Number(prod.defaultSellingPrice || prod.standardCost || 1200);
      const existingItem = await prisma.rateListItem.findFirst({
        where: { rateListVersionId: version1.id, finishedProductId: prod.id },
      });

      if (!existingItem) {
        await prisma.rateListItem.create({
          data: {
            id: uuidv7(),
            rateListVersionId: version1.id,
            finishedProductId: prod.id,
            packSizeId: prod.packSizeId || null,
            baseRate: baseRate,
            unit: 'BAG',
            discountType: 'PERCENTAGE',
            discountValue: 0,
            fixedNetRate: null,
            minAllowedRate: Math.round(baseRate * 0.75),
            quantityFrom: 1,
            freeQuantity: 0,
            isActive: true,
          },
        });
      }
    }
    console.log(`  ✔ SEASONAL-2026 Rate List initialized with ${products.length} products`);

    // 4. Create Standard Schemes
    const schemes = [
      {
        code: 'CASH-15',
        name: 'Cash Discount 15%',
        description: 'Standard 15% upfront cash discount on seasonal base rate',
        schemeType: 'CASH_DISCOUNT',
        calculationMethod: 'ADDITIVE',
        discountComponents: [{ name: 'Cash Discount', type: 'PERCENTAGE', value: 15.0 }],
        paymentTerm: 'CASH',
        isMobileVisible: true,
        isMobileSelectable: true,
        priority: 10,
      },
      {
        code: 'PPG-ADV-JAN',
        name: 'PPG Advance January Booking',
        description: 'Advance booking benefit: 15% Cash Discount + 5% Booking Benefit (Total 20% Additive)',
        schemeType: 'ADVANCE_BOOKING',
        calculationMethod: 'ADDITIVE',
        discountComponents: [
          { name: 'Cash Discount', type: 'PERCENTAGE', value: 15.0 },
          { name: 'Booking Benefit', type: 'PERCENTAGE', value: 5.0 },
        ],
        paymentTerm: 'ADVANCE',
        isMobileVisible: true,
        isMobileSelectable: true,
        priority: 15,
      },
      {
        code: 'PACKAGE-10-1',
        name: 'Package Deal 10 + 1 Free',
        description: 'Buy 10 bags and get 1 free promotional bag',
        schemeType: 'PACKAGE',
        calculationMethod: 'ADDITIVE',
        paidQuantity: 10,
        freeQuantity: 1,
        minQuantity: 10,
        discountComponents: [],
        paymentTerm: 'ANY',
        isMobileVisible: true,
        isMobileSelectable: true,
        priority: 12,
      },
      {
        code: 'SPECIAL-DEAL',
        name: 'Negotiated Special Agreed Rate',
        description: 'Custom negotiated commercial selling rate approved by Area or Business Manager',
        schemeType: 'SPECIAL_RATE',
        calculationMethod: 'ADDITIVE',
        discountComponents: [],
        paymentTerm: 'ANY',
        isMobileVisible: true,
        isMobileSelectable: true,
        priority: 5,
      },
      {
        code: 'CREDIT-NET',
        name: 'Credit Term Rate (Net 30)',
        description: 'Commercial credit terms for authorized dealers with standard net pricing',
        schemeType: 'CREDIT_COMMERCIAL',
        calculationMethod: 'ADDITIVE',
        discountComponents: [{ name: 'Credit Commercial Allowance', type: 'PERCENTAGE', value: 6.0 }],
        paymentTerm: 'CREDIT',
        isMobileVisible: true,
        isMobileSelectable: true,
        priority: 8,
      },
    ];

    for (const sc of schemes) {
      await prisma.pricingScheme.upsert({
        where: { companyId_code: { companyId: company.id, code: sc.code } },
        update: {
          name: sc.name,
          description: sc.description,
          schemeType: sc.schemeType,
          calculationMethod: sc.calculationMethod,
          discountComponents: sc.discountComponents,
          paidQuantity: sc.paidQuantity || 0,
          freeQuantity: sc.freeQuantity || 0,
          minQuantity: sc.minQuantity || 0,
          paymentTerm: sc.paymentTerm,
          isMobileVisible: sc.isMobileVisible,
          isMobileSelectable: sc.isMobileSelectable,
          priority: sc.priority,
          effectiveFrom: new Date('2026-01-01T00:00:00Z'),
          effectiveTo: new Date('2026-12-31T23:59:59Z'),
          status: 'ACTIVE',
        },
        create: {
          id: uuidv7(),
          organizationId: company.organizationId,
          companyId: company.id,
          code: sc.code,
          name: sc.name,
          description: sc.description,
          schemeType: sc.schemeType,
          calculationMethod: sc.calculationMethod,
          discountComponents: sc.discountComponents,
          baseRateListId: seasonalRateList.id,
          paidQuantity: sc.paidQuantity || 0,
          freeQuantity: sc.freeQuantity || 0,
          minQuantity: sc.minQuantity || 0,
          paymentTerm: sc.paymentTerm,
          isMobileVisible: sc.isMobileVisible,
          isMobileSelectable: sc.isMobileSelectable,
          priority: sc.priority,
          effectiveFrom: new Date('2026-01-01T00:00:00Z'),
          effectiveTo: new Date('2026-12-31T23:59:59Z'),
          status: 'ACTIVE',
        },
      });
    }
    console.log(`  ✔ 5 Commercial Schemes initialized (Cash, Advance Booking, Package 10+1, Special, Credit)`);
  }

  console.log('\nDynamic Pricing Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
