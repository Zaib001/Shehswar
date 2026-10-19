/**
 * SHEHSWAR ONE360 - Document Extraction & OCR Service
 *
 * Follows Canonical System Specification:
 *  - Reads POs, Vendor Invoices, Gate Passes, and Bank Receipts
 *  - Real text & OCR extraction via pdf-parse and tesseract.js
 *  - Extracts structured fields: PO No, Dates, Vendor, Items, Quantities, Rates, Totals, Bank details
 *  - Automatically matches Vendor and Materials against DB Master Data
 *  - Persists extraction to `DocumentExtractionRecord` table (File + OCR stored structurally)
 *  - Serves as the primary frictionless input for Purchase Orders, Purchases, and Dealer Payments
 */
import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { DocumentNumberingService } from '../../platform/document-numbering/document-numbering.service';
import { uuidv7 } from '@shehswar/shared';

export interface ExtractedLineItem {
  itemName: string;
  materialType: 'RAW_MATERIAL' | 'PACKING_MATERIAL' | 'FINISHED_PRODUCT';
  packing?: string;
  uom?: string;
  quantity: number;
  rate: number;
  lineAmount: number;
  discount?: number;
  tax?: number;
  date?: string;
  matchedId?: string;
  matchedName?: string;
  isExisting: boolean;
  isNewAutoCreated?: boolean;
}

export interface DatedVoucher {
  date: string;
  voucherNumber?: string;
  items: ExtractedLineItem[];
  totalAmount: number;
}

export interface OcrExtractionResult {
  extractionId: string;
  documentType: 'PURCHASE_ORDER' | 'VENDOR_INVOICE' | 'PURCHASE_INVOICE' | 'GATE_PASS' | 'BANK_RECEIPT' | 'CASH_RECEIPT';
  fileName: string;
  fileUrl: string;
  confidence: number;
  extractedFields: Record<string, any>;
  matchedVendor?: { id: string; name: string; code: string; confidence: number; isNew?: boolean };
  matchedWarehouse?: { id: string; name: string; code: string };
  matchedItems: ExtractedLineItem[];
  isMultiDateSheet?: boolean;
  datedVouchers?: DatedVoucher[];
}

@Injectable()
export class OcrService {
  private readonly logger = new Logger(OcrService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly documentNumbering: DocumentNumberingService,
  ) {}

