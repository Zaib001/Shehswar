const { PrismaClient } = require('@prisma/client');
const { v7: uuidv7 } = require('uuid');
const p = new PrismaClient();

async function seed() {
  const comp = await p.company.findFirst({ where: { code: 'COMP-SHEHSWAR' } });
  if (!comp) {
    console.error('Shehswar company not found');
    return;
  }
  const orgId = comp.organizationId;
  const compId = comp.id;

  console.log('Using Org:', orgId, 'Company:', compId);

  // 1. Warehouses
  const whs = [
    { code: 'WH-000001', name: 'Faisalabad Warehouse', type: 'GENERAL', location: 'Faisalabad' },
    { code: 'WH-000002', name: 'Multan Central Warehouse', type: 'RAW_MATERIAL', location: 'Multan' },
    { code: 'WH-000003', name: 'Lahore Plant Warehouse', type: 'FINISHED_GOODS', location: 'Lahore' },
  ];

  for (const wh of whs) {
    const existing = await p.warehouse.findFirst({ where: { companyId: compId, code: wh.code } });
    if (!existing) {
      await p.warehouse.create({
        data: {
          id: uuidv7(),
          companyId: compId,
          code: wh.code,
          name: wh.name,
          type: wh.type,
          location: wh.location,
          isActive: true,
        },
      });
      console.log('Created warehouse:', wh.name);
    }
  }

  // 2. Vendors
  const vendors = [
    { code: 'VEN-000001', name: 'V Agrics International (Pvt) Ltd.', vendorType: 'RAW_MATERIAL', status: 'APPROVED' },
    { code: 'VEN-000002', name: 'ChemTech Solvents (Pvt) Ltd.', vendorType: 'RAW_MATERIAL', status: 'APPROVED' },
    { code: 'VEN-000003', name: 'PackMaster Packaging Ltd.', vendorType: 'PACKING_MATERIAL', status: 'APPROVED' },
  ];

  for (const v of vendors) {
    const existing = await p.vendor.findFirst({ where: { companyId: compId, code: v.code } });
    if (!existing) {
      await p.vendor.create({
        data: {
          id: uuidv7(),
          organizationId: orgId,
          companyId: compId,
          code: v.code,
          name: v.name,
          legalName: v.name,
          vendorType: v.vendorType,
          status: v.status,
          country: 'Pakistan',
          city: 'Lahore',
        },
      });
      console.log('Created vendor:', v.name);
    }
  }

  // 3. UoMs
  let uomLiter = await p.unitOfMeasure.findFirst({ where: { organizationId: orgId, code: 'LITER' } });
  if (!uomLiter) {
    uomLiter = await p.unitOfMeasure.create({
      data: {
        id: uuidv7(),
        organizationId: orgId,
        code: 'LITER',
        name: 'Liter',
        symbol: 'LTR',
        type: 'VOLUME',
        status: 'ACTIVE',
      },
    });
  }

  let uomNos = await p.unitOfMeasure.findFirst({ where: { organizationId: orgId, code: 'NOS' } });
  if (!uomNos) {
    uomNos = await p.unitOfMeasure.create({
      data: {
        id: uuidv7(),
        organizationId: orgId,
        code: 'NOS',
        name: 'Numbers',
        symbol: 'Nos',
        type: 'UNIT',
        status: 'ACTIVE',
      },
    });
  }

  // 4. Finished Product: Lambda Cyhalothrin 2.5 % EC
  let fpLambda = await p.finishedProduct.findFirst({
    where: { companyId: compId, productName: { contains: 'Lambda Cyhalothrin' } },
  });
  if (!fpLambda) {
    fpLambda = await p.finishedProduct.create({
      data: {
        id: uuidv7(),
        organizationId: orgId,
        companyId: compId,
        productCode: 'FG-000230',
        productName: 'Lambda Cyhalothrin 2.5 % EC',
        packingQuantity: 1,
        packingUnit: 'Liter',
        standardCost: 531.33,
        status: 'ACTIVE',
        baseUomId: uomLiter.id,
      },
    });
    console.log('Created finished product:', fpLambda.productName);
  }

  // 5. Raw Material: RA Lambda Cyhalothrin 2.5 % EC
  let rmLambda = await p.rawMaterial.findFirst({
    where: { companyId: compId, materialName: { contains: 'Lambda Cyhalothrin' } },
  });
  if (!rmLambda) {
    rmLambda = await p.rawMaterial.create({
      data: {
        id: uuidv7(),
        organizationId: orgId,
        companyId: compId,
        materialCode: 'RM-000230',
        materialName: 'RA Lambda Cyhalothrin 2.5 % EC',
        standardCost: 92000,
        lastPurchaseCost: 92000,
        baseUomId: uomLiter.id,
        purchaseUomId: uomLiter.id,
        status: 'ACTIVE',
      },
    });
    console.log('Created raw material:', rmLambda.materialName);
  }

  // 6. Packing Materials
  const pmItems = [
    { code: 'PM-000231', name: 'PM Labels Lambda Cyhalothrin', cost: 7, uomId: uomNos.id },
    { code: 'PM-000232', name: 'PM Pet Bottle 1 Liter', cost: 42, uomId: uomNos.id },
    { code: 'PM-000233', name: 'PM Carton 1 x 12 (Bromoxnal 1Ltr)', cost: 104, uomId: uomNos.id },
    { code: 'PM-000234', name: 'PM Caps', cost: 8, uomId: uomNos.id },
    { code: 'PM-000235', name: 'PM Packing Labour', cost: 7, uomId: uomNos.id },
  ];

  for (const pm of pmItems) {
    const existing = await p.packingMaterial.findFirst({ where: { companyId: compId, materialCode: pm.code } });
    if (!existing) {
      await p.packingMaterial.create({
        data: {
          id: uuidv7(),
          organizationId: orgId,
          companyId: compId,
          materialCode: pm.code,
          materialName: pm.name,
          standardCost: pm.cost,
          lastPurchaseCost: pm.cost,
          baseUomId: pm.uomId,
          status: 'ACTIVE',
        },
      });
      console.log('Created packing material:', pm.name);
    }
  }

  // 7. Real Purchase Order for historical rates
  const venVAgrics = await p.vendor.findFirst({ where: { companyId: compId, code: 'VEN-000001' } });
  const whFsd = await p.warehouse.findFirst({ where: { companyId: compId, code: 'WH-000001' } });

  const poNumber = 'PO-2026-00998';
  let existingPo = await p.purchaseOrder.findFirst({ where: { companyId: compId, poNumber } });
  if (!existingPo && venVAgrics && whFsd) {
    existingPo = await p.purchaseOrder.create({
      data: {
        id: uuidv7(),
        organizationId: orgId,
        companyId: compId,
        poNumber,
        vendorId: venVAgrics.id,
        warehouseId: whFsd.id,
        createdAt: new Date('2026-10-21'),
        expectedDeliveryDate: new Date('2026-10-25'),
        status: 'CONFIRMED',
        totalAmount: 532928,
        items: {
          create: [
            {
              id: uuidv7(),
              itemName: 'RA Lambda Cyhalothrin 2.5 % EC',
              materialId: rmLambda.id,
              materialType: 'RAW_MATERIAL',
              materialCodeSnapshot: 'RM-000230',
              materialNameSnapshot: 'RA Lambda Cyhalothrin 2.5 % EC',
              quantity: 5,
              unit: '200 LTR',
              unitRate: 92000,
              lineTotal: 460000,
            },
          ],
        },
      },
    });
    console.log('Created PO:', poNumber);
  }

  console.log('Seeding reference costing data completed!');
  await p.$disconnect();
}

seed().catch((err) => {
  console.error('Error seeding:', err);
  process.exit(1);
});
