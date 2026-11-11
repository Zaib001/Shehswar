const { PrismaClient } = require('@prisma/client');

const remoteUrl = 'postgresql://shehswar_user:PHHDD5jvPcZsDCX2LH7mKrcO5GBtobti@dpg-dbc8moafngtc739dhgkg-a.oregon-postgres.render.com/shehswar_one360?sslmode=require';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: remoteUrl,
    },
  },
});

async function testConnection() {
  console.log('Testing connection to remote DB...');
  try {
    const orgs = await prisma.organization.findMany();
    console.log('Connected! Organizations:', orgs.length, orgs.map(o => ({ id: o.id, name: o.name })));
    const comps = await prisma.company.findMany();
    console.log('Companies:', comps.length, comps.map(c => ({ id: c.id, code: c.code, name: c.name, isParent: c.isParent })));
    const cats = await prisma.materialCategory.findMany();
    console.log('Material Categories:', cats.length, cats.map(c => ({ id: c.id, code: c.code, name: c.name })));
    const uoms = await prisma.unitOfMeasure.findMany();
    console.log('UOMs:', uoms.length, uoms.map(u => ({ id: u.id, code: u.code, symbol: u.symbol })));
    const existingRm = await prisma.rawMaterial.count();
    console.log('Existing Raw Materials count:', existingRm);
  } catch (err) {
    console.error('Connection error:', err);
  } finally {
    await prisma.$disconnect();
  }
}

testConnection();

