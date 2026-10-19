/**
 * SHEHSWAR ONE360 - Master Data Controller
 */
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  BadRequestException,
} from '@nestjs/common';
import { MasterDataService } from './master-data.service';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { CurrentContext } from '../../core/decorators/current-context.decorator';
import { AuthUser, SecurityContext } from '@shehswar/types';
import {
  CreateOrganizationDto,
  UpdateOrganizationDto,
  CreateCompanyDto,
  UpdateCompanyDto,
  CreatePlantDto,
  UpdatePlantDto,
  CreateBranchDto,
  UpdateBranchDto,
  CreateDepartmentDto,
  UpdateDepartmentDto,
  CreateWarehouseDto,
  UpdateWarehouseDto,
  CreateUserDto,
  UpdateUserDto,
  CreateRoleDto,
  UpdateRoleDto,
  CreateEmployeeDto,
  UpdateEmployeeDto,
  CreateRegionDto,
  UpdateRegionDto,
  CreateZoneDto,
  UpdateZoneDto,
  CreateTerritoryDto,
  UpdateTerritoryDto,
  CreateMarketAssignmentDto,
  UpdateMarketAssignmentDto,
} from './dto';

@Controller('api/v1/master-data')
export class MasterDataController {
  constructor(private readonly masterDataService: MasterDataService) {}

  // 1. ORGANIZATIONS
  @Get('organizations')
  async getOrganizations(
    @Query('search') search?: string,
    @Query('isActive') isActive?: string,
  ) {
    const active = isActive !== undefined ? isActive === 'true' : undefined;
    return this.masterDataService.findAllOrganizations({ search, isActive: active });
  }

  @Get('organizations/:id')
  async getOrganization(@Param('id') id: string) {
    return this.masterDataService.findOneOrganization(id);
  }

  @Post('organizations')
  async createOrganization(
    @Body() dto: CreateOrganizationDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.masterDataService.createOrganization(dto, {
      id: user?.id || 'system',
      email: user?.email,
    });
  }

  @Patch('organizations/:id')
  async updateOrganization(
    @Param('id') id: string,
    @Body() dto: UpdateOrganizationDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.masterDataService.updateOrganization(id, dto, {
      id: user?.id || 'system',
      email: user?.email,
    });
  }

  // 2. COMPANIES
  @Get('companies')
  async getCompanies(
    @CurrentContext() ctx: SecurityContext,
    @CurrentUser() user: AuthUser,
    @Query('organizationId') orgId?: string,
    @Query('search') search?: string,
    @Query('isActive') isActive?: string,
    @Query('all') all?: string,
    @Query('companyId') qCompanyId?: string,
  ) {
    const organizationId = orgId || ctx.organizationId || '';
    const active = isActive !== undefined ? isActive === 'true' : undefined;
    const companyIdFilter = user?.isSuperAdmin
      ? (all === 'true' ? undefined : (qCompanyId || ctx.companyId || undefined))
      : user?.companyId;

    return this.masterDataService.findCompanies(organizationId, {
      search,
      isActive: active,
      companyId: companyIdFilter,
    });
  }

  @Get('companies/hierarchy')
  async getCompanyHierarchy(
    @CurrentContext() ctx: SecurityContext,
    @Query('organizationId') orgId?: string,
  ) {
    const organizationId = orgId || ctx.organizationId || '';
    return this.masterDataService.findCompanyHierarchy(organizationId);
  }

  @Get('companies/:id/children')
  async getCompanyChildren(@Param('id') id: string) {
    return this.masterDataService.findCompanyChildren(id);
  }

  @Get('companies/:id/parent')
  async getCompanyParent(@Param('id') id: string) {
    return this.masterDataService.findCompanyParent(id);
  }

  @Get('companies/:id')
  async getCompany(@Param('id') id: string) {
    return this.masterDataService.findOneCompany(id);
  }

  @Post('companies')
  async createCompany(
    @Body() dto: CreateCompanyDto,
    @CurrentUser() user: AuthUser,
    @CurrentContext() ctx: SecurityContext,
  ) {
    const orgId = dto.organizationId || ctx?.organizationId || user?.organizationId;
    if (!orgId) {
      throw new BadRequestException('Organization context could not be determined');
    }
    const finalDto = {
      ...dto,
      organizationId: orgId,
    };
    return this.masterDataService.createCompany(finalDto as any, {
      id: user?.id || 'system',
      email: user?.email,
    });
  }

  @Patch('companies/:id')
  async updateCompany(
    @Param('id') id: string,
    @Body() dto: UpdateCompanyDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.masterDataService.updateCompany(id, dto, {
      id: user?.id || 'system',
      email: user?.email,
    });
  }

  // 3. PLANTS
  @Get('plants')
  async getPlants(
    @Query('companyId') companyId?: string,
    @Query('organizationId') organizationId?: string,
    @Query('all') all?: string,
    @CurrentContext() ctx?: SecurityContext,
    @CurrentUser() user?: AuthUser,
  ) {
    const isSuperAdmin = user?.isSuperAdmin === true;
    const filterCompany = isSuperAdmin
      ? (all === 'true' || companyId === 'ALL' ? undefined : (companyId || ctx?.companyId))
      : (user?.companyId || ctx?.companyId);
    return this.masterDataService.findPlants(
      filterCompany,
      organizationId || ctx?.organizationId,
    );
  }

  @Get('plants/:id')
  async getPlant(@Param('id') id: string) {
    return this.masterDataService.findOnePlant(id);
  }

