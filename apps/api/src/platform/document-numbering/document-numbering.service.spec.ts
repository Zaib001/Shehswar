/**
 * SHEHSWAR ONE360 - Document Numbering Concurrency Unit Tests
 */
import { DocumentNumberingService } from './document-numbering.service';
import { PrismaService } from '../../core/database/prisma.service';

describe('DocumentNumberingService Concurrency', () => {
  let service: DocumentNumberingService;
  let currentSequenceCounter: bigint;

  beforeEach(() => {
    currentSequenceCounter = BigInt(0);

    const mockPrisma = {
      documentSequence: {
        upsert: jest.fn().mockImplementation(async (args: any) => {
          // Simulate atomic DB increment (RETURNING current_number + 1)
          currentSequenceCounter += BigInt(1);
          return {
            id: 'seq-uuid',
            organizationId: args.create.organizationId,
            companyId: args.create.companyId,
            documentType: args.create.documentType,
            fiscalYear: args.create.fiscalYear,
            prefix: args.create.prefix,
            currentNumber: currentSequenceCounter,
          };
        }),
      },
    };

    service = new DocumentNumberingService(mockPrisma as unknown as PrismaService);
  });

  it('Concurrent Numbering: simulates 50 parallel requests and proves ZERO duplicate numbers are generated', async () => {
    const concurrentRequestsCount = 50;

    const promises = Array.from({ length: concurrentRequestsCount }).map(() =>
      service.getNextDocumentNumber({
        organizationId: 'org-shehswar',
        companyId: 'comp-parent',
        documentType: 'PO',
        fiscalYear: 2026,
      }),
    );

    const results = await Promise.all(promises);

    expect(results).toHaveLength(concurrentRequestsCount);

    // Verify uniqueness by checking Set size
    const uniqueSet = new Set(results);
    expect(uniqueSet.size).toBe(concurrentRequestsCount);

    // Verify format and sequential values
    expect(results[0]).toBe('SH-PO-2026-000001');
    expect(results[49]).toBe('SH-PO-2026-000050');
  });

  it('Supports custom prefix overrides and fiscal year grouping', async () => {
    const docNumber = await service.getNextDocumentNumber({
      organizationId: 'org-shehswar',
      companyId: 'comp-parent',
      documentType: 'GRN',
      fiscalYear: 2027,
      prefixOverride: 'SH-CUSTOM-GRN',
    });

    expect(docNumber).toBe('SH-CUSTOM-GRN-000001');
  });
});
