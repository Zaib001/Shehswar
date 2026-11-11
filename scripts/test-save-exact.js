const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { v7: uuidv7 } = require('uuid');

async function main() {
  const comp = await prisma.company.findFirst();
  const org = await prisma.organization.findFirst();

  // Test with exact payload that frontend sends when saving Bifenthrin
  const bifenthrinPoItem = await prisma.purchaseOrderItem.findFirst({
    where: { itemName: { contains: 'Bifenthrin' } },
    include: { order: { include: { vendor: true, warehouse: true } } },
  });

  const payload = {
    serialNumber: 'CST-000001',
    costingDate: '2026-11-11',
    warehouseId: bifenthrinPoItem.order.warehouseId,
    warehouseName: bifenthrinPoItem.order.warehouse.name,
    contractorVendorId: bifenthrinPoItem.order.vendorId,
    contractorVendorName: bifenthrinPoItem.order.vendor.name,
    finishedProductId: '', // What if frontend sent '' or undefined?
    finishedProductName: undefined,
    finishedProductCode: undefined,
    packSize: 1,
    packSizeUnit: 'Liter',
    estimatedQuantity: 0,
    actualQuantity: 100,
    finishedQuantity: 100,
    lines: [
      {
        id: 'line-1',
        materialId: bifenthrinPoItem.materialId,
        materialName: bifenthrinPoItem.itemName,
        type: 'RAW_MATERIAL',
        pack: '2000 LTR',
        quantity: 100,
        rate: 150,
        cost: 15000,
        sourcePoId: bifenthrinPoItem.order.id,
        sourcePoNumber: bifenthrinPoItem.order.poNumber,
      },
    ],
    rawMaterialId: bifenthrinPoItem.materialId,
    rawMaterials: [
      {
        rawMaterialId: bifenthrinPoItem.materialId,
        rawMaterialName: bifenthrinPoItem.itemName,
        quantity: 100,
        unitCost: 150,
        totalCost: 15000,
        uomName: '2000 LTR',
      },
    ],
    packagingMaterials: [],
    otherCost: 0,
    totalRawMaterialCost: 15000,
    totalPackagingCost: 0,
    totalBatchCost: 15000,
    costPerUnit: 150,
    notes: 'Testing',
  };

  const user = {
    id: '01a1cafc-a6a1-766b-8f37-eb42344aef29', // Some user ID
    companyId: comp.id,
    organizationId: org.id,
  };

  console.log('Testing saving with payload (finishedProductId: ""):');
  try {
    const rawMaterialsList = payload.rawMaterials;
    const costingRecord = await prisma.productCosting.create({
      data: {
        id: uuidv7(),
        organizationId: user.organizationId,
        companyId: user.companyId,
        finishedProductId: payload.finishedProductId || null,
        version: 1,
        batchOutputQuantity: payload.actualQuantity,
        packSize: payload.packSize,
        packSizeUnit: payload.packSizeUnit,
        totalVolume: 100,
        totalRawMaterialCost: 15000,
        totalPackagingCost: 0,
        totalBatchCost: 15000,
        costPerUnit: 150,
        notes: JSON.stringify({ test: true }),
        status: 'ACTIVE',
        createdById: null,
        materialLines: {
          create: rawMaterialsList.map((rm) => ({
            id: uuidv7(),
            rawMaterialId: rm.rawMaterialId,
            quantity: rm.quantity,
            unitCost: rm.unitCost,
            totalCost: rm.totalCost,
            uomName: rm.uomName,
          })),
        },
      },
    });
    console.log('Saved successfully:', costingRecord.id);
    await prisma.productCosting.delete({ where: { id: costingRecord.id } });
  } catch (e) {
    console.error('ERROR in test 1:', e.code, e.message);
  }
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