  @Post('plants')
  async createPlant(
    @Body() dto: CreatePlantDto,
    @CurrentUser() user: AuthUser,
    @CurrentContext() ctx: SecurityContext,
  ) {
    const finalDto = {
      ...dto,
      companyId: dto.companyId || ctx.companyId || user.companyId,
    };
    return this.masterDataService.createPlant(finalDto, {
      id: user?.id || 'system',
      email: user?.email,
    });
  }

  @Patch('plants/:id')
  async updatePlant(
    @Param('id') id: string,
    @Body() dto: UpdatePlantDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.masterDataService.updatePlant(id, dto, {
      id: user?.id || 'system',
      email: user?.email,
    });
  }

  // 4. BRANCHES
  @Get('branches')
  async getBranches(
    @Query('companyId') companyId?: string,
    @Query('all') all?: string,
    @CurrentContext() ctx?: SecurityContext,
    @CurrentUser() user?: AuthUser,
  ) {
    const isSuperAdmin = user?.isSuperAdmin === true;
    const filterCompany = isSuperAdmin
      ? (all === 'true' || companyId === 'ALL' ? undefined : (companyId || ctx?.companyId))
      : (user?.companyId || ctx?.companyId);
    return this.masterDataService.findBranches(filterCompany);
  }

  @Get('branches/:id')
  async getBranch(@Param('id') id: string) {
    return this.masterDataService.findOneBranch(id);
  }

  @Post('branches')
  async createBranch(
    @Body() dto: CreateBranchDto,
    @CurrentUser() user: AuthUser,
    @CurrentContext() ctx: SecurityContext,
  ) {
    const finalDto = {
      ...dto,
      companyId: dto.companyId || ctx.companyId || user.companyId,
    };
    return this.masterDataService.createBranch(finalDto, {
      id: user?.id || 'system',
      email: user?.email,
    });
  }

  @Patch('branches/:id')
  async updateBranch(
    @Param('id') id: string,
    @Body() dto: UpdateBranchDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.masterDataService.updateBranch(id, dto, {
      id: user?.id || 'system',
      email: user?.email,
    });
  }

  // 5. DEPARTMENTS
  @Get('departments')
  async getDepartments(
    @Query('companyId') companyId?: string,
    @Query('all') all?: string,
    @CurrentContext() ctx?: SecurityContext,
    @CurrentUser() user?: AuthUser,
  ) {
    const isSuperAdmin = user?.isSuperAdmin === true;
    const filterCompany = isSuperAdmin
      ? (all === 'true' || companyId === 'ALL' ? undefined : (companyId || ctx?.companyId))
      : (user?.companyId || ctx?.companyId);
    return this.masterDataService.findDepartments(filterCompany);
  }

  @Get('departments/:id')
  async getDepartment(@Param('id') id: string) {
    return this.masterDataService.findOneDepartment(id);
  }

  @Post('departments')
  async createDepartment(
    @Body() dto: CreateDepartmentDto,
    @CurrentUser() user: AuthUser,
    @CurrentContext() ctx: SecurityContext,
  ) {
    const finalDto = {
      ...dto,
      companyId: dto.companyId || ctx.companyId || user.companyId,
    };
    return this.masterDataService.createDepartment(finalDto, {
      id: user?.id || 'system',
      email: user?.email,
    });
  }

  @Patch('departments/:id')
  async updateDepartment(
    @Param('id') id: string,
    @Body() dto: UpdateDepartmentDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.masterDataService.updateDepartment(id, dto, {
      id: user?.id || 'system',
      email: user?.email,
    });
  }

  // 6. WAREHOUSES
  @Get('warehouses')
  async getWarehouses(
    @Query('companyId') companyId?: string,
    @Query('all') all?: string,
    @CurrentContext() ctx?: SecurityContext,
    @CurrentUser() user?: AuthUser,
  ) {
    const isSuperAdmin = user?.isSuperAdmin === true;
    const filterCompany = isSuperAdmin
      ? (all === 'true' || companyId === 'ALL' ? undefined : (companyId || ctx?.companyId))
      : (user?.companyId || ctx?.companyId);
    return this.masterDataService.findWarehouses(filterCompany);
  }

  @Get('warehouses/:id')
  async getWarehouse(@Param('id') id: string) {
    return this.masterDataService.findOneWarehouse(id);
  }

  @Post('warehouses')
  async createWarehouse(
    @Body() dto: CreateWarehouseDto,
    @CurrentUser() user: AuthUser,
    @CurrentContext() ctx: SecurityContext,
  ) {
    const finalDto = {
      ...dto,
      companyId: dto.companyId || ctx.companyId || user.companyId,
    };
    return this.masterDataService.createWarehouse(finalDto, {
      id: user?.id || 'system',
      email: user?.email,
    });
  }

  @Patch('warehouses/:id')
  async updateWarehouse(
    @Param('id') id: string,
    @Body() dto: UpdateWarehouseDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.masterDataService.updateWarehouse(id, dto, {
      id: user?.id || 'system',
      email: user?.email,
    });
  }

  // 7. EMPLOYEES
  @Get('employees')
  async getEmployees(
    @Query('companyId') companyId?: string,
    @Query('organizationId') organizationId?: string,
    @Query('all') all?: string,
    @CurrentContext() ctx?: SecurityContext,
    @CurrentUser() user?: AuthUser,
  ) {
    const isSuperAdmin = user?.isSuperAdmin === true;
    const filterCompany = isSuperAdmin
      ? (all === 'true' || companyId === 'ALL' ? undefined : (companyId || ctx?.companyId))
      : (user?.companyId || ctx?.companyId);
    return this.masterDataService.findEmployees(
      filterCompany,
      organizationId || ctx?.organizationId,
    );
  }

