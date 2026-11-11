const { Client } = require('pg');
const connectionString = 'postgresql://shehswar_user:PHHDD5jvPcZsDCX2LH7mKrcO5GBtobti@dpg-dbc8moafngtc739dhgkg-a.oregon-postgres.render.com/shehswar_one360';

async function verify() {
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const total = await client.query('SELECT COUNT(*) FROM raw_materials WHERE "materialCode" LIKE \'41-51-%\';');
  console.log(`Total 41-51 items in DB: ${total.rows[0].count}`);

  const distinctCodes = await client.query('SELECT COUNT(DISTINCT "materialCode") FROM raw_materials WHERE "materialCode" LIKE \'41-51-%\';');
  console.log(`Distinct product codes: ${distinctCodes.rows[0].count}`);

  const sample = await client.query(`
    SELECT r."materialCode", r."materialName", r.grade, r.specifications, r."storageRequirements", r."purchaseConversionFactor", u.symbol as "baseUnit", pu.symbol as "purchaseUnit", c.name as "companyName", cat.name as "categoryName"
    FROM raw_materials r
    LEFT JOIN units_of_measure u ON r."baseUomId" = u.id
    LEFT JOIN units_of_measure pu ON r."purchaseUomId" = pu.id
    LEFT JOIN companies c ON r."companyId" = c.id
    LEFT JOIN material_categories cat ON r."categoryId" = cat.id
    WHERE r."materialCode" IN ('41-51-252', '41-51-201', '41-51-228', '41-51-248', '41-51-236')
    ORDER BY r."materialCode", c.name;
  `);

  console.log('Sample verified records:');
  console.table(sample.rows);

  await client.end();
}

verify().catch(console.error);

