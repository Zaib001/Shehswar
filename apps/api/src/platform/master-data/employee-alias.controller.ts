/**
 * SHEHSWAR ONE360 - Employee Alias Controller
 * Route: /api/v1/employees (alias to /api/v1/master-data/employees)
 */
import {
  Controller,
  Get,
  Param,
  Query,
} from '@nestjs/common';
import { MasterDataService } from './master-data.service';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { CurrentContext } from '../../core/decorators/current-context.decorator';
import { AuthUser, SecurityContext } from '@shehswar/types';

@Controller('api/v1/employees')
export class EmployeeAliasController {
  constructor(private readonly masterDataService: MasterDataService) {}

  @Get()
  async getEmployees(
    @Query('companyId') companyId?: string,
    @Query('organizationId') organizationId?: string,
    @Query('all') all?: string,
    @CurrentContext() ctx?: SecurityContext,
    @CurrentUser() user?: AuthUser,
  ) {
    const shouldShowAll = all === 'true' || companyId === 'ALL';
    const filterCompany = shouldShowAll
      ? undefined
      : (companyId || ctx?.companyId || user?.companyId);

    const employees = await this.masterDataService.findEmployees(
      filterCompany,
      organizationId || ctx?.organizationId,
    );

    if (employees.length === 0 && (!companyId || companyId === 'ALL') && filterCompany) {
      return this.masterDataService.findEmployees(
        undefined,
        organizationId || ctx?.organizationId,
      );
    }

    return employees;
  }

  @Get(':id')
  async getEmployee(@Param('id') id: string) {
    return this.masterDataService.findOneEmployee(id);
  }
}

