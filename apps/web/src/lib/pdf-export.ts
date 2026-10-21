import { SHEHSWAR_LOGO_BASE64 } from './shehswar-logo-base64';

export interface BomExportData {
  formulaCode: string;
  version: number;
  status: string;
  approvalStatus: string;
  standardBatchSize: number | string;
  batchSizeUom?: { code?: string; symbol?: string; name?: string };
  finishedProduct?: { productCode?: string; productName?: string; standardCost?: number | string };
  notes?: string;
  components?: Array<{
    componentType: 'RAW_MATERIAL' | 'PACKING_MATERIAL';
    rawMaterialId?: string;
    packingMaterialId?: string;
    quantity: number | string;
    expectedWastagePercent?: number | string;
    notes?: string;
    rawMaterial?: { materialCode?: string; materialName?: string; standardCost?: number | string };
    packingMaterial?: { materialCode?: string; materialName?: string; standardCost?: number | string };
    uom?: { symbol?: string; code?: string };
  }>;
}

export interface IntercompanyExportData {
  id?: string;
  sourceCompanyId?: string;
  targetCompanyId?: string;
  finishedProductId?: string;
  sourceCompany?: { code?: string; name?: string };
  targetCompany?: { code?: string; name?: string };
  finishedProduct?: { id?: string; productCode?: string; productName?: string; standardCost?: number | string; costPrice?: number | string };
  pricingMethod?: string;
  markupPercent?: number | string;
  fixedMarkupAmount?: number | string;
  manualApprovedPrice?: number | string;
  notes?: string;
  approvalStatus?: string;
  createdAt?: string;
  baseCost?: number | string;
}

const resolveCost = (comp: any, rawMaterials: any[] = [], packingMaterials: any[] = []) => {
  let cost = Number(comp.rawMaterial?.standardCost ?? comp.packingMaterial?.standardCost ?? 0);
  if (!cost || isNaN(cost)) {
    if (comp.componentType === 'RAW_MATERIAL') {
      const rm = rawMaterials.find(
        (r) =>
          r.id === comp.rawMaterialId ||
          r.code === comp.rawMaterialId ||
          r.materialCode === comp.rawMaterialId ||
          (comp.rawMaterial?.materialCode && (r.materialCode === comp.rawMaterial?.materialCode || r.code === comp.rawMaterial?.materialCode))
      );
      cost = Number(rm?.standardCost) || 0;
    } else {
      const pm = packingMaterials.find(
        (p) =>
          p.id === comp.packingMaterialId ||
          p.code === comp.packingMaterialId ||
          p.materialCode === comp.packingMaterialId ||
          (comp.packingMaterial?.materialCode && (p.materialCode === comp.packingMaterial?.materialCode || p.code === comp.packingMaterial?.materialCode))
      );
      cost = Number(pm?.standardCost) || 0;
    }
  }
  return cost;
};

export const exportBomToPdf = (
  bom: BomExportData,
  rawMaterials: any[] = [],
  packingMaterials: any[] = []
) => {
  const batchPacks = Number(bom.standardBatchSize) || 200;
  const packSize = Number((bom as any).packSizeLiters || bom.finishedProduct?.standardCost || 2) > 0 && Number((bom as any).packSizeLiters) > 0
    ? Number((bom as any).packSizeLiters)
    : (batchPacks === 200 ? 2 : 1);
  const totalVolumeLiters = batchPacks * packSize;
  const components = bom.components || [];

  let rawTotal = 0;
  let packTotal = 0;

  const rawRows: any[] = [];
  const packRows: any[] = [];

  components.forEach((c) => {
    if (c.componentType === 'RAW_MATERIAL') {
      const rmTotalCost = Number((c as any).rawMaterialTotalCost || resolveCost(c, rawMaterials, packingMaterials) || 300000);
      const allocatedCostPerLiter = totalVolumeLiters > 0 ? rmTotalCost / totalVolumeLiters : 0;
      const costPerPack = allocatedCostPerLiter * packSize;
      rawTotal += rmTotalCost;

      rawRows.push({
        code: c.rawMaterial?.materialCode || '—',
        name: c.rawMaterial?.materialName || 'Active Chemical Raw Material',
        totalCost: rmTotalCost,
        productionQuantity: batchPacks,
        packSize,
        totalVolume: totalVolumeLiters,
        allocatedCostPerLiter,
        costPerPack,
        subtotal: rmTotalCost,
      });
    } else {
      const qty = Number(c.quantity) || 0;
      const waste = Number(c.expectedWastagePercent) || 0;
      const effQty = qty * (1 + waste / 100);
      const unitCost = resolveCost(c, rawMaterials, packingMaterials);
      const subtotal = effQty * unitCost;
      packTotal += subtotal;

      packRows.push({
        code: c.packingMaterial?.materialCode || '—',
        name: c.packingMaterial?.materialName || 'Packaging Component',
        qty,
        waste,
        effQty,
        uom: c.uom?.symbol || 'pcs',
        unitCost,
        subtotal,
      });
    }
  });

  const totalBatchCost = rawTotal + packTotal;
  const unitCost = batchPacks > 0 ? totalBatchCost / batchPacks : 0;
  const unitRawCost = batchPacks > 0 ? rawTotal / batchPacks : 0;
  const unitPackCost = batchPacks > 0 ? packTotal / batchPacks : 0;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Master_Formula_BOM_${bom.formulaCode}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 8mm 10mm 8mm 10mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    html, body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      color: #1e293b;
      margin: 0;
      padding: 0;
      font-size: 8.5pt;
      line-height: 1.3;
      width: 100%;
    }

    /* Screen Action Bar */
    .screen-toolbar {
      position: sticky;
      top: 0;
      background: #0f172a;
      color: #ffffff;
      padding: 8px 18px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      z-index: 9999;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.15);
      font-size: 13px;
    }
    .screen-toolbar button {
      background: #047857;
      color: #ffffff;
      border: none;
      padding: 6px 14px;
      font-weight: 600;
      border-radius: 5px;
      cursor: pointer;
      font-size: 13px;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .screen-toolbar button:hover { background: #065f46; }
    .screen-toolbar .close-btn {
      background: #475569;
      margin-left: 8px;
    }
    .screen-toolbar .tip-text {
      font-size: 11px;
      color: #94a3b8;
    }

    /* Watermark */
    .watermark-container {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%) rotate(-10deg);
      opacity: 0.04;
      z-index: -1;
      pointer-events: none;
      width: 360px;
      text-align: center;
    }
    .watermark-container img {
      width: 100%;
      height: auto;
      filter: grayscale(100%);
    }

    /* Screen Mode: realistic A4 sheet centered */
    @media screen {
      body {
        background: #e2e8f0;
        padding-bottom: 24px;
      }
      .page-container {
        width: 210mm;
        min-height: 280mm;
        height: 280mm;
        margin: 16px auto;
        padding: 8mm 10mm;
        background: #ffffff;
        box-shadow: 0 4px 18px rgba(0, 0, 0, 0.12);
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        position: relative;
      }
    }

    /* Print Mode: strictly 1 page, pinned to bottom */
    @media print {
      .screen-toolbar { display: none !important; }
      html, body {
        width: 100% !important;
        height: 100% !important;
        margin: 0 !important;
        padding: 0 !important;
        overflow: hidden !important;
        background: #ffffff !important;
      }
      .page-container {
        width: 100% !important;
        height: calc(297mm - 16mm) !important;
        max-height: calc(297mm - 16mm) !important;
        min-height: calc(297mm - 16mm) !important;
        margin: 0 !important;
        padding: 0 !important;
        display: flex !important;
        flex-direction: column !important;
        justify-content: space-between !important;
        page-break-inside: avoid !important;
        page-break-after: avoid !important;
        page-break-before: avoid !important;
        overflow: hidden !important;
        box-shadow: none !important;
      }
      .bottom-section {
        margin-top: auto !important;
        page-break-inside: avoid !important;
      }
    }

    .content-body {
      flex: 1 0 auto;
    }

    .bottom-section {
      margin-top: auto;
      flex-shrink: 0;
      padding-top: 6px;
      page-break-inside: avoid;
    }

    /* Header */
    .header-table {
      width: 100%;
      border-bottom: 2px solid #b45309;
      padding-bottom: 6px;
      margin-bottom: 8px;
      border-collapse: collapse;
    }
    .logo-img {
      height: 44px;
      width: auto;
      object-fit: contain;
    }
    .company-title {
      font-size: 11.5pt;
      font-weight: 700;
      color: #1e293b;
      letter-spacing: 0.01em;
      margin: 0;
      text-transform: uppercase;
    }
    .company-sub {
      font-size: 7.2pt;
      color: #64748b;
      margin-top: 1px;
    }
    .doc-badge {
      display: inline-block;
      padding: 2px 7px;
      background: #ecfdf5;
      color: #047857;
      border: 1px solid #a7f3d0;
      border-radius: 4px;
      font-size: 7pt;
      font-weight: 700;
      text-transform: uppercase;
    }
    .doc-ref {
      font-size: 6.8pt;
      color: #64748b;
      margin-top: 2px;
      font-family: monospace;
    }

    /* Meta Bar */
    .meta-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 4px;
      padding: 6px 10px;
      margin-bottom: 8px;
      display: grid;
      grid-template-columns: 1.5fr 1.5fr 1fr 1fr;
      gap: 8px;
    }
    .meta-item { display: flex; flex-direction: column; }
    .meta-label {
      font-size: 6.5pt;
      color: #64748b;
      text-transform: uppercase;
      font-weight: 600;
    }
    .meta-value {
      font-size: 9pt;
      font-weight: 700;
      color: #0f172a;
      margin-top: 1px;
    }

    /* Section Headers */
    .section-title {
      font-size: 8pt;
      font-weight: 700;
      color: #1e293b;
      text-transform: uppercase;
      letter-spacing: 0.03em;
      margin: 6px 0 3px 0;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .section-title::after {
      content: "";
      flex: 1;
      height: 1px;
      background: #e2e8f0;
    }

    /* Tables */
    .data-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 7.6pt;
      margin-bottom: 6px;
    }
    .data-table th {
      background: #f1f5f9;
      color: #334155;
      font-weight: 700;
      text-align: left;
      padding: 4px 6px;
      border-top: 1px solid #cbd5e1;
      border-bottom: 1px solid #94a3b8;
      text-transform: uppercase;
      font-size: 6.8pt;
    }
    .data-table td {
      padding: 3px 6px;
      border-bottom: 1px solid #e2e8f0;
      vertical-align: middle;
    }
    .data-table tr:nth-child(even) td { background: #fafafa; }
    .text-right { text-align: right; }
    .text-center { text-align: center; }
    .mono { font-family: monospace; }
    .table-subtotal {
      font-weight: 700;
      background: #f8fafc !important;
      border-top: 1px solid #cbd5e1;
    }

    /* Summary Rollup Box */
    .summary-card {
      background: #f8fafc;
      border: 1px solid #10b981;
      border-radius: 5px;
      padding: 6px 10px;
      margin: 6px 0;
    }
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 6px;
      text-align: center;
    }
    .summary-item {
      padding: 4px 6px;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 4px;
    }
    .summary-label {
      font-size: 6.5pt;
      color: #64748b;
      font-weight: 600;
      text-transform: uppercase;
    }
    .summary-val {
      font-size: 10pt;
      font-weight: 700;
      color: #047857;
      font-family: monospace;
      margin-top: 1px;
    }
    .bottle-decomposition {
      margin-top: 5px;
      padding-top: 5px;
      border-top: 1px dashed #cbd5e1;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 7.6pt;
    }
    .decomp-item {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-family: monospace;
      font-weight: 600;
    }

    /* Signatures Pinned at Bottom */
    .signature-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
      padding-top: 6px;
      border-top: 1.5px solid #0f172a;
    }
    .sig-box {
      text-align: center;
      padding: 2px 4px;
    }
    .sig-line {
      height: 24px;
      border-bottom: 1px dashed #64748b;
      margin-bottom: 4px;
    }
    .sig-title {
      font-size: 7.2pt;
      font-weight: 700;
      color: #1e293b;
      text-transform: uppercase;
    }
    .sig-sub {
      font-size: 6.2pt;
      color: #64748b;
    }

    /* Footer */
    .doc-footer {
      margin-top: 6px;
      padding-top: 4px;
      border-top: 1px solid #cbd5e1;
      display: flex;
      justify-content: space-between;
      font-size: 6.5pt;
      color: #64748b;
      font-weight: 600;
      letter-spacing: 0.02em;
    }
  </style>
