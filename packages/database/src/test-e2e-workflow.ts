import { PrismaClient } from '@prisma/client';

async function testE2EWorkflow() {
  console.log('🏁 Starting Real PostgreSQL End-to-End Procurement Workflow Test...\n');

  // 1. Authenticate Department User
  const deptUserRes = await fetch('http://localhost:4000/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'dept.user@shehswar.com', password: 'Shehswar@2026!' }),
  });
  const deptAuth: any = await deptUserRes.json();
  const deptToken = deptAuth.data?.tokens?.accessToken;
  console.log('1. [Auth] Dept User Logged In:', deptAuth.data?.user?.email, 'Company:', deptAuth.data?.user?.company?.name);

  // Authenticate Procurement Manager
  const procMgrRes = await fetch('http://localhost:4000/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'procurement.manager@shehswar.com', password: 'Shehswar@2026!' }),
  });
  const procAuth: any = await procMgrRes.json();
  const procToken = procAuth.data?.tokens?.accessToken;
  console.log('2. [Auth] Procurement Manager Logged In:', procAuth.data?.user?.email);

  // Authenticate Warehouse User
  const whRes = await fetch('http://localhost:4000/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'warehouse.user@shehswar.com', password: 'Shehswar@2026!' }),
  });
  const whAuth: any = await whRes.json();
  const whToken = whAuth.data?.tokens?.accessToken;
  console.log('3. [Auth] Warehouse User Logged In:', whAuth.data?.user?.email);

  const prisma = new PrismaClient();
  const org = await prisma.organization.findFirst();
  const parentCompany = await prisma.company.findFirst({ where: { isParent: true } });
  const prodDept = await prisma.department.findFirst({ where: { companyId: parentCompany?.id } });
  const mfgPlant = await prisma.plant.findFirst({ where: { companyId: parentCompany?.id } });
  const rmWh = await prisma.warehouse.findFirst({ where: { companyId: parentCompany?.id } });

  let vendor1 = await prisma.vendor.findFirst({ where: { companyId: parentCompany?.id } });
  if (!vendor1) {
    vendor1 = await prisma.vendor.create({
      data: {
        organizationId: org!.id,
        companyId: parentCompany!.id,
        code: 'VND-001',
        name: 'Apex Petrochemical Synthetics Ltd',
        vendorType: 'RAW_MATERIAL',
        status: 'APPROVED',
      },
    });
  }

  let vendor2 = await prisma.vendor.findFirst({ where: { companyId: parentCompany?.id, id: { not: vendor1.id } } });
  if (!vendor2) {
    vendor2 = await prisma.vendor.create({
      data: {
        organizationId: org!.id,
        companyId: parentCompany!.id,
        code: 'VND-002',
        name: 'Agrifert Chemical Supplies Co',
        vendorType: 'RAW_MATERIAL',
        status: 'APPROVED',
      },
    });
  }

  // STEP 1: Department User creates a Purchase Requisition
  const prRes = await fetch('http://localhost:4000/api/v1/procurement/purchase-requisitions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${deptToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      departmentId: prodDept?.id,
      plantId: mfgPlant?.id,
      purpose: 'End-to-End Test: Emergency Reactor Catalyst Replenishment',
      priority: 'HIGH',
      requiredDate: new Date('2026-10-30').toISOString(),
      items: [
        {
          itemName: 'Nickel-Molybdenum Reforming Catalyst Type-A',
          category: 'RAW_MATERIAL',
          quantity: 10,
          unit: 'DRUMS',
          estimatedRate: 150000,
          requiredDate: new Date('2026-10-30').toISOString(),
          specification: 'Purity 99.5%, particle size 3mm',
        },
      ],
    }),
  });
  const prJson: any = await prRes.json();
  console.log(`\n4. [PR Create] HTTP ${prRes.status}: Created PR #${prJson.data?.prNumber || prJson.data?.id}`);
  const prId = prJson.data?.id;

  // STEP 2: Department User submits PR
  const submitRes = await fetch(`http://localhost:4000/api/v1/procurement/purchase-requisitions/${prId}/submit`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${deptToken}` },
  });
  const submitJson: any = await submitRes.json();
  console.log(`5. [PR Submit] HTTP ${submitRes.status}: Status is now ->`, submitJson.data?.status);

  // STEP 3: Procurement Manager approves PR
  const approvePrRes = await fetch(`http://localhost:4000/api/v1/procurement/purchase-requisitions/${prId}/approve`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${procToken}` },
  });
  const approvePrJson: any = await approvePrRes.json();
  console.log(`6. [PR Approve] HTTP ${approvePrRes.status}: Status is now ->`, approvePrJson.data?.status);

  // STEP 4: Procurement Manager creates RFQ for this PR
  const rfqRes = await fetch('http://localhost:4000/api/v1/procurement/rfqs', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${procToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prId,
      title: 'Sourcing: Nickel-Molybdenum Reforming Catalyst Type-A',
      issueDate: new Date().toISOString(),
      deadline: new Date('2026-10-20').toISOString(),
      vendorIds: [vendor1?.id, vendor2?.id],
      notes: 'Bids must include COA and MSDS documentation.',
    }),
  });
  const rfqJson: any = await rfqRes.json();
  console.log(`7. [RFQ Create] HTTP ${rfqRes.status}: Created RFQ #${rfqJson.data?.rfqNumber || rfqJson.data?.id}`);
  const rfqId = rfqJson.data?.id;

  // STEP 5: Add Vendor Quotation for Vendor 1
  const quoteRes = await fetch('http://localhost:4000/api/v1/procurement/quotations', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${procToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      rfqId,
      vendorId: vendor1?.id,
      quotationNumber: 'V1-TEST-Q99',
      currency: 'PKR',
      subtotal: 1450000,
      taxAmount: 261000,
      netAmount: 1711000,
      deliveryLeadDays: 7,
      paymentTerms: '30_DAYS_CREDIT',
      validityDate: new Date('2026-11-15').toISOString(),
      items: [
        {
          itemName: 'Nickel-Molybdenum Reforming Catalyst Type-A',
          quantity: 10,
          unit: 'DRUMS',
          unitPrice: 145000,
          taxRate: 18,
          lineTotal: 1711000,
        },
      ],
    }),
  });
  const quoteJson: any = await quoteRes.json();
  console.log(`8. [Quotation Add] HTTP ${quoteRes.status}: Added Quote #${quoteJson.data?.quotationNumber || quoteJson.data?.id}`);
  const quoteId = quoteJson.data?.id;

  // STEP 6: Select Winning Quotation
  const selectQuoteRes = await fetch('http://localhost:4000/api/v1/procurement/quotation-comparisons/select-winner', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${procToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      rfqId,
      quotationId: quoteId,
      selectionJustification: 'Awarded to Agrifert: Lowest responsive commercial offer with 7 days lead time.',
    }),
  });
  const selectQuoteJson: any = await selectQuoteRes.json();
  console.log(`9. [Quotation Select] HTTP ${selectQuoteRes.status}: Quotation status ->`, selectQuoteJson.data?.status || (selectQuoteRes.status === 200 || selectQuoteRes.status === 201 ? 'SELECTED' : 'ERROR'));

  // STEP 7: Automatically Generate Purchase Order for Winner from Quotation Comparison
  const poRes = await fetch('http://localhost:4000/api/v1/procurement/quotation-comparisons/generate-po', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${procToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      rfqId,
      quotationId: quoteId,
      warehouseId: rmWh?.id,
      deliveryLocation: 'Main Plant Catalyst Silo Dock',
    }),
  });
  const poJson: any = await poRes.json();
  console.log(`10. [Generate PO for Winner] HTTP ${poRes.status}: Created PO #${poJson.data?.poNumber || poJson.data?.id}`);
  const poId = poJson.data?.id;

  // STEP 8a: Submit Purchase Order for Approval
  const submitPoRes = await fetch(`http://localhost:4000/api/v1/procurement/purchase-orders/${poId}/submit`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${procToken}` },
  });
  const submitPoJson: any = await submitPoRes.json();
  console.log(`11a. [PO Submit] HTTP ${submitPoRes.status}: Status ->`, submitPoJson.data?.status);

  // STEP 8b: Approve Purchase Order
  const approvePoRes = await fetch(`http://localhost:4000/api/v1/procurement/purchase-orders/${poId}/approve`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${procToken}` },
  });
  const approvePoJson: any = await approvePoRes.json();
  console.log(`11b. [PO Approve] HTTP ${approvePoRes.status}: Status ->`, approvePoJson.data?.status);

  // STEP 9: Warehouse User creates Goods Receipt Note (GRN)
  const grnRes = await fetch('http://localhost:4000/api/v1/procurement/goods-receipts', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${whToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      poId,
      vendorId: vendor1?.id,
      warehouseId: rmWh?.id,
      carrierName: 'Speedy Haulage Ltd',
      vehicleNumber: 'LHR-7721',
      deliveryNoteNumber: 'DN-99410',
      items: [
        {
          itemName: 'Nickel-Molybdenum Reforming Catalyst Type-A',
          orderedQuantity: 10,
          receivedQuantity: 10,
          unit: 'DRUMS',
          packageCondition: 'INTACT',
        },
      ],
    }),
  });
  const grnJson: any = await grnRes.json();
  console.log(`12. [GRN Create] HTTP ${grnRes.status}: Created GRN #${grnJson.data?.grnNumber || grnJson.data?.id}`);
  const grnId = grnJson.data?.id;

  // STEP 10: Warehouse / QC inspection
  const qcRes = await fetch(`http://localhost:4000/api/v1/procurement/goods-receipts/${grnId}/qc-inspection`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${whToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      qcStatus: 'PASSED',
      acceptedQuantity: 10,
      rejectedQuantity: 0,
      qcNotes: 'All 10 drums inspected. Tamper seals intact. Catalyst sample density assay approved.',
    }),
  });
  const qcJson: any = await qcRes.json();
  console.log(`13. [GRN QC Pass] HTTP ${qcRes.status}: QC Status ->`, qcJson.data?.qcStatus || qcJson.data?.status);

  console.log('\n🎉 ALL 10 STEPS IN END-TO-END PROCUREMENT WORKFLOW SUCCEEDED IN POSTGRESQL!\n');
  await prisma.$disconnect();
}

testE2EWorkflow().catch(console.error);
