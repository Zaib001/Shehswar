/**
 * SHEHSWAR ONE360 - Executive Reports Export & Download Engine
 *
 * Professional Letterhead PDF & Excel/CSV Exports for:
 * 1. Employee Cost vs Sales Performance Report
 * 2. Cash & Bank Financial Transactions Report
 * 3. Credit Dashboard & 5-Tier Limits Report
 * 4. Percentage-Based Credit Report & Dynamic Lock States
 * 5. Order Control & Traceability Audit Report
 * 6. Group & Multi-Company Consolidated Drill-Down Report
 */
import { SHEHSWAR_LOGO_BASE64 } from './shehswar-logo-base64';

// Helper: Download CSV in browser
export function downloadCsv(filename: string, headers: string[], rows: (string | number | boolean | null | undefined)[][]) {
  const sanitize = (val: any) => {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const csvContent = [
    headers.map(sanitize).join(','),
    ...rows.map((row) => row.map(sanitize).join(',')),
  ].join('\r\n');

  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Helper: Open printable letterhead window
function openPrintWindow(title: string, bodyContent: string, isLandscape = true) {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Please allow popups to view and download the official PDF report.');
    return;
  }

  const generatedAt = new Date().toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <style>
    @page {
      size: ${isLandscape ? 'A4 landscape' : 'A4 portrait'};
      margin: 12mm 10mm 12mm 10mm;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    }
    body {
      background: #f8fafc;
      color: #0f172a;
      font-size: 8.5pt;
      line-height: 1.35;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .page-container {
      max-width: ${isLandscape ? '1120px' : '800px'};
      margin: 0 auto;
      background: #ffffff;
      padding: 16px 20px;
      box-shadow: 0 4px 16px rgba(0,0,0,0.06);
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2.5px solid #0d9488;
      padding-bottom: 12px;
      margin-bottom: 14px;
    }
    .logo-block {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .logo-img {
      height: 48px;
      width: auto;
      object-fit: contain;
    }
    .brand-title {
      font-size: 15pt;
      font-weight: 900;
      letter-spacing: -0.5px;
      color: #0f766e;
    }
    .brand-subtitle {
      font-size: 7.5pt;
      font-weight: 700;
      color: #475569;
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }
    .meta-block {
      text-align: right;
    }
    .report-name {
      font-size: 11pt;
      font-weight: 800;
      color: #0f172a;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }
    .meta-line {
      font-size: 8pt;
      color: #64748b;
      margin-top: 2px;
    }
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
      gap: 8px;
      margin-bottom: 14px;
    }
    .kpi-card {
      background: #f1f5f9;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 8px 10px;
    }
    .kpi-label {
      font-size: 7pt;
      font-weight: 700;
      color: #475569;
      text-transform: uppercase;
    }
    .kpi-value {
      font-size: 11pt;
      font-weight: 800;
      color: #0f172a;
      margin-top: 2px;
    }
    .data-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 16px;
      font-size: 8pt;
    }
    .data-table th {
      background: #0f766e;
      color: #ffffff;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.3px;
      padding: 6px 8px;
      text-align: left;
      border: 1px solid #0d9488;
    }
    .data-table th.num { text-align: right; }
    .data-table th.center { text-align: center; }
    .data-table td {
      padding: 5px 8px;
      border: 1px solid #e2e8f0;
      color: #1e293b;
    }
    .data-table td.num { text-align: right; font-variant-numeric: tabular-nums; }
    .data-table td.center { text-align: center; }
    .data-table tr:nth-child(even) { background-color: #f8fafc; }
    .badge {
      display: inline-block;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 7pt;
      font-weight: 700;
      text-transform: uppercase;
    }
    .badge-success { background: #dcfce7; color: #15803d; border: 1px solid #86efac; }
    .badge-warning { background: #fef3c7; color: #b45309; border: 1px solid #fde68a; }
    .badge-danger { background: #fee2e2; color: #b91c1c; border: 1px solid #fca5a5; }
    .badge-info { background: #e0f2fe; color: #0369a1; border: 1px solid #7dd3fc; }
    .badge-neutral { background: #f1f5f9; color: #475569; border: 1px solid #cbd5e1; }
    .footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-top: 1px solid #cbd5e1;
      padding-top: 10px;
      margin-top: 14px;
      font-size: 7.5pt;
      color: #64748b;
    }
    .signatures {
      display: flex;
      justify-content: space-between;
      margin-top: 28px;
      margin-bottom: 14px;
    }
    .sig-line {
      width: 170px;
      border-top: 1px dashed #64748b;
      padding-top: 4px;
      text-align: center;
      font-size: 7.5pt;
      font-weight: 600;
      color: #475569;
    }
    .notice {
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      border-radius: 4px;
      padding: 6px 10px;
      font-size: 7.5pt;
      color: #1e40af;
      margin-bottom: 12px;
    }
    @media print {
      body { background: #ffffff; }
      .page-container { box-shadow: none; padding: 0; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="page-container">
    <div class="header">
      <div class="logo-block">
        <img class="logo-img" src="${SHEHSWAR_LOGO_BASE64}" alt="Shehswar Logo" />
        <div>
          <div class="brand-title">SHEHSWAR GROUP</div>
          <div class="brand-subtitle">Enterprise ERP & Accounting Source of Truth</div>
        </div>
      </div>
      <div class="meta-block">
        <div class="report-name">${title}</div>
        <div class="meta-line">Generated: <strong>${generatedAt}</strong></div>
        <div class="meta-line">System: <strong>Shehswar ONE360 Core</strong></div>
      </div>
    </div>

    ${bodyContent}

    <div class="signatures">
      <div class="sig-line">Prepared By (Officer)</div>
      <div class="sig-line">Verified By (Accounts)</div>
      <div class="sig-line">Approved By (Management)</div>
    </div>

    <div class="footer">
      <div>Official Authoritative Ledger Output • Shehswar ONE360 ERP</div>
      <div>Confidential • For Internal Management Use Only</div>
    </div>
  </div>

  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
      }, 500);
    };
  </script>
</body>
</html>`;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}

const formatPkr = (val: number | null | undefined) => {
  if (val === null || val === undefined) return '0.00';
  return new Intl.NumberFormat('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val);
};

// =========================================================================
// 1. EMPLOYEE COST VS SALES PERFORMANCE REPORT
// =========================================================================
export function exportEmployeeCostReportPdf(data: {
  companyName: string;
  period?: string;
  summary: any;
  employees: any[];
}) {
  const sum = data.summary;
  const kpisHtml = `
    <div class="kpi-grid">
      <div class="kpi-card"><div class="kpi-label">Total Officers</div><div class="kpi-value">${sum?.totalEmployees ?? 0}</div></div>
      <div class="kpi-card"><div class="kpi-label">Net Sales (PKR)</div><div class="kpi-value">${formatPkr(sum?.totalSales)}</div></div>
      <div class="kpi-card"><div class="kpi-label">Posted Salaries</div><div class="kpi-value">${formatPkr(sum?.totalSalaries)}</div></div>
      <div class="kpi-card"><div class="kpi-label">Fuel Expenses</div><div class="kpi-value">${formatPkr(sum?.totalFuel)}</div></div>
      <div class="kpi-card"><div class="kpi-label">Other Expenses</div><div class="kpi-value">${formatPkr(sum?.totalOtherExpenses)}</div></div>
      <div class="kpi-card"><div class="kpi-label">Total Employee Cost</div><div class="kpi-value" style="color: #b91c1c;">${formatPkr(sum?.totalEmployeeCost)}</div></div>
      <div class="kpi-card"><div class="kpi-label">Average Cost %</div><div class="kpi-value">${sum?.averageCostPercentage ? sum.averageCostPercentage + '%' : '0%'}</div></div>
      <div class="kpi-card"><div class="kpi-label">Above Limit (13%)</div><div class="kpi-value" style="color: #b91c1c;">${sum?.employeesAboveLimit ?? 0}</div></div>
    </div>
  `;

  const rowsHtml = data.employees
    .map((e, idx) => {
      const badgeCls =
        e.status === 'WITHIN_LIMIT'
          ? 'badge-success'
          : e.status === 'NEAR_LIMIT'
          ? 'badge-warning'
          : e.status === 'LIMIT_REACHED'
          ? 'badge-info'
          : e.status === 'LIMIT_EXCEEDED'
          ? 'badge-danger'
          : 'badge-neutral';

      return `<tr>
        <td class="center">${idx + 1}</td>
        <td><strong>${e.name}</strong><br><span style="font-size: 7pt; color: #64748b;">${e.employeeCode}</span></td>
        <td>${e.territory}<br><span style="font-size: 7pt; color: #64748b;">${e.zone} / ${e.region}</span></td>
        <td class="num" style="color: #0369a1; font-weight: 700;">${formatPkr(e.sales)}</td>
        <td class="num">${formatPkr(e.salary)}</td>
        <td class="num">${formatPkr(e.fuel)}</td>
        <td class="num">${formatPkr(e.otherExpenses)}</td>
        <td class="num" style="color: #b91c1c; font-weight: 700;">${formatPkr(e.totalCost)}</td>
        <td class="center" style="font-weight: 700;">${e.costPercentage !== null ? e.costPercentage.toFixed(2) + '%' : 'N/A'}</td>
        <td class="center">${e.maximumCostPercentage ? e.maximumCostPercentage.toFixed(1) + '%' : '13.0%'}</td>
        <td class="num" style="color: ${e.remainingHeadroom < 0 ? '#b91c1c' : '#15803d'}; font-weight: 700;">${formatPkr(e.remainingHeadroom)}</td>
        <td class="center">${e.targetAchievementPercent ? e.targetAchievementPercent.toFixed(1) + '%' : '0.0%'}</td>
        <td class="center"><span class="badge ${badgeCls}">${e.status}</span></td>
      </tr>`;
    })
    .join('');

  const body = `
    <div class="notice">
      <strong>Company:</strong> ${data.companyName || 'Shehswar Agrochemicals'} &nbsp;|&nbsp;
      <strong>Reporting Period:</strong> ${data.period || 'All Time / Year-to-Date'} &nbsp;|&nbsp;
      <strong>Cost Policy:</strong> Maximum allowable cost ceiling = 13.00% &nbsp;|&nbsp;
      <strong>Asset Rule:</strong> Vehicle bearings & asset maintenance strictly isolated from employee cost.
    </div>
    ${kpisHtml}
    <table class="data-table">
      <thead>
        <tr>
          <th style="width: 25px;" class="center">#</th>
          <th>Sales Officer</th>
          <th>Territory / Region</th>
          <th class="num">Net Sales</th>
          <th class="num">Salary</th>
          <th class="num">Fuel</th>
          <th class="num">Other</th>
          <th class="num">Total Cost</th>
          <th class="center">Cost %</th>
          <th class="center">Max %</th>
          <th class="num">Headroom</th>
          <th class="center">Target Achv %</th>
          <th class="center">Status</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
    </table>
  `;

  openPrintWindow('Employee Cost vs Sales Performance Report', body, true);
}

export function exportEmployeeCostReportCsv(employees: any[], filename = 'Employee_Cost_vs_Sales_Report') {
  const headers = [
    'Employee Code',
    'Employee Name',
    'Role / Position',
    'Territory',
    'Zone',
    'Region',
    'Company',
    'Net Sales (PKR)',
    'Posted Salary (PKR)',
    'Approved Fuel (PKR)',
    'Other Expenses (PKR)',
    'Total Employee Cost (PKR)',
    'Employee Cost %',
    'Maximum Allowed %',
    'Remaining Headroom (PKR)',
    'Sales Target (PKR)',
    'Target Achievement %',
    'Credit Limit (PKR)',
    'Credit Exposure (PKR)',
    'Credit Status',
    'Cost Status',
  ];

  const rows = employees.map((e) => [
    e.employeeCode,
    e.name,
    e.position,
    e.territory,
    e.zone,
    e.region,
    e.companyName,
    e.sales,
    e.salary,
    e.fuel,
    e.otherExpenses,
    e.totalCost,
    e.costPercentage !== null ? e.costPercentage : 'N/A',
    e.maximumCostPercentage,
    e.remainingHeadroom,
    e.salesTarget,
    e.targetAchievementPercent,
    e.creditLimit,
    e.creditExposure,
    e.creditStatus,
    e.status,
  ]);

  downloadCsv(filename, headers, rows);
}

// =========================================================================
// 2. CASH & BANK FINANCIAL TRANSACTIONS REPORT
// =========================================================================
export function exportCashBankReportPdf(data: {
  companyName: string;
  summary: any;
  vouchers: any[];
}) {
  const sum = data.summary;
  const kpisHtml = `
    <div class="kpi-grid">
      <div class="kpi-card"><div class="kpi-label">Cash on Hand</div><div class="kpi-value">${formatPkr(sum?.cashBalance)}</div></div>
      <div class="kpi-card"><div class="kpi-label">Bank Balance</div><div class="kpi-value">${formatPkr(sum?.bankBalance)}</div></div>
      <div class="kpi-card"><div class="kpi-label">Total Collections</div><div class="kpi-value" style="color: #15803d;">${formatPkr(sum?.totalCollections)}</div></div>
      <div class="kpi-card"><div class="kpi-label">Unallocated PR</div><div class="kpi-value" style="color: #b45309;">${formatPkr(sum?.unallocatedPr)}</div></div>
    </div>
  `;

  const rowsHtml = (data.vouchers || [])
    .slice(0, 150)
    .map((v, idx) => {
      return `<tr>
        <td class="center">${idx + 1}</td>
        <td><strong>${v.voucherNumber || v.receiptNumber || 'VCH-' + idx}</strong></td>
        <td>${new Date(v.voucherDate || v.receiptDate || v.createdAt).toLocaleDateString()}</td>
        <td><span class="badge badge-info">${v.transactionType || v.paymentMethod || 'FINANCIAL'}</span></td>
        <td>${v.partyName || v.dealer?.name || 'M/S Cash Counter'}</td>
        <td>${v.bankAccount?.accountName || v.paymentMethod || 'General Ledger'}</td>
        <td class="num" style="font-weight: 700; color: #0f172a;">${formatPkr(v.amount || v.totalAmount)}</td>
        <td class="center"><span class="badge badge-success">${v.status || 'POSTED'}</span></td>
        <td>${v.remarks || v.narration || 'General transaction'}</td>
      </tr>`;
    })
    .join('');

  const body = `
    <div class="notice">
      <strong>Company:</strong> ${data.companyName || 'All Companies Consolidated'} &nbsp;|&nbsp;
      <strong>Module:</strong> Cash & Bank Control, 5 Financial Voucher Types, Direct General Ledger Postings
    </div>
    ${kpisHtml}
    <table class="data-table">
      <thead>
        <tr>
          <th style="width: 25px;" class="center">#</th>
          <th>Voucher #</th>
          <th>Date</th>
          <th>Type</th>
          <th>Party / Customer</th>
          <th>Account / Bank</th>
          <th class="num">Amount (PKR)</th>
          <th class="center">Status</th>
          <th>Remarks / Narration</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
    </table>
  `;

  openPrintWindow('Cash & Bank Financial Transactions Report', body, true);
}

export function exportCashBankReportCsv(vouchers: any[], filename = 'Cash_Bank_Vouchers_Report') {
  const headers = ['Voucher Number', 'Date', 'Type', 'Party Name', 'Account / Method', 'Amount (PKR)', 'Status', 'Narration'];
  const rows = (vouchers || []).map((v) => [
    v.voucherNumber || v.receiptNumber,
    new Date(v.voucherDate || v.receiptDate || v.createdAt).toISOString().split('T')[0],
    v.transactionType || v.paymentMethod,
    v.partyName || v.dealer?.name,
    v.bankAccount?.accountName || v.paymentMethod,
    v.amount || v.totalAmount,
    v.status || 'POSTED',
    v.remarks || v.narration,
  ]);
  downloadCsv(filename, headers, rows);
}

// =========================================================================
// 3. CREDIT DASHBOARD & 5-TIER LIMITS REPORT
// =========================================================================
export function exportCreditDashboardReportPdf(data: {
  companyName: string;
  summary: any;
  dealers: any[];
}) {
  const sum = data.summary;
  const kpisHtml = `
    <div class="kpi-grid">
      <div class="kpi-card"><div class="kpi-label">Total Credit Limit</div><div class="kpi-value">${formatPkr(sum?.totalCreditLimit ?? sum?.totalLimit)}</div></div>
      <div class="kpi-card"><div class="kpi-label">Current Exposure</div><div class="kpi-value" style="color: #b45309;">${formatPkr(sum?.totalCreditExposure ?? sum?.totalExposure)}</div></div>
      <div class="kpi-card"><div class="kpi-label">Available Credit</div><div class="kpi-value" style="color: #15803d;">${formatPkr(sum?.availableCredit)}</div></div>
      <div class="kpi-card"><div class="kpi-label">Utilization %</div><div class="kpi-value">${sum?.utilizationPercent ?? 0}%</div></div>
      <div class="kpi-card"><div class="kpi-label">Credit Hold Count</div><div class="kpi-value" style="color: #b91c1c;">${sum?.creditHoldAccountsCount ?? 0}</div></div>
    </div>
  `;

  const rowsHtml = (data.dealers || [])
    .slice(0, 150)
    .map((d, idx) => {
      const statusBadge =
        d.status === 'WITHIN_LIMIT' ? 'badge-success' : d.status === 'NEAR_LIMIT' ? 'badge-warning' : 'badge-danger';
      return `<tr>
        <td class="center">${idx + 1}</td>
        <td><strong>${d.dealerName || d.name}</strong><br><span style="font-size: 7pt; color: #64748b;">${d.dealerCode || d.code}</span></td>
        <td>${d.territoryName || d.territory?.name || 'Main Territory'}</td>
        <td>${d.officerName || d.assignedFieldOfficer?.name || 'Field Officer'}</td>
        <td class="num">${formatPkr(d.limit || d.creditLimit)}</td>
        <td class="num" style="color: #b45309; font-weight: 700;">${formatPkr(d.currentExposure || d.currentBalance)}</td>
        <td class="num" style="color: #15803d; font-weight: 700;">${formatPkr(d.availableCredit)}</td>
        <td class="center">${d.utilizationPercent ? d.utilizationPercent + '%' : '0%'}</td>
        <td class="center"><span class="badge ${statusBadge}">${d.status || (d.isLocked ? 'CREDIT_HOLD' : 'OK')}</span></td>
      </tr>`;
    })
    .join('');

  const body = `
    <div class="notice">
      <strong>Company:</strong> ${data.companyName || 'Consolidated'} &nbsp;|&nbsp;
      <strong>Module:</strong> 5-Tier Credit Architecture (Dealer → Sales Officer → Territory → Zone → Region)
    </div>
    ${kpisHtml}
    <table class="data-table">
      <thead>
        <tr>
          <th style="width: 25px;" class="center">#</th>
          <th>Dealer Account</th>
          <th>Territory</th>
          <th>Assigned Officer</th>
          <th class="num">Credit Limit</th>
          <th class="num">Current Exposure</th>
          <th class="num">Available Credit</th>
          <th class="center">Util %</th>
          <th class="center">Credit Status</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
    </table>
  `;

  openPrintWindow('Credit Control & 5-Tier Limits Report', body, true);
}

export function exportCreditDashboardReportCsv(dealers: any[], filename = 'Credit_Limits_and_Exposure_Report') {
  const headers = ['Dealer Code', 'Dealer Name', 'Territory', 'Officer', 'Credit Limit (PKR)', 'Current Exposure (PKR)', 'Available Credit (PKR)', 'Utilization %', 'Status'];
  const rows = (dealers || []).map((d) => [
    d.dealerCode || d.code,
    d.dealerName || d.name,
    d.territoryName || d.territory?.name,
    d.officerName || d.assignedFieldOfficer?.name,
    d.limit || d.creditLimit,
    d.currentExposure || d.currentBalance,
    d.availableCredit,
    d.utilizationPercent || 0,
    d.status || (d.isLocked ? 'CREDIT_HOLD' : 'OK'),
  ]);
  downloadCsv(filename, headers, rows);
}

// =========================================================================
// 4. PERCENTAGE CREDIT REPORT & DYNAMIC LOCK STATES
// =========================================================================
export function exportPercentageCreditReportPdf(data: {
  companyName: string;
  summary: any;
  items: any[];
}) {
  const sum = data.summary;
  const kpisHtml = `
    <div class="kpi-grid">
      <div class="kpi-card"><div class="kpi-label">Monitored Accounts</div><div class="kpi-value">${sum?.totalDealers ?? 0}</div></div>
      <div class="kpi-card"><div class="kpi-label">Net Sales (PKR)</div><div class="kpi-value">${formatPkr(sum?.totalSales)}</div></div>
      <div class="kpi-card"><div class="kpi-label">Posted Collections</div><div class="kpi-value" style="color: #15803d;">${formatPkr(sum?.totalCollections)}</div></div>
      <div class="kpi-card"><div class="kpi-label">Outstanding Credit</div><div class="kpi-value" style="color: #b45309;">${formatPkr(sum?.totalOutstanding)}</div></div>
      <div class="kpi-card"><div class="kpi-label">Overall Credit %</div><div class="kpi-value">${sum?.overallCreditPercentage ?? 0}%</div></div>
      <div class="kpi-card"><div class="kpi-label">Locked Accounts</div><div class="kpi-value" style="color: #b91c1c;">${sum?.creditLockCount ?? 0}</div></div>
    </div>
  `;

  const rowsHtml = (data.items || [])
    .map((item, idx) => {
      const badgeCls = item.status === 'CREDIT_LOCK' ? 'badge-danger' : item.status === 'NEAR_LIMIT' ? 'badge-warning' : 'badge-success';
      return `<tr>
        <td class="center">${idx + 1}</td>
        <td><strong>${item.dealerName}</strong><br><span style="font-size: 7pt; color: #64748b;">${item.dealerCode}</span></td>
        <td>${item.officerName}<br><span style="font-size: 7pt; color: #64748b;">${item.territoryName} • ${item.regionName}</span></td>
        <td class="num" style="color: #0369a1; font-weight: 700;">${formatPkr(item.netSales)}</td>
        <td class="num" style="color: #15803d;">${formatPkr(item.collections)}</td>
        <td class="num" style="color: #b45309; font-weight: 700;">${formatPkr(item.outstandingCredit)}</td>
        <td class="center" style="font-weight: 800;">${item.creditPercentage.toFixed(2)}%</td>
        <td class="center">${item.maxCreditPercentage.toFixed(1)}%</td>
        <td class="num" style="color: #15803d;">${formatPkr(item.availableCredit)}</td>
        <td class="center"><span class="badge ${badgeCls}">${item.status === 'CREDIT_LOCK' ? 'CREDIT LOCK' : item.status}</span></td>
      </tr>`;
    })
    .join('');

  const body = `
    <div class="notice">
      <strong>Company:</strong> ${data.companyName || 'Consolidated'} &nbsp;|&nbsp;
      <strong>Rule:</strong> Credit % = Outstanding Credit / Net Sales × 100 &nbsp;|&nbsp;
      <strong>Dynamic Unlock:</strong> Accounts auto-release from CREDIT_LOCK immediately upon posting collections.
    </div>
    ${kpisHtml}
    <table class="data-table">
      <thead>
        <tr>
          <th style="width: 25px;" class="center">#</th>
          <th>Dealer Account</th>
          <th>Sales Officer / Territory</th>
          <th class="num">Net Sales</th>
          <th class="num">Collections</th>
          <th class="num">Outstanding Credit</th>
          <th class="center">Credit %</th>
          <th class="center">Max %</th>
          <th class="num">Available Credit</th>
          <th class="center">Status</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
    </table>
  `;

  openPrintWindow('Percentage-Based Credit Control & Dynamic Lock Report', body, true);
}

export function exportPercentageCreditReportCsv(items: any[], filename = 'Percentage_Credit_Report') {
  const headers = ['Dealer Code', 'Dealer Name', 'Sales Officer', 'Territory', 'Region', 'Net Sales (PKR)', 'Collections (PKR)', 'Outstanding Credit (PKR)', 'Credit %', 'Max Allowed %', 'Available Credit (PKR)', 'Status'];
  const rows = (items || []).map((i) => [
    i.dealerCode,
    i.dealerName,
    i.officerName,
    i.territoryName,
    i.regionName,
    i.netSales,
    i.collections,
    i.outstandingCredit,
    i.creditPercentage,
    i.maxCreditPercentage,
    i.availableCredit,
    i.status,
  ]);
  downloadCsv(filename, headers, rows);
}

// =========================================================================
// 5. ORDER CONTROL & TRACEABILITY AUDIT REPORT
// =========================================================================
export function exportOrderControlAuditReportPdf(data: {
  companyName: string;
  summary: any;
  orders: any[];
}) {
  const sum = data.summary;
  const kpisHtml = `
    <div class="kpi-grid">
      <div class="kpi-card"><div class="kpi-label">Total Orders</div><div class="kpi-value">${sum?.totalOrders ?? (data.orders || []).length}</div></div>
      <div class="kpi-card"><div class="kpi-label">Approved Orders</div><div class="kpi-value" style="color: #15803d;">${sum?.approvedOrders ?? 0}</div></div>
      <div class="kpi-card"><div class="kpi-label">Credit Hold</div><div class="kpi-value" style="color: #b91c1c;">${sum?.creditHoldOrders ?? 0}</div></div>
      <div class="kpi-card"><div class="kpi-label">Converted to Invoice</div><div class="kpi-value" style="color: #0369a1;">${sum?.convertedOrders ?? 0}</div></div>
    </div>
  `;

  const rowsHtml = (data.orders || [])
    .slice(0, 150)
    .map((o, idx) => {
      const badgeCls =
        o.orderStatus === 'APPROVED' || o.postingStatus === 'POSTED'
          ? 'badge-success'
          : o.orderStatus === 'CREDIT_HOLD'
          ? 'badge-danger'
          : 'badge-info';
      return `<tr>
        <td class="center">${idx + 1}</td>
        <td><strong>${o.orderNumber || 'SO-' + idx}</strong></td>
        <td>${new Date(o.orderDate || o.createdAt).toLocaleDateString()}</td>
        <td>${o.dealer?.name || o.dealerName || 'Customer'}</td>
        <td>${o.salesOfficer?.name || o.salesOfficerName || 'Field Officer'}</td>
        <td class="num" style="font-weight: 700;">${formatPkr(o.totalAmount || o.netAmount)}</td>
        <td class="center"><span class="badge ${badgeCls}">${o.orderStatus || o.status}</span></td>
        <td>${o.invoices?.length ? o.invoices.map((inv: any) => inv.invoiceNumber).join(', ') : 'Not Dispatched'}</td>
        <td>${o.notes || o.remarks || 'Standard Sales Order'}</td>
      </tr>`;
    })
    .join('');

  const body = `
    <div class="notice">
      <strong>Company:</strong> ${data.companyName || 'Consolidated'} &nbsp;|&nbsp;
      <strong>Lifecycle:</strong> Order → Credit Gate → Approval → Dispatch Gate Pass → Invoice → GL Journal Impact
    </div>
    ${kpisHtml}
    <table class="data-table">
      <thead>
        <tr>
          <th style="width: 25px;" class="center">#</th>
          <th>Order #</th>
          <th>Date</th>
          <th>Dealer Customer</th>
          <th>Sales Officer</th>
          <th class="num">Net Amount (PKR)</th>
          <th class="center">Lifecycle Status</th>
          <th>Downstream Invoices</th>
          <th>Traceability Notes</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
    </table>
  `;

  openPrintWindow('Order Control & Traceability Audit Report', body, true);
}

export function exportOrderControlAuditReportCsv(orders: any[], filename = 'Order_Control_Traceability_Report') {
  const headers = ['Order Number', 'Date', 'Dealer Name', 'Sales Officer', 'Net Amount (PKR)', 'Status', 'Invoices', 'Notes'];
  const rows = (orders || []).map((o) => [
    o.orderNumber,
    new Date(o.orderDate || o.createdAt).toISOString().split('T')[0],
    o.dealer?.name || o.dealerName,
    o.salesOfficer ? `${o.salesOfficer.firstName} ${o.salesOfficer.lastName}` : o.salesOfficerName || 'Direct',
    o.totalAmount || o.netAmount,
    o.orderStatus || o.status,
    o.salesInvoices?.length ? o.salesInvoices.map((inv: any) => inv.invoiceNumber).join(';') : '',
    o.notes || o.remarks,
  ]);
  downloadCsv(filename, headers, rows);
}

const renderHeader = (title: string, companyName: string, subtitle?: string) => `
  <div class="notice">
    <strong>${title}</strong> &nbsp;|&nbsp; <strong>Company:</strong> ${companyName || 'Consolidated'}
    ${subtitle ? ` &nbsp;|&nbsp; <em>${subtitle}</em>` : ''}
  </div>
`;

// 5b. SALES AUDIT LIFECYCLE REPORT
export function exportSalesAuditReportPdf(data: {
  companyName: string;
  invoices: any[];
}) {
  const rowsHtml = (data.invoices || []).map((inv, idx) => `
    <tr>
      <td class="center">${idx + 1}</td>
      <td style="font-weight: 700; color: #0284c7;">${inv.invoiceNumber}</td>
      <td>${new Date(inv.invoiceDate).toLocaleDateString()}</td>
      <td><strong>${inv.dealer?.name || '-'}</strong><br/><span style="font-size: 7.5pt; color: #64748b;">${inv.region?.name || ''} • ${inv.territory?.name || ''}</span></td>
      <td>${inv.salesOfficer ? `${inv.salesOfficer.firstName} ${inv.salesOfficer.lastName}` : 'Direct'}</td>
      <td class="right" style="font-weight: 800; color: #0f172a;">${formatPkr(inv.netAmount)}</td>
      <td class="center"><span class="badge ${inv.postingStatus === 'POSTED' ? 'badge-success' : 'badge-warning'}">${inv.postingStatus || 'POSTED'}</span></td>
      <td class="center">${inv.dealerLedgerEntries?.length || 0} Ledger / ${inv.stockLedgerEntries?.length || 0} Stock</td>
    </tr>
  `).join('');

  const body = `
    ${renderHeader('Sales Audit Register & Lifecycle Trace', data.companyName, 'Full Transaction Trace: Order → Dispatch → Invoice → Stock → Ledger')}
    <table class="report-table">
      <thead>
        <tr>
          <th class="center" style="width: 30px;">#</th>
          <th>Invoice #</th>
          <th>Date</th>
          <th>Dealer & Area</th>
          <th>Sales Officer</th>
          <th class="right">Net Sales (PKR)</th>
          <th class="center">Posting Status</th>
          <th class="center">Audit Consequence</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
    </table>
  `;

  openPrintWindow('Sales Audit Register Report', body, true);
}

export function exportSalesAuditReportCsv(invoices: any[], filename = 'Sales_Audit_Trace_Report') {
  const headers = ['Invoice #', 'Date', 'Dealer Code', 'Dealer Name', 'Region', 'Territory', 'Sales Officer', 'Net Amount (PKR)', 'Posting Status'];
  const rows = (invoices || []).map((inv) => [
    inv.invoiceNumber,
    new Date(inv.invoiceDate).toISOString().split('T')[0],
    inv.dealer?.code || '',
    inv.dealer?.name || '',
    inv.region?.name || '',
    inv.territory?.name || '',
    inv.salesOfficer ? `${inv.salesOfficer.firstName} ${inv.salesOfficer.lastName}` : 'Direct',
    inv.netAmount,
    inv.postingStatus || 'POSTED',
  ]);
  downloadCsv(filename, headers, rows);
}

// 5c. PURCHASE AUDIT LIFECYCLE REPORT
export function exportPurchaseAuditReportPdf(data: {
  companyName: string;
  purchases: any[];
}) {
  const rowsHtml = (data.purchases || []).map((pur, idx) => `
    <tr>
      <td class="center">${idx + 1}</td>
      <td style="font-weight: 700; color: #7c3aed;">${pur.invoiceNumber}</td>
      <td>${new Date(pur.date).toLocaleDateString()}</td>
      <td><strong>${pur.vendor?.name || '-'}</strong> (${pur.vendor?.code || ''})</td>
      <td>${pur.warehouse?.name || 'Central Warehouse'}</td>
      <td class="right" style="font-weight: 800; color: #0f172a;">${formatPkr(pur.totalAmount)}</td>
      <td class="center"><span class="badge ${pur.status === 'POSTED' ? 'badge-success' : 'badge-warning'}">${pur.status || 'POSTED'}</span></td>
      <td class="center">${pur.stockLedgerEntries?.length || 0} Inward / ${pur.vendorLedgerEntries?.length || 0} Vendor AP</td>
    </tr>
  `).join('');

  const body = `
    ${renderHeader('Purchase & Procurement Audit Trace', data.companyName, 'Full Procurement Trace: Supplier PO → Inward GRN → Vendor Invoice → Stock Addition → Liability')}
    <table class="report-table">
      <thead>
        <tr>
          <th class="center" style="width: 30px;">#</th>
          <th>Purchase Invoice #</th>
          <th>Date</th>
          <th>Vendor / Supplier</th>
          <th>Target Warehouse</th>
          <th class="right">Total Liability (PKR)</th>
          <th class="center">Status</th>
          <th class="center">Accounting Impact</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
    </table>
  `;

  openPrintWindow('Purchase Procurement Audit Report', body, true);
}

export function exportPurchaseAuditReportCsv(purchases: any[], filename = 'Purchase_Procurement_Audit_Report') {
  const headers = ['Purchase Invoice #', 'Date', 'Vendor Code', 'Vendor Name', 'Warehouse', 'Total Amount (PKR)', 'Status'];
  const rows = (purchases || []).map((pur) => [
    pur.invoiceNumber,
    new Date(pur.date).toISOString().split('T')[0],
    pur.vendor?.code || '',
    pur.vendor?.name || '',
    pur.warehouse?.name || '',
    pur.totalAmount,
    pur.status || 'POSTED',
  ]);
  downloadCsv(filename, headers, rows);
}

// 5d. PAYMENT & COLLECTION AUDIT REPORT
export function exportPaymentAuditReportPdf(data: {
  companyName: string;
  payments: any[];
}) {
  const rowsHtml = (data.payments || []).map((pay, idx) => `
    <tr>
      <td class="center">${idx + 1}</td>
      <td style="font-weight: 700; color: #16a34a;">${pay.receiptNumber}</td>
      <td>${new Date(pay.paymentDate).toLocaleDateString()}</td>
      <td><strong>${pay.dealer?.name || '-'}</strong> (${pay.dealer?.code || ''})</td>
      <td>${pay.salesOfficer ? `${pay.salesOfficer.firstName} ${pay.salesOfficer.lastName}` : 'Direct'}</td>
      <td class="center"><span class="badge badge-secondary">${pay.paymentMethod || 'BANK'}</span></td>
      <td class="right" style="font-weight: 800; color: #16a34a;">${formatPkr(pay.amount)}</td>
      <td class="center">${pay.ledgerEntries?.length || 0} Ledger Dr/Cr</td>
    </tr>
  `).join('');

  const body = `
    ${renderHeader('Payment & Dealer Collection Audit', data.companyName, 'Authoritative Treasury Collection Audit: Cash/Bank Receipts, Bank Cheques & AR Credit Offsets')}
    <table class="report-table">
      <thead>
        <tr>
          <th class="center" style="width: 30px;">#</th>
          <th>Receipt / Instrument #</th>
          <th>Payment Date</th>
          <th>Dealer Account</th>
          <th>Collection Officer</th>
          <th class="center">Method</th>
          <th class="right">Amount Collected (PKR)</th>
          <th class="center">Ledger Impact</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
    </table>
  `;

  openPrintWindow('Payment Collection Audit Report', body, true);
}

export function exportPaymentAuditReportCsv(payments: any[], filename = 'Payment_Collection_Audit_Report') {
  const headers = ['Receipt #', 'Date', 'Dealer Code', 'Dealer Name', 'Sales Officer', 'Method', 'Amount (PKR)'];
  const rows = (payments || []).map((pay) => [
    pay.receiptNumber,
    new Date(pay.paymentDate).toISOString().split('T')[0],
    pay.dealer?.code || '',
    pay.dealer?.name || '',
    pay.salesOfficer ? `${pay.salesOfficer.firstName} ${pay.salesOfficer.lastName}` : 'Direct',
    pay.paymentMethod || 'BANK',
    pay.amount,
  ]);
  downloadCsv(filename, headers, rows);
}

// =========================================================================
// 6. GROUP & REGIONAL CONSOLIDATED DRILL-DOWN REPORT
// =========================================================================
export function exportConsolidatedDrillDownReportPdf(data: {
  scopeTitle: string;
  period: string;
  reportData: any;
  breadcrumbs?: any[];
}) {
  const rep = data.reportData || {};
  const rows =
    rep.companies ||
    rep.regions ||
    rep.zones ||
    rep.territories ||
    rep.dealers ||
    rep.childEntities ||
    rep.entities ||
    rep.breakdown ||
    rep.items ||
    [];

  const sum = rep.summary || rep.kpis || rep.totals || {};
  const totalSales = sum.totalSales ?? rep.netSales ?? rep.grossSales ?? 0;
  const totalCollections = sum.totalCollections ?? rep.collections ?? 0;
  const totalOutstanding = sum.totalOutstanding ?? rep.outstandingCredit ?? 0;
  const totalLimit = sum.totalCreditLimit ?? rep.creditLimit ?? 0;
  const availCredit = sum.availableCredit ?? (totalLimit - totalOutstanding);
  const netProfit = sum.netProfit ?? rep.grossProfit ?? 0;

  const kpisHtml = `
    <div class="kpi-grid">
      <div class="kpi-card"><div class="kpi-label">Gross / Net Sales</div><div class="kpi-value" style="color: #0369a1;">${formatPkr(totalSales)}</div></div>
      <div class="kpi-card"><div class="kpi-label">Collections Received</div><div class="kpi-value" style="color: #15803d; font-weight: 900;">${formatPkr(totalCollections)}</div></div>
      <div class="kpi-card"><div class="kpi-label">Outstanding Exposure</div><div class="kpi-value" style="color: #b45309;">${formatPkr(totalOutstanding)}</div></div>
      <div class="kpi-card"><div class="kpi-label">Total Credit Limit</div><div class="kpi-value">${formatPkr(totalLimit)}</div></div>
      <div class="kpi-card"><div class="kpi-label">Available Headroom</div><div class="kpi-value" style="color: #15803d;">${formatPkr(availCredit)}</div></div>
      <div class="kpi-card"><div class="kpi-label">Operating Margin / Profit</div><div class="kpi-value" style="color: #15803d;">${formatPkr(netProfit)}</div></div>
    </div>
  `;

  const rowsHtml = rows
    .map((r: any, idx: number) => {
      const name = r.name || r.title || r.company?.name || r.dealer?.name || 'Item ' + (idx + 1);
      const sub = r.code || r.businessManager || r.areaManager || r.salesOfficer || r.level || '';
      const sales = r.sales ?? r.netSales ?? r.totalSales ?? r.summary?.totalSales ?? 0;
      const collections = r.collections ?? r.summary?.totalCollections ?? 0;
      const outstanding = r.outstanding ?? r.outstandingCredit ?? r.summary?.totalOutstanding ?? 0;
      const limit = r.creditLimit ?? r.limit ?? r.summary?.totalCreditLimit ?? 0;
      const avail = r.availableCredit ?? r.summary?.availableCredit ?? (limit - outstanding);

      return `<tr>
        <td class="center">${idx + 1}</td>
        <td><strong>${name}</strong>${sub ? `<br><span style="font-size: 7pt; color: #64748b;">${sub}</span>` : ''}</td>
        <td class="num" style="color: #0369a1; font-weight: 700;">${formatPkr(sales)}</td>
        <td class="num" style="color: #15803d; font-weight: 600;">${formatPkr(collections)}</td>
        <td class="num" style="color: #b45309; font-weight: 700;">${formatPkr(outstanding)}</td>
        <td class="num">${formatPkr(limit)}</td>
        <td class="num" style="color: ${avail < 0 ? '#b91c1c' : '#15803d'}; font-weight: 700;">${formatPkr(avail)}</td>
        <td class="center"><span class="badge ${avail > 0 ? 'badge-success' : 'badge-danger'}">${avail > 0 ? 'Active' : 'Credit Hold'}</span></td>
      </tr>`;
    })
    .join('');

  const breadcrumbsTrail = (data.breadcrumbs || []).map((b) => b.name).join(' → ');

  const body = `
    <div class="notice">
      <strong>Hierarchy Scope:</strong> ${data.scopeTitle || 'Shehswar Group Consolidated'} &nbsp;|&nbsp;
      <strong>Period:</strong> ${data.period || 'Current Fiscal Period'} &nbsp;|&nbsp;
      <strong>Path:</strong> ${breadcrumbsTrail || 'Consolidated Group Root'}
    </div>
    ${kpisHtml}
    <table class="data-table">
      <thead>
        <tr>
          <th style="width: 25px;" class="center">#</th>
          <th>Subordinate Unit / Entity</th>
          <th class="num">Net Sales</th>
          <th class="num">Collections</th>
          <th class="num">Outstanding Exposure</th>
          <th class="num">Credit Limit</th>
          <th class="num">Available Credit</th>
          <th class="center">Status</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
    </table>
  `;

  openPrintWindow('Group & Regional Consolidated Drill-Down Report', body, true);
}

export function exportConsolidatedDrillDownReportCsv(rows: any[], title = 'Consolidated_Drill_Down_Report') {
  const headers = ['Entity / Unit Name', 'Code / Responsible Lead', 'Net Sales (PKR)', 'Collections (PKR)', 'Outstanding Exposure (PKR)', 'Credit Limit (PKR)', 'Available Headroom (PKR)', 'Status'];
  const csvRows = (rows || []).map((r, idx) => {
    const name = r.name || r.title || r.company?.name || r.dealer?.name || 'Item ' + (idx + 1);
    const sub = r.code || r.businessManager || r.areaManager || r.salesOfficer || r.level || '';
    const sales = r.sales ?? r.netSales ?? r.totalSales ?? r.summary?.totalSales ?? 0;
    const collections = r.collections ?? r.summary?.totalCollections ?? 0;
    const outstanding = r.outstanding ?? r.outstandingCredit ?? r.summary?.totalOutstanding ?? 0;
    const limit = r.creditLimit ?? r.limit ?? r.summary?.totalCreditLimit ?? 0;
    const avail = r.availableCredit ?? r.summary?.availableCredit ?? (limit - outstanding);
    return [
      name,
      sub,
      sales,
      collections,
      outstanding,
      limit,
      avail,
      avail > 0 ? 'ACTIVE' : 'CREDIT_HOLD',
    ];
  });
  downloadCsv(title, headers, csvRows);
}

// =========================================================================
// 7. CONFIGURED CREDIT LIMITS & OVERRIDES LEVEL-BY-LEVEL REPORTS
// =========================================================================
export function exportConfiguredLimitsReportPdf(data: {
  companyName: string;
  limits: any[];
}) {
  const rowsHtml = (data.limits || [])
    .map((lim, idx) => `<tr>
      <td class="center">${idx + 1}</td>
      <td><span class="badge badge-info">${lim.level}</span></td>
      <td><strong>${lim.entityName || lim.entityId}</strong></td>
      <td class="num" style="color: #0369a1; font-weight: 700;">${formatPkr(lim.creditLimit)}</td>
      <td class="center">${lim.nearLimitThresholdPercent}%</td>
      <td class="center"><span class="badge ${lim.status === 'ACTIVE' ? 'badge-success' : 'badge-neutral'}">${lim.status}</span></td>
      <td class="center">${new Date(lim.effectiveFrom).toLocaleDateString()}</td>
    </tr>`)
    .join('');

  const body = `
    <div class="notice">
      <strong>Company:</strong> ${data.companyName} &nbsp;|&nbsp;
      <strong>Audit Standard:</strong> 5-Tier Configured Credit Risk Architecture (Dealer, SO, Territory, Zone, Region)
    </div>
    <table class="data-table">
      <thead>
        <tr>
          <th style="width: 25px;" class="center">#</th>
          <th>Level</th>
          <th>Entity Name / Identifier</th>
          <th class="num">Configured Limit (PKR)</th>
          <th class="center">Warning Threshold</th>
          <th class="center">Status</th>
          <th class="center">Effective From</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
    </table>
  `;

  openPrintWindow('Configured Credit Limits Master Policy Report', body, true);
}

export function exportConfiguredLimitsReportCsv(limits: any[], filename = 'Configured_Credit_Limits_Report') {
  const headers = ['Level', 'Entity Name', 'Credit Limit (PKR)', 'Warning Threshold %', 'Status', 'Effective Date'];
  const rows = (limits || []).map((lim) => [
    lim.level,
    lim.entityName || lim.entityId,
    lim.creditLimit,
    lim.nearLimitThresholdPercent,
    lim.status,
    lim.effectiveFrom,
  ]);
  downloadCsv(filename, headers, rows);
}

export function exportCreditOverridesReportPdf(data: {
  companyName: string;
  overrides: any[];
}) {
  const rowsHtml = (data.overrides || [])
    .map((o, idx) => `<tr>
      <td class="center">${idx + 1}</td>
      <td><strong>${o.orderNumber || o.orderId || 'ORD-' + idx}</strong></td>
      <td>${o.dealerName || 'Dealer Account'}</td>
      <td class="num" style="color: #b91c1c; font-weight: 700;">${formatPkr(o.orderAmount || o.amount)}</td>
      <td>${o.reason || 'Management approval'}</td>
      <td class="center"><span class="badge ${o.status === 'APPROVED' ? 'badge-success' : o.status === 'REJECTED' ? 'badge-danger' : 'badge-warning'}">${o.status}</span></td>
      <td>${o.approvedBy || o.authorizedBy || 'Pending Review'}</td>
      <td class="center">${new Date(o.createdAt || o.requestedAt).toLocaleDateString()}</td>
    </tr>`)
    .join('');

  const body = `
    <div class="notice">
      <strong>Company:</strong> ${data.companyName} &nbsp;|&nbsp;
      <strong>Audit Log:</strong> Mandatory Audited Credit Override Approvals
    </div>
    <table class="data-table">
      <thead>
        <tr>
          <th style="width: 25px;" class="center">#</th>
          <th>Order #</th>
          <th>Dealer / Customer</th>
          <th class="num">Order Amount (PKR)</th>
          <th>Override Justification</th>
          <th class="center">Decision</th>
          <th>Authorized Manager</th>
          <th class="center">Requested Date</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
    </table>
  `;

  openPrintWindow('Credit Override Audit & Exceptions Report', body, true);
}

export function exportCreditOverridesReportCsv(overrides: any[], filename = 'Credit_Overrides_Audit_Report') {
  const headers = ['Order Number', 'Dealer', 'Amount (PKR)', 'Reason', 'Status', 'Approved By', 'Date'];
  const rows = (overrides || []).map((o) => [
    o.orderNumber || o.orderId,
    o.dealerName,
    o.orderAmount || o.amount,
    o.reason,
    o.status,
    o.approvedBy || o.authorizedBy,
    o.createdAt || o.requestedAt,
  ]);
  downloadCsv(filename, headers, rows);
}

// =========================================================================
// 8. COLLECTIONS BREAKDOWN & SALARY DISBURSAL LEVEL-BY-LEVEL REPORTS
// =========================================================================
export function exportCollectionsBreakdownReportPdf(data: {
  companyName: string;
  collections: any[];
  summary: any;
}) {
  const rowsHtml = (data.collections || [])
    .map((c, idx) => `<tr>
      <td class="center">${idx + 1}</td>
      <td><strong>${c.receiptNumber || c.voucherNumber || 'PR-' + idx}</strong></td>
      <td>${new Date(c.receiptDate || c.createdAt).toLocaleDateString()}</td>
      <td>${c.dealer?.name || c.partyName || 'Dealer Customer'}</td>
      <td><span class="badge badge-info">${c.paymentMethod || 'BANK_TRANSFER'}</span></td>
      <td class="num" style="color: #15803d; font-weight: 700;">${formatPkr(c.amount || c.totalAmount)}</td>
      <td class="center"><span class="badge ${c.isAllocated ? 'badge-success' : 'badge-warning'}">${c.isAllocated ? 'ALLOCATED' : 'CLEARING'}</span></td>
      <td>${c.remarks || c.narration || 'Dealer collection receipt'}</td>
    </tr>`)
    .join('');

  const body = `
    <div class="notice">
      <strong>Company:</strong> ${data.companyName} &nbsp;|&nbsp;
      <strong>Module:</strong> Treasury Collection Audit: Cash/Bank Receipts & Provisional Receipts
    </div>
    <table class="data-table">
      <thead>
        <tr>
          <th style="width: 25px;" class="center">#</th>
          <th>Collection Receipt #</th>
          <th>Date</th>
          <th>Dealer Customer</th>
          <th>Collection Mode</th>
          <th class="num">Amount (PKR)</th>
          <th class="center">Allocation Status</th>
          <th>Narration</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
    </table>
  `;

  openPrintWindow('Collections Breakdown & Cash Flow Audit Report', body, true);
}

export function exportCollectionsBreakdownReportCsv(collections: any[], filename = 'Collections_Breakdown_Report') {
  const headers = ['Receipt Number', 'Date', 'Dealer Name', 'Payment Mode', 'Amount (PKR)', 'Allocated', 'Narration'];
  const rows = (collections || []).map((c) => [
    c.receiptNumber || c.voucherNumber,
    new Date(c.receiptDate || c.createdAt).toISOString().split('T')[0],
    c.dealer?.name || c.partyName,
    c.paymentMethod,
    c.amount || c.totalAmount,
    c.isAllocated ? 'YES' : 'NO',
    c.remarks || c.narration,
  ]);
  downloadCsv(filename, headers, rows);
}

export function exportSalaryDisbursalReportPdf(data: {
  companyName: string;
  salaries: any[];
}) {
  const rowsHtml = (data.salaries || [])
    .map((s, idx) => `<tr>
      <td class="center">${idx + 1}</td>
      <td><strong>${s.voucherNumber || 'SAL-' + idx}</strong></td>
      <td>${s.employee?.fullName || s.employeeName || 'Officer'}</td>
      <td class="center">${s.payrollMonth || 'Current Month'}</td>
      <td>${s.paymentMethod || 'BANK_TRANSFER'}</td>
      <td class="num" style="color: #15803d; font-weight: 700;">${formatPkr(s.netSalary || s.amount)}</td>
      <td class="center"><span class="badge badge-success">${s.status || 'POSTED'}</span></td>
      <td>${s.remarks || 'Monthly Salary Disbursal'}</td>
    </tr>`)
    .join('');

  const body = `
    <div class="notice">
      <strong>Company:</strong> ${data.companyName} &nbsp;|&nbsp;
      <strong>Module:</strong> Authoritative Payroll Disbursals with Direct Cash/Bank Accounting
    </div>
    <table class="data-table">
      <thead>
        <tr>
          <th style="width: 25px;" class="center">#</th>
          <th>Voucher #</th>
          <th>Employee Name</th>
          <th class="center">Payroll Month</th>
          <th>Payment Mode</th>
          <th class="num">Net Disbursed (PKR)</th>
          <th class="center">Status</th>
          <th>Narration</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
    </table>
  `;

  openPrintWindow('Salary Disbursal & Payroll Audit Report', body, true);
}

export function exportSalaryDisbursalReportCsv(salaries: any[], filename = 'Salary_Disbursals_Report') {
  const headers = ['Voucher Number', 'Employee Name', 'Payroll Month', 'Payment Method', 'Net Salary (PKR)', 'Status', 'Remarks'];
  const rows = (salaries || []).map((s) => [
    s.voucherNumber,
    s.employee?.fullName || s.employeeName,
    s.payrollMonth,
    s.paymentMethod,
    s.netSalary || s.amount,
    s.status || 'POSTED',
    s.remarks,
  ]);
  downloadCsv(filename, headers, rows);
}

// =========================================================================
// 9. HIERARCHY ROLLUP & INDIVIDUAL OFFICER 360 DOSSIER
// =========================================================================
export function exportHierarchyRollupReportPdf(data: {
  companyName: string;
  regions: any[];
}) {
  const rowsHtml = (data.regions || [])
    .map((reg, idx) => {
      const regRow = `<tr style="background: #f1f5f9; font-weight: 800;">
        <td class="center">${idx + 1}</td>
        <td><strong>Region: ${reg.name}</strong></td>
        <td class="num" style="color: #0369a1; font-weight: 800;">${formatPkr(reg.sales)}</td>
        <td class="num">${formatPkr(reg.salary)}</td>
        <td class="num">${formatPkr(reg.fuel)}</td>
        <td class="num">${formatPkr(reg.other)}</td>
        <td class="num" style="color: #b91c1c; font-weight: 800;">${formatPkr(reg.totalCost)}</td>
        <td class="center" style="font-weight: 800;">${reg.costPercentage}%</td>
        <td class="center"><span class="badge ${reg.costPercentage > 13 ? 'badge-danger' : 'badge-success'}">${reg.status}</span></td>
      </tr>`;

      const zoneRows = (reg.zones || [])
        .map((z: any) => `<tr>
          <td></td>
          <td style="padding-left: 20px;">↳ Zone: ${z.name}</td>
          <td class="num" style="color: #0369a1;">${formatPkr(z.sales)}</td>
          <td class="num">${formatPkr(z.salary)}</td>
          <td class="num">${formatPkr(z.fuel)}</td>
          <td class="num">${formatPkr(z.other)}</td>
          <td class="num" style="color: #b91c1c;">${formatPkr(z.totalCost)}</td>
          <td class="center">${z.costPercentage}%</td>
          <td class="center"><span class="badge ${z.costPercentage > 13 ? 'badge-danger' : 'badge-success'}">${z.status}</span></td>
        </tr>`)
        .join('');

      return regRow + zoneRows;
    })
    .join('');

  const body = `
    <div class="notice">
      <strong>Company:</strong> ${data.companyName} &nbsp;|&nbsp;
      <strong>Module:</strong> Multi-Level Regional & Zonal Cost vs Sales Rollup & Expense Policy Enforcement
    </div>
    <table class="data-table">
      <thead>
        <tr>
          <th style="width: 25px;" class="center">#</th>
          <th>Region / Zone</th>
          <th class="num">Net Sales</th>
          <th class="num">Salaries</th>
          <th class="num">Fuel</th>
          <th class="num">Other</th>
          <th class="num">Total Cost</th>
          <th class="center">Cost %</th>
          <th class="center">Status</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
    </table>
  `;

  openPrintWindow('Multi-Tier Cost & Sales Hierarchy Rollup Report', body, true);
}

export function exportHierarchyRollupReportCsv(regions: any[], filename = 'Hierarchy_Rollup_Report') {
  const headers = ['Tier', 'Region / Zone Name', 'Net Sales (PKR)', 'Salaries (PKR)', 'Fuel (PKR)', 'Other (PKR)', 'Total Cost (PKR)', 'Cost %', 'Status'];
  const rows: any[] = [];
  (regions || []).forEach((r) => {
    rows.push(['REGION', r.name, r.sales, r.salary, r.fuel, r.other, r.totalCost, r.costPercentage, r.status]);
    (r.zones || []).forEach((z: any) => {
      rows.push(['ZONE', z.name, z.sales, z.salary, z.fuel, z.other, z.totalCost, z.costPercentage, z.status]);
    });
  });
  downloadCsv(filename, headers, rows);
}

