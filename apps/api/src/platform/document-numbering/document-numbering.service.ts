/**
 * SHEHSWAR ONE360 - Concurrency-Safe Document Numbering Service
 *
 * Generates sequential human-readable document identifiers:
 * Example: SH-PO-2026-000123
 * Guarantees zero sequence collision under concurrent multi-user load.
 */
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';

@Injectable()
export class DocumentNumberingService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generates next sequential document number atomically
   */
  async getNextDocumentNumber(params: {
    organizationId: string;
    companyId: string;
    documentType: string; // e.g. PO, SO, GRN, BATCH, INVOICE
    fiscalYear?: number;
    prefixOverride?: string;
  }): Promise<string> {
    const fiscalYear = params.fiscalYear ?? new Date().getFullYear();
    const defaultPrefix = `SH-${params.documentType}-${fiscalYear}`;
    const prefix = params.prefixOverride ?? defaultPrefix;

    // Concurrency-safe atomic increment via upsert
    const sequence = await this.prisma.documentSequence.upsert({
      where: {
        companyId_documentType_fiscalYear: {
          companyId: params.companyId,
          documentType: params.documentType,
          fiscalYear,
        },
      },
      update: {
        currentNumber: {
          increment: 1,
        },
      },
      create: {
        organizationId: params.organizationId,
        companyId: params.companyId,
        documentType: params.documentType,
        fiscalYear,
        prefix,
        currentNumber: BigInt(1),
      },
    });

    const paddedNumber = sequence.currentNumber.toString().padStart(6, '0');
    return `${sequence.prefix}-${paddedNumber}`;
  }
}
