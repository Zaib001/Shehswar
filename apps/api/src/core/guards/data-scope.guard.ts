/**
 * SHEHSWAR ONE360 - Data Scope & Company Isolation Guard
 *
 * Enforces company boundary isolation & hierarchical data governance:
 * 1. PARENT COMPANY ACCESS:
 *    - Users belonging to the Parent Company (Shehswar / isParent: true / COMP-SHEHSWAR) or Superadmins
 *      have full authorized visibility and access to Parent company data AND ALL Child company data.
 *    - Parent company users can dynamically switch active company context to any child company to view/operate.
 * 2. CHILD COMPANY ISOLATION:
 *    - Users belonging to a Child Company CAN NEVER access Parent company data.
 *    - If a child company user attempts to set targetCompanyId to the Parent company, a 403 Forbidden is thrown.
 *    - Child company users cannot execute un-scoped 'ALL' queries across parent records.
 *    - Child company users are strictly confined to their own assigned company records.
 */
import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { AuthUser } from '@shehswar/types';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class DataScopeGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthUser | undefined;

    if (!user) {
      return true; // Let authentication guard handle missing user
    }

    const path: string = request.path || request.url || '';

    // Allow explicitly authorized cross-company endpoints (e.g. transfer execution/receiving)
    const isCrossCompanyRoute =
      path.includes('/operations/intercompany/transfer') ||
      path.includes('/auth');

    // Determine whether user belongs to Parent Company
    let isParentCompanyUser = Boolean(
      user.isSuperAdmin === true ||
      user.company?.isParent === true ||
      user.company?.code === 'COMP-SHEHSWAR'
    );

    if (!isParentCompanyUser && user.companyId) {
      const dbCompany = await this.prisma.company.findUnique({
        where: { id: user.companyId },
        select: { id: true, code: true, isParent: true, companyType: true },
      });
      if (
        dbCompany?.isParent === true ||
        dbCompany?.code === 'COMP-SHEHSWAR' ||
        dbCompany?.companyType === 'PARENT_MANUFACTURING'
      ) {
        isParentCompanyUser = true;
      }
    }

    // Inspect request headers, query, params, and body for target company
    const rawTargetCompanyId =
      (request.headers['x-company-id'] as string) ||
      request.params?.companyId ||
      request.query?.companyId ||
      request.body?.companyId;

    let activeCompanyId = user.companyId;

    if (rawTargetCompanyId) {
      const isAll = rawTargetCompanyId === 'ALL' || rawTargetCompanyId === 'all';

      if (isParentCompanyUser) {
        // Parent company user can access Parent Company AND all Child companies
        activeCompanyId = rawTargetCompanyId;
      } else {
        // CHILD COMPANY USER:
        if (isAll) {
          // Child company user cannot perform un-scoped queries across parent data
          activeCompanyId = user.companyId;
          if (request.headers['x-company-id']) {
            request.headers['x-company-id'] = user.companyId;
          }
        } else if (rawTargetCompanyId !== user.companyId) {
          // Verify if requested target is the Parent Company
          const targetComp = await this.prisma.company.findUnique({
            where: { id: rawTargetCompanyId },
            select: { id: true, code: true, name: true, isParent: true, companyType: true },
          });

          const isTargetParent = Boolean(
            targetComp?.isParent === true ||
            targetComp?.code === 'COMP-SHEHSWAR' ||
            targetComp?.companyType === 'PARENT_MANUFACTURING'
          );

          if (isTargetParent) {
            throw new ForbiddenException(
              `Data isolation violation: Child company users are strictly forbidden from accessing Parent company data (${targetComp?.name || rawTargetCompanyId}).`,
            );
          }

          // Also block accessing other child companies unless explicitly on a permitted cross-company transfer route
          if (!isCrossCompanyRoute) {
            throw new ForbiddenException(
              `Data isolation violation: Child company users cannot access another company's records. User belongs to '${user.companyId}' and attempted to access '${rawTargetCompanyId}'.`,
            );
          }

          activeCompanyId = rawTargetCompanyId;
        }
      }
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
