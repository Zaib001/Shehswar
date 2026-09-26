/**
 * SHEHSWAR ONE360 - Outbox Relay Worker & Idempotent Consumer Unit Tests
 */
import { OutboxRelayService } from './outbox-relay.service';
import { EventBusService } from './event-bus.service';
import { IdempotentConsumerService } from './idempotent-consumer';
import { PrismaService } from '../../core/database/prisma.service';
import { DomainEvent } from '@shehswar/types';

describe('OutboxRelayService & IdempotentConsumer', () => {
  let relayService: OutboxRelayService;
  let consumerService: IdempotentConsumerService;
  let mockPrisma: any;
  let mockEventBus: any;

  beforeEach(() => {
    mockPrisma = {
      domainEventOutbox: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        updateMany: jest.fn(),
        update: jest.fn(),
      },
    };

    mockEventBus = {
      publish: jest.fn(),
    };

    relayService = new OutboxRelayService(
      mockPrisma as unknown as PrismaService,
      mockEventBus as unknown as EventBusService,
    );

    consumerService = new IdempotentConsumerService();
  });

  describe('OutboxRelay Worker Claiming & Publishing', () => {
    it('should safely claim pending events without concurrent worker collision', async () => {
      mockPrisma.domainEventOutbox.findMany
        .mockResolvedValueOnce([{ id: 'evt-1' }, { id: 'evt-2' }]) // eligible
        .mockResolvedValueOnce([{ id: 'evt-1' }, { id: 'evt-2' }]); // claimed by this worker

      mockPrisma.domainEventOutbox.updateMany.mockResolvedValue({ count: 2 });

      const claimed = await relayService.claimPendingEvents('worker-pod-1', 10);

      expect(claimed).toEqual(['evt-1', 'evt-2']);
      expect(mockPrisma.domainEventOutbox.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'PROCESSING',
            lockedBy: 'worker-pod-1',
          }),
        }),
      );
    });

    it('should successfully publish claimed event and mark status PUBLISHED', async () => {
      mockPrisma.domainEventOutbox.findUnique.mockResolvedValue({
        id: 'evt-1',
        eventName: 'sales_order.created',
        eventVersion: 1,
        correlationId: 'corr-101',
        organizationId: 'org-shehswar',
        companyId: 'comp-parent',
        actorId: 'usr-1',
        payload: { orderNumber: 'SO-2026-001' },
        status: 'PROCESSING',
        retryCount: 0,
        createdAt: new Date(),
      });

      mockPrisma.domainEventOutbox.update.mockResolvedValue({});

      const success = await relayService.processEvent('evt-1');

      expect(success).toBe(true);
      expect(mockEventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'evt-1',
          name: 'sales_order.created',
          version: 1,
        }),
      );
      expect(mockPrisma.domainEventOutbox.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'evt-1' },
          data: expect.objectContaining({
            status: 'PUBLISHED',
          }),
        }),
      );
    });

    it('should schedule retry with exponential backoff upon transient failure', async () => {
      mockPrisma.domainEventOutbox.findUnique.mockResolvedValue({
        id: 'evt-2',
        eventName: 'invoice.posted',
        eventVersion: 1,
        correlationId: 'corr-102',
        organizationId: 'org-shehswar',
        payload: {},
        status: 'PROCESSING',
        retryCount: 1, // attempt 1 failed
        createdAt: new Date(),
      });

      // Simulate failure in subscriber/network
      mockEventBus.publish.mockImplementation(() => {
        throw new Error('Connection refused to notification service');
      });

      mockPrisma.domainEventOutbox.update.mockResolvedValue({});

      const success = await relayService.processEvent('evt-2');

      expect(success).toBe(false);
      expect(mockPrisma.domainEventOutbox.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'evt-2' },
          data: expect.objectContaining({
            status: 'PENDING',
            retryCount: 2,
            nextRetryAt: expect.any(Date),
            lastError: 'Connection refused to notification service',
          }),
        }),
      );
    });

    it('should move event to DEAD-LETTER (FAILED) status when max retries exceeded', async () => {
      mockPrisma.domainEventOutbox.findUnique.mockResolvedValue({
        id: 'evt-3',
        eventName: 'payment.failed',
        eventVersion: 1,
        correlationId: 'corr-103',
        organizationId: 'org-shehswar',
        payload: {},
        status: 'PROCESSING',
        retryCount: 4, // 5th attempt will exceed MAX_RETRIES (5)
        createdAt: new Date(),
      });

      mockEventBus.publish.mockImplementation(() => {
        throw new Error('Fatal schema mismatch');
      });

      mockPrisma.domainEventOutbox.update.mockResolvedValue({});

      const success = await relayService.processEvent('evt-3');

      expect(success).toBe(false);
      expect(mockPrisma.domainEventOutbox.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'evt-3' },
          data: expect.objectContaining({
            status: 'FAILED',
            retryCount: 5,
            lastError: expect.stringContaining('DEAD_LETTER: Max retries exceeded'),
          }),
        }),
      );
    });
  });

  describe('Duplicate-Event Protection & Idempotent Consumer', () => {
    it('Demonstrates duplicate event delivery does not duplicate business effects', async () => {
      let stockReservationCalls = 0;
      const businessEffect = async (_evt: DomainEvent) => {
        stockReservationCalls++;
      };

      const event: DomainEvent = {
        id: 'evt-unique-999',
        name: 'purchase_order.approved',
        timestamp: new Date().toISOString(),
        correlationId: 'corr-dup-test',
        organizationId: 'org-shehswar',
        payload: { itemId: 'RM-CORN-01', reservedQty: 100 },
        version: 1,
      };

      // 1. First event delivery
      const firstResult = await consumerService.consume(event, businessEffect);
      expect(firstResult.executed).toBe(true);
      expect(firstResult.duplicate).toBe(false);
      expect(stockReservationCalls).toBe(1);

      // 2. Duplicate event delivery (same event ID delivered by At-Least-Once relay)
      const duplicateResult = await consumerService.consume(event, businessEffect);
      expect(duplicateResult.executed).toBe(false);
      expect(duplicateResult.duplicate).toBe(true);
      // Crucial verification: business logic was NOT called a second time!
      expect(stockReservationCalls).toBe(1);

      // 3. Third duplicate delivery
      const thirdResult = await consumerService.consume(event, businessEffect);
      expect(thirdResult.executed).toBe(false);
      expect(thirdResult.duplicate).toBe(true);
      expect(stockReservationCalls).toBe(1);
    });
  });
});