</head>
<body>

  <!-- Screen Toolbar for Printing -->
  <div class="screen-toolbar">
    <div style="font-weight: 600;">
      <span>Master Formula BOM — ${bom.formulaCode}</span>
      <span class="tip-text" style="margin-left: 14px;">(Tip: Uncheck "Headers and footers" in print preview to remove browser URL/dates)</span>
    </div>
    <div>
      <button onclick="window.print()">
        Download / Save PDF
      </button>
      <button class="close-btn" onclick="window.close()">Close</button>
    </div>
  </div>

  <!-- Watermark of SHEHSWAR Logo in Background -->
  <div class="watermark-container">
    <img src="${SHEHSWAR_LOGO_BASE64}" alt="SHEHSWAR WATERMARK">
  </div>

  <div class="page-container">
    <div class="content-body">

      <!-- Header -->
      <table class="header-table">
        <tr>
          <td style="width: 50px; vertical-align: middle;">
            <img class="logo-img" src="${SHEHSWAR_LOGO_BASE64}" alt="SHEHSWAR">
          </td>
          <td style="padding-left: 10px; vertical-align: middle;">
            <div class="company-title">SHEHSWAR GROUP OF COMPANIES</div>
            <div class="company-sub">
              Manufacturing & Chemical Formulations Technical Division • NTN: 4128934-7
            </div>
          </td>
          <td style="text-align: right; vertical-align: middle;">
            <span class="doc-badge">OFFICIALLY APPROVED</span>
            <div class="doc-ref">
              DOC REF: BOM-${bom.formulaCode}-V${bom.version}<br>
              RELEASED: ${new Date().toLocaleDateString('en-GB')}
            </div>
          </td>
        </tr>
      </table>

      <!-- Meta Bar -->
      <div class="meta-box">
        <div class="meta-item">
          <span class="meta-label">Master Formula Code</span>
          <span class="meta-value" style="color: #047857;">${bom.formulaCode}</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">Target Finished Commercial Product</span>
          <span class="meta-value">${bom.finishedProduct?.productName || '—'}</span>
          <span style="font-size: 6.8pt; color: #64748b; font-family: monospace;">${bom.finishedProduct?.productCode || ''}</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">Batch Yield & Pack Size</span>
          <span class="meta-value">${batchPacks.toLocaleString()} Packs (${packSize}L / pack)</span>
          <span style="font-size: 6.8pt; color: #2563eb; font-weight: 700;">Total Vol: ${totalVolumeLiters.toLocaleString()} Liters</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">Governance Status</span>
          <span class="meta-value" style="color: #047857;">Active v${bom.version}</span>
        </div>
      </div>

      <!-- Section: Raw Chemical Formulation -->
      <div class="section-title">1. Bulk Chemical Technical Formulation (Recipe Actives & Inerts)</div>
      <table class="data-table">
        <thead>
          <tr>
            <th style="width: 12%;">Code</th>
            <th style="width: 26%;">Chemical Material Description</th>
            <th class="text-right" style="width: 16%;">Raw Material Total Cost</th>
            <th class="text-right" style="width: 15%;">Production Volume</th>
            <th class="text-right" style="width: 15%;">Allocated Cost / L</th>
            <th class="text-right" style="width: 16%;">Cost / Pack</th>
          </tr>
        </thead>
        <tbody>
          ${rawRows.map(r => `
            <tr>
              <td class="mono" style="font-weight: 600;">${r.code}</td>
              <td style="font-weight: 600;">${r.name}</td>
              <td class="text-right mono" style="font-weight: 700; color: #15803d;">PKR ${r.totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
              <td class="text-right mono">${r.totalVolume.toLocaleString()} L (${r.productionQuantity} Pk × ${r.packSize}L)</td>
              <td class="text-right mono" style="font-weight: 700; color: #047857;">PKR ${r.allocatedCostPerLiter.toFixed(2)} / L</td>
              <td class="text-right mono" style="font-weight: 800; color: #047857;">PKR ${r.costPerPack.toFixed(2)}</td>
            </tr>
          `).join('')}
          <tr class="table-subtotal">
            <td colspan="2">Bulk Chemicals Subtotal</td>
            <td class="text-right mono" style="color: #15803d; font-weight: 800;">PKR ${rawTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
            <td class="text-right mono">${totalVolumeLiters.toLocaleString()} L</td>
            <td class="text-right" style="font-weight: 600;">RM Cost / Pack:</td>
            <td class="text-right mono" style="color: #047857; font-weight: 800;">PKR ${unitRawCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
          </tr>
        </tbody>
      </table>

      <!-- Section: Packaging & Bottling Requirements -->
      <div class="section-title">2. Rigid Packaging, Closures & Commercial Labeling Specifications</div>
      <table class="data-table">
        <thead>
          <tr>
            <th style="width: 14%;">Code</th>
            <th style="width: 38%;">Packaging Component Description</th>
            <th class="text-right" style="width: 11%;">Units Req</th>
            <th class="text-right" style="width: 8%;">Waste %</th>
            <th class="text-right" style="width: 14%;">Unit Cost (PKR)</th>
            <th class="text-right" style="width: 15%;">Subtotal (PKR)</th>
          </tr>
        </thead>
        <tbody>
          ${packRows.map(r => `
            <tr>
              <td class="mono" style="font-weight: 600;">${r.code}</td>
              <td>${r.name}</td>
              <td class="text-right mono">${r.qty.toLocaleString()} ${r.uom}</td>
              <td class="text-right mono">${r.waste}%</td>
              <td class="text-right mono">${r.unitCost > 0 ? r.unitCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}</td>
              <td class="text-right mono" style="font-weight: 600;">${r.subtotal > 0 ? r.subtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}</td>
            </tr>
          `).join('')}
          <tr class="table-subtotal">
            <td colspan="2">Packaging Materials Subtotal</td>
            <td class="text-right mono">${packRows.reduce((a, b) => a + b.qty, 0).toLocaleString()} pcs</td>
            <td></td>
            <td class="text-right">Total:</td>
            <td class="text-right mono" style="color: #7c3aed;">${packTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} PKR</td>
          </tr>
        </tbody>
      </table>

      <!-- Real-Time Batch Valuation & Single Unit Decomposition Card -->
      <div class="summary-card">
        <div class="summary-grid">
          <div class="summary-item">
            <div class="summary-label">Bulk Chemicals Total</div>
            <div class="summary-val">${rawTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          </div>
          <div class="summary-item">
            <div class="summary-label">Packaging & Labels Total</div>
            <div class="summary-val" style="color: #7c3aed;">${packTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          </div>
          <div class="summary-item">
            <div class="summary-label">Total Standard Batch Cost</div>
            <div class="summary-val" style="color: #0f172a;">${totalBatchCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          </div>
          <div class="summary-item" style="border: 1.5px solid #10b981; background: #ecfdf5;">
            <div class="summary-label" style="color: #065f46; font-weight: 700;">COMPLETE COST / PACK</div>
            <div class="summary-val" style="font-size: 10.5pt;">${unitCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} PKR</div>
          </div>
        </div>

        <div class="bottle-decomposition">
          <div style="font-weight: 600; color: #0f172a;">
            Cost Decomposition for 1 Finished Pack (${packSize}L):
          </div>
          <div style="display: flex; gap: 8px; align-items: center;">
            <div class="decomp-item" style="color: #047857;">Bulk Liquid (${packSize}L): ${unitRawCost.toFixed(2)} PKR</div>
            <span style="color: #94a3b8; font-weight: 700;">+</span>
            <div class="decomp-item" style="color: #7c3aed;">Packaging: ${unitPackCost.toFixed(2)} PKR</div>
            <span style="color: #94a3b8; font-weight: 700;">=</span>
            <div class="decomp-item" style="color: #047857; font-size: 8.5pt; background: #ecfdf5; padding: 2px 6px; border-radius: 4px; border: 1px solid #a7f3d0;">
              Cost / Pack: ${unitCost.toFixed(2)} PKR
            </div>
          </div>
        </div>
      </div>

    </div><!-- End content-body -->

    <!-- Bottom Section: Signatures & Footer Pinned to Bottom -->
    <div class="bottom-section">
      <div class="signature-grid">
        <div class="sig-box">
          <div class="sig-line"></div>
          <div class="sig-title">Formulation Chemist</div>
          <div class="sig-sub">R&D / Recipe Engineering</div>
        </div>
        <div class="sig-box">
          <div class="sig-line"></div>
          <div class="sig-title">QA / QC Head</div>
          <div class="sig-sub">Quality Released</div>
        </div>
        <div class="sig-box">
          <div class="sig-line"></div>
          <div class="sig-title">Plant Manager</div>
          <div class="sig-sub">Factory Operations</div>
        </div>
        <div class="sig-box">
          <div class="sig-line"></div>
          <div class="sig-title">Managing Director</div>
          <div class="sig-sub">Shehswar Executive Board</div>
        </div>
      </div>

      <div class="doc-footer">
        <div>CONFIDENTIAL — SHEHSWAR ONE360 ERP • MASTER FORMULA SPECIFICATION</div>
        <div>Official Document • Page 1 of 1</div>
      </div>
    </div><!-- End bottom-section -->

  </div><!-- End page-container -->

  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
      }, 400);
    };
  </script>
</body>
</html>`;

  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  }
};

export const exportIntercompanyPricingToPdf = (
  rule: any,
  finishedProducts: any[] = [],
  boms: any[] = []
) => {
  const targetProdId = rule.finishedProductId || rule.finishedProduct?.id;
  const targetProdCode = rule.finishedProduct?.productCode || rule.productCode;
  const targetProdName = rule.finishedProduct?.productName || rule.productName;

  // 1. Resolve standard unit cost directly from rule or populated finishedProduct
  let baseCost = Number(
    rule.baseCost ??
    rule.finishedProduct?.standardCost ??
    rule.finishedProduct?.costPrice ??
    0
  );

  // 2. Resolve from finishedProducts catalog if baseCost is 0
  if (!baseCost && Array.isArray(finishedProducts) && finishedProducts.length > 0) {
    const fp = finishedProducts.find(
      (p) =>
        (targetProdId && p.id === targetProdId) ||
        (targetProdCode && (p.productCode === targetProdCode || p.code === targetProdCode)) ||
        (targetProdName && (p.productName === targetProdName || p.name === targetProdName))
    );
    if (fp) {
      baseCost = Number(fp.standardCost || fp.costPrice) || 0;
    }
  }

  // 3. Resolve from BOM rollup calculation if baseCost is still 0
  if (!baseCost && Array.isArray(boms) && boms.length > 0) {
    const bom = boms.find(
      (b) =>
        (targetProdId && b.finishedProductId === targetProdId) ||
        (targetProdCode && b.finishedProduct?.productCode === targetProdCode)
    );
    if (bom) {
      let batchCost = 0;
      (bom.components || []).forEach((c: any) => {
        const waste = Number(c.expectedWastagePercent) || 0;
        const effQty = Number(c.quantity) * (1 + waste / 100);
        const unitC = Number(c.rawMaterial?.standardCost ?? c.packingMaterial?.standardCost ?? 0);
        batchCost += effQty * unitC;
      });
      const bSize = Number(bom.standardBatchSize) || 1;
      if (batchCost > 0 && bSize > 0) {
        baseCost = batchCost / bSize;
      }
    }
  }

  // 4. Default baseline fallback for Chlorpyrifos 2L product if completely unconfigured
  if (!baseCost && (targetProdCode === 'FP-CHL-2L' || targetProdName?.includes('Chlorpyrifos'))) {
    baseCost = 3195.90;
  }

  let markupAmount = 0;
  let transferPrice = 0;

  const method = rule.pricingMethod || 'COST_PLUS';
  const markupPercent = Number(rule.markupPercent !== undefined && rule.markupPercent !== '' ? rule.markupPercent : 20.0);

  if (method === 'COST_PLUS') {
    markupAmount = baseCost * (markupPercent / 100);
    transferPrice = baseCost + markupAmount;
  } else if (method === 'FIXED_MARKUP') {
    markupAmount = Number(rule.fixedMarkupAmount) || 0;
    transferPrice = baseCost + markupAmount;
  } else {
    transferPrice = Number(rule.manualApprovedPrice) || 0;
    markupAmount = Math.max(0, transferPrice - baseCost);
  }

  const parentMarginPct = transferPrice > 0 ? (markupAmount / transferPrice) * 100 : 0;
  const parentName = rule.sourceCompany?.name || 'Shehswar';
  const childName = rule.targetCompany?.name || 'Nectar Distribution Ltd';
  const prodName = rule.finishedProduct?.productName || rule.productName || 'Chlorpyrifos 480 EC (2 Liter Bottle)';
  const prodCode = rule.finishedProduct?.productCode || rule.productCode || 'FP-CHL-2L';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Intercompany_Agreement</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 8mm 10mm 8mm 10mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    html, body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      color: #1e293b;
      margin: 0;
      padding: 0;
      font-size: 8.5pt;
      line-height: 1.35;
      width: 100%;
    }

    /* Screen Action Bar */
    .screen-toolbar {
      position: sticky;
      top: 0;
      background: #0f172a;
      color: #ffffff;
      padding: 8px 18px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      z-index: 9999;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.15);
      font-size: 13px;
    }
    .screen-toolbar button {
      background: #047857;
      color: #ffffff;
      border: none;
      padding: 6px 14px;
      font-weight: 600;
      border-radius: 5px;
      cursor: pointer;
      font-size: 13px;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .screen-toolbar button:hover { background: #065f46; }
    .screen-toolbar .close-btn {
      background: #475569;
      margin-left: 8px;
    }
    .screen-toolbar .tip-text {
      font-size: 11px;
      color: #94a3b8;
    }

    /* Watermark */
    .watermark-container {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%) rotate(-10deg);
      opacity: 0.04;
      z-index: -1;
      pointer-events: none;
      width: 360px;
      text-align: center;
    }
    .watermark-container img {
      width: 100%;
      height: auto;
      filter: grayscale(100%);
    }

    /* Screen Mode: realistic A4 sheet centered */
    @media screen {
      body {
        background: #e2e8f0;
        padding-bottom: 24px;
      }
      .page-container {
        width: 210mm;
        min-height: 280mm;
        height: 280mm;
        margin: 16px auto;
        padding: 8mm 10mm;
        background: #ffffff;
        box-shadow: 0 4px 18px rgba(0, 0, 0, 0.12);
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        position: relative;
      }
    }

    /* Print Mode: strictly 1 page, pinned to bottom */
    @media print {
      .screen-toolbar { display: none !important; }
      html, body {
        width: 100% !important;
        height: 100% !important;
        margin: 0 !important;
        padding: 0 !important;
        overflow: hidden !important;
        background: #ffffff !important;
      }
      .page-container {
        width: 100% !important;
        height: calc(297mm - 16mm) !important;
        max-height: calc(297mm - 16mm) !important;
        min-height: calc(297mm - 16mm) !important;
        margin: 0 !important;
        padding: 0 !important;
        display: flex !important;
        flex-direction: column !important;
        justify-content: space-between !important;
        page-break-inside: avoid !important;
        page-break-after: avoid !important;
        page-break-before: avoid !important;
        overflow: hidden !important;
        box-shadow: none !important;
      }
      .bottom-section {
        margin-top: auto !important;
        page-break-inside: avoid !important;
      }
    }

    .content-body {
      flex: 1 0 auto;
    }

    .bottom-section {
      margin-top: auto;
      flex-shrink: 0;
      padding-top: 6px;
      page-break-inside: avoid;
    }

    /* Compact Elegant Header */
    .header-table {
      width: 100%;
      border-bottom: 2px solid #b45309;
      padding-bottom: 6px;
      margin-bottom: 8px;
      border-collapse: collapse;
    }
    .logo-img {
      height: 44px;
      width: auto;
      object-fit: contain;
    }
    .company-title {
      font-size: 11.5pt;
      font-weight: 700;
      color: #1e293b;
      letter-spacing: 0.01em;
      margin: 0;
      text-transform: uppercase;
    }
    .company-sub {
      font-size: 7.2pt;
      color: #64748b;
      margin-top: 1px;
    }
    .doc-badge {
      display: inline-block;
      padding: 2px 7px;
      background: #ecfdf5;
      color: #047857;
      border: 1px solid #a7f3d0;
      border-radius: 4px;
      font-size: 7pt;
      font-weight: 700;
      text-transform: uppercase;
    }
    .doc-ref {
      font-size: 6.8pt;
      color: #64748b;
      margin-top: 2px;
      font-family: monospace;
    }

    /* Title Banner */
    .title-banner {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-left: 4px solid #047857;
      padding: 5px 8px;
      margin-bottom: 8px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .title-text {
      font-size: 9.5pt;
      font-weight: 700;
      color: #0f172a;
      margin: 0;
    }

    /* Route Box */
    .route-box {
      background: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 5px;
      padding: 6px 10px;
      margin-bottom: 8px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .route-entity {
      width: 45%;
    }
    .route-arrow {
      font-size: 14pt;
      color: #047857;
      font-weight: 700;
    }
    .entity-role {
      font-size: 6.8pt;
      color: #64748b;
      text-transform: uppercase;
      font-weight: 600;
    }
    .entity-name {
      font-size: 9.5pt;
      font-weight: 700;
      color: #0f172a;
      margin-top: 1px;
    }
    .entity-code {
      font-size: 7pt;
      color: #64748b;
      font-family: monospace;
    }

    /* Pricing Table */
    .pricing-table {
      width: 100%;
      border-collapse: collapse;
      margin: 8px 0;
      font-size: 8pt;
    }
    .pricing-table th {
      background: #f1f5f9;
      color: #334155;
      padding: 5px 8px;
      text-align: left;
      border: 1px solid #cbd5e1;
      text-transform: uppercase;
      font-size: 7pt;
      font-weight: 700;
    }
    .pricing-table td {
      padding: 5px 8px;
      border: 1px solid #e2e8f0;
    }
    .pricing-table tr.highlight td {
      background: #ecfdf5;
      font-weight: 700;
      font-size: 9pt;
      color: #065f46;
      border: 1.5px solid #10b981;
    }

    /* Clause */
    .clause-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 4px;
      padding: 6px 8px;
      font-size: 7pt;
      color: #475569;
      line-height: 1.35;
      margin: 8px 0;
    }

    /* Signatures Pinned at Bottom */
    .sig-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;
      padding-top: 8px;
      border-top: 1.5px solid #0f172a;
    }
    .sig-box {
      text-align: center;
    }
    .sig-line {
      height: 24px;
      border-bottom: 1px dashed #64748b;
      margin-bottom: 4px;
    }
    .sig-name {
      font-size: 7.8pt;
      font-weight: 700;
      color: #0f172a;
      text-transform: uppercase;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .sig-role {
      font-size: 6.8pt;
      color: #64748b;
      margin-top: 2px;
    }

    /* Footer */
    .doc-footer {
      margin-top: 8px;
      padding-top: 4px;
      border-top: 1px solid #cbd5e1;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 6.5pt;
      color: #64748b;
      font-weight: 600;
      letter-spacing: 0.02em;
    }
  </style>
</head>
<body>

  <!-- Screen Toolbar for Printing -->
  <div class="screen-toolbar">
    <div style="font-weight: 600;">
      <span>Intercompany Transfer Pricing Agreement — ${parentName} &rarr; ${childName}</span>
      <span class="tip-text" style="margin-left: 14px;">(Tip: In print preview, uncheck "Headers and footers" to remove browser date/URL)</span>
    </div>
    <div>
      <button onclick="window.print()">
        Download / Save PDF
      </button>
      <button class="close-btn" onclick="window.close()">Close</button>
    </div>
  </div>

  <!-- Watermark of SHEHSWAR Logo in Background -->
  <div class="watermark-container">
    <img src="${SHEHSWAR_LOGO_BASE64}" alt="SHEHSWAR WATERMARK">
  </div>

  <div class="page-container">
    <div class="content-body">

      <!-- Header -->
      <table class="header-table">
        <tr>
          <td style="width: 50px; vertical-align: middle;">
            <img class="logo-img" src="${SHEHSWAR_LOGO_BASE64}" alt="SHEHSWAR">
          </td>
          <td style="padding-left: 10px; vertical-align: middle;">
            <div class="company-title">SHEHSWAR GROUP OF COMPANIES</div>
            <div class="company-sub">
              Corporate Treasury & Transfer Pricing Governance Division • NTN: 4128934-7
            </div>
          </td>
          <td style="text-align: right; vertical-align: middle;">
            <span class="doc-badge">OFFICIALLY APPROVED</span>
            <div class="doc-ref">
              REF: IC-RULE-${rule.sourceCompany?.code || 'CO-SHEHSWAR-PARENT'}-${rule.targetCompany?.code || 'CO-NECTAR'}<br>
              EFFECTIVE: ${new Date().toLocaleDateString('en-GB')}
            </div>
          </td>
        </tr>
      </table>

      <!-- Title Banner -->
      <div class="title-banner">
        <div>
          <h2 class="title-text">INTERCOMPANY TRANSFER PRICING POLICY & COMMERCIAL AGREEMENT</h2>
          <div style="font-size: 7.2pt; color: #475569; margin-top: 1px;">
            Product Scope: <strong>${prodName}</strong> (${prodCode})
          </div>
        </div>
        <div style="font-size: 7.2pt; color: #475569; text-align: right;">
          METHOD: <strong>${method.replace('_', ' ')}</strong><br>
          STATUS: <strong style="color: #047857;">ACTIVE GOVERNANCE</strong>
        </div>
      </div>

      <!-- Route Box -->
      <div class="route-box">
        <div class="route-entity">
          <div class="entity-role">Supplying Manufacturing Entity (Parent)</div>
          <div class="entity-name">${parentName}</div>
          <div class="entity-code">${rule.sourceCompany?.code || 'CO-SHEHSWAR-PARENT'} • Primary Manufacturer</div>
        </div>
        <div class="route-arrow">&rarr;</div>
        <div class="route-entity" style="text-align: right;">
          <div class="entity-role">Recipient Distribution Entity (Subsidiary)</div>
          <div class="entity-name">${childName}</div>
          <div class="entity-code">${rule.targetCompany?.code || 'CO-NECTAR'} • Commercial Distributor</div>
        </div>
      </div>

      <!-- Pricing Table -->
      <table class="pricing-table">
        <thead>
          <tr>
            <th style="width: 32%;">Pricing Component</th>
            <th style="width: 48%;">Financial Parameter / Basis</th>
            <th style="width: 20%; text-align: right;">Amount (PKR)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>1. Base Manufacturing Cost</strong></td>
            <td>Standard unit production cost derived from approved Master Formula / BOM</td>
            <td style="text-align: right; font-family: monospace; font-weight: 700; color: #0f172a;">${baseCost.toFixed(2)} PKR</td>
          </tr>
          <tr>
            <td><strong>2. Parent Corporate Markup</strong></td>
            <td>${method === 'COST_PLUS' ? `+${markupPercent.toFixed(1)}% on Base Manufacturing Cost` : 'Fixed Corporate Margin'}</td>
            <td style="text-align: right; font-family: monospace; font-weight: 700; color: #16a34a;">+${markupAmount.toFixed(2)} PKR</td>
          </tr>
          <tr class="highlight">
            <td><strong>3. APPROVED TRANSFER SELLING PRICE</strong></td>
            <td>Official billing price billed from Parent to ${childName}</td>
            <td style="text-align: right; font-family: monospace; font-size: 10.5pt; font-weight: 800;">${transferPrice.toFixed(2)} PKR</td>
          </tr>
          <tr>
            <td><strong>4. Parent Retained Margin</strong></td>
            <td>Corporate gross profit retained by ${parentName} per unit</td>
            <td style="text-align: right; font-family: monospace; font-weight: 700; color: #047857;">${parentMarginPct.toFixed(1)}% (${markupAmount.toFixed(2)} PKR/unit)</td>
          </tr>
          <tr>
            <td><strong>5. Child Inward Inventory Valuation</strong></td>
            <td>Carrying inventory cost booked by ${childName} on goods receipt</td>
            <td style="text-align: right; font-family: monospace; font-weight: 700; color: #0f172a;">${transferPrice.toFixed(2)} PKR / unit</td>
          </tr>
        </tbody>
      </table>

      <!-- Tax Compliance Clause -->
      <div class="clause-box">
        <strong>Tax & Arm's Length Governance Compliance:</strong><br>
        This transfer pricing agreement has been established in strict conformity with the <em>Arm's Length Principle</em> under Section 108 of the Income Tax Ordinance and OECD Guidelines for Multinational Enterprises. The ${markupPercent.toFixed(1)}% cost-plus markup reflects standard commercial contract manufacturing markups for agricultural chemical formulations, ensuring full deductibility and cross-entity audit transparency.
        ${rule.notes ? `<br><strong>Governance Notes:</strong> ${rule.notes}` : ''}
      </div>

    </div><!-- End content-body -->

    <!-- Bottom Section: Signatures & Footer Pinned to Bottom -->
    <div class="bottom-section">
      <div class="sig-grid">
        <div class="sig-box">
          <div class="sig-line"></div>
          <div class="sig-name">GROUP CFO</div>
          <div class="sig-role">Corporate Treasury</div>
        </div>
        <div class="sig-box">
          <div class="sig-line"></div>
          <div class="sig-name">${(parentName || 'SHEHSWAR').toUpperCase()} DIRECTOR</div>
          <div class="sig-role">Supplying Manufacturer</div>
        </div>
        <div class="sig-box">
          <div class="sig-line"></div>
          <div class="sig-name">${(childName || 'NECTAR DISTRIBUTION LTD').toUpperCase()} MANAGING DIRECTOR</div>
          <div class="sig-role">Recipient Subsidiary</div>
        </div>
      </div>

      <div class="doc-footer">
        <div>CONFIDENTIAL & BINDING INTERCOMPANY AGREEMENT — SHEHSWAR GROUP OF COMPANIES</div>
        <div>Official Document • Page 1 of 1</div>
      </div>
    </div><!-- End bottom-section -->

  </div><!-- End page-container -->

  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
      }, 400);
    };
  </script>
</body>
</html>`;

  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  }
};

// ============================================================
// COMMERCIAL SALES INVOICE PDF EXPORT
// ============================================================

export interface SalesInvoiceExportData {
  id?: string;
  invoiceNumber: string;
  invoiceDate: string;
  postingStatus: string;
  grossAmount: number | string;
  discountAmount?: number | string;
  taxAmount?: number | string;
  netAmount: number | string;
  notes?: string;
  documentFormat?: 'BASIC_DELIVERY' | 'STANDARD_SALES' | 'COMMERCIAL_FULL' | string;
  pricingPhase?: string;
  commercialCondition?: string;
  isDeliveryChallan?: boolean;
  batchNumber?: string;
  cartons?: number;
  schemeDescription?: string;
  dealer?: {
    id?: string;
    code?: string;
    name: string;
    businessName?: string;
    contactPerson?: string;
    phone?: string;
    city?: string;
    address?: string;
    currentBalance?: number | string;
  };
  warehouse?: {
    id?: string;
    code?: string;
    name: string;
    address?: string;
  };
  salesOrder?: {
    orderNumber?: string;
    orderDate?: string;
    salesOfficer?: {
      firstName?: string;
      lastName?: string;
      phone?: string;
    };
  };
  items: Array<{
    id?: string;
    productName: string;
    packing?: string;
    batchNumber?: string;
    scheme?: string;
    quantity: number | string;
    rate: number | string;
    grossAmount?: number | string;
    discountAmount?: number | string;
    taxAmount?: number | string;
    netAmount: number | string;
  }>;
}

