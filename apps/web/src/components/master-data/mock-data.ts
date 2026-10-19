/**
 * SHEHSWAR ONE360 - Phase 3 Enterprise Master Data Foundation Types
 * All data is loaded directly from PostgreSQL via backend REST APIs.
 */
import {
  OrganizationDto,
  CompanyDto,
  PlantDto,
  BranchDto,
  DepartmentDto,
  WarehouseDto,
  EmployeeDto,
  RoleDto,
  DocumentSequenceDto,
} from '@shehswar/types';

export const INITIAL_ORGANIZATIONS: OrganizationDto[] = [];
export const INITIAL_COMPANIES: CompanyDto[] = [];
export const INITIAL_PLANTS: PlantDto[] = [];
export const INITIAL_BRANCHES: BranchDto[] = [];
export const INITIAL_DEPARTMENTS: DepartmentDto[] = [];
export const INITIAL_WAREHOUSES: WarehouseDto[] = [];
export const INITIAL_EMPLOYEES: EmployeeDto[] = [];
export const INITIAL_ROLES: RoleDto[] = [];

export const MODULE_ACTIONS = [
  'View',
  'Create',
  'Edit',
  'Delete',
  'Submit',
  'Approve',
  'Reject',
  'Export',
] as const;

export const ERP_MODULES = [
  { id: 'organization', label: 'Organization & Structure' },
  { id: 'users', label: 'User Administration & RBAC' },
  { id: 'procurement', label: 'Procurement & Purchase Orders' },
  { id: 'inventory', label: 'Inventory & Warehousing' },
  { id: 'production', label: 'Chemical Production & Batches' },
  { id: 'qc', label: 'Quality Control & COA' },
  { id: 'sales', label: 'Commercial Sales & Dealers' },
  { id: 'finance', label: 'General Ledger & Treasury' },
];

export const INITIAL_DOCUMENT_SEQUENCES: DocumentSequenceDto[] = [];

export interface AuditLogItem {
  id: string;
  actorName: string;
  actorEmail: string;
  action: string;
  resource: string;
  resourceName?: string;
  summary: string;
  fromState?: string;
  toState?: string;
  timestamp: string;
  ipAddress?: string;
}

export const INITIAL_AUDIT_LOGS: AuditLogItem[] = [];

import type { ApprovalRuleItem } from './ApprovalRulesView';
import type { NotificationItem } from './NotificationCenterView';

export const INITIAL_APPROVAL_RULES: ApprovalRuleItem[] = [];
export const INITIAL_NOTIFICATIONS: NotificationItem[] = [];