  @Get('employees/:id')
  async getEmployee(@Param('id') id: string) {
    return this.masterDataService.findOneEmployee(id);
  }

  @Post('employees')
  async createEmployee(
    @Body() dto: CreateEmployeeDto,
    @CurrentUser() user: AuthUser,
    @CurrentContext() ctx: SecurityContext,
  ) {
    const finalDto = {
      ...dto,
      organizationId: dto.organizationId || ctx.organizationId || user.organizationId,
      companyId: dto.companyId || ctx.companyId || user.companyId,
    };
    return this.masterDataService.createEmployee(finalDto, {
      id: user?.id || 'system',
      email: user?.email,
    });
  }

  @Patch('employees/:id')
  async updateEmployee(
    @Param('id') id: string,
    @Body() dto: UpdateEmployeeDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.masterDataService.updateEmployee(id, dto, {
      id: user?.id || 'system',
      email: user?.email,
    });
  }

  // 8. USERS
  @Get('users')
  async getUsers(
    @Query('companyId') companyId?: string,
    @Query('organizationId') organizationId?: string,
    @Query('all') all?: string,
    @CurrentContext() ctx?: SecurityContext,
    @CurrentUser() user?: AuthUser,
  ) {
    const isSuperAdmin = user?.isSuperAdmin === true;
    const filterCompany = isSuperAdmin
      ? (all === 'true' || companyId === 'ALL' ? undefined : (companyId || ctx?.companyId))
      : (user?.companyId || ctx?.companyId);
    return this.masterDataService.findUsers(
      organizationId || ctx?.organizationId,
      filterCompany,
    );
  }

  @Get('users/:id')
  async getUser(@Param('id') id: string) {
    return this.masterDataService.findOneUser(id);
  }

  @Post('users')
  async createUser(
    @Body() dto: CreateUserDto,
    @CurrentUser() user: AuthUser,
    @CurrentContext() ctx: SecurityContext,
  ) {
    const orgId = dto.organizationId || ctx?.organizationId || user?.organizationId;
    const compId = dto.companyId || ctx?.companyId || user?.companyId;

    if (!orgId) {
      throw new BadRequestException('Organization context could not be determined');
    }
    if (!compId) {
      throw new BadRequestException('Company context could not be determined');
    }

    const finalDto = {
      ...dto,
      organizationId: orgId,
      companyId: compId,
    };
    return this.masterDataService.createUser(finalDto as any, {
      id: user?.id || 'system',
      email: user?.email,
    });
  }

  @Patch('users/:id')
  async updateUser(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.masterDataService.updateUser(id, dto, {
      id: user?.id || 'system',
      email: user?.email,
    });
  }

  // 9. ROLES & PERMISSIONS
  @Get('roles')
  async getRoles(
    @Query('organizationId') organizationId?: string,
    @CurrentContext() ctx?: SecurityContext,
  ) {
    return this.masterDataService.findRoles(organizationId || ctx?.organizationId);
  }

  @Get('roles/:id')
  async getRole(@Param('id') id: string) {
    return this.masterDataService.findOneRole(id);
  }

  @Post('roles')
  async createRole(
    @Body() dto: CreateRoleDto,
    @CurrentUser() user: AuthUser,
    @CurrentContext() ctx: SecurityContext,
  ) {
    const finalDto = {
      ...dto,
      organizationId: dto.organizationId || ctx.organizationId || user.organizationId,
    };
    return this.masterDataService.createRole(finalDto, {
      id: user?.id || 'system',
      email: user?.email,
    });
  }

  @Patch('roles/:id')
  async updateRole(
    @Param('id') id: string,
    @Body() dto: UpdateRoleDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.masterDataService.updateRole(id, dto, {
      id: user?.id || 'system',
      email: user?.email,
    });
  }

  @Get('permissions')
  async getPermissions() {
    return this.masterDataService.findAllPermissions();
  }

  // ==========================================
  // PHASE 4.5 — EXPANDED MASTER DATA ENDPOINTS
  // ==========================================

  // 10. UNITS OF MEASURE
  @Get('uoms')
  async getUoms(
    @CurrentContext() ctx: SecurityContext,
    @Query('organizationId') orgId?: string,
  ) {
    const organizationId = orgId || ctx.organizationId;
    return this.masterDataService.findUoms(organizationId);
  }

  @Post('uoms')
  async createUom(
    @Body() dto: any,
    @CurrentUser() user: AuthUser,
    @CurrentContext() ctx: SecurityContext,
  ) {
    const finalDto = {
      ...dto,
      organizationId: dto.organizationId || ctx.organizationId || user.organizationId,
    };
    return this.masterDataService.createUom(finalDto, { id: user?.id || 'system', email: user?.email });
  }

  @Patch('uoms/:id')
  async updateUom(
    @Param('id') id: string,
    @Body() dto: any,
    @CurrentUser() user: AuthUser,
  ) {
    return this.masterDataService.updateUom(id, dto, { id: user?.id || 'system', email: user?.email });
  }

  @Delete('uoms/:id')
  async deleteUom(@Param('id') id: string) {
    return this.masterDataService.deleteUom(id);
  }

