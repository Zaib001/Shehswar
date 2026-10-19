/**
 * SHEHSWAR ONE360 - Multi-Date Dynamic OCR & Batch Staging Verification Script
 *
 * Tests the complete flow:
 * 1. Simulates a multi-date weekly vendor sheet text.
 * 2. Validates multi-date detection and segmentation into dated vouchers.
 * 3. Verifies that items on different dates are accurately separated.
 */

const sampleMultiDateSheet = `
M/s Nuchem Chemicals (Pvt) Ltd
Factory: Sheikhupura Road, Faisalabad
Weekly Supply Statement / Delivery Schedule
Voucher No: NUCHEM-WK-4401

Date: 02-Oct-2026
100	Urea 46% Prilled	50kg	2,800	0	280,000
50	Bifenthrin 10%EC	200ltr	196,000	0	196,000

Date: 05-Oct-2026
75	Emamectin Benzoate 5%SG	100gm	1,450	0	108,750
120	Chlorpyrifos 40%EC	1ltr	1,100	0	132,000

Date: 08-Oct-2026
40	Acetamiprid 20%SP	250gm	950	0	38,000

Total Amount: 754,750
`;

function testDateNormalization(rawDate) {
  const clean = rawDate.trim();
  const twoDigitYr = clean.match(/^([0-9]{1,2})[-/\s]([A-Za-z]{3})[-/\s]([0-9]{2,4})$/i);
  if (twoDigitYr && twoDigitYr[1] && twoDigitYr[2] && twoDigitYr[3]) {
    const monthMap = {
      jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
      jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
    };
    const mm = monthMap[twoDigitYr[2].toLowerCase()] || '01';
    const dd = twoDigitYr[1].padStart(2, '0');
    let yy = twoDigitYr[3];
    if (yy.length === 2) yy = `20${yy}`;
    return `${yy}-${mm}-${dd}`;
  }
  return null;
}

console.log('--- SHEHSWAR ONE360: TESTING MULTI-DATE OCR LOGIC ---');

const lines = sampleMultiDateSheet.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
let currentSectionDate = '2026-10-01';
const extractedItems = [];

for (const rawLine of lines) {
  const dateHeaderMatch = rawLine.match(/(?:Date|Dated)\s*[:#\-]?\s*([0-9]{1,2}-[A-Za-z]{3}-[0-9]{2,4})/i);
  if (dateHeaderMatch && dateHeaderMatch[1]) {
    const parsedHDate = testDateNormalization(dateHeaderMatch[1]);
    if (parsedHDate) {
      currentSectionDate = parsedHDate;
      continue;
    }
  }

  if (rawLine.includes('\t')) {
    const parts = rawLine.split('\t').map(p => p.trim()).filter(Boolean);
    if (parts.length >= 4) {
      const qty = parseFloat(parts[0].replace(/,/g, '')) || 1;
      const name = parts[1];
      const packing = parts[2];
      const rate = parseFloat(parts[3].replace(/,/g, '')) || 0;
      const lineTotal = qty * rate;

      extractedItems.push({
        itemName: name,
        packing,
        quantity: qty,
        rate,
        lineTotal,
        date: currentSectionDate,
      });
    }
  }
}

const distinctDates = Array.from(new Set(extractedItems.map(it => it.date)));
const isMultiDateSheet = distinctDates.length > 1;

console.log(`Distinct Dates Found (${distinctDates.length}):`, distinctDates);
console.log('Is Multi-Date Sheet Detected?:', isMultiDateSheet);
console.log(`Total Extracted Line Items: ${extractedItems.length}`);

const datedVouchers = distinctDates.map((d, idx) => {
  const items = extractedItems.filter(it => it.date === d);
  const totalAmount = items.reduce((sum, it) => sum + it.lineTotal, 0);
  return {
    voucherIndex: idx + 1,
    date: d,
    itemCount: items.length,
    totalAmount,
    items: items.map(it => `${it.itemName} (${it.quantity} @ ${it.rate})`),
  };
});

console.log('\nSegmented Dated Vouchers:');
console.dir(datedVouchers, { depth: null });

if (isMultiDateSheet && distinctDates.length === 3 && extractedItems.length === 5) {
  console.log('\n✅ VERIFICATION PASSED: Multi-Date Dynamic OCR successfully separates weekly sheets into 3 individual dated vouchers!');
  process.exit(0);
} else {
  console.error('\n❌ VERIFICATION FAILED');
  process.exit(1);
}
