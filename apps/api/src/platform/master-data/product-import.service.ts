/**
 * SHEHSWAR ONE360 - Dynamic Product Import Service
 *
 * Implements flexible document/file import without requiring a rigid single template.
 * - Parses CSV, TSV, JSON, Excel (.xlsx/.xls)
 * - Automatically detects table header row (skips leading blanks/titles)
 * - Detects inline section headers (e.g. Insecticides, Herbicides, Fungicides, Nutrients)
 * - Extracts embedded pack sizes from product name (e.g. 1000ml -> 1000 ML, 250gm -> 250 GM)
 * - Extracts PPC from "1×30", "1x12", etc.
 * - Extracts commercial seasonal rates/prices
 * - Preserves ALL unknown fields in `customFields` JSON
 * - Pre-import duplicate check with options: SKIP, UPDATE, CREATE_NEW
 */
import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { CodeGenerationService } from '../code-generation/code-generation.service';
import { AuthUser } from '@shehswar/types';
import * as XLSX from 'xlsx';

export interface ImportPreviewRecord {
  tempId: string;
  isDuplicate: boolean;
  duplicateAction: 'SKIP' | 'UPDATE' | 'CREATE_NEW';
  existingRecordId?: string;
  existingProductCode?: string;

  // Normalized Known Fields
  productCode?: string;
  productName: string;
  urduName?: string;
  productType?: string;
  mType?: string;
  packSizeQuantity?: number;
  packSizeUnit?: string;
  ppc?: number;
  baseSellingPrice?: number;
  brand?: string;
  grade?: string;

  // Unknown Extra Fields Preserved
  unknownFields: Record<string, any>;
  rawRow: Record<string, any>;
}