  // 11. UOM CONVERSIONS
  @Get('uom-conversions')
  async getUomConversions(
    @CurrentContext() ctx: SecurityContext,
    @Query('organizationId') orgId?: string,
  ) {
    const organizationId = orgId || ctx.organizationId;
    return this.masterDataService.findUomConversions(organizationId);
  }

  @Post('uom-conversions')
  async createUomConversion(
    @Body() dto: any,
    @CurrentUser() user: AuthUser,
    @CurrentContext() ctx: SecurityContext,
  ) {
    const finalDto = {
      ...dto,
      organizationId: dto.organizationId || ctx.organizationId || user.organizationId,
    };
    return this.masterDataService.createUomConversion(finalDto, { id: user?.id || 'system', email: user?.email });
  }

  @Delete('uom-conversions/:id')
  async deleteUomConversion(@Param('id') id: string) {
    return this.masterDataService.deleteUomConversion(id);
  }

  // 12. MATERIAL CATEGORIES
  @Get('material-categories')
  async getMaterialCategories(
    @CurrentContext() ctx: SecurityContext,
    @Query('organizationId') orgId?: string,
  ) {
    const organizationId = orgId || ctx.organizationId;
    return this.masterDataService.findMaterialCategories(organizationId);
  }

  @Post('material-categories')
  async createMaterialCategory(
    @Body() dto: any,
    @CurrentUser() user: AuthUser,
    @CurrentContext() ctx: SecurityContext,
  ) {
    const finalDto = {
      ...dto,
      organizationId: dto.organizationId || ctx.organizationId || user.organizationId,
    };
    return this.masterDataService.createMaterialCategory(finalDto, { id: user?.id || 'system', email: user?.email });
  }

  @Patch('material-categories/:id')
  async updateMaterialCategory(
    @Param('id') id: string,
    @Body() dto: any,
    @CurrentUser() user: AuthUser,
  ) {
    return this.masterDataService.updateMaterialCategory(id, dto, { id: user?.id || 'system', email: user?.email });
  }

  // 13. RAW MATERIALS (With Cost RBAC Check - Part 33)
  @Get('raw-materials')
  async getRawMaterials(
    @CurrentContext() ctx: SecurityContext,
    @CurrentUser() user: AuthUser,
    @Query('companyId') companyId?: string,
    @Query('organizationId') orgId?: string,
    @Query('all') all?: string,
  ) {
    const filterCompany = all === 'true' || companyId === 'ALL' ? undefined : (companyId || ctx?.companyId);
    const organizationId = orgId || ctx?.organizationId;
    // Sensitive cost check: super admin, or parent company user, or user with view_cost/view_product_cost permission
    const canViewCost =
      user?.isSuperAdmin ||
      user?.company?.isParent ||
      user?.permissions?.some((p) => p.includes('view_cost') || p.includes('view_product_cost'));

    return this.masterDataService.findRawMaterials(filterCompany, organizationId, canViewCost);
  }

  @Get('raw-materials/:id')
  async getRawMaterial(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ) {
    const canViewCost =
      user?.isSuperAdmin ||
      user?.company?.isParent ||
      user?.permissions?.some((p) => p.includes('view_cost') || p.includes('view_product_cost'));

    return this.masterDataService.findOneRawMaterial(id, canViewCost);
  }

  @Post('raw-materials')
  async createRawMaterial(
    @Body() dto: any,
    @CurrentUser() user: AuthUser,
    @CurrentContext() ctx: SecurityContext,
  ) {
    const finalDto = {
      ...dto,
      organizationId: dto.organizationId || ctx.organizationId || user.organizationId,
      companyId: dto.companyId || ctx.companyId || user.companyId,
    };
    return this.masterDataService.createRawMaterial(finalDto, { id: user?.id || 'system', email: user?.email });
  }

  @Patch('raw-materials/:id')
  async updateRawMaterial(
    @Param('id') id: string,
    @Body() dto: any,
    @CurrentUser() user: AuthUser,
  ) {
    return this.masterDataService.updateRawMaterial(id, dto, { id: user?.id || 'system', email: user?.email });
  }

  @Delete('raw-materials/:id')
  async deleteRawMaterial(@Param('id') id: string) {
    return this.masterDataService.deleteRawMaterial(id);
  }

  // 14. PACKING MATERIALS
  @Get('packing-materials')
  async getPackingMaterials(
    @CurrentContext() ctx: SecurityContext,
    @Query('companyId') companyId?: string,
    @Query('organizationId') orgId?: string,
    @Query('all') all?: string,
  ) {
    const filterCompany = all === 'true' || companyId === 'ALL' ? undefined : (companyId || ctx?.companyId);
    const organizationId = orgId || ctx?.organizationId;
    return this.masterDataService.findPackingMaterials(filterCompany, organizationId);
  }

  @Get('packing-materials/:id')
  async getPackingMaterial(@Param('id') id: string) {
    return this.masterDataService.findOnePackingMaterial(id);
  }

  @Post('packing-materials')
  async createPackingMaterial(
    @Body() dto: any,
    @CurrentUser() user: AuthUser,
    @CurrentContext() ctx: SecurityContext,
  ) {
    const finalDto = {
      ...dto,
      organizationId: dto.organizationId || ctx.organizationId || user.organizationId,
      companyId: dto.companyId || ctx.companyId || user.companyId,
    };
    return this.masterDataService.createPackingMaterial(finalDto, { id: user?.id || 'system', email: user?.email });
  }

  @Patch('packing-materials/:id')
  async updatePackingMaterial(
    @Param('id') id: string,
    @Body() dto: any,
    @CurrentUser() user: AuthUser,
  ) {
    return this.masterDataService.updatePackingMaterial(id, dto, { id: user?.id || 'system', email: user?.email });
  }

