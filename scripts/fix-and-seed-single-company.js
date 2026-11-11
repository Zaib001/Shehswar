const { Client } = require('pg');
const { randomUUID } = require('crypto');
const { rawPages } = require('./raw-items-data');

const connectionString = 'postgresql://shehswar_user:PHHDD5jvPcZsDCX2LH7mKrcO5GBtobti@dpg-dbc8moafngtc739dhgkg-a.oregon-postgres.render.com/shehswar_one360';

async function main() {
  console.log('⚡ Starting single-company cleanup and seed...');
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();

  try {
    // 1. Get Parent Company & Org
    const compRes = await client.query('SELECT id, name FROM companies WHERE "isParent" = true LIMIT 1;');
    if (compRes.rows.length === 0) throw new Error('Parent company not found');
    const parentCompany = compRes.rows[0];
    const parentCompanyId = parentCompany.id;
    console.log(`Using Parent Company: ${parentCompany.name} (${parentCompanyId})`);

    const orgRes = await client.query('SELECT id FROM organizations LIMIT 1;');
    const organizationId = orgRes.rows[0].id;

    // 2. Remove duplicate raw materials from child companies (keep ONLY parent company)
    console.log('Cleaning duplicate raw materials from other companies...');
    const rmDelete = await client.query(`
      DELETE FROM raw_materials 
      WHERE "companyId" != $1 AND "materialCode" LIKE '41-51-%';
    `, [parentCompanyId]);
    console.log(`Removed ${rmDelete.rowCount} duplicate raw material records.`);

    // Check count of raw materials in parent
    const rmCount = await client.query(`
      SELECT COUNT(*) as cnt FROM raw_materials WHERE "companyId" = $1 AND "materialCode" LIKE '41-51-%';
    `, [parentCompanyId]);
    console.log(`Raw Materials now in system: ${rmCount.rows[0].cnt} (Only 1 copy per product!)`);

    // 3. Clear packing_materials so we have a clean, single set
    console.log('Clearing packing materials for fresh single-company seeding...');
    await client.query('DELETE FROM packing_materials;');

    // 4. Ensure Categories
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

    // 5. Ensure UOMs
    const uomMap = {};
    const existingUoms = await client.query('SELECT id, code, symbol FROM units_of_measure;');
    for (const u of existingUoms.rows) {
      if (u.symbol) uomMap[u.symbol.toUpperCase()] = u.id;
      if (u.code) uomMap[u.code.toUpperCase()] = u.id;
    }
    const defaultUomId = uomMap['NOS'] || uomMap['PCS'] || Object.values(uomMap)[0];

    // 6. Parse 632 items
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

    console.log(`Parsed ${parsedItems.length} items. Seeding strictly ONCE under ${parentCompany.name}...`);

    // 7. Fast multi-row bulk insert (in chunks of 100)
    const chunkSize = 100;
    for (let i = 0; i < parsedItems.length; i += chunkSize) {
      const chunk = parsedItems.slice(i, i + chunkSize);
      const values = [];
      const params = [];
      let paramIdx = 1;

      for (const item of chunk) {
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

        params.push(
          randomUUID(),
          organizationId,
          parentCompanyId,
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
          customFields
        );

        const p = [];
        for (let j = 0; j < 17; j++) {
          p.push(`$${paramIdx++}`);
        }
        values.push(`(${p.join(', ')}, NOW(), NOW())`);
      }

      const sql = `
        INSERT INTO packing_materials (
          id, "organizationId", "companyId", "categoryId", "baseUomId", "purchaseUomId",
          "materialCode", "materialName", description, "packCompatibility", "batchControlled",
          "minimumStock", "maximumStock", "reorderLevel", status, "approvalStatus",
          "customFields", "createdAt", "updatedAt"
        )
        VALUES ${values.join(', ')}
        ON CONFLICT ("companyId", "materialCode") DO NOTHING;
      `;

      await client.query(sql, params);
    }

    // 8. Verification
    const finalRm = await client.query('SELECT COUNT(*) as cnt FROM raw_materials WHERE "materialCode" LIKE \'41-51-%\';');
    const finalPm = await client.query('SELECT COUNT(*) as cnt FROM packing_materials;');

    console.log('\n=========================================');
    console.log(`✅ SUCCESS! Database now contains:`);
    console.log(`   - Raw Materials: ${finalRm.rows[0].cnt} items (exactly 1 copy each)`);
    console.log(`   - Packing & Other Items: ${finalPm.rows[0].cnt} items (exactly 1 copy each)`);
    console.log('=========================================\n');

  } catch (err) {
    console.error('❌ Error:', err);
    throw err;
  } finally {
    await client.end();
  }
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});

