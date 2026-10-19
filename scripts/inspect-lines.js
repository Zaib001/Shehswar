const fs = require('fs');
const pdfModule = require('pdf-parse');

async function testExtraction() {
  const filePath = 'C:/Users/Ata/.gemini/antigravity-ide/brain/4d6f0476-1e9e-4d43-8166-185bddd40df9/.user_uploaded/media_1791373115953.pdf';
  const buffer = fs.readFileSync(filePath);
  let rawText = '';
  if (pdfModule && pdfModule.PDFParse) {
    const parser = new pdfModule.PDFParse({ data: buffer });
    const res = await parser.getText();
    rawText = res?.text || '';
  } else if (typeof pdfModule === 'function') {
    const res = await pdfModule(buffer);
    rawText = res?.text || '';
  }

  const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  console.log('--- ALL LINES ---');
  lines.forEach((l, idx) => console.log(`[${idx}] "${l}"`));
}

testExtraction().catch(console.error);
