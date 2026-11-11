const { Client } = require('pg');
const client = new Client({
  connectionString: 'postgresql://shehswar_user:PHHDD5jvPcZsDCX2LH7mKrcO5GBtobti@dpg-dbc8moafngtc739dhgkg-a.oregon-postgres.render.com/shehswar_one360',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  await client.connect();
  const pos = await client.query('SELECT id, "poNumber", "vendorId", "companyId", status, "totalAmount", "createdAt" FROM purchase_orders ORDER BY "createdAt" DESC LIMIT 10;');
  console.log('Purchase Orders count in DB:', pos.rows.length);
  console.log(JSON.stringify(pos.rows, null, 2));

  const purchases = await client.query('SELECT id, "invoiceNumber", "vendorId", "companyId", status, "netAmount", "createdAt" FROM purchases ORDER BY "createdAt" DESC LIMIT 5;');
  console.log('Purchases count in DB:', purchases.rows.length);
  console.log(JSON.stringify(purchases.rows, null, 2));
  await client.end();
}
run().catch(console.error);
