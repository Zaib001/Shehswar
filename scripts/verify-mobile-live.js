const https = require('https');

function request(url, options, postData) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on('error', reject);
    if (postData) req.write(JSON.stringify(postData));
    req.end();
  });
}

async function verify() {
  console.log('1. Testing Mobile Login (POST /api/mobile/auth/login)...');
  const loginRes = await request('https://shehswar-api.onrender.com/api/mobile/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    email: 'sales.officer@shehswar.com',
    password: 'Shehswar@2026!'
  });

  console.log('Login Status:', loginRes.status);
  const token = loginRes.body.data?.tokens?.accessToken || loginRes.body.accessToken || loginRes.body.token;
  if (!token) {
    console.error('Failed to get token:', loginRes.body);
    return;
  }
  console.log('✓ Token acquired successfully');

  console.log('\n2. Testing Mobile Authorized Dealers (GET /api/mobile/sales-officer/dealers)...');
  const dealersRes = await request('https://shehswar-api.onrender.com/api/mobile/sales-officer/dealers', {
    method: 'GET',
    headers: { 'Authorization': 'Bearer ' + token }
  });
  console.log('Dealers Status:', dealersRes.status);
  if (Array.isArray(dealersRes.body)) {
    console.log('Dealers Returned:', dealersRes.body.length);
    dealersRes.body.forEach(d => {
      console.log(`- [${d.code}] ${d.name} (${d.city}): Credit Limit: PKR ${d.creditLimit}, Outstanding: PKR ${d.currentOutstanding}, Available: PKR ${d.availableCredit}`);
    });
  } else {
    console.log('Dealers Response:', dealersRes.body);
  }

  console.log('\n3. Testing Mobile Products Catalog (GET /api/mobile/products)...');
  const prodsRes = await request('https://shehswar-api.onrender.com/api/mobile/products', {
    method: 'GET',
    headers: { 'Authorization': 'Bearer ' + token }
  });
  console.log('Products Status:', prodsRes.status);
  if (Array.isArray(prodsRes.body)) {
    console.log('Products Returned:', prodsRes.body.length);
    prodsRes.body.forEach(p => {
      console.log(`- [${p.productCode}] ${p.productName}: Seasonal Rate: PKR ${p.seasonalRate || p.defaultSellingPrice}, Total Stock: ${p.totalStock} bags`);
    });
  } else {
    console.log('Products Response:', prodsRes.body);
  }

  console.log('\n4. Testing Mobile Pricing Schemes (GET /api/mobile/pricing/schemes)...');
  const schemesRes = await request('https://shehswar-api.onrender.com/api/mobile/pricing/schemes', {
    method: 'GET',
    headers: { 'Authorization': 'Bearer ' + token }
  });
  console.log('Schemes Status:', schemesRes.status);
  if (Array.isArray(schemesRes.body)) {
    console.log('Schemes Returned:', schemesRes.body.length);
    schemesRes.body.forEach(s => {
      console.log(`- [${s.code}] ${s.name} (${s.schemeType})`);
    });
  } else {
    console.log('Schemes Response:', schemesRes.body);
  }
}

verify().catch(console.error);
