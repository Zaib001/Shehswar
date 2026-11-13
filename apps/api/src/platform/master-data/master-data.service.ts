/**
 * SHEHSWAR ONE360 - Master Data Service
 *
 * Implements enterprise master data management with strict multi-tenant isolation,
 * immutable audit log recording, and UUIDv7 primary keys.
 */
import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import bcrypt from 'bcryptjs';
import { PrismaService } from '../../core/database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { uuidv7 } from '@shehswar/shared';
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
import { UserContextDto } from '@shehswar/types';
import { CodeGenerationService } from '../code-generation/code-generation.service';

@Injectable()
export class MasterDataService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly codeGen: CodeGenerationService,
  ) {}

  // ==========================================
  // 1. ORGANIZATION MANAGEMENT
  // ==========================================

  async findAllOrganizations(params?: { search?: string; isActive?: boolean }) {
    const where: any = {};
    if (params?.isActive !== undefined) {
      where.isActive = params.isActive;
    }
    if (params?.search) {
      where.OR = [
        { name: { contains: params.search, mode: 'insensitive' } },
        { code: { contains: params.search, mode: 'insensitive' } },
        { legalName: { contains: params.search, mode: 'insensitive' } },
      ];
    }
    return this.prisma.organization.findMany({
      where,
      include: {
        _count: {
          select: { companies: true, users: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOneOrganization(id: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id },
      include: {
        companies: true,
        users: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            status: true,
            createdAt: true,
          },
        },
        _count: {
          select: { companies: true, users: true },
        },
      },
    });
    if (!org) {
      throw new NotFoundException(`Organization with ID ${id} not found`);
    }
    return org;
  }

  async createOrganization(dto: CreateOrganizationDto, actor: { id: string; email?: string }) {
    const existing = await this.prisma.organization.findUnique({
      where: { code: dto.code.toUpperCase() },
    });
    if (existing) {
      throw new ConflictException(`Organization with code "${dto.code}" already exists`);
    }

    let tenant = await this.prisma.platformTenant.findFirst();
    if (!tenant) {
      tenant = await this.prisma.platformTenant.create({
        data: {
          id: uuidv7(),
          code: 'SHEHSWAR-TENANT',
          name: 'Shehswar Group Tenant',
        },
      });
    }

    const orgId = uuidv7();
    const created = await this.prisma.organization.create({
      data: {
        id: orgId,
        tenantId: tenant.id,
        code: dto.code.toUpperCase(),
        name: dto.name,
        legalName: dto.legalName,
        taxId: dto.taxId,
        strnId: dto.strnId,
        logoUrl: dto.logoUrl,
        industry: dto.industry,
        country: dto.country || 'Pakistan',
        currency: dto.currency || 'PKR',
        timezone: dto.timezone || 'Asia/Karachi',
        email: dto.email,
        phone: dto.phone,
        address: dto.address,
        isActive: dto.isActive ?? true,
        createdBy: actor.id,
      },
    });

    await this.auditService.record({
      organizationId: created.id,
      actorId: actor.id,
      actorEmail: actor.email,
      resource: 'ORGANIZATION',
      resourceId: created.id,
      action: 'CREATE',
      newState: created as unknown as Record<string, unknown>,
      correlationId: uuidv7(),
    });

    return created;
  }

  async updateOrganization(id: string, dto: UpdateOrganizationDto, actor: { id: string; email?: string }) {
    const previous = await this.findOneOrganization(id);
    const updated = await this.prisma.organization.update({
      where: { id },
      data: {
        ...dto,
      },
    });

    await this.auditService.record({
      organizationId: id,
      actorId: actor.id,
      actorEmail: actor.email,
      resource: 'ORGANIZATION',
      resourceId: id,
      action: 'UPDATE',
      previousState: previous as unknown as Record<string, unknown>,
      newState: updated as unknown as Record<string, unknown>,
      correlationId: uuidv7(),
    });

    return updated;
  }

  async deleteOrganization(id: string, actor: { id: string; email?: string }) {
    const org = await this.findOneOrganization(id);
    await this.prisma.$transaction(async (tx) => {
      const companies = await tx.company.findMany({ where: { organizationId: id }, select: { id: true } });
      const compIds = companies.map((c) => c.id);
      if (compIds.length > 0) {
        await tx.warehouse.deleteMany({ where: { companyId: { in: compIds } } });
        await tx.department.deleteMany({ where: { companyId: { in: compIds } } });
        await tx.branch.deleteMany({ where: { companyId: { in: compIds } } });
        await tx.plant.deleteMany({ where: { companyId: { in: compIds } } });
        await tx.company.deleteMany({ where: { id: { in: compIds } } });
      }
      await tx.organization.delete({ where: { id } });
    });
    await this.auditService.record({
      organizationId: id,
      actorId: actor.id,
      actorEmail: actor.email,
      resource: 'ORGANIZATION',
      resourceId: id,
      action: 'DELETE',
      previousState: org as unknown as Record<string, unknown>,
      newState: null,
      correlationId: uuidv7(),
    });
    return { success: true, message: `Organization ${org.name} deleted.` };
  }

  // ==========================================
  // 2. COMPANY MANAGEMENT
  // ==========================================

  async findCompanies(
    organizationId: string,
    params?: { search?: string; isActive?: boolean; companyId?: string },
  ) {
    const where: any = { organizationId };
    if (params?.companyId) {
      where.id = params.companyId;
    }
    if (params?.isActive !== undefined) {
      where.isActive = params.isActive;
    }
    if (params?.search) {
      where.OR = [
        { name: { contains: params.search, mode: 'insensitive' } },
        { code: { contains: params.search, mode: 'insensitive' } },
        { legalName: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    return this.prisma.company.findMany({
      where,
      include: {
        organization: {
          select: { id: true, code: true, name: true },
        },
        parentCompany: {
          select: { id: true, code: true, name: true, companyType: true },
        },
        childCompanies: {
          select: { id: true, code: true, name: true, companyType: true, isActive: true },
        },
        _count: {
          select: {
            plants: true,
            branches: true,
            warehouses: true,
            departments: true,
            users: true,
            childCompanies: true,
          },
        },
      },
      orderBy: [{ isParent: 'desc' }, { code: 'asc' }],
    });
  }

  async findOneCompany(id: string) {
    const company = await this.prisma.company.findUnique({
      where: { id },
      include: {
        organization: true,
        parentCompany: true,
        childCompanies: true,
        plants: true,
        branches: true,
        warehouses: true,
        departments: true,
        _count: {
          select: {
            plants: true,
            branches: true,
            warehouses: true,
            departments: true,
            users: true,
            childCompanies: true,
          },
        },
      },
    });
    if (!company) {
      throw new NotFoundException(`Company with ID ${id} not found`);
    }
    return company;
  }

  async findCompanyChildren(id: string) {
    await this.findOneCompany(id);
    return this.prisma.company.findMany({
      where: { parentCompanyId: id },
      include: {
        _count: {
          select: { plants: true, warehouses: true, departments: true, users: true },
        },
      },
      orderBy: { code: 'asc' },
    });
  }

  async findCompanyParent(id: string) {
    const company = await this.findOneCompany(id);
    if (!company.parentCompanyId) {
      return null;
    }
    return this.findOneCompany(company.parentCompanyId);
  }

  async findCompanyHierarchy(organizationId: string) {
    return this.prisma.company.findMany({
      where: { organizationId, parentCompanyId: null },
      include: {
        plants: true,
        warehouses: true,
        departments: true,
        childCompanies: {
          include: {
            plants: true,
            warehouses: true,
            departments: true,
          },
        },
      },
      orderBy: [{ isParent: 'desc' }, { code: 'asc' }],
    });
  }

  async createCompany(dto: CreateCompanyDto, actor: { id: string; email?: string }) {
    const orgId = dto.organizationId!;
    const existing = await this.prisma.company.findFirst({
      where: {
        organizationId: orgId,
        code: dto.code.toUpperCase(),
      },
    });
    if (existing) {
      throw new ConflictException(`Company code "${dto.code}" already exists in this organization`);
    }

    const companyId = uuidv7();
    const created = await this.prisma.company.create({
      data: {
        id: companyId,
        organizationId: orgId,
        parentCompanyId: (dto as any).parentCompanyId || null,
        code: dto.code.toUpperCase(),
        name: dto.name,
        legalName: dto.legalName,
        companyType: dto.companyType || 'PARENT_MANUFACTURING',
        isParent: dto.isParent ?? false,
        taxId: dto.taxId,
        currencyCode: dto.currencyCode || 'PKR',
        email: dto.email,
        phone: dto.phone,
        address: dto.address,
        managerName: dto.managerName,
        isActive: dto.isActive ?? true,
      },
    });

    await this.auditService.record({
      organizationId: orgId,
      companyId: created.id,
      actorId: actor.id,
      actorEmail: actor.email,
      resource: 'COMPANY',
      resourceId: created.id,
      action: 'CREATE',
      newState: created as unknown as Record<string, unknown>,
      correlationId: uuidv7(),
    });

    await this.bindManagerToCompany(created.id, (dto as any).managerUserId, dto.managerName);

    return created;
  }

  async updateCompany(id: string, dto: UpdateCompanyDto, actor: { id: string; email?: string }) {
    const previous = await this.findOneCompany(id);
    const { managerUserId, ...updateFields } = dto as any;
    const updated = await this.prisma.company.update({
      where: { id },
      data: {
        ...updateFields,
      },
    });

    await this.bindManagerToCompany(id, managerUserId, dto.managerName);

    await this.auditService.record({
      organizationId: previous.organizationId,
      companyId: id,
      actorId: actor.id,
      actorEmail: actor.email,
      resource: 'COMPANY',
      resourceId: id,
      action: 'UPDATE',
      previousState: previous as unknown as Record<string, unknown>,
      newState: updated as unknown as Record<string, unknown>,
      correlationId: uuidv7(),
    });

    return updated;
  }

  async deleteCompany(id: string, actor: { id: string; email?: string }) {
    const company = await this.findOneCompany(id);
    await this.prisma.$transaction(async (tx) => {
      await tx.company.updateMany({ where: { parentCompanyId: id }, data: { parentCompanyId: null } });
      await tx.warehouseStock.deleteMany({ where: { warehouse: { companyId: id } } });
      await tx.warehouse.deleteMany({ where: { companyId: id } });
      await tx.department.deleteMany({ where: { companyId: id } });
      await tx.branch.deleteMany({ where: { companyId: id } });
      await tx.plant.deleteMany({ where: { companyId: id } });
      await tx.company.delete({ where: { id } });
    });
    await this.auditService.record({
      organizationId: company.organizationId,
      companyId: id,
      actorId: actor.id,
      actorEmail: actor.email,
      resource: 'COMPANY',
      resourceId: id,
      action: 'DELETE',
      previousState: company as unknown as Record<string, unknown>,
      newState: null,
      correlationId: uuidv7(),
    });
    return { success: true, message: `Company ${company.name} deleted.` };
  }

  private async bindManagerToCompany(companyId: string, managerUserId?: string, managerName?: string) {
    if (!managerUserId && !managerName) return;

    let user = null;
    if (managerUserId) {
      user = await this.prisma.user.findUnique({ where: { id: managerUserId } });
    }
    if (!user && managerName) {
      user = await this.prisma.user.findFirst({
        where: {
          OR: [
            { id: managerName.length === 36 ? managerName : undefined },
            { email: managerName },
            { firstName: { equals: managerName, mode: 'insensitive' } },
          ],
        },
      });
    }

    if (user) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { companyId },
      });
      await this.prisma.userRole.updateMany({
        where: { userId: user.id },
        data: { companyId },
      });

      // Ensure manager has ROLE_COMPANY_ADMIN
      const companyAdminRole = await this.prisma.role.findFirst({
        where: { organizationId: user.organizationId, code: 'ROLE_COMPANY_ADMIN' },
      });
      if (companyAdminRole) {
        const hasRole = await this.prisma.userRole.findFirst({
          where: { userId: user.id, roleId: companyAdminRole.id },
        });
        if (!hasRole) {
          await this.prisma.userRole.create({
            data: {
              userId: user.id,
              roleId: companyAdminRole.id,
              companyId,
            },
          });
        }
      }
    }
  }

  // ==========================================
  // 3. PLANT MANAGEMENT
  // ==========================================

  async findPlants(companyId?: string, organizationId?: string) {
    const where: any = {};
    if (companyId) {
      where.companyId = companyId;
    }
    if (organizationId) {
      where.company = { organizationId };
    }

    return this.prisma.plant.findMany({
      where,
      include: {
        company: {
          select: { id: true, code: true, name: true },
        },
        warehouses: true,
        _count: {
          select: { warehouses: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOnePlant(id: string) {
    const plant = await this.prisma.plant.findUnique({
      where: { id },
      include: {
        company: true,
        warehouses: true,
      },
    });
    if (!plant) {
      throw new NotFoundException(`Plant with ID ${id} not found`);
    }
    return plant;
  }

  async createPlant(dto: CreatePlantDto, actor: { id: string; email?: string }) {
    const company = await this.findOneCompany(dto.companyId);
    const plantId = uuidv7();

    const created = await this.prisma.plant.create({
      data: {
        id: plantId,
        companyId: dto.companyId,
        code: dto.code.toUpperCase(),
        name: dto.name,
        location: dto.location,
        address: dto.address,
        managerName: dto.managerName,
        isActive: dto.isActive ?? true,
      },
    });

    await this.auditService.record({
      organizationId: company.organizationId,
      companyId: dto.companyId,
      actorId: actor.id,
      actorEmail: actor.email,
      resource: 'PLANT',
      resourceId: created.id,
      action: 'CREATE',
      newState: created as unknown as Record<string, unknown>,
      correlationId: uuidv7(),
    });

    return created;
  }

  async updatePlant(id: string, dto: UpdatePlantDto, actor: { id: string; email?: string }) {
    const previous = await this.findOnePlant(id);
    const updated = await this.prisma.plant.update({
      where: { id },
      data: {
        ...dto,
      },
    });

    await this.auditService.record({
      organizationId: previous.company.organizationId,
      companyId: previous.companyId,
      actorId: actor.id,
      actorEmail: actor.email,
      resource: 'PLANT',
      resourceId: id,
      action: 'UPDATE',
      previousState: previous as unknown as Record<string, unknown>,
      newState: updated as unknown as Record<string, unknown>,
      correlationId: uuidv7(),
    });

    return updated;
  }

  async deletePlant(id: string, actor: { id: string; email?: string }) {
    const plant = await this.findOnePlant(id);
    await this.prisma.$transaction(async (tx) => {
      await tx.warehouse.updateMany({ where: { plantId: id }, data: { plantId: null } });
      await tx.productionLine.updateMany({ where: { plantId: id }, data: { plantId: null } });
      await tx.plant.delete({ where: { id } });
    });
    await this.auditService.record({
      organizationId: (plant as any).company?.organizationId || 'system',
      companyId: plant.companyId,
      actorId: actor.id,
      actorEmail: actor.email,
      resource: 'PLANT',
      resourceId: id,
      action: 'DELETE',
      previousState: plant as unknown as Record<string, unknown>,
      newState: null,
      correlationId: uuidv7(),
    });
    return { success: true, message: `Plant ${plant.name} deleted.` };
  }

  // ==========================================
  // 4. BRANCH MANAGEMENT
  // ==========================================

  async findBranches(companyId?: string) {
    const where: any = {};
    if (companyId) {
      where.companyId = companyId;
    }

    return this.prisma.branch.findMany({
      where,
      include: {
        company: {
          select: { id: true, code: true, name: true },
        },
        warehouses: true,
        _count: {
          select: { warehouses: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOneBranch(id: string) {
    const branch = await this.prisma.branch.findUnique({
      where: { id },
      include: {
        company: true,
        warehouses: true,
      },
    });
    if (!branch) {
      throw new NotFoundException(`Branch with ID ${id} not found`);
    }
    return branch;
  }

  async createBranch(dto: CreateBranchDto, actor: { id: string; email?: string }) {
    const company = await this.findOneCompany(dto.companyId);
    const branchId = uuidv7();

    const created = await this.prisma.branch.create({
      data: {
        id: branchId,
        companyId: dto.companyId,
        code: dto.code.toUpperCase(),
        name: dto.name,
        address: dto.address,
        city: dto.city,
        regionName: dto.regionName,
        managerName: dto.managerName,
        isActive: dto.isActive ?? true,
      },
    });

    await this.auditService.record({
      organizationId: company.organizationId,
      companyId: dto.companyId,
      actorId: actor.id,
      actorEmail: actor.email,
      resource: 'BRANCH',
      resourceId: created.id,
      action: 'CREATE',
      newState: created as unknown as Record<string, unknown>,
      correlationId: uuidv7(),
    });

    return created;
  }

  async updateBranch(id: string, dto: UpdateBranchDto, actor: { id: string; email?: string }) {
    const previous = await this.findOneBranch(id);
    const updated = await this.prisma.branch.update({
      where: { id },
      data: {
        ...dto,
      },
    });

    await this.auditService.record({
      organizationId: previous.company.organizationId,
      companyId: previous.companyId,
      actorId: actor.id,
      actorEmail: actor.email,
      resource: 'BRANCH',
      resourceId: id,
      action: 'UPDATE',
      previousState: previous as unknown as Record<string, unknown>,
      newState: updated as unknown as Record<string, unknown>,
      correlationId: uuidv7(),
    });

    return updated;
  }

  async deleteBranch(id: string, actor: { id: string; email?: string }) {
    const branch = await this.findOneBranch(id);
    await this.prisma.$transaction(async (tx) => {
      await tx.warehouse.updateMany({ where: { branchId: id }, data: { branchId: null } });
      await tx.employee.updateMany({ where: { branchId: id }, data: { branchId: null } });
      await tx.branch.delete({ where: { id } });
    });
    await this.auditService.record({
      organizationId: branch.company.organizationId,
      companyId: branch.companyId,
      actorId: actor.id,
      actorEmail: actor.email,
      resource: 'BRANCH',
      resourceId: id,
      action: 'DELETE',
      previousState: branch as unknown as Record<string, unknown>,
      newState: null,
      correlationId: uuidv7(),
    });
    return { success: true, message: `Branch ${branch.name} deleted.` };
  }

  // ==========================================
  // 5. DEPARTMENT MANAGEMENT
  // ==========================================

  async findDepartments(companyId?: string) {
    const where: any = {};
    if (companyId) {
      where.companyId = companyId;
    }

    return this.prisma.department.findMany({
      where,
      include: {
        company: {
          select: { id: true, code: true, name: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOneDepartment(id: string) {
    const dept = await this.prisma.department.findUnique({
      where: { id },
      include: {
        company: true,
      },
    });
    if (!dept) {
      throw new NotFoundException(`Department with ID ${id} not found`);
    }
    return dept;
  }

  async createDepartment(dto: CreateDepartmentDto, actor: { id: string; email?: string }) {
    const company = await this.findOneCompany(dto.companyId);
    const deptId = uuidv7();

    const created = await this.prisma.department.create({
      data: {
        id: deptId,
        companyId: dto.companyId,
        code: dto.code.toUpperCase(),
        name: dto.name,
        managerName: dto.managerName,
        isActive: dto.isActive ?? true,
      },
    });

    await this.auditService.record({
      organizationId: company.organizationId,
      companyId: dto.companyId,
      actorId: actor.id,
      actorEmail: actor.email,
      resource: 'DEPARTMENT',
      resourceId: created.id,
      action: 'CREATE',
      newState: created as unknown as Record<string, unknown>,
      correlationId: uuidv7(),
    });

    return created;
  }

  async updateDepartment(id: string, dto: UpdateDepartmentDto, actor: { id: string; email?: string }) {
    const previous = await this.findOneDepartment(id);
    const updated = await this.prisma.department.update({
      where: { id },
      data: {
        ...dto,
      },
    });

    await this.auditService.record({
      organizationId: previous.company.organizationId,
      companyId: previous.companyId,
      actorId: actor.id,
      actorEmail: actor.email,
      resource: 'DEPARTMENT',
      resourceId: id,
      action: 'UPDATE',
      previousState: previous as unknown as Record<string, unknown>,
      newState: updated as unknown as Record<string, unknown>,
      correlationId: uuidv7(),
    });

    return updated;
  }

  async deleteDepartment(id: string, actor: { id: string; email?: string }) {
    const dept = await this.findOneDepartment(id);
    await this.prisma.$transaction(async (tx) => {
      await tx.employee.updateMany({ where: { departmentId: id }, data: { departmentId: null } });
      await tx.department.delete({ where: { id } });
    });
    await this.auditService.record({
      organizationId: dept.company.organizationId,
      companyId: dept.companyId,
      actorId: actor.id,
      actorEmail: actor.email,
      resource: 'DEPARTMENT',
      resourceId: id,
      action: 'DELETE',
      previousState: dept as unknown as Record<string, unknown>,
      newState: null,
      correlationId: uuidv7(),
    });
    return { success: true, message: `Department ${dept.name} deleted.` };
  }

  // ==========================================
  // 6. WAREHOUSE MANAGEMENT
  // ==========================================

  async findWarehouses(companyId?: string) {
    const where: any = {};
    if (companyId) {
      where.companyId = companyId;
    }

    return this.prisma.warehouse.findMany({
      where,
      include: {
        company: {
          select: { id: true, code: true, name: true },
        },
        plant: {
          select: { id: true, code: true, name: true },
        },
        branch: {
          select: { id: true, code: true, name: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOneWarehouse(id: string, expectedCompanyId?: string) {
    const wh = await this.prisma.warehouse.findUnique({
      where: { id },
      include: {
        company: true,
        plant: true,
        branch: true,
      },
    });
    if (!wh) {
      throw new NotFoundException(`Warehouse with ID ${id} not found`);
    }
    if (expectedCompanyId && expectedCompanyId !== 'ALL' && wh.companyId !== expectedCompanyId) {
      throw new ForbiddenException(
        `Data isolation violation: Warehouse '${wh.name}' belongs to company '${wh.company?.name}' and cannot be accessed under active company context.`,
      );
    }
    return wh;
  }

  async createWarehouse(dto: CreateWarehouseDto, actor: { id: string; email?: string }) {
    const company = await this.findOneCompany(dto.companyId);
    let code = (dto.code || '').trim().toUpperCase();
    if (!code || code === 'AUTO') {
      code = await this.codeGen.generateCode({
        companyId: dto.companyId,
        organizationId: company.organizationId,
        entityType: 'WAREHOUSE',
      });
    }
    const whId = uuidv7();

    const created = await this.prisma.warehouse.create({
      data: {
        id: whId,
        companyId: dto.companyId,
        plantId: dto.plantId,
        branchId: dto.branchId,
        code,
        name: dto.name,
        type: dto.type || 'RAW_MATERIAL',
        location: dto.location,
        address: dto.address,
        managerName: dto.managerName,
        isActive: dto.isActive ?? true,
      },
    });

    await this.auditService.record({
      organizationId: company.organizationId,
      companyId: dto.companyId,
      actorId: actor.id,
      actorEmail: actor.email,
      resource: 'WAREHOUSE',
      resourceId: created.id,
      action: 'CREATE',
      newState: created as unknown as Record<string, unknown>,
      correlationId: uuidv7(),
    });

    return created;
  }

  async updateWarehouse(id: string, dto: UpdateWarehouseDto, actor: { id: string; email?: string }) {
    const previous = await this.findOneWarehouse(id);
    const updated = await this.prisma.warehouse.update({
      where: { id },
      data: {
        ...dto,
      },
    });

    await this.auditService.record({
      organizationId: previous.company.organizationId,
      companyId: previous.companyId,
      actorId: actor.id,
      actorEmail: actor.email,
      resource: 'WAREHOUSE',
      resourceId: id,
      action: 'UPDATE',
      previousState: previous as unknown as Record<string, unknown>,
      newState: updated as unknown as Record<string, unknown>,
      correlationId: uuidv7(),
    });

    return updated;
  }

  async deleteWarehouse(id: string, actor: { id: string; email?: string }) {
    const wh = await this.findOneWarehouse(id);
    await this.prisma.$transaction(async (tx) => {
      // 1. Unlink nullable references
      await tx.purchaseOrder.updateMany({ where: { warehouseId: id }, data: { warehouseId: null } });
      await tx.salesOrder.updateMany({ where: { warehouseId: id }, data: { warehouseId: null } });

      // 2. Reassign non-nullable transaction references to a sibling warehouse if one exists
      const fallback = await tx.warehouse.findFirst({ where: { companyId: wh.companyId, id: { not: id } } });
      if (fallback) {
        await tx.goodsReceiptNote.updateMany({ where: { warehouseId: id }, data: { warehouseId: fallback.id } });
        await tx.purchaseInvoice.updateMany({ where: { warehouseId: id }, data: { warehouseId: fallback.id } });
        await tx.purchaseReturn.updateMany({ where: { warehouseId: id }, data: { warehouseId: fallback.id } });
        await tx.salesInvoice.updateMany({ where: { warehouseId: id }, data: { warehouseId: fallback.id } });
        await tx.salesReturn.updateMany({ where: { warehouseId: id }, data: { warehouseId: fallback.id } });
      } else {
        // No other warehouse exists in the company: purge dependent transaction records (items cascade automatically)
        await tx.goodsReceiptNote.deleteMany({ where: { warehouseId: id } });
        await tx.purchaseInvoice.deleteMany({ where: { warehouseId: id } });
        await tx.purchaseReturn.deleteMany({ where: { warehouseId: id } });
        await tx.salesInvoice.deleteMany({ where: { warehouseId: id } });
        await tx.salesReturn.deleteMany({ where: { warehouseId: id } });
      }

      // 3. Delete stock ledger entries, warehouse stocks, and locations
      await tx.stockLedgerEntry.deleteMany({ where: { warehouseId: id } });
      await tx.warehouseStock.deleteMany({ where: { warehouseId: id } });
      await tx.warehouseLocation.deleteMany({ where: { warehouseId: id } });

      // 4. Finally delete the warehouse
      await tx.warehouse.delete({ where: { id } });
    });
    await this.auditService.record({
      organizationId: wh.company.organizationId,
      companyId: wh.companyId,
      actorId: actor.id,
      actorEmail: actor.email,
      resource: 'WAREHOUSE',
      resourceId: id,
      action: 'DELETE',
      previousState: wh as unknown as Record<string, unknown>,
      newState: null,
      correlationId: uuidv7(),
    });
    return { success: true, message: `Warehouse ${wh.name} deleted.` };
  }

  async deleteBulkWarehouses(ids: string[], actor: { id: string; email?: string }) {
    if (!ids || ids.length === 0) return { success: true, count: 0 };
    for (const id of ids) {
      await this.deleteWarehouse(id, actor);
    }
    return { success: true, count: ids.length };
  }

  async deleteAllWarehouses(companyId?: string, actor?: { id: string; email?: string }) {
    const where: any = {};
    if (companyId) where.companyId = companyId;
    const warehouses = await this.prisma.warehouse.findMany({ where, select: { id: true } });
    for (const wh of warehouses) {
      await this.deleteWarehouse(wh.id, actor || { id: 'system' });
    }
    return { success: true, count: warehouses.length };
  }

  // ==========================================
  // 7. EMPLOYEE MANAGEMENT
  // ==========================================

  async findEmployees(companyId?: string, organizationId?: string) {
    const where: any = {};
    if (companyId) {
      where.companyId = companyId;
    }
    if (organizationId) {
      where.organizationId = organizationId;
    }

    return this.prisma.employee.findMany({
      where,
      include: {
        department: true,
        plant: true,
        branch: true,
        currentVehicles: {
          select: { id: true, vehicleNumber: true, vehicleModel: true, status: true },
        },
        manager: {
          select: { id: true, firstName: true, lastName: true, employeeCode: true, email: true, position: true },
        },
        users: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            status: true,
            userRoles: { include: { role: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOneEmployee(id: string) {
    const emp = await this.prisma.employee.findUnique({
      where: { id },
      include: {
        company: true,
        department: true,
        plant: true,
        branch: true,
        manager: true,
        subordinates: true,
        currentVehicles: true,
        vehicleAssignments: {
          include: { vehicle: true },
          orderBy: { assignmentDate: 'desc' },
        },
        vehicleExpenses: {
          orderBy: { expenseDate: 'desc' },
          take: 50,
        },
        salaryPayments: {
          orderBy: { paymentDate: 'desc' },
          take: 50,
        },
        users: {
          include: {
            userRoles: {
              include: {
                role: true,
              },
            },
          },
        },
      },
    });
    if (!emp) {
      throw new NotFoundException(`Employee with ID ${id} not found`);
    }
    return emp;
  }

  private async resolveManagerId(managerId?: string | null): Promise<string | null> {
    if (!managerId) return null;
    // 1. Check if managerId is already an Employee ID
    const emp = await this.prisma.employee.findUnique({ where: { id: managerId } });
    if (emp) return emp.id;

    // 2. Check if managerId is a User ID
    const userMgr = await this.prisma.user.findUnique({
      where: { id: managerId },
      include: { userRoles: { include: { role: true } } },
    });
    if (userMgr) {
      if (userMgr.employeeId) {
        return userMgr.employeeId;
      }
      // Auto-provision an Employee record for this manager User to establish hierarchy
      const managerEmp = await this.prisma.employee.create({
        data: {
          id: uuidv7(),
          organizationId: userMgr.organizationId,
          companyId: userMgr.companyId,
          employeeCode: `MGR-${(userMgr.firstName || 'USR').slice(0, 3).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`,
          firstName: userMgr.firstName,
          lastName: userMgr.lastName,
          email: userMgr.email,
          phone: userMgr.phone,
          position: userMgr.userRoles?.[0]?.role?.name || 'Manager / Lead',
          status: 'ACTIVE',
        },
      });
      await this.prisma.user.update({
        where: { id: userMgr.id },
        data: { employeeId: managerEmp.id },
      });
      return managerEmp.id;
    }

    return null;
  }

  async createEmployee(dto: CreateEmployeeDto, actor: { id: string; email?: string }) {
    const existing = await this.prisma.employee.findFirst({
      where: {
        companyId: dto.companyId,
        employeeCode: dto.employeeCode.toUpperCase(),
      },
    });
    if (existing) {
      throw new ConflictException(`Employee code "${dto.employeeCode}" already exists in company`);
    }

    const resolvedManagerId = await this.resolveManagerId(dto.managerId);
    const company = await this.findOneCompany(dto.companyId);
    const empId = uuidv7();

    const created = await this.prisma.employee.create({
      data: {
        id: empId,
        organizationId: dto.organizationId || company.organizationId,
        companyId: dto.companyId,
        departmentId: dto.departmentId || null,
        plantId: dto.plantId || null,
        branchId: dto.branchId || null,
        employeeCode: dto.employeeCode.toUpperCase(),
        firstName: dto.firstName,
        lastName: dto.lastName,
        fatherName: dto.fatherName?.trim() || null,
        cnic: dto.cnic?.trim() || null,
        licenseNumber: dto.licenseNumber?.trim() || null,
        address: dto.address?.trim() || null,
        agencyType: dto.agencyType || 'PERMANENT',
        salary: dto.salary ? Number(dto.salary) : 0,
        phone: dto.phone || null,
        email: dto.email?.toLowerCase() || null,
        position: dto.position || 'Staff',
        joiningDate: dto.joiningDate ? new Date(dto.joiningDate) : new Date(),
        resignationDate: dto.resignationDate ? new Date(dto.resignationDate) : null,
        terminationDate: dto.terminationDate ? new Date(dto.terminationDate) : null,
        status: dto.status || 'ACTIVE',
        managerId: resolvedManagerId,
      },
    });

    // Link User login account if explicitly selected or matching corporate email found
    if (dto.userId) {
      await this.prisma.user.update({
        where: { id: dto.userId },
        data: { employeeId: created.id },
      });
    } else if (created.email) {
      const matchingUser = await this.prisma.user.findFirst({
        where: { email: created.email.toLowerCase(), employeeId: null },
      });
      if (matchingUser) {
        await this.prisma.user.update({
          where: { id: matchingUser.id },
          data: { employeeId: created.id },
        });
      }
    }

    await this.auditService.record({
      organizationId: created.organizationId,
      companyId: dto.companyId,
      actorId: actor.id,
      actorEmail: actor.email,
      resource: 'EMPLOYEE',
      resourceId: created.id,
      action: 'CREATE',
      newState: created as unknown as Record<string, unknown>,
      correlationId: uuidv7(),
    });

    return this.findOneEmployee(created.id);
  }

  async updateEmployee(id: string, dto: UpdateEmployeeDto, actor: { id: string; email?: string }) {
    const previous = await this.findOneEmployee(id);
    const { userId, ...fieldsToUpdate } = dto;

    let resolvedManagerId = previous.managerId;
    if (fieldsToUpdate.managerId !== undefined) {
      resolvedManagerId = await this.resolveManagerId(fieldsToUpdate.managerId);
    }

    const updated = await this.prisma.employee.update({
      where: { id },
      data: {
        ...fieldsToUpdate,
        managerId: resolvedManagerId,
      },
    });

    // Handle user link / unlink
    if (userId !== undefined) {
      if (userId) {
        // Unlink any other user currently linked to this employee
        await this.prisma.user.updateMany({
          where: { employeeId: id, id: { not: userId } },
          data: { employeeId: null },
        });
        // Link target user
        await this.prisma.user.update({
          where: { id: userId },
          data: { employeeId: id },
        });
      } else {
        // Unlink all users from this employee
        await this.prisma.user.updateMany({
          where: { employeeId: id },
          data: { employeeId: null },
        });
      }
    }

    await this.auditService.record({
      organizationId: previous.organizationId,
      companyId: previous.companyId,
      actorId: actor.id,
      actorEmail: actor.email,
      resource: 'EMPLOYEE',
      resourceId: id,
      action: 'UPDATE',
      previousState: previous as unknown as Record<string, unknown>,
      newState: updated as unknown as Record<string, unknown>,
      correlationId: uuidv7(),
    });

    return this.findOneEmployee(id);
  }

  // ==========================================
  // 8. USER MANAGEMENT
  // ==========================================

  async findUsers(organizationId?: string, companyId?: string) {
    const where: any = {};
    if (organizationId) {
      where.organizationId = organizationId;
    }
    if (companyId) {
      where.companyId = companyId;
    }

    return this.prisma.user.findMany({
      where,
      select: {
        id: true,
        organizationId: true,
        companyId: true,
        employeeId: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        status: true,
        lastLoginAt: true,
        createdAt: true,
        company: {
          select: { id: true, code: true, name: true },
        },
        employee: {
          select: { id: true, employeeCode: true, position: true },
        },
        userRoles: {
          include: {
            role: true,
          },
        },
        marketAssignments: {
          where: { status: 'ACTIVE' },
          include: {
            region: { select: { id: true, code: true, name: true } },
            zone: { select: { id: true, code: true, name: true } },
            territory: { select: { id: true, code: true, name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOneUser(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        organization: true,
        company: true,
        employee: true,
        userRoles: {
          include: {
            role: {
              include: {
                rolePermissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
        marketAssignments: {
          include: {
            region: true,
            zone: true,
            territory: true,
          },
        },
      },
    });
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    return user;
  }

  async createUser(dto: CreateUserDto, actor: { id: string; email?: string }) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });
    if (existing) {
      throw new ConflictException(`User with email "${dto.email}" already exists`);
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const userId = uuidv7();

    const orgId = dto.organizationId!;
    const compId = dto.companyId!;

    const created = await this.prisma.user.create({
      data: {
        id: userId,
        organizationId: orgId,
        companyId: compId,
        employeeId: dto.employeeId,
        email: dto.email.toLowerCase(),
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        status: dto.status || 'ACTIVE',
      },
    });

    const rolesToAssign = dto.roleIds && dto.roleIds.length > 0 ? [...dto.roleIds] : (dto.roleId ? [dto.roleId] : []);
    if (rolesToAssign.length === 0) {
      const targetRoleCode = dto.roleCode || 'ROLE_COMPANY_ADMIN';
      let defaultRole = await this.prisma.role.findFirst({
        where: {
          organizationId: orgId,
          code: targetRoleCode,
        },
      });
      if (!defaultRole && targetRoleCode !== 'ROLE_COMPANY_ADMIN') {
        defaultRole = await this.prisma.role.findFirst({
          where: { organizationId: orgId, code: 'ROLE_COMPANY_ADMIN' },
        });
      }
      if (defaultRole) {
        rolesToAssign.push(defaultRole.id);
      }
    }

    if (rolesToAssign.length > 0) {
      await Promise.all(
        rolesToAssign.map((roleId) =>
          this.prisma.userRole.create({
            data: {
              userId: created.id,
              roleId,
              companyId: compId,
            },
          }),
        ),
      );
    }

    if (dto.marketAssignments && dto.marketAssignments.length > 0) {
      await Promise.all(
        dto.marketAssignments.map((ma) =>
          this.prisma.userMarketAssignment.create({
            data: {
              id: uuidv7(),
              organizationId: orgId,
              companyId: ma.companyId || compId,
              userId: created.id,
              employeeId: dto.employeeId || null,
              regionId: ma.regionId || null,
              zoneId: ma.zoneId || null,
              territoryId: ma.territoryId || null,
              roleScope: ma.roleScope || 'SALES_OFFICER',
              isPrimary: ma.isPrimary ?? true,
              effectiveFrom: ma.effectiveFrom ? new Date(ma.effectiveFrom) : new Date(),
              effectiveTo: ma.effectiveTo ? new Date(ma.effectiveTo) : null,
              status: 'ACTIVE',
            },
          }),
        ),
      );
    }

    await this.auditService.record({
      organizationId: orgId,
      companyId: compId,
      actorId: actor.id,
      actorEmail: actor.email,
      resource: 'USER',
      resourceId: created.id,
      action: 'CREATE',
      newState: { id: created.id, email: created.email, firstName: created.firstName, lastName: created.lastName },
      correlationId: uuidv7(),
    });

    return this.findOneUser(created.id);
  }

  async updateUser(id: string, dto: UpdateUserDto, actor: { id: string; email?: string }) {
    const previous = await this.findOneUser(id);

    const updateData: any = {};
    if (dto.firstName) updateData.firstName = dto.firstName;
    if (dto.lastName) updateData.lastName = dto.lastName;
    if (dto.phone !== undefined) updateData.phone = dto.phone;
    if (dto.status) updateData.status = dto.status;
    if (dto.employeeId !== undefined) updateData.employeeId = dto.employeeId || null;
    if ((dto as any).companyId !== undefined) {
      updateData.companyId = (dto as any).companyId;
      await this.prisma.userRole.updateMany({
        where: { userId: id },
        data: { companyId: (dto as any).companyId },
      });
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: updateData,
    });

    const targetRoleIds = dto.roleIds !== undefined ? dto.roleIds : (dto.roleId ? [dto.roleId] : undefined);
    if (targetRoleIds !== undefined) {
      await this.prisma.userRole.deleteMany({
        where: { userId: id },
      });
      if (targetRoleIds.length > 0) {
        await Promise.all(
          targetRoleIds.map((roleId) =>
            this.prisma.userRole.create({
              data: {
                userId: id,
                roleId,
                companyId: (dto as any).companyId || previous.companyId,
              },
            }),
          ),
        );
      }
    }

    if (dto.marketAssignments !== undefined) {
      await this.prisma.userMarketAssignment.deleteMany({
        where: { userId: id },
      });
      if (dto.marketAssignments && dto.marketAssignments.length > 0) {
        await Promise.all(
          dto.marketAssignments.map((ma) =>
            this.prisma.userMarketAssignment.create({
              data: {
                id: uuidv7(),
                organizationId: previous.organizationId,
                companyId: ma.companyId || (dto as any).companyId || previous.companyId,
                userId: id,
                employeeId: dto.employeeId !== undefined ? dto.employeeId : previous.employeeId,
                regionId: ma.regionId || null,
                zoneId: ma.zoneId || null,
                territoryId: ma.territoryId || null,
                roleScope: ma.roleScope || 'SALES_OFFICER',
                isPrimary: ma.isPrimary ?? true,
                effectiveFrom: ma.effectiveFrom ? new Date(ma.effectiveFrom) : new Date(),
                effectiveTo: ma.effectiveTo ? new Date(ma.effectiveTo) : null,
                status: ma.status || 'ACTIVE',
              },
            }),
          ),
        );
      }
    }

    await this.auditService.record({
      organizationId: previous.organizationId,
      companyId: previous.companyId,
      actorId: actor.id,
      actorEmail: actor.email,
      resource: 'USER',
      resourceId: id,
      action: 'UPDATE',
      previousState: { status: previous.status, firstName: previous.firstName, lastName: previous.lastName },
      newState: { status: updated.status, firstName: updated.firstName, lastName: updated.lastName },
      correlationId: uuidv7(),
    });

    return this.findOneUser(id);
  }

  async deleteUser(id: string, actor: { id: string; email?: string }) {
    if (actor.id === id) {
      throw new BadRequestException('Cannot delete your own user account');
    }

    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        userRoles: true,
      },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    await this.prisma.$transaction(async (tx) => {
      // 1. Remove user-owned credentials, roles, and sessions
      await tx.userRole.deleteMany({ where: { userId: id } });
      await tx.userSession.deleteMany({ where: { userId: id } });
      await tx.passwordResetToken.deleteMany({ where: { userId: id } });
      await tx.userNotification.deleteMany({ where: { userId: id } });
      await tx.userMarketAssignment.deleteMany({ where: { userId: id } });
      await tx.salesOfficerDealerAssignment.deleteMany({ where: { userId: id } });

      // 2. Clear foreign key references on geographical and dealer entities
      await tx.region.updateMany({ where: { managerId: id }, data: { managerId: null } });
      await tx.zone.updateMany({ where: { managerId: id }, data: { managerId: null } });
      await tx.territory.updateMany({ where: { managerId: id }, data: { managerId: null } });
      await tx.dealer.updateMany({ where: { assignedFieldOfficerId: id }, data: { assignedFieldOfficerId: null } });
      await tx.dealerAssignmentHistory.updateMany({ where: { salesOfficerId: id }, data: { salesOfficerId: null } });

      // 3. Clear sales order and invoice references if any
      await tx.salesOrder.updateMany({ where: { salesOfficerId: id }, data: { salesOfficerId: null } });
      await tx.salesOrder.updateMany({ where: { areaManagerId: id }, data: { areaManagerId: null } });
      await tx.salesOrder.updateMany({ where: { businessManagerId: id }, data: { businessManagerId: null } });
      await tx.salesInvoice.updateMany({ where: { salesOfficerId: id }, data: { salesOfficerId: null } });
      await tx.salesInvoice.updateMany({ where: { areaManagerId: id }, data: { areaManagerId: null } });
      await tx.salesInvoice.updateMany({ where: { businessManagerId: id }, data: { businessManagerId: null } });
      await tx.dealerPaymentReceipt.updateMany({ where: { salesOfficerId: id }, data: { salesOfficerId: null } });

      // 4. Delete the user
      await tx.user.delete({ where: { id } });
    });

    await this.auditService.record({
      organizationId: user.organizationId,
      companyId: user.companyId,
      actorId: actor.id,
      actorEmail: actor.email,
      resource: 'USER',
      resourceId: id,
      action: 'DELETE',
      previousState: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName },
      newState: null,
      correlationId: uuidv7(),
    });

    return { success: true, message: `User ${user.email} successfully deleted.` };
  }

  // ==========================================
  // 9. ROLE & PERMISSION MANAGEMENT
  // ==========================================

  async findRoles(organizationId?: string) {
    const where: any = {};
    if (organizationId) {
      where.organizationId = organizationId;
    }

    return this.prisma.role.findMany({
      where,
      include: {
        rolePermissions: {
          include: {
            permission: true,
          },
        },
        _count: {
          select: { userRoles: true, rolePermissions: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOneRole(id: string) {
    const role = await this.prisma.role.findUnique({
      where: { id },
      include: {
        rolePermissions: {
          include: {
            permission: true,
          },
        },
        userRoles: {
          include: {
            user: {
              select: { id: true, firstName: true, lastName: true, email: true, status: true },
            },
          },
        },
      },
    });
    if (!role) {
      throw new NotFoundException(`Role with ID ${id} not found`);
    }
    return role;
  }

  async createRole(dto: CreateRoleDto, actor: { id: string; email?: string }) {
    const existing = await this.prisma.role.findFirst({
      where: {
        organizationId: dto.organizationId,
        code: dto.code.toUpperCase(),
      },
    });
    if (existing) {
      throw new ConflictException(`Role with code "${dto.code}" already exists in organization`);
    }

    const roleId = uuidv7();
    const created = await this.prisma.role.create({
      data: {
        id: roleId,
        organizationId: dto.organizationId,
        code: dto.code.toUpperCase(),
        name: dto.name,
        description: dto.description,
      },
    });

    if (dto.permissionIds && dto.permissionIds.length > 0) {
      await Promise.all(
        dto.permissionIds.map((permissionId) =>
          this.prisma.rolePermission.create({
            data: {
              roleId: created.id,
              permissionId,
            },
          }),
        ),
      );
    }

    await this.auditService.record({
      organizationId: dto.organizationId,
      actorId: actor.id,
      actorEmail: actor.email,
      resource: 'ROLE',
      resourceId: created.id,
      action: 'CREATE',
      newState: created as unknown as Record<string, unknown>,
      correlationId: uuidv7(),
    });

    return this.findOneRole(created.id);
  }

  async updateRole(id: string, dto: UpdateRoleDto, actor: { id: string; email?: string }) {
    const previous = await this.findOneRole(id);
    const updated = await this.prisma.role.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
      },
    });

    if (dto.permissionIds !== undefined) {
      await this.prisma.rolePermission.deleteMany({
        where: { roleId: id },
      });
      if (dto.permissionIds.length > 0) {
        await Promise.all(
          dto.permissionIds.map((permissionId) =>
            this.prisma.rolePermission.create({
              data: {
                roleId: id,
                permissionId,
              },
            }),
          ),
        );
      }
    }

    await this.auditService.record({
      organizationId: previous.organizationId,
      actorId: actor.id,
      actorEmail: actor.email,
      resource: 'ROLE',
      resourceId: id,
      action: 'UPDATE',
      previousState: { name: previous.name, description: previous.description },
      newState: { name: updated.name, description: updated.description },
      correlationId: uuidv7(),
    });

    return this.findOneRole(id);
  }

  async findAllPermissions() {
    return this.prisma.permission.findMany({
      orderBy: [{ resource: 'asc' }, { action: 'asc' }],
    });
  }

  // ==========================================
  // PHASE 4.5 — EXPANDED MASTER DATA METHODS
  // ==========================================

  // 10. UNITS OF MEASURE
  async findUoms(organizationId?: string) {
    const where: any = {};
    if (organizationId) where.organizationId = organizationId;
    return this.prisma.unitOfMeasure.findMany({
      where,
      orderBy: [{ category: 'asc' }, { code: 'asc' }],
    });
  }

  async createUom(dto: any, _actor: { id: string; email?: string }) {
    let organizationId = dto.organizationId;
    if (!organizationId) {
      const org = await this.prisma.organization.findFirst();
      organizationId = org?.id;
    }
    let category = (dto.category || dto.type || 'WEIGHT').toUpperCase();
    if (category === 'MASS') category = 'WEIGHT';
    const isBaseUnit = dto.isBaseUnit !== undefined
      ? Boolean(dto.isBaseUnit)
      : (dto.isBase !== undefined ? Boolean(dto.isBase) : false);
    const status = dto.status || (dto.isActive !== undefined ? (dto.isActive ? 'ACTIVE' : 'INACTIVE') : 'ACTIVE');
    const uomCode = (dto.code || dto.symbol || dto.name || `UOM${Math.floor(Math.random() * 9000 + 1000)}`)
      .toUpperCase()
      .trim()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, 10);

    const created = await this.prisma.unitOfMeasure.create({
      data: {
        id: uuidv7(),
        organizationId: organizationId!,
        code: uomCode,
        name: dto.name.trim(),
        category,
        symbol: dto.symbol ? dto.symbol.trim() : null,
        decimalPlaces: dto.decimalPlaces !== undefined ? Number(dto.decimalPlaces) : 3,
        isBaseUnit,
        status,
      },
    });

    // Auto-link standard conversion if TON and KG both exist
    try {
      if (created.code === 'TON') {
        const kg = await this.prisma.unitOfMeasure.findFirst({
          where: { organizationId: created.organizationId, code: 'KG' },
        });
        if (kg) {
          const exists = await this.prisma.uomConversion.findFirst({
            where: { fromUomId: created.id, toUomId: kg.id },
          });
          if (!exists) {
            await this.prisma.uomConversion.create({
              data: {
                id: uuidv7(),
                organizationId: created.organizationId,
                fromUomId: created.id,
                toUomId: kg.id,
                conversionFactor: 1000,
              },
            });
          }
        }
      } else if (created.code === 'KG') {
        const ton = await this.prisma.unitOfMeasure.findFirst({
          where: { organizationId: created.organizationId, code: 'TON' },
        });
        if (ton) {
          const exists = await this.prisma.uomConversion.findFirst({
            where: { fromUomId: ton.id, toUomId: created.id },
          });
          if (!exists) {
            await this.prisma.uomConversion.create({
              data: {
                id: uuidv7(),
                organizationId: created.organizationId,
                fromUomId: ton.id,
                toUomId: created.id,
                conversionFactor: 1000,
              },
            });
          }
        }
      }
    } catch {
      // Non-blocking auto-link
    }

    return created;
  }

  async updateUom(id: string, dto: any, _actor: { id: string; email?: string }) {
    const data: any = {};
    if (dto.code !== undefined) data.code = dto.code.toUpperCase().trim();
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.category !== undefined || dto.type !== undefined) {
      let cat = (dto.category || dto.type).toUpperCase();
      if (cat === 'MASS') cat = 'WEIGHT';
      data.category = cat;
    }
    if (dto.symbol !== undefined) data.symbol = dto.symbol ? dto.symbol.trim() : null;
    if (dto.decimalPlaces !== undefined) data.decimalPlaces = Number(dto.decimalPlaces);
    if (dto.isBaseUnit !== undefined) data.isBaseUnit = Boolean(dto.isBaseUnit);
    else if (dto.isBase !== undefined) data.isBaseUnit = Boolean(dto.isBase);
    if (dto.status !== undefined) data.status = dto.status;
    else if (dto.isActive !== undefined) data.status = dto.isActive ? 'ACTIVE' : 'INACTIVE';

    return this.prisma.unitOfMeasure.update({
      where: { id },
      data,
    });
  }

  async deleteUom(id: string) {
    try {
      return await this.prisma.unitOfMeasure.delete({ where: { id } });
    } catch {
      return await this.prisma.unitOfMeasure.update({
        where: { id },
        data: { status: 'INACTIVE' },
      });
    }
  }

  // 11. UOM CONVERSIONS
  async findUomConversions(organizationId?: string) {
    const where: any = {};
    if (organizationId) where.organizationId = organizationId;
    return this.prisma.uomConversion.findMany({
      where,
      include: {
        fromUom: true,
        toUom: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createUomConversion(dto: any, _actor: { id: string; email?: string }) {
    const factor = Number(dto.conversionFactor ?? dto.factor ?? 1);
    return this.prisma.uomConversion.create({
      data: {
        id: uuidv7(),
        organizationId: dto.organizationId,
        fromUomId: dto.fromUomId,
        toUomId: dto.toUomId,
        conversionFactor: factor,
        rawMaterialId: dto.rawMaterialId || null,
        packingMaterialId: dto.packingMaterialId || null,
        finishedProductId: dto.finishedProductId || null,
      },
      include: {
        fromUom: true,
        toUom: true,
      },
    });
  }

  async deleteUomConversion(id: string) {
    return this.prisma.uomConversion.delete({
      where: { id },
    });
  }

  // 12. MATERIAL CATEGORIES
  async findMaterialCategories(organizationId?: string) {
    const where: any = {};
    if (organizationId) where.organizationId = organizationId;
    return this.prisma.materialCategory.findMany({
      where,
      include: {
        _count: {
          select: { rawMaterials: true, packingMaterials: true },
        },
      },
      orderBy: { code: 'asc' },
    });
  }

  async createMaterialCategory(dto: any, _actor: { id: string; email?: string }) {
    let organizationId = dto.organizationId;
    if (!organizationId) {
      const org = await this.prisma.organization.findFirst();
      organizationId = org?.id;
    }

    let code = (dto.code || '').trim().toUpperCase();
    if (!code || code === 'AUTO') {
      code = await this.codeGen.generateCategoryCode(organizationId!, 'MATERIAL');
    }

    const categoryType = (dto.categoryType || dto.type || 'RAW_MATERIAL').toUpperCase();
    return this.prisma.materialCategory.create({
      data: {
        id: uuidv7(),
        organizationId: organizationId!,
        code,
        name: dto.name.trim(),
        categoryType,
        description: dto.description || null,
        status: dto.status || 'ACTIVE',
      },
    });
  }

  async updateMaterialCategory(id: string, dto: any, _actor: { id: string; email?: string }) {
    const data: any = {};
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.categoryType !== undefined || dto.type !== undefined) {
      data.categoryType = (dto.categoryType || dto.type).toUpperCase();
    }
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.status !== undefined) data.status = dto.status;

    return this.prisma.materialCategory.update({
      where: { id },
      data,
    });
  }

  // 13. RAW MATERIALS (With Sensitive Cost RBAC - Part 33)
  async findRawMaterials(companyId?: string, organizationId?: string, canViewCost = true) {
    const where: any = { deletedAt: null };
    if (companyId && companyId !== 'ALL') where.companyId = companyId;
    if (organizationId) where.organizationId = organizationId;

    const materials = await this.prisma.rawMaterial.findMany({
      where,
      include: {
        category: true,
        baseUom: true,
        purchaseUom: true,
        company: { select: { id: true, name: true, code: true } },
        warehouseStocks: { select: { quantityOnHand: true } },
        purchaseInvoiceItems: {
          select: {
            quantity: true,
            rate: true,
            grossAmount: true,
            netAmount: true,
            packing: true,
          },
          orderBy: { id: 'desc' },
          take: 5,
        },
      },
      orderBy: { materialCode: 'asc' },
    });

    return materials.map((m) => {
      const items = m.purchaseInvoiceItems || [];
      const totalPurchasedQty = items.reduce((sum, it) => sum + Number(it.quantity || 0), 0);
      const totalPurchasedValue = items.reduce((sum, it) => sum + Number(it.netAmount || it.grossAmount || 0), 0);
      const latestItem = items[0];
      const custom = (m.customFields as any) || {};
      const customTotalQty = custom.totalPurchasedVolume ? Number(custom.totalPurchasedVolume) : (custom.packageCount ? Number(custom.packageCount) : 0);
      const customTotalVal = custom.totalPurchaseValue ? Number(custom.totalPurchaseValue) : 0;
      const customBaseCost = custom.costPerBaseUnit ? Number(custom.costPerBaseUnit) : 0;

      const latestRate = latestItem ? Number(latestItem.rate) : Number(m.lastPurchaseCost || m.standardCost || 0);
      const latestPacking = latestItem?.packing || custom.containerType || m.specifications || '';
      const factorMatch = latestPacking ? latestPacking.match(/(\d+(\.\d+)?)\s*(ltr|l|liter|kg|kilo|gm|g|ml)/i) : null;
      const factor = Number(m.purchaseConversionFactor || 0) || (factorMatch ? Number(factorMatch[1]) : 1);
      
      const costPerBaseUnit = customBaseCost > 0 ? customBaseCost : (factor > 1 && latestRate > 0 ? latestRate / factor : latestRate);
      const effectiveTotalPurchasedQty = totalPurchasedQty > 0 ? totalPurchasedQty : customTotalQty;
      const effectiveTotalPurchasedValue = totalPurchasedValue > 0 ? totalPurchasedValue : (customTotalVal > 0 ? customTotalVal : (m.standardCost ? Number(m.standardCost) : 0));
      const totalBulkVolume = effectiveTotalPurchasedQty > 0 && factor > 1 && !custom.totalPurchasedVolume ? effectiveTotalPurchasedQty * factor : (custom.totalPurchasedVolume ? Number(custom.totalPurchasedVolume) : effectiveTotalPurchasedQty);
      const stockOnHand = ((m as any).warehouseStocks || []).reduce((sum: number, s: any) => sum + Number(s.quantityOnHand || 0), 0);
      const availableQuantity = stockOnHand > 0 ? stockOnHand : totalBulkVolume > 0 ? totalBulkVolume : (Number(m.maximumStock) || 100);

      if (!canViewCost) {
        return {
          ...m,
          standardCost: null,
          lastPurchaseCost: null,
          averageCost: null,
          totalPurchasedQty: effectiveTotalPurchasedQty,
          totalPurchasedValue: null,
          unitRate: null,
          costPerBaseUnit: null,
          totalBulkVolume,
          bulkPacking: latestPacking,
          purchaseConversionFactor: factor,
          stockOnHand,
          availableQuantity,
        };
      }

      return {
        ...m,
        totalPurchasedQty: effectiveTotalPurchasedQty,
        totalPurchasedValue: effectiveTotalPurchasedValue,
        unitRate: latestRate,
        costPerBaseUnit: costPerBaseUnit > 0 ? costPerBaseUnit : latestRate,
        totalBulkVolume,
        bulkPacking: latestPacking,
        purchaseConversionFactor: factor,
        stockOnHand,
        availableQuantity,
      };
    });
  }

  async findOneRawMaterial(id: string, canViewCost = true) {
    const material = await this.prisma.rawMaterial.findUnique({
      where: { id },
      include: {
        category: true,
        baseUom: true,
        purchaseUom: true,
        company: true,
        qcSpecifications: { include: { parameters: true } },
      },
    });
    if (!material) throw new NotFoundException(`Raw material with ID ${id} not found`);
    if (!canViewCost) {
      return {
        ...material,
        standardCost: null,
        lastPurchaseCost: null,
        averageCost: null,
      };
    }
    return material;
  }

  async createRawMaterial(dto: any, actor: { id: string; email?: string }) {
    let organizationId = dto.organizationId;
    if (!organizationId) {
      const org = await this.prisma.organization.findFirst();
      organizationId = org?.id;
    }

    let companyId = dto.companyId;
    if (!companyId) {
      const comp = await this.prisma.company.findFirst({
        where: organizationId ? { organizationId } : {},
        orderBy: { isParent: 'desc' },
      });
      companyId = comp?.id;
    }

    let categoryId = dto.categoryId;
    if (categoryId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(categoryId)) {
      const cat = await this.prisma.materialCategory.findFirst({
        where: { code: categoryId },
      });
      if (cat) categoryId = cat.id;
    }

    let baseUomId = dto.baseUomId || dto.uomId;
    if (baseUomId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(baseUomId)) {
      const u = await this.prisma.unitOfMeasure.findFirst({
        where: {
          OR: [
            { code: baseUomId },
            { symbol: baseUomId },
            { name: { equals: baseUomId, mode: 'insensitive' } },
          ],
        },
      });
      if (u) baseUomId = u.id;
    }

    let purchaseUomId = dto.purchaseUomId || dto.alternateUomId || null;
    if (purchaseUomId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(purchaseUomId)) {
      const u = await this.prisma.unitOfMeasure.findFirst({
        where: {
          OR: [
            { code: purchaseUomId },
            { symbol: purchaseUomId },
            { name: { equals: purchaseUomId, mode: 'insensitive' } },
          ],
        },
      });
      if (u) purchaseUomId = u.id;
    }

    let materialCode = (dto.materialCode || dto.code || '').trim().toUpperCase();
    if (!materialCode || materialCode === 'AUTO') {
      materialCode = await this.codeGen.generateCode({
        companyId: companyId!,
        organizationId: organizationId!,
        entityType: 'RAW_MATERIAL',
      });
    }

    const created = await this.prisma.rawMaterial.create({
      data: {
        id: uuidv7(),
        organizationId: organizationId!,
        companyId: companyId!,
        categoryId: categoryId || null,
        baseUomId: baseUomId || null,
        purchaseUomId: purchaseUomId || null,
        materialCode,
        materialName: dto.materialName || dto.name,
        description: dto.description || null,
        grade: dto.grade || null,
        specifications: dto.specifications || null,
        isHazardous: dto.isHazardous !== undefined ? Boolean(dto.isHazardous) : false,
        purchaseConversionFactor: dto.purchaseConversionFactor !== undefined ? Number(dto.purchaseConversionFactor) : 1,
        batchControlled: dto.batchControlled ?? true,
        expiryControlled: dto.expiryControlled ?? false,
        shelfLifeDays: dto.shelfLifeDays !== undefined ? Number(dto.shelfLifeDays) : null,
        qcRequired: dto.qcRequired ?? true,
        minimumStock: dto.minimumStock !== undefined ? Number(dto.minimumStock) : (dto.minStock !== undefined ? Number(dto.minStock) : null),
        maximumStock: dto.maximumStock !== undefined ? Number(dto.maximumStock) : null,
        reorderLevel: dto.reorderLevel !== undefined ? Number(dto.reorderLevel) : (dto.reorderPoint !== undefined ? Number(dto.reorderPoint) : null),
        storageRequirements: dto.storageRequirements || null,
        standardCost: dto.standardCost !== undefined && dto.standardCost !== null && dto.standardCost !== '' ? Number(dto.standardCost) : null,
        lastPurchaseCost: dto.lastPurchaseCost !== undefined && dto.lastPurchaseCost !== null ? Number(dto.lastPurchaseCost) : null,
        hsCode: dto.hsCode || null,
        status: dto.status || (dto.isActive === false ? 'INACTIVE' : 'ACTIVE'),
        approvalStatus: dto.approvalStatus || 'APPROVED',
        customFields: dto.customFields !== undefined ? dto.customFields : null,
      },
      include: { category: true, baseUom: true, purchaseUom: true },
    });

    await this.auditService.record({
      organizationId: organizationId!,
      companyId: companyId!,
      actorId: actor.id,
      actorEmail: actor.email,
      resource: 'RAW_MATERIAL',
      resourceId: created.id,
      action: 'CREATE',
      newState: created as unknown as Record<string, unknown>,
      correlationId: uuidv7(),
    });

    return created;
  }

  async updateRawMaterial(id: string, dto: any, _actor: { id: string; email?: string }) {
    const data: any = {};
    if (dto.materialCode || dto.code) data.materialCode = (dto.materialCode || dto.code).toUpperCase();
    if (dto.materialName || dto.name) data.materialName = dto.materialName || dto.name;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.grade !== undefined) data.grade = dto.grade;
    if (dto.specifications !== undefined) data.specifications = dto.specifications;
    if (dto.isHazardous !== undefined) data.isHazardous = Boolean(dto.isHazardous);
    if (dto.categoryId !== undefined) data.categoryId = dto.categoryId || null;
    if (dto.baseUomId || dto.uomId) data.baseUomId = dto.baseUomId || dto.uomId;
    if (dto.purchaseUomId !== undefined || dto.alternateUomId !== undefined) {
      data.purchaseUomId = dto.purchaseUomId || dto.alternateUomId || null;
    }
    if (dto.purchaseConversionFactor !== undefined) data.purchaseConversionFactor = Number(dto.purchaseConversionFactor);
    if (dto.minimumStock !== undefined) data.minimumStock = Number(dto.minimumStock);
    else if (dto.minStock !== undefined) data.minimumStock = Number(dto.minStock);
    if (dto.maximumStock !== undefined) data.maximumStock = Number(dto.maximumStock);
    if (dto.reorderLevel !== undefined) data.reorderLevel = Number(dto.reorderLevel);
    else if (dto.reorderPoint !== undefined) data.reorderLevel = Number(dto.reorderPoint);
    if (dto.storageRequirements !== undefined) data.storageRequirements = dto.storageRequirements;
    if (dto.standardCost !== undefined) data.standardCost = dto.standardCost !== null && dto.standardCost !== '' ? Number(dto.standardCost) : null;
    if (dto.lastPurchaseCost !== undefined) data.lastPurchaseCost = dto.lastPurchaseCost !== null ? Number(dto.lastPurchaseCost) : null;
    if (dto.hsCode !== undefined) data.hsCode = dto.hsCode;
    if (dto.status !== undefined) data.status = dto.status;
    else if (dto.isActive !== undefined) data.status = dto.isActive ? 'ACTIVE' : 'INACTIVE';
    if (dto.approvalStatus !== undefined) data.approvalStatus = dto.approvalStatus;
    if (dto.customFields !== undefined) data.customFields = dto.customFields;

    return this.prisma.rawMaterial.update({
      where: { id },
      data,
      include: { category: true, baseUom: true, purchaseUom: true },
    });
  }

  async deleteRawMaterial(id: string) {
    try {
      return await this.prisma.rawMaterial.delete({ where: { id } });
    } catch {
      return await this.prisma.rawMaterial.update({
        where: { id },
        data: { deletedAt: new Date(), status: 'INACTIVE' },
      });
    }
  }

  // 14. PACKING MATERIALS
  async findPackingMaterials(companyId?: string, organizationId?: string) {
    const where: any = { deletedAt: null };
    if (companyId && companyId !== 'ALL') where.companyId = companyId;
    if (organizationId) where.organizationId = organizationId;

    return this.prisma.packingMaterial.findMany({
      where,
      include: {
        category: true,
        baseUom: true,
        purchaseUom: true,
        company: { select: { id: true, name: true, code: true } },
      },
      orderBy: { materialCode: 'asc' },
    });
  }

  async findOnePackingMaterial(id: string) {
    const mat = await this.prisma.packingMaterial.findUnique({
      where: { id },
      include: { category: true, baseUom: true, purchaseUom: true, company: true },
    });
    if (!mat) throw new NotFoundException(`Packing material with ID ${id} not found`);
    return mat;
  }

  async createPackingMaterial(dto: any, actor: { id: string; email?: string }) {
    let organizationId = dto.organizationId;
    if (!organizationId) {
      const org = await this.prisma.organization.findFirst();
      organizationId = org?.id;
    }

    let companyId = dto.companyId;
    if (!companyId) {
      const comp = await this.prisma.company.findFirst({
        where: organizationId ? { organizationId } : {},
        orderBy: { isParent: 'desc' },
      });
      companyId = comp?.id;
    }

    let categoryId = dto.categoryId;
    if (categoryId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(categoryId)) {
      const cat = await this.prisma.materialCategory.findFirst({
        where: { code: categoryId },
      });
      if (cat) categoryId = cat.id;
    }

    let baseUomId = dto.baseUomId || dto.uomId;
    if (baseUomId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(baseUomId)) {
      const u = await this.prisma.unitOfMeasure.findFirst({
        where: {
          OR: [
            { code: baseUomId },
            { symbol: baseUomId },
            { name: { equals: baseUomId, mode: 'insensitive' } },
          ],
        },
      });
      if (u) baseUomId = u.id;
    }

    let purchaseUomId = dto.purchaseUomId || dto.alternateUomId || null;
    if (purchaseUomId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(purchaseUomId)) {
      const u = await this.prisma.unitOfMeasure.findFirst({
        where: {
          OR: [
            { code: purchaseUomId },
            { symbol: purchaseUomId },
            { name: { equals: purchaseUomId, mode: 'insensitive' } },
          ],
        },
      });
      if (u) purchaseUomId = u.id;
    }

    let materialCode = (dto.materialCode || dto.code || '').trim().toUpperCase();
    if (!materialCode || materialCode === 'AUTO') {
      materialCode = await this.codeGen.generateCode({
        companyId: companyId!,
        organizationId: organizationId!,
        entityType: 'PACKING_MATERIAL',
      });
    }

    const created = await this.prisma.packingMaterial.create({
      data: {
        id: uuidv7(),
        organizationId: organizationId!,
        companyId: companyId!,
        categoryId: categoryId || null,
        baseUomId: baseUomId || null,
        purchaseUomId: purchaseUomId || null,
        materialCode,
        materialName: dto.materialName || dto.name,
        description: dto.description || null,
        packCompatibility: dto.packCompatibility || dto.packagingType || null,
        batchControlled: dto.batchControlled ?? true,
        minimumStock: dto.minimumStock !== undefined ? Number(dto.minimumStock) : (dto.minStock !== undefined ? Number(dto.minStock) : null),
        maximumStock: dto.maximumStock !== undefined ? Number(dto.maximumStock) : null,
        reorderLevel: dto.reorderLevel !== undefined ? Number(dto.reorderLevel) : (dto.reorderPoint !== undefined ? Number(dto.reorderPoint) : null),
        standardCost: dto.standardCost !== undefined && dto.standardCost !== null && dto.standardCost !== '' ? Number(dto.standardCost) : null,
        lastPurchaseCost: dto.lastPurchaseCost !== undefined && dto.lastPurchaseCost !== null ? Number(dto.lastPurchaseCost) : null,
        status: dto.status || (dto.isActive === false ? 'INACTIVE' : 'ACTIVE'),
        approvalStatus: 'APPROVED',
      },
      include: { category: true, baseUom: true, purchaseUom: true },
    });

    await this.auditService.record({
      organizationId: organizationId!,
      companyId: companyId!,
      actorId: actor.id,
      actorEmail: actor.email,
      resource: 'PACKING_MATERIAL',
      resourceId: created.id,
      action: 'CREATE',
      newState: created as unknown as Record<string, unknown>,
      correlationId: uuidv7(),
    });

    return created;
  }

  async updatePackingMaterial(id: string, dto: any, _actor: { id: string; email?: string }) {
    const data: any = {};
    if (dto.materialCode || dto.code) data.materialCode = (dto.materialCode || dto.code).toUpperCase();
    if (dto.materialName || dto.name) data.materialName = dto.materialName || dto.name;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.packCompatibility || dto.packagingType) data.packCompatibility = dto.packCompatibility || dto.packagingType;
    if (dto.categoryId !== undefined) data.categoryId = dto.categoryId || null;
    if (dto.baseUomId || dto.uomId) data.baseUomId = dto.baseUomId || dto.uomId;
    if (dto.purchaseUomId !== undefined || dto.alternateUomId !== undefined) {
      data.purchaseUomId = dto.purchaseUomId || dto.alternateUomId || null;
    }
    if (dto.minimumStock !== undefined) data.minimumStock = Number(dto.minimumStock);
    else if (dto.minStock !== undefined) data.minimumStock = Number(dto.minStock);
    if (dto.maximumStock !== undefined) data.maximumStock = Number(dto.maximumStock);
    if (dto.reorderLevel !== undefined) data.reorderLevel = Number(dto.reorderLevel);
    else if (dto.reorderPoint !== undefined) data.reorderLevel = Number(dto.reorderPoint);
    if (dto.standardCost !== undefined) data.standardCost = dto.standardCost !== null && dto.standardCost !== '' ? Number(dto.standardCost) : null;
    if (dto.lastPurchaseCost !== undefined) data.lastPurchaseCost = dto.lastPurchaseCost !== null ? Number(dto.lastPurchaseCost) : null;
    if (dto.status !== undefined) data.status = dto.status;
    else if (dto.isActive !== undefined) data.status = dto.isActive ? 'ACTIVE' : 'INACTIVE';

    return this.prisma.packingMaterial.update({
      where: { id },
      data,
      include: { category: true, baseUom: true, purchaseUom: true },
    });
  }

  async deletePackingMaterial(id: string) {
    try {
      return await this.prisma.packingMaterial.delete({ where: { id } });
    } catch {
      return await this.prisma.packingMaterial.update({
        where: { id },
        data: { deletedAt: new Date(), status: 'INACTIVE' },
      });
    }
  }

  // 15. PRODUCT CATEGORIES
  async findProductCategories(organizationId?: string) {
    const where: any = {};
    if (organizationId) where.organizationId = organizationId;
    return this.prisma.productCategory.findMany({
      where,
      include: {
        _count: { select: { finishedProducts: true } },
      },
      orderBy: { code: 'asc' },
    });
  }

  async createProductCategory(dto: any, _actor: { id: string; email?: string }) {
    let organizationId = dto.organizationId;
    if (!organizationId) {
      const org = await this.prisma.organization.findFirst();
      organizationId = org?.id;
    }

    let taxRate = dto.taxRate !== undefined && dto.taxRate !== null && dto.taxRate !== '' ? Number(dto.taxRate) : null;
    if (taxRate === null && dto.taxClassification) {
      const match = String(dto.taxClassification).match(/(\d+(\.\d+)?)%/);
      if (match) taxRate = Number(match[1]);
    }

    let code = (dto.code || '').trim().toUpperCase();
    if (!code || code === 'AUTO') {
      code = await this.codeGen.generateCategoryCode(organizationId!, 'FINISHED_PRODUCT');
    }

    return this.prisma.productCategory.create({
      data: {
        id: uuidv7(),
        organizationId: organizationId!,
        code,
        name: dto.name,
        description: dto.description || null,
        taxClassification: dto.taxClassification || null,
        taxRate,
        status: dto.status || 'ACTIVE',
      },
    });
  }

  async updateProductCategory(id: string, dto: any, _actor: { id: string; email?: string }) {
    const data: any = {};
    if (dto.code) data.code = dto.code.toUpperCase();
    if (dto.name) data.name = dto.name;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.taxClassification !== undefined) {
      data.taxClassification = dto.taxClassification;
      if (dto.taxRate === undefined && dto.taxClassification) {
        const match = String(dto.taxClassification).match(/(\d+(\.\d+)?)%/);
        if (match) data.taxRate = Number(match[1]);
      }
    }
    if (dto.taxRate !== undefined) data.taxRate = dto.taxRate !== null && dto.taxRate !== '' ? Number(dto.taxRate) : null;
    if (dto.status !== undefined) data.status = dto.status;

    return this.prisma.productCategory.update({
      where: { id },
      data,
    });
  }

  // 16. PACK SIZES
  async findPackSizes(organizationId?: string) {
    const where: any = {};
    if (organizationId) where.organizationId = organizationId;
    return this.prisma.packSize.findMany({
      where,
      include: { uom: true },
      orderBy: { quantity: 'asc' },
    });
  }

  async createPackSize(dto: any, _actor: { id: string; email?: string }) {
    let organizationId = dto.organizationId;
    let companyId = dto.companyId;
    if (!organizationId || !companyId) {
      const company = await this.prisma.company.findFirst({ select: { id: true, organizationId: true } });
      organizationId = organizationId || company?.organizationId;
      companyId = companyId || company?.id;
    }

    // Resolve UOM if uomId not provided
    let uomId = dto.uomId;
    let uomName = '';
    if (!uomId && (dto.unit || dto.packingUnit || dto.uom)) {
      const unitStr = String(dto.unit || dto.packingUnit || dto.uom).trim();
      const uom = await this.prisma.unitOfMeasure.findFirst({
        where: {
          OR: [
            { code: { equals: unitStr, mode: 'insensitive' } },
            { symbol: { equals: unitStr, mode: 'insensitive' } },
            { name: { equals: unitStr, mode: 'insensitive' } },
          ],
        },
      });
      if (uom) {
        uomId = uom.id;
        uomName = uom.name;
      }
    } else if (uomId) {
      const uom = await this.prisma.unitOfMeasure.findUnique({ where: { id: uomId } });
      if (uom) uomName = uom.name;
    }

    const quantity = Number(dto.quantity || 1);
    const name = dto.name?.trim() || `${quantity} ${uomName || dto.unit || 'Liter'}`;

    // Check if an existing pack size has exact matching quantity and uomId
    if (organizationId && uomId) {
      const existing = await this.prisma.packSize.findFirst({
        where: { organizationId, quantity, uomId },
        include: { uom: true },
      });
      if (existing) {
        return existing;
      }
    }

    // Auto-generate Pack Size Code (PS-XXXXXX)
    let code = (dto.code || '').trim().toUpperCase();
    if (!code || code === 'AUTO') {
      code = await this.codeGen.generateCode({
        companyId: companyId || '',
        organizationId: organizationId || '',
        entityType: 'PACK_SIZE',
      });
    }

    return this.prisma.packSize.create({
      data: {
        id: uuidv7(),
        organizationId: organizationId!,
        code,
        name,
        quantity,
        uomId: uomId || undefined,
        status: dto.status || 'ACTIVE',
      },
      include: { uom: true },
    });
  }

  async updatePackSize(id: string, dto: any, _actor: { id: string; email?: string }) {
    return this.prisma.packSize.update({
      where: { id },
      data: dto,
      include: { uom: true },
    });
  }

  async deletePackSize(id: string) {
    try {
      return await this.prisma.packSize.delete({ where: { id } });
    } catch {
      return await this.prisma.packSize.update({
        where: { id },
        data: { status: 'INACTIVE' },
      });
    }
  }

  // 17. FINISHED PRODUCTS (With Cost RBAC - Part 33)
  async findFinishedProducts(companyId?: string, organizationId?: string, canViewCost = true) {
    const where: any = { deletedAt: null };
    if (companyId && companyId !== 'ALL') where.companyId = companyId;
    if (organizationId) where.organizationId = organizationId;

    const products = await this.prisma.finishedProduct.findMany({
      where,
      include: {
        category: true,
        packSize: { include: { uom: true } },
        packagingMaterial: true,
        baseUom: true,
        salesUom: true,
        company: { select: { id: true, name: true, code: true } },
        batches: {
          orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
        },
      },
      orderBy: { productCode: 'asc' },
    });

    if (!canViewCost) {
      return products.map((p) => ({
        ...p,
        standardCost: null,
      }));
    }
    return products;
  }

  async findOneFinishedProduct(id: string, canViewCost = true) {
    const product = await this.prisma.finishedProduct.findUnique({
      where: { id },
      include: {
        category: true,
        packSize: { include: { uom: true } },
        packagingMaterial: true,
        baseUom: true,
        salesUom: true,
        company: true,
        formulaBoms: { include: { components: true } },
        qcSpecifications: { include: { parameters: true } },
        batches: {
          orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
        },
      },
    });
    if (!product) throw new NotFoundException(`Finished product with ID ${id} not found`);
    if (!canViewCost) {
      return {
        ...product,
        standardCost: null,
      };
    }
    return product;
  }

  async createFinishedProduct(dto: any, actor: { id: string; email?: string }) {
    let productCode = (dto.productCode || '').trim().toUpperCase();
    if (!productCode || productCode === 'AUTO') {
      productCode = await this.codeGen.generateCode({
        companyId: dto.companyId,
        organizationId: dto.organizationId,
        entityType: 'FINISHED_PRODUCT',
      });
    }

    // Dynamic PackSize resolution
    let packSizeId = dto.packSizeId;
    const qty = dto.packingQuantity !== undefined ? Number(dto.packingQuantity) : (dto.packSizeQuantity !== undefined ? Number(dto.packSizeQuantity) : undefined);
    const unit = dto.packingUnit || dto.packSizeUnit;

    if (!packSizeId && qty !== undefined && unit) {
      const ps = await this.createPackSize({
        organizationId: dto.organizationId,
        companyId: dto.companyId,
        quantity: qty,
        unit,
      }, actor);
      packSizeId = ps.id;
    }

    const created = await this.prisma.finishedProduct.create({
      data: {
        id: uuidv7(),
        organizationId: dto.organizationId,
        companyId: dto.companyId,
        categoryId: dto.categoryId,
        packSizeId,
        baseUomId: dto.baseUomId,
        salesUomId: dto.salesUomId,
        productCode,
        sku: dto.sku,
        productName: dto.productName,
        urduName: dto.urduName,
        brand: dto.brand || 'Shehswar Agro',
        grade: dto.grade || 'Standard',
        productType: dto.productType || 'EC',
        mType: dto.mType || 'Insecticides',
        fertilizerType: dto.fertilizerType,
        productForm: dto.productForm,
        packagingMaterialId: dto.packagingMaterialId,
        packingQuantity: qty,
        packingUnit: unit,
        ppc: dto.ppc ? Number(dto.ppc) : 1,
        bagWeight: dto.bagWeight,
        barcode: dto.barcode,
        batchControlled: dto.batchControlled ?? true,
        expiryControlled: dto.expiryControlled ?? false,
        shelfLifeDays: dto.shelfLifeDays,
        minimumStock: dto.minimumStock,
        reorderLevel: dto.reorderLevel,
        standardCost: dto.standardCost,
        defaultSellingPrice: dto.defaultSellingPrice,
        hsCode: dto.hsCode,
        status: dto.status || 'ACTIVE',
        approvalStatus: 'APPROVED',
      },
      include: {
        category: true,
        packSize: { include: { uom: true } },
        packagingMaterial: true,
        baseUom: true,
      },
    });

    await this.auditService.record({
      organizationId: dto.organizationId,
      companyId: dto.companyId,
      actorId: actor.id,
      actorEmail: actor.email,
      resource: 'FINISHED_PRODUCT',
      resourceId: created.id,
      action: 'CREATE',
      newState: created as unknown as Record<string, unknown>,
      correlationId: uuidv7(),
    });

    return created;
  }

  async updateFinishedProduct(id: string, dto: any, actor: { id: string; email?: string }) {
    const existing = await this.prisma.finishedProduct.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException(`Finished product with ID '${id}' not found`);
    }

    const data: any = {};
    if (dto.productName !== undefined && dto.productName !== null) {
      data.productName = String(dto.productName).trim();
    }
    if (dto.urduName !== undefined) {
      data.urduName = dto.urduName ? String(dto.urduName).trim() : null;
    }
    if (dto.brand !== undefined) {
      data.brand = dto.brand ? String(dto.brand).trim() : null;
    }
    if (dto.grade !== undefined) {
      data.grade = dto.grade ? String(dto.grade).trim() : null;
    }
    if (dto.productType !== undefined) {
      data.productType = dto.productType ? String(dto.productType).trim() : null;
    }
    if (dto.mType !== undefined) {
      data.mType = dto.mType ? String(dto.mType).trim() : null;
    }
    if (dto.fertilizerType !== undefined) {
      data.fertilizerType = dto.fertilizerType ? String(dto.fertilizerType).trim() : null;
    }
    if (dto.productForm !== undefined) {
      data.productForm = dto.productForm ? String(dto.productForm).trim() : null;
    }

    if (dto.categoryId !== undefined) {
      data.categoryId = dto.categoryId && String(dto.categoryId).trim() ? String(dto.categoryId).trim() : null;
    }
    if (dto.packSizeId !== undefined) {
      data.packSizeId = dto.packSizeId && String(dto.packSizeId).trim() ? String(dto.packSizeId).trim() : null;
    }
    if (dto.packagingMaterialId !== undefined) {
      data.packagingMaterialId = dto.packagingMaterialId && String(dto.packagingMaterialId).trim() ? String(dto.packagingMaterialId).trim() : null;
    }
    if (dto.baseUomId !== undefined) {
      data.baseUomId = dto.baseUomId && String(dto.baseUomId).trim() ? String(dto.baseUomId).trim() : null;
    }
    if (dto.salesUomId !== undefined) {
      data.salesUomId = dto.salesUomId && String(dto.salesUomId).trim() ? String(dto.salesUomId).trim() : null;
    }

    if (dto.packingQuantity !== undefined) {
      data.packingQuantity = dto.packingQuantity !== null && dto.packingQuantity !== '' ? Number(dto.packingQuantity) : null;
    }
    if (dto.packingUnit !== undefined) {
      data.packingUnit = dto.packingUnit ? String(dto.packingUnit).trim() : null;
    }
    if (dto.ppc !== undefined) {
      data.ppc = dto.ppc !== null && dto.ppc !== '' ? Number(dto.ppc) : 1;
    }
    if (dto.defaultSellingPrice !== undefined) {
      data.defaultSellingPrice = dto.defaultSellingPrice !== null && dto.defaultSellingPrice !== '' ? Number(dto.defaultSellingPrice) : null;
    }
    if (dto.standardCost !== undefined) {
      data.standardCost = dto.standardCost !== null && dto.standardCost !== '' ? Number(dto.standardCost) : null;
    }
    if (dto.bagWeight !== undefined) {
      data.bagWeight = dto.bagWeight !== null && dto.bagWeight !== '' ? Number(dto.bagWeight) : null;
    }
    if (dto.barcode !== undefined) {
      data.barcode = dto.barcode ? String(dto.barcode).trim() : null;
    }
    if (dto.status !== undefined) {
      data.status = dto.status;
    }
    if (dto.approvalStatus !== undefined) {
      data.approvalStatus = dto.approvalStatus;
    }

    // Safely preserve and store custom fields & description
    const currentCustom = (existing.customFields as Record<string, any>) || {};
    const mergedCustom: Record<string, any> = {
      ...currentCustom,
      ...(dto.customFields && typeof dto.customFields === 'object' ? dto.customFields : {}),
    };
    if (dto.description !== undefined) {
      mergedCustom.description = dto.description ? String(dto.description).trim() : null;
    }
    if (dto.packagingContainer !== undefined) {
      mergedCustom.packagingContainer = dto.packagingContainer !== null && dto.packagingContainer !== '' ? Number(dto.packagingContainer) : null;
    }
    data.customFields = mergedCustom;

    const updated = await this.prisma.finishedProduct.update({
      where: { id },
      data,
      include: {
        category: true,
        packSize: { include: { uom: true } },
        packagingMaterial: true,
        baseUom: true,
        salesUom: true,
        batches: {
          orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
        },
      },
    });

    try {
      await this.auditService.record({
        organizationId: existing.organizationId,
        companyId: existing.companyId,
        actorId: actor?.id || 'system',
        actorEmail: actor?.email,
        resource: 'FINISHED_PRODUCT',
        resourceId: id,
        action: 'UPDATE',
        previousState: existing as unknown as Record<string, unknown>,
        newState: updated as unknown as Record<string, unknown>,
        correlationId: uuidv7(),
      });
    } catch (_) {}

    return updated;
  }

  async deleteFinishedProduct(id: string) {
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.productBatch.deleteMany({ where: { finishedProductId: id } });
        await tx.productCosting.deleteMany({ where: { finishedProductId: id } });
        const boms = await tx.formulaBom.findMany({ where: { finishedProductId: id }, select: { id: true } });
        const bomIds = boms.map((b: any) => b.id);
        if (bomIds.length > 0) {
          await tx.formulaBomComponent.deleteMany({ where: { formulaId: { in: bomIds } } });
          await tx.formulaBom.deleteMany({ where: { id: { in: bomIds } } });
        }
        await tx.rateListItem.deleteMany({ where: { finishedProductId: id } });
        await tx.productRateList.deleteMany({ where: { finishedProductId: id } });
        await tx.qcSpecification.deleteMany({ where: { finishedProductId: id } });
        await tx.warehouseStock.deleteMany({ where: { finishedProductId: id } });
        await tx.finishedProduct.delete({ where: { id } });
      });
      return { success: true };
    } catch {
      return await this.prisma.finishedProduct.update({
        where: { id },
        data: { deletedAt: new Date(), status: 'INACTIVE' },
      });
    }
  }

  async deleteBulkFinishedProducts(ids: string[]) {
    if (!ids || ids.length === 0) return { count: 0, success: true };
    await this.prisma.$transaction(async (tx) => {
      await tx.productBatch.deleteMany({ where: { finishedProductId: { in: ids } } });
      await tx.productCosting.deleteMany({ where: { finishedProductId: { in: ids } } });
      const boms = await tx.formulaBom.findMany({ where: { finishedProductId: { in: ids } }, select: { id: true } });
      const bomIds = boms.map((b: any) => b.id);
      if (bomIds.length > 0) {
        await tx.formulaBomComponent.deleteMany({ where: { formulaId: { in: bomIds } } });
        await tx.formulaBom.deleteMany({ where: { id: { in: bomIds } } });
      }
      await tx.rateListItem.deleteMany({ where: { finishedProductId: { in: ids } } });
      await tx.productRateList.deleteMany({ where: { finishedProductId: { in: ids } } });
      await tx.qcSpecification.deleteMany({ where: { finishedProductId: { in: ids } } });
      await tx.warehouseStock.deleteMany({ where: { finishedProductId: { in: ids } } });
      await tx.finishedProduct.deleteMany({ where: { id: { in: ids } } });
    });
    return { count: ids.length, success: true };
  }

  async deleteAllFinishedProducts(companyId?: string) {
    const where: any = {};
    if (companyId) where.companyId = companyId;
    const prods = await this.prisma.finishedProduct.findMany({ where, select: { id: true } });
    const ids = prods.map((p: any) => p.id);
    return this.deleteBulkFinishedProducts(ids);
  }

  // 17.5. ALL PRODUCTS & ITEMS (Unified Aggregated View - No Duplication)
  async findAllProducts(
    companyId?: string,
    organizationId?: string,
    tab?: string,
    search?: string,
    canViewCost = true,
  ) {
    const activeTab = (tab || 'ALL').toUpperCase();
    const query = (search || '').trim().toLowerCase();

    const fetchRaw = activeTab === 'ALL' || activeTab === 'RAW_MATERIAL' || activeTab === 'RAW_MATERIALS';
    const fetchPacking = activeTab === 'ALL' || activeTab === 'PACKING_MATERIAL' || activeTab === 'PACKING_MATERIALS';
    const fetchFinished = activeTab === 'ALL' || activeTab === 'FINISHED_PRODUCT' || activeTab === 'FINISHED_PRODUCTS';
    const fetchOther = activeTab === 'ALL' || activeTab === 'OTHER' || activeTab === 'OTHERS';

    const [rawMaterials, packingMaterials, finishedProducts] = await Promise.all([
      fetchRaw || fetchOther ? this.findRawMaterials(companyId, organizationId, canViewCost) : Promise.resolve([]),
      fetchPacking || fetchOther ? this.findPackingMaterials(companyId, organizationId) : Promise.resolve([]),
      fetchFinished || fetchOther ? this.findFinishedProducts(companyId, organizationId, canViewCost) : Promise.resolve([]),
    ]);

    const unifiedList: any[] = [];

    // 1. Raw Materials
    for (const rm of rawMaterials as any[]) {
      const isOther = (rm.category?.name || '').toLowerCase().includes('other') || (rm.category?.code || '').toLowerCase().includes('other');
      const itemType = isOther ? 'OTHER' : 'RAW_MATERIAL';
      const itemTypeLabel = isOther ? 'Other Item' : 'Raw Material';
      const baseCost = canViewCost ? Number(rm.costPerBaseUnit ?? rm.unitRate ?? rm.standardCost ?? 0) : null;

      unifiedList.push({
        id: rm.id,
        code: rm.materialCode || rm.code,
        name: rm.materialName || rm.name,
        urduName: rm.urduName || null,
        itemType,
        itemTypeLabel,
        categoryName: rm.category?.name || 'Raw Material',
        categoryCode: rm.category?.code || null,
        categoryId: rm.categoryId || null,
        baseUomName: rm.baseUom?.name || rm.uom?.name || 'KG',
        baseUomSymbol: rm.baseUom?.symbol || rm.baseUom?.code || rm.uom?.symbol || 'KG',
        rate: baseCost,
        standardCost: baseCost,
        sellingPrice: null,
        packSize: rm.bulkPacking || (rm.purchaseConversionFactor && Number(rm.purchaseConversionFactor) > 1 ? `${rm.purchaseConversionFactor} ${rm.baseUom?.symbol || 'KG'}` : 'Bulk'),
        grade: rm.grade || null,
        specifications: rm.specifications || null,
        storageRequirements: rm.storageRequirements || null,
        isHazardous: Boolean(rm.isHazardous),
        batchesCount: 0,
        status: rm.status || (rm.isActive ? 'ACTIVE' : 'INACTIVE'),
        isActive: rm.status === 'ACTIVE' || rm.isActive === true,
        createdAt: rm.createdAt,
        updatedAt: rm.updatedAt,
        rawRecord: rm,
      });
    }

    // 2. Packing Materials
    for (const pm of packingMaterials as any[]) {
      const isOther = (pm.category?.name || '').toLowerCase().includes('other');
      const itemType = isOther ? 'OTHER' : 'PACKING_MATERIAL';
      const itemTypeLabel = isOther ? 'Other Item' : 'Packing Material';
      const pmCost = canViewCost ? Number(pm.lastPurchaseCost ?? pm.standardCost ?? 0) : null;

      unifiedList.push({
        id: pm.id,
        code: pm.materialCode || pm.code,
        name: pm.materialName || pm.name,
        urduName: pm.urduName || null,
        itemType,
        itemTypeLabel,
        categoryName: pm.category?.name || 'Packing Material',
        categoryCode: pm.category?.code || null,
        categoryId: pm.categoryId || null,
        baseUomName: pm.baseUom?.name || pm.uom?.name || 'PCS',
        baseUomSymbol: pm.baseUom?.symbol || pm.baseUom?.code || pm.uom?.symbol || 'PCS',
        rate: pmCost,
        standardCost: pmCost,
        sellingPrice: null,
        packSize: pm.packCompatibility || 'Item',
        grade: null,
        specifications: pm.description || pm.packCompatibility || null,
        storageRequirements: null,
        isHazardous: false,
        batchesCount: 0,
        status: pm.status || (pm.isActive ? 'ACTIVE' : 'INACTIVE'),
        isActive: pm.status === 'ACTIVE' || pm.isActive === true,
        createdAt: pm.createdAt,
        updatedAt: pm.updatedAt,
        rawRecord: pm,
      });
    }

    // 3. Finished Products
    for (const fp of finishedProducts) {
      const packLabel = fp.packSize?.name || (fp.packingQuantity ? `${fp.packingQuantity} ${fp.packingUnit || 'L'}` : null);
      const fpPrice = fp.defaultSellingPrice !== null && fp.defaultSellingPrice !== undefined ? Number(fp.defaultSellingPrice) : null;
      const fpCost = canViewCost && fp.standardCost !== null && fp.standardCost !== undefined ? Number(fp.standardCost) : null;

      unifiedList.push({
        id: fp.id,
        code: fp.productCode,
        name: fp.productName,
        urduName: fp.urduName || null,
        itemType: 'FINISHED_PRODUCT',
        itemTypeLabel: 'Finished Product',
        categoryName: fp.category?.name || fp.productType || 'Finished Goods',
        categoryCode: fp.category?.code || null,
        categoryId: fp.categoryId || null,
        baseUomName: fp.baseUom?.name || fp.packingUnit || 'PCS',
        baseUomSymbol: fp.baseUom?.symbol || fp.baseUom?.code || fp.packingUnit || 'PCS',
        rate: fpPrice,
        standardCost: fpCost,
        sellingPrice: fpPrice,
        packSize: packLabel,
        grade: fp.grade || null,
        specifications: fp.productType ? `${fp.productType} · PPC: ${fp.ppc || 1}` : null,
        storageRequirements: null,
        isHazardous: false,
        batchesCount: Array.isArray(fp.batches) ? fp.batches.length : 0,
        status: fp.status || 'ACTIVE',
        isActive: fp.status === 'ACTIVE',
        createdAt: fp.createdAt,
        updatedAt: fp.updatedAt,
        rawRecord: fp,
      });
    }

    // Tab filter
    let filtered = unifiedList;
    if (activeTab === 'RAW_MATERIAL' || activeTab === 'RAW_MATERIALS') {
      filtered = unifiedList.filter((it) => it.itemType === 'RAW_MATERIAL');
    } else if (activeTab === 'PACKING_MATERIAL' || activeTab === 'PACKING_MATERIALS') {
      filtered = unifiedList.filter((it) => it.itemType === 'PACKING_MATERIAL');
    } else if (activeTab === 'FINISHED_PRODUCT' || activeTab === 'FINISHED_PRODUCTS') {
      filtered = unifiedList.filter((it) => it.itemType === 'FINISHED_PRODUCT');
    } else if (activeTab === 'OTHER' || activeTab === 'OTHERS') {
      filtered = unifiedList.filter((it) => it.itemType === 'OTHER');
    }

    // Search query
    if (query) {
      filtered = filtered.filter((it) => {
        return (
          it.code.toLowerCase().includes(query) ||
          it.name.toLowerCase().includes(query) ||
          (it.urduName && it.urduName.toLowerCase().includes(query)) ||
          it.itemTypeLabel.toLowerCase().includes(query) ||
          (it.categoryName && it.categoryName.toLowerCase().includes(query)) ||
          (it.baseUomName && it.baseUomName.toLowerCase().includes(query)) ||
          (it.baseUomSymbol && it.baseUomSymbol.toLowerCase().includes(query)) ||
          (it.packSize && it.packSize.toLowerCase().includes(query)) ||
          (it.grade && it.grade.toLowerCase().includes(query))
        );
      });
    }

    // Sort by code asc
    filtered.sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true, sensitivity: 'base' }));

    return filtered;
  }

  // 18. WAREHOUSE LOCATIONS (Hierarchy: Zone > Rack > Bin)
  async findWarehouseLocations(warehouseId?: string) {
    const where: any = {};
    if (warehouseId && warehouseId !== 'ALL') where.warehouseId = warehouseId;
    return this.prisma.warehouseLocation.findMany({
      where,
      include: {
        warehouse: { select: { id: true, name: true, code: true } },
        parentLocation: true,
        childLocations: true,
      },
      orderBy: { locationCode: 'asc' },
    });
  }

  async createWarehouseLocation(dto: any, _actor: { id: string; email?: string }) {
    return this.prisma.warehouseLocation.create({
      data: {
        id: uuidv7(),
        warehouseId: dto.warehouseId,
        parentLocationId: dto.parentLocationId,
        locationCode: dto.locationCode.toUpperCase(),
        locationName: dto.locationName,
        locationType: dto.locationType,
        capacity: dto.capacity,
        capacityUom: dto.capacityUom,
        allowedMaterialCategory: dto.allowedMaterialCategory,
        status: 'ACTIVE',
      },
    });
  }

  async updateWarehouseLocation(id: string, dto: any, _actor: { id: string; email?: string }) {
    return this.prisma.warehouseLocation.update({
      where: { id },
      data: dto,
    });
  }

  // 19. PRODUCTION LINES
  async findProductionLines(companyId?: string) {
    const where: any = {};
    if (companyId && companyId !== 'ALL') where.companyId = companyId;
    return this.prisma.productionLine.findMany({
      where,
      include: {
        plant: true,
        capacityUom: true,
      },
      orderBy: { lineCode: 'asc' },
    });
  }

  async createProductionLine(dto: any, _actor: { id: string; email?: string }) {
    return this.prisma.productionLine.create({
      data: {
        id: uuidv7(),
        companyId: dto.companyId,
        plantId: dto.plantId,
        lineCode: dto.lineCode.toUpperCase(),
        lineName: dto.lineName,
        capacity: dto.capacity,
        capacityUomId: dto.capacityUomId,
        productCompatibility: dto.productCompatibility,
        status: 'ACTIVE',
      },
      include: { plant: true, capacityUom: true },
    });
  }

  async updateProductionLine(id: string, dto: any, _actor: { id: string; email?: string }) {
    return this.prisma.productionLine.update({
      where: { id },
      data: dto,
      include: { plant: true, capacityUom: true },
    });
  }

  // 20. SHIFTS
  async findShifts(companyId?: string) {
    const where: any = {};
    if (companyId && companyId !== 'ALL') where.companyId = companyId;
    return this.prisma.shift.findMany({
      where,
      include: { plant: true },
      orderBy: { shiftCode: 'asc' },
    });
  }

  async createShift(dto: any, _actor: { id: string; email?: string }) {
    return this.prisma.shift.create({
      data: {
        id: uuidv7(),
        companyId: dto.companyId,
        plantId: dto.plantId,
        shiftCode: dto.shiftCode.toUpperCase(),
        shiftName: dto.shiftName,
        startTime: dto.startTime,
        endTime: dto.endTime,
        status: 'ACTIVE',
      },
      include: { plant: true },
    });
  }

  async updateShift(id: string, dto: any, _actor: { id: string; email?: string }) {
    return this.prisma.shift.update({
      where: { id },
      data: dto,
      include: { plant: true },
    });
  }

  // 21. QC SPECIFICATIONS
  async findQcSpecifications(companyId?: string, organizationId?: string) {
    const where: any = {};
    if (companyId && companyId !== 'ALL') where.companyId = companyId;
    if (organizationId) where.organizationId = organizationId;
    return this.prisma.qcSpecification.findMany({
      where,
      include: {
        rawMaterial: { select: { id: true, materialCode: true, materialName: true } },
        finishedProduct: { select: { id: true, productCode: true, productName: true } },
        parameters: { orderBy: { sortOrder: 'asc' } },
      },
      orderBy: { code: 'asc' },
    });
  }

  async findOneQcSpecification(id: string) {
    const spec = await this.prisma.qcSpecification.findUnique({
      where: { id },
      include: {
        rawMaterial: true,
        finishedProduct: true,
        parameters: { orderBy: { sortOrder: 'asc' } },
      },
    });
    if (!spec) throw new NotFoundException(`QC Specification with ID ${id} not found`);
    return spec;
  }

  async createQcSpecification(dto: any, _actor: { id: string; email?: string }) {
    let targetOrgId = dto.organizationId;
    let targetCompanyId = dto.companyId;

    if (!targetOrgId || !targetCompanyId) {
      const defaultOrg = await this.prisma.organization.findFirst({ select: { id: true } });
      const defaultComp = await this.prisma.company.findFirst({ select: { id: true } });
      targetOrgId = targetOrgId || defaultOrg?.id;
      targetCompanyId = targetCompanyId || defaultComp?.id;
    }

    let finalFinishedProductId: string | null = null;
    if (dto.finishedProductId && dto.finishedProductId !== '') {
      const fp = await this.prisma.finishedProduct.findFirst({
        where: {
          OR: [{ id: dto.finishedProductId }, { productCode: dto.finishedProductId }],
        },
        select: { id: true },
      });
      finalFinishedProductId = fp ? fp.id : null;
    }

    let finalRawMaterialId: string | null = null;
    if (dto.rawMaterialId && dto.rawMaterialId !== '') {
      const rm = await this.prisma.rawMaterial.findFirst({
        where: {
          OR: [{ id: dto.rawMaterialId }, { materialCode: dto.rawMaterialId }],
        },
        select: { id: true },
      });
      finalRawMaterialId = rm ? rm.id : null;
    }

    // Check if specification with code already exists for company
    const existing = await this.prisma.qcSpecification.findFirst({
      where: {
        companyId: targetCompanyId,
        code: dto.code.toUpperCase(),
      },
    });

    let specId: string;
    if (existing) {
      specId = existing.id;
      await this.prisma.qcSpecification.update({
        where: { id: existing.id },
        data: {
          name: dto.name,
          appliesToType: dto.appliesToType,
          rawMaterialId: finalRawMaterialId,
          finishedProductId: finalFinishedProductId,
          status: 'ACTIVE',
          approvalStatus: 'APPROVED',
        },
      });
      // Clear old parameters to re-add
      await this.prisma.qcParameter.deleteMany({
        where: { specificationId: existing.id },
      });
    } else {
      specId = uuidv7();
      await this.prisma.qcSpecification.create({
        data: {
          id: specId,
          organizationId: targetOrgId,
          companyId: targetCompanyId,
          code: dto.code.toUpperCase(),
          name: dto.name,
          appliesToType: dto.appliesToType,
          rawMaterialId: finalRawMaterialId,
          finishedProductId: finalFinishedProductId,
          version: 1,
          status: 'ACTIVE',
          approvalStatus: 'APPROVED',
        },
      });
    }

    if (dto.parameters && Array.isArray(dto.parameters)) {
      await this.prisma.qcParameter.createMany({
        data: dto.parameters.map((p: any, idx: number) => ({
          id: uuidv7(),
          specificationId: specId,
          parameterName: p.parameterName,
          minimumValue: p.minimumValue !== undefined && p.minimumValue !== '' ? Number(p.minimumValue) : null,
          maximumValue: p.maximumValue !== undefined && p.maximumValue !== '' ? Number(p.maximumValue) : null,
          targetValue: p.targetValue !== undefined && p.targetValue !== '' ? Number(p.targetValue) : null,
          uom: p.uom || null,
          testMethod: p.testMethod || null,
          mandatory: p.mandatory ?? true,
          sortOrder: p.sortOrder ?? idx + 1,
        })),
      });
    }

    return this.findOneQcSpecification(specId);
  }

  async updateQcSpecification(id: string, dto: any, _actor: { id: string; email?: string }) {
    return this.prisma.qcSpecification.update({
      where: { id },
      data: dto,
      include: { parameters: true },
    });
  }

  // 22. FORMULA / BOM FOUNDATION
  async findFormulaBoms(companyId?: string, organizationId?: string) {
    const where: any = {};
    if (companyId && companyId !== 'ALL') where.companyId = companyId;
    if (organizationId) where.organizationId = organizationId;
    return this.prisma.formulaBom.findMany({
      where,
      include: {
        finishedProduct: { select: { id: true, productCode: true, productName: true, standardCost: true } },
        batchSizeUom: true,
        components: {
          include: {
            rawMaterial: { select: { id: true, materialCode: true, materialName: true, standardCost: true } },
            packingMaterial: { select: { id: true, materialCode: true, materialName: true, standardCost: true } },
            uom: true,
          },
          orderBy: { sortOrder: 'asc' },
        },
      },
      orderBy: { formulaCode: 'asc' },
    });
  }

  async findOneFormulaBom(id: string) {
    const bom = await this.prisma.formulaBom.findUnique({
      where: { id },
      include: {
        finishedProduct: true,
        batchSizeUom: true,
        components: {
          include: {
            rawMaterial: true,
            packingMaterial: true,
            uom: true,
          },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });
    if (!bom) throw new NotFoundException(`Formula BOM with ID ${id} not found`);
    return bom;
  }

  async createFormulaBom(dto: any, _actor: { id: string; email?: string }) {
    let organizationId = dto.organizationId;
    if (!organizationId) {
      const org = await this.prisma.organization.findFirst();
      organizationId = org?.id;
    }
    let companyId = dto.companyId;
    if (!companyId) {
      const comp = await this.prisma.company.findFirst({
        where: organizationId ? { organizationId } : {},
        orderBy: { isParent: 'desc' },
      });
      companyId = comp?.id;
    }

    let finishedProductId = dto.finishedProductId;
    if (finishedProductId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(finishedProductId)) {
      const fp = await this.prisma.finishedProduct.findFirst({
        where: { productCode: finishedProductId },
      });
      if (fp) finishedProductId = fp.id;
    }

    let batchSizeUomId = dto.batchSizeUomId;
    if (batchSizeUomId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(batchSizeUomId)) {
      const u = await this.prisma.unitOfMeasure.findFirst({
        where: {
          OR: [
            { code: batchSizeUomId },
            { symbol: batchSizeUomId },
          ],
        },
      });
      if (u) batchSizeUomId = u.id;
    }

    const bomId = uuidv7();
    const created = await this.prisma.formulaBom.create({
      data: {
        id: bomId,
        organizationId: organizationId!,
        companyId: companyId!,
        finishedProductId: finishedProductId!,
        formulaCode: dto.formulaCode.toUpperCase(),
        version: 1,
        standardBatchSize: Number(dto.standardBatchSize) || 1000,
        batchSizeUomId: batchSizeUomId || null,
        notes: dto.notes || null,
        status: 'ACTIVE',
        approvalStatus: 'APPROVED',
      },
    });

    let totalBatchCost = 0;
    const batchSize = Number(dto.standardBatchSize) || 1000;

    if (dto.components && Array.isArray(dto.components)) {
      const componentData: any[] = [];
      for (let idx = 0; idx < dto.components.length; idx++) {
        const c = dto.components[idx];
        let rawMaterialId = c.rawMaterialId;
        if (rawMaterialId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawMaterialId)) {
          const rm = await this.prisma.rawMaterial.findFirst({ where: { materialCode: rawMaterialId } });
          if (rm) rawMaterialId = rm.id;
        }

        let packingMaterialId = c.packingMaterialId;
        if (packingMaterialId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(packingMaterialId)) {
          const pm = await this.prisma.packingMaterial.findFirst({ where: { materialCode: packingMaterialId } });
          if (pm) packingMaterialId = pm.id;
        }

        const qty = Number(c.quantity) || 0;
        const waste = Number(c.expectedWastagePercent) || 0;
        const effectiveQty = qty * (1 + waste / 100);

        if (c.componentType === 'RAW_MATERIAL' && rawMaterialId) {
          const rm = await this.prisma.rawMaterial.findUnique({
            where: { id: rawMaterialId },
            select: { standardCost: true },
          });
          if (rm?.standardCost) {
            totalBatchCost += effectiveQty * Number(rm.standardCost);
          }
        } else if (c.componentType === 'PACKING_MATERIAL' && packingMaterialId) {
          const pm = await this.prisma.packingMaterial.findUnique({
            where: { id: packingMaterialId },
            select: { standardCost: true },
          });
          if (pm?.standardCost) {
            totalBatchCost += effectiveQty * Number(pm.standardCost);
          }
        }

        componentData.push({
          id: uuidv7(),
          formulaId: bomId,
          componentType: c.componentType,
          rawMaterialId: c.componentType === 'RAW_MATERIAL' ? rawMaterialId : null,
          packingMaterialId: c.componentType === 'PACKING_MATERIAL' ? packingMaterialId : null,
          quantity: qty,
          uomId: c.uomId || null,
          expectedWastagePercent: waste,
          notes: c.notes || null,
          sortOrder: c.sortOrder ?? idx + 1,
        });
      }

      await this.prisma.formulaBomComponent.createMany({
        data: componentData,
      });
    }

    if (finishedProductId && totalBatchCost > 0 && batchSize > 0) {
      const unitStandardCost = totalBatchCost / batchSize;
      await this.prisma.finishedProduct.update({
        where: { id: finishedProductId },
        data: {
          standardCost: unitStandardCost,
        },
      });
    }

    return this.findOneFormulaBom(created.id);
  }

  async updateFormulaBom(id: string, dto: any, _actor: { id: string; email?: string }) {
    return this.prisma.formulaBom.update({
      where: { id },
      data: dto,
      include: { components: true },
    });
  }

  // 23. PAYMENT TERMS
  async findPaymentTerms(companyId?: string) {
    const where: any = {};
    if (companyId && companyId !== 'ALL') where.companyId = companyId;
    return this.prisma.paymentTerm.findMany({
      where,
      orderBy: { days: 'asc' },
    });
  }

  async createPaymentTerm(dto: any, _actor: { id: string; email?: string }) {
    return this.prisma.paymentTerm.create({
      data: {
        id: uuidv7(),
        companyId: dto.companyId,
        code: dto.code.toUpperCase(),
        name: dto.name,
        days: dto.days,
        paymentType: dto.paymentType,
        description: dto.description,
        status: 'ACTIVE',
      },
    });
  }

  async updatePaymentTerm(id: string, dto: any, _actor: { id: string; email?: string }) {
    return this.prisma.paymentTerm.update({
      where: { id },
      data: dto,
    });
  }

  // 24. TAX CATEGORIES
  async findTaxCategories(companyId?: string) {
    const where: any = {};
    if (companyId && companyId !== 'ALL') where.companyId = companyId;
    return this.prisma.taxCategory.findMany({
      where,
      orderBy: { code: 'asc' },
    });
  }

  async createTaxCategory(dto: any, _actor: { id: string; email?: string }) {
    return this.prisma.taxCategory.create({
      data: {
        id: uuidv7(),
        companyId: dto.companyId,
        code: dto.code.toUpperCase(),
        name: dto.name,
        rate: dto.rate,
        effectiveFrom: new Date(),
        description: dto.description,
        status: 'ACTIVE',
      },
    });
  }

  async updateTaxCategory(id: string, dto: any, _actor: { id: string; email?: string }) {
    return this.prisma.taxCategory.update({
      where: { id },
      data: dto,
    });
  }

  // 25. INTERCOMPANY PRICING RULES (Sensitive Margin RBAC - Part 33 & 34)
  async findIntercompanyPricingRules(organizationId?: string, canViewPrice = true) {
    if (!canViewPrice) {
      throw new ForbiddenException(
        'Access denied: You do not have permission to view intercompany pricing and parent margin structures',
      );
    }
    const where: any = {};
    if (organizationId) where.organizationId = organizationId;

    return this.prisma.intercompanyPricingRule.findMany({
      where,
      include: {
        sourceCompany: { select: { id: true, code: true, name: true } },
        targetCompany: { select: { id: true, code: true, name: true } },
        finishedProduct: {
          select: {
            id: true,
            productCode: true,
            productName: true,
            standardCost: true,
            defaultSellingPrice: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createIntercompanyPricingRule(dto: any, actor: { id: string; email?: string }) {
    const created = await this.prisma.intercompanyPricingRule.create({
      data: {
        id: uuidv7(),
        organizationId: dto.organizationId,
        sourceCompanyId: dto.sourceCompanyId,
        targetCompanyId: dto.targetCompanyId,
        finishedProductId: dto.finishedProductId,
        productCategoryId: dto.productCategoryId,
        pricingMethod: dto.pricingMethod,
        markupPercent: dto.markupPercent,
        fixedMarkupAmount: dto.fixedMarkupAmount,
        manualApprovedPrice: dto.manualApprovedPrice,
        notes: dto.notes,
        approvalStatus: 'APPROVED',
        status: 'ACTIVE',
      },
      include: {
        sourceCompany: true,
        targetCompany: true,
        finishedProduct: true,
      },
    });

    await this.auditService.record({
      organizationId: dto.organizationId,
      companyId: dto.sourceCompanyId,
      actorId: actor.id,
      actorEmail: actor.email,
      resource: 'INTERCOMPANY_PRICING',
      resourceId: created.id,
      action: 'CREATE',
      newState: created as unknown as Record<string, unknown>,
      correlationId: uuidv7(),
    });

    return created;
  }

  async updateIntercompanyPricingRule(id: string, dto: any, _actor: { id: string; email?: string }) {
    return this.prisma.intercompanyPricingRule.update({
      where: { id },
      data: dto,
      include: { sourceCompany: true, targetCompany: true, finishedProduct: true },
    });
  }

  // 26. REASON CODES
  async findReasonCodes(organizationId?: string, category?: string) {
    const where: any = {};
    if (organizationId) where.organizationId = organizationId;
    if (category) where.category = category;
    return this.prisma.reasonCode.findMany({
      where,
      orderBy: [{ category: 'asc' }, { code: 'asc' }],
    });
  }

  async createReasonCode(dto: any, _actor: { id: string; email?: string }) {
    return this.prisma.reasonCode.create({
      data: {
        id: uuidv7(),
        organizationId: dto.organizationId,
        category: dto.category,
        code: dto.code.toUpperCase(),
        name: dto.name,
        description: dto.description,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async updateReasonCode(id: string, dto: any, _actor: { id: string; email?: string }) {
    return this.prisma.reasonCode.update({
      where: { id },
      data: dto,
    });
  }

  // ==========================================
  // 27. REGION MANAGEMENT
  // ==========================================

  async findRegions(companyId?: string) {
    const where: any = {};
    if (companyId) where.companyId = companyId;
    return this.prisma.region.findMany({
      where,
      include: {
        company: { select: { id: true, code: true, name: true } },
        businessManager: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
        zones: {
          include: {
            areaManager: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
            territories: true,
          },
        },
        _count: { select: { zones: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  async findOneRegion(id: string) {
    const region = await this.prisma.region.findUnique({
      where: { id },
      include: {
        company: true,
        businessManager: true,
        zones: {
          include: {
            areaManager: true,
            territories: {
              include: {
                salesOfficer: true,
                _count: { select: { dealers: true } },
              },
            },
          },
        },
      },
    });
    if (!region) throw new NotFoundException(`Region with ID ${id} not found`);
    return region;
  }

  private async resolveManagerUserId(
    companyId: string,
    organizationId: string,
    managerId?: string,
    managerName?: string,
  ): Promise<string | null> {
    if (managerId && managerId.trim()) return managerId.trim();
    const trimmed = (managerName || '').trim();
    if (!trimmed) return null;

    const parts = trimmed.split(/\s+/);
    const firstName = parts[0];
    const lastName = parts.slice(1).join(' ') || '';

    const existing = await this.prisma.user.findFirst({
      where: {
        organizationId,
        OR: [
          {
            firstName: { equals: firstName, mode: 'insensitive' },
            ...(lastName ? { lastName: { equals: lastName, mode: 'insensitive' } } : {}),
          },
          { firstName: { equals: trimmed, mode: 'insensitive' } },
        ],
      },
    });
    if (existing) return existing.id;

    // Create lightweight User record so they appear in reports & assignments
    const baseSlug = `${firstName}.${lastName || 'mgr'}`.toLowerCase().replace(/[^a-z0-9.]/g, '');
    const randomSuffix = Math.floor(100 + Math.random() * 900);
    const email = `${baseSlug}.${randomSuffix}@shehswar.local`;

    const newUser = await this.prisma.user.create({
      data: {
        id: uuidv7(),
        organizationId,
        companyId,
        firstName: firstName || trimmed || 'Manager',
        lastName: lastName || 'Officer',
        email,
        passwordHash: '$2b$10$epRswT2LzF8pC7vYw8n5UOHf7Wc4r6eD5j6g7k8l9m0n1o2p3q4r5',
        status: 'ACTIVE',
        isActive: true,
      },
    });
    return newUser.id;
  }

  async createRegion(dto: CreateRegionDto, actor: { id: string; email?: string }) {
    const company = await this.prisma.company.findUnique({ where: { id: dto.companyId } });
    if (!company) throw new NotFoundException('Company not found');

    let code = (dto.code || '').trim().toUpperCase();
    if (!code || code === 'AUTO') {
      code = await this.codeGen.generateCode({
        companyId: dto.companyId,
        organizationId: company.organizationId,
        entityType: 'REGION',
      });
    }

    const managerId = await this.resolveManagerUserId(
      dto.companyId,
      company.organizationId,
      dto.managerId,
      dto.managerName,
    );

    const created = await this.prisma.region.create({
      data: {
        id: uuidv7(),
        companyId: dto.companyId,
        code,
        name: dto.name,
        managerId,
        isActive: dto.isActive ?? true,
      },
      include: { company: true, businessManager: true },
    });

    // Auto-create market assignment if manager specified
    if (managerId) {
      await this.prisma.userMarketAssignment.create({
        data: {
          id: uuidv7(),
          organizationId: company.organizationId,
          companyId: dto.companyId,
          userId: managerId,
          regionId: created.id,
          roleScope: 'BUSINESS_MANAGER',
          isPrimary: true,
          status: 'ACTIVE',
        },
      }).catch(() => null);
    }

    await this.auditService.record({
      organizationId: company.organizationId,
      companyId: dto.companyId,
      actorId: actor.id,
      actorEmail: actor.email,
      resource: 'REGION',
      resourceId: created.id,
      action: 'CREATE',
      newState: created as unknown as Record<string, unknown>,
      correlationId: uuidv7(),
    });

    return created;
  }

  async updateRegion(id: string, dto: UpdateRegionDto, actor: { id: string; email?: string }) {
    const previous = await this.findOneRegion(id);
    let managerId = dto.managerId;
    if (!managerId && dto.managerName) {
      managerId = (await this.resolveManagerUserId(
        previous.companyId,
        previous.company.organizationId,
        undefined,
        dto.managerName,
      )) || undefined;
    }

    const updated = await this.prisma.region.update({
      where: { id },
      data: {
        name: dto.name,
        managerId: managerId !== undefined ? (managerId || null) : undefined,
        isActive: dto.isActive,
      },
      include: { company: true, businessManager: true, zones: true },
    });

    // Auto-sync market assignment if manager changed
    if (managerId !== undefined && managerId !== previous.managerId) {
      if (managerId) {
        await this.prisma.userMarketAssignment.create({
          data: {
            id: uuidv7(),
            organizationId: previous.company.organizationId,
            companyId: previous.companyId,
            userId: managerId,
            regionId: id,
            roleScope: 'BUSINESS_MANAGER',
            isPrimary: true,
            status: 'ACTIVE',
          },
        }).catch(() => null);
      }
    }

    await this.auditService.record({
      organizationId: previous.company.organizationId,
      companyId: previous.companyId,
      actorId: actor.id,
      actorEmail: actor.email,
      resource: 'REGION',
      resourceId: id,
      action: 'UPDATE',
      previousState: previous as unknown as Record<string, unknown>,
      newState: updated as unknown as Record<string, unknown>,
      correlationId: uuidv7(),
    });

    return updated;
  }

  async deleteRegion(id: string, actor: { id: string; email?: string }) {
    const region = await this.findOneRegion(id);
    await this.prisma.$transaction(async (tx) => {
      const zones = await tx.zone.findMany({ where: { regionId: id }, select: { id: true } });
      const zoneIds = zones.map((z) => z.id);
      if (zoneIds.length > 0) {
        const territories = await tx.territory.findMany({ where: { zoneId: { in: zoneIds } }, select: { id: true } });
        const territoryIds = territories.map((t) => t.id);
        if (territoryIds.length > 0) {
          await tx.userMarketAssignment.deleteMany({ where: { territoryId: { in: territoryIds } } });
          await tx.dealer.updateMany({ where: { territoryId: { in: territoryIds } }, data: { territoryId: null } });
          await tx.territory.deleteMany({ where: { id: { in: territoryIds } } });
        }
        await tx.userMarketAssignment.deleteMany({ where: { zoneId: { in: zoneIds } } });
        await tx.zone.deleteMany({ where: { id: { in: zoneIds } } });
      }
      await tx.userMarketAssignment.deleteMany({ where: { regionId: id } });
      await tx.region.delete({ where: { id } });
    });
    await this.auditService.record({
      organizationId: region.company.organizationId,
      companyId: region.companyId,
      actorId: actor.id,
      actorEmail: actor.email,
      resource: 'REGION',
      resourceId: id,
      action: 'DELETE',
      previousState: region as unknown as Record<string, unknown>,
      correlationId: uuidv7(),
    });
    return { success: true, message: 'Region deleted successfully' };
  }

  // ==========================================
  // 28. ZONE MANAGEMENT
  // ==========================================

  async findZones(regionId?: string, companyId?: string) {
    const where: any = {};
    if (regionId) where.regionId = regionId;
    if (companyId) where.region = { companyId };
    return this.prisma.zone.findMany({
      where,
      include: {
        region: { include: { company: true, businessManager: true } },
        areaManager: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
        territories: {
          include: {
            salesOfficer: { select: { id: true, firstName: true, lastName: true, email: true } },
            _count: { select: { dealers: true } },
          },
        },
        _count: { select: { territories: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  async findOneZone(id: string) {
    const zone = await this.prisma.zone.findUnique({
      where: { id },
      include: {
        region: { include: { company: true, businessManager: true } },
        areaManager: true,
        territories: {
          include: {
            salesOfficer: true,
            dealers: true,
          },
        },
      },
    });
    if (!zone) throw new NotFoundException(`Zone with ID ${id} not found`);
    return zone;
  }

  async createZone(dto: CreateZoneDto, actor: { id: string; email?: string }) {
    const region = await this.prisma.region.findUnique({
      where: { id: dto.regionId },
      include: { company: true },
    });
    if (!region) throw new NotFoundException('Region not found');

    let code = (dto.code || '').trim().toUpperCase();
    if (!code || code === 'AUTO') {
      code = await this.codeGen.generateCode({
        companyId: region.companyId,
        organizationId: region.company.organizationId,
        entityType: 'ZONE',
      });
    }

    const managerId = await this.resolveManagerUserId(
      region.companyId,
      region.company.organizationId,
      dto.managerId,
      dto.managerName,
    );

    const created = await this.prisma.zone.create({
      data: {
        id: uuidv7(),
        regionId: dto.regionId,
        code,
        name: dto.name,
        managerId,
        isActive: dto.isActive ?? true,
      },
      include: { region: true, areaManager: true },
    });

    if (managerId) {
      await this.prisma.userMarketAssignment.create({
        data: {
          id: uuidv7(),
          organizationId: region.company.organizationId,
          companyId: region.companyId,
          userId: managerId,
          regionId: region.id,
          zoneId: created.id,
          roleScope: 'AREA_MANAGER',
          isPrimary: true,
          status: 'ACTIVE',
        },
      }).catch(() => null);
    }

    await this.auditService.record({
      organizationId: region.company.organizationId,
      companyId: region.companyId,
      actorId: actor.id,
      actorEmail: actor.email,
      resource: 'ZONE',
      resourceId: created.id,
      action: 'CREATE',
      newState: created as unknown as Record<string, unknown>,
      correlationId: uuidv7(),
    });

    return created;
  }

  async updateZone(id: string, dto: UpdateZoneDto, actor: { id: string; email?: string }) {
    const previous = await this.findOneZone(id);
    let managerId = dto.managerId;
    if (!managerId && dto.managerName) {
      managerId = (await this.resolveManagerUserId(
        previous.region.companyId,
        previous.region.company.organizationId,
        undefined,
        dto.managerName,
      )) || undefined;
    }

    const updated = await this.prisma.zone.update({
      where: { id },
      data: {
        name: dto.name,
        managerId: managerId !== undefined ? (managerId || null) : undefined,
        isActive: dto.isActive,
      },
      include: { region: true, areaManager: true, territories: true },
    });

    if (managerId !== undefined && managerId !== previous.managerId) {
      if (managerId) {
        await this.prisma.userMarketAssignment.create({
          data: {
            id: uuidv7(),
            organizationId: previous.region.company.organizationId,
            companyId: previous.region.companyId,
            userId: managerId,
            regionId: previous.regionId,
            zoneId: id,
            roleScope: 'AREA_MANAGER',
            isPrimary: true,
            status: 'ACTIVE',
          },
        }).catch(() => null);
      }
    }

    await this.auditService.record({
      organizationId: previous.region.company.organizationId,
      companyId: previous.region.companyId,
      actorId: actor.id,
      actorEmail: actor.email,
      resource: 'ZONE',
      resourceId: id,
      action: 'UPDATE',
      previousState: previous as unknown as Record<string, unknown>,
      newState: updated as unknown as Record<string, unknown>,
      correlationId: uuidv7(),
    });

    return updated;
  }

  async deleteZone(id: string, actor: { id: string; email?: string }) {
    const zone = await this.findOneZone(id);
    await this.prisma.$transaction(async (tx) => {
      const territories = await tx.territory.findMany({ where: { zoneId: id }, select: { id: true } });
      const territoryIds = territories.map((t) => t.id);
      if (territoryIds.length > 0) {
        await tx.userMarketAssignment.deleteMany({ where: { territoryId: { in: territoryIds } } });
        await tx.dealer.updateMany({ where: { territoryId: { in: territoryIds } }, data: { territoryId: null } });
        await tx.territory.deleteMany({ where: { id: { in: territoryIds } } });
      }
      await tx.userMarketAssignment.deleteMany({ where: { zoneId: id } });
      await tx.zone.delete({ where: { id } });
    });
    await this.auditService.record({
      organizationId: zone.region.company.organizationId,
      companyId: zone.region.companyId,
      actorId: actor.id,
      actorEmail: actor.email,
      resource: 'ZONE',
      resourceId: id,
      action: 'DELETE',
      previousState: zone as unknown as Record<string, unknown>,
      correlationId: uuidv7(),
    });
    return { success: true, message: 'Zone deleted successfully' };
  }

  // ==========================================
  // 29. TERRITORY MANAGEMENT
  // ==========================================

  async findTerritories(zoneId?: string, companyId?: string) {
    const where: any = {};
    if (zoneId) where.zoneId = zoneId;
    if (companyId) where.zone = { region: { companyId } };
    return this.prisma.territory.findMany({
      where,
      include: {
        zone: {
          include: {
            region: {
              include: {
                businessManager: { select: { id: true, firstName: true, lastName: true, phone: true } },
              },
            },
            areaManager: { select: { id: true, firstName: true, lastName: true, phone: true } },
          },
        },
        salesOfficer: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
        dealers: {
          select: { id: true, code: true, name: true, city: true, currentBalance: true, assignedFieldOfficerId: true },
        },
        userMarketAssignments: {
          where: { status: 'ACTIVE' },
          include: {
            user: { select: { id: true, firstName: true, lastName: true, email: true } },
          },
        },
        _count: { select: { dealers: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  async findOneTerritory(id: string) {
    const territory = await this.prisma.territory.findUnique({
      where: { id },
      include: {
        zone: {
          include: {
            region: {
              include: {
                company: true,
                businessManager: true,
              },
            },
            areaManager: true,
          },
        },
        salesOfficer: true,
        dealers: {
          include: {
            assignedOfficer: true,
          },
        },
        userMarketAssignments: {
          include: {
            user: true,
          },
        },
      },
    });
    if (!territory) throw new NotFoundException(`Territory with ID ${id} not found`);
    return territory;
  }

  async createTerritory(dto: CreateTerritoryDto, actor: { id: string; email?: string }) {
    const zone = await this.prisma.zone.findUnique({
      where: { id: dto.zoneId },
      include: { region: { include: { company: true } } },
    });
    if (!zone) throw new NotFoundException('Zone not found');

    let code = (dto.code || '').trim().toUpperCase();
    if (!code || code === 'AUTO') {
      code = await this.codeGen.generateCode({
        companyId: zone.region.companyId,
        organizationId: zone.region.company.organizationId,
        entityType: 'TERRITORY',
      });
    }

    const managerId = await this.resolveManagerUserId(
      zone.region.companyId,
      zone.region.company.organizationId,
      dto.managerId,
      dto.managerName,
    );

    const created = await this.prisma.territory.create({
      data: {
        id: uuidv7(),
        zoneId: dto.zoneId,
        code,
        name: dto.name,
        managerId,
        isActive: dto.isActive ?? true,
      },
      include: { zone: true, salesOfficer: true },
    });

    if (managerId) {
      await this.prisma.userMarketAssignment.create({
        data: {
          id: uuidv7(),
          organizationId: zone.region.company.organizationId,
          companyId: zone.region.companyId,
          userId: managerId,
          regionId: zone.regionId,
          zoneId: zone.id,
          territoryId: created.id,
          roleScope: 'SALES_OFFICER',
          isPrimary: true,
          status: 'ACTIVE',
        },
      }).catch(() => null);
    }

    await this.auditService.record({
      organizationId: zone.region.company.organizationId,
      companyId: zone.region.companyId,
      actorId: actor.id,
      actorEmail: actor.email,
      resource: 'TERRITORY',
      resourceId: created.id,
      action: 'CREATE',
      newState: created as unknown as Record<string, unknown>,
      correlationId: uuidv7(),
    });

    return created;
  }

  async updateTerritory(id: string, dto: UpdateTerritoryDto, actor: { id: string; email?: string }) {
    const previous = await this.findOneTerritory(id);
    let managerId = dto.managerId;
    if (!managerId && dto.managerName) {
      managerId = (await this.resolveManagerUserId(
        previous.zone.region.companyId,
        previous.zone.region.company.organizationId,
        undefined,
        dto.managerName,
      )) || undefined;
    }

    const updated = await this.prisma.territory.update({
      where: { id },
      data: {
        name: dto.name,
        managerId: managerId !== undefined ? (managerId || null) : undefined,
        isActive: dto.isActive,
      },
      include: { zone: true, salesOfficer: true, dealers: true },
    });

    if (managerId !== undefined && managerId !== previous.managerId) {
      if (managerId) {
        await this.prisma.userMarketAssignment.create({
          data: {
            id: uuidv7(),
            organizationId: previous.zone.region.company.organizationId,
            companyId: previous.zone.region.companyId,
            userId: managerId,
            regionId: previous.zone.regionId,
            zoneId: previous.zoneId,
            territoryId: id,
            roleScope: 'SALES_OFFICER',
            isPrimary: true,
            status: 'ACTIVE',
          },
        }).catch(() => null);
      }
    }

    await this.auditService.record({
      organizationId: previous.zone.region.company.organizationId,
      companyId: previous.zone.region.companyId,
      actorId: actor.id,
      actorEmail: actor.email,
      resource: 'TERRITORY',
      resourceId: id,
      action: 'UPDATE',
      previousState: previous as unknown as Record<string, unknown>,
      newState: updated as unknown as Record<string, unknown>,
      correlationId: uuidv7(),
    });

    return updated;
  }

  async deleteTerritory(id: string, actor: { id: string; email?: string }) {
    const territory = await this.findOneTerritory(id);
    await this.prisma.$transaction(async (tx) => {
      await tx.userMarketAssignment.deleteMany({ where: { territoryId: id } });
      await tx.dealer.updateMany({ where: { territoryId: id }, data: { territoryId: null } });
      await tx.territory.delete({ where: { id } });
    });
    await this.auditService.record({
      organizationId: territory.zone.region.company.organizationId,
      companyId: territory.zone.region.companyId,
      actorId: actor.id,
      actorEmail: actor.email,
      resource: 'TERRITORY',
      resourceId: id,
      action: 'DELETE',
      previousState: territory as unknown as Record<string, unknown>,
      correlationId: uuidv7(),
    });
    return { success: true, message: 'Territory deleted successfully' };
  }

  // ==========================================
  // 30. USER MARKET ASSIGNMENTS
  // ==========================================

  async findMarketAssignments(filters: {
    userId?: string;
    employeeId?: string;
    companyId?: string;
    regionId?: string;
    zoneId?: string;
    territoryId?: string;
    status?: string;
  }) {
    const where: any = {};
    if (filters.userId) where.userId = filters.userId;
    if (filters.employeeId) where.employeeId = filters.employeeId;
    if (filters.companyId) where.companyId = filters.companyId;
    if (filters.regionId) where.regionId = filters.regionId;
    if (filters.zoneId) where.zoneId = filters.zoneId;
    if (filters.territoryId) where.territoryId = filters.territoryId;
    if (filters.status) where.status = filters.status;

    return this.prisma.userMarketAssignment.findMany({
      where,
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
        employee: { select: { id: true, employeeCode: true, firstName: true, lastName: true, position: true } },
        region: { select: { id: true, code: true, name: true } },
        zone: { select: { id: true, code: true, name: true } },
        territory: { select: { id: true, code: true, name: true } },
        company: { select: { id: true, code: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createMarketAssignment(dto: CreateMarketAssignmentDto, actor: { id: string; email?: string }) {
    const user = await this.prisma.user.findUnique({
      where: { id: dto.userId },
      include: { company: true },
    });
    if (!user) throw new NotFoundException('User not found');

    const created = await this.prisma.userMarketAssignment.create({
      data: {
        id: uuidv7(),
        organizationId: user.organizationId,
        companyId: dto.companyId || user.companyId,
        userId: dto.userId,
        employeeId: dto.employeeId || user.employeeId,
        regionId: dto.regionId || null,
        zoneId: dto.zoneId || null,
        territoryId: dto.territoryId || null,
        roleScope: dto.roleScope || 'SALES_OFFICER',
        isPrimary: dto.isPrimary ?? true,
        effectiveFrom: dto.effectiveFrom ? new Date(dto.effectiveFrom) : new Date(),
        effectiveTo: dto.effectiveTo ? new Date(dto.effectiveTo) : null,
        status: dto.status || 'ACTIVE',
      },
      include: {
        user: true,
        region: true,
        zone: true,
        territory: true,
      },
    });

    await this.auditService.record({
      organizationId: user.organizationId,
      companyId: user.companyId,
      actorId: actor.id,
      actorEmail: actor.email,
      resource: 'USER_MARKET_ASSIGNMENT',
      resourceId: created.id,
      action: 'CREATE',
      newState: created as unknown as Record<string, unknown>,
      correlationId: uuidv7(),
    });

    return created;
  }

  async updateMarketAssignment(id: string, dto: UpdateMarketAssignmentDto, actor: { id: string; email?: string }) {
    const previous = await this.prisma.userMarketAssignment.findUnique({ where: { id } });
    if (!previous) throw new NotFoundException('Assignment not found');

    const updated = await this.prisma.userMarketAssignment.update({
      where: { id },
      data: {
        regionId: dto.regionId !== undefined ? (dto.regionId || null) : undefined,
        zoneId: dto.zoneId !== undefined ? (dto.zoneId || null) : undefined,
        territoryId: dto.territoryId !== undefined ? (dto.territoryId || null) : undefined,
        roleScope: dto.roleScope,
        isPrimary: dto.isPrimary,
        effectiveFrom: dto.effectiveFrom ? new Date(dto.effectiveFrom) : undefined,
        effectiveTo: dto.effectiveTo !== undefined ? (dto.effectiveTo ? new Date(dto.effectiveTo) : null) : undefined,
        status: dto.status,
      },
      include: {
        user: true,
        region: true,
        zone: true,
        territory: true,
      },
    });

    await this.auditService.record({
      organizationId: previous.organizationId,
      companyId: previous.companyId,
      actorId: actor.id,
      actorEmail: actor.email,
      resource: 'USER_MARKET_ASSIGNMENT',
      resourceId: id,
      action: 'UPDATE',
      previousState: previous as unknown as Record<string, unknown>,
      newState: updated as unknown as Record<string, unknown>,
      correlationId: uuidv7(),
    });

    return updated;
  }

  async deleteMarketAssignment(id: string, actor: { id: string; email?: string }) {
    const previous = await this.prisma.userMarketAssignment.findUnique({ where: { id } });
    if (!previous) throw new NotFoundException('Assignment not found');

    await this.prisma.userMarketAssignment.delete({ where: { id } });

    await this.auditService.record({
      organizationId: previous.organizationId,
      companyId: previous.companyId,
      actorId: actor.id,
      actorEmail: actor.email,
      resource: 'USER_MARKET_ASSIGNMENT',
      resourceId: id,
      action: 'DELETE',
      previousState: previous as unknown as Record<string, unknown>,
      correlationId: uuidv7(),
    });

    return { success: true, message: 'Market assignment deleted' };
  }

  // ==========================================
  // 31. COMPLETE MARKET HIERARCHY TREE
  // ==========================================

  async getMarketHierarchy(companyId?: string) {
    let company: any = null;
    if (companyId) {
      company = await this.prisma.company.findUnique({
        where: { id: companyId },
        select: { id: true, code: true, name: true, isParent: true },
      });
    }
    if (!company) {
      company =
        (await this.prisma.company.findFirst({
          where: { isParent: true },
          select: { id: true, code: true, name: true, isParent: true },
        })) ||
        (await this.prisma.company.findFirst({
          select: { id: true, code: true, name: true, isParent: true },
        }));
    }

    let whereClause: any = { isActive: true };
    if (companyId) {
      const regionCount = await this.prisma.region.count({ where: { companyId, isActive: true } });
      if (regionCount > 0) {
        whereClause.companyId = companyId;
      }
    }

    const regions = await this.prisma.region.findMany({
      where: whereClause,
      include: {
        businessManager: {
          select: { id: true, firstName: true, lastName: true, email: true, phone: true },
        },
        zones: {
          where: { isActive: true },
          include: {
            areaManager: {
              select: { id: true, firstName: true, lastName: true, email: true, phone: true },
            },
            territories: {
              where: { isActive: true },
              include: {
                salesOfficer: {
                  select: { id: true, firstName: true, lastName: true, email: true, phone: true },
                },
                userMarketAssignments: {
                  where: { status: 'ACTIVE' },
                  include: {
                    user: { select: { id: true, firstName: true, lastName: true, email: true } },
                  },
                },
                dealers: {
                  select: {
                    id: true,
                    code: true,
                    name: true,
                    city: true,
                    currentBalance: true,
                    creditLimit: true,
                    assignedFieldOfficerId: true,
                    assignedOfficer: {
                      select: { id: true, firstName: true, lastName: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    return {
      company,
      regions: regions.map((r) => ({
        id: r.id,
        code: r.code,
        name: r.name,
        businessManager: r.businessManager
          ? {
              id: r.businessManager.id,
              name: `${r.businessManager.firstName} ${r.businessManager.lastName}`.trim(),
              email: r.businessManager.email,
              phone: r.businessManager.phone,
            }
          : null,
        zones: r.zones.map((z) => ({
          id: z.id,
          code: z.code,
          name: z.name,
          areaManager: z.areaManager
            ? {
                id: z.areaManager.id,
                name: `${z.areaManager.firstName} ${z.areaManager.lastName}`.trim(),
                email: z.areaManager.email,
                phone: z.areaManager.phone,
              }
            : null,
          territories: z.territories.map((t) => ({
            id: t.id,
            code: t.code,
            name: t.name,
            primarySalesOfficer: t.salesOfficer
              ? {
                  id: t.salesOfficer.id,
                  name: `${t.salesOfficer.firstName} ${t.salesOfficer.lastName}`.trim(),
                  email: t.salesOfficer.email,
                  phone: t.salesOfficer.phone,
                }
              : null,
            assignedOfficers: t.userMarketAssignments.map((uma) => ({
              id: uma.user.id,
              name: `${uma.user.firstName} ${uma.user.lastName}`.trim(),
              email: uma.user.email,
            })),
            dealersCount: t.dealers.length,
            dealers: t.dealers.map((d) => ({
              id: d.id,
              code: d.code,
              name: d.name,
              city: d.city,
              currentBalance: Number(d.currentBalance || 0),
              creditLimit: Number(d.creditLimit || 0),
              responsibleOfficer: d.assignedOfficer
                ? `${d.assignedOfficer.firstName} ${d.assignedOfficer.lastName}`.trim()
                : null,
            })),
          })),
        })),
      })),
    };
  }

  // ==========================================
  // 32. AUTHENTICATED USER CONTEXT RESOLUTION
  // ==========================================

  async getUserContext(userId: string): Promise<UserContextDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        organization: true,
        company: true,
        employee: {
          include: {
            department: true,
            plant: true,
            branch: true,
          },
        },
        userRoles: {
          include: {
            role: {
              include: {
                rolePermissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
        marketAssignments: {
          where: { status: 'ACTIVE' },
          include: {
            region: {
              include: {
                businessManager: { select: { id: true, firstName: true, lastName: true, phone: true } },
              },
            },
            zone: {
              include: {
                areaManager: { select: { id: true, firstName: true, lastName: true, phone: true } },
                region: {
                  include: {
                    businessManager: { select: { id: true, firstName: true, lastName: true, phone: true } },
                  },
                },
              },
            },
            territory: {
              include: {
                zone: {
                  include: {
                    areaManager: { select: { id: true, firstName: true, lastName: true, phone: true } },
                    region: {
                      include: {
                        businessManager: { select: { id: true, firstName: true, lastName: true, phone: true } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException(`User ${userId} not found`);
    }

    const roles: string[] = [];
    const permissionsSet = new Set<string>();
    for (const ur of user.userRoles) {
      roles.push(ur.role.code);
      for (const rp of ur.role.rolePermissions) {
        permissionsSet.add(rp.permission.code);
      }
    }

    const authorizedTerritoryIdsSet = new Set<string>();
    let resolvedBM: { id: string; name: string; phone?: string | null } | null = null;
    let resolvedAM: { id: string; name: string; phone?: string | null } | null = null;

    for (const ma of user.marketAssignments) {
      if (ma.territoryId) {
        authorizedTerritoryIdsSet.add(ma.territoryId);
        if (ma.territory?.zone?.areaManager && !resolvedAM) {
          resolvedAM = {
            id: ma.territory.zone.areaManager.id,
            name: `${ma.territory.zone.areaManager.firstName} ${ma.territory.zone.areaManager.lastName}`.trim(),
            phone: ma.territory.zone.areaManager.phone,
          };
        }
        if (ma.territory?.zone?.region?.businessManager && !resolvedBM) {
          resolvedBM = {
            id: ma.territory.zone.region.businessManager.id,
            name: `${ma.territory.zone.region.businessManager.firstName} ${ma.territory.zone.region.businessManager.lastName}`.trim(),
            phone: ma.territory.zone.region.businessManager.phone,
          };
        }
      }
      if (ma.zoneId) {
        if (ma.zone?.areaManager && !resolvedAM) {
          resolvedAM = {
            id: ma.zone.areaManager.id,
            name: `${ma.zone.areaManager.firstName} ${ma.zone.areaManager.lastName}`.trim(),
            phone: ma.zone.areaManager.phone,
          };
        }
        if (ma.zone?.region?.businessManager && !resolvedBM) {
          resolvedBM = {
            id: ma.zone.region.businessManager.id,
            name: `${ma.zone.region.businessManager.firstName} ${ma.zone.region.businessManager.lastName}`.trim(),
            phone: ma.zone.region.businessManager.phone,
          };
        }
        const zoneTerritories = await this.prisma.territory.findMany({
          where: { zoneId: ma.zoneId, isActive: true },
          select: { id: true },
        });
        zoneTerritories.forEach((t) => authorizedTerritoryIdsSet.add(t.id));
      }
      if (ma.regionId) {
        if (ma.region?.businessManager && !resolvedBM) {
          resolvedBM = {
            id: ma.region.businessManager.id,
            name: `${ma.region.businessManager.firstName} ${ma.region.businessManager.lastName}`.trim(),
            phone: ma.region.businessManager.phone,
          };
        }
        const regionTerritories = await this.prisma.territory.findMany({
          where: { zone: { regionId: ma.regionId }, isActive: true },
          select: { id: true },
        });
        regionTerritories.forEach((t) => authorizedTerritoryIdsSet.add(t.id));
      }
    }

    let authorizedDealers: { id: string }[] = [];
    const isSuperOrAdmin = user.isSuperAdmin || roles.includes('ROLE_SUPER_ADMIN') || roles.includes('ROLE_COMPANY_ADMIN');
    if (isSuperOrAdmin) {
      authorizedDealers = await this.prisma.dealer.findMany({
        where: { companyId: user.companyId },
        select: { id: true },
      });
    } else {
      const terrIds = Array.from(authorizedTerritoryIdsSet);
      authorizedDealers = await this.prisma.dealer.findMany({
        where: {
          companyId: user.companyId,
          OR: [
            ...(terrIds.length > 0 ? [{ territoryId: { in: terrIds } }] : []),
            { assignedFieldOfficerId: user.id },
            { officerAssignments: { some: { userId: user.id } } },
          ],
        },
        select: { id: true },
      });
    }

    return {
      userId: user.id,
      employeeId: user.employeeId,
      employeeCode: user.employee?.employeeCode,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      company: {
        id: user.company.id,
        code: user.company.code,
        name: user.company.name,
        isParent: user.company.isParent,
      },
      department: user.employee?.department ? {
        id: user.employee.department.id,
        code: user.employee.department.code,
        name: user.employee.department.name,
      } : null,
      role: roles[0] || 'USER',
      roles,
      permissions: Array.from(permissionsSet),
      marketAssignments: user.marketAssignments.map((ma) => ({
        id: ma.id,
        roleScope: ma.roleScope,
        isPrimary: ma.isPrimary,
        companyId: ma.companyId,
        regionId: ma.regionId,
        regionName: ma.region?.name,
        zoneId: ma.zoneId,
        zoneName: ma.zone?.name,
        territoryId: ma.territoryId,
        territoryName: ma.territory?.name,
        effectiveFrom: ma.effectiveFrom,
        effectiveTo: ma.effectiveTo,
        status: ma.status,
      })),
      responsibleManagers: {
        businessManager: resolvedBM,
        areaManager: resolvedAM,
      },
      authorizedTerritoryIds: Array.from(authorizedTerritoryIdsSet),
      authorizedDealerIds: authorizedDealers.map((d) => d.id),
    };
  }
}

