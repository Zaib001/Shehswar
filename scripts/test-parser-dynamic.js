const fs = require('fs');
const pdfModule = require('pdf-parse');

function cleanProductName(str) {
  if (!str) return '';
  let name = str.trim();
  // Strip leading serial number e.g. "1. " or "1\t" or "01 - "
  name = name.replace(/^[0-9]{1,3}[.)\-\s\t]+/, '');
  // Strip trailing gross value / amounts e.g. "Bifenthrin 10%EC 392,000" -> "Bifenthrin 10%EC"
  name = name.replace(/\s+[0-9]{1,3}(?:,[0-9]{3})+(?:\.[0-9]+)?$/, '');
  name = name.replace(/\s+[0-9]{4,}(?:\.[0-9]+)?$/, '');
  return name.trim();
}

function extractPackingAndUom(text) {
  const packMatch = text.match(/([0-9.]+\s*(?:ltr|kg|gm|g|ml|l|pcs|drum|can|bag|box|pack|bottle|barrel|ctn|ton))/i);
  if (packMatch) {
    const packing = packMatch[1].trim();
    const uom = /kg|gm|g/i.test(packing) ? 'KG' : /ltr|ml|l/i.test(packing) ? 'LTR' : /bag/i.test(packing) ? 'BAG' : /drum/i.test(packing) ? 'DRUM' : 'PCS';
    return { packing, uom };
  }
  const uomMatch = text.match(/\b(KG|LTR|L|ML|GM|PCS|BAG|DRUM|CAN|BOX|BOTTLE|TON)\b/i);
  if (uomMatch) {
    const uom = uomMatch[1].toUpperCase() === 'L' ? 'LTR' : uomMatch[1].toUpperCase();
    return { packing: 'Bulk', uom };
  }
  return { packing: 'Bulk', uom: 'KG' };
}