  @Delete('packing-materials/:id')
  async deletePackingMaterial(@Param('id') id: string) {
    return this.masterDataService.deletePackingMaterial(id);
  }

  // 15. PRODUCT CATEGORIES
  @Get('product-categories')
  async getProductCategories(
    @CurrentContext() ctx: SecurityContext,
    @Query('organizationId') orgId?: string,
  ) {
    const organizationId = orgId || ctx.organizationId;
    return this.masterDataService.findProductCategories(organizationId);
  }

  @Post('product-categories')
  async createProductCategory(
    @Body() dto: any,
    @CurrentUser() user: AuthUser,
    @CurrentContext() ctx: SecurityContext,
  ) {
    const finalDto = {
      ...dto,
      organizationId: dto.organizationId || ctx.organizationId || user.organizationId,
    };
    return this.masterDataService.createProductCategory(finalDto, { id: user?.id || 'system', email: user?.email });
  }

  @Patch('product-categories/:id')
  async updateProductCategory(
    @Param('id') id: string,
    @Body() dto: any,
    @CurrentUser() user: AuthUser,
  ) {
    return this.masterDataService.updateProductCategory(id, dto, { id: user?.id || 'system', email: user?.email });
  }

  // 16. PACK SIZES
  @Get('pack-sizes')
  async getPackSizes(
    @CurrentContext() ctx: SecurityContext,
    @Query('organizationId') orgId?: string,
  ) {
    const organizationId = orgId || ctx.organizationId;
    return this.masterDataService.findPackSizes(organizationId);
  }

  @Post('pack-sizes')
  async createPackSize(
    @Body() dto: any,
    @CurrentUser() user: AuthUser,
    @CurrentContext() ctx: SecurityContext,
  ) {
    const finalDto = {
      ...dto,
      organizationId: dto.organizationId || ctx.organizationId || user.organizationId,
    };
    return this.masterDataService.createPackSize(finalDto, { id: user?.id || 'system', email: user?.email });
  }

  @Patch('pack-sizes/:id')
  async updatePackSize(
    @Param('id') id: string,
    @Body() dto: any,
    @CurrentUser() user: AuthUser,
  ) {
    return this.masterDataService.updatePackSize(id, dto, { id: user?.id || 'system', email: user?.email });
  }

  @Delete('pack-sizes/:id')
  async deletePackSize(@Param('id') id: string) {
    return this.masterDataService.deletePackSize(id);
  }

  // 17. FINISHED PRODUCTS (With Cost RBAC Check - Part 33)
  @Get('finished-products')
  async getFinishedProducts(
    @CurrentContext() ctx: SecurityContext,
    @CurrentUser() user: AuthUser,
    @Query('companyId') companyId?: string,
    @Query('organizationId') orgId?: string,
    @Query('all') all?: string,
  ) {
    const filterCompany = all === 'true' || companyId === 'ALL' ? undefined : (companyId || ctx?.companyId);
    const organizationId = orgId || ctx?.organizationId;
    const canViewCost =
      user?.isSuperAdmin ||
      user?.company?.isParent ||
      user?.permissions?.some((p) => p.includes('view_cost') || p.includes('view_product_cost'));

    return this.masterDataService.findFinishedProducts(filterCompany, organizationId, canViewCost);
  }

  @Get('finished-products/:id')
  async getFinishedProduct(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ) {
    const canViewCost =
      user?.isSuperAdmin ||
      user?.company?.isParent ||
      user?.permissions?.some((p) => p.includes('view_cost') || p.includes('view_product_cost'));

    return this.masterDataService.findOneFinishedProduct(id, canViewCost);
  }

  @Post('finished-products')
  async createFinishedProduct(
    @Body() dto: any,
    @CurrentUser() user: AuthUser,
    @CurrentContext() ctx: SecurityContext,
  ) {
    const finalDto = {
      ...dto,
      organizationId: dto.organizationId || ctx.organizationId || user.organizationId,
      companyId: dto.companyId || ctx.companyId || user.companyId,
    };
    return this.masterDataService.createFinishedProduct(finalDto, { id: user?.id || 'system', email: user?.email });
  }

  @Patch('finished-products/:id')
  async updateFinishedProduct(
    @Param('id') id: string,
    @Body() dto: any,
    @CurrentUser() user: AuthUser,
  ) {
    return this.masterDataService.updateFinishedProduct(id, dto, { id: user?.id || 'system', email: user?.email });
  }

  @Delete('finished-products/:id')
  async deleteFinishedProduct(@Param('id') id: string) {
    return this.masterDataService.deleteFinishedProduct(id);
  }

  // 18. WAREHOUSE LOCATIONS
  @Get('warehouse-locations')
  async getWarehouseLocations(@Query('warehouseId') warehouseId: string) {
    return this.masterDataService.findWarehouseLocations(warehouseId);
  }

  @Post('warehouse-locations')
  async createWarehouseLocation(
    @Body() dto: any,
    @CurrentUser() user: AuthUser,
  ) {
    return this.masterDataService.createWarehouseLocation(dto, { id: user?.id || 'system', email: user?.email });
  }

  @Patch('warehouse-locations/:id')
  async updateWarehouseLocation(
    @Param('id') id: string,
    @Body() dto: any,
    @CurrentUser() user: AuthUser,
  ) {
    return this.masterDataService.updateWarehouseLocation(id, dto, { id: user?.id || 'system', email: user?.email });
  }