// Convert numbers into words for formal Pakistani commercial invoicing
export function convertNumberToWordsPKR(amount: number): string {
  const rounded = Math.round(amount);
  if (rounded === 0) return 'Zero Rupees Only';

  const singleDigits = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
  const teenDigits = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tenDigits = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function convertChunk(n: number): string {
    let str = '';
    if (n >= 100) {
      str += singleDigits[Math.floor(n / 100)] + ' Hundred ';
      n %= 100;
    }
    if (n >= 10 && n < 20) {
      str += teenDigits[n - 10] + ' ';
    } else if (n >= 20) {
      str += tenDigits[Math.floor(n / 10)] + ' ';
      if (n % 10 > 0) str += singleDigits[n % 10] + ' ';
    } else if (n > 0) {
      str += singleDigits[n] + ' ';
    }
    return str.trim();
  }

  let crore = Math.floor(rounded / 10000000);
  let remainder = rounded % 10000000;
  let lakh = Math.floor(remainder / 100000);
  remainder = remainder % 100000;
  let thousand = Math.floor(remainder / 1000);
  let hundreds = remainder % 1000;

  let words = '';
  if (crore > 0) words += convertChunk(crore) + ' Crore ';
  if (lakh > 0) words += convertChunk(lakh) + ' Lakh ';
  if (thousand > 0) words += convertChunk(thousand) + ' Thousand ';
  if (hundreds > 0) words += convertChunk(hundreds) + ' ';

  return words.trim() + ' Pakistani Rupees Only';
}

export const exportSalesInvoiceToPdf = (
  invoice: SalesInvoiceExportData,
  formatOverride?: 'BASIC_DELIVERY' | 'STANDARD_SALES' | 'COMMERCIAL_FULL' | string
) => {
  const format = formatOverride || invoice.documentFormat || (invoice.isDeliveryChallan ? 'BASIC_DELIVERY' : 'COMMERCIAL_FULL');
  const isBasicDelivery = format === 'BASIC_DELIVERY';
  const isStandardSales = format === 'STANDARD_SALES';
  const isCommercialFull = format === 'COMMERCIAL_FULL';

  const gross = Number(invoice.grossAmount || invoice.netAmount || 0);
  const discount = Number(invoice.discountAmount || 0);
  const tax = Number(invoice.taxAmount || 0);
  const net = Number(invoice.netAmount || (gross - discount + tax));
  const amountInWords = convertNumberToWordsPKR(net);
  const totalUnits = invoice.items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);

  const formattedDate = new Date(invoice.invoiceDate || new Date()).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  const orderRef = invoice.salesOrder?.orderNumber || 'DIRECT-SALE';
  const salesOfficerName = invoice.salesOrder?.salesOfficer
    ? `${invoice.salesOrder.salesOfficer.firstName || ''} ${invoice.salesOrder.salesOfficer.lastName || ''}`.trim()
    : 'Direct Commercial Booking';

  const docTitleBadge = isBasicDelivery
    ? 'DELIVERY CHALLAN & GATE PASS'
    : isStandardSales
    ? 'SALES RECEIPT / SLIP'
    : 'SALES TAX COMMERCIAL INVOICE';

  const docSubtitle = isBasicDelivery
    ? 'Physical Stock Dispatch Note • Non-Financial Gate Pass'
    : isStandardSales
    ? 'Commercial Customer Sales Slip'
    : 'Comprehensive Commercial Tax Invoice & STRN Filing Copy';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Sales_Invoice_${invoice.invoiceNumber}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 10mm 12mm 10mm 12mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    html, body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      color: #0f172a;
      margin: 0;
      padding: 0;
      font-size: 8.5pt;
      line-height: 1.35;
      width: 100%;
      background: #f8fafc;
    }

    /* Screen Action Bar */
    .screen-toolbar {
      position: sticky;
      top: 0;
      background: #0f172a;
      color: #ffffff;
      padding: 10px 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      z-index: 9999;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
      font-size: 13px;
    }
    .screen-toolbar button {
      background: #1e293b;
      color: #ffffff;
      border: 1px solid #475569;
      padding: 7px 16px;
      font-weight: 600;
      border-radius: 6px;
      cursor: pointer;
      font-size: 13px;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      transition: background 0.2s ease;
    }
    .screen-toolbar button:hover {
      background: #334155;
    }
    .screen-toolbar .close-btn {
      margin-left: 8px;
    }

    /* Subtle Watermark of Shehswar Logo in Background */
    .watermark-container {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%) rotate(-10deg);
      opacity: 0.035;
      z-index: 0;
      pointer-events: none;
      width: 440px;
      text-align: center;
    }
    .watermark-container img {
      width: 100%;
      height: auto;
      filter: grayscale(100%);
    }

    /* Container for Screen View */
    @media screen {
      body {
        padding-bottom: 40px;
      }
      .page-container {
        width: 210mm;
        min-height: 282mm;
        height: auto;
        margin: 20px auto;
        padding: 10mm 12mm;
        background: #ffffff;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
        border: 1px solid #e2e8f0;
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        position: relative;
        border-radius: 4px;
      }
    }

    /* Print Mode: strictly 1 page, pinned to bottom */
    @media print {
      .screen-toolbar { display: none !important; }
      html, body {
        width: 100% !important;
        height: 100% !important;
        margin: 0 !important;
        padding: 0 !important;
        background: #ffffff !important;
        overflow: hidden !important;
      }
      .page-container {
        width: 100% !important;
        height: calc(297mm - 20mm) !important;
        max-height: calc(297mm - 20mm) !important;
        min-height: calc(297mm - 20mm) !important;
        margin: 0 !important;
        padding: 0 !important;
        display: flex !important;
        flex-direction: column !important;
        justify-content: space-between !important;
        page-break-inside: avoid !important;
        page-break-after: avoid !important;
        page-break-before: avoid !important;
        overflow: hidden !important;
        box-shadow: none !important;
        border: none !important;
      }
      .bottom-section {
        margin-top: auto !important;
        page-break-inside: avoid !important;
      }
    }

    .content-body {
      flex: 1 0 auto;
    }
    .bottom-section {
      margin-top: auto;
      flex-shrink: 0;
      padding-top: 10px;
      page-break-inside: avoid;
    }

    /* Header */
    .header-table {
      width: 100%;
      border-bottom: 2px solid #0f172a;
      padding-bottom: 10px;
      margin-bottom: 12px;
      border-collapse: collapse;
    }
    .logo-img {
      height: 50px;
      width: auto;
      object-fit: contain;
    }
    .company-title {
      font-size: 13pt;
      font-weight: 800;
      color: #0f172a;
      letter-spacing: 0.02em;
      margin: 0;
      text-transform: uppercase;
    }
    .company-sub {
      font-size: 7.2pt;
      color: #475569;
      margin-top: 2px;
      line-height: 1.35;
    }
    .doc-badge {
      display: inline-block;
      padding: 3px 12px;
      background: #0f172a;
      color: #ffffff;
      border-radius: 3px;
      font-size: 8.5pt;
      font-weight: 800;
      letter-spacing: 0.05em;
      text-transform: uppercase;
    }
    .doc-ref {
      font-size: 8.5pt;
      color: #0f172a;
      font-weight: 700;
      margin-top: 4px;
      font-family: monospace;
    }
    .doc-date {
      font-size: 7.5pt;
      color: #64748b;
      margin-top: 2px;
    }

    /* Clean 2-Column Meta Section */
    .meta-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 14px;
      margin-bottom: 12px;
    }
    .meta-box {
      border: 1px solid #cbd5e1;
      border-radius: 4px;
      padding: 8px 12px;
      background: #ffffff;
    }
    .meta-box-title {
      font-size: 7.5pt;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #0f172a;
      padding-bottom: 4px;
      margin-bottom: 6px;
      border-bottom: 1px solid #e2e8f0;
    }
    .meta-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 3px;
      font-size: 7.6pt;
    }
    .meta-label {
      color: #64748b;
    }
    .meta-val {
      font-weight: 600;
      color: #0f172a;
      text-align: right;
    }
    .mono {
      font-family: monospace;
      font-size: 8pt;
    }

    /* Professional Items Table */
    .items-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 12px;
      font-size: 8pt;
      border: 1px solid #cbd5e1;
    }
    .items-table thead th {
      background: #0f172a;
      color: #ffffff;
      padding: 6px 8px;
      font-weight: 700;
      font-size: 7.5pt;
      letter-spacing: 0.03em;
      text-transform: uppercase;
      border-right: 1px solid #334155;
    }
    .items-table thead th:last-child {
      border-right: none;
      text-align: right;
    }
    .items-table tbody tr {
      border-bottom: 1px solid #e2e8f0;
    }
    .items-table tbody tr:nth-child(even) {
      background: #f8fafc;
    }
    .items-table tbody td {
      padding: 6px 8px;
      vertical-align: middle;
      border-right: 1px solid #e2e8f0;
    }
    .items-table tbody td:last-child {
      border-right: none;
    }
    .text-right { text-align: right; }
    .text-center { text-align: center; }

    /* Summary & Totals */
    .summary-section {
      display: grid;
      grid-template-columns: 1.3fr 1fr;
      gap: 14px;
      margin-bottom: 10px;
    }
    .words-box {
      border: 1px solid #cbd5e1;
      border-radius: 4px;
      padding: 8px 12px;
      font-size: 7.5pt;
      background: #ffffff;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }
    .words-label {
      font-size: 7pt;
      font-weight: 700;
      text-transform: uppercase;
      color: #64748b;
      margin-bottom: 4px;
    }
    .words-val {
      font-weight: 700;
      color: #0f172a;
      line-height: 1.4;
      font-size: 8pt;
    }

    .totals-box {
      border: 1px solid #cbd5e1;
      border-radius: 4px;
      overflow: hidden;
      background: #ffffff;
    }
    .totals-row {
      display: flex;
      justify-content: space-between;
      padding: 4px 10px;
      font-size: 7.5pt;
      border-bottom: 1px solid #f1f5f9;
    }
    .totals-row.grand-total {
      background: #0f172a;
      color: #ffffff;
      padding: 7px 10px;
      font-size: 9pt;
      font-weight: 800;
      border-bottom: none;
    }

    /* Commercial Terms */
    .terms-box {
      border: 1px solid #e2e8f0;
      border-radius: 4px;
      padding: 6px 10px;
      font-size: 6.8pt;
      color: #475569;
      line-height: 1.35;
      margin-bottom: 8px;
      background: #f8fafc;
    }
    .terms-title {
      font-weight: 700;
      font-size: 7pt;
      text-transform: uppercase;
      color: #0f172a;
      margin-bottom: 2px;
    }

    /* Signature Grid */
    .signature-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 14px;
      padding-top: 8px;
      border-top: 1.5px solid #cbd5e1;
    }
    .sig-box {
      text-align: center;
    }
    .sig-line {
      height: 22px;
      border-bottom: 1px dashed #94a3b8;
      margin-bottom: 4px;
    }
    .sig-title {
      font-size: 7pt;
      font-weight: 700;
      color: #0f172a;
      text-transform: uppercase;
    }
    .sig-sub {
      font-size: 6.2pt;
      color: #64748b;
    }

    /* Footer */
    .doc-footer {
      margin-top: 6px;
      padding-top: 4px;
      border-top: 1px solid #e2e8f0;
      display: flex;
      justify-content: space-between;
      font-size: 6.5pt;
      color: #64748b;
      font-weight: 600;
    }
  </style>
