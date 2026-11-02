/**
 * SHEHSWAR ONE360 - Dynamic Product Import Service
 *
 * Implements flexible document/file import without requiring a fixed rigid template.
 * - Parses CSV, TSV, JSON, or tabular/structured text
 * - Automatically detects headers & records
 * - Normalizes known fields (Name, Code, Type, MType, Pack Size, Unit, Price)
 * - Preserves ALL unknown fields in `customFields` JSON
 * - Pre-import duplicate check with options: SKIP, UPDATE, CREATE_NEW
 */
import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { CodeGenerationService } from '../code-generation/code-generation.service';
import { AuthUser } from '@shehswar/types';

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
   * Parses file content (CSV/TSV/JSON or delimited text) and generates an interactive preview
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

    const rows = this.parseRawContent(fileContent);
    if (rows.length === 0 || !rows[0]) {
      throw new BadRequestException('No product rows could be detected in the uploaded file');
    }

    const detectedHeaders = Object.keys(rows[0] || {});
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
      const row = rows[i];
      if (!row) continue;
      const normalized = this.normalizeRow(row);

      if (!normalized.productName) {
        continue; // Skip blank or header rows without a name
      }

      // Check duplicates by code or name
      const cleanName = normalized.productName.trim().toLowerCase();
      const cleanCode = (normalized.productCode || '').trim().toLowerCase();

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
        productCode: normalized.productCode,
        productName: normalized.productName,
        urduName: normalized.urduName,
        productType: normalized.productType,
        mType: normalized.mType,
        packSizeQuantity: normalized.packSizeQuantity,
        packSizeUnit: normalized.packSizeUnit,
        ppc: normalized.ppc,
        baseSellingPrice: normalized.baseSellingPrice,
        brand: normalized.brand,
        grade: normalized.grade,
        unknownFields: normalized.unknownFields,
        rawRow: row,
      });
    }

    return {
      fileName,
      totalDetected: previewRecords.length,
      duplicateCount,
      detectedHeaders,
      records: previewRecords,
    };
  }

  /**
   * Confirms import of reviewed records
   */
  async confirmImport(
    records: ImportPreviewRecord[],
    categoryId: string,
    user: AuthUser,
  ) {
    const companyId = user.companyId;
    const organizationId = user.organizationId;

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
   * Heuristic Parser: detects CSV, TSV, or JSON lines without rigid fixed structure
   */
  private parseRawContent(raw: string): Record<string, string>[] {
    const trimmed = raw.trim();

    // Check if JSON array
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) return parsed;
      } catch (e) {
        // Fall back to line-based parsing
      }
    }

    const lines = trimmed.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length < 2 || !lines[0]) return [];

    // Detect delimiter: comma, tab, semicolon, pipe
    const firstLine = lines[0];
    let delimiter = ',';
    if (firstLine.includes('\t')) delimiter = '\t';
    else if (firstLine.includes(';') && !firstLine.includes(',')) delimiter = ';';
    else if (firstLine.includes('|')) delimiter = '|';

    const headers = this.parseCsvLine(firstLine, delimiter).map((h) =>
      h.trim().replace(/^["']|["']$/g, ''),
    );

    const rows: Record<string, string>[] = [];
    for (let i = 1; i < lines.length; i++) {
      const lineStr = lines[i];
      if (!lineStr) continue;
      const values = this.parseCsvLine(lineStr, delimiter);
      if (values.length === 0) continue;
      const row: Record<string, string> = {};
      for (let j = 0; j < headers.length; j++) {
        const header = headers[j] || `Col_${j + 1}`;
        row[header] = (values[j] || '').trim().replace(/^["']|["']$/g, '');
      }
      rows.push(row);
    }

    return rows;
  }

  private parseCsvLine(line: string, delimiter: string): string[] {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"' || char === "'") {
        inQuotes = !inQuotes;
      } else if (char === delimiter && !inQuotes) {
        values.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current);
    return values;
  }

  /**
   * Intelligently maps fuzzy header names to standard fields, preserving unknown fields
   */
  private normalizeRow(row: Record<string, any>) {
    const unknownFields: Record<string, any> = {};

    let productCode: string | undefined;
    let productName: string | undefined;
    let urduName: string | undefined;
    let productType: string | undefined;
    let mType: string | undefined;
    let packSizeQuantity: number | undefined;
    let packSizeUnit: string | undefined;
    let ppc: number | undefined;
    let baseSellingPrice: number | undefined;
    let brand: string | undefined;
    let grade: string | undefined;

    for (const [key, value] of Object.entries(row)) {
      const cleanKey = key.trim().toLowerCase().replace(/[^a-z0-9]/g, '');

      if (['productcode', 'code', 'itemcode', 'skucode', 'sku'].includes(cleanKey)) {
        productCode = String(value).trim();
      } else if (['productname', 'itemname', 'name', 'title', 'account', 'product'].includes(cleanKey)) {
        productName = String(value).trim();
      } else if (['urduname', 'urdu', 'localname', 'urduaccount'].includes(cleanKey)) {
        urduName = String(value).trim();
      } else if (['producttype', 'type', 'itemtype'].includes(cleanKey)) {
        productType = String(value).trim();
      } else if (['mtype', 'classification', 'categorygroup', 'group'].includes(cleanKey)) {
        mType = String(value).trim();
      } else if (['packsize', 'packing', 'size', 'packquantity', 'packsizequantity', 'qty'].includes(cleanKey)) {
        const num = parseFloat(String(value).replace(/[^0-9.]/g, ''));
        if (!isNaN(num)) packSizeQuantity = num;
      } else if (['unit', 'packingunit', 'uom', 'packunit', 'baseunit'].includes(cleanKey)) {
        packSizeUnit = String(value).trim();
      } else if (['ppc', 'packpercarton', 'bottlespercarton', 'cartonqty'].includes(cleanKey)) {
        const num = parseInt(String(value).replace(/[^0-9]/g, ''), 10);
        if (!isNaN(num)) ppc = num;
      } else if (['price', 'sellingprice', 'basesellingprice', 'rate', 'defaultprice'].includes(cleanKey)) {
        const num = parseFloat(String(value).replace(/[^0-9.]/g, ''));
        if (!isNaN(num)) baseSellingPrice = num;
      } else if (['brand', 'companyname'].includes(cleanKey)) {
        brand = String(value).trim();
      } else if (['grade', 'quality'].includes(cleanKey)) {
        grade = String(value).trim();
      } else {
        // Unknown field — DO NOT DISCARD! Preserve in flexible customFields!
        unknownFields[key] = value;
      }
    }

    return {
      productCode,
      productName: productName || '',
      urduName,
      productType,
      mType,
      packSizeQuantity,
      packSizeUnit,
      ppc,
      baseSellingPrice,
      brand,
      grade,
      unknownFields,
    };
  }
}
