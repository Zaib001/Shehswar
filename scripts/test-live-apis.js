const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const JWT_SECRET = 'shehswar_enterprise_jwt_access_super_secret_key_2026_dev_only';

async function main() {
  const allUsers = await prisma.user.findMany({
    where: { isActive: true },
    select: { id: true, email: true, organizationId: true, companyId: true, userRoles: { select: { role: { select: { code: true } } } } },
    take: 10,
  });
  console.log('Available users:');
  allUsers.forEach(u => console.log(`  • ${u.email} -> roles: ${u.userRoles.map(r => r.role.code).join(', ')}`));

  // Find user with superadmin or highest role
  const user = allUsers.find(u => u.userRoles.some(r => r.role.code.includes('ADMIN') || r.role.code.includes('FINANCE'))) || allUsers[0];

  if (!user) {
    console.error('No active user found in DB.');
    return;
  }

  console.log(`Authenticating as: ${user.email} (${user.id})`);

  // Ensure a valid user session exists
  let session = await prisma.userSession.findFirst({
    where: { userId: user.id, isRevoked: false, expiresAt: { gt: new Date() } },
  });

  if (!session) {
    const { v7: uuidv7 } = require('uuid');
    const crypto = require('crypto');
    session = await prisma.userSession.create({
      data: {
        id: uuidv7(),
        userId: user.id,
        tokenHash: crypto.randomBytes(32).toString('hex'),
        expiresAt: new Date(Date.now() + 24 * 3600 * 1000),
      },
    });
  }

  const token = jwt.sign(
    {
      sub: user.id,
      userId: user.id,
      email: user.email,
      sessionId: session.id,
      organizationId: user.organizationId,
      companyId: user.companyId,
    },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  console.log('\n--- 1. GROUP CONSOLIDATED REPORTING API ---');
  try {
    const res = await fetch('http://localhost:4000/api/v1/reporting/group?year=2026&month=10', { headers });
    const json = await res.json();
    console.log('Status:', res.status, 'Success:', json.success);
    if (json.data) {
      const summary = json.data.groupSummary || json.data.summary || json.data;
      console.log('Total Group Sales   : PKR', Number(summary.totalSales || 0).toLocaleString());
      console.log('Total Operating Exp : PKR', Number(summary.totalOperatingExpenses || summary.operatingExpenses || 0).toLocaleString());
      console.log('Net Profit          : PKR', Number(summary.netProfit || 0).toLocaleString());
      console.log('json.data keys:', Object.keys(json.data));
      const companyList = json.data.companies || json.data.companyReports || [];
      console.log(`Reporting Companies (${companyList.length}):`);
      companyList.forEach(c => {
        console.log(`  • ${c.companyName || c.company?.name || c.name}: Sales PKR ${(c.netSales || c.totalSales || 0).toLocaleString()} | Profit PKR ${(c.netProfit || c.operatingProfit || 0).toLocaleString()}`);
      });
    }
  } catch (e) {
    console.error('Reporting error:', e.message);
  }

  console.log('\n--- 2. CREDIT CONTROL DASHBOARD API ---');
  try {
    const res = await fetch('http://localhost:4000/api/v1/credit/dashboard?companyId=01a0f18d-8a7e-73f4-9306-5d5f6e3270fa', { headers });
    const json = await res.json();
    console.log('Status:', res.status, 'Success:', json.success);
    if (json.data) {
      console.log('Summary KPIs:', json.data.kpis);
      console.log('Dealers count:', json.data.dealers?.length);
      console.log('Sample Dealers:');
      json.data.dealers?.slice(0, 4).forEach(d => {
        console.log(`  • [${d.code}] ${d.name} -> Limit: PKR ${d.limit.toLocaleString()} | Exp: PKR ${d.exposure.toLocaleString()} | Status: ${d.status}`);
      });
    }
  } catch (e) {
    console.error('Credit error:', e.message);
  }

  console.log('\n--- 3. MASTER DATA COMPANIES API (Exact 5 Companies) ---');
  try {
    const res = await fetch('http://localhost:4000/api/v1/master-data/companies?all=true', { headers });
    const json = await res.json();
    console.log('Status:', res.status, 'Success:', json.success);
    const companies = json.data?.items || json.data || [];
    console.log(`Total Companies Returned: ${companies.length}`);
    companies.forEach(c => console.log(`  • [${c.code}] ${c.name} (isParent: ${c.isParent})`));
  } catch (e) {
    console.error('Companies error:', e.message);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