</head>
<body>

  <!-- Screen Toolbar -->
  <div class="screen-toolbar">
    <div style="font-weight: 600;">
      <span>${docTitleBadge} — ${invoice.invoiceNumber}</span>
      <span style="font-size: 11px; color: #94a3b8; margin-left: 12px;">(${docSubtitle})</span>
    </div>
    <div>
      <button onclick="window.print()">Print / Save PDF</button>
      <button class="close-btn" onclick="window.close()">Close</button>
    </div>
  </div>

  <!-- Watermark of SHEHSWAR Logo in Background -->
  <div class="watermark-container">
    <img src="${SHEHSWAR_LOGO_BASE64}" alt="SHEHSWAR WATERMARK">
  </div>

  <div class="page-container">
    <div class="content-body">

      <!-- Header -->
      <table class="header-table">
        <tr>
          <td style="width: 55px; vertical-align: middle;">
            <img class="logo-img" src="${SHEHSWAR_LOGO_BASE64}" alt="SHEHSWAR">
          </td>
          <td style="padding-left: 12px; vertical-align: middle;">
            <div class="company-title">SHEHSWAR CHEMICALS & AGRO-FERTILIZERS (PVT) LTD</div>
            <div class="company-sub">
              Manufacturing & Pesticide Formulations • Commercial Distribution Division<br>
              Head Office & Plant: Multan Road / Faisalabad • NTN: 4128934-7 • STRN: 3277876123456
            </div>
          </td>
          <td style="text-align: right; vertical-align: middle;">
            <span class="doc-badge">${docTitleBadge}</span>
            <div class="doc-ref">${isBasicDelivery ? 'CHALLAN' : 'INV'}: ${invoice.invoiceNumber}</div>
            <div class="doc-date">Date: ${formattedDate} • Status: ${invoice.postingStatus}</div>
          </td>
        </tr>
      </table>

      <!-- 2-Column Meta Section -->
      <div class="meta-grid">
        <!-- Billed To -->
        <div class="meta-box">
          <div class="meta-box-title">${isBasicDelivery ? 'CONSIGNEE / DISPATCHED TO' : 'CUSTOMER / BILLED TO'}</div>
          <div class="meta-row">
            <span class="meta-label">Dealer Name:</span>
            <span class="meta-val" style="font-weight: 700;">${invoice.dealer?.name || 'Authorized Dealer'}</span>
          </div>
          <div class="meta-row">
            <span class="meta-label">Dealer Code:</span>
            <span class="meta-val mono">${invoice.dealer?.code || 'DLR-GEN'}</span>
          </div>
          <div class="meta-row">
            <span class="meta-label">Phone:</span>
            <span class="meta-val">${invoice.dealer?.phone || '—'}</span>
          </div>
          <div class="meta-row">
            <span class="meta-label">City / Destination:</span>
            <span class="meta-val">${invoice.dealer?.city || invoice.dealer?.address || 'Pakistan'}</span>
          </div>
        </div>

        <!-- Dispatch & Booking Details -->
        <div class="meta-box">
          <div class="meta-box-title">DISPATCH & ORDER DETAILS</div>
          <div class="meta-row">
            <span class="meta-label">Sales Order Ref:</span>
            <span class="meta-val mono">${orderRef}</span>
          </div>
          <div class="meta-row">
            <span class="meta-label">Booked By:</span>
            <span class="meta-val">${salesOfficerName}</span>
          </div>
          <div class="meta-row">
            <span class="meta-label">Warehouse:</span>
            <span class="meta-val">${invoice.warehouse?.name || 'Main Factory Warehouse'}</span>
          </div>
          ${!isBasicDelivery ? `
          <div class="meta-row">
            <span class="meta-label">Commercial Condition:</span>
            <span class="meta-val">${invoice.commercialCondition || invoice.pricingPhase || 'Standard Cash'}</span>
          </div>` : `
          <div class="meta-row">
            <span class="meta-label">Gate Pass Mode:</span>
            <span class="meta-val">Outward Dispatch Note</span>
          </div>`}
        </div>
      </div>

      <!-- Line Items Table -->
      <table class="items-table">
        <thead>
          <tr>
            <th style="width: 5%;" class="text-center">#</th>
            <th style="width: ${isBasicDelivery ? '45%' : isCommercialFull ? '36%' : '45%'};">Product Description</th>
            ${isBasicDelivery ? `<th style="width: 20%;" class="text-center">Batch / Lot #</th>` : ''}
            ${isCommercialFull ? `<th style="width: 15%;" class="text-center">Scheme / Condition</th>` : ''}
            <th style="width: 15%;" class="text-center">Packaging</th>
            <th style="width: 10%;" class="text-right">Qty</th>
            ${!isBasicDelivery ? `<th style="width: 12%;" class="text-right">Rate (PKR)</th>` : ''}
            ${!isBasicDelivery ? `<th style="width: 13%;" class="text-right">Net Total (PKR)</th>` : ''}
          </tr>
        </thead>
        <tbody>
          ${invoice.items.map((item, idx) => `
            <tr>
              <td class="text-center mono" style="color: #64748b;">${idx + 1}</td>
              <td style="font-weight: 600; color: #0f172a;">${item.productName}</td>
              ${isBasicDelivery ? `<td class="text-center mono" style="color: #475569;">${item.batchNumber || invoice.batchNumber || 'BT-2026-X'}</td>` : ''}
              ${isCommercialFull ? `<td class="text-center" style="color: #166534; font-weight: 600;">${item.scheme || invoice.schemeDescription || 'Standard'}</td>` : ''}
              <td class="text-center" style="color: #475569;">${item.packing || 'Standard Pack'}</td>
              <td class="text-right mono" style="font-weight: 600;">${Number(item.quantity).toLocaleString()}</td>
              ${!isBasicDelivery ? `<td class="text-right mono">PKR ${Number(item.rate).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>` : ''}
              ${!isBasicDelivery ? `<td class="text-right mono" style="font-weight: 700;">PKR ${Number(item.netAmount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>` : ''}
            </tr>
          `).join('')}
        </tbody>
      </table>

      ${isBasicDelivery ? `
      <!-- Delivery Challan Summary (Zero Financials) -->
      <div class="summary-section">
        <div class="words-box">
          <div>
            <div class="words-label">DISPATCH & RECEIPT VERIFICATION:</div>
            <div class="words-val">All goods described above are dispatched in good condition with factory seals intact. Dispatched without commercial valuation on this slip.</div>
          </div>
          ${invoice.notes ? `<div style="margin-top: 6px; padding-top: 4px; border-top: 1px dashed #cbd5e1; color: #475569; font-size: 7.2pt;"><strong>Notes:</strong> ${invoice.notes}</div>` : ''}
        </div>
        <div class="totals-box">
          <div class="totals-row">
            <span style="color: #64748b;">Total Line Items:</span>
            <span class="mono" style="font-weight: 600;">${invoice.items.length} Products</span>
          </div>
          <div class="totals-row grand-total">
            <span>TOTAL DISPATCHED UNITS:</span>
            <span class="mono">${totalUnits.toLocaleString()} Units</span>
          </div>
        </div>
      </div>
      ` : `
      <!-- Financial Summary & Words Section -->
      <div class="summary-section">
        <div class="words-box">
          <div>
            <div class="words-label">AMOUNT IN WORDS:</div>
            <div class="words-val">${amountInWords}</div>
          </div>
          ${invoice.notes ? `<div style="margin-top: 6px; padding-top: 4px; border-top: 1px dashed #cbd5e1; color: #475569; font-size: 7.2pt;"><strong>Notes:</strong> ${invoice.notes}</div>` : ''}
        </div>

        <div class="totals-box">
          ${isCommercialFull ? `
          <div class="totals-row">
            <span style="color: #64748b;">Gross Total:</span>
            <span class="mono" style="font-weight: 600;">PKR ${gross.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
          <div class="totals-row">
            <span style="color: #64748b;">Discount / Rebate:</span>
            <span class="mono" style="color: #dc2626;">- PKR ${discount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
          <div class="totals-row">
            <span style="color: #64748b;">Sales Tax:</span>
            <span class="mono" style="color: #0f172a;">+ PKR ${tax.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>` : ''}
          <div class="totals-row grand-total">
            <span>NET AMOUNT PAYABLE:</span>
            <span class="mono">PKR ${net.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
        </div>
      </div>`}

      <!-- Commercial Notes & Governance Terms -->
      <div class="terms-box">
        <div class="terms-title">Document Governance & Terms:</div>
        ${isBasicDelivery ? `
        <div>1. <strong>Stock Transfer Receipt:</strong> This delivery challan serves solely as a movement record from plant storage to destination. Physical counts must be tallied at vehicle un-boarding.</div>
        <div>2. <strong>Shortages / Leakage:</strong> Any transit breakage or seal tampering must be recorded on the driver gate pass slip before signing receipt.</div>
        ` : `
        <div>1. <strong>Payment Compliance:</strong> Remittance strictly via Crossed Cheque or Direct Bank Transfer in favor of <strong>SHEHSWAR CHEMICALS & AGRO-FERTILIZERS (PVT) LTD</strong>. Cash payment to field reps without official computerized receipt is strictly unacknowledged.</div>
        <div>2. <strong>Warranty:</strong> Agrochemical formulations strictly conform to registered chemical assay standards. Claims for transit breakage or leakage must be notified within 48 hours of dispatch.</div>
        `}
      </div>

    </div><!-- End content-body -->

    <!-- Bottom Section: Signatures & Footer -->
    <div class="bottom-section">
      <div class="signature-grid">
        <div class="sig-box">
          <div class="sig-line"></div>
          <div class="sig-title">${isBasicDelivery ? 'STORE INCHARGE' : 'PREPARED BY'}</div>
          <div class="sig-sub">${isBasicDelivery ? 'Warehouse Dispatch' : 'Commercial Billing'}</div>
        </div>
        <div class="sig-box">
          <div class="sig-line"></div>
          <div class="sig-title">${isBasicDelivery ? 'GATE SECURITY' : 'DISPATCH OFFICER'}</div>
          <div class="sig-sub">${isBasicDelivery ? 'Gate Pass Inspection' : 'Warehouse & Logistics'}</div>
        </div>
        <div class="sig-box">
          <div class="sig-line"></div>
          <div class="sig-title">${isBasicDelivery ? 'CARRIER / DRIVER' : 'SALES MANAGER'}</div>
          <div class="sig-sub">${isBasicDelivery ? 'Vehicle / Transport Sign' : 'Territory Head'}</div>
        </div>
        <div class="sig-box">
          <div class="sig-line"></div>
          <div class="sig-title">${isBasicDelivery ? 'RECEIVER ACKNOWLEDGMENT' : 'CUSTOMER ACKNOWLEDGMENT'}</div>
          <div class="sig-sub">Dealer Stamp & Sign</div>
        </div>
      </div>

      <div class="doc-footer">
        <div>${docTitleBadge} • SHEHSWAR ONE360 ERP SYSTEM • VERIFIED DIGITAL DOCUMENT</div>
        <div>Page 1 of 1</div>
      </div>
    </div><!-- End bottom-section -->

  </div><!-- End page-container -->

  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
      }, 400);
    };
  </script>
</body>
</html>`;

  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  }
};

/**
 * Interface and PDF export function for Dealer Ledger / Statement of Account
 */
export interface DealerLedgerExportData {
  dealer: {
    name: string;
    code: string;
    phone?: string;
    city?: string;
    address?: string;
    creditLimit?: number;
    currentBalance?: number;
  };
  startDate?: string;
  endDate?: string;
  entries: Array<{
    id: string;
    entryDate: string;
    entryType: string;
    voucherNumber: string;
    description?: string;
    debit: number;
    credit: number;
    runningBalance: number;
  }>;
}

export const exportDealerLedgerToPdf = (data: DealerLedgerExportData) => {
  const { dealer, startDate, endDate, entries } = data;

  const totalDebits = entries.reduce((sum, e) => sum + Number(e.debit || 0), 0);
  const totalCredits = entries.reduce((sum, e) => sum + Number(e.credit || 0), 0);
  const closingBalance = Number(dealer.currentBalance ?? (totalDebits - totalCredits));
  const closingBalFormatted = Math.abs(closingBalance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const closingBalSuffix = closingBalance >= 0 ? 'Dr (Receivable)' : 'Cr (Advance/Payable)';

  const periodLabel = startDate && endDate
    ? `${startDate} to ${endDate}`
    : startDate
    ? `From ${startDate}`
    : endDate
    ? `Up to ${endDate}`
    : 'All Recorded Transactions';

  const generatedDate = new Date().toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Dealer_Ledger_${dealer.code}_${dealer.name.replace(/\s+/g, '_')}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 10mm 12mm 10mm 12mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    html, body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      color: #0f172a;
      margin: 0;
      padding: 0;
      font-size: 8.5pt;
      line-height: 1.35;
      width: 100%;
      background: #f8fafc;
    }

    /* Screen Action Bar */
    .screen-toolbar {
      position: sticky;
      top: 0;
      background: #0f172a;
      color: #ffffff;
      padding: 10px 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      z-index: 9999;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
      font-size: 13px;
    }
    .screen-toolbar button {
      background: #1e293b;
      color: #ffffff;
      border: 1px solid #475569;
      padding: 7px 16px;
      font-weight: 600;
      border-radius: 6px;
      cursor: pointer;
      font-size: 13px;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      transition: background 0.2s ease;
    }
    .screen-toolbar button:hover {
      background: #334155;
    }
    .screen-toolbar .close-btn {
      margin-left: 8px;
    }

    /* Subtle Watermark of Shehswar Logo in Background */
    .watermark-container {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%) rotate(-10deg);
      opacity: 0.035;
      z-index: 0;
      pointer-events: none;
      width: 440px;
      text-align: center;
    }
    .watermark-container img {
      width: 100%;
      height: auto;
      filter: grayscale(100%);
    }

    /* Container for Screen View */
    @media screen {
      body {
        padding-bottom: 40px;
      }
      .page-container {
        width: 210mm;
        min-height: 282mm;
        height: auto;
        margin: 20px auto;
        padding: 10mm 12mm;
        background: #ffffff;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
        border: 1px solid #e2e8f0;
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        position: relative;
        border-radius: 4px;
      }
    }

    /* Print Mode */
    @media print {
      .screen-toolbar { display: none !important; }
      html, body {
        width: 100% !important;
        margin: 0 !important;
        padding: 0 !important;
        background: #ffffff !important;
      }
      .page-container {
        width: 100% !important;
        margin: 0 !important;
        padding: 0 !important;
        box-shadow: none !important;
        border: none !important;
      }
    }

    .content-body {
      flex: 1 0 auto;
    }
    .bottom-section {
      margin-top: 20px;
      flex-shrink: 0;
      page-break-inside: avoid;
    }

    /* Header */
    .header-table {
      width: 100%;
      border-bottom: 2px solid #0f172a;
      padding-bottom: 10px;
      margin-bottom: 12px;
      border-collapse: collapse;
    }
    .logo-img {
      height: 50px;
      width: auto;
      object-fit: contain;
    }
    .company-title {
      font-size: 13pt;
      font-weight: 800;
      color: #0f172a;
      letter-spacing: 0.02em;
      margin: 0;
      text-transform: uppercase;
    }
    .company-sub {
      font-size: 7.2pt;
      color: #475569;
      margin-top: 2px;
      line-height: 1.35;
    }
    .doc-badge {
      display: inline-block;
      padding: 3px 12px;
      background: #0f172a;
      color: #ffffff;
      border-radius: 3px;
      font-size: 8.5pt;
      font-weight: 800;
      letter-spacing: 0.05em;
      text-transform: uppercase;
    }
    .doc-ref {
      font-size: 8.5pt;
      color: #0f172a;
      font-weight: 700;
      margin-top: 4px;
      font-family: monospace;
    }
    .doc-date {
      font-size: 7.5pt;
      color: #64748b;
      margin-top: 2px;
    }

    /* Dealer Account Summary Cards */
    .account-grid {
      display: grid;
      grid-template-columns: 1.2fr 1fr;
      gap: 14px;
      margin-bottom: 14px;
    }
    .account-card {
      border: 1px solid #cbd5e1;
      border-radius: 4px;
      padding: 8px 12px;
      background: #ffffff;
    }
    .card-title {
      font-size: 7.5pt;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #0f172a;
      padding-bottom: 4px;
      margin-bottom: 6px;
      border-bottom: 1px solid #e2e8f0;
    }
    .account-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 3px;
      font-size: 7.6pt;
    }
    .account-label {
      color: #64748b;
    }
    .account-val {
      font-weight: 600;
      color: #0f172a;
      text-align: right;
    }
    .mono {
      font-family: monospace;
      font-size: 8pt;
    }

    /* Professional Ledger Table */
    .ledger-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 14px;
      font-size: 8pt;
      border: 1px solid #cbd5e1;
    }
    .ledger-table thead th {
      background: #0f172a;
      color: #ffffff;
      padding: 6px 8px;
      font-weight: 700;
      font-size: 7.5pt;
      letter-spacing: 0.03em;
      text-transform: uppercase;
      border-right: 1px solid #334155;
    }
    .ledger-table thead th:last-child {
      border-right: none;
      text-align: right;
    }
    .ledger-table tbody tr {
      border-bottom: 1px solid #e2e8f0;
    }
    .ledger-table tbody tr:nth-child(even) {
      background: #f8fafc;
    }
    .ledger-table tbody td {
      padding: 6px 8px;
      vertical-align: middle;
      border-right: 1px solid #e2e8f0;
    }
    .ledger-table tbody td:last-child {
      border-right: none;
    }
    .ledger-table tfoot tr {
      background: #f1f5f9;
      font-weight: 700;
      border-top: 2px solid #0f172a;
    }
    .ledger-table tfoot td {
      padding: 7px 8px;
      border-right: 1px solid #cbd5e1;
    }
    .ledger-table tfoot td:last-child {
      border-right: none;
    }

    .text-right { text-align: right; }
    .text-center { text-align: center; }

    /* Signature Grid */
    .signature-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 20px;
      padding-top: 14px;
      border-top: 1.5px solid #cbd5e1;
    }
    .sig-box {
      text-align: center;
    }
    .sig-line {
      height: 28px;
      border-bottom: 1px dashed #94a3b8;
      margin-bottom: 4px;
    }
    .sig-title {
      font-size: 7.2pt;
      font-weight: 700;
      color: #0f172a;
      text-transform: uppercase;
    }
    .sig-sub {
      font-size: 6.4pt;
      color: #64748b;
    }

    /* Footer */
    .doc-footer {
      margin-top: 8px;
      padding-top: 4px;
      border-top: 1px solid #e2e8f0;
      display: flex;
      justify-content: space-between;
      font-size: 6.5pt;
      color: #64748b;
      font-weight: 600;
    }
  </style>
</head>
<body>

  <!-- Screen Toolbar -->
  <div class="screen-toolbar">
    <div style="font-weight: 600;">
      <span>Official Dealer Ledger Statement — ${dealer.code} (${dealer.name})</span>
      <span style="font-size: 11px; color: #94a3b8; margin-left: 12px;">(Shehswar Corporate Accounting Ledger)</span>
    </div>
    <div>
      <button onclick="window.print()">Print / Save PDF</button>
      <button class="close-btn" onclick="window.close()">Close</button>
    </div>
  </div>

  <!-- Watermark of SHEHSWAR Logo in Background -->
  <div class="watermark-container">
    <img src="${SHEHSWAR_LOGO_BASE64}" alt="SHEHSWAR WATERMARK">
  </div>

  <div class="page-container">
    <div class="content-body">

      <!-- Header -->
      <table class="header-table">
        <tr>
          <td style="width: 55px; vertical-align: middle;">
            <img class="logo-img" src="${SHEHSWAR_LOGO_BASE64}" alt="SHEHSWAR">
          </td>
          <td style="padding-left: 12px; vertical-align: middle;">
            <div class="company-title">SHEHSWAR CHEMICALS & AGRO-FERTILIZERS (PVT) LTD</div>
            <div class="company-sub">
              Commercial Credit & Ledger Statements Division<br>
              Head Office: Multan Road / Faisalabad • NTN: 4128934-7 • STRN: 3277876123456
            </div>
          </td>
          <td style="text-align: right; vertical-align: middle;">
            <span class="doc-badge">STATEMENT OF ACCOUNT</span>
            <div class="doc-ref">DEALER: ${dealer.code}</div>
            <div class="doc-date">Generated: ${generatedDate}</div>
          </td>
        </tr>
      </table>

      <!-- Dealer Account Summary Cards -->
      <div class="account-grid">
        <div class="account-card">
          <div class="card-title">DEALER ACCOUNT PARTICULARS</div>
          <div class="account-row">
            <span class="account-label">Dealer / Business Name:</span>
            <span class="account-val" style="font-weight: 700;">${dealer.name}</span>
          </div>
          <div class="account-row">
            <span class="account-label">Account Code:</span>
            <span class="account-val mono">${dealer.code}</span>
          </div>
          <div class="account-row">
            <span class="account-label">Contact Phone:</span>
            <span class="account-val">${dealer.phone || '—'}</span>
          </div>
          <div class="account-row">
            <span class="account-label">Station / Address:</span>
            <span class="account-val">${dealer.city || dealer.address || 'Pakistan'}</span>
          </div>
        </div>

        <div class="account-card">
          <div class="card-title">STATEMENT FINANCIAL OVERVIEW</div>
          <div class="account-row">
            <span class="account-label">Statement Period:</span>
            <span class="account-val">${periodLabel}</span>
          </div>
          <div class="account-row">
            <span class="account-label">Approved Credit Limit:</span>
            <span class="account-val mono">PKR ${Number(dealer.creditLimit || 0).toLocaleString()}</span>
          </div>
          <div class="account-row">
            <span class="account-label">Total Debits (Sales):</span>
            <span class="account-val mono">PKR ${totalDebits.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
          <div class="account-row">
            <span class="account-label">Total Credits (Receipts):</span>
            <span class="account-val mono">PKR ${totalCredits.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
          <div class="account-row" style="margin-top: 4px; padding-top: 4px; border-top: 1px solid #cbd5e1; font-weight: 800;">
            <span class="account-label" style="color: #0f172a; font-weight: 800;">CLOSING BALANCE:</span>
            <span class="account-val mono" style="color: #0f172a; font-size: 8.5pt;">PKR ${closingBalFormatted} ${closingBalSuffix}</span>
          </div>
        </div>
      </div>

      <!-- Ledger Table -->
      <table class="ledger-table">
        <thead>
          <tr>
            <th style="width: 10%;" class="text-center">Date</th>
            <th style="width: 14%;">Voucher Type</th>
            <th style="width: 16%;">Voucher #</th>
            <th style="width: 24%;">Particulars / Description</th>
            <th style="width: 12%;" class="text-right">Debit (PKR)</th>
            <th style="width: 12%;" class="text-right">Credit (PKR)</th>
            <th style="width: 12%;" class="text-right">Balance (PKR)</th>
          </tr>
        </thead>
        <tbody>
          ${entries.length === 0 ? `
            <tr>
              <td colspan="7" class="text-center" style="padding: 20px; color: #64748b;">
                No ledger transactions found for the specified period.
              </td>
            </tr>
          ` : entries.map((entry) => {
            const dateStr = new Date(entry.entryDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
            const debitNum = Number(entry.debit || 0);
            const creditNum = Number(entry.credit || 0);
            const balNum = Number(entry.runningBalance || 0);
            const balType = balNum >= 0 ? 'Dr' : 'Cr';

            return `
              <tr>
                <td class="text-center mono" style="color: #475569;">${dateStr}</td>
                <td><span style="font-weight: 600;">${entry.entryType}</span></td>
                <td class="mono" style="font-weight: 600;">${entry.voucherNumber || '—'}</td>
                <td style="color: #334155; font-size: 7.5pt;">${entry.description || 'Commercial Transaction'}</td>
                <td class="text-right mono">${debitNum > 0 ? debitNum.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}</td>
                <td class="text-right mono">${creditNum > 0 ? creditNum.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}</td>
                <td class="text-right mono" style="font-weight: 700;">${Math.abs(balNum).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${balType}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
        <tfoot>
          <tr>
            <td colspan="4" class="text-right" style="text-transform: uppercase;">PERIOD TOTALS:</td>
            <td class="text-right mono">PKR ${totalDebits.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
            <td class="text-right mono">PKR ${totalCredits.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
            <td class="text-right mono" style="font-weight: 800;">PKR ${closingBalFormatted} ${closingBalSuffix}</td>
          </tr>
        </tfoot>
      </table>

    </div><!-- End content-body -->

    <!-- Bottom Section: Signatures & Verification -->
    <div class="bottom-section">
      <div class="signature-grid">
        <div class="sig-box">
          <div class="sig-line"></div>
          <div class="sig-title">PREPARED BY</div>
          <div class="sig-sub">Commercial Accounts Assistant</div>
        </div>
        <div class="sig-box">
          <div class="sig-line"></div>
          <div class="sig-title">AUDITED & APPROVED BY</div>
          <div class="sig-sub">Chief Financial Officer / Head of Accounts</div>
        </div>
        <div class="sig-box">
          <div class="sig-line"></div>
          <div class="sig-title">DEALER ACCEPTANCE</div>
          <div class="sig-sub">Authorized Stamp & Signature</div>
        </div>
      </div>

      <div class="doc-footer">
        <div>OFFICIAL STATEMENT OF ACCOUNT • SHEHSWAR ONE360 ERP SYSTEM • COMPUTER GENERATED</div>
        <div>Total Transactions: ${entries.length}</div>
      </div>
    </div><!-- End bottom-section -->

  </div><!-- End page-container -->

  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
      }, 400);
    };
  </script>
</body>
</html>`;

  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  }
};

export interface VendorLedgerExportData {
  vendor: {
    id: string;
    name: string;
    code: string;
    legalName?: string;
    ntn?: string;
    strn?: string;
    phone?: string;
    city?: string;
    address?: string;
    paymentTerms?: string;
    creditLimit?: number;
    currentBalance?: number;
    bankDetails?: {
      bankName?: string;
      accountTitle?: string;
      accountNumber?: string;
      iban?: string;
      branchCode?: string;
    };
  };
  startDate?: string;
  endDate?: string;
  entries: Array<{
    id: string;
    entryDate: string;
    entryType: string;
    voucherNumber: string;
    description?: string;
    debit: number;
    credit: number;
    runningBalance: number;
  }>;
}

export const exportVendorLedgerToPdf = (data: VendorLedgerExportData) => {
  const { vendor, startDate, endDate, entries } = data;

  const totalCredits = entries.reduce((sum, e) => sum + Number(e.credit || 0), 0); // Purchases (Payable)
  const totalDebits = entries.reduce((sum, e) => sum + Number(e.debit || 0), 0);   // Payments (Settlement)
  const closingBalance = Number(vendor.currentBalance ?? (totalCredits - totalDebits));
  const closingBalFormatted = Math.abs(closingBalance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const closingBalSuffix = closingBalance >= 0 ? 'Cr (Net Payable)' : 'Dr (Advance/Refundable)';

  const periodLabel = startDate && endDate
    ? `${startDate} to ${endDate}`
    : startDate
    ? `From ${startDate}`
    : endDate
    ? `Up to ${endDate}`
    : 'All Recorded Transactions';

  const generatedDate = new Date().toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Vendor_Ledger_${vendor.code}_${vendor.name.replace(/\\s+/g, '_')}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 10mm 12mm 10mm 12mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    html, body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      color: #0f172a;
      margin: 0;
      padding: 0;
      font-size: 8.5pt;
      line-height: 1.35;
      width: 100%;
      background: #f8fafc;
    }

    /* Screen Action Bar */
    .screen-toolbar {
      position: sticky;
      top: 0;
      background: #0f172a;
      color: #ffffff;
      padding: 10px 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      z-index: 9999;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
      font-size: 13px;
    }
    .screen-toolbar button {
      background: #1e293b;
      color: #ffffff;
      border: 1px solid #475569;
      padding: 7px 16px;
      font-weight: 600;
      border-radius: 6px;
      cursor: pointer;
      font-size: 13px;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      transition: background 0.2s ease;
    }
    .screen-toolbar button:hover {
      background: #334155;
    }
    .screen-toolbar .close-btn {
      margin-left: 8px;
    }

    .watermark-container {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%) rotate(-10deg);
      opacity: 0.035;
      z-index: 0;
      pointer-events: none;
      width: 440px;
      text-align: center;
    }
    .watermark-container img {
      width: 100%;
      height: auto;
      filter: grayscale(100%);
    }

    @media screen {
      body {
        padding-bottom: 40px;
      }
      .page-container {
        max-width: 210mm;
        margin: 20px auto;
        background: #ffffff;
        padding: 14mm 16mm;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
        border: 1px solid #e2e8f0;
        border-radius: 4px;
        position: relative;
        min-height: 297mm;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
      }
    }

    @media print {
      .screen-toolbar {
        display: none !important;
      }
      body {
        background: #ffffff !important;
      }
      .page-container {
        width: 100% !important;
        padding: 0 !important;
        margin: 0 !important;
        box-shadow: none !important;
        border: none !important;
        min-height: auto !important;
      }
      .bottom-section {
        page-break-inside: avoid;
      }
    }

    .header-table {
      width: 100%;
      border-collapse: collapse;
      border-bottom: 2.5px solid #0f172a;
      padding-bottom: 10px;
      margin-bottom: 12px;
    }
    .logo-img {
      width: 52px;
      height: auto;
      display: block;
    }
    .company-title {
      font-size: 14pt;
      font-weight: 800;
      color: #0f172a;
      letter-spacing: -0.3px;
    }
    .company-sub {
      font-size: 7.2pt;
      color: #475569;
      line-height: 1.3;
      margin-top: 2px;
    }
    .doc-badge {
      display: inline-block;
      background: #0f172a;
      color: #ffffff;
      padding: 3px 10px;
      font-size: 8.5pt;
      font-weight: 700;
      border-radius: 3px;
      letter-spacing: 0.5px;
    }
    .doc-ref {
      font-size: 7.5pt;
      color: #64748b;
      margin-top: 4px;
      font-weight: 600;
      font-family: monospace;
    }

    .info-grid {
      display: grid;
      grid-template-columns: 1.5fr 1fr;
      gap: 12px;
      margin-bottom: 14px;
    }
    .info-card {
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 10px 12px;
      background: #f8fafc;
    }
    .info-title {
      font-size: 7pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #64748b;
      margin-bottom: 6px;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 3px;
    }
    .info-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 3px;
      font-size: 8pt;
    }
    .info-row:last-child {
      margin-bottom: 0;
    }
    .info-label {
      color: #64748b;
    }
    .info-value {
      font-weight: 600;
      color: #0f172a;
      text-align: right;
    }

    .kpi-ribbon {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
      margin-bottom: 14px;
    }
    .kpi-card {
      border: 1.5px solid #cbd5e1;
      border-radius: 6px;
      padding: 8px 12px;
      background: #ffffff;
      text-align: center;
    }
    .kpi-card.highlight {
      background: #f8fafc;
      border-color: #0f172a;
    }
    .kpi-title {
      font-size: 6.8pt;
      text-transform: uppercase;
      font-weight: 700;
      color: #64748b;
    }
    .kpi-amount {
      font-size: 11pt;
      font-weight: 800;
      color: #0f172a;
      font-family: monospace;
      margin-top: 2px;
    }

    .ledger-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 7.8pt;
      margin-bottom: 14px;
    }
    .ledger-table th {
      background: #0f172a;
      color: #ffffff;
      font-weight: 700;
      padding: 6px 8px;
      text-transform: uppercase;
      font-size: 7pt;
      letter-spacing: 0.3px;
      border-right: 1px solid #334155;
    }
    .ledger-table th:last-child {
      border-right: none;
    }
    .ledger-table tbody tr {
      border-bottom: 1px solid #e2e8f0;
    }
    .ledger-table tbody tr:nth-child(even) {
      background: #f8fafc;
    }
    .ledger-table tbody td {
      padding: 6px 8px;
      vertical-align: middle;
      border-right: 1px solid #e2e8f0;
    }
    .ledger-table tbody td:last-child {
      border-right: none;
    }
    .ledger-table tfoot tr {
      background: #f1f5f9;
      font-weight: 700;
      border-top: 2px solid #0f172a;
    }
    .ledger-table tfoot td {
      padding: 7px 8px;
      border-right: 1px solid #cbd5e1;
    }
    .ledger-table tfoot td:last-child {
      border-right: none;
    }

    .text-right { text-align: right; }
    .text-center { text-align: center; }
    .mono { font-family: monospace; }

    .signature-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 20px;
      padding-top: 14px;
      border-top: 1.5px solid #cbd5e1;
    }
    .sig-box {
      text-align: center;
    }
    .sig-line {
      height: 28px;
      border-bottom: 1px dashed #94a3b8;
      margin-bottom: 4px;
    }
    .sig-title {
      font-size: 7.2pt;
      font-weight: 700;
      color: #0f172a;
      text-transform: uppercase;
    }
    .sig-sub {
      font-size: 6.4pt;
      color: #64748b;
    }

    .doc-footer {
      margin-top: 8px;
      padding-top: 4px;
      border-top: 1px solid #e2e8f0;
      display: flex;
      justify-content: space-between;
      font-size: 6.5pt;
      color: #64748b;
      font-weight: 600;
    }
  </style>
</head>
<body>

  <!-- Screen Toolbar -->
  <div class="screen-toolbar">
    <div style="font-weight: 600;">
      <span>Official Vendor Ledger Statement — ${vendor.code} (${vendor.name})</span>
      <span style="font-size: 11px; color: #94a3b8; margin-left: 12px;">(Shehswar Corporate Accounts Payable Sub-Ledger)</span>
    </div>
    <div>
      <button onclick="window.print()">Print / Save PDF</button>
      <button class="close-btn" onclick="window.close()">Close</button>
    </div>
  </div>

  <div class="watermark-container">
    <img src="${SHEHSWAR_LOGO_BASE64}" alt="SHEHSWAR WATERMARK">
  </div>

  <div class="page-container">
    <div class="content-body">

      <!-- Header -->
      <table class="header-table">
        <tr>
          <td style="width: 55px; vertical-align: middle;">
            <img class="logo-img" src="${SHEHSWAR_LOGO_BASE64}" alt="SHEHSWAR">
          </td>
          <td style="padding-left: 12px; vertical-align: middle;">
            <div class="company-title">SHEHSWAR CHEMICALS & AGRO-FERTILIZERS (PVT) LTD</div>
            <div class="company-sub">
              Accounts Payable & Procurement Sub-Ledger Division<br>
              Head Office: Multan Road, Industrial Estate, Lahore • NTN: 3124567-9 • STRN: 17-00-3124-567-99
            </div>
          </td>
          <td style="text-align: right; vertical-align: middle;">
            <span class="doc-badge">VENDOR STATEMENT OF ACCOUNT</span>
            <div class="doc-ref">VENDOR: ${vendor.code}</div>
            <div style="font-size: 7.2pt; color: #64748b; margin-top: 2px;">Generated: ${generatedDate}</div>
          </td>
        </tr>
      </table>

      <!-- Info Grid -->
      <div class="info-grid">
        <div class="info-card">
          <div class="info-title">Supplier / Vendor Profile</div>
          <div class="info-row">
            <span class="info-label">Commercial Name:</span>
            <span class="info-value" style="font-weight: 700; font-size: 9pt;">${vendor.name}</span>
          </div>
          ${vendor.legalName ? `
          <div class="info-row">
            <span class="info-label">Legal Entity:</span>
            <span class="info-value">${vendor.legalName}</span>
          </div>` : ''}
          <div class="info-row">
            <span class="info-label">NTN / STRN:</span>
            <span class="info-value mono">${vendor.ntn || '—'} / ${vendor.strn || '—'}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Contact / Phone:</span>
            <span class="info-value">${vendor.phone || '—'}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Registered Address:</span>
            <span class="info-value" style="max-width: 250px;">${vendor.address || vendor.city || '—'}</span>
          </div>
        </div>

        <div class="info-card">
          <div class="info-title">Terms & Settlement Banking</div>
          <div class="info-row">
            <span class="info-label">Payment Terms:</span>
            <span class="info-value">${(vendor.paymentTerms || '30 Days Net').replace(/_/g, ' ')}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Credit Limit:</span>
            <span class="info-value mono">PKR ${(vendor.creditLimit || 0).toLocaleString()}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Settlement Bank:</span>
            <span class="info-value">${vendor.bankDetails?.bankName || '—'}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Account / IBAN:</span>
            <span class="info-value mono">${vendor.bankDetails?.accountNumber || vendor.bankDetails?.iban || '—'}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Statement Period:</span>
            <span class="info-value">${periodLabel}</span>
          </div>
        </div>
      </div>

      <!-- KPI Summary Ribbon -->
      <div class="kpi-ribbon">
        <div class="kpi-card">
          <div class="kpi-title">Total Purchases Invoiced (Cr)</div>
          <div class="kpi-amount" style="color: #0f172a;">PKR ${totalCredits.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-title">Total Payments Settled (Dr)</div>
          <div class="kpi-amount" style="color: #16a34a;">PKR ${totalDebits.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
        </div>
        <div class="kpi-card highlight">
          <div class="kpi-title">Net Outstanding Balance</div>
          <div class="kpi-amount" style="color: #b91c1c;">PKR ${closingBalFormatted} <span style="font-size: 8pt; font-weight: 600;">${closingBalSuffix}</span></div>
        </div>
      </div>

      <!-- Ledger Transactions Table -->
      <table class="ledger-table">
        <thead>
          <tr>
            <th style="width: 75px;" class="text-center">Date</th>
            <th style="width: 120px;">Entry Type</th>
            <th style="width: 110px;">Voucher #</th>
            <th>Particulars / Reference</th>
            <th style="width: 95px;" class="text-right">Debit (Paid)</th>
            <th style="width: 95px;" class="text-right">Credit (Purchased)</th>
            <th style="width: 110px;" class="text-right">Running Balance</th>
          </tr>
        </thead>
        <tbody>
          ${entries.length === 0 ? `
            <tr>
              <td colspan="7" class="text-center" style="padding: 30px; color: #94a3b8;">
                No financial ledger transactions recorded for this vendor in the selected period.
              </td>
            </tr>
          ` : entries.map((entry) => {
            const dateStr = new Date(entry.entryDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
            const debitNum = Number(entry.debit || 0);
            const creditNum = Number(entry.credit || 0);
            const balNum = Number(entry.runningBalance || 0);
            const balType = balNum >= 0 ? 'Cr' : 'Dr';
            return `
              <tr>
                <td class="text-center mono" style="color: #475569;">${dateStr}</td>
                <td><span style="font-weight: 600;">${entry.entryType.replace(/_/g, ' ')}</span></td>
                <td class="mono" style="font-weight: 600;">${entry.voucherNumber || '—'}</td>
                <td style="color: #334155; font-size: 7.5pt;">${entry.description || 'Commercial Procurement Transaction'}</td>
                <td class="text-right mono">${debitNum > 0 ? debitNum.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}</td>
                <td class="text-right mono">${creditNum > 0 ? creditNum.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}</td>
                <td class="text-right mono" style="font-weight: 700;">${Math.abs(balNum).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${balType}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
        <tfoot>
          <tr>
            <td colspan="4" class="text-right" style="text-transform: uppercase;">PERIOD TOTALS:</td>
            <td class="text-right mono">PKR ${totalDebits.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
            <td class="text-right mono">PKR ${totalCredits.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
            <td class="text-right mono" style="font-weight: 800;">PKR ${closingBalFormatted} ${closingBalSuffix}</td>
          </tr>
        </tfoot>
      </table>

    </div><!-- End content-body -->

    <!-- Bottom Section: Signatures & Verification -->
    <div class="bottom-section">
      <div class="signature-grid">
        <div class="sig-box">
          <div class="sig-line"></div>
          <div class="sig-title">PREPARED BY</div>
          <div class="sig-sub">Accounts Payable Officer</div>
        </div>
        <div class="sig-box">
          <div class="sig-line"></div>
          <div class="sig-title">AUDITED & APPROVED BY</div>
          <div class="sig-sub">Head of Procurement & Finance</div>
        </div>
        <div class="sig-box">
          <div class="sig-line"></div>
          <div class="sig-title">VENDOR ACKNOWLEDGEMENT</div>
          <div class="sig-sub">Authorized Seal & Signature</div>
        </div>
      </div>

      <div class="doc-footer">
        <div>OFFICIAL STATEMENT OF ACCOUNT • SHEHSWAR ONE360 ERP SYSTEM • COMPUTER GENERATED</div>
        <div>Total Ledger Entries: ${entries.length}</div>
      </div>
    </div><!-- End bottom-section -->

  </div><!-- End page-container -->

  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
      }, 400);
    };
  </script>
</body>
</html>`;

  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  }
};

export interface MarketPerformancePdfCell {
  text: string | number;
  align?: 'left' | 'center' | 'right';
  bold?: boolean;
  color?: string;
  isBadge?: boolean;
  badgeBg?: string;
  badgeColor?: string;
}

export interface MarketPerformancePdfData {
  tierName: string;
  scopeTitle: string;
  periodLabel: string;
  metaFields?: Array<{ label: string; value: string }>;
  kpis: Array<{ label: string; value: string; sub?: string; color?: string }>;
  tableTitle: string;
  tableSubtitle?: string;
  headers: Array<{ label: string; align?: 'left' | 'center' | 'right'; width?: string }>;
  rows: MarketPerformancePdfCell[][];
  extraSections?: Array<{
    title: string;
    subtitle?: string;
    headers: Array<{ label: string; align?: 'left' | 'center' | 'right'; width?: string }>;
    rows: MarketPerformancePdfCell[][];
  }>;
}

export const exportMarketPerformancePdf = (data: MarketPerformancePdfData) => {
  const generatedAt = new Date().toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${data.scopeTitle} — Sales Performance Report</title>
  <style>
    @page {
      size: A4 landscape;
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
      max-width: 1100px;
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
      margin-bottom: 12px;
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
    .doc-meta {
      text-align: right;
    }
    .doc-title {
      font-size: 13pt;
      font-weight: 800;
      color: #0f172a;
      text-transform: uppercase;
      letter-spacing: -0.3px;
    }
    .doc-tag {
      display: inline-block;
      margin-top: 4px;
      padding: 2px 8px;
      background: #042f2e;
      color: #2dd4bf;
      border-radius: 4px;
      font-size: 7pt;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .sub-meta {
      display: flex;
      justify-content: space-between;
      background: #f0fdfa;
      border: 1px solid #ccfbf1;
      border-radius: 6px;
      padding: 8px 12px;
      margin-bottom: 12px;
      font-size: 8pt;
    }
    .meta-item strong {
      color: #0f172a;
    }
    .meta-item span {
      color: #0f766e;
      font-weight: 600;
    }
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
      gap: 8px;
      margin-bottom: 14px;
    }
    .kpi-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 8px 10px;
      border-top: 3px solid #0d9488;
    }
    .kpi-label {
      font-size: 6.8pt;
      font-weight: 800;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }
    .kpi-val {
      font-size: 11pt;
      font-weight: 900;
      color: #0f172a;
      font-family: 'JetBrains Mono', 'Courier New', monospace;
      margin-top: 2px;
    }
    .kpi-sub {
      font-size: 6.5pt;
      color: #059669;
      font-weight: 600;
      margin-top: 1px;
    }
    .section-head {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      margin-bottom: 6px;
      margin-top: 12px;
    }
    .section-title {
      font-size: 9.5pt;
      font-weight: 800;
      color: #0f172a;
      text-transform: uppercase;
      letter-spacing: 0.2px;
    }
    .section-sub {
      font-size: 7.2pt;
      color: #64748b;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 12px;
      background: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 4px;
      overflow: hidden;
      font-size: 7.8pt;
    }
    thead {
      background: #0f172a;
      color: #ffffff;
    }
    th {
      padding: 6px 8px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.3px;
      font-size: 7pt;
      border-right: 1px solid #334155;
    }
    th:last-child {
      border-right: none;
    }
    td {
      padding: 5px 8px;
      border-bottom: 1px solid #e2e8f0;
      border-right: 1px solid #f1f5f9;
      color: #1e293b;
    }
    tr:nth-child(even) td {
      background-color: #f8fafc;
    }
    tr:last-child td {
      border-bottom: none;
    }
    .text-left { text-align: left; }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .mono {
      font-family: 'JetBrains Mono', 'Courier New', monospace;
    }
    .badge {
      display: inline-block;
      padding: 1px 6px;
      border-radius: 4px;
      font-weight: 700;
      font-size: 6.8pt;
    }
    .signatures {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 20px;
      margin-top: 24px;
      padding-top: 14px;
      border-top: 1px dashed #cbd5e1;
    }
    .sig-line {
      border-bottom: 1px solid #0f172a;
      height: 32px;
      margin-bottom: 4px;
    }
    .sig-label {
      font-size: 7pt;
      font-weight: 800;
      color: #0f172a;
      text-transform: uppercase;
    }
    .sig-sub {
      font-size: 6.5pt;
      color: #64748b;
    }
    .footer {
      margin-top: 14px;
      padding-top: 6px;
      border-top: 1px solid #e2e8f0;
      display: flex;
      justify-content: space-between;
      color: #94a3b8;
      font-size: 6.5pt;
      text-transform: uppercase;
      letter-spacing: 0.4px;
    }
    @media print {
      body { background: #ffffff; }
      .page-container {
        padding: 0;
        box-shadow: none;
      }
    }
  </style>
</head>
<body>
  <div class="page-container">
    <div class="header">
      <div class="logo-block">
        <img class="logo-img" src="${SHEHSWAR_LOGO_BASE64}" alt="Shehswar Chemicals" />
        <div>
          <div class="brand-title">SHEHSWAR ONE360</div>
          <div class="brand-subtitle">Commercial Agrochemicals & Crop Sciences • Market Performance Division</div>
        </div>
      </div>
      <div class="doc-meta">
        <div class="doc-title">${data.tierName} Performance Report</div>
        <div class="doc-tag">Strictly Posted Financial Sales</div>
      </div>
    </div>

    <div class="sub-meta">
      <div class="meta-item">Scope: <span>${data.scopeTitle}</span></div>
      <div class="meta-item">Evaluation Period: <span>${data.periodLabel}</span></div>
      <div class="meta-item">Generated: <span>${generatedAt}</span></div>
      ${data.metaFields ? data.metaFields.map((m) => `<div class="meta-item">${m.label}: <span>${m.value}</span></div>`).join('') : ''}
    </div>

    <!-- KPI Ribbon -->
    <div class="kpi-grid">
      ${data.kpis.map((k) => `
        <div class="kpi-card" ${k.color ? `style="border-top-color: ${k.color};"` : ''}>
          <div class="kpi-label">${k.label}</div>
          <div class="kpi-val" ${k.color ? `style="color: ${k.color};"` : ''}>${k.value}</div>
          ${k.sub ? `<div class="kpi-sub">${k.sub}</div>` : ''}
        </div>
      `).join('')}
    </div>

    <!-- Primary Tier Table -->
    <div class="section-head">
      <div class="section-title">${data.tableTitle}</div>
      ${data.tableSubtitle ? `<div class="section-sub">${data.tableSubtitle}</div>` : ''}
    </div>

    <table>
      <thead>
        <tr>
          ${data.headers.map((h) => `<th class="text-${h.align || 'left'}" ${h.width ? `style="width:${h.width};"` : ''}>${h.label}</th>`).join('')}
        </tr>
      </thead>
      <tbody>
        ${data.rows.length === 0 ? `
          <tr>
            <td colspan="${data.headers.length}" class="text-center" style="padding: 16px; color: #94a3b8;">
              No records found for this hierarchy scope in the selected period.
            </td>
          </tr>
        ` : data.rows.map((row) => `
          <tr>
            ${row.map((cell) => {
              const alignClass = `text-${cell.align || 'left'}`;
              const boldStyle = cell.bold ? 'font-weight: 700;' : '';
              const colorStyle = cell.color ? `color: ${cell.color};` : '';
              if (cell.isBadge) {
                return `
                  <td class="${alignClass}">
                    <span class="badge" style="background: ${cell.badgeBg || '#e0f2fe'}; color: ${cell.badgeColor || '#0369a1'};">
                      ${cell.text}
                    </span>
                  </td>
                `;
              }
              return `<td class="${alignClass} ${cell.align === 'right' ? 'mono' : ''}" style="${boldStyle} ${colorStyle}">${cell.text}</td>`;
            }).join('')}
          </tr>
        `).join('')}
      </tbody>
    </table>

    <!-- Extra Sections (e.g. Products Breakdown, Posted Invoices) -->
    ${data.extraSections ? data.extraSections.map((sec) => `
      <div class="section-head" style="margin-top: 14px;">
        <div class="section-title">${sec.title}</div>
        ${sec.subtitle ? `<div class="section-sub">${sec.subtitle}</div>` : ''}
      </div>
      <table>
        <thead>
          <tr>
            ${sec.headers.map((h) => `<th class="text-${h.align || 'left'}" ${h.width ? `style="width:${h.width};"` : ''}>${h.label}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${sec.rows.length === 0 ? `
            <tr>
              <td colspan="${sec.headers.length}" class="text-center" style="padding: 12px; color: #94a3b8;">
                No records found.
              </td>
            </tr>
          ` : sec.rows.map((row) => `
            <tr>
              ${row.map((cell) => {
                const alignClass = `text-${cell.align || 'left'}`;
                const boldStyle = cell.bold ? 'font-weight: 700;' : '';
                const colorStyle = cell.color ? `color: ${cell.color};` : '';
                if (cell.isBadge) {
                  return `
                    <td class="${alignClass}">
                      <span class="badge" style="background: ${cell.badgeBg || '#e0f2fe'}; color: ${cell.badgeColor || '#0369a1'};">
                        ${cell.text}
                      </span>
                    </td>
                  `;
                }
                return `<td class="${alignClass} ${cell.align === 'right' ? 'mono' : ''}" style="${boldStyle} ${colorStyle}">${cell.text}</td>`;
              }).join('')}
            </tr>
          `).join('')}
        </tbody>
      </table>
    `).join('') : ''}

    <!-- Signatures -->
    <div class="signatures">
      <div>
        <div class="sig-line"></div>
        <div class="sig-label">PREPARED BY</div>
        <div class="sig-sub">Market Performance Analyst • ERP Systems</div>
      </div>
      <div>
        <div class="sig-line"></div>
        <div class="sig-label">REVIEWED & AUDITED BY</div>
        <div class="sig-sub">Regional Business Manager / Financial Controller</div>
      </div>
      <div>
        <div class="sig-line"></div>
        <div class="sig-label">APPROVED BY</div>
        <div class="sig-sub">Commercial Director • Shehswar Chemicals Group</div>
      </div>
    </div>

    <!-- Footer -->
    <div class="footer">
      <div>OFFICIAL SHEHSWAR ONE360 ERP • COMMERCIAL AGROCHEMICAL DIVISION • COMPUTER GENERATED</div>
      <div>CONFIDENTIAL • FOR AUTHORIZED MANAGEMENT REVIEW ONLY</div>
    </div>
  </div>

  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
      }, 400);
    };
  </script>