  // 19. PRODUCTION LINES
  @Get('production-lines')
  async getProductionLines(
    @CurrentContext() ctx: SecurityContext,
    @Query('companyId') companyId?: string,
    @Query('all') all?: string,
  ) {
    const filterCompany = all === 'true' || companyId === 'ALL' ? undefined : (companyId || ctx?.companyId);
    return this.masterDataService.findProductionLines(filterCompany);
  }

  @Post('production-lines')
  async createProductionLine(
    @Body() dto: any,
    @CurrentUser() user: AuthUser,
    @CurrentContext() ctx: SecurityContext,
  ) {
    const finalDto = {
      ...dto,
      companyId: dto.companyId || ctx.companyId || user.companyId,
    };
    return this.masterDataService.createProductionLine(finalDto, { id: user?.id || 'system', email: user?.email });
  }

  @Patch('production-lines/:id')
  async updateProductionLine(
    @Param('id') id: string,
    @Body() dto: any,
    @CurrentUser() user: AuthUser,
  ) {
    return this.masterDataService.updateProductionLine(id, dto, { id: user?.id || 'system', email: user?.email });
  }

  // 20. SHIFTS
  @Get('shifts')
  async getShifts(
    @CurrentContext() ctx: SecurityContext,
    @Query('companyId') companyId?: string,
    @Query('all') all?: string,
  ) {
    const filterCompany = all === 'true' || companyId === 'ALL' ? undefined : (companyId || ctx?.companyId);
    return this.masterDataService.findShifts(filterCompany);
  }

  @Post('shifts')
  async createShift(
    @Body() dto: any,
    @CurrentUser() user: AuthUser,
    @CurrentContext() ctx: SecurityContext,
  ) {
    const finalDto = {
      ...dto,
      companyId: dto.companyId || ctx.companyId || user.companyId,
    };
    return this.masterDataService.createShift(finalDto, { id: user?.id || 'system', email: user?.email });
  }

  @Patch('shifts/:id')
  async updateShift(
    @Param('id') id: string,
    @Body() dto: any,
    @CurrentUser() user: AuthUser,
  ) {
    return this.masterDataService.updateShift(id, dto, { id: user?.id || 'system', email: user?.email });
  }

  // 21. QC SPECIFICATIONS
  @Get('qc-specifications')
  async getQcSpecifications(
    @CurrentContext() ctx: SecurityContext,
    @Query('companyId') companyId?: string,
    @Query('organizationId') orgId?: string,
    @Query('all') all?: string,
  ) {
    const filterCompany = all === 'true' || companyId === 'ALL' ? undefined : (companyId || ctx?.companyId);
    const organizationId = orgId || ctx?.organizationId;
    return this.masterDataService.findQcSpecifications(filterCompany, organizationId);
  }

  @Get('qc-specifications/:id')
  async getQcSpecification(@Param('id') id: string) {
    return this.masterDataService.findOneQcSpecification(id);
  }

  @Post('qc-specifications')
  async createQcSpecification(
    @Body() dto: any,
    @CurrentUser() user: AuthUser,
    @CurrentContext() ctx: SecurityContext,
  ) {
    const finalDto = {
      ...dto,
      organizationId: dto.organizationId || ctx.organizationId || user.organizationId,
      companyId: dto.companyId || ctx.companyId || user.companyId,
    };
    return this.masterDataService.createQcSpecification(finalDto, { id: user?.id || 'system', email: user?.email });
  }

  @Patch('qc-specifications/:id')
  async updateQcSpecification(
    @Param('id') id: string,
    @Body() dto: any,
    @CurrentUser() user: AuthUser,
  ) {
    return this.masterDataService.updateQcSpecification(id, dto, { id: user?.id || 'system', email: user?.email });
  }

  // 22. FORMULA / BOM FOUNDATION
  @Get('formula-boms')
  async getFormulaBoms(
    @CurrentContext() ctx: SecurityContext,
    @Query('companyId') companyId?: string,
    @Query('organizationId') orgId?: string,
    @Query('all') all?: string,
  ) {
    const filterCompany = all === 'true' || companyId === 'ALL' ? undefined : (companyId || ctx?.companyId);
    const organizationId = orgId || ctx?.organizationId;
    return this.masterDataService.findFormulaBoms(filterCompany, organizationId);
  }

  @Get('formula-boms/:id')
  async getFormulaBom(@Param('id') id: string) {
    return this.masterDataService.findOneFormulaBom(id);
  }

  @Post('formula-boms')
  async createFormulaBom(
    @Body() dto: any,
    @CurrentUser() user: AuthUser,
    @CurrentContext() ctx: SecurityContext,
  ) {
    const finalDto = {
      ...dto,
      organizationId: dto.organizationId || ctx.organizationId || user.organizationId,
      companyId: dto.companyId || ctx.companyId || user.companyId,
    };
    return this.masterDataService.createFormulaBom(finalDto, { id: user?.id || 'system', email: user?.email });
  }

  @Patch('formula-boms/:id')
  async updateFormulaBom(
    @Param('id') id: string,
    @Body() dto: any,
    @CurrentUser() user: AuthUser,
  ) {
    return this.masterDataService.updateFormulaBom(id, dto, { id: user?.id || 'system', email: user?.email });
  }

