/**
 * SHEHSWAR ONE360 - Data Scope & Company Isolation Guard
 *
 * Enforces company boundary isolation to guarantee data cannot leak
 * between parent and child companies or between separate sister companies.
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

    if (user.isSuperAdmin) {
      return true;
    }

    // Inspect request parameters, query, and body for company target
    const targetCompanyId =
      request.params?.companyId ||
      request.query?.companyId ||
      request.body?.companyId ||
      request.headers['x-company-id'];

    if (targetCompanyId && targetCompanyId !== user.companyId) {
      // Check if user has cross-company view permission
      const hasCrossCompanyAccess = user.permissions.includes('company:cross_company_view');
      if (!hasCrossCompanyAccess) {
        throw new ForbiddenException(
          `Data isolation violation: user belongs to company '${user.companyId}' and cannot access '${targetCompanyId}'.`,
        );
      }
    }

    return true;
  }
}