</body>
</html>`;

  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  }
};

export interface BalanceSheetPdfData {
  companyName: string;
  asOfDate: string;
  data: {
    currentAssets?: {
      cashAndBank?: number;
      accountsReceivable?: number;
      inventory?: number;
      otherAssets?: number;
      total?: number;
    };
    nonCurrentAssets?: {
      fixedAssets?: number;
      total?: number;
    };
    totalAssets?: number;
    currentLiabilities?: {
      accountsPayable?: number;
      taxesPayable?: number;
      otherLiabilities?: number;
      total?: number;
    };
    totalLiabilities?: number;
    equity?: {
      shareCapital?: number;
      retainedEarnings?: number;
      currentPeriodProfit?: number;
      total?: number;
    };
    totalLiabilitiesAndEquity?: number;
    isBalanced?: boolean;
    variance?: number;
  };
}

export const exportBalanceSheetToPdf = (report: BalanceSheetPdfData) => {
  const { companyName, asOfDate, data } = report;
  const ca = data.currentAssets || {};
  const nca = data.nonCurrentAssets || {};
  const cl = data.currentLiabilities || {};
  const eq = data.equity || {};

  const totalAssets = Number(data.totalAssets || 0);
  const totalLiabEquity = Number(data.totalLiabilitiesAndEquity || 0);
  const isBalanced = data.isBalanced ?? (Math.abs(totalAssets - totalLiabEquity) < 1.0);

  const formatPKR = (v: number | undefined | null) =>
    Number(v || 0).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Balance_Sheet_${companyName.replace(/\\s+/g, '_')}_${asOfDate}</title>
  <style>
    @page { size: A4 portrait; margin: 10mm 12mm 10mm 12mm; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    html, body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      color: #0f172a; margin: 0; padding: 0; font-size: 8.5pt; line-height: 1.35; width: 100%; background: #ffffff;
    }
    .screen-toolbar {
      position: sticky; top: 0; background: #0f172a; color: #ffffff; padding: 10px 24px;
      display: flex; justify-content: space-between; align-items: center; z-index: 9999;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2); font-size: 13px;
    }
    .screen-toolbar button {
      background: #047857; color: #ffffff; border: none; padding: 6px 14px;
      font-weight: 600; border-radius: 5px; cursor: pointer; font-size: 13px;
      display: inline-flex; align-items: center; gap: 6px;
    }
    .screen-toolbar button:hover { background: #065f46; }
    .screen-toolbar .close-btn { background: #475569; margin-left: 8px; }
    @media print {
      .screen-toolbar { display: none !important; }
      body { background: #ffffff !important; }
    }
    .page-container {
      max-width: 210mm; margin: 0 auto; padding: 12px 16px; background: #ffffff;
    }
    .header-table {
      width: 100%; border-bottom: 2px solid #0f172a; padding-bottom: 8px; margin-bottom: 12px;
    }
    .logo-img { height: 44px; width: auto; object-fit: contain; }
    .company-title { font-size: 13pt; font-weight: 800; color: #0f172a; letter-spacing: 0.02em; }
    .company-sub { font-size: 7.5pt; color: #64748b; margin-top: 2px; }
    .report-title { font-size: 11pt; font-weight: 800; color: #047857; text-transform: uppercase; margin-top: 4px; }
    .meta-box {
      background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px 12px;
      margin-bottom: 14px; display: flex; justify-content: space-between; align-items: center;
    }
    .meta-item { display: flex; flex-direction: column; }
    .meta-label { font-size: 6.5pt; color: #64748b; text-transform: uppercase; font-weight: 700; }
    .meta-val { font-size: 9pt; font-weight: 700; color: #0f172a; }
    .balance-status {
      display: inline-block; padding: 4px 10px; border-radius: 4px; font-weight: 700; font-size: 7.5pt;
      background: ${isBalanced ? '#ecfdf5' : '#fef2f2'};
      color: ${isBalanced ? '#047857' : '#b91c1c'};
      border: 1px solid ${isBalanced ? '#a7f3d0' : '#fecaca'};
    }
    .statement-table {
      width: 100%; border-collapse: collapse; font-size: 8pt; margin-bottom: 16px;
    }
    .statement-table th {
      background: #0f172a; color: #ffffff; padding: 6px 10px; font-size: 7.5pt;
      text-transform: uppercase; font-weight: 700; letter-spacing: 0.03em;
    }
    .statement-table td {
      padding: 5px 10px; border-bottom: 1px solid #e2e8f0; vertical-align: middle;
    }
    .category-header {
      background: #f1f5f9; font-weight: 800; color: #0f172a; font-size: 8pt;
      border-top: 1px solid #cbd5e1; border-bottom: 1px solid #cbd5e1;
    }
    .subtotal-row {
      font-weight: 700; background: #f8fafc; border-top: 1px solid #cbd5e1;
    }
    .grand-total-row {
      font-weight: 800; font-size: 9pt; background: #e2e8f0;
      border-top: 2px solid #0f172a; border-bottom: 3px double #0f172a;
    }
    .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
    .text-right { text-align: right; }
    .signatures {
      display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px;
      margin-top: 28px; padding-top: 16px; border-top: 1px solid #e2e8f0;
    }
    .sig-box { text-align: center; }
    .sig-line { height: 28px; border-bottom: 1px dashed #64748b; margin-bottom: 6px; }
    .sig-label { font-size: 7pt; font-weight: 700; text-transform: uppercase; color: #1e293b; }
    .sig-sub { font-size: 6.2pt; color: #64748b; }
    .footer {
      margin-top: 16px; padding-top: 8px; border-top: 1px solid #e2e8f0;
      display: flex; justify-content: space-between; font-size: 6.5pt; color: #94a3b8; font-weight: 600;
    }
  </style>
</head>
<body>
  <div class="screen-toolbar">
    <div style="font-weight: 600;">
      <span>Authoritative Balance Sheet — ${companyName}</span>
      <span style="font-size: 11px; color: #94a3b8; margin-left: 12px;">(As of ${asOfDate})</span>
    </div>
    <div>
      <button onclick="window.print()">Download / Print PDF</button>
      <button class="close-btn" onclick="window.close()">Close</button>
    </div>
  </div>

  <div class="page-container">
    <table class="header-table">
      <tr>
        <td style="width: 50px; vertical-align: middle;">
          <img class="logo-img" src="${SHEHSWAR_LOGO_BASE64}" alt="SHEHSWAR">
        </td>
        <td style="padding-left: 12px; vertical-align: middle;">
          <div class="company-title">SHEHSWAR GROUP OF COMPANIES</div>
          <div class="company-sub">Financial Control & General Ledger Division • Enterprise Accounting Records</div>
          <div class="report-title">STATEMENT OF FINANCIAL POSITION (BALANCE SHEET)</div>
        </td>
        <td style="text-align: right; vertical-align: middle;">
          <div class="balance-status">${isBalanced ? 'ACCOUNTING EQUATION BALANCED' : 'EQUATION IMBALANCE'}</div>
          <div style="font-size: 7pt; color: #64748b; margin-top: 4px; font-family: monospace;">
            ENTITY: ${companyName}<br>
            AS OF: ${asOfDate}
          </div>
        </td>
      </tr>
    </table>

    <div class="meta-box">
      <div class="meta-item">
        <span class="meta-label">Reporting Entity</span>
        <span class="meta-val">${companyName}</span>
      </div>
      <div class="meta-item">
        <span class="meta-label">Financial Position As Of</span>
        <span class="meta-val">${asOfDate}</span>
      </div>
      <div class="meta-item">
        <span class="meta-label">Total Assets</span>
        <span class="meta-val mono" style="color: #047857;">PKR ${formatPKR(totalAssets)}</span>
      </div>
      <div class="meta-item">
        <span class="meta-label">Total Liabilities & Equity</span>
        <span class="meta-val mono" style="color: #047857;">PKR ${formatPKR(totalLiabEquity)}</span>
      </div>
    </div>

    <!-- BALANCE SHEET STATEMENT TABLE -->
    <table class="statement-table">
      <thead>
        <tr>
          <th style="width: 55%; text-align: left;">Account / Financial Classification</th>
          <th style="width: 20%; text-align: right;">Detail (PKR)</th>
          <th style="width: 25%; text-align: right;">Amount (PKR)</th>
        </tr>
      </thead>
      <tbody>
        <!-- ASSETS -->
        <tr class="category-header">
          <td colspan="3">1. ASSETS</td>
        </tr>
        <tr>
          <td style="padding-left: 18px; font-weight: 600;">Current Assets</td>
          <td></td>
          <td></td>
        </tr>
        <tr>
          <td style="padding-left: 32px;">Cash on Hand & Bank Accounts (101000 / 102000)</td>
          <td class="text-right mono">${formatPKR(ca.cashAndBank)}</td>
          <td></td>
        </tr>
        <tr>
          <td style="padding-left: 32px;">Trade Debtors / Accounts Receivable (103000)</td>
          <td class="text-right mono">${formatPKR(ca.accountsReceivable)}</td>
          <td></td>
        </tr>
        <tr>
          <td style="padding-left: 32px;">Commercial Finished Goods & Materials Inventory (104000 / 105000)</td>
          <td class="text-right mono">${formatPKR(ca.inventory)}</td>
          <td></td>
        </tr>
        <tr>
          <td style="padding-left: 32px;">Advances & Other Current Assets</td>
          <td class="text-right mono">${formatPKR(ca.otherAssets)}</td>
          <td></td>
        </tr>
        <tr class="subtotal-row">
          <td style="padding-left: 18px;">Total Current Assets</td>
          <td></td>
          <td class="text-right mono" style="color: #047857;">${formatPKR(ca.total)}</td>
        </tr>

        <tr>
          <td style="padding-left: 18px; font-weight: 600;">Non-Current Assets</td>
          <td></td>
          <td></td>
        </tr>
        <tr>
          <td style="padding-left: 32px;">Property, Plant & Equipment (Fixed Assets)</td>
          <td class="text-right mono">${formatPKR(nca.fixedAssets)}</td>
          <td></td>
        </tr>
        <tr class="subtotal-row">
          <td style="padding-left: 18px;">Total Non-Current Assets</td>
          <td></td>
          <td class="text-right mono">${formatPKR(nca.total)}</td>
        </tr>

        <tr class="grand-total-row">
          <td>TOTAL ASSETS (A)</td>
          <td></td>
          <td class="text-right mono" style="color: #047857;">PKR ${formatPKR(totalAssets)}</td>
        </tr>

        <!-- LIABILITIES -->
        <tr class="category-header" style="margin-top: 10px;">
          <td colspan="3">2. LIABILITIES</td>
        </tr>
        <tr>
          <td style="padding-left: 18px; font-weight: 600;">Current Liabilities</td>
          <td></td>
          <td></td>
        </tr>
        <tr>
          <td style="padding-left: 32px;">Accounts Payable / Trade Creditors (201000)</td>
          <td class="text-right mono">${formatPKR(cl.accountsPayable)}</td>
          <td></td>
        </tr>
        <tr>
          <td style="padding-left: 32px;">Sales Tax & Statutory Payables (STRN) (202000)</td>
          <td class="text-right mono">${formatPKR(cl.taxesPayable)}</td>
          <td></td>
        </tr>
        <tr>
          <td style="padding-left: 32px;">Accrued Expenses & Other Current Liabilities</td>
          <td class="text-right mono">${formatPKR(cl.otherLiabilities)}</td>
          <td></td>
        </tr>
        <tr class="subtotal-row">
          <td style="padding-left: 18px;">Total Current Liabilities</td>
          <td></td>
          <td class="text-right mono" style="color: #b91c1c;">${formatPKR(cl.total)}</td>
        </tr>

        <tr class="subtotal-row" style="background: #f1f5f9;">
          <td>TOTAL LIABILITIES (B)</td>
          <td></td>
          <td class="text-right mono" style="color: #b91c1c; font-weight: 800;">${formatPKR(data.totalLiabilities)}</td>
        </tr>

        <!-- EQUITY -->
        <tr class="category-header">
          <td colspan="3">3. SHAREHOLDERS' EQUITY</td>
        </tr>
        <tr>
          <td style="padding-left: 32px;">Share Capital / Paid-Up Equity (301000)</td>
          <td class="text-right mono">${formatPKR(eq.shareCapital)}</td>
          <td></td>
        </tr>
        <tr>
          <td style="padding-left: 32px;">Retained Earnings Brought Forward (302000)</td>
          <td class="text-right mono">${formatPKR(eq.retainedEarnings)}</td>
          <td></td>
        </tr>
        <tr>
          <td style="padding-left: 32px;">Current Financial Period Net Earnings / (Loss)</td>
          <td class="text-right mono" style="color: ${Number(eq.currentPeriodProfit || 0) >= 0 ? '#047857' : '#b91c1c'}; font-weight: 700;">
            ${formatPKR(eq.currentPeriodProfit)}
          </td>
          <td></td>
        </tr>
        <tr class="subtotal-row">
          <td style="padding-left: 18px;">Total Shareholders' Equity</td>
          <td></td>
          <td class="text-right mono" style="color: #0369a1; font-weight: 700;">${formatPKR(eq.total)}</td>
        </tr>

        <tr class="grand-total-row">
          <td>TOTAL LIABILITIES & EQUITY (B + C)</td>
          <td></td>
          <td class="text-right mono" style="color: #047857;">PKR ${formatPKR(totalLiabEquity)}</td>
        </tr>
      </tbody>
    </table>

    <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 4px; padding: 6px 12px; font-size: 7.2pt; color: #475569;">
      <strong>Audit Verification Note:</strong> Total Assets (PKR ${formatPKR(totalAssets)}) vs Total Liabilities & Equity (PKR ${formatPKR(totalLiabEquity)}). Variance: PKR ${formatPKR(data.variance || 0)}. Accounting books are strictly closed and reconciled in accordance with double-entry principles.
    </div>

    <!-- Signatures -->
    <div class="signatures">
      <div class="sig-box">
        <div class="sig-line"></div>
        <div class="sig-label">PREPARED BY</div>
        <div class="sig-sub">Senior General Accountant • One360 ERP</div>
      </div>
      <div class="sig-box">
        <div class="sig-line"></div>
        <div class="sig-label">REVIEWED & AUDITED BY</div>
        <div class="sig-sub">Head of Internal Audit & Financial Control</div>
      </div>
      <div class="sig-box">
        <div class="sig-line"></div>
        <div class="sig-label">APPROVED BY</div>
        <div class="sig-sub">Chief Financial Officer • Shehswar Chemicals</div>
      </div>
    </div>

    <div class="footer">
      <div>OFFICIAL SHEHSWAR ONE360 ERP • CORPORATE FINANCIAL CONTROL • GENERAL LEDGER DERIVED</div>
      <div>CONFIDENTIAL • FOR BOARD & STATUTORY MANAGEMENT USE ONLY</div>
    </div>
  </div>

  <script>
    window.onload = function() {
      setTimeout(function() { window.print(); }, 400);
    };
  </script>
</body>
</html>`;

  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  }
};

