async function testAuth() {
  const users = [
    { email: 'admin@shehswar.com', role: 'Super Admin' },
    { email: 'procurement.manager@shehswar.com', role: 'Procurement Manager' },
    { email: 'finance.manager@shehswar.com', role: 'Finance Manager' },
    { email: 'dept.user@shehswar.com', role: 'Department User' },
  ];

  console.log('=== 1. TESTING REAL AUTHENTICATION API (POST /api/v1/auth/login) ===\n');
  for (const u of users) {
    const res = await fetch('http://localhost:4000/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: u.email, password: 'Shehswar@2026!' }),
    });
    const json: any = await res.json();
    const token = json.data?.tokens?.accessToken;
    console.log(
      `[HTTP ${res.status}] ${u.role} (${u.email}):`,
      `\n  - Token Created: ${!!token}`,
      `\n  - Roles: ${JSON.stringify(json.data?.user?.roles)}`,
      `\n  - Permissions Count: ${json.data?.user?.permissions?.length}`,
      `\n  - Company: ${json.data?.user?.company?.name}`,
    );

    if (token) {
      // Test /api/v1/auth/me with Bearer token
      const meRes = await fetch('http://localhost:4000/api/v1/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const meJson: any = await meRes.json();
      console.log(
        `  - GET /auth/me: HTTP ${meRes.status} (Verified User: ${meJson.data?.email}, Session: ${meJson.data?.sessionId})\n`,
      );
    }
  }

  console.log('=== 2. TESTING INVALID CREDENTIALS ERROR HANDLING ===\n');
  const badRes = await fetch('http://localhost:4000/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@shehswar.com', password: 'wrongpassword' }),
  });
  const badJson: any = await badRes.json();
  console.log(`[HTTP ${badRes.status}] Invalid password response:`, badJson);

  console.log('\n=== 3. TESTING PROTECTED PROCUREMENT ENDPOINT WITHOUT TOKEN ===\n');
  const unauthRes = await fetch('http://localhost:4000/api/v1/procurement/vendors');
  const unauthJson: any = await unauthRes.json();
  console.log(`[HTTP ${unauthRes.status}] Protected vendors access without token:`, unauthJson);
}

testAuth();
