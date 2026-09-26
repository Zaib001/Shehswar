/**
 * SHEHSWAR ONE360 - Persistent Idempotency Contracts
 */

export type IdempotencyStatus = 'PENDING' | 'COMPLETED' | 'FAILED';

export interface IdempotencyRecordDto {
  id: string;
  key: string;
  organizationId: string;
  userId?: string;
  endpoint: string;
  requestHash: string;
  status: IdempotencyStatus;
  responseStatus?: number;
  responseBody?: unknown;
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date;
}

export interface IdempotencyCheckResult {
  state: 'NEW' | 'REPLAY' | 'CONFLICT_PAYLOAD_MISMATCH' | 'IN_FLIGHT';
  record?: IdempotencyRecordDto;
}
