async function testFullApiIntegration() {
  console.log('🚀 Starting Comprehensive Phase 1-4 API Integration Verification...\n');

  // 1. Authenticate as Super Admin
  const authRes = await fetch('http://localhost:4000/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@shehswar.com', password: 'Shehswar@2026!' }),
  });
  const authData: any = await authRes.json();
  const token = authData.data?.tokens?.accessToken;
  const companyId = authData.data?.user?.companyId;

  if (!token) {
    console.error('❌ Failed to authenticate admin user');
    return;
  }
  console.log('✓ [Auth] Authenticated as admin@shehswar.com. Company ID:', companyId);

  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  const results: { module: string; endpoint: string; status: number; countOrId: any; passed: boolean }[] = [];

  async function checkEndpoint(module: string, endpoint: string, method: string = 'GET', body?: any) {
    try {
      const res = await fetch(`http://localhost:4000/api/v1${endpoint}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });
      const data: any = await res.json();
      const isSuccess = res.status >= 200 && res.status < 300;
      let countOrId = 'N/A';
      if (Array.isArray(data.data)) {
        countOrId = `${data.data.length} records`;
      } else if (data.data?.items && Array.isArray(data.data.items)) {
        countOrId = `${data.data.items.length} records (paginated)`;
      } else if (data.data?.id) {
        countOrId = `ID: ${data.data.id}`;
      } else if (data.data) {
        countOrId = typeof data.data === 'object' ? Object.keys(data.data).join(', ') : String(data.data);
      }
      results.push({ module, endpoint, status: res.status, countOrId, passed: isSuccess });
      console.log(`[${isSuccess ? 'PASS' : 'FAIL'}] [${res.status}] ${module.padEnd(20)} ${endpoint} -> ${countOrId}`);
      return data;
    } catch (err: any) {
      results.push({ module, endpoint, status: 500, countOrId: err.message, passed: false });
      console.log(`[FAIL] [ERR] ${module.padEnd(20)} ${endpoint} -> ${err.message}`);
      return null;
    }
  }

  console.log('\n--- PHASE 3: MASTER DATA & SYSTEM APIs ---');
  await checkEndpoint('Master Data', '/master-data/organizations');
  await checkEndpoint('Master Data', '/master-data/companies');
  await checkEndpoint('Master Data', '/master-data/plants');
  await checkEndpoint('Master Data', '/master-data/branches');
  await checkEndpoint('Master Data', '/master-data/departments');
  await checkEndpoint('Master Data', '/master-data/warehouses');
  await checkEndpoint('Master Data', '/master-data/users');
  await checkEndpoint('Master Data', '/master-data/roles');
  await checkEndpoint('Master Data', '/master-data/permissions');
  await checkEndpoint('Audit Logs', '/audit/logs');
  await checkEndpoint('Notifications', '/notifications');

  console.log('\n--- PHASE 4: PROCUREMENT APIs ---');
  await checkEndpoint('Vendors', '/procurement/vendors');
  await checkEndpoint('Vendor Performance', '/procurement/vendor-performance/scorecards');
  await checkEndpoint('Purchase Requisitions', '/procurement/purchase-requisitions');
  await checkEndpoint('RFQ', '/procurement/rfqs');
  await checkEndpoint('Quotations', '/procurement/quotations');
  await checkEndpoint('Purchase Orders', '/procurement/purchase-orders');
  await checkEndpoint('Goods Receipt Notes', '/procurement/goods-receipts');

  console.log('\n=== VERIFICATION SUMMARY ===');
  const passed = results.filter((r) => r.passed).length;
  console.log(`Total Endpoints Tested: ${results.length} | Passed: ${passed} | Failed: ${results.length - passed}`);
}

testFullApiIntegration();
