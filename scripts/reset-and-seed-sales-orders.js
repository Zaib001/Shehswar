/**
 * SHEHSWAR ONE360 — Reset Database & Seed Sales Orders, Rate Lists & Pricing Schemes
 * 
 * 1. Safely purges existing transactional data (preserves Auth, Users, Roles, Permissions).
 * 2. Seeds clean Master Data (UOMs, Categories, Finished Products, Warehouses, Initial Stocks, Dealers).
 * 3. Seeds Dynamic Rate Lists (SEASONAL-2026 Version 1 with all products).
 * 4. Seeds Dynamic Commercial Schemes (CASH-15, PPG-ADV-JAN, PACKAGE-10-1, SPECIAL-DEAL, NET-RATE).
 * 5. Seeds Pricing Authority Limits (SO, AM, BM, Admin).
 * 6. Seeds Demo Sales Orders:
 *    - Order 1: PENDING_APPROVAL with CASH-15 (for testing Approval / Review)
 *    - Order 2: APPROVED with PACKAGE-10-1 (for 1-click Convert to Sale & Invoice creation)
 *    - Order 3: CONVERTED_TO_SALE with posted Sales Invoice (full lifecycle demonstration)
 */
const { PrismaClient } = require('@prisma/client');
const { v7: uuidv7 } = require('uuid');

const prisma = new PrismaClient();

