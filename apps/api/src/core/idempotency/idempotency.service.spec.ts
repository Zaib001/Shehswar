/**
 * SHEHSWAR ONE360 - Idempotency Service Unit Tests
 */
import { ConflictException } from '@nestjs/common';
import { IdempotencyService } from './idempotency.service';
import { PrismaService } from '../database/prisma.service';

describe('IdempotencyService', () => {
  let service: IdempotencyService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      idempotencyRecord: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };
    service = new IdempotencyService(mockPrisma as unknown as PrismaService);
  });

  const baseParams = {
    key: 'idem-grn-001',
    organizationId: 'org-shehswar',
    userId: 'user-wh-1',
    endpoint: '/api/v1/inventory/grn',
    payload: { poNumber: 'PO-2026-001', receivedQty: 50 },
  };

  it('First Request: claims key in PENDING status and returns state NEW', async () => {
    mockPrisma.idempotencyRecord.findUnique.mockResolvedValue(null);
    mockPrisma.idempotencyRecord.create.mockResolvedValue({});

    const result = await service.checkOrLock(baseParams);

    expect(result.state).toBe('NEW');
    expect(mockPrisma.idempotencyRecord.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          key: baseParams.key,
          organizationId: baseParams.organizationId,
          status: 'PENDING',
        }),
      }),
    );
  });

  it('Same Key + Same Payload: returns state REPLAY with stored result without re-executing', async () => {
    const requestHash = service.hashPayload(baseParams.payload);
    mockPrisma.idempotencyRecord.findUnique.mockResolvedValue({
      id: 'rec-1',
      key: baseParams.key,
      organizationId: baseParams.organizationId,
      endpoint: baseParams.endpoint,
      requestHash,
      status: 'COMPLETED',
      responseStatus: 201,
      responseBody: { grnId: 'GRN-2026-001', status: 'RECEIVED' },
      createdAt: new Date(),
      updatedAt: new Date(),
      expiresAt: new Date(Date.now() + 86400 * 1000), // future
    });

    const result = await service.checkOrLock(baseParams);

    expect(result.state).toBe('REPLAY');
    expect(result.record?.responseStatus).toBe(201);
    expect(result.record?.responseBody).toEqual({ grnId: 'GRN-2026-001', status: 'RECEIVED' });
    expect(mockPrisma.idempotencyRecord.create).not.toHaveBeenCalled();
  });

  it('Same Key + Different Payload: throws 409 Conflict with IDEMPOTENCY_PAYLOAD_MISMATCH', async () => {
    const originalHash = service.hashPayload({ poNumber: 'PO-2026-001', receivedQty: 50 });
    mockPrisma.idempotencyRecord.findUnique.mockResolvedValue({
      id: 'rec-1',
      key: baseParams.key,
      organizationId: baseParams.organizationId,
      endpoint: baseParams.endpoint,
      requestHash: originalHash,
      status: 'COMPLETED',
      responseStatus: 201,
      responseBody: {},
      createdAt: new Date(),
      updatedAt: new Date(),
      expiresAt: new Date(Date.now() + 86400 * 1000),
    });

    // Submitting with different quantity (tampered / duplicated key)
    const modifiedParams = {
      ...baseParams,
      payload: { poNumber: 'PO-2026-001', receivedQty: 100 }, // DIFFERENT
    };

    await expect(service.checkOrLock(modifiedParams)).rejects.toThrow(ConflictException);

    try {
      await service.checkOrLock(modifiedParams);
    } catch (err: any) {
      expect(err.getResponse().code).toBe('IDEMPOTENCY_PAYLOAD_MISMATCH');
    }
  });

  it('Same Key While Original Request Is Processing: throws 409 Conflict with IDEMPOTENCY_IN_PROGRESS', async () => {
    const requestHash = service.hashPayload(baseParams.payload);
    mockPrisma.idempotencyRecord.findUnique.mockResolvedValue({
      id: 'rec-1',
      key: baseParams.key,
      organizationId: baseParams.organizationId,
      endpoint: baseParams.endpoint,
      requestHash,
      status: 'PENDING', // IN PROGRESS
      createdAt: new Date(),
      updatedAt: new Date(),
      expiresAt: new Date(Date.now() + 86400 * 1000),
    });

    await expect(service.checkOrLock(baseParams)).rejects.toThrow(ConflictException);

    try {
      await service.checkOrLock(baseParams);
    } catch (err: any) {
      expect(err.getResponse().code).toBe('IDEMPOTENCY_IN_PROGRESS');
    }
  });

  it('Expired Key: refreshes record and returns state NEW', async () => {
    const requestHash = service.hashPayload(baseParams.payload);
    mockPrisma.idempotencyRecord.findUnique.mockResolvedValue({
      id: 'rec-old',
      key: baseParams.key,
      organizationId: baseParams.organizationId,
      endpoint: baseParams.endpoint,
      requestHash,
      status: 'COMPLETED',
      createdAt: new Date(Date.now() - 90000 * 1000),
      updatedAt: new Date(Date.now() - 90000 * 1000),
      expiresAt: new Date(Date.now() - 3600 * 1000), // EXPIRED 1 hour ago
    });
    mockPrisma.idempotencyRecord.update.mockResolvedValue({});

    const result = await service.checkOrLock(baseParams);

    expect(result.state).toBe('NEW');
    expect(mockPrisma.idempotencyRecord.update).toHaveBeenCalled();
  });
});