  /**
   * Process and extract structured data from uploaded document
   */
  async processDocument(params: {
    companyId?: string;
    organizationId?: string;
    documentType: 'PURCHASE_ORDER' | 'VENDOR_INVOICE' | 'PURCHASE_INVOICE' | 'GATE_PASS' | 'BANK_RECEIPT';
    fileName: string;
    fileUrl?: string;
    fileBuffer?: Buffer;
    mimeType?: string;
    fileContentBase64?: string;
    rawTextHint?: string;
  }): Promise<OcrExtractionResult> {
    const { documentType, fileName, fileBuffer, mimeType, fileContentBase64, rawTextHint } = params;

    let companyId = params.companyId;
    let orgId = params.organizationId;

    if (!companyId) {
      const defaultCompany = await this.prisma.company.findFirst({
        where: orgId ? { organizationId: orgId } : undefined,
        select: { id: true, organizationId: true },
      });
      if (defaultCompany) {
        companyId = defaultCompany.id;
        orgId = orgId || defaultCompany.organizationId;
      } else {
        const anyCompany = await this.prisma.company.findFirst({
          select: { id: true, organizationId: true },
        });
        if (!anyCompany) throw new BadRequestException('No active company found in system');
        companyId = anyCompany.id;
        orgId = orgId || anyCompany.organizationId;
      }
    } else if (!orgId) {
      const company = await this.prisma.company.findUnique({
        where: { id: companyId },
        select: { organizationId: true },
      });
      if (!company) throw new BadRequestException('Company not found');
      orgId = company.organizationId;
    }

    // 1. Resolve effective Buffer if base64 was passed
    let effectiveBuffer = fileBuffer;
    if (!effectiveBuffer && fileContentBase64) {
      try {
        effectiveBuffer = Buffer.from(fileContentBase64, 'base64');
      } catch (err: any) {
        this.logger.warn(`Failed to decode base64 file content: ${err.message}`);
      }
    }

    // 2. Extract real raw text from buffer / PDF / Image OCR
    const uncleanedText = await this.extractRawText(effectiveBuffer, fileName, mimeType, rawTextHint);
    const rawText = this.sanitizeText(uncleanedText);
    this.logger.log(`Document [${fileName}] text extracted. Length: ${rawText.length} characters`);

    // 3. Query master data for automated matching (Vendors, Materials, Warehouses)
    const [vendors, rawMaterials, packingMaterials, finishedProducts, warehouses] = await Promise.all([
      this.prisma.vendor.findMany({
        where: { companyId },
        select: { id: true, name: true, code: true },
      }),
      this.prisma.rawMaterial.findMany({
        where: { companyId },
        select: { id: true, materialName: true, materialCode: true, lastPurchaseCost: true, standardCost: true },
      }),
      this.prisma.packingMaterial.findMany({
        where: { companyId },
        select: { id: true, materialName: true, materialCode: true, lastPurchaseCost: true, standardCost: true },
      }),
      this.prisma.finishedProduct.findMany({
        where: { companyId },
        select: { id: true, productName: true, productCode: true, defaultSellingPrice: true },
      }),
      this.prisma.warehouse.findMany({
        where: { companyId },
        select: { id: true, name: true, code: true },
      }),
    ]);

    // 4. Parse real extracted text into structured ERP domain fields
    const parsedData = this.parseExtractedText({
      rawText,
      documentType,
      fileName,
      vendors,
      rawMaterials,
      packingMaterials,
      finishedProducts,
    });

    // 5. Ensure sequential PO number if not explicitly defined in the document
    if (documentType === 'PURCHASE_ORDER' && (!parsedData.poNumber || !parsedData.poNumberExplicit)) {
      try {
        const nextPo = await this.documentNumbering.getNextDocumentNumber({
          organizationId: orgId,
          companyId,
          documentType: 'PO',
          prefixOverride: `PO-${new Date().getFullYear()}`,
        });
        parsedData.poNumber = nextPo;
        parsedData.docNumber = nextPo;
        parsedData.voucherNumber = nextPo;
      } catch (err: any) {
        this.logger.warn(`Could not generate sequential PO number: ${err.message}`);
      }
    }

    // 6. Match Vendor with highest confidence or auto-create directly in Vendor master section
    let matchedVendor: any = undefined;
    if (parsedData.matchedVendorId) {
      const v = vendors.find((vend) => vend.id === parsedData.matchedVendorId);
      if (v) matchedVendor = { id: v.id, name: v.name, code: v.code, confidence: 0.95 };
    } else if (parsedData.vendorName && parsedData.vendorName.trim().length > 2) {
      const vNorm = parsedData.vendorName.toLowerCase().trim();
      const direct = vendors.find(
        (v) => v.name.toLowerCase().includes(vNorm) || vNorm.includes(v.name.toLowerCase()),
      );
      if (direct) {
        matchedVendor = { id: direct.id, name: direct.name, code: direct.code, confidence: 0.95 };
      } else {
        // Auto-create APPROVED vendor directly in Vendor Master Section
        try {
          const cleanVName = parsedData.vendorName.trim();
          const vendorCode = `VEND-${cleanVName.replace(/[^A-Za-z0-9]/g, '').slice(0, 5).toUpperCase() || 'VEND'}-${Math.floor(100 + Math.random() * 900)}`;
          const newVendor = await this.prisma.vendor.create({
            data: {
              id: uuidv7(),
              organizationId: orgId,
              companyId,
              code: vendorCode,
              name: cleanVName,
              vendorType: 'RAW_MATERIAL',
              status: 'APPROVED',
              currency: 'PKR',
              paymentTerms: '30_DAYS_CREDIT',
            },
          });
          matchedVendor = { id: newVendor.id, name: newVendor.name, code: newVendor.code, confidence: 0.95, isNew: true };
          vendors.push({ id: newVendor.id, name: newVendor.name, code: newVendor.code });
          this.logger.log(`Auto-created vendor in Master Section: ${newVendor.name} (${newVendor.code})`);
        } catch (e: any) {
          this.logger.warn(`Could not auto-create vendor ${parsedData.vendorName}: ${e.message}`);
          if (vendors.length > 0 && vendors[0]) {
            matchedVendor = { id: vendors[0].id, name: vendors[0].name, code: vendors[0].code, confidence: 0.5 };
          }
        }
      }
    } else if (vendors.length > 0 && vendors[0]) {
      matchedVendor = { id: vendors[0].id, name: vendors[0].name, code: vendors[0].code, confidence: 0.5 };
    }

    // 7. Match Warehouse or auto-create
    let matchedWarehouse: any = undefined;
    if (parsedData.warehouseName && parsedData.warehouseName.trim().length > 1) {
      const whNorm = parsedData.warehouseName.toLowerCase().trim();
      const directWh = warehouses.find(
        (w) =>
          w.name.toLowerCase().includes(whNorm) ||
          whNorm.includes(w.name.toLowerCase()) ||
          (w.code && whNorm.includes(w.code.toLowerCase())),
      );
      if (directWh) {
        matchedWarehouse = { id: directWh.id, name: directWh.name, code: directWh.code };
      } else {
        try {
          const whCode = `WH-${parsedData.warehouseName.replace(/[^A-Za-z0-9]/g, '').slice(0, 6).toUpperCase() || 'OCR'}-${Date.now().toString().slice(-3)}`;
          const newWh = await this.prisma.warehouse.create({
            data: {
              id: uuidv7(),
              companyId,
              code: whCode,
              name: `${parsedData.warehouseName.trim()} Warehouse`,
              type: 'RAW_MATERIAL',
              location: parsedData.warehouseName.trim(),
              isActive: true,
            },
          });
          matchedWarehouse = { id: newWh.id, name: newWh.name, code: newWh.code };
          this.logger.log(`Auto-created warehouse from OCR: ${newWh.name} (${newWh.id})`);
        } catch (e: any) {
          this.logger.warn(`Could not auto-create warehouse ${parsedData.warehouseName}: ${e.message}`);
        }
      }
    }
    if (!matchedWarehouse && warehouses.length > 0 && warehouses[0]) {
      matchedWarehouse = { id: warehouses[0].id, name: warehouses[0].name, code: warehouses[0].code };
    }

    // 8. Structure matched and new items - AUTO-CREATING NEW ITEMS DIRECTLY IN MASTER PRODUCT/MATERIAL SECTION
    const matchedItems = await Promise.all(
      parsedData.items.map(async (item: any) => {
        const exactItemName = (item.itemName || '').trim();
        const nameNorm = exactItemName.toLowerCase();
        const itemMatType = item.materialType || 'RAW_MATERIAL';

        // Check Raw Materials in DB
        const matchRaw = rawMaterials.find(
          (rm) =>
            rm.materialName.toLowerCase() === nameNorm ||
            rm.materialName.toLowerCase().includes(nameNorm) ||
            nameNorm.includes(rm.materialName.toLowerCase()),
        );
        if (matchRaw) {
          return {
            itemName: exactItemName,
            materialType: 'RAW_MATERIAL' as const,
            packing: item.packing || 'Bulk',
            uom: item.uom || 'KG',
            quantity: Number(item.quantity) || 1,
            rate: Number(item.rate) || Number(matchRaw.lastPurchaseCost || matchRaw.standardCost || 0),
            lineAmount: Number(item.lineAmount) || ((Number(item.quantity) || 1) * (Number(item.rate) || Number(matchRaw.lastPurchaseCost || 0))),
            discount: Number(item.discount) || 0,
            tax: Number(item.tax) || 0,
            date: item.date,
            matchedId: matchRaw.id,
            matchedName: matchRaw.materialName,
            isExisting: true,
          };
        }

        // Check Packing Materials
        const matchPack = packingMaterials.find(
          (pm) =>
            pm.materialName.toLowerCase() === nameNorm ||
            pm.materialName.toLowerCase().includes(nameNorm) ||
            nameNorm.includes(pm.materialName.toLowerCase()),
        );
        if (matchPack) {
          return {
            itemName: exactItemName,
            materialType: 'PACKING_MATERIAL' as const,
            packing: item.packing || 'Pieces',
            uom: item.uom || 'PCS',
            quantity: Number(item.quantity) || 1,
            rate: Number(item.rate) || Number(matchPack.lastPurchaseCost || matchPack.standardCost || 0),
            lineAmount: Number(item.lineAmount) || ((Number(item.quantity) || 1) * (Number(item.rate) || Number(matchPack.lastPurchaseCost || 0))),
            discount: Number(item.discount) || 0,
            tax: Number(item.tax) || 0,
            date: item.date,
            matchedId: matchPack.id,
            matchedName: matchPack.materialName,
            isExisting: true,
          };
        }

        // Check Finished Products
        const matchFP = finishedProducts.find(
          (fp) =>
            fp.productName.toLowerCase() === nameNorm ||
            fp.productName.toLowerCase().includes(nameNorm) ||
            nameNorm.includes(fp.productName.toLowerCase()),
        );
        if (matchFP) {
          return {
            itemName: exactItemName,
            materialType: 'FINISHED_PRODUCT' as const,
            packing: item.packing || 'Standard',
            uom: item.uom || 'PCS',
            quantity: Number(item.quantity) || 1,
            rate: Number(item.rate) || Number(matchFP.defaultSellingPrice || 0),
            lineAmount: Number(item.lineAmount) || ((Number(item.quantity) || 1) * (Number(item.rate) || Number(matchFP.defaultSellingPrice || 0))),
            discount: Number(item.discount) || 0,
            tax: Number(item.tax) || 0,
            date: item.date,
            matchedId: matchFP.id,
            matchedName: matchFP.productName,
            isExisting: true,
          };
        }

        // Auto-create in Master Products / Materials Section so it's permanently available!
        let autoId: string | undefined = undefined;
        let autoName: string = exactItemName || 'Purchased Material';
        if (exactItemName && exactItemName.length > 1 && !exactItemName.startsWith('/')) {
          try {
            const codeBase = exactItemName
              .replace(/[^a-zA-Z0-9\s]/g, '')
              .split(' ')
              .filter(Boolean)
              .slice(0, 3)
              .map((w: string) => w.substring(0, 3).toUpperCase())
              .join('-');

            if (itemMatType === 'PACKING_MATERIAL') {
              const code = `PM-${codeBase || 'PACK'}-${Math.floor(100 + Math.random() * 900)}`;
              const newPm = await this.prisma.packingMaterial.create({
                data: {
                  id: uuidv7(),
                  organizationId: orgId,
                  companyId,
                  materialCode: code,
                  materialName: exactItemName,
                  status: 'ACTIVE',
                  lastPurchaseCost: Number(item.rate) || undefined,
                  standardCost: Number(item.rate) || undefined,
                  description: item.packing || undefined,
                },
              });
              autoId = newPm.id;
              autoName = newPm.materialName;
              packingMaterials.push(newPm as any);
              this.logger.log(`Auto-created packing material in Master Section: ${newPm.materialName} (${newPm.materialCode})`);
            } else {
              const code = `RM-${codeBase || 'RAW'}-${Math.floor(100 + Math.random() * 900)}`;
              const newRm = await this.prisma.rawMaterial.create({
                data: {
                  id: uuidv7(),
                  organizationId: orgId,
                  companyId,
                  materialCode: code,
                  materialName: exactItemName,
                  status: 'ACTIVE',
                  approvalStatus: 'APPROVED',
                  lastPurchaseCost: Number(item.rate) || undefined,
                  standardCost: Number(item.rate) || undefined,
                  specifications: item.packing || undefined,
                },
              });
              autoId = newRm.id;
              autoName = newRm.materialName;
              rawMaterials.push(newRm as any);
              this.logger.log(`Auto-created raw material in Master Section: ${newRm.materialName} (${newRm.materialCode})`);
            }
          } catch (err: any) {
            this.logger.warn(`Could not auto-create material ${exactItemName}: ${err.message}`);
          }
        }

        return {
          itemName: autoName,
          materialType: (itemMatType as any) || 'RAW_MATERIAL',
          packing: item.packing || 'Bulk',
          uom: item.uom || 'KG',
          quantity: Number(item.quantity) || 1,
          rate: Number(item.rate) || 0,
          lineAmount: Number(item.lineAmount) || ((Number(item.quantity) || 1) * (Number(item.rate) || 0)),
          discount: Number(item.discount) || 0,
          tax: Number(item.tax) || 0,
          date: item.date,
          matchedId: autoId,
          matchedName: autoName,
          isExisting: !!autoId,
          isNewAutoCreated: !!autoId,
        };
      }),
    );

    const fileUrl = params.fileUrl || `/uploads/documents/${uuidv7()}-${fileName}`;
    const rawSnippet = this.sanitizeText((rawText || '').slice(0, 1000));
    const cleanExtractedData = this.sanitizeJson({
      rawSnippet,
      fields: parsedData,
      extraFields: parsedData.extraFields || {},
      matchedVendor,
      matchedWarehouse,
      matchedItems,
    });

    let extractionId = uuidv7();

    // 8. Persist extraction into database safely
    try {
      const extractionRecord = await this.prisma.documentExtractionRecord.create({
        data: {
          id: extractionId,
          organizationId: orgId,
          companyId,
          documentType,
          fileName: this.sanitizeText(fileName),
          fileUrl,
          extractedData: cleanExtractedData,
          matchedEntityId: matchedVendor?.id || null,
          status: 'PROCESSED',
        },
      });
      extractionId = extractionRecord.id;
      this.logger.log(`Document OCR processed & saved: ${fileName} (${documentType}) -> Extraction ID ${extractionRecord.id}`);
    } catch (dbErr: any) {
      this.logger.warn(`Failed to persist extraction record to DB: ${dbErr.message}. Returning extracted fields directly.`);
    }

    const processedDatedVouchers = parsedData.isMultiDateSheet && parsedData.datedVouchers
      ? parsedData.datedVouchers.map((dv: any) => ({
          date: dv.date,
          voucherNumber: dv.voucherNumber,
          items: matchedItems.filter((mi: any) => mi.date === dv.date),
          totalAmount: dv.totalAmount,
        }))
      : undefined;

    return {
      extractionId,
      documentType,
      fileName: this.sanitizeText(fileName),
      fileUrl,
      confidence: rawText.length > 20 ? 0.95 : 0.6,
      extractedFields: {
        ...parsedData,
        vendor: parsedData.vendorName,
        vendorInvoiceNo: parsedData.docNumber || parsedData.poNumber,
        warehouse: parsedData.warehouseName,
      },
      matchedVendor,
      matchedWarehouse,
      matchedItems,
      isMultiDateSheet: parsedData.isMultiDateSheet || false,
      datedVouchers: processedDatedVouchers,
    };
  }