  // 23. PAYMENT TERMS
  @Get('payment-terms')
  async getPaymentTerms(
    @CurrentContext() ctx: SecurityContext,
    @Query('companyId') companyId?: string,
    @Query('all') all?: string,
  ) {
    const filterCompany = all === 'true' || companyId === 'ALL' ? undefined : (companyId || ctx?.companyId);
    return this.masterDataService.findPaymentTerms(filterCompany);
  }

  @Post('payment-terms')
  async createPaymentTerm(
    @Body() dto: any,
    @CurrentUser() user: AuthUser,
    @CurrentContext() ctx: SecurityContext,
  ) {
    const finalDto = {
      ...dto,
      companyId: dto.companyId || ctx.companyId || user.companyId,
    };
    return this.masterDataService.createPaymentTerm(finalDto, { id: user?.id || 'system', email: user?.email });
  }

  @Patch('payment-terms/:id')
  async updatePaymentTerm(
    @Param('id') id: string,
    @Body() dto: any,
    @CurrentUser() user: AuthUser,
  ) {
    return this.masterDataService.updatePaymentTerm(id, dto, { id: user?.id || 'system', email: user?.email });
  }

  // 24. TAX CATEGORIES
  @Get('tax-categories')
  async getTaxCategories(
    @CurrentContext() ctx: SecurityContext,
    @Query('companyId') companyId?: string,
    @Query('all') all?: string,
  ) {
    const filterCompany = all === 'true' || companyId === 'ALL' ? undefined : (companyId || ctx?.companyId);
    return this.masterDataService.findTaxCategories(filterCompany);
  }

  @Post('tax-categories')
  async createTaxCategory(
    @Body() dto: any,
    @CurrentUser() user: AuthUser,
    @CurrentContext() ctx: SecurityContext,
  ) {
    const finalDto = {
      ...dto,
      companyId: dto.companyId || ctx.companyId || user.companyId,
    };
    return this.masterDataService.createTaxCategory(finalDto, { id: user?.id || 'system', email: user?.email });
  }

  @Patch('tax-categories/:id')
  async updateTaxCategory(
    @Param('id') id: string,
    @Body() dto: any,
    @CurrentUser() user: AuthUser,
  ) {
    return this.masterDataService.updateTaxCategory(id, dto, { id: user?.id || 'system', email: user?.email });
  }

  // 25. INTERCOMPANY PRICING RULES (Sensitive Margin RBAC - Part 33 & 34)
  @Get('intercompany-pricing-rules')
  async getIntercompanyPricingRules(
    @CurrentContext() ctx: SecurityContext,
    @CurrentUser() user: AuthUser,
    @Query('organizationId') orgId?: string,
  ) {
    const organizationId = orgId || ctx.organizationId;
    // Authorized only for parent company management, super admin, or users with VIEW_INTERCOMPANY_PRICE
    const canViewPrice =
      user?.isSuperAdmin ||
      user?.company?.isParent ||
      user?.permissions?.some((p) => p.includes('view_intercompany_price'));

    return this.masterDataService.findIntercompanyPricingRules(organizationId, canViewPrice);
  }

  @Post('intercompany-pricing-rules')
  async createIntercompanyPricingRule(
    @Body() dto: any,
    @CurrentUser() user: AuthUser,
    @CurrentContext() ctx: SecurityContext,
  ) {
    const finalDto = {
      ...dto,
      organizationId: dto.organizationId || ctx.organizationId || user.organizationId,
    };
    return this.masterDataService.createIntercompanyPricingRule(finalDto, { id: user?.id || 'system', email: user?.email });
  }

  @Patch('intercompany-pricing-rules/:id')
  async updateIntercompanyPricingRule(
    @Param('id') id: string,
    @Body() dto: any,
    @CurrentUser() user: AuthUser,
  ) {
    return this.masterDataService.updateIntercompanyPricingRule(id, dto, { id: user?.id || 'system', email: user?.email });
  }

  // 26. REASON CODES
  @Get('reason-codes')
  async getReasonCodes(
    @CurrentContext() ctx: SecurityContext,
    @Query('organizationId') orgId?: string,
    @Query('category') category?: string,
  ) {
    const organizationId = orgId || ctx.organizationId;
    return this.masterDataService.findReasonCodes(organizationId, category);
  }

  @Post('reason-codes')
  async createReasonCode(
    @Body() dto: any,
    @CurrentUser() user: AuthUser,
    @CurrentContext() ctx: SecurityContext,
  ) {
    const finalDto = {
      ...dto,
      organizationId: dto.organizationId || ctx.organizationId || user.organizationId,
    };
    return this.masterDataService.createReasonCode(finalDto, { id: user?.id || 'system', email: user?.email });
  }

  @Patch('reason-codes/:id')
  async updateReasonCode(
    @Param('id') id: string,
    @Body() dto: any,
    @CurrentUser() user: AuthUser,
  ) {
    return this.masterDataService.updateReasonCode(id, dto, { id: user?.id || 'system', email: user?.email });
  }

  // ==========================================
  // 27. REGIONS
  // ==========================================

  @Get('regions')
  async getRegions(
    @Query('companyId') companyId?: string,
    @CurrentUser() user?: AuthUser,
    @CurrentContext() ctx?: SecurityContext,
  ) {
    const finalCompanyId = companyId || ctx?.companyId || user?.companyId;
    return this.masterDataService.findRegions(finalCompanyId);
  }

  @Get('regions/:id')
  async getRegion(@Param('id') id: string) {
    return this.masterDataService.findOneRegion(id);
  }

