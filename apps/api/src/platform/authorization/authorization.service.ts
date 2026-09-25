/**
 * SHEHSWAR ONE360 - Centralized Authorization Service
 *
 * Implements the core enterprise access control engine:
 *   can(user, action, resource, context)
 *
 * Validates RBAC permissions, sensitive action constraints, and multi-company
 * contextual boundary isolation (e.g. preventing child company from seeing parent costing).
 */
import { Injectable, Logger } from '@nestjs/common';
import { Action, Resource, AuthUser, SecurityContext, CanOptions } from '@shehswar/types';

@Injectable()
export class AuthorizationService {
  private readonly logger = new Logger(AuthorizationService.name);

  /**
   * Main authorization decision point
   */
  can(options: CanOptions): boolean {
    const { user, action, resource, context, targetRecord } = options;

    // 1. Super Admin has unrestricted system-wide access
    if (user.isSuperAdmin) {
      return true;
    }

    // 2. Organization Boundary Check (Hard Tenant Isolation)
    if (context?.organizationId && context.organizationId !== user.organizationId) {
      this.logger.warn(
        `AuthZ Denied: Org mismatch. User: ${user.organizationId}, Context: ${context.organizationId}`,
      );
      return false;
    }

    // 3. Permission String Verification ("resource:action" or "resource:*")
    const specificPerm = `${resource}:${action}`;
    const wildcardPerm = `${resource}:*`;
    const hasPermission =
      user.permissions.includes(specificPerm) || user.permissions.includes(wildcardPerm);

    if (!hasPermission) {
      return false;
    }

    // 4. Sensitive Permission Constraints (Parent vs Child Isolation)
    const isSensitiveCostingAction =
      action === Action.VIEW_COST ||
      action === Action.VIEW_MARGIN ||
      action === Action.EDIT_FORMULA ||
      action === Action.APPROVE_FORMULA;

    if (isSensitiveCostingAction) {
      // Must have the explicit permission grant (already checked above)
      // AND must not belong to an unauthorized child company context without elevated privileges
      if (context?.companyId && context.companyId !== user.companyId) {
        return false;
      }
    }

    // 5. Contextual Company Boundary Check
    if (context?.companyId && context.companyId !== user.companyId) {
      const hasCrossCompanyAccess = user.permissions.includes('company:cross_company_view');
      if (!hasCrossCompanyAccess) {
        return false;
      }
    }

    // 6. Record-level attribute evaluation (ABAC / Ownership)
    if (targetRecord) {
      // If record belongs to a specific company, verify alignment
      if (targetRecord['companyId'] && targetRecord['companyId'] !== user.companyId) {
        const canViewOtherCompany = user.permissions.includes('company:cross_company_view');
        if (!canViewOtherCompany) {
          return false;
        }
      }

      // If record is locked/approved, forbid edits unless user has explicit override permission
      if (targetRecord['status'] === 'APPROVED' && action === Action.EDIT) {
        return user.permissions.includes(Action.REOPEN_APPROVED);
      }
    }

    return true;
  }

  /**
   * Shorthand check helper
   */
  check(user: AuthUser, action: Action, resource: Resource, context?: SecurityContext): boolean {
    return this.can({ user, action, resource, context });
  }
}