  /**
   * Cleans internal PDF PostScript tokens, dictionaries, and font metric width tables
   */
  private cleanPdfRawText(text: string): string {
    if (!text) return '';
    return text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => {
        if (!line) return false;
        // Strip PostScript dictionary entries
        if (
          /^\/(?:Font|Parent|Contents|Pages|Root|Type|Viewer|ViewerPreferences|Info|Widths|Encoding|CID|Media|Filter|Length|FontDescriptor|F\d+)\b/i.test(
            line,
          )
        ) {
          return false;
        }
        // Strip PostScript structure tokens
        if (/^(?:\d+\s+\d+\s+obj|endobj|stream|endstream|xref|startxref|trailer)$/i.test(line)) {
          return false;
        }
        // Strip font metric sequences of numbers (e.g. 500 500 500 250 333 ...)
        if (/^(?:\d+\s+){2,}\d+$/.test(line)) {
          return false;
        }
        return true;
      })
      .join('\n');
  }

  /**
   * Real text extraction pipeline:
   *  - Extracts PDF streams using pdf-parse (PDFParse class)
   *  - Extracts images using tesseract.js OCR
   *  - Extracts plain text/CSV buffers
   */
  private async extractRawText(
    buffer?: Buffer,
    fileName?: string,
    mimeType?: string,
    rawTextHint?: string,
  ): Promise<string> {
    if (rawTextHint && rawTextHint.trim().length > 0) {
      return this.cleanPdfRawText(rawTextHint.trim());
    }

    if (!buffer || buffer.length === 0) {
      return '';
    }

    const nameLower = (fileName || '').toLowerCase();
    const typeLower = (mimeType || '').toLowerCase();
    const isPdf =
      nameLower.endsWith('.pdf') ||
      typeLower === 'application/pdf' ||
      buffer.subarray(0, 4).toString() === '%PDF';

    // 1. PDF Parser
    if (isPdf) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const pdfModule = require('pdf-parse');
        let text = '';
        if (pdfModule && pdfModule.PDFParse) {
          const parser = new pdfModule.PDFParse({ data: buffer });
          const res = await parser.getText();
          text = (res?.text || '').trim();
        } else if (typeof pdfModule === 'function') {
          const pdfResult = await pdfModule(buffer);
          text = (pdfResult?.text || '').trim();
        }

        if (text.length > 0) {
          return this.cleanPdfRawText(text);
        }
      } catch (err: any) {
        this.logger.warn(`pdf-parse failed on ${fileName}: ${err.message}`);
      }

      // DO NOT fallback to buffer.toString('utf-8') on binary PDF files as it dumps raw PostScript dictionaries!
      return '';
    }

    // 2. Image OCR (PNG, JPG, JPEG, WEBP, BMP, TIFF)
    if (
      nameLower.endsWith('.png') ||
      nameLower.endsWith('.jpg') ||
      nameLower.endsWith('.jpeg') ||
      nameLower.endsWith('.webp') ||
      nameLower.endsWith('.bmp') ||
      nameLower.endsWith('.tiff') ||
      typeLower.startsWith('image/')
    ) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { createWorker } = require('tesseract.js');
        const worker = await createWorker('eng');
        const ret = await worker.recognize(buffer);
        await worker.terminate();
        const text = (ret.data?.text || '').trim();
        if (text.length > 0) {
          return text;
        }
      } catch (err: any) {
        this.logger.warn(`tesseract OCR failed on ${fileName}: ${err.message}`);
      }
    }

    // 3. Plain text / CSV / JSON
    try {
      return buffer.toString('utf-8').trim();
    } catch {
      return '';
    }
  }

  /**
   * Parses extracted text into structured PO / Invoice / Receipt fields
   */
  private parseExtractedText(params: {
    rawText: string;
    documentType: string;
    fileName: string;
    vendors: Array<{ id: string; name: string; code: string }>;
    rawMaterials: Array<{ id: string; materialName: string; lastPurchaseCost?: any; standardCost?: any }>;
    packingMaterials: Array<{ id: string; materialName: string; lastPurchaseCost?: any; standardCost?: any }>;
    finishedProducts: Array<{ id: string; productName: string; defaultSellingPrice?: any }>;
  }): Record<string, any> {
    const { rawText, documentType: _documentType, fileName, vendors } = params;
    const today = new Date().toISOString().split('T')[0];

    // Helper to clean extracted product name without stripping essential formulation details
    const cleanProductName = (str: string): string => {
      if (!str) return '';
      let name = str.trim();
      // Strip leading serial numbers e.g. "1. " or "1\t" or "01 - "
      name = name.replace(/^[0-9]{1,3}[.)\-\s\t]+/, '');
      // Strip trailing gross values or total amounts (e.g. "Bifenthrin 10%EC 392,000" -> "Bifenthrin 10%EC")
      name = name.replace(/\s+[0-9]{1,3}(?:,[0-9]{3})+(?:\.[0-9]+)?$/, '');
      name = name.replace(/\s+[0-9]{4,}(?:\.[0-9]+)?$/, '');
      return name.trim();
    };

    // Helper to extract packing and infer standard UOM
    const extractPackingAndUom = (text: string): { packing: string; uom: string } => {
      const packMatch = text.match(/([0-9.]+\s*(?:ltr|kg|gm|g|ml|l|pcs|drum|can|bag|box|pack|bottle|barrel|ctn|ton))/i);
      if (packMatch && packMatch[1]) {
        const packing = packMatch[1].trim();
        const uom = /kg|gm|g/i.test(packing)
          ? 'KG'
          : /ltr|ml|l/i.test(packing)
          ? 'LTR'
          : /bag/i.test(packing)
          ? 'BAG'
          : /drum/i.test(packing)
          ? 'DRUM'
          : /can/i.test(packing)
          ? 'CAN'
          : 'PCS';
        return { packing, uom };
      }
      const uomMatch = text.match(/\b(KG|LTR|L|ML|GM|PCS|BAG|DRUM|CAN|BOX|BOTTLE|TON)\b/i);
      if (uomMatch && uomMatch[1]) {
        const uom = uomMatch[1].toUpperCase() === 'L' ? 'LTR' : uomMatch[1].toUpperCase();
        return { packing: 'Bulk', uom };
      }
      return { packing: 'Bulk', uom: 'KG' };
    };

    // Helper to normalize any arbitrary raw date format into ISO YYYY-MM-DD
    const normalizeDateString = (rawD: string): string | null => {
      if (!rawD) return null;
      const clean = rawD.trim();
      const twoDigitYr = clean.match(/^([0-9]{1,2})[-/\s]([A-Za-z]{3})[-/\s]([0-9]{2,4})$/i);
      if (twoDigitYr && twoDigitYr[1] && twoDigitYr[2] && twoDigitYr[3]) {
        const monthMap: Record<string, string> = {
          jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
          jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
        };
        const mKey = twoDigitYr[2].toLowerCase();
        const mm = monthMap[mKey] || '01';
        const dd = twoDigitYr[1].padStart(2, '0');
        let yy = twoDigitYr[3];
        if (yy.length === 2) yy = `20${yy}`;
        return `${yy}-${mm}-${dd}`;
      }
      const iso = clean.match(/^([0-9]{4})[-/.]([0-9]{1,2})[-/.]([0-9]{1,2})$/);
      if (iso && iso[1] && iso[2] && iso[3]) {
        return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`;
      }
      const dmy = clean.match(/^([0-9]{1,2})[-/.]([0-9]{1,2})[-/.]([0-9]{2,4})$/);
      if (dmy && dmy[1] && dmy[2] && dmy[3]) {
        const dd = dmy[1].padStart(2, '0');
        const mm = dmy[2].padStart(2, '0');
        let yy = dmy[3];
        if (yy.length === 2) yy = `20${yy}`;
        return `${yy}-${mm}-${dd}`;
      }
      try {
        const parsed = new Date(clean);
        if (!isNaN(parsed.getTime())) return parsed.toISOString().split('T')[0] || null;
      } catch {}
      return null;
    };

    // If raw text is too short or empty, provide a clean starter template
    if (!rawText || rawText.length < 5) {
      const cleanBaseName = fileName.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
      return {
        poNumber: `PO-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`,
        docNumber: `PO-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`,
        voucherNumber: `PO-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`,
        poDate: today,
        docDate: today,
        date: today,
        expectedDeliveryDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
        vendorName: vendors[0]?.name || 'Primary Supplier',
        warehouseName: '',
        vendorReference: cleanBaseName,
        paymentTerms: '30_DAYS_CREDIT',
        notes: `Extracted from ${fileName}. Review and adjust items as needed.`,
        extraFields: {},
        items: [
          {
            itemName: cleanBaseName || 'Raw Material Item',
            materialType: 'RAW_MATERIAL',
            packing: 'Bulk',
            uom: 'KG',
            quantity: 100,
            rate: 250,
            lineAmount: 25000,
            discount: 0,
            tax: 0,
          },
        ],
        totalAmount: 25000,
      };
    }

    // --- A. PO Number / Voucher Number / Invoice Number ---
    let docNumber = '';
    const voucherMatch = rawText.match(
      /(?:Voucher|Vchr)\s*(?:No\.?|#)?\s*[:.\s-]*([A-Za-z0-9\-_/]{2,35})/i,
    );
    const poNumMatch =
      rawText.match(/(?:P\.?O\.?|Purchase\s*Order|Order)\s*(?:Number|No\.?|#)\s*[:#\-]?\s*([A-Za-z0-9\-_/]{2,35})/i) ||
      rawText.match(/(?:PO|Order)\s*[:#\-]\s*([A-Za-z0-9\-_/]{2,35})/i) ||
      rawText.match(/(?:Invoice|Inv|Bill)\s*(?:Number|No\.?|#)\s*[:#\-]?\s*([A-Za-z0-9\-_/]{2,35})/i) ||
      rawText.match(/(?:Invoice|Inv|Bill)\s*[:#\-]\s*([A-Za-z0-9\-_/]{2,35})/i) ||
      rawText.match(/\b(PO-[A-Za-z0-9\-_/]{3,30})\b/i) ||
      rawText.match(/([A-Z]{2,4}[-_][0-9]{3,8})/i);

    if (voucherMatch && voucherMatch[1] && !/^(Warehouse|Date|Total|Party)/i.test(voucherMatch[1].trim())) {
      docNumber = voucherMatch[1].trim();
    } else if (poNumMatch && poNumMatch[1] && !/^(Warehouse|Date|Total|Party)/i.test(poNumMatch[1].trim())) {
      docNumber = poNumMatch[1].trim();
    } else {
      docNumber = '';
    }

    // --- B. Date Extraction ---
    let docDate = today;
    const dateMatch =
      rawText.match(
        /(?:Date|Dated|PO Date|Invoice Date)\s*[:#\-]?\s*([0-9]{1,2}-[A-Za-z]{3}-[0-9]{2,4}|[0-9]{1,4}[-/.][0-9]{1,2}[-/.][0-9]{2,4}|[A-Za-z]{3,9}\s+[0-9]{1,2},?\s+[0-9]{4})/i,
      ) ||
      rawText.match(/([0-9]{1,2}-[A-Za-z]{3}-[0-9]{2,4})/i) ||
      rawText.match(/([0-9]{1,2}[-/.][0-9]{1,2}[-/.][0-9]{2,4})/);

    if (dateMatch && dateMatch[1]) {
      try {
        const rawD = dateMatch[1].trim();
        const twoDigitYr = rawD.match(/^([0-9]{1,2})-([A-Za-z]{3})-([0-9]{2,4})$/i);
        if (twoDigitYr && twoDigitYr[1] && twoDigitYr[2] && twoDigitYr[3]) {
          const monthMap: Record<string, string> = {
            jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
            jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
          };
          const mKey = twoDigitYr[2].toLowerCase();
          const mm = monthMap[mKey] || '01';
          const dd = twoDigitYr[1].padStart(2, '0');
          let yy = twoDigitYr[3];
          if (yy.length === 2) yy = `20${yy}`;
          docDate = `${yy}-${mm}-${dd}`;
        } else {
          const parsedD = new Date(rawD);
          if (!isNaN(parsedD.getTime())) {
            docDate = parsedD.toISOString().split('T')[0];
          }
        }
      } catch {
        docDate = today;
      }
    }

    // --- C. Vendor Detection ---
    let matchedVendorId: string | undefined = undefined;
    let vendorName = '';

    const partyMatch = rawText.match(
      /(?:Party|Vendor|Supplier|Sold By|From|M\/s|Shipper|Seller|Company|Billing From)\s*[:#\-]?\s*([^\n\r,;]{3,60})/i,
    );
    if (partyMatch && partyMatch[1]) {
      const candidate = partyMatch[1].trim();
      if (!candidate.startsWith('/') && !/^(Address|Date|Invoice|Warehouse|Total)/i.test(candidate)) {
        vendorName = candidate;
      }
    }

    if (!vendorName) {
      for (const v of vendors) {
        if (rawText.toLowerCase().includes(v.name.toLowerCase().trim())) {
          matchedVendorId = v.id;
          vendorName = v.name;
          break;
        }
      }
    }

    // If still no vendor name, extract from top lines of document (lines 1-8)
    if (!vendorName) {
      const lines = rawText
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l.length > 2);
      for (const line of lines.slice(0, 8)) {
        if (
          !/^(Purchase Order|PO|Invoice|Tax Invoice|Gate Pass|Delivery Challan|Page|Date|Voucher|No\.|Tel|Phone|Email|Web|NTN|STRN|Terms|Bill To|Ship To|Warehouse|Serial|Sr)/i.test(
            line,
          ) &&
          !line.startsWith('/') &&
          line.length <= 60
        ) {
          vendorName = line;
          break;
        }
      }
    }

    // --- D. Warehouse Detection ---
    let warehouseName = '';
    const whMatch = rawText.match(/(?:Warehouse|WH|Location|Store|Destination)\s*[:#\-]?\s*([^\n\r,;]{3,50})/i);
    if (whMatch && whMatch[1]) {
      const candidateWh = whMatch[1].trim();
      if (!candidateWh.startsWith('/') && !/^(Incharg|Date|Invoice|Total|Party)/i.test(candidateWh)) {
        warehouseName = candidateWh;
      }
    }

    // --- E. Delivery Date ---
    let expectedDeliveryDate = docDate;
    const delMatch = rawText.match(
      /(?:Delivery\s*Date|Expected|Due\s*Date|Delivery)\s*[:#\-]?\s*([0-9]{1,4}[-/.][0-9]{1,2}[-/.][0-9]{2,4}|[A-Za-z]{3,9}\s+[0-9]{1,2},?\s+[0-9]{4})/i,
    );
    if (delMatch && delMatch[1]) {
      try {
        const pd = new Date(delMatch[1]);
        if (!isNaN(pd.getTime())) expectedDeliveryDate = pd.toISOString().split('T')[0];
      } catch {
        // keep docDate
      }
    }

    // --- F. Subtotal, Tax, Discount ---
    let subtotal = 0;
    const subMatch = rawText.match(/(?:Sub\s*Total|Gross\s*Total|G\.Value)\s*[:#\-]?\s*([0-9,]+(?:\.[0-9]+)?)/i);
    if (subMatch && subMatch[1]) {
      subtotal = parseFloat(subMatch[1].replace(/,/g, '')) || 0;
    }

    let taxPercent = 0;
    let taxAmount = 0;
    const taxMatch = rawText.match(/Sales\s*Tax\s*@\s*([0-9.]+)%\s*([0-9,]+(?:\.[0-9]+)?)/i);
    if (taxMatch && taxMatch[1] && taxMatch[2]) {
      taxPercent = parseFloat(taxMatch[1]) || 0;
      taxAmount = parseFloat(taxMatch[2].replace(/,/g, '')) || 0;
    }

    let discountAmount = 0;
    const discMatch = rawText.match(/(?:Discount|Disc)\s*[:#\-]?\s*([0-9,]+(?:\.[0-9]+)?)/i);
    if (discMatch && discMatch[1]) {
      discountAmount = parseFloat(discMatch[1].replace(/,/g, '')) || 0;
    }

    // --- G. Dynamic Extra Properties Extraction ---
    const extraFields: Record<string, string | number> = {};
    const ntnMatch = rawText.match(/NTN\s*[:#\-]?\s*([0-9\-]+)/i);
    if (ntnMatch && ntnMatch[1]) extraFields['ntn'] = ntnMatch[1].trim();

    const strnMatch = rawText.match(/STRN\s*[:#\-]?\s*([0-9\-]+)/i);
    if (strnMatch && strnMatch[1]) extraFields['strn'] = strnMatch[1].trim();

    const phoneMatch = rawText.match(/(?:Ph|Phone|Tel|Mobile|Cell)\s*[:#\-.]?\s*([0-9\-+\s]{8,20})/i);
    if (phoneMatch && phoneMatch[1]) extraFields['phone'] = phoneMatch[1].trim();

    const addrMatch = rawText.match(/(?:Address|Plot\s*#?)\s*[:#\-]?\s*([^\n\r]+)/i);
    if (addrMatch && addrMatch[1]) extraFields['address'] = addrMatch[1].trim();

    const vehMatch = rawText.match(/(?:Vehicle|Truck|Lorry)\s*(?:No\.?|#)?\s*[:#\-]?\s*([A-Za-z0-9\- ]{4,20})/i);
    if (vehMatch && vehMatch[1]) extraFields['vehicleNo'] = vehMatch[1].trim();

    const biltyMatch = rawText.match(/(?:Bilty|B\.L|Challan|GR|DC)\s*(?:No\.?|#)?\s*[:#\-]?\s*([A-Za-z0-9\- ]{3,25})/i);
    if (biltyMatch && biltyMatch[1]) extraFields['biltyNo'] = biltyMatch[1].trim();

    const termsMatch = rawText.match(/(?:Payment\s*Terms|Terms|Credit)\s*[:#\-]?\s*([^\n\r]{3,40})/i);
    if (termsMatch && termsMatch[1]) extraFields['paymentTerms'] = termsMatch[1].trim();

    // Generic key-value scanner for any arbitrary vendor properties
    const candidateLines = rawText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    for (const rawLine of candidateLines) {
      const kvMatch = rawLine.match(/^([A-Za-z][A-Za-z0-9\s/._-]{2,28})\s*[:=]\s*([^\n\r\t]{2,100})$/);
      if (kvMatch && kvMatch[1] && kvMatch[2]) {
        const rawKey = kvMatch[1].trim();
        const rawVal = kvMatch[2].trim();
        if (
          !/^(Page|Table|Header|Footer|Total|Subtotal|Tax|Rate|Qty|Product|Item|S\.?No|Invoice\s*Date|PO\s*Date|Date|Party|Vendor|Warehouse)\b/i.test(rawKey) &&
          !rawVal.startsWith('/') &&
          !/^[0-9,.]+\s*0\s*[0-9,.]+$/.test(rawVal) &&
          rawVal.length > 0
        ) {
          if (!extraFields[rawKey] && Object.keys(extraFields).length < 25) {
            extraFields[rawKey] = rawVal;
          }
        }
      }
    }

    // --- H. Universal Dynamic Line Items Extraction with Multi-Date Tracking ---
    const extractedItems: Array<{
      itemName: string;
      materialType: 'RAW_MATERIAL' | 'PACKING_MATERIAL' | 'FINISHED_PRODUCT';
      packing?: string;
      uom?: string;
      quantity: number;
      rate: number;
      lineAmount?: number;
      discount?: number;
      tax?: number;
      date?: string;
    }> = [];

    const lines = rawText.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
    let currentSectionDate = docDate;

    const isHeaderOrNoiseLine = (line: string): boolean => {
      const l = line.trim();
      if (!l || l.startsWith('/')) return true;
      if (/^--\s*\d+\s*of\s*\d+\s*--$/i.test(l)) return true;
      if (
        /^(?:Qty|Product|Packing|Rate|G\.Value|Disc|N\.Value|Sub\s*Total|Total|Sales\s*Tax|Invoice|Warehouse|Party|Address|Warehouse\s*Incharg|Shahsawar|Plot|Description|Item|S\.?No|Page)/i.test(
          l,
        )
      ) {
        return true;
      }
      return false;
    };

    for (const rawLine of lines) {
      if (isHeaderOrNoiseLine(rawLine)) continue;

      // Check for standalone date header or section date
      const dateHeaderMatch = rawLine.match(
        /(?:Date|Dated|Delivery\s*Date)\s*[:#\-]?\s*([0-9]{1,2}-[A-Za-z]{3}-[0-9]{2,4}|[0-9]{1,4}[-/.][0-9]{1,2}[-/.][0-9]{2,4})/i,
      );
      if (dateHeaderMatch && dateHeaderMatch[1]) {
        const parsedHDate = normalizeDateString(dateHeaderMatch[1]);
        if (parsedHDate) {
          currentSectionDate = parsedHDate;
          continue;
        }
      }

      let line = rawLine;
      let lineDate = currentSectionDate;

      // Check if line begins with a date (e.g. "01-10-2026\t..." or "01/10/2026 Urea...")
      const leadingDateMatch = line.match(
        /^([0-9]{1,2}-[A-Za-z]{3}-[0-9]{2,4}|[0-9]{1,4}[-/.][0-9]{1,2}[-/.][0-9]{2,4})[\s\t,;:]+(.*)$/i,
      );
      if (leadingDateMatch && leadingDateMatch[1] && leadingDateMatch[2]) {
        const parsedLineD = normalizeDateString(leadingDateMatch[1]);
        if (parsedLineD) {
          lineDate = parsedLineD;
          line = leadingDateMatch[2].trim();
        }
      }

      // Strategy 1: Tab-delimited row (standard in invoices, e.g. Shahsawar, Nuchem)
      // e.g. "2.00\tBifenthrin 10%EC 392,000\t200ltr 196,000.00 0 392,000"
      if (line.includes('\t')) {
        const parts = line.split('\t').map((p) => p.trim()).filter(Boolean);
        if (parts.length >= 2) {
          let qty = 0;
          let name = '';
          let rest = '';

          const part0 = parts[0] || '';
          const part1 = parts[1] || '';
          if (/^[0-9,.]+$/.test(part0)) {
            qty = parseFloat(part0.replace(/,/g, '')) || 1;
            name = cleanProductName(part1);
            rest = parts.slice(2).join(' ');
          } else {
            name = cleanProductName(part0);
            rest = parts.slice(1).join(' ');
            const qtyMatch = rest.match(/\b([0-9,.]+)\b/);
            if (qtyMatch && qtyMatch[1]) qty = parseFloat(qtyMatch[1].replace(/,/g, '')) || 1;
          }

          if (name && name.length >= 2) {
            const { packing, uom } = extractPackingAndUom(rest);
            const nums =
              rest
                .replace(/[0-9.]+\s*(?:ltr|kg|gm|g|ml|l|pcs|drum|can|bag|box|pack|bottle|barrel|ctn)/gi, '')
                .match(/[0-9,]+(?:\.[0-9]+)?/g) || [];
            const cleanNums = nums.map((n) => parseFloat(n.replace(/,/g, ''))).filter((n) => !isNaN(n));

            let rate = 0;
            let lineAmount = 0;
            if (cleanNums.length >= 2) {
              rate = cleanNums[0] ?? 0;
              lineAmount = cleanNums[cleanNums.length - 1] ?? 0;
            } else if (cleanNums.length === 1) {
              rate = cleanNums[0] ?? 0;
              lineAmount = qty * rate;
            }

            extractedItems.push({
              itemName: name,
              materialType: 'RAW_MATERIAL',
              packing,
              uom,
              quantity: qty,
              rate,
              lineAmount: lineAmount || qty * rate,
              discount: 0,
              tax: 0,
              date: lineDate,
            });
            continue;
          }
        }
      }

      // Strategy 2: [Qty] [Product Name] [Packing] [Rate] [Amounts...]
      const m1 = line.match(
        /^([0-9,.]+)\s+(.+?)\s+([0-9.]+\s*(?:ltr|kg|gm|g|ml|l|pcs|drum|can|bag|box|pack|bottle|barrel|ctn))\s+([0-9,.]+)(.*)$/i,
      );
      if (m1 && m1[1] && m1[2] && m1[3] && m1[4]) {
        const qty = parseFloat(m1[1].replace(/,/g, '')) || 1;
        const name = cleanProductName(m1[2]);
        const packing = m1[3].trim();
        const rate = parseFloat(m1[4].replace(/,/g, '')) || 0;
        if (name.length >= 2 && !name.startsWith('/') && !/^[0-9]+$/.test(name)) {
          const { uom } = extractPackingAndUom(packing);
          extractedItems.push({
            itemName: name,
            materialType: 'RAW_MATERIAL',
            packing,
            uom,
            quantity: qty,
            rate,
            lineAmount: qty * rate,
            discount: 0,
            tax: 0,
            date: lineDate,
          });
          continue;
        }
      }

      // Strategy 3: [Product Name] [Packing] [Qty] [Rate]
      const m2 = line.match(
        /^(.+?)\s+([0-9.]+\s*(?:ltr|kg|gm|g|ml|l|pcs|drum|can|bag|box|pack|bottle|barrel|ctn))\s+([0-9,.]+)\s+([0-9,.]+)/i,
      );
      if (m2 && m2[1] && m2[2] && m2[3] && m2[4]) {
        const name = cleanProductName(m2[1]);
        const packing = m2[2].trim();
        const qty = parseFloat(m2[3].replace(/,/g, '')) || 1;
        const rate = parseFloat(m2[4].replace(/,/g, '')) || 0;
        if (name.length >= 2 && !name.startsWith('/') && !/^[0-9]+$/.test(name)) {
          const { uom } = extractPackingAndUom(packing);
          extractedItems.push({
            itemName: name,
            materialType: 'RAW_MATERIAL',
            packing,
            uom,
            quantity: qty,
            rate,
            lineAmount: qty * rate,
            discount: 0,
            tax: 0,
            date: lineDate,
          });
          continue;
        }
      }

      // Strategy 4: Standard [Product Name] [Qty] [Unit] [Rate] [Total]
      const m3 = line.match(
        /^([A-Za-z0-9\s%()\-.,/&]{2,60}?)\s+([0-9,.]+)\s*(KG|LTR|L|ML|GM|PCS|BAG|DRUM|CAN|BOX|BOTTLE|TON)\s+(?:@\s*)?([0-9,.]+)(?:\s+([0-9,.]+))?/i,
      );
      if (m3 && m3[1] && m3[2] && m3[3] && m3[4]) {
        const name = cleanProductName(m3[1]);
        const qty = parseFloat(m3[2].replace(/,/g, '')) || 1;
        const uom = m3[3].toUpperCase() === 'L' ? 'LTR' : m3[3].toUpperCase();
        const rate = parseFloat(m3[4].replace(/,/g, '')) || 0;
        const lineAmount = m3[5] ? parseFloat(m3[5].replace(/,/g, '')) : qty * rate;
        if (name && name.length >= 2 && !name.startsWith('/') && !/^[0-9]+$/.test(name)) {
          extractedItems.push({
            itemName: name,
            materialType: 'RAW_MATERIAL',
            packing: uom === 'PCS' ? 'Pieces' : 'Bulk',
            uom,
            quantity: qty,
            rate,
            lineAmount,
            discount: 0,
            tax: 0,
            date: lineDate,
          });
          continue;
        }
      }
    }

    // Fallback: only if document has zero extractable line items
    if (extractedItems.length === 0) {
      const cleanFallback = fileName.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ') || 'Purchased Material';
      extractedItems.push({
        itemName: cleanFallback,
        materialType: 'RAW_MATERIAL',
        packing: 'Bulk',
        uom: 'KG',
        quantity: 1,
        rate: 0,
        lineAmount: 0,
        discount: 0,
        tax: 0,
        date: docDate,
      });
    }

    // --- I. Total Amount ---
    let totalAmount = extractedItems.reduce((acc, it) => acc + (it.lineAmount || it.quantity * it.rate), 0);
    const totMatch = rawText.match(
      /(?:Total|Grand\s*Total|Net\s*Amount|Total\s*Amount|Net\s*Value|N\.Value|Payable)\s*[:#\-]?\s*([0-9,]+(?:\.[0-9]{2})?)/i,
    );
    if (totMatch && totMatch[1]) {
      const parsedTot = parseFloat(totMatch[1].replace(/,/g, ''));
      if (parsedTot > 0) totalAmount = parsedTot;
    }

    // Distinct dates & multi-date voucher segmentation
    const distinctDates = Array.from(new Set(extractedItems.map((it) => it.date).filter(Boolean))) as string[];
    const isMultiDateSheet = distinctDates.length > 1;

    let datedVouchers: Array<{
      date: string;
      voucherNumber?: string;
      items: any[];
      totalAmount: number;
    }> = [];

    if (isMultiDateSheet) {
      datedVouchers = distinctDates.map((dStr, idx) => {
        const vItems = extractedItems.filter((it) => it.date === dStr);
        const vTotal = vItems.reduce((acc, it) => acc + (it.lineAmount || it.quantity * it.rate), 0);
        return {
          date: dStr,
          voucherNumber: docNumber ? `${docNumber}-${idx + 1}` : undefined,
          items: vItems,
          totalAmount: vTotal,
        };
      });
    }

    return {
      poNumber: docNumber,
      docNumber,
      voucherNumber: docNumber,
      poDate: docDate,
      docDate,
      date: docDate,
      expectedDeliveryDate,
      vendorName,
      vendor: vendorName,
      matchedVendorId,
      warehouseName,
      warehouse: warehouseName,
      vendorReference: `REF-${docNumber}`,
      paymentTerms: extraFields['paymentTerms'] || '30_DAYS_CREDIT',
      subtotal: subtotal || totalAmount,
      taxPercent,
      taxAmount,
      discountAmount,
      totalAmount,
      extraFields,
      notes: `Extracted directly from uploaded document: ${fileName}`,
      items: extractedItems,
      isMultiDateSheet,
      datedVouchers,
    };
  }

  /**
   * Strips null bytes (\0) and unprintable ASCII control characters that PostgreSQL rejects
   */
  private sanitizeText(str?: string): string {
    if (!str) return '';
    return str.replace(/\0/g, '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
  }

  /**
   * Recursively sanitizes any JSON object/array so all strings are safe for PostgreSQL JSONB
   */
  private sanitizeJson(val: any): any {
    if (typeof val === 'string') {
      return this.sanitizeText(val);
    }
    if (Array.isArray(val)) {
      return val.map((v) => this.sanitizeJson(v));
    }
    if (val !== null && typeof val === 'object') {
      const result: Record<string, any> = {};
      for (const [k, v] of Object.entries(val)) {
        result[this.sanitizeText(k)] = this.sanitizeJson(v);
      }
      return result;
    }
    return val;
  }
}