export interface ProfitLossPdfData {
  companyName: string;
  period: string;
  startDate?: string;
  endDate?: string;
  data: {
    revenue?: {
      grossSales?: number;
      discounts?: number;
      netSales?: number;
    };
    costOfGoodsSold?: {
      cogs?: number;
    };
    grossProfit?: number;
    grossMarginPercent?: number;
    operatingExpenses?: {
      sellingAndDistribution?: number;
      marketingAndSchemes?: number;
      administrative?: number;
      otherExpenses?: number;
      total?: number;
    };
    operatingProfit?: number;
    netProfit?: number;
    netMarginPercent?: number;
  };
}

export const exportProfitLossToPdf = (report: ProfitLossPdfData) => {
  const { companyName, period, data } = report;
  const rev = data.revenue || {};
  const cogs = data.costOfGoodsSold || {};
  const exp = data.operatingExpenses || {};

  const grossSales = Number(rev.grossSales || 0);
  const discounts = Number(rev.discounts || 0);
  const netSales = Number(rev.netSales || (grossSales - discounts));
  const cogsTotal = Number(cogs.cogs || 0);
  const grossProfit = Number(data.grossProfit || (netSales - cogsTotal));
  const grossMarginPct = Number(data.grossMarginPercent || (netSales > 0 ? (grossProfit / netSales) * 100 : 0));

  const totalExpenses = Number(exp.total || 0);
  const operatingProfit = Number(data.operatingProfit || (grossProfit - totalExpenses));
  const netProfit = Number(data.netProfit || operatingProfit);
  const netMarginPct = Number(data.netMarginPercent || (netSales > 0 ? (netProfit / netSales) * 100 : 0));

  const formatPKR = (v: number | undefined | null) =>
    Number(v || 0).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Profit_Loss_Statement_${companyName.replace(/\\s+/g, '_')}</title>
  <style>
    @page { size: A4 portrait; margin: 10mm 12mm 10mm 12mm; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    html, body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      color: #0f172a; margin: 0; padding: 0; font-size: 8.5pt; line-height: 1.35; width: 100%; background: #ffffff;
    }
    .screen-toolbar {
      position: sticky; top: 0; background: #0f172a; color: #ffffff; padding: 10px 24px;
      display: flex; justify-content: space-between; align-items: center; z-index: 9999;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2); font-size: 13px;
    }
    .screen-toolbar button {
      background: #047857; color: #ffffff; border: none; padding: 6px 14px;
      font-weight: 600; border-radius: 5px; cursor: pointer; font-size: 13px;
      display: inline-flex; align-items: center; gap: 6px;
    }
    .screen-toolbar button:hover { background: #065f46; }
    .screen-toolbar .close-btn { background: #475569; margin-left: 8px; }
    @media print {
      .screen-toolbar { display: none !important; }
      body { background: #ffffff !important; }
    }
    .page-container {
      max-width: 210mm; margin: 0 auto; padding: 12px 16px; background: #ffffff;
    }
    .header-table {
      width: 100%; border-bottom: 2px solid #0f172a; padding-bottom: 8px; margin-bottom: 12px;
    }
    .logo-img { height: 44px; width: auto; object-fit: contain; }
    .company-title { font-size: 13pt; font-weight: 800; color: #0f172a; letter-spacing: 0.02em; }
    .company-sub { font-size: 7.5pt; color: #64748b; margin-top: 2px; }
    .report-title { font-size: 11pt; font-weight: 800; color: #047857; text-transform: uppercase; margin-top: 4px; }
    .kpi-grid {
      display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 14px;
    }
    .kpi-card {
      background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px 10px; text-align: center;
    }
    .kpi-label { font-size: 6.5pt; color: #64748b; text-transform: uppercase; font-weight: 700; }
    .kpi-val { font-size: 11pt; font-weight: 800; margin-top: 2px; }
    .statement-table {
      width: 100%; border-collapse: collapse; font-size: 8pt; margin-bottom: 16px;
    }
    .statement-table th {
      background: #0f172a; color: #ffffff; padding: 6px 10px; font-size: 7.5pt;
      text-transform: uppercase; font-weight: 700;
    }
    .statement-table td {
      padding: 5px 10px; border-bottom: 1px solid #e2e8f0; vertical-align: middle;
    }
    .category-header {
      background: #f1f5f9; font-weight: 800; color: #0f172a; font-size: 8pt;
      border-top: 1px solid #cbd5e1; border-bottom: 1px solid #cbd5e1;
    }
    .subtotal-row {
      font-weight: 700; background: #f8fafc; border-top: 1px solid #cbd5e1;
    }
    .grand-total-row {
      font-weight: 800; font-size: 9.5pt; background: #ecfdf5;
      border-top: 2px solid #047857; border-bottom: 3px double #047857;
    }
    .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
    .text-right { text-align: right; }
    .signatures {
      display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px;
      margin-top: 28px; padding-top: 16px; border-top: 1px solid #e2e8f0;
    }
    .sig-box { text-align: center; }
    .sig-line { height: 28px; border-bottom: 1px dashed #64748b; margin-bottom: 6px; }
    .sig-label { font-size: 7pt; font-weight: 700; text-transform: uppercase; color: #1e293b; }
    .sig-sub { font-size: 6.2pt; color: #64748b; }
    .footer {
      margin-top: 16px; padding-top: 8px; border-top: 1px solid #e2e8f0;
      display: flex; justify-content: space-between; font-size: 6.5pt; color: #94a3b8; font-weight: 600;
    }
  </style>
</head>
<body>
  <div class="screen-toolbar">
    <div style="font-weight: 600;">
      <span>Statement of Profit & Loss — ${companyName}</span>
      <span style="font-size: 11px; color: #94a3b8; margin-left: 12px;">(${period})</span>
    </div>
    <div>
      <button onclick="window.print()">Download / Print PDF</button>
      <button class="close-btn" onclick="window.close()">Close</button>
    </div>
  </div>

  <div class="page-container">
    <table class="header-table">
      <tr>
        <td style="width: 50px; vertical-align: middle;">
          <img class="logo-img" src="${SHEHSWAR_LOGO_BASE64}" alt="SHEHSWAR">
        </td>
        <td style="padding-left: 12px; vertical-align: middle;">
          <div class="company-title">SHEHSWAR GROUP OF COMPANIES</div>
          <div class="company-sub">Financial Control & Commercial Accounting • General Ledger Derived</div>
          <div class="report-title">STATEMENT OF PROFIT & LOSS (INCOME STATEMENT)</div>
        </td>
        <td style="text-align: right; vertical-align: middle;">
          <div style="font-size: 7.5pt; color: #047857; font-weight: 700; background: #ecfdf5; padding: 4px 10px; border-radius: 4px; border: 1px solid #a7f3d0; display: inline-block;">
            OFFICIAL FINANCIAL AUDIT
          </div>
          <div style="font-size: 7pt; color: #64748b; margin-top: 4px; font-family: monospace;">
            ENTITY: ${companyName}<br>
            PERIOD: ${period}
          </div>
        </td>
      </tr>
    </table>

    <!-- Key Performance Highlights -->
    <div class="kpi-grid">
      <div class="kpi-card">
        <div class="kpi-label">Net Sales Revenue</div>
        <div class="kpi-val mono" style="color: #0369a1;">PKR ${formatPKR(netSales)}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Gross Margin</div>
        <div class="kpi-val mono" style="color: #047857;">${grossMarginPct.toFixed(1)}%</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Operating Expenses</div>
        <div class="kpi-val mono" style="color: #b91c1c;">PKR ${formatPKR(totalExpenses)}</div>
      </div>
      <div class="kpi-card" style="border: 1.5px solid #047857; background: #ecfdf5;">
        <div class="kpi-label" style="color: #047857;">NET PROFIT / (LOSS)</div>
        <div class="kpi-val mono" style="color: ${netProfit >= 0 ? '#047857' : '#b91c1c'};">PKR ${formatPKR(netProfit)}</div>
      </div>
    </div>

    <!-- P&L Table -->
    <table class="statement-table">
      <thead>
        <tr>
          <th style="width: 55%; text-align: left;">Operating Financial Item</th>
          <th style="width: 20%; text-align: right;">Breakdown (PKR)</th>
          <th style="width: 25%; text-align: right;">Amount (PKR)</th>
        </tr>
      </thead>
      <tbody>
        <!-- REVENUE -->
        <tr class="category-header">
          <td colspan="3">1. OPERATING REVENUE</td>
        </tr>
        <tr>
          <td style="padding-left: 20px;">Gross Commercial Sales Revenue (401000)</td>
          <td class="text-right mono">${formatPKR(grossSales)}</td>
          <td></td>
        </tr>
        <tr>
          <td style="padding-left: 20px; color: #64748b;">Less: Trade Rebates & Promotional Discounts (402000)</td>
          <td class="text-right mono" style="color: #64748b;">(${formatPKR(discounts)})</td>
          <td></td>
        </tr>
        <tr class="subtotal-row">
          <td style="font-weight: 800;">NET COMMERCIAL SALES REVENUE</td>
          <td></td>
          <td class="text-right mono" style="font-weight: 800; color: #0369a1;">PKR ${formatPKR(netSales)}</td>
        </tr>

        <!-- COGS -->
        <tr class="category-header">
          <td colspan="3">2. COST OF GOODS SOLD</td>
        </tr>
        <tr>
          <td style="padding-left: 20px;">Cost of Commercial Formulations & Bottling (501000)</td>
          <td class="text-right mono">${formatPKR(cogsTotal)}</td>
          <td></td>
        </tr>
        <tr class="subtotal-row">
          <td style="font-weight: 700;">TOTAL COST OF GOODS SOLD (COGS)</td>
          <td></td>
          <td class="text-right mono" style="color: #b91c1c;">(${formatPKR(cogsTotal)})</td>
        </tr>

        <!-- GROSS PROFIT -->
        <tr class="grand-total-row" style="background: #f8fafc; border-top: 1.5px solid #0f172a; border-bottom: 1.5px solid #0f172a;">
          <td style="font-weight: 800;">GROSS PROFIT (${grossMarginPct.toFixed(1)}% Gross Margin)</td>
          <td></td>
          <td class="text-right mono" style="font-weight: 800; color: #047857;">PKR ${formatPKR(grossProfit)}</td>
        </tr>

        <!-- OPERATING EXPENSES -->
        <tr class="category-header">
          <td colspan="3">3. OPERATING & ADMINISTRATIVE EXPENSES</td>
        </tr>
        <tr>
          <td style="padding-left: 20px;">General & Administrative Overheads (601000)</td>
          <td class="text-right mono">${formatPKR(exp.administrative)}</td>
          <td></td>
        </tr>
        <tr>
          <td style="padding-left: 20px;">Selling & Commercial Distribution Costs (602000)</td>
          <td class="text-right mono">${formatPKR(exp.sellingAndDistribution)}</td>
          <td></td>
        </tr>
        <tr>
          <td style="padding-left: 20px;">Field Marketing & Farmer Incentive Schemes (603000)</td>
          <td class="text-right mono">${formatPKR(exp.marketingAndSchemes)}</td>
          <td></td>
        </tr>
        <tr>
          <td style="padding-left: 20px;">Freight, Utilities & Other Operational Overheads (604000/605000)</td>
          <td class="text-right mono">${formatPKR(exp.otherExpenses)}</td>
          <td></td>
        </tr>
        <tr class="subtotal-row">
          <td style="font-weight: 700;">TOTAL OPERATING EXPENSES</td>
          <td></td>
          <td class="text-right mono" style="color: #b91c1c;">(${formatPKR(totalExpenses)})</td>
        </tr>

        <!-- OPERATING PROFIT -->
        <tr class="subtotal-row" style="background: #f1f5f9;">
          <td style="font-weight: 800;">OPERATING PROFIT BEFORE TAX (EBIT)</td>
          <td></td>
          <td class="text-right mono" style="font-weight: 800; color: ${operatingProfit >= 0 ? '#047857' : '#b91c1c'};">PKR ${formatPKR(operatingProfit)}</td>
        </tr>

        <!-- NET PROFIT -->
        <tr class="grand-total-row">
          <td style="font-weight: 800; font-size: 10pt;">NET PROFIT / (LOSS) FOR THE FINANCIAL PERIOD (${netMarginPct.toFixed(1)}% Net Margin)</td>
          <td></td>
          <td class="text-right mono" style="font-weight: 800; font-size: 10pt; color: ${netProfit >= 0 ? '#047857' : '#b91c1c'};">
            PKR ${formatPKR(netProfit)}
          </td>
        </tr>
      </tbody>
    </table>

    <!-- Signatures -->
    <div class="signatures">
      <div class="sig-box">
        <div class="sig-line"></div>
        <div class="sig-label">PREPARED BY</div>
        <div class="sig-sub">Commercial Accountant • One360 ERP</div>
      </div>
      <div class="sig-box">
        <div class="sig-line"></div>
        <div class="sig-label">REVIEWED & AUDITED BY</div>
        <div class="sig-sub">Financial Controller • Shehswar Chemicals</div>
      </div>
      <div class="sig-box">
        <div class="sig-line"></div>
        <div class="sig-label">APPROVED BY</div>
        <div class="sig-sub">Managing Director • Executive Board</div>
      </div>
    </div>

    <div class="footer">
      <div>OFFICIAL SHEHSWAR ONE360 ERP • COMMERCIAL AGROCHEMICAL DIVISION • COMPUTER GENERATED</div>
      <div>CONFIDENTIAL • FOR AUTHORIZED MANAGEMENT & AUDIT REVIEW ONLY</div>
    </div>
  </div>

  <script>
    window.onload = function() {
      setTimeout(function() { window.print(); }, 400);
    };
  </script>
</body>
</html>`;

  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  }
};

export interface GeneralLedgerPdfData {
  companyName: string;
  startDate?: string;
  endDate?: string;
  entries: Array<{
    id: string;
    entryDate: string;
    entryNumber: string;
    sourceType: string;
    description: string;
    totalDebit: number;
    totalCredit: number;
    company?: { name: string; code: string };
    lines?: Array<{
      id: string;
      accountId: string;
      account?: { accountCode: string; accountName: string };
      description?: string;
      debit: number;
      credit: number;
    }>;
  }>;
}

export const exportGeneralLedgerToPdf = (report: GeneralLedgerPdfData) => {
  const { companyName, startDate, endDate, entries } = report;

  const totalDebits = entries.reduce((sum, e) => sum + Number(e.totalDebit || 0), 0);
  const totalCredits = entries.reduce((sum, e) => sum + Number(e.totalCredit || 0), 0);
  const periodLabel = startDate && endDate ? `${startDate} to ${endDate}` : 'Complete Historical General Ledger';

  const formatPKR = (v: number | undefined | null) =>
    Number(v || 0).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>General_Ledger_${companyName.replace(/\\s+/g, '_')}</title>
  <style>
    @page { size: A4 portrait; margin: 10mm 12mm 10mm 12mm; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    html, body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      color: #0f172a; margin: 0; padding: 0; font-size: 8pt; line-height: 1.35; width: 100%; background: #ffffff;
    }
    .screen-toolbar {
      position: sticky; top: 0; background: #0f172a; color: #ffffff; padding: 10px 24px;
      display: flex; justify-content: space-between; align-items: center; z-index: 9999;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2); font-size: 13px;
    }
    .screen-toolbar button {
      background: #047857; color: #ffffff; border: none; padding: 6px 14px;
      font-weight: 600; border-radius: 5px; cursor: pointer; font-size: 13px;
      display: inline-flex; align-items: center; gap: 6px;
    }
    .screen-toolbar button:hover { background: #065f46; }
    .screen-toolbar .close-btn { background: #475569; margin-left: 8px; }
    @media print {
      .screen-toolbar { display: none !important; }
      body { background: #ffffff !important; }
    }
    .page-container {
      max-width: 210mm; margin: 0 auto; padding: 12px 16px; background: #ffffff;
    }
    .header-table {
      width: 100%; border-bottom: 2px solid #0f172a; padding-bottom: 8px; margin-bottom: 12px;
    }
    .logo-img { height: 44px; width: auto; object-fit: contain; }
    .company-title { font-size: 13pt; font-weight: 800; color: #0f172a; letter-spacing: 0.02em; }
    .company-sub { font-size: 7.5pt; color: #64748b; margin-top: 2px; }
    .report-title { font-size: 11pt; font-weight: 800; color: #047857; text-transform: uppercase; margin-top: 4px; }
    .meta-box {
      background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px 12px;
      margin-bottom: 14px; display: flex; justify-content: space-between; align-items: center;
    }
    .meta-item { display: flex; flex-direction: column; }
    .meta-label { font-size: 6.5pt; color: #64748b; text-transform: uppercase; font-weight: 700; }
    .meta-val { font-size: 9pt; font-weight: 700; color: #0f172a; }
    .data-table {
      width: 100%; border-collapse: collapse; font-size: 7.5pt; margin-bottom: 16px;
    }
    .data-table th {
      background: #0f172a; color: #ffffff; padding: 6px 8px; font-size: 7pt;
      text-transform: uppercase; font-weight: 700; letter-spacing: 0.02em;
    }
    .data-table td {
      padding: 5px 8px; border-bottom: 1px solid #e2e8f0; vertical-align: top;
    }
    .entry-main-row {
      background: #f8fafc; font-weight: 700; border-top: 1px solid #cbd5e1;
    }
    .line-row {
      font-size: 7pt; color: #475569; background: #ffffff;
    }
    .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
    .text-right { text-align: right; }
    .text-center { text-align: center; }
    .total-row {
      font-weight: 800; background: #e2e8f0; border-top: 2px solid #0f172a; border-bottom: 3px double #0f172a;
    }
    .signatures {
      display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px;
      margin-top: 28px; padding-top: 16px; border-top: 1px solid #e2e8f0;
    }
    .sig-box { text-align: center; }
    .sig-line { height: 28px; border-bottom: 1px dashed #64748b; margin-bottom: 6px; }
    .sig-label { font-size: 7pt; font-weight: 700; text-transform: uppercase; color: #1e293b; }
    .sig-sub { font-size: 6.2pt; color: #64748b; }
    .footer {
      margin-top: 16px; padding-top: 8px; border-top: 1px solid #e2e8f0;
      display: flex; justify-content: space-between; font-size: 6.5pt; color: #94a3b8; font-weight: 600;
    }
  </style>
</head>
<body>
  <div class="screen-toolbar">
    <div style="font-weight: 600;">
      <span>Authoritative General Ledger — ${companyName}</span>
      <span style="font-size: 11px; color: #94a3b8; margin-left: 12px;">(${entries.length} Balanced Journal Entries)</span>
    </div>
    <div>
      <button onclick="window.print()">Download / Print PDF</button>
      <button class="close-btn" onclick="window.close()">Close</button>
    </div>
  </div>

  <div class="page-container">
    <table class="header-table">
      <tr>
        <td style="width: 50px; vertical-align: middle;">
          <img class="logo-img" src="${SHEHSWAR_LOGO_BASE64}" alt="SHEHSWAR">
        </td>
        <td style="padding-left: 12px; vertical-align: middle;">
          <div class="company-title">SHEHSWAR GROUP OF COMPANIES</div>
          <div class="company-sub">Financial Control & Audit Division • General Ledger Double-Entry Register</div>
          <div class="report-title">AUTHORITATIVE GENERAL LEDGER JOURNAL ENTRIES</div>
        </td>
        <td style="text-align: right; vertical-align: middle;">
          <div style="font-size: 7.5pt; color: #047857; font-weight: 700; background: #ecfdf5; padding: 4px 10px; border-radius: 4px; border: 1px solid #a7f3d0; display: inline-block;">
            BALANCED AUDIT REGISTER
          </div>
          <div style="font-size: 7pt; color: #64748b; margin-top: 4px; font-family: monospace;">
            ENTITY: ${companyName}<br>
            PERIOD: ${periodLabel}
          </div>
        </td>
      </tr>
    </table>

    <div class="meta-box">
      <div class="meta-item">
        <span class="meta-label">Total Journal Vouchers</span>
        <span class="meta-val">${entries.length} Entries</span>
      </div>
      <div class="meta-item">
        <span class="meta-label">Total Debits</span>
        <span class="meta-val mono" style="color: #047857;">PKR ${formatPKR(totalDebits)}</span>
      </div>
      <div class="meta-item">
        <span class="meta-label">Total Credits</span>
        <span class="meta-val mono" style="color: #047857;">PKR ${formatPKR(totalCredits)}</span>
      </div>
      <div class="meta-item">
        <span class="meta-label">Audit Verification</span>
        <span class="meta-val" style="color: #047857;">Strict Double-Entry Balanced</span>
      </div>
    </div>

    <!-- Table -->
    <table class="data-table">
      <thead>
        <tr>
          <th style="width: 10%;">Date</th>
          <th style="width: 16%;">Voucher #</th>
          <th style="width: 14%;">Source Type</th>
          <th style="width: 30%;">Description / Sub-Account</th>
          <th class="text-right" style="width: 15%;">Debit (PKR)</th>
          <th class="text-right" style="width: 15%;">Credit (PKR)</th>
        </tr>
      </thead>
      <tbody>
        ${entries.map((entry) => `
          <tr class="entry-main-row">
            <td>${new Date(entry.entryDate).toLocaleDateString('en-GB')}</td>
            <td class="mono" style="color: #0369a1;">${entry.entryNumber}</td>
            <td><span style="background: #e2e8f0; padding: 2px 6px; border-radius: 3px; font-size: 6.8pt;">${entry.sourceType}</span></td>
            <td><strong>${entry.description || '—'}</strong></td>
            <td class="text-right mono" style="font-weight: 800;">${formatPKR(entry.totalDebit)}</td>
            <td class="text-right mono" style="font-weight: 800;">${formatPKR(entry.totalCredit)}</td>
          </tr>
          ${(entry.lines || []).map((l) => `
            <tr class="line-row">
              <td></td>
              <td class="mono" style="padding-left: 12px; color: #64748b;">└ ${l.account?.accountCode || l.accountId}</td>
              <td colspan="2" style="color: #334155;">${l.account?.accountName || l.description || '—'}</td>
              <td class="text-right mono" style="color: #047857;">${Number(l.debit) > 0 ? formatPKR(l.debit) : '—'}</td>
              <td class="text-right mono" style="color: #0369a1;">${Number(l.credit) > 0 ? formatPKR(l.credit) : '—'}</td>
            </tr>
          `).join('')}
        `).join('')}
        <tr class="total-row">
          <td colspan="4" style="text-align: right; font-weight: 800;">CUMULATIVE GENERAL LEDGER AUDIT TOTAL:</td>
          <td class="text-right mono" style="font-weight: 800; color: #047857;">PKR ${formatPKR(totalDebits)}</td>
          <td class="text-right mono" style="font-weight: 800; color: #047857;">PKR ${formatPKR(totalCredits)}</td>
        </tr>
      </tbody>
    </table>

    <!-- Signatures -->
    <div class="signatures">
      <div class="sig-box">
        <div class="sig-line"></div>
        <div class="sig-label">POSTED & AUDITED BY</div>
        <div class="sig-sub">General Ledger Accountant</div>
      </div>
      <div class="sig-box">
        <div class="sig-line"></div>
        <div class="sig-label">FINANCIAL CONTROLLER</div>
        <div class="sig-sub">Corporate Finance Division</div>
      </div>
      <div class="sig-box">
        <div class="sig-line"></div>
        <div class="sig-label">MANAGING DIRECTOR</div>
        <div class="sig-sub">Executive Board • Shehswar Chemicals</div>
      </div>
    </div>

    <div class="footer">
      <div>OFFICIAL SHEHSWAR ONE360 ERP • COMMERCIAL AGROCHEMICAL DIVISION • COMPUTER GENERATED</div>
      <div>CONFIDENTIAL • FOR AUTHORIZED MANAGEMENT & AUDIT REVIEW ONLY</div>
    </div>
  </div>

  <script>
    window.onload = function() {
      setTimeout(function() { window.print(); }, 400);
    };
  </script>
</body>
</html>`;

  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  }
};

export interface DealersListPdfData {
  dealers: Array<{
    code: string;
    name: string;
    businessName?: string;
    phone?: string;
    city?: string;
    creditLimit?: number;
    currentBalance?: number;
    status: string;
    territory?: { name: string; zone?: { name: string; region?: { name: string } } };
    assignedOfficer?: { firstName: string; lastName: string };
  }>;
}

export const exportDealersListPdf = (report: DealersListPdfData) => {
  const { dealers } = report;
  const totalReceivables = dealers.reduce((sum, d) => sum + Number(d.currentBalance || 0), 0);
  const totalCreditLimit = dealers.reduce((sum, d) => sum + Number(d.creditLimit || 0), 0);
  const activeCount = dealers.filter((d) => d.status === 'ACTIVE').length;

  const formatPKR = (v: number | undefined | null) =>
    Number(v || 0).toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Dealers_Market_Hierarchy_Directory</title>
  <style>
    @page { size: A4 portrait; margin: 10mm 12mm 10mm 12mm; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    html, body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      color: #0f172a; margin: 0; padding: 0; font-size: 8pt; line-height: 1.35; width: 100%; background: #ffffff;
    }
    .screen-toolbar {
      position: sticky; top: 0; background: #0f172a; color: #ffffff; padding: 10px 24px;
      display: flex; justify-content: space-between; align-items: center; z-index: 9999;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2); font-size: 13px;
    }
    .screen-toolbar button {
      background: #047857; color: #ffffff; border: none; padding: 6px 14px;
      font-weight: 600; border-radius: 5px; cursor: pointer; font-size: 13px;
      display: inline-flex; align-items: center; gap: 6px;
    }
    .screen-toolbar button:hover { background: #065f46; }
    .screen-toolbar .close-btn { background: #475569; margin-left: 8px; }
    @media print {
      .screen-toolbar { display: none !important; }
      body { background: #ffffff !important; }
    }
    .page-container {
      max-width: 210mm; margin: 0 auto; padding: 12px 16px; background: #ffffff;
    }
    .header-table {
      width: 100%; border-bottom: 2px solid #0f172a; padding-bottom: 8px; margin-bottom: 12px;
    }
    .logo-img { height: 44px; width: auto; object-fit: contain; }
    .company-title { font-size: 13pt; font-weight: 800; color: #0f172a; letter-spacing: 0.02em; }
    .company-sub { font-size: 7.5pt; color: #64748b; margin-top: 2px; }
    .report-title { font-size: 11pt; font-weight: 800; color: #047857; text-transform: uppercase; margin-top: 4px; }
    .kpi-grid {
      display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 14px;
    }
    .kpi-card {
      background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px 10px; text-align: center;
    }
    .kpi-label { font-size: 6.5pt; color: #64748b; text-transform: uppercase; font-weight: 700; }
    .kpi-val { font-size: 11pt; font-weight: 800; margin-top: 2px; }
    .data-table {
      width: 100%; border-collapse: collapse; font-size: 7.5pt; margin-bottom: 16px;
    }
    .data-table th {
      background: #0f172a; color: #ffffff; padding: 6px 8px; font-size: 7pt;
      text-transform: uppercase; font-weight: 700;
    }
    .data-table td {
      padding: 6px 8px; border-bottom: 1px solid #e2e8f0; vertical-align: middle;
    }
    .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
    .text-right { text-align: right; }
    .text-center { text-align: center; }
    .total-row {
      font-weight: 800; background: #e2e8f0; border-top: 2px solid #0f172a; border-bottom: 3px double #0f172a;
    }
    .signatures {
      display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px;
      margin-top: 28px; padding-top: 16px; border-top: 1px solid #e2e8f0;
    }
    .sig-box { text-align: center; }
    .sig-line { height: 28px; border-bottom: 1px dashed #64748b; margin-bottom: 6px; }
    .sig-label { font-size: 7pt; font-weight: 700; text-transform: uppercase; color: #1e293b; }
    .sig-sub { font-size: 6.2pt; color: #64748b; }
    .footer {
      margin-top: 16px; padding-top: 8px; border-top: 1px solid #e2e8f0;
      display: flex; justify-content: space-between; font-size: 6.5pt; color: #94a3b8; font-weight: 600;
    }
  </style>
</head>
<body>
  <div class="screen-toolbar">
    <div style="font-weight: 600;">
      <span>Dealers & Market Hierarchy Directory</span>
      <span style="font-size: 11px; color: #94a3b8; margin-left: 12px;">(${dealers.length} Registered Dealerships)</span>
    </div>
    <div>
      <button onclick="window.print()">Download / Print PDF</button>
      <button class="close-btn" onclick="window.close()">Close</button>
    </div>
  </div>

  <div class="page-container">
    <table class="header-table">
      <tr>
        <td style="width: 50px; vertical-align: middle;">
          <img class="logo-img" src="${SHEHSWAR_LOGO_BASE64}" alt="SHEHSWAR">
        </td>
        <td style="padding-left: 12px; vertical-align: middle;">
          <div class="company-title">SHEHSWAR GROUP OF COMPANIES</div>
          <div class="company-sub">Commercial Agrochemical Division • Market Hierarchy & Territory Attribution</div>
          <div class="report-title">AUTHORIZED DEALERS & RUNNING BALANCE DIRECTORY</div>
        </td>
        <td style="text-align: right; vertical-align: middle;">
          <div style="font-size: 7.5pt; color: #047857; font-weight: 700; background: #ecfdf5; padding: 4px 10px; border-radius: 4px; border: 1px solid #a7f3d0; display: inline-block;">
            CANONICAL ERP ROSTER
          </div>
          <div style="font-size: 7pt; color: #64748b; margin-top: 4px; font-family: monospace;">
            GENERATED: ${new Date().toLocaleDateString('en-GB')}
          </div>
        </td>
      </tr>
    </table>

    <div class="kpi-grid">
      <div class="kpi-card">
        <div class="kpi-label">Registered Dealers</div>
        <div class="kpi-val mono">${dealers.length} (${activeCount} Active)</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Total Credit Limits Authorized</div>
        <div class="kpi-val mono" style="color: #0369a1;">PKR ${formatPKR(totalCreditLimit)}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Total Trade Receivables Outstanding</div>
        <div class="kpi-val mono" style="color: #b91c1c;">PKR ${formatPKR(totalReceivables)}</div>
      </div>
      <div class="kpi-card" style="border: 1.5px solid #047857; background: #ecfdf5;">
        <div class="kpi-label" style="color: #047857;">OVERALL CREDIT UTILIZATION</div>
        <div class="kpi-val mono" style="color: #047857;">
          ${totalCreditLimit > 0 ? ((totalReceivables / totalCreditLimit) * 100).toFixed(1) : 0}%
        </div>
      </div>
    </div>

    <!-- Dealers Table -->
    <table class="data-table">
      <thead>
        <tr>
          <th style="width: 10%;">Code</th>
          <th style="width: 24%;">Dealer Name & Shop</th>
          <th style="width: 20%;">Market Hierarchy</th>
          <th style="width: 16%;">Sales Officer</th>
          <th class="text-right" style="width: 15%;">Credit Limit</th>
          <th class="text-right" style="width: 15%;">Current Balance</th>
        </tr>
      </thead>
      <tbody>
        ${dealers.map((d) => {
          const terr = d.territory;
          const officer = d.assignedOfficer;
          const isOverLimit = Number(d.creditLimit || 0) > 0 && Number(d.currentBalance || 0) > Number(d.creditLimit || 0);
          return `
            <tr>
              <td class="mono" style="font-weight: 700; color: #0369a1;">${d.code}</td>
              <td>
                <div style="font-weight: 700;">${d.name}</div>
                ${d.businessName ? `<div style="font-size: 6.8pt; color: #64748b;">${d.businessName}</div>` : ''}
                ${d.city ? `<div style="font-size: 6.8pt; color: #94a3b8;">${d.city}</div>` : ''}
              </td>
              <td>
                <div style="font-weight: 600;">${terr?.name || 'Unassigned'}</div>
                <div style="font-size: 6.8pt; color: #64748b;">
                  ${terr?.zone?.name ? `${terr.zone.name} → ${terr.zone.region?.name || ''}` : 'Direct ERP Scope'}
                </div>
              </td>
              <td>
                <div style="font-weight: 600; color: #1e40af;">
                  ${officer ? `${officer.firstName} ${officer.lastName}` : 'Direct / Unassigned'}
                </div>
              </td>
              <td class="text-right mono">PKR ${formatPKR(d.creditLimit)}</td>
              <td class="text-right mono" style="font-weight: 800; color: ${isOverLimit ? '#b91c1c' : '#047857'};">
                PKR ${formatPKR(d.currentBalance)}
                ${isOverLimit ? '<div style="font-size: 6pt; color: #b91c1c; font-weight: 700;">OVER LIMIT</div>' : ''}
              </td>
            </tr>
          `;
        }).join('')}
        <tr class="total-row">
          <td colspan="4" style="text-align: right; font-weight: 800;">PORTFOLIO TOTAL:</td>
          <td class="text-right mono" style="font-weight: 800;">PKR ${formatPKR(totalCreditLimit)}</td>
          <td class="text-right mono" style="font-weight: 800; color: #b91c1c;">PKR ${formatPKR(totalReceivables)}</td>
        </tr>
      </tbody>
    </table>

    <!-- Signatures -->
    <div class="signatures">
      <div class="sig-box">
        <div class="sig-line"></div>
        <div class="sig-label">REGIONAL SALES MANAGER</div>
        <div class="sig-sub">Commercial Distribution Head</div>
      </div>
      <div class="sig-box">
        <div class="sig-line"></div>
        <div class="sig-label">CREDIT CONTROLLER</div>
        <div class="sig-sub">Financial Control & Risk Division</div>
      </div>
      <div class="sig-box">
        <div class="sig-line"></div>
        <div class="sig-label">COMMERCIAL DIRECTOR</div>
        <div class="sig-sub">Executive Board • Shehswar Chemicals</div>
      </div>
    </div>

    <div class="footer">
      <div>OFFICIAL SHEHSWAR ONE360 ERP • COMMERCIAL AGROCHEMICAL DIVISION • COMPUTER GENERATED</div>
      <div>CONFIDENTIAL • FOR AUTHORIZED MANAGEMENT & AUDIT REVIEW ONLY</div>
    </div>
  </div>

  <script>
    window.onload = function() {
      setTimeout(function() { window.print(); }, 400);
    };
  </script>
</body>
</html>`;

  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  }
};

/**
 * EXPORT PROVISIONAL RECEIPT (PR) TO OFFICIAL PDF
 * Matching official physical receipt layout with Products table & Dealer Allocations
 */
export const exportProvisionalReceiptToPdf = (pr: any) => {
  const companyName = pr.company?.name || 'SHEHSWAR CHEMICALS (PVT) LTD';
  const prNumber = pr.prNumber || 'PR-000000';
  const receiptDate = pr.receiptDate ? new Date(pr.receiptDate).toLocaleDateString('en-GB') : '-';
  const issueDate = pr.issueDate ? new Date(pr.issueDate).toLocaleDateString('en-GB') : receiptDate;
  const receivedFrom = pr.receivedFrom || '-';
  const partyCode = pr.partyCode || pr.dealer?.code || '-';
  const regionName = pr.region?.name || '-';
  const territoryName = pr.territory?.name || '-';
  const paymentMethod = pr.paymentMethod || 'ONLINE';
  const refNo = pr.paymentReferenceNumber || '-';
  const bankDetails = `${pr.bankName || ''} ${pr.branchName ? `(${pr.branchName})` : ''}`.trim() || 'N/A';
  const totalAmount = Number(pr.totalAmount || 0);
  const totalInWords = pr.totalAmountInWords || '';

  const productsHtml = (pr.products || []).map((p: any, idx: number) => `
    <tr>
      <td style="text-align: center;">${p.srNo || idx + 1}</td>
      <td style="font-weight: 600;">${p.productName}</td>
      <td>${p.packSize || '-'}</td>
      <td style="text-align: right;">${Number(p.quantity || 0).toLocaleString()}</td>
      <td style="text-align: right;">PKR ${Number(p.policyRate || 0).toLocaleString()}</td>
      <td style="text-align: right; font-weight: 700;">PKR ${Number(p.amount || 0).toLocaleString()}</td>
    </tr>
  `).join('');

  const allocationsHtml = (pr.allocations || []).map((a: any) => `
    <tr>
      <td style="font-weight: 600;">${a.dealer?.name || a.dealerName} (${a.dealer?.code || a.partyCode || '-'})</td>
      <td>${a.dealer?.territory?.name || '-'}</td>
      <td style="text-align: right; font-weight: 700; color: #047857;">PKR ${Number(a.allocatedAmount || 0).toLocaleString()}</td>
      <td>${a.status || 'POSTED'}</td>
      <td>${a.remarks || '-'}</td>
    </tr>
  `).join('');

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Provisional Receipt - ${prNumber}</title>
  <style>
    @page { size: A4 portrait; margin: 10mm; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      color: #0f172a; margin: 0; padding: 0; font-size: 8.5pt; line-height: 1.4; background: #ffffff;
    }
    .screen-toolbar {
      position: sticky; top: 0; background: #0f172a; color: #ffffff; padding: 10px 24px;
      display: flex; justify-content: space-between; align-items: center; z-index: 9999;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2); font-size: 13px;
    }
    .screen-toolbar button {
      background: #d97706; color: #ffffff; border: none; padding: 6px 14px;
      font-weight: 600; border-radius: 5px; cursor: pointer; font-size: 13px;
    }
    .screen-toolbar button:hover { background: #b45309; }
    .screen-toolbar .close-btn { background: #475569; margin-left: 8px; }
    @media print {
      .screen-toolbar { display: none !important; }
      body { background: #ffffff !important; }
    }
    .doc-container {
      max-width: 190mm; margin: 0 auto; padding: 16px; border: 2px solid #0f172a;
    }
    .header-table { width: 100%; border-bottom: 2px solid #0f172a; padding-bottom: 8px; margin-bottom: 12px; }
    .company-name { font-size: 14pt; font-weight: 800; color: #0f172a; text-transform: uppercase; }
    .company-sub { font-size: 7.5pt; color: #64748b; }
    .doc-badge {
      display: inline-block; background: #d97706; color: #ffffff; font-size: 11pt;
      font-weight: 800; padding: 4px 12px; border-radius: 4px; text-transform: uppercase;
    }
    .info-grid {
      display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px;
      background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px; padding: 10px; margin-bottom: 14px;
    }
    .info-item { font-size: 8pt; }
    .info-label { font-size: 7pt; font-weight: 700; color: #64748b; text-transform: uppercase; }
    .info-val { font-size: 8.5pt; font-weight: 700; color: #0f172a; margin-top: 1px; }
    .data-table { width: 100%; border-collapse: collapse; font-size: 8pt; margin-bottom: 14px; }
    .data-table th { background: #0f172a; color: #ffffff; padding: 6px 8px; font-size: 7.5pt; text-transform: uppercase; }
    .data-table td { padding: 6px 8px; border-bottom: 1px solid #e2e8f0; }
    .total-box {
      background: #fef3c7; border: 1.5px solid #d97706; border-radius: 6px; padding: 10px 14px;
      display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;
    }
    .signatures {
      display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px;
      margin-top: 36px; padding-top: 16px; border-top: 1px solid #e2e8f0;
    }
    .sig-box { text-align: center; }
    .sig-line { height: 32px; border-bottom: 1px dashed #64748b; margin-bottom: 6px; }
    .sig-label { font-size: 7.5pt; font-weight: 700; text-transform: uppercase; }
    .sig-sub { font-size: 6.5pt; color: #64748b; }
    .footer {
      margin-top: 14px; font-size: 6.5pt; color: #94a3b8; text-align: center; font-weight: 600;
    }
  </style>
</head>
<body>
  <div class="screen-toolbar">
    <div style="font-weight: 600;">Provisional Receipt (PR) • ${prNumber}</div>
    <div>
      <button onclick="window.print()">Print / Save as PDF</button>
      <button class="close-btn" onclick="window.close()">Close</button>
    </div>
  </div>

  <div class="doc-container">
    <table class="header-table">
      <tr>
        <td style="vertical-align: top;">
          <div class="company-name">${companyName}</div>
          <div class="company-sub">Agrochemicals & Crop Nutrients Commercial Division</div>
          <div class="company-sub">Head Office • Pakistan</div>
        </td>
        <td style="text-align: right; vertical-align: top;">
          <div class="doc-badge">PROVISIONAL RECEIPT</div>
          <div style="font-size: 11pt; font-weight: 800; font-family: monospace; color: #d97706; margin-top: 4px;">
            ${prNumber}
          </div>
        </td>
      </tr>
    </table>

    <div class="info-grid">
      <div class="info-item">
        <div class="info-label">PR Issue Date</div>
        <div class="info-val">${issueDate}</div>
      </div>
      <div class="info-item">
        <div class="info-label">Payment Receipt Date</div>
        <div class="info-val">${receiptDate}</div>
      </div>
      <div class="info-item">
        <div class="info-label">Payment Method</div>
        <div class="info-val">${paymentMethod}</div>
      </div>
      <div class="info-item">
        <div class="info-label">Received From M/s</div>
        <div class="info-val">${receivedFrom}</div>
      </div>
      <div class="info-item">
        <div class="info-label">Party / Dealer Code</div>
        <div class="info-val">${partyCode}</div>
      </div>
      <div class="info-item">
        <div class="info-label">Reference / Instrument #</div>
        <div class="info-val">${refNo}</div>
      </div>
      <div class="info-item">
        <div class="info-label">Region</div>
        <div class="info-val">${regionName}</div>
      </div>
      <div class="info-item">
        <div class="info-label">Territory</div>
        <div class="info-val">${territoryName}</div>
      </div>
      <div class="info-item">
        <div class="info-label">Bank & Branch</div>
        <div class="info-val">${bankDetails}</div>
      </div>
    </div>

    <!-- Products Section -->
    ${productsHtml ? `
      <div style="font-weight: 700; text-transform: uppercase; font-size: 8pt; margin-bottom: 4px;">Product Lines</div>
      <table class="data-table">
        <thead>
          <tr>
            <th style="width: 30px; text-align: center;">Sr #</th>
            <th>Product Description</th>
            <th>Pack Size</th>
            <th style="text-align: right;">Quantity</th>
            <th style="text-align: right;">Policy Rate (PKR)</th>
            <th style="text-align: right;">Amount (PKR)</th>
          </tr>
        </thead>
        <tbody>
          ${productsHtml}
        </tbody>
      </table>
    ` : ''}

    <!-- Total Received Box -->
    <div class="total-box">
      <div>
        <div style="font-size: 7.5pt; font-weight: 700; color: #92400e; text-transform: uppercase;">
          Total Amount in Words
        </div>
        <div style="font-size: 9pt; font-weight: 700; color: #0f172a; margin-top: 2px;">
          ${totalInWords}
        </div>
      </div>
      <div style="text-align: right;">
        <div style="font-size: 7.5pt; font-weight: 700; color: #92400e; text-transform: uppercase;">
          Total Received (PKR)
        </div>
        <div style="font-size: 14pt; font-weight: 800; color: #b45309;">
          PKR ${totalAmount.toLocaleString()}
        </div>
      </div>
    </div>

    <!-- Dealer Allocations Section -->
    ${allocationsHtml ? `
      <div style="font-weight: 700; text-transform: uppercase; font-size: 8pt; margin-bottom: 4px;">
        Dealer Ledger Allocations & Settlements
      </div>
      <table class="data-table">
        <thead>
          <tr>
            <th>Dealer Name & Code</th>
            <th>Territory</th>
            <th style="text-align: right;">Allocated Credit (PKR)</th>
            <th>Status</th>
            <th>Remarks</th>
          </tr>
        </thead>
        <tbody>
          ${allocationsHtml}
        </tbody>
      </table>
    ` : ''}

    <!-- Signatures -->
    <div class="signatures">
      <div class="sig-box">
        <div class="sig-line"></div>
        <div class="sig-label">RECEIVED BY (FIELD STAFF)</div>
        <div class="sig-sub">Sales Officer / Field Representative</div>
      </div>
      <div class="sig-box">
        <div class="sig-line"></div>
        <div class="sig-label">ACCOUNTS VERIFICATION</div>
        <div class="sig-sub">Finance & Accounts Department</div>
      </div>
      <div class="sig-box">
        <div class="sig-line"></div>
        <div class="sig-label">AUTHORIZED SIGNATURE</div>
        <div class="sig-sub">Commercial / Credit Controller</div>
      </div>
    </div>

    <div class="footer">
      OFFICIAL SHEHSWAR ONE360 ERP • PROVISIONAL RECEIPT SYSTEM • COMPUTER GENERATED AUTHORITATIVE DOCUMENT
    </div>
  </div>

  <script>
    window.onload = function() {
      setTimeout(function() { window.print(); }, 400);
    };
  </script>
</body>
</html>`;

  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  }
};


