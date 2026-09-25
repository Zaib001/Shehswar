/**
 * SHEHSWAR ONE360 - Security & Identity Types
 */
import { Action, Resource } from './enums.js';

export interface SecurityContext {
  organizationId?: string;
  companyId?: string;
  plantId?: string;
  branchId?: string;
  departmentId?: string;
  warehouseId?: string;
  regionId?: string;
  zoneId?: string;
  territoryId?: string;
}

export interface PermissionDefinition {
  id: string;
  resource: Resource;
  action: Action;
  description?: string;
  isSensitive: boolean;
}

export interface UserRoleAssignment {
  roleId: string;
  roleName: string;
  companyId?: string;
  plantId?: string;
  branchId?: string;
}

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
  isSuperAdmin: boolean;
  organizationId: string;
  companyId: string;
  roles: string[];
  permissions: string[]; // Formatted as "resource:action" e.g., "sales_order:create"
  context: SecurityContext;
}

export interface JwtPayload {
  sub: string; // User ID
  email: string;
  organizationId: string;
  companyId: string;
  sessionId: string;
  roles: string[];
  permissions: string[];
  iat?: number;
  exp?: number;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: 'Bearer';
}

export interface SessionInfo {
  id: string;
  userId: string;
  userAgent?: string;
  ipAddress?: string;
  lastActiveAt: Date;
  expiresAt: Date;
  isRevoked: boolean;
}

export interface CanOptions {
  user: AuthUser;
  action: Action;
  resource: Resource;
  context?: SecurityContext;
  targetRecord?: Record<string, unknown>;
}
