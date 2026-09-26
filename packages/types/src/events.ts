/**
 * SHEHSWAR ONE360 - Domain Events & Outbox Contracts
 */

export interface DomainEvent<T = Record<string, unknown>> {
  id: string; // Event UUID
  name: string; // e.g. "purchase_order.approved"
  timestamp: string; // ISO 8601 UTC
  correlationId: string;
  organizationId: string;
  companyId?: string;
  actorId?: string;
  payload: T;
  version: number;
}

export interface OutboxRecord {
  id: string;
  eventName: string;
  eventVersion: number;
  aggregateType: string;
  aggregateId: string;
  payload: Record<string, unknown>;
  correlationId: string;
  organizationId: string;
  companyId?: string;
  actorId?: string;
  status: 'PENDING' | 'PROCESSING' | 'PUBLISHED' | 'FAILED';
  retryCount: number;
  nextRetryAt?: Date | null;
  lockedAt?: Date | null;
  lockedBy?: string | null;
  lastError?: string;
  createdAt: Date;
  processedAt?: Date;
}
