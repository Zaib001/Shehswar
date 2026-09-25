/**
 * SHEHSWAR ONE360 - Audit Logging Contracts
 */
import { Action, Resource } from './enums.js';

export interface AuditLogEntry {
  id: string;
  actorId: string;
  actorEmail?: string;
  organizationId: string;
  companyId?: string;
  resource: Resource | string;
  resourceId: string;
  action: Action | string;
  previousState?: Record<string, unknown> | null;
  newState?: Record<string, unknown> | null;
  changedFields?: string[];
  correlationId: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

export interface CreateAuditLogInput {
  actorId: string;
  actorEmail?: string;
  organizationId: string;
  companyId?: string;
  resource: Resource | string;
  resourceId: string;
  action: Action | string;
  previousState?: Record<string, unknown> | null;
  newState?: Record<string, unknown> | null;
  correlationId: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
}
