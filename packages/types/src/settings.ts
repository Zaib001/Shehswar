/**
 * SHEHSWAR ONE360 - Configuration & Settings Types
 */
import { ConfigurationScope } from './enums.js';

export interface ConfigHierarchyLookup {
  organizationId: string;
  companyId?: string;
  branchId?: string;
  userId?: string;
}

export interface ResolvedSetting<T = unknown> {
  key: string;
  value: T;
  resolvedScope: ConfigurationScope;
  isOverridden: boolean;
}
