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

  /**
   * Lists all configured document sequences for a company or organization
   */
  async listSequences(companyId?: string, organizationId?: string) {
    const where: any = {};
    if (companyId) where.companyId = companyId;
    if (organizationId) where.organizationId = organizationId;

    const sequences = await this.prisma.documentSequence.findMany({
      where,
      include: {
        company: {
          select: { id: true, code: true, name: true },
        },
      },
      orderBy: [{ documentType: 'asc' }, { fiscalYear: 'desc' }],
    });

    return sequences.map((seq) => ({
      id: seq.id,
      organizationId: seq.organizationId,
      companyId: seq.companyId,
      company: seq.company,
      documentType: seq.documentType,
      prefix: seq.prefix,
      fiscalYear: seq.fiscalYear,
      currentNumber: seq.currentNumber.toString(),
      nextFormattedNumber: `${seq.prefix}-${(Number(seq.currentNumber) + 1).toString().padStart(6, '0')}`,
      updatedAt: seq.updatedAt,
    }));
  }

  /**
   * Configures or resets a sequence rule for a document type
   */
  async configureSequence(params: {
    organizationId: string;
    companyId: string;
    documentType: string;
    prefix: string;
    startingNumber?: number;
    fiscalYear?: number;
  }) {
    const fiscalYear = params.fiscalYear ?? new Date().getFullYear();
    const startingNum = BigInt(params.startingNumber ?? 0);

    const sequence = await this.prisma.documentSequence.upsert({
      where: {
        companyId_documentType_fiscalYear: {
          companyId: params.companyId,
          documentType: params.documentType,
          fiscalYear,
        },
      },
      update: {
        prefix: params.prefix,
        ...(params.startingNumber !== undefined ? { currentNumber: startingNum } : {}),
      },
      create: {
        organizationId: params.organizationId,
        companyId: params.companyId,
        documentType: params.documentType,
        fiscalYear,
        prefix: params.prefix,
        currentNumber: startingNum,
      },
    });

    return {
      ...sequence,
      currentNumber: sequence.currentNumber.toString(),
    };
  }

  /**
   * Previews the formatted output string for a numbering rule
   */
  previewNextNumber(params: {
    prefix: string;
    startingNumber?: number;
    fiscalYear?: number;
  }): string {
    const num = (params.startingNumber ?? 1).toString().padStart(6, '0');
    return `${params.prefix}-${num}`;
  }
}