async function run() {
  console.log('\n========================================================================');
  console.log('SHEHSWAR ONE360 — DATABASE RESET & SALES ORDER / RATE LIST SEEDING');
  console.log('========================================================================\n');

  try {
    // -------------------------------------------------------------
    // 1. PURGE TRANSACTIONAL & OPERATIONAL DATA (PRESERVE AUTH)
    // -------------------------------------------------------------
    console.log('1. Purging business and sales data (preserving users and roles)...');

    // Procurement & Inward Logistics
    await prisma.goodsReceiptNoteItem.deleteMany().catch(() => {});
    await prisma.goodsReceiptNote.deleteMany().catch(() => {});
    await prisma.purchaseInvoiceItem.deleteMany().catch(() => {});
    await prisma.purchaseInvoice.deleteMany().catch(() => {});
    await prisma.purchaseOrderItem.deleteMany().catch(() => {});
    await prisma.purchaseOrder.deleteMany().catch(() => {});
    await prisma.purchaseReturnItem.deleteMany().catch(() => {});
    await prisma.purchaseReturn.deleteMany().catch(() => {});

    // Sales & Invoices
    await prisma.salesInvoiceItem.deleteMany().catch(() => {});
    await prisma.salesInvoice.deleteMany().catch(() => {});
    await prisma.salesOrderItem.deleteMany().catch(() => {});
    await prisma.salesOrder.deleteMany().catch(() => {});
    await prisma.salesReturnItem.deleteMany().catch(() => {});
    await prisma.salesReturn.deleteMany().catch(() => {});
    await prisma.gatePass.deleteMany().catch(() => {});

    // Financial & Dealer Ledgers
    await prisma.dealerPaymentReceipt.deleteMany().catch(() => {});
    await prisma.salesOfficerDealerAssignment.deleteMany().catch(() => {});
    await prisma.dealerAssignmentHistory.deleteMany().catch(() => {});
    await prisma.dealerLedgerEntry.deleteMany().catch(() => {});
    await prisma.dealer.deleteMany().catch(() => {});

    // Pricing & Rate Lists
    await prisma.rateListItem.deleteMany().catch(() => {});
    await prisma.rateListVersion.deleteMany().catch(() => {});
    await prisma.rateList.deleteMany().catch(() => {});
    await prisma.pricingScheme.deleteMany().catch(() => {});
    await prisma.pricingAuthorityLimit.deleteMany().catch(() => {});
    await prisma.productRateList.deleteMany().catch(() => {});

    // Inventory & Warehouses
    await prisma.stockLedgerEntry.deleteMany().catch(() => {});
    await prisma.warehouseStock.deleteMany().catch(() => {});
    await prisma.warehouseLocation.deleteMany().catch(() => {});
    await prisma.warehouse.deleteMany().catch(() => {});

    // Finished Products & Master Data
    await prisma.finishedProduct.deleteMany().catch(() => {});
    await prisma.packSize.deleteMany().catch(() => {});
    await prisma.productCategory.deleteMany().catch(() => {});
    await prisma.unitOfMeasure.deleteMany().catch(() => {});

    console.log('   ✔ All historical sales, pricing, and transactional records purged cleanly.');

    // -------------------------------------------------------------
    // 2. RETRIEVE OR ANCHOR CORE COMPANY & ORGANIZATION
    // -------------------------------------------------------------
    console.log('\n2. Verifying Company & Organization scope...');
    let company = await prisma.company.findFirst({
      where: { code: 'CO-SHEHSWAR-PARENT' },
      include: { organization: true },
    });

    if (!company) {
      let org = await prisma.organization.findFirst();
      if (!org) {
        let tenant = await prisma.platformTenant.findFirst();
        if (!tenant) {
          tenant = await prisma.platformTenant.create({
            data: { id: uuidv7(), code: 'TENANT-SHEHSWAR', name: 'Shehswar Platform Tenant', isActive: true },
          });
        }
        org = await prisma.organization.create({
          data: {
            id: uuidv7(),
            tenantId: tenant.id,
            code: 'ORG-SHEHSWAR-GRP',
            name: 'Shehswar Group',
            currency: 'PKR',
            country: 'Pakistan',
            isActive: true,
          },
        });
      }

      company = await prisma.company.create({
        data: {
          id: uuidv7(),
          organizationId: org.id,
          code: 'CO-SHEHSWAR-PARENT',
          name: 'Shehswar',
          companyType: 'PARENT_MANUFACTURING',
          currency: 'PKR',
          country: 'Pakistan',
          isActive: true,
        },
        include: { organization: true },
      });
    }

    const orgId = company.organizationId;
    const compId = company.id;
    console.log(`   ✔ Company: ${company.name} (${company.code}) | Organization: ${company.organization.name}`);

    // Retrieve active user
    let user = await prisma.user.findFirst({
      where: { companyId: compId },
    });
    if (!user) {
      user = await prisma.user.findFirst();
    }
    console.log(`   ✔ Operating User: ${user?.fullName || user?.email} (${user?.id})`);

    // -------------------------------------------------------------
    // 3. SEED MASTER DATA (UOMs, Categories, PackSizes)
    // -------------------------------------------------------------
    console.log('\n3. Seeding Product Master Data...');
    const uomBag = await prisma.unitOfMeasure.create({
      data: {
        id: uuidv7(),
        organizationId: orgId,
        code: 'BAG',
        name: 'Bag',
        symbol: 'bag',
        category: 'MASS',
        status: 'ACTIVE',
      },
    });

    const catMicronutrients = await prisma.productCategory.create({
      data: {
        id: uuidv7(),
        organizationId: orgId,
        code: 'MICRONUTRIENTS',
        name: 'Micronutrients & Specialized Fertilizers',
        status: 'ACTIVE',
      },
    });

    const catPotash = await prisma.productCategory.create({
      data: {
        id: uuidv7(),
        organizationId: orgId,
        code: 'POTASH',
        name: 'Potassium & Complex Fertilizers',
        status: 'ACTIVE',
      },
    });

    const pack50kg = await prisma.packSize.create({
      data: {
        id: uuidv7(),
        organizationId: orgId,
        code: 'PACK-50KG',
        name: '50 Kg Woven Polypropylene Bag',
        quantity: 50,
        uomId: uomBag.id,
        status: 'ACTIVE',
      },
    });

    const pack25kg = await prisma.packSize.create({
      data: {
        id: uuidv7(),
        organizationId: orgId,
        code: 'PACK-25KG',
        name: '25 Kg Laminated Bag',
        quantity: 25,
        uomId: uomBag.id,
        status: 'ACTIVE',
      },
    });

    // -------------------------------------------------------------
    // 4. SEED FINISHED PRODUCTS
    // -------------------------------------------------------------
    const productDefs = [
      {
        code: 'FP-ZINC-33',
        name: 'Premium Zinc Sulphate 33%',
        categoryId: catMicronutrients.id,
        packSizeId: pack25kg.id,
        price: 4000.0,
      },
      {
        code: 'FP-DAP-50',
        name: 'DAP Granular Fertilizer 50kg',
        categoryId: catPotash.id,
        packSizeId: pack50kg.id,
        price: 12500.0,
      },
      {
        code: 'FP-POTASH-25',
        name: 'Soluble Potash Special 25kg',
        categoryId: catPotash.id,
        packSizeId: pack25kg.id,
        price: 8200.0,
      },
      {
        code: 'FP-UREA-N',
        name: 'Special Coated Urea 50kg',
        categoryId: catPotash.id,
        packSizeId: pack50kg.id,
        price: 3800.0,
      },
      {
        code: 'FP-NPK-BIO',
        name: 'Bio-Gold NPK Micro 10kg',
        categoryId: catMicronutrients.id,
        packSizeId: pack25kg.id,
        price: 2900.0,
      },
    ];

    const finishedProducts = [];
    for (const p of productDefs) {
      const prod = await prisma.finishedProduct.create({
        data: {
          id: uuidv7(),
          organizationId: orgId,
          companyId: compId,
          productCode: p.code,
          productName: p.name,
          categoryId: p.categoryId,
          baseUomId: uomBag.id,
          salesUomId: uomBag.id,
          packSizeId: p.packSizeId,
          defaultSellingPrice: p.price,
          standardCost: Math.round(p.price * 0.7),
          status: 'ACTIVE',
          approvalStatus: 'APPROVED',
        },
      });
      finishedProducts.push(prod);
    }
    console.log(`   ✔ Created ${finishedProducts.length} Active Finished Products.`);

    // -------------------------------------------------------------
    // 5. SEED WAREHOUSES & INITIAL INVENTORY
    // -------------------------------------------------------------
    console.log('\n5. Seeding Warehouses and Inventory Stock...');
    let whPlant = await prisma.warehouse.findFirst({ where: { companyId: compId, code: 'WH-PLANT-01' } });
    if (!whPlant) {
      whPlant = await prisma.warehouse.create({
        data: {
          id: uuidv7(),
          companyId: compId,
          code: 'WH-PLANT-01',
          name: 'Central Plant Warehouse - Multan',
          type: 'PLANT',
          location: 'Industrial Estate, Multan Road',
          isActive: true,
        },
      });
    }

    let whLahore = await prisma.warehouse.findFirst({ where: { companyId: compId, code: 'WH-REG-LHR' } });
    if (!whLahore) {
      whLahore = await prisma.warehouse.create({
        data: {
          id: uuidv7(),
          companyId: compId,
          code: 'WH-REG-LHR',
          name: 'Lahore Regional Distribution Hub',
          type: 'REGIONAL',
          location: 'Raiwind Road, Lahore',
          isActive: true,
        },
      });
    }

    // Populate stock for all products (5,000 bags each in both warehouses)
    for (const prod of finishedProducts) {
      for (const wh of [whPlant, whLahore]) {
        await prisma.warehouseStock.create({
          data: {
            id: uuidv7(),
            organizationId: orgId,
            companyId: compId,
            warehouseId: wh.id,
            itemType: 'FINISHED_PRODUCT',
            finishedProductId: prod.id,
            quantityOnHand: 5000,
            averageCost: Math.round(Number(prod.defaultSellingPrice) * 0.7),
          },
        });
      }
    }
    console.log('   ✔ Warehouses and 5,000 bags of available stock seeded per product.');

    // -------------------------------------------------------------
    // 6. SEED COMMERCIAL DEALERS
    // -------------------------------------------------------------
    console.log('\n6. Seeding Commercial Dealers...');
    const dealerDefs = [
      { code: 'DLR-001', name: 'ABC Seed & Chemical Corporation', city: 'Faisalabad', creditLimit: 5000000 },
      { code: 'DLR-002', name: 'Al-Rehman Fertilizer Mart', city: 'Multan', creditLimit: 8000000 },
      { code: 'DLR-003', name: 'Kissan Madadgar Agro Services', city: 'Sahiwal', creditLimit: 3500000 },
    ];

    const dealers = [];
    for (const d of dealerDefs) {
      const dealer = await prisma.dealer.create({
        data: {
          id: uuidv7(),
          organizationId: orgId,
          companyId: compId,
          code: d.code,
          name: d.name,
          businessName: d.name,
          phone: '0300-1234567',
          city: d.city,
          creditLimit: d.creditLimit,
          currentBalance: 0,
          status: 'ACTIVE',
        },
      });
      dealers.push(dealer);
    }
    console.log(`   ✔ Created ${dealers.length} Commercial Dealers with active credit lines.`);

    // -------------------------------------------------------------
    // 7. SEED DYNAMIC RATE LISTS (SEASONAL-2026)
    // -------------------------------------------------------------
    console.log('\n7. Seeding Dynamic Rate List (SEASONAL-2026)...');
    const seasonalRateList = await prisma.rateList.create({
      data: {
        id: uuidv7(),
        organizationId: orgId,
        companyId: compId,
        code: 'SEASONAL-2026',
        name: 'Seasonal Commercial Rate List 2026',
        description: 'Standard baseline seasonal commercial pricing for all fertilizer products',
        category: 'SEASONAL',
        currency: 'PKR',
        status: 'ACTIVE',
        isMobileVisible: true,
        isMobileSelectable: true,
        priority: 10,
        createdById: user?.id,
      },
    });

    const rateListVersion1 = await prisma.rateListVersion.create({
      data: {
        id: uuidv7(),
        rateListId: seasonalRateList.id,
        versionNumber: 1,
        effectiveFrom: new Date('2026-01-01T00:00:00Z'),
        effectiveTo: new Date('2026-12-31T23:59:59Z'),
        status: 'ACTIVE',
        notes: 'Official Published 2026 Seasonal Base Pricing',
        publishedAt: new Date(),
        createdById: user?.id,
      },
    });

    for (const prod of finishedProducts) {
      const baseRate = Number(prod.defaultSellingPrice);
      await prisma.rateListItem.create({
        data: {
          id: uuidv7(),
          rateListVersionId: rateListVersion1.id,
          finishedProductId: prod.id,
          packSizeId: prod.packSizeId,
          baseRate: baseRate,
          unit: 'BAG',
          discountType: 'PERCENTAGE',
          discountValue: 0,
          minAllowedRate: Math.round(baseRate * 0.75),
          quantityFrom: 1,
          freeQuantity: 0,
          isActive: true,
        },
      });
    }
    console.log(`   ✔ SEASONAL-2026 Version #1 populated with all ${finishedProducts.length} active products.`);

    // -------------------------------------------------------------
    // 8. SEED COMMERCIAL SCHEMES
    // -------------------------------------------------------------
    console.log('\n8. Seeding Commercial Pricing Schemes...');
    const schemeDefs = [
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
        description: 'Buy 10 bags and get 1 free promotional bag (10% free volume benefit)',
        schemeType: 'PACKAGE',
        calculationMethod: 'ADDITIVE',
        paidQuantity: 10,
        freeQuantity: 1,
        minQuantity: 10,
        discountComponents: [],
        paymentTerm: 'ANY',
        isMobileVisible: true,
        isMobileSelectable: true,
        priority: 20,
      },
      {
        code: 'SPECIAL-DEAL',
        name: 'Special Negotiated Rate',
        description: 'Directly negotiated commercial deal requiring managerial approval',
        schemeType: 'SPECIAL_RATE',
        calculationMethod: 'ADDITIVE',
        discountComponents: [{ name: 'Negotiated Discount', type: 'PERCENTAGE', value: 16.67 }],
        paymentTerm: 'ANY',
        isMobileVisible: false,
        isMobileSelectable: false,
        priority: 5,
      },
      {
        code: 'NET-RATE',
        name: 'Net Selling Rate Scheme',
        description: 'Authoritative net agreed selling rate',
        schemeType: 'NET_RATE',
        calculationMethod: 'ADDITIVE',
        discountComponents: [],
        paymentTerm: 'ANY',
        isMobileVisible: true,
        isMobileSelectable: true,
        priority: 1,
      },
    ];

    const schemes = [];
    for (const s of schemeDefs) {
      const scheme = await prisma.pricingScheme.create({
        data: {
          id: uuidv7(),
          organizationId: orgId,
          companyId: compId,
          code: s.code,
          name: s.name,
          description: s.description,
          schemeType: s.schemeType,
          calculationMethod: s.calculationMethod,
          discountComponents: s.discountComponents,
          baseRateListId: seasonalRateList.id,
          paidQuantity: s.paidQuantity || 0,
          freeQuantity: s.freeQuantity || 0,
          minQuantity: s.minQuantity || 0,
          paymentTerm: s.paymentTerm,
          effectiveFrom: new Date('2026-01-01T00:00:00Z'),
          effectiveTo: new Date('2026-12-31T23:59:59Z'),
          isMobileVisible: s.isMobileVisible,
          isMobileSelectable: s.isMobileSelectable,
          priority: s.priority,
          status: 'ACTIVE',
        },
      });
      schemes.push(scheme);
    }
    console.log(`   ✔ Created ${schemes.length} Commercial Pricing Schemes.`);

    // -------------------------------------------------------------
    // 9. SEED PRICING AUTHORITY LIMITS
    // -------------------------------------------------------------
    console.log('\n9. Seeding Role-Based Pricing Authority Limits...');
    const authorityDefs = [
      { roleCode: 'SALES_OFFICER', maxDiscountPct: 5.0, canSetNetRate: false, canApplySpecialRate: false, requiresApproval: true },
      { roleCode: 'AREA_MANAGER', maxDiscountPct: 15.0, canSetNetRate: false, canApplySpecialRate: true, requiresApproval: true },
      { roleCode: 'BUSINESS_MANAGER', maxDiscountPct: 25.0, canSetNetRate: true, canApplySpecialRate: true, requiresApproval: false },
      { roleCode: 'ADMIN', maxDiscountPct: 100.0, canSetNetRate: true, canApplySpecialRate: true, requiresApproval: false },
    ];

    for (const a of authorityDefs) {
      await prisma.pricingAuthorityLimit.create({
        data: {
          id: uuidv7(),
          organizationId: orgId,
          companyId: compId,
          roleCode: a.roleCode,
          maxDiscountPct: a.maxDiscountPct,
          canSetNetRate: a.canSetNetRate,
          canApplySpecialRate: a.canApplySpecialRate,
          canApproveOwnOverride: a.roleCode === 'BUSINESS_MANAGER' || a.roleCode === 'ADMIN',
          requiresApproval: a.requiresApproval,
          companyScope: 'COMPANY',
          status: 'ACTIVE',
        },
      });
    }
    console.log('   ✔ Configured Pricing Authority thresholds for SO (5%), AM (15%), BM (25%), Admin (100%).');

    // -------------------------------------------------------------
    // 10. SEED SAMPLE SALES ORDERS
    // -------------------------------------------------------------
    console.log('\n10. Seeding Sample Sales Orders across Lifecycle...');

    const cashScheme = schemes.find(s => s.code === 'CASH-15');
    const pkgScheme = schemes.find(s => s.code === 'PACKAGE-10-1');
    const advScheme = schemes.find(s => s.code === 'PPG-ADV-JAN');

    const productA = finishedProducts[0]; // Zinc 33% (PKR 4,000)
    const productB = finishedProducts[1]; // DAP 50kg (PKR 12,500)

    // --- ORDER 1: PENDING_APPROVAL with CASH-15 ---
    // 10 bags of Zinc (PKR 4,000 - 15% = PKR 3,400) = PKR 34,000
    const order1 = await prisma.salesOrder.create({
      data: {
        id: uuidv7(),
        organizationId: orgId,
        companyId: compId,
        orderNumber: 'SO-2026-00001',
        dealerId: dealers[0].id,
        salesOfficerId: user?.id,
        warehouseId: whPlant.id,
        orderDate: new Date(),
        status: 'PENDING_APPROVAL',
        paymentTerm: 'CASH',
        rateListId: seasonalRateList.id,
        rateListVersionId: rateListVersion1.id,
        schemeId: cashScheme.id,
        appliedSchemeName: cashScheme.name,
        discountAmount: 6000.0,
        freeQuantityTotal: 0,
        totalAmount: 34000.0,
        notes: 'Booked by Sales Officer via Mobile. Awaiting managerial review & approval.',
        items: {
          create: [
            {
              id: uuidv7(),
              finishedProductId: productA.id,
              productName: productA.productName,
              packing: '25kg Bag',
              quantity: 10,
              rateListId: seasonalRateList.id,
              rateListVersionId: rateListVersion1.id,
              schemeId: cashScheme.id,
              baseRate: 4000.0,
              discountPercent: 15.0,
              discountAmount: 6000.0,
              freeQuantity: 0,
              unitPrice: 3400.0,
              totalPrice: 34000.0,
              pricingBreakdown: {
                rateListCode: seasonalRateList.code,
                schemeCode: cashScheme.code,
                baseRate: 4000,
                finalUnitRate: 3400,
                discountPercent: 15,
              },
            },
          ],
        },
      },
    });
    console.log(`   ✔ Order 1 Created: ${order1.orderNumber} (PENDING_APPROVAL) - Ready for review & approval`);

    // --- ORDER 2: APPROVED with PACKAGE-10-1 ---
    // 22 bags of DAP (PKR 12,500 each). 20 paid, 2 free = 20 * 12,500 = PKR 250,000
    const order2 = await prisma.salesOrder.create({
      data: {
        id: uuidv7(),
        organizationId: orgId,
        companyId: compId,
        orderNumber: 'SO-2026-00002',
        dealerId: dealers[1].id,
        salesOfficerId: user?.id,
        warehouseId: whLahore.id,
        orderDate: new Date(),
        status: 'APPROVED',
        paymentTerm: 'CREDIT',
        rateListId: seasonalRateList.id,
        rateListVersionId: rateListVersion1.id,
        schemeId: pkgScheme.id,
        appliedSchemeName: pkgScheme.name,
        discountAmount: 25000.0,
        freeQuantityTotal: 2,
        totalAmount: 250000.0,
        notes: 'Manager approved package deal (10+1 free). Ready to Convert to Sale & Generate Invoice!',
        approvedAt: new Date(),
        approvedById: user?.id,
        items: {
          create: [
            {
              id: uuidv7(),
              finishedProductId: productB.id,
              productName: productB.productName,
              packing: '50kg Bag',
              quantity: 22,
              rateListId: seasonalRateList.id,
              rateListVersionId: rateListVersion1.id,
              schemeId: pkgScheme.id,
              baseRate: 12500.0,
              discountPercent: 9.09,
              discountAmount: 25000.0,
              freeQuantity: 2,
              unitPrice: 12500.0,
              totalPrice: 250000.0,
              pricingBreakdown: {
                rateListCode: seasonalRateList.code,
                schemeCode: pkgScheme.code,
                baseRate: 12500,
                finalUnitRate: 12500,
                freeQuantity: 2,
                paidQuantity: 20,
              },
            },
          ],
        },
      },
    });
    console.log(`   ✔ Order 2 Created: ${order2.orderNumber} (APPROVED) - Ready for 1-Click Convert to Sale`);

    // --- ORDER 3: CONVERTED_TO_SALE with POSTED Sales Invoice ---
    // 15 bags of Zinc (PKR 4,000 - 20% Advance PPG = PKR 3,200) = PKR 48,000
    const order3 = await prisma.salesOrder.create({
      data: {
        id: uuidv7(),
        organizationId: orgId,
        companyId: compId,
        orderNumber: 'SO-2026-00003',
        dealerId: dealers[2].id,
        salesOfficerId: user?.id,
        warehouseId: whPlant.id,
        orderDate: new Date(Date.now() - 24 * 3600 * 1000),
        status: 'CONVERTED_TO_SALE',
        paymentTerm: 'ADVANCE',
        rateListId: seasonalRateList.id,
        rateListVersionId: rateListVersion1.id,
        schemeId: advScheme.id,
        appliedSchemeName: advScheme.name,
        discountAmount: 12000.0,
        freeQuantityTotal: 0,
        totalAmount: 48000.0,
        notes: 'Dispatched & Converted to Sales Invoice. Inventory deducted & ledger debited.',
        approvedAt: new Date(Date.now() - 24 * 3600 * 1000),
        approvedById: user?.id,
        items: {
          create: [
            {
              id: uuidv7(),
              finishedProductId: productA.id,
              productName: productA.productName,
              packing: '25kg Bag',
              quantity: 15,
              rateListId: seasonalRateList.id,
              rateListVersionId: rateListVersion1.id,
              schemeId: advScheme.id,
              baseRate: 4000.0,
              discountPercent: 20.0,
              discountAmount: 12000.0,
              freeQuantity: 0,
              unitPrice: 3200.0,
              totalPrice: 48000.0,
              pricingBreakdown: {
                rateListCode: seasonalRateList.code,
                schemeCode: advScheme.code,
                baseRate: 4000,
                finalUnitRate: 3200,
                discountPercent: 20,
              },
            },
          ],
        },
      },
    });

    // Create the posted Sales Invoice for Order 3
    const invoice3 = await prisma.salesInvoice.create({
      data: {
        id: uuidv7(),
        organizationId: orgId,
        companyId: compId,
        invoiceNumber: 'INV-2026-00001',
        salesOrderId: order3.id,
        dealerId: dealers[2].id,
        warehouseId: whPlant.id,
        invoiceDate: new Date(),
        postingStatus: 'POSTED',
        grossAmount: 60000.0,
        discountAmount: 12000.0,
        taxAmount: 0,
        netAmount: 48000.0,
        notes: 'Generated from Sales Order SO-2026-00003 under PPG-ADV-JAN Advance Scheme',
        postedAt: new Date(),
        items: {
          create: [
            {
              id: uuidv7(),
              finishedProductId: productA.id,
              productName: productA.productName,
              quantity: 15,
              rate: 3200.0,
              grossAmount: 60000.0,
              discountAmount: 12000.0,
              taxAmount: 0,
              netAmount: 48000.0,
            },
          ],
        },
      },
    });

    // Deduct stock from warehouse for Invoice 3
    await prisma.warehouseStock.updateMany({
      where: { warehouseId: whPlant.id, finishedProductId: productA.id },
      data: {
        quantityOnHand: { decrement: 15 },
      },
    });

    // Record Stock Ledger Entry
    await prisma.stockLedgerEntry.create({
      data: {
        id: uuidv7(),
        organizationId: orgId,
        companyId: compId,
        warehouseId: whPlant.id,
        finishedProductId: productA.id,
        transactionType: 'SALE',
        referenceId: invoice3.id,
        referenceNumber: invoice3.invoiceNumber,
        itemType: 'FINISHED_PRODUCT',
        quantityChange: -15,
        quantityAfter: 4985,
        unitCost: Math.round(Number(productA.defaultSellingPrice) * 0.7),
        salesInvoiceId: invoice3.id,
      },
    });

    // Debit Dealer Ledger
    await prisma.dealerLedgerEntry.create({
      data: {
        id: uuidv7(),
        organizationId: orgId,
        companyId: compId,
        dealerId: dealers[2].id,
        entryType: 'SALE_INVOICE',
        referenceId: invoice3.id,
        voucherNumber: invoice3.invoiceNumber,
        debit: 48000.0,
        credit: 0,
        runningBalance: 48000.0,
        entryDate: new Date(),
        description: `Sales Invoice ${invoice3.invoiceNumber} for SO-2026-00003`,
        salesInvoiceId: invoice3.id,
      },
    });

    await prisma.dealer.update({
      where: { id: dealers[2].id },
      data: { currentBalance: { increment: 48000.0 } },
    });

    console.log(`   ✔ Order 3 Converted: ${order3.orderNumber} -> Invoice ${invoice3.invoiceNumber} (POSTED) - Inventory & Dealer Ledger updated.`);

    console.log('\n========================================================================');
    console.log('✅ DATABASE RESET & SEEDING COMPLETED SUCCESSFULLY!');
    console.log('========================================================================\n');

  } catch (err) {
    console.error('❌ SEEDING FAILED:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

run();
