/**
 * SHEHSWAR ONE360 - Data Scope & Company Isolation Guard
 *
 * Enforces company boundary isolation to guarantee data cannot leak
 * between parent and child companies or between separate sister companies.
 *
 * Centralized Authenticator / Guard:
 * 1. Validates that requested active company belongs to user's authorized companies.
 * 2. Scopes request user.companyId to activeCompanyId so all downstream queries
 *    automatically run within the active company context.
 * 3. Exempts explicitly authorized cross-company flows (such as Inter Company Transfer).
 */
import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { AuthUser } from '@shehswar/types';

@Injectable()
export class DataScopeGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthUser | undefined;

    if (!user) {
      return true; // Let authentication guard handle missing user
    }

    const path: string = request.path || request.url || '';

    // Allow explicitly authorized cross-company endpoints
    const isCrossCompanyRoute =
      path.includes('/operations/intercompany') ||
      path.includes('/auth') ||
      path === '/api/v1/master-data/companies' ||
      path.startsWith('/api/v1/master-data/companies');

    // Inspect request headers, query, params, and body for company target
    const targetCompanyId =
      (request.headers['x-company-id'] as string) ||
      request.params?.companyId ||
      request.query?.companyId ||
      request.body?.companyId;

    let activeCompanyId = user.companyId;

    if (targetCompanyId && targetCompanyId !== 'ALL' && targetCompanyId !== 'all') {
      const isSuperAdmin = user.isSuperAdmin === true;
      const hasCrossCompanyAccess = user.permissions?.includes('company:cross_company_view');

      // If user is not superadmin and does not have cross-company permission:
      if (!isSuperAdmin && !hasCrossCompanyAccess && !isCrossCompanyRoute) {
        if (targetCompanyId !== user.companyId) {
          throw new ForbiddenException(
            `Data isolation violation: user belongs to company '${user.companyId}' and cannot access '${targetCompanyId}'.`,
          );
        }
      }

      activeCompanyId = targetCompanyId;
    }

    // Attach validated active company context to the request object
    request.activeCompanyId = activeCompanyId;
    if (activeCompanyId && activeCompanyId !== 'ALL' && activeCompanyId !== 'all') {
      // Set request-scoped companyId so downstream services using user.companyId
      // automatically operate on the active company context!
      user.companyId = activeCompanyId;
    }

    return true;
  }
}
