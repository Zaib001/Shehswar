const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Testing documentSequence.upsert with undefined or dummy companyId:');
  try {
    await prisma.documentSequence.upsert({
      where: {
        companyId_documentType_fiscalYear: {
          companyId: '00000000-0000-0000-0000-000000000000',
          documentType: 'CODE_CST',
          fiscalYear: 0,
        },
      },
      update: { currentNumber: { increment: 1 } },
      create: {
        organizationId: '00000000-0000-0000-0000-000000000000',
        companyId: '00000000-0000-0000-0000-000000000000',
        documentType: 'CODE_CST',
        fiscalYear: 0,
        prefix: 'CST',
        currentNumber: 1,
      },
    });
  } catch (err) {
    console.log('DocumentSequence error code:', err.code, err.message);
  }
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });

