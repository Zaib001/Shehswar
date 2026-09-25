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
  aggregateType: string;
  aggregateId: string;
  payload: Record<string, unknown>;
  correlationId: string;
  organizationId: string;
  companyId?: string;
  actorId?: string;
  status: 'PENDING' | 'PUBLISHED' | 'FAILED';
  retryCount: number;
  lastError?: string;
  createdAt: Date;
  processedAt?: Date;
}
