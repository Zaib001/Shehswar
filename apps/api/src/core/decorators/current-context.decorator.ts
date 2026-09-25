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

    return {
      organizationId: headers['x-organization-id'] || user?.organizationId,
      companyId: headers['x-company-id'] || user?.companyId,
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
