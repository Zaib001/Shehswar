/**
 * SHEHSWAR ONE360 - Approval Engine Contracts
 */
import { ApprovalStatus } from './enums.js';

export interface ApprovalRuleCondition {
  field: string;
  operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in';
  value: unknown;
}

export interface ApprovalLevel {
  levelNumber: number;
  requiredRole?: string;
  requiredUserId?: string;
  minimumAmount?: number;
  condition?: ApprovalRuleCondition;
}

export interface ApprovalActionPayload {
  requestId: string;
  actorId: string;
  status: ApprovalStatus;
  comments?: string;
}
