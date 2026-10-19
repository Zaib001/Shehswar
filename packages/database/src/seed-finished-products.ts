import { PrismaClient } from '@prisma/client';
import { v7 as uuidv7 } from 'uuid';

const prisma = new PrismaClient();

async function seedProducts() {
  console.log('Seeding Chemical Finished Products Catalog...');

  const companies = await prisma.company.findMany({
    where: { code: { in: ['COMP-SHEHSWAR', 'CO-SHEHSWAR-PARENT'] } },
  });

  const catalog = [
    {
      code: 'PROD-ZINC-33',
      name: 'Premium Zinc Sulphate 33% (10 KG)',
      brand: 'Shehswar Agro',
      grade: 'Premium',
      fertilizerType: 'Micronutrient',
      defaultSellingPrice: 4000,
    },
    {
      code: 'PROD-NPK-LIQ',
      name: 'Bio-NPK Liquid Formula 500ml',
      brand: 'Shehswar Bio',
      grade: 'A-Grade',
      fertilizerType: 'Liquid Bio-Fertilizer',
      defaultSellingPrice: 2500,
    },
    {
      code: 'PROD-SULFUR-80',
      name: 'Sulfur Max 80% WDG 1 KG',
      brand: 'Shehswar CropCare',
      grade: 'Standard',
      fertilizerType: 'Fungicide / Soil Conditioner',
      defaultSellingPrice: 1800,
    },
    {
      code: 'PROD-HUMATE-ORG',
      name: 'Potassium Humate Organic 5 KG',
      brand: 'Shehswar Organics',
      grade: 'Premium',
      fertilizerType: 'Soil Conditioner',
      defaultSellingPrice: 3200,
    },
    {
      code: 'PROD-MAGNESIUM-25',
      name: 'Magnesium Sulphate Heptahydrate 25 KG',
      brand: 'Shehswar Minerals',
      grade: 'Commercial',
      fertilizerType: 'Secondary Nutrient',
      defaultSellingPrice: 4500,
    },
    {
      code: 'PROD-CHELATED-MICRO',
      name: 'Chelated Micronutrient Complex 1L',
      brand: 'Shehswar Foliar',
      grade: 'Premium',
      fertilizerType: 'Foliar Spray',
      defaultSellingPrice: 2800,
    },
  ];

  for (const comp of companies) {
    for (const item of catalog) {
      await prisma.finishedProduct.upsert({
        where: {
          companyId_productCode: {
            companyId: comp.id,
            productCode: item.code,
          },
        },
        update: {
          productName: item.name,
          brand: item.brand,
          grade: item.grade,
          fertilizerType: item.fertilizerType,
          defaultSellingPrice: item.defaultSellingPrice,
          status: 'ACTIVE',
        },
        create: {
          id: uuidv7(),
          organizationId: comp.organizationId,
          companyId: comp.id,
          productCode: item.code,
          productName: item.name,
          brand: item.brand,
          grade: item.grade,
          fertilizerType: item.fertilizerType,
          defaultSellingPrice: item.defaultSellingPrice,
          status: 'ACTIVE',
        },
      });
      console.log(`✓ Product: ${item.name} (${item.code}) for Company: ${comp.name} (${comp.code})`);
    }
  }

  console.log('🎉 Finished products catalog seeded successfully!');
}

seedProducts().finally(() => prisma.$disconnect());
