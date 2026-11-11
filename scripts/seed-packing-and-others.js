const { Client } = require('pg');
const { randomUUID } = require('crypto');
const { rawPages } = require('./raw-items-data');

const connectionString = 'postgresql://shehswar_user:PHHDD5jvPcZsDCX2LH7mKrcO5GBtobti@dpg-dbc8moafngtc739dhgkg-a.oregon-postgres.render.com/shehswar_one360';

async function main() {
  console.log('🚀 Parsing and seeding Packing Material and Others items to Render PostgreSQL...');
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();

  try {
    // 1. Fetch organization
    const orgRes = await client.query('SELECT id FROM organizations LIMIT 1;');
    if (orgRes.rows.length === 0) throw new Error('No organization found');
    const organizationId = orgRes.rows[0].id;

    // 2. Fetch companies
    const compRes = await client.query('SELECT id, code, name FROM companies;');
    const companies = compRes.rows;
    console.log(`Found ${companies.length} companies to seed.`);

    // 3. Ensure Categories (41-81, 41-82, 41-83, 41-84, 41-85, 41-86, 41-87)
    const categoryDefs = [
      { code: '41-81', name: 'Packing Material', desc: 'Bags, labels, pouches, sachets & stickers', type: 'PACKING_MATERIAL' },
      { code: '41-82', name: 'Bottles', desc: 'Bottles, cans, caps & tins', type: 'PACKING_MATERIAL' },
      { code: '41-83', name: 'Cartons', desc: 'Cartons and corrugated boxes', type: 'PACKING_MATERIAL' },
      { code: '41-84', name: 'Shrink', desc: 'Shrink wrapping and film rolls', type: 'PACKING_MATERIAL' },
      { code: '41-85', name: 'Tape', desc: 'Packaging tapes', type: 'PACKING_MATERIAL' },
      { code: '41-86', name: 'Glue', desc: 'Industrial adhesives & glues', type: 'PACKING_MATERIAL' },
      { code: '41-87', name: 'Others', desc: 'General, promotional & non-trade items', type: 'BOTH' },
    ];

    const categoryMap = {};
    for (const cat of categoryDefs) {
      const existing = await client.query('SELECT id FROM material_categories WHERE code = $1;', [cat.code]);
      if (existing.rows.length > 0) {
        categoryMap[cat.code] = existing.rows[0].id;
      } else {
        const id = randomUUID();
        await client.query(`
          INSERT INTO material_categories (id, "organizationId", code, name, description, "categoryType", status, "createdAt", "updatedAt")
          VALUES ($1, $2, $3, $4, $5, $6, 'ACTIVE', NOW(), NOW());
        `, [id, organizationId, cat.code, cat.name, cat.desc, cat.type]);
        categoryMap[cat.code] = id;
      }
    }
    console.log('Categories ready:', Object.keys(categoryMap));

    // 4. Ensure UOMs
    const uomMap = {};
    const existingUoms = await client.query('SELECT id, code, symbol FROM units_of_measure;');
    for (const u of existingUoms.rows) {
      if (u.symbol) uomMap[u.symbol.toUpperCase()] = u.id;
      if (u.code) uomMap[u.code.toUpperCase()] = u.id;
    }

    const requiredUoms = [
      { code: 'NOS', name: 'Numbers', category: 'COUNT', symbol: 'Nos', dec: 0, isBase: true },
      { code: 'KG', name: 'Kilogram', category: 'WEIGHT', symbol: 'KG', dec: 3, isBase: true },
      { code: 'LITER', name: 'Liter', category: 'VOLUME', symbol: 'L', dec: 3, isBase: true },
      { code: 'ML', name: 'Milliliter', category: 'VOLUME', symbol: 'ML', dec: 3, isBase: false },
      { code: 'GM', name: 'Gram', category: 'WEIGHT', symbol: 'gm', dec: 2, isBase: false },
      { code: 'PCS', name: 'Pieces', category: 'COUNT', symbol: 'Pcs', dec: 0, isBase: false },
      { code: 'ROLL', name: 'Roll', category: 'COUNT', symbol: 'Roll', dec: 0, isBase: false },
      { code: 'PU', name: 'Per Unit', category: 'COUNT', symbol: 'P/U', dec: 0, isBase: false },
    ];

    for (const req of requiredUoms) {
      const key = req.symbol.toUpperCase();
      if (!uomMap[key] && !uomMap[req.code]) {
        const id = randomUUID();
        await client.query(`
          INSERT INTO units_of_measure (id, "organizationId", code, name, category, symbol, "decimalPlaces", "isBaseUnit", status, "createdAt", "updatedAt")
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'ACTIVE', NOW(), NOW());
        `, [id, organizationId, req.code, req.name, req.category, req.symbol, req.dec, req.isBase]);
        uomMap[key] = id;
        uomMap[req.code] = id;
      }
    }

    const defaultUomId = uomMap['NOS'] || uomMap['PCS'] || Object.values(uomMap)[0];

    // 5. Parse all items
    const parsedItems = [];
    let currentSection = '01';
    let sectionCounters = { '01': 0, '02': 0, '03': 0, '04': 0, '05': 0 };

    for (const pageText of rawPages) {
      const lines = pageText.split('\n');
      for (let line of lines) {
        line = line.trim();
        if (!line) continue;
        if (line.startsWith('SECTION: 01')) { currentSection = '01'; continue; }
        if (line.startsWith('SECTION: 02')) { currentSection = '02'; continue; }
        if (line.startsWith('SECTION: 03')) { currentSection = '03'; continue; }
        if (line.startsWith('SECTION: 04')) { currentSection = '04'; continue; }
        if (line.startsWith('SECTION: 05')) { currentSection = '05'; continue; }

        const parts = line.split('\t');
        if (parts.length < 2) continue;

        const name = parts[0].trim();
        const packing = parseFloat(parts[1]) || 1.0;
        const unit = (parts[2] || 'Nos').trim();
        const ppc = parseInt(parts[3], 10) || 1;
        const urduName = parts[4] === '—' ? null : (parts[4] || null);
        const mType = parts[5] === '—' ? null : (parts[5] || null);
        const type = (parts[6] || (currentSection === '05' ? 'NT' : 'PM')).trim();
        const ts = (parts[7] || '').trim();

        sectionCounters[currentSection]++;
        const seq = String(sectionCounters[currentSection]).padStart(3, '0');

        let catCode = '41-81';
        let codePrefix = 'PM-01';

        if (currentSection === '01') {
          catCode = '41-81';
          codePrefix = 'PM-01';
        } else if (currentSection === '02') {
          catCode = '41-82';
          codePrefix = 'PM-02';
        } else if (currentSection === '03') {
          catCode = '41-83';
          codePrefix = 'PM-03';
        } else if (currentSection === '04') {
          catCode = name.toLowerCase().includes('glue') ? '41-86' : '41-84';
          codePrefix = 'PM-04';
        } else if (currentSection === '05') {
          catCode = '41-87';
          codePrefix = 'NT-05';
        }

        const materialCode = `${codePrefix}-${seq}`;

        parsedItems.push({
          materialCode,
          name,
          packing,
          unit,
          ppc,
          urduName,
          mType,
          type,
          ts,
          catCode,
          currentSection,
        });
      }
    }

    console.log(`Parsed ${parsedItems.length} total items from master document.`);

    // 6. Batch seed across companies
    let totalSeeded = 0;

    for (const comp of companies) {
      console.log(`Seeding ${parsedItems.length} items for company: ${comp.name}...`);
      
      // Use transaction for speed
      await client.query('BEGIN');

      for (const item of parsedItems) {
        const catId = categoryMap[item.catCode] || categoryMap['41-81'];
        const uomKey = item.unit.toUpperCase();
        const uomId = uomMap[uomKey] || defaultUomId;
        const customFields = JSON.stringify({
          section: item.currentSection,
          packing: item.packing,
          unit: item.unit,
          ppc: item.ppc,
          mType: item.mType,
          type: item.type,
          legacyTimestamp: item.ts,
        });

        const query = `
          INSERT INTO packing_materials (
            id,
            "organizationId",
            "companyId",
            "categoryId",
            "baseUomId",
            "purchaseUomId",
            "materialCode",
            "materialName",
            description,
            "packCompatibility",
            "batchControlled",
            "minimumStock",
            "maximumStock",
            "reorderLevel",
            status,
            "approvalStatus",
            "customFields",
            "createdAt",
            "updatedAt"
          )
          VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
            $11, $12, $13, $14, $15, $16, $17, NOW(), NOW()
          )
          ON CONFLICT ("companyId", "materialCode")
          DO UPDATE SET
            "materialName" = EXCLUDED."materialName",
            "categoryId" = EXCLUDED."categoryId",
            "baseUomId" = EXCLUDED."baseUomId",
            "purchaseUomId" = EXCLUDED."purchaseUomId",
            description = EXCLUDED.description,
            "packCompatibility" = EXCLUDED."packCompatibility",
            status = EXCLUDED.status,
            "approvalStatus" = EXCLUDED."approvalStatus",
            "customFields" = EXCLUDED."customFields",
            "updatedAt" = NOW();
        `;

        await client.query(query, [
          randomUUID(),
          organizationId,
          comp.id,
          catId,
          uomId,
          uomId,
          item.materialCode,
          item.name,
          `${item.name} (${item.mType || item.type}) - Spec: ${item.packing} ${item.unit}`,
          `${item.packing} ${item.unit}`,
          false,
          10,
          1000,
          20,
          'ACTIVE',
          'APPROVED',
          customFields,
        ]);
        totalSeeded++;
      }

      await client.query('COMMIT');
    }

    console.log(`\n🎉 DONE! Successfully seeded ${totalSeeded} packing and other items across ${companies.length} companies!`);

    // Verify
    const verifyPm = await client.query('SELECT COUNT(*) as total FROM packing_materials;');
    console.log(`Total records in packing_materials: ${verifyPm.rows[0].total}`);

  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('❌ Seeding error:', err);
    throw err;
  } finally {
    await client.end();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

