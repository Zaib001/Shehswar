/**
 * SHEHSWAR ONE360 - Current Context Decorator
 */
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { SecurityContext } from '@shehswar/types';

export const CurrentContext = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): SecurityContext => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;
    const headers = request.headers;

    // Read activeCompanyId set by DataScopeGuard or header
    const requestedCompanyId =
      request.activeCompanyId || (headers['x-company-id'] as string | undefined);

    const isParent = Boolean(
      user?.isSuperAdmin ||
      user?.company?.isParent ||
      user?.company?.code === 'COMP-SHEHSWAR'
    );

    let effectiveCompanyId = user?.companyId;
    if (requestedCompanyId && requestedCompanyId !== 'ALL' && requestedCompanyId !== 'all') {
      effectiveCompanyId = requestedCompanyId;
    } else if (requestedCompanyId === 'ALL' || requestedCompanyId === 'all') {
      // ONLY parent company users or superadmin can run un-scoped queries across all companies
      effectiveCompanyId = isParent ? undefined : user?.companyId;
    }

    return {
      organizationId: headers['x-organization-id'] || user?.organizationId,
      companyId: effectiveCompanyId,
      plantId: headers['x-plant-id'] || user?.context?.plantId,
      branchId: headers['x-branch-id'] || user?.context?.branchId,
      departmentId: headers['x-department-id'] || user?.context?.departmentId,
      warehouseId: headers['x-warehouse-id'] || user?.context?.warehouseId,
      regionId: headers['x-region-id'] || user?.context?.regionId,
      zoneId: headers['x-zone-id'] || user?.context?.zoneId,
      territoryId: headers['x-territory-id'] || user?.context?.territoryId,
    };
  },
);
