const fs = require('fs');
const pdfModule = require('pdf-parse');

async function testPdf() {
  const filePath = 'C:/Users/Ata/.gemini/antigravity-ide/brain/4d6f0476-1e9e-4d43-8166-185bddd40df9/.user_uploaded/media_1791373115953.pdf';
  if (!fs.existsSync(filePath)) {
    console.log('File does not exist:', filePath);
    return;
  }
  const buffer = fs.readFileSync(filePath);
  let text = '';
  if (pdfModule && pdfModule.PDFParse) {
    const parser = new pdfModule.PDFParse({ data: buffer });
    const res = await parser.getText();
    text = (res?.text || '').trim();
  } else if (typeof pdfModule === 'function') {
    const res = await pdfModule(buffer);
    text = (res?.text || '').trim();
  }
  console.log('--- EXTRACTED RAW TEXT ---');
  console.log(text);
  console.log('--- END RAW TEXT ---');
}

testPdf().catch(console.error);