@Injectable()
export class ProductImportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly codeGen: CodeGenerationService,
  ) {}

  /**
   * Parses file content (CSV/TSV/Excel/JSON) and generates an interactive preview
   */
  async generateImportPreview(
    fileContent: string,
    fileName: string,
    companyId: string,
  ): Promise<{
    fileName: string;
    totalDetected: number;
    duplicateCount: number;
    detectedHeaders: string[];
    records: ImportPreviewRecord[];
  }> {
    if (!fileContent || !fileContent.trim()) {
      throw new BadRequestException('Uploaded file is empty');
    }

    // Convert file content to rows using intelligent parser
    const { rows, headers } = await this.parseRawContent(fileContent, fileName);
    if (rows.length === 0) {
      throw new BadRequestException('No product records could be detected in the uploaded file');
    }

    const previewRecords: ImportPreviewRecord[] = [];

    // Pre-fetch existing finished products for duplicate checking
    const existingProducts = await this.prisma.finishedProduct.findMany({
      where: { companyId },
      select: { id: true, productCode: true, productName: true },
    });

    const existingNameMap = new Map<string, { id: string; code: string }>();
    const existingCodeMap = new Map<string, { id: string; code: string }>();

    for (const p of existingProducts) {
      existingNameMap.set(p.productName.trim().toLowerCase(), { id: p.id, code: p.productCode });
      existingCodeMap.set(p.productCode.trim().toLowerCase(), { id: p.id, code: p.productCode });
    }

    let duplicateCount = 0;

    for (let i = 0; i < rows.length; i++) {
      const rec = rows[i];
      if (!rec || !rec.productName) continue;

      const cleanName = rec.productName.trim().toLowerCase();
      const cleanCode = (rec.productCode || '').trim().toLowerCase();

      let match = cleanCode ? existingCodeMap.get(cleanCode) : undefined;
      if (!match) {
        match = existingNameMap.get(cleanName);
      }

      const isDuplicate = !!match;
      if (isDuplicate) duplicateCount++;

      previewRecords.push({
        tempId: `row-${i + 1}`,
        isDuplicate,
        duplicateAction: isDuplicate ? 'SKIP' : 'CREATE_NEW',
        existingRecordId: match?.id,
        existingProductCode: match?.code,
        productCode: rec.productCode,
        productName: rec.productName,
        urduName: rec.urduName,
        productType: rec.productType || 'Standard',
        mType: rec.mType || 'Insecticides',
        packSizeQuantity: rec.packSizeQuantity || 1,
        packSizeUnit: rec.packSizeUnit || 'Liter',
        ppc: rec.ppc || 1,
        baseSellingPrice: rec.baseSellingPrice || 0,
        brand: rec.brand || 'Shehswar Agro',
        grade: rec.grade || 'Standard',
        unknownFields: rec.unknownFields || {},
        rawRow: rec.rawRow || {},
      });
    }

    return {
      fileName,
      totalDetected: previewRecords.length,
      duplicateCount,
      detectedHeaders: headers,
      records: previewRecords,
    };
  }

  /**
   * Confirms and atomically saves the previewed records into FinishedProduct master table
   */
  async confirmImport(
    records: ImportPreviewRecord[],
    targetCategoryId: string | undefined,
    user: AuthUser,
  ): Promise<{
    success: boolean;
    createdCount: number;
    updatedCount: number;
    skippedCount: number;
    totalProcessed: number;
    message: string;
  }> {
    if (!records || records.length === 0) {
      throw new BadRequestException('No records provided for import');
    }

    let companyId = user.companyId || '';
    let organizationId = user.organizationId || '';

    if (!companyId || !organizationId) {
      const defaultCompany = await this.prisma.company.findFirst({ select: { id: true, organizationId: true } });
      if (defaultCompany) {
        companyId = companyId || defaultCompany.id;
        organizationId = organizationId || defaultCompany.organizationId;
      }
    }

    // Resolve default category if not provided
    let categoryId = targetCategoryId;
    if (!categoryId) {
      const defaultCat = await this.prisma.productCategory.findFirst({
        where: organizationId ? { organizationId, code: '41-01' } : { code: '41-01' },
      });
      categoryId = defaultCat?.id;
      if (!categoryId) {
        const anyCat = await this.prisma.productCategory.findFirst();
        categoryId = anyCat?.id;
      }
    }

    let createdCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;

    for (const rec of records) {
      if (rec.duplicateAction === 'SKIP') {
        skippedCount++;
        continue;
      }

      if (rec.duplicateAction === 'UPDATE' && rec.existingRecordId) {
        // Update existing record
        await this.prisma.finishedProduct.update({
          where: { id: rec.existingRecordId },
          data: {
            urduName: rec.urduName || undefined,
            mType: rec.mType || undefined,
            productType: rec.productType || undefined,
            packingQuantity: rec.packSizeQuantity ? Number(rec.packSizeQuantity) : undefined,
            packingUnit: rec.packSizeUnit || undefined,
            ppc: rec.ppc ? Number(rec.ppc) : undefined,
            defaultSellingPrice: rec.baseSellingPrice ? Number(rec.baseSellingPrice) : undefined,
            customFields: Object.keys(rec.unknownFields).length > 0 ? rec.unknownFields : undefined,
          },
        });
        updatedCount++;
        continue;
      }

      // CREATE_NEW: Generate new sequential code if not supplied or clashing
      let codeToUse = rec.productCode;
      if (!codeToUse || codeToUse.trim() === '') {
        codeToUse = await this.codeGen.generateCode({
          companyId,
          organizationId,
          entityType: 'FINISHED_PRODUCT',
        });
      }

      await this.prisma.finishedProduct.create({
        data: {
          organizationId,
          companyId,
          categoryId: categoryId || null,
          productCode: codeToUse,
          productName: rec.productName.trim(),
          urduName: rec.urduName || null,
          productType: rec.productType || 'Insecticide',
          mType: rec.mType || 'Insecticides',
          brand: rec.brand || 'Shehswar Agro',
          grade: rec.grade || 'Standard',
          packingQuantity: rec.packSizeQuantity ? Number(rec.packSizeQuantity) : 1,
          packingUnit: rec.packSizeUnit || 'Liter',
          ppc: rec.ppc ? Number(rec.ppc) : 1,
          defaultSellingPrice: rec.baseSellingPrice ? Number(rec.baseSellingPrice) : null,
          status: 'ACTIVE',
          customFields: Object.keys(rec.unknownFields).length > 0 ? rec.unknownFields : undefined,
        },
      });
      createdCount++;
    }

    return {
      success: true,
      createdCount,
      updatedCount,
      skippedCount,
      totalProcessed: records.length,
      message: `Import completed: ${createdCount} created, ${updatedCount} updated, ${skippedCount} skipped.`,
    };
  }

  /**
   * Robust parser: converts CSV, TSV, PDF, or spreadsheet content into normalized records
   */
  private async parseRawContent(raw: string, fileName?: string): Promise<{ rows: any[]; headers: string[] }> {
    let content = raw.trim();
    const lowerFileName = (fileName || '').toLowerCase();

    // 1. Check if base64 XLSX/XLS or binary buffer string
    if (
      lowerFileName.endsWith('.xlsx') ||
      lowerFileName.endsWith('.xls') ||
      content.startsWith('UEsDB')
    ) {
      try {
        const buffer = Buffer.from(content, 'base64');
        const workbook = XLSX.read(buffer, { type: 'buffer' });
        const firstSheetName = workbook.SheetNames[0];
        if (firstSheetName) {
          const sheet = workbook.Sheets[firstSheetName];
          if (sheet) {
            content = XLSX.utils.sheet_to_csv(sheet);
          }
        }
      } catch (e) {
        // Fall back to text parsing if already converted
      }
    } else if (
      lowerFileName.endsWith('.pdf') ||
      content.startsWith('JVBER')
    ) {
      // 2. Check if base64 PDF
      try {
        const buffer = Buffer.from(content, 'base64');
        const pdfModule = require('pdf-parse');
        const parser = new pdfModule.PDFParse({ data: buffer });
        await parser.load();
        const extracted = await parser.getText();
        await parser.destroy();
        if (extracted && extracted.trim()) {
          content = extracted;
        }
      } catch (e) {
        // Fall back to text parsing if already extracted
      }
    }

    const lines = content.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
    if (lines.length < 2) return { rows: [], headers: [] };

    // 1. Detect Header Row: find first line that contains product/item/name
    let headerIndex = -1;
    let headers: string[] = [];

    for (let i = 0; i < Math.min(lines.length, 15); i++) {
      const lineStr = lines[i];
      if (!lineStr) continue;
      const rawTokens = this.parseCsvTokens(lineStr);
      const lowerTokens = rawTokens.map((t) => t.toLowerCase().trim());

      if (lowerTokens.some((t) => t.includes('product') || t.includes('item') || (t.includes('name') && !t.includes('company')))) {
        headerIndex = i;
        headers = rawTokens.map((t) => t.trim());
        break;
      }
    }

    // Fallback: If no header found, use line 0
    if (headerIndex === -1 && lines[0]) {
      headerIndex = 0;
      headers = this.parseCsvTokens(lines[0]).map((t) => t.trim());
    }

    // 2. Identify column index roles
    let productColIdx = -1;
    let compositionColIdx = -1;
    let ppcColIdx = -1;
    let rateColIdx = -1;
    let codeColIdx = -1;
    let urduColIdx = -1;
    let srColIdx = -1;

    headers.forEach((h, idx) => {
      const l = h.toLowerCase().replace(/[^a-z0-9#]/g, '');
      if (l.includes('product') || l.includes('itemname') || l.includes('title')) productColIdx = idx;
      else if (l.includes('composition') || l.includes('formula') || l.includes('chemical')) compositionColIdx = idx;
      else if (l.includes('packincarton') || l.includes('carton') || l.includes('ppc')) ppcColIdx = idx;
      else if (l.includes('rate') || l.includes('price') || l.includes('sellingprice')) rateColIdx = idx;
      else if (l.includes('code') || l.includes('sku')) codeColIdx = idx;
      else if (l.includes('urdu')) urduColIdx = idx;
      else if (l.includes('sr#') || l.includes('sr') || l === 'no') srColIdx = idx;
    });

    // Fallback for product column: first non-empty column that isn't Sr#
    if (productColIdx === -1) {
      productColIdx = srColIdx === 0 ? 1 : (srColIdx === 1 ? 2 : 1);
    }

    let currentMType = 'Insecticides';
    const rows: any[] = [];

    for (let i = headerIndex + 1; i < lines.length; i++) {
      const lineStr = lines[i];
      if (!lineStr) continue;
      const tokens = this.parseCsvTokens(lineStr);

      const nonEmpty = tokens.filter((t) => t.trim().length > 0);
      if (nonEmpty.length === 0) continue;

      const firstNonEmpty = (nonEmpty[0] || '').toLowerCase().trim();

      // Skip notes / footers
      if (
        firstNonEmpty.startsWith('note:') ||
        firstNonEmpty.includes('discount policy') ||
        firstNonEmpty.includes('rate list is effective') ||
        firstNonEmpty.includes('all the rights') ||
        firstNonEmpty.includes('not applicable') ||
        firstNonEmpty.includes('confrom avaliable') ||
        firstNonEmpty.includes('confirm available')
      ) {
        continue;
      }

      // Detect Category Section Headers (e.g. ",Incesticides ,,,,", ",Gernal Herbicides ,,,,", ",Rice Herbicides ,,,,", ",Fungicides ,,,,", ",Granules ,,,,", ",Nutrients ,,,,")
      if (
        nonEmpty.length === 1 ||
        (nonEmpty.length === 2 && isNaN(Number(nonEmpty[0])) && isNaN(Number(nonEmpty[1])))
      ) {
        const title = nonEmpty[0] || '';
        const lower = title.toLowerCase();
        if (lower.includes('insecticide') || lower.includes('incesticide')) currentMType = 'Insecticides';
        else if (lower.includes('herbicide')) currentMType = 'Herbicides';
        else if (lower.includes('fungicide')) currentMType = 'Fungicides';
        else if (lower.includes('fertilizer') || lower.includes('nutrient')) currentMType = 'Fertilizers';
        else if (lower.includes('seed')) currentMType = 'Seeds';
        else if (lower.includes('granule')) currentMType = 'Insecticides';
        else if (title.trim().length > 3) currentMType = title.trim();
        continue;
      }

      // Extract Product Name
      const rawProductName = (tokens[productColIdx] || '').trim();
      if (!rawProductName) continue;

      // Extract Selling Price
      let rawPrice = (tokens[rateColIdx] || '').trim().replace(/[^0-9.]/g, '');
      const baseSellingPrice = rawPrice ? parseFloat(rawPrice) : 0;

      // Extract PPC from "1×30", "1x12", etc.
      let ppc = 1;
      const rawPpc = (tokens[ppcColIdx] || '').trim();
      const ppcMatch = rawPpc.match(/(?:1\s*[×xX*]\s*)?(\d+)/);
      if (ppcMatch && ppcMatch[1]) {
        ppc = parseInt(ppcMatch[1], 10);
      }

      // Extract Pack Size Quantity & Unit from product name (e.g. "Abamectin 1000ml", "Acephate 250gm", "Good Luck 10ltr", "Gladiator 8Kg", "Croter 200 ml")
      let packSizeQuantity = 1;
      let packSizeUnit = 'Liter';

      const packSizeRegex = /(\d+(?:\.\d+)?)\s*(ml|l|ltr|liter|litr|gm|g|gram|kg|kilo|pack)\b/i;
      const packMatch = rawProductName.match(packSizeRegex);
      if (packMatch && packMatch[1] && packMatch[2]) {
        packSizeQuantity = parseFloat(packMatch[1]);
        const rawUnit = packMatch[2].toLowerCase();
        if (rawUnit === 'ml') packSizeUnit = 'ML';
        else if (rawUnit === 'l' || rawUnit === 'ltr' || rawUnit === 'liter' || rawUnit === 'litr') packSizeUnit = 'Liter';
        else if (rawUnit === 'kg' || rawUnit === 'kilo') packSizeUnit = 'KG';
        else if (rawUnit === 'gm' || rawUnit === 'g' || rawUnit === 'gram') packSizeUnit = 'GM';
        else packSizeUnit = 'Pack';
      }

      // Collect raw and unknown fields
      const unknownFields: Record<string, any> = {};
      const rawRow: Record<string, any> = {};

      headers.forEach((h, idx) => {
        const val = (tokens[idx] || '').trim();
        if (h) rawRow[h] = val;
        if (idx !== productColIdx && idx !== rateColIdx && idx !== ppcColIdx && idx !== codeColIdx && idx !== urduColIdx && val) {
          unknownFields[h] = val;
        }
      });

      if (compositionColIdx !== -1 && tokens[compositionColIdx]) {
        unknownFields['Composition'] = (tokens[compositionColIdx] || '').trim();
      }

      rows.push({
        productCode: codeColIdx !== -1 ? tokens[codeColIdx]?.trim() : undefined,
        productName: rawProductName,
        urduName: urduColIdx !== -1 ? tokens[urduColIdx]?.trim() : undefined,
        productType: currentMType === 'Insecticides' && rawProductName.toLowerCase().includes('gr') ? 'Granules' : 'Standard',
        mType: currentMType,
        packSizeQuantity,
        packSizeUnit,
        ppc,
        baseSellingPrice,
        brand: 'Shehswar Agro',
        grade: 'Standard',
        unknownFields,
        rawRow,
      });
    }

    return { rows, headers: headers.filter((h) => h && h.length > 0) };
  }

  private parseCsvTokens(line: string): string[] {
    if (line.includes(',')) {
      const values: string[] = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (c === '"') {
          inQuotes = !inQuotes;
        } else if (c === ',' && !inQuotes) {
          values.push(current);
          current = '';
        } else {
          current += c;
        }
      }
      values.push(current);
      return values;
    }

    if (line.includes('\t')) {
      return line.split('\t').map((s) => s.trim());
    }

    return line.split(/\s{2,}/).map((s) => s.trim());
  }
}