  @Post('regions')
  async createRegion(
    @Body() dto: CreateRegionDto,
    @CurrentUser() user: AuthUser,
    @CurrentContext() ctx: SecurityContext,
  ) {
    const finalDto = {
      ...dto,
      companyId: dto.companyId || ctx.companyId || user.companyId,
    };
    return this.masterDataService.createRegion(finalDto, { id: user?.id || 'system', email: user?.email });
  }

  @Patch('regions/:id')
  async updateRegion(
    @Param('id') id: string,
    @Body() dto: UpdateRegionDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.masterDataService.updateRegion(id, dto, { id: user?.id || 'system', email: user?.email });
  }

  @Delete('regions/:id')
  async deleteRegion(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.masterDataService.deleteRegion(id, { id: user?.id || 'system', email: user?.email });
  }

  // ==========================================
  // 28. ZONES
  // ==========================================

  @Get('zones')
  async getZones(
    @Query('regionId') regionId?: string,
    @Query('companyId') companyId?: string,
    @CurrentUser() user?: AuthUser,
    @CurrentContext() ctx?: SecurityContext,
  ) {
    const finalCompanyId = companyId || ctx?.companyId || user?.companyId;
    return this.masterDataService.findZones(regionId, finalCompanyId);
  }

  @Get('zones/:id')
  async getZone(@Param('id') id: string) {
    return this.masterDataService.findOneZone(id);
  }

  @Post('zones')
  async createZone(
    @Body() dto: CreateZoneDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.masterDataService.createZone(dto, { id: user?.id || 'system', email: user?.email });
  }

  @Patch('zones/:id')
  async updateZone(
    @Param('id') id: string,
    @Body() dto: UpdateZoneDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.masterDataService.updateZone(id, dto, { id: user?.id || 'system', email: user?.email });
  }

  @Delete('zones/:id')
  async deleteZone(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.masterDataService.deleteZone(id, { id: user?.id || 'system', email: user?.email });
  }

  // ==========================================
  // 29. TERRITORIES
  // ==========================================

  @Get('territories')
  async getTerritories(
    @Query('zoneId') zoneId?: string,
    @Query('companyId') companyId?: string,
    @CurrentUser() user?: AuthUser,
    @CurrentContext() ctx?: SecurityContext,
  ) {
    const finalCompanyId = companyId || ctx?.companyId || user?.companyId;
    return this.masterDataService.findTerritories(zoneId, finalCompanyId);
  }

  @Get('territories/:id')
  async getTerritory(@Param('id') id: string) {
    return this.masterDataService.findOneTerritory(id);
  }

  @Post('territories')
  async createTerritory(
    @Body() dto: CreateTerritoryDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.masterDataService.createTerritory(dto, { id: user?.id || 'system', email: user?.email });
  }

  @Patch('territories/:id')
  async updateTerritory(
    @Param('id') id: string,
    @Body() dto: UpdateTerritoryDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.masterDataService.updateTerritory(id, dto, { id: user?.id || 'system', email: user?.email });
  }

  @Delete('territories/:id')
  async deleteTerritory(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.masterDataService.deleteTerritory(id, { id: user?.id || 'system', email: user?.email });
  }

  // ==========================================
  // 30. USER MARKET ASSIGNMENTS
  // ==========================================

  @Get('market-assignments')
  async getMarketAssignments(
    @Query('userId') userId?: string,
    @Query('employeeId') employeeId?: string,
    @Query('companyId') companyId?: string,
    @Query('regionId') regionId?: string,
    @Query('zoneId') zoneId?: string,
    @Query('territoryId') territoryId?: string,
    @Query('status') status?: string,
    @CurrentUser() user?: AuthUser,
    @CurrentContext() ctx?: SecurityContext,
  ) {
    const finalCompanyId = companyId || ctx?.companyId || user?.companyId;
    return this.masterDataService.findMarketAssignments({
      userId,
      employeeId,
      companyId: finalCompanyId,
      regionId,
      zoneId,
      territoryId,
      status,
    });
  }

  @Post('market-assignments')
  async createMarketAssignment(
    @Body() dto: CreateMarketAssignmentDto,
    @CurrentUser() user: AuthUser,
    @CurrentContext() ctx: SecurityContext,
  ) {
    const finalDto = {
      ...dto,
      companyId: dto.companyId || ctx.companyId || user.companyId,
    };
    return this.masterDataService.createMarketAssignment(finalDto, { id: user?.id || 'system', email: user?.email });
  }

  @Patch('market-assignments/:id')
  async updateMarketAssignment(
    @Param('id') id: string,
    @Body() dto: UpdateMarketAssignmentDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.masterDataService.updateMarketAssignment(id, dto, { id: user?.id || 'system', email: user?.email });
  }

  @Delete('market-assignments/:id')
  async deleteMarketAssignment(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.masterDataService.deleteMarketAssignment(id, { id: user?.id || 'system', email: user?.email });
  }

  // ==========================================
  // 31. MARKET HIERARCHY TREE
  // ==========================================

  @Get('market-hierarchy')
  async getMarketHierarchy(
    @Query('companyId') companyId?: string,
    @CurrentUser() user?: AuthUser,
    @CurrentContext() ctx?: SecurityContext,
  ) {
    const finalCompanyId = companyId || ctx?.companyId || user?.companyId;
    return this.masterDataService.getMarketHierarchy(finalCompanyId);
  }

  // ==========================================
  // 32. AUTHENTICATED USER CONTEXT
  // ==========================================

  @Get('user-context')
  async getUserContext(@CurrentUser() user: AuthUser) {
    return this.masterDataService.getUserContext(user.id);
  }
}