function parseDocument(rawText, fileName) {
  const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const today = new Date().toISOString().split('T')[0];

  // Document Number
  let docNumber = '';
  const voucherMatch = rawText.match(/(?:Voucher|Vchr)\s*(?:No\.?|#)?\s*[:.\s-]*([A-Za-z0-9\-_/]{2,35})/i);
  const poNumMatch = rawText.match(/(?:P\.?O\.?|Purchase\s*Order|Order|Invoice|Inv|Bill)\s*(?:Number|No\.?|#)?\s*[:#\-]?\s*([A-Za-z0-9\-_/]{2,35})/i);
  if (voucherMatch && voucherMatch[1] && !/^(Warehouse|Date|Total|Party)/i.test(voucherMatch[1].trim())) {
    docNumber = voucherMatch[1].trim();
  } else if (poNumMatch && poNumMatch[1] && !/^(Warehouse|Date|Total|Party)/i.test(poNumMatch[1].trim())) {
    docNumber = poNumMatch[1].trim();
  } else {
    docNumber = `PO-${Date.now().toString().slice(-6)}`;
  }

  // Date
  let docDate = today;
  const dateMatch = rawText.match(/(?:Date|Dated)\s*[:#\-]?\s*([0-9]{1,2}-[A-Za-z]{3}-[0-9]{2,4}|[0-9]{1,4}[-/.][0-9]{1,2}[-/.][0-9]{2,4})/i) ||
                    rawText.match(/([0-9]{1,2}-[A-Za-z]{3}-[0-9]{2,4})/i);
  if (dateMatch && dateMatch[1]) {
    const rawD = dateMatch[1].trim();
    const twoDigitYr = rawD.match(/^([0-9]{1,2})-([A-Za-z]{3})-([0-9]{2,4})$/i);
    if (twoDigitYr) {
      const monthMap = { jan:'01', feb:'02', mar:'03', apr:'04', may:'05', jun:'06', jul:'07', aug:'08', sep:'09', oct:'10', nov:'11', dec:'12' };
      const mm = monthMap[twoDigitYr[2].toLowerCase()] || '01';
      const dd = twoDigitYr[1].padStart(2, '0');
      let yy = twoDigitYr[3];
      if (yy.length === 2) yy = `20${yy}`;
      docDate = `${yy}-${mm}-${dd}`;
    }
  }

  // Vendor / Party
  let vendorName = '';
  const partyMatch = rawText.match(/(?:Party|Vendor|Supplier|Sold By|From|M\/s|Shipper)\s*[:#\-]?\s*([^\n\r,;]{3,60})/i);
  if (partyMatch && partyMatch[1]) {
    const cand = partyMatch[1].trim();
    if (!cand.startsWith('/') && !/^(Address|Date|Invoice|Warehouse|Total)/i.test(cand)) {
      vendorName = cand;
    }
  }

  // Warehouse
  let warehouseName = '';
  const whMatch = rawText.match(/(?:Warehouse|WH|Location|Store)\s*[:#\-]?\s*([^\n\r,;]{3,50})/i);
  if (whMatch && whMatch[1]) {
    const candWh = whMatch[1].trim();
    if (!candWh.startsWith('/') && !/^(Incharg|Date|Invoice|Total|Party)/i.test(candWh)) {
      warehouseName = candWh;
    }
  }

  // Financials
  let subtotal = 0;
  const subMatch = rawText.match(/(?:Sub\s*Total|Gross\s*Total|G\.Value)\s*[:#\-]?\s*([0-9,]+(?:\.[0-9]+)?)/i);
  if (subMatch) subtotal = parseFloat(subMatch[1].replace(/,/g, '')) || 0;

  let taxPercent = 0;
  let taxAmount = 0;
  const taxMatch = rawText.match(/Sales\s*Tax\s*@\s*([0-9.]+)%\s*([0-9,]+(?:\.[0-9]+)?)/i);
  if (taxMatch) {
    taxPercent = parseFloat(taxMatch[1]) || 0;
    taxAmount = parseFloat(taxMatch[2].replace(/,/g, '')) || 0;
  }

  let totalAmount = 0;
  const totMatch = rawText.match(/(?:Total|Grand\s*Total|Net\s*Total|Payable)\s*[:#\-]?\s*([0-9,]+(?:\.[0-9]+)?)/i);
  if (totMatch) totalAmount = parseFloat(totMatch[1].replace(/,/g, '')) || 0;

  // Extra dynamic properties
  const extraFields = {};
  const ntnMatch = rawText.match(/NTN\s*[:#\-]?\s*([0-9\-]+)/i);
  if (ntnMatch) extraFields['ntn'] = ntnMatch[1].trim();
  const strnMatch = rawText.match(/STRN\s*[:#\-]?\s*([0-9\-]+)/i);
  if (strnMatch) extraFields['strn'] = strnMatch[1].trim();
  const phoneMatch = rawText.match(/(?:Ph|Phone|Tel|Mobile)\s*[:#\-.]?\s*([0-9\-+\s]{8,20})/i);
  if (phoneMatch) extraFields['phone'] = phoneMatch[1].trim();
  const addrMatch = rawText.match(/Plot\s*#?\s*([^\n\r]+)/i);
  if (addrMatch) extraFields['address'] = addrMatch[0].trim();

  // Line items
  const items = [];
  const isHeader = (l) => /(?:Product\s*Name|Item\s*Name|Description|Particulars)/i.test(l) && /(?:Qty|Quantity|Rate|Price|Amount|Value)/i.test(l);

  for (const line of lines) {
    if (isHeader(line) || /^--\s*\d+\s*of\s*\d+\s*--$/i.test(line)) continue;
    if (/^(?:Sub\s*Total|Total|Sales\s*Tax|Party|Address|Invoice\s*No|Date|Warehouse\s*Incharg|Shahsawar\s*Group|Plot\s*#)/i.test(line)) continue;

    if (line.includes('\t')) {
      const parts = line.split('\t').map(p => p.trim()).filter(Boolean);
      if (parts.length >= 2) {
        let qty = 0;
        let name = '';
        let rest = '';

        if (/^[0-9,.]+$/.test(parts[0])) {
          qty = parseFloat(parts[0].replace(/,/g, '')) || 1;
          name = cleanProductName(parts[1]);
          rest = parts.slice(2).join(' ');
        } else {
          name = cleanProductName(parts[0]);
          rest = parts.slice(1).join(' ');
          const qtyMatch = rest.match(/\b([0-9,.]+)\b/);
          if (qtyMatch) qty = parseFloat(qtyMatch[1].replace(/,/g, '')) || 1;
        }

        if (name && name.length >= 2) {
          const { packing, uom } = extractPackingAndUom(rest);
          const nums = rest.replace(/[0-9.]+\s*(?:ltr|kg|gm|g|ml|l|pcs|drum|can|bag|box|pack|bottle|barrel|ctn)/gi, '')
                           .match(/[0-9,]+(?:\.[0-9]+)?/g) || [];
          const cleanNums = nums.map(n => parseFloat(n.replace(/,/g, ''))).filter(n => !isNaN(n));
          
          let rate = 0;
          let lineAmount = 0;
          if (cleanNums.length >= 2) {
            rate = cleanNums[0];
            lineAmount = cleanNums[cleanNums.length - 1];
          } else if (cleanNums.length === 1) {
            rate = cleanNums[0];
            lineAmount = qty * rate;
          }

          items.push({
            itemName: name,
            materialType: 'RAW_MATERIAL',
            packing,
            uom,
            quantity: qty,
            rate,
            lineAmount: lineAmount || (qty * rate),
          });
          continue;
        }
      }
    }

    // Pattern B
    const m1 = line.match(/^([0-9,.]+)\s+(.+?)\s+([0-9.]+\s*(?:ltr|kg|gm|g|ml|l|pcs|drum|can|bag|box|pack|bottle|barrel|ctn))\s+([0-9,.]+)(.*)$/i);
    if (m1) {
      const qty = parseFloat(m1[1].replace(/,/g, '')) || 1;
      const rawName = m1[2];
      const packing = m1[3].trim();
      const rate = parseFloat(m1[4].replace(/,/g, '')) || 0;
      const name = cleanProductName(rawName);
      if (name && name.length >= 2 && !/^(Total|Sub Total|Date)/i.test(name)) {
        const { uom } = extractPackingAndUom(packing);
        items.push({
          itemName: name,
          materialType: 'RAW_MATERIAL',
          packing,
          uom,
          quantity: qty,
          rate,
          lineAmount: qty * rate,
        });
        continue;
      }
    }

    // Pattern C
    const m2 = line.match(/^(.+?)\s+([0-9.]+\s*(?:ltr|kg|gm|g|ml|l|pcs|drum|can|bag|box|pack|bottle|barrel|ctn))\s+([0-9,.]+)\s+([0-9,.]+)/i);
    if (m2) {
      const rawName = m2[1];
      const packing = m2[2].trim();
      const qty = parseFloat(m2[3].replace(/,/g, '')) || 1;
      const rate = parseFloat(m2[4].replace(/,/g, '')) || 0;
      const name = cleanProductName(rawName);
      if (name && name.length >= 2 && !/^(Total|Sub Total|Date)/i.test(name)) {
        const { uom } = extractPackingAndUom(packing);
        items.push({
          itemName: name,
          materialType: 'RAW_MATERIAL',
          packing,
          uom,
          quantity: qty,
          rate,
          lineAmount: qty * rate,
        });
        continue;
      }
    }

    // Pattern D: [Product Name] [Qty] [Unit] [Rate] [Total]
    const m3 = line.match(/^([A-Za-z0-9\s%()\-.,/&]{2,60}?)\s+([0-9,.]+)\s*(KG|LTR|L|ML|GM|PCS|BAG|DRUM|CAN|BOX|BOTTLE|TON)\s+(?:@\s*)?([0-9,.]+)(?:\s+([0-9,.]+))?/i);
    if (m3) {
      const name = cleanProductName(m3[1]);
      const qty = parseFloat(m3[2].replace(/,/g, '')) || 1;
      const uom = m3[3].toUpperCase() === 'L' ? 'LTR' : m3[3].toUpperCase();
      const rate = parseFloat(m3[4].replace(/,/g, '')) || 0;
      const lineAmount = m3[5] ? parseFloat(m3[5].replace(/,/g, '')) : qty * rate;
      if (name && name.length >= 2 && !/^(Total|Sub Total|Date)/i.test(name)) {
        items.push({
          itemName: name,
          materialType: 'RAW_MATERIAL',
          packing: uom === 'PCS' ? 'Pieces' : 'Bulk',
          uom,
          quantity: qty,
          rate,
          lineAmount,
        });
        continue;
      }
    }
  }

  return {
    docNumber,
    docDate,
    vendorName,
    warehouseName,
    subtotal,
    taxPercent,
    taxAmount,
    totalAmount: totalAmount || subtotal,
    extraFields,
    items,
  };
}

async function run() {
  const filePath = 'C:/Users/Ata/.gemini/antigravity-ide/brain/4d6f0476-1e9e-4d43-8166-185bddd40df9/.user_uploaded/media_1791373115953.pdf';
  const buffer = fs.readFileSync(filePath);
  const parser = new pdfModule.PDFParse({ data: buffer });
  const res = await parser.getText();
  const parsed = parseDocument(res.text, 'media_1791373115953.pdf');
  console.log('--- FULL DYNAMIC EXTRACTION RESULT ---');
  console.log(JSON.stringify(parsed, null, 2));
}

run().catch(console.error);
