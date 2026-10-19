/**
 * SHEHSWAR ONE360 - Master Data DTOs
 */
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsEmail,
  IsUUID,
  ValidateIf,
} from 'class-validator';

// 1. Organization DTOs
export class CreateOrganizationDto {
  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsOptional()
  legalName?: string;

  @IsString()
  @IsOptional()
  taxId?: string;

  @IsString()
  @IsOptional()
  strnId?: string;

  @IsString()
  @IsOptional()
  logoUrl?: string;

  @IsString()
  @IsOptional()
  industry?: string;

  @IsString()
  @IsOptional()
  country?: string;

  @IsString()
  @IsOptional()
  currency?: string;

  @IsString()
  @IsOptional()
  timezone?: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class UpdateOrganizationDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  legalName?: string;

  @IsString()
  @IsOptional()
  taxId?: string;

  @IsString()
  @IsOptional()
  strnId?: string;

  @IsString()
  @IsOptional()
  logoUrl?: string;

  @IsString()
  @IsOptional()
  industry?: string;

  @IsString()
  @IsOptional()
  country?: string;

  @IsString()
  @IsOptional()
  currency?: string;

  @IsString()
  @IsOptional()
  timezone?: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

// 2. Company DTOs
export class CreateCompanyDto {
  @IsUUID()
  @IsOptional()
  organizationId?: string;

  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsOptional()
  legalName?: string;

  @ValidateIf((_, val) => val !== null && val !== undefined && val !== '')
  @IsUUID()
  @IsOptional()
  parentCompanyId?: string | null;

  @IsString()
  @IsOptional()
  companyType?: string; // PARENT_MANUFACTURING, CHILD_COMPANY, TRADING, DISTRIBUTION

  @IsBoolean()
  @IsOptional()
  isParent?: boolean;

  @IsString()
  @IsOptional()
  taxId?: string;

  @IsString()
  @IsOptional()
  currencyCode?: string;

  @ValidateIf((_, val) => val !== null && val !== undefined && val !== '')
  @IsEmail()
  @IsOptional()
  email?: string | null;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsString()
  @IsOptional()
  managerName?: string;

  @ValidateIf((_, val) => val !== null && val !== undefined && val !== '')
  @IsUUID()
  @IsOptional()
  managerUserId?: string | null;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class UpdateCompanyDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  legalName?: string;

  @IsString()
  @IsOptional()
  companyType?: string;

  @IsBoolean()
  @IsOptional()
  isParent?: boolean;

  @ValidateIf((_, val) => val !== null && val !== undefined && val !== '')
  @IsUUID()
  @IsOptional()
  parentCompanyId?: string | null;

  @IsString()
  @IsOptional()
  taxId?: string;

  @IsString()
  @IsOptional()
  currencyCode?: string;

  @ValidateIf((_, val) => val !== null && val !== undefined && val !== '')
  @IsEmail()
  @IsOptional()
  email?: string | null;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsString()
  @IsOptional()
  managerName?: string;

  @ValidateIf((_, val) => val !== null && val !== undefined && val !== '')
  @IsUUID()
  @IsOptional()
  managerUserId?: string | null;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

// 3. Plant DTOs
export class CreatePlantDto {
  @IsUUID()
  @IsNotEmpty()
  companyId!: string;

  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsOptional()
  location?: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsString()
  @IsOptional()
  managerName?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class UpdatePlantDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  location?: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsString()
  @IsOptional()
  managerName?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

// 4. Branch DTOs
export class CreateBranchDto {
  @IsUUID()
  @IsNotEmpty()
  companyId!: string;

  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsString()
  @IsOptional()
  city?: string;

  @IsString()
  @IsOptional()
  regionName?: string;

  @IsString()
  @IsOptional()
  managerName?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class UpdateBranchDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsString()
  @IsOptional()
  city?: string;

  @IsString()
  @IsOptional()
  regionName?: string;

  @IsString()
  @IsOptional()
  managerName?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

// 5. Department DTOs
export class CreateDepartmentDto {
  @IsUUID()
  @IsNotEmpty()
  companyId!: string;

  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsOptional()
  managerName?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class UpdateDepartmentDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  managerName?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

// 6. Warehouse DTOs
export class CreateWarehouseDto {
  @IsUUID()
  @IsNotEmpty()
  companyId!: string;

  @IsUUID()
  @IsOptional()
  plantId?: string;

  @IsUUID()
  @IsOptional()
  branchId?: string;

  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsOptional()
  type?: string; // RAW_MATERIAL, FINISHED_GOODS, TRANSIT, QUARANTINE, PACKING_MATERIAL, RETURNS

  @IsString()
  @IsOptional()
  location?: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsString()
  @IsOptional()
  managerName?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class UpdateWarehouseDto {
  @IsUUID()
  @IsOptional()
  plantId?: string;

  @IsUUID()
  @IsOptional()
  branchId?: string;

  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  type?: string;

  @IsString()
  @IsOptional()
  location?: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsString()
  @IsOptional()
  managerName?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

// 7. User DTOs
export class CreateUserDto {
  @IsUUID()
  @IsOptional()
  organizationId?: string;

  @IsUUID()
  @IsOptional()
  companyId?: string;

  @IsUUID()
  @IsOptional()
  employeeId?: string;

  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @IsString()
  @IsNotEmpty()
  password!: string;

  @IsString()
  @IsNotEmpty()
  firstName!: string;

  @IsString()
  @IsNotEmpty()
  lastName!: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  status?: string; // ACTIVE, INACTIVE, SUSPENDED, LOCKED

  @IsOptional()
  roleIds?: string[];

  @IsOptional()
  roleId?: string;

  @IsString()
  @IsOptional()
  roleCode?: string;

  @IsOptional()
  marketAssignments?: Array<{
    companyId?: string;
    regionId?: string;
    zoneId?: string;
    territoryId?: string;
    roleScope?: string;
    isPrimary?: boolean;
    effectiveFrom?: string | Date;
    effectiveTo?: string | Date;
  }>;
}

export class UpdateUserDto {
  @IsString()
  @IsOptional()
  firstName?: string;

  @IsString()
  @IsOptional()
  lastName?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  status?: string;

  @IsUUID()
  @IsOptional()
  employeeId?: string | null;

  @IsUUID()
  @IsOptional()
  companyId?: string;

  @IsOptional()
  roleIds?: string[];

  @IsOptional()
  roleId?: string;

  @IsOptional()
  marketAssignments?: Array<{
    companyId?: string;
    regionId?: string;
    zoneId?: string;
    territoryId?: string;
    roleScope?: string;
    isPrimary?: boolean;
    effectiveFrom?: string | Date;
    effectiveTo?: string | Date;
    status?: string;
  }>;
}

// 8. Role DTOs
export class CreateRoleDto {
  @IsUUID()
  @IsNotEmpty()
  organizationId!: string;

  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsOptional()
  permissionIds?: string[];
}

export class UpdateRoleDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsOptional()
  permissionIds?: string[];
}

// 9. Employee DTOs
export class CreateEmployeeDto {
  @IsUUID()
  @IsOptional()
  organizationId?: string;

  @IsUUID()
  @IsNotEmpty()
  companyId!: string;

  @IsUUID()
  @IsOptional()
  departmentId?: string;

  @IsUUID()
  @IsOptional()
  plantId?: string;

  @IsUUID()
  @IsOptional()
  branchId?: string;

  @IsString()
  @IsNotEmpty()
  employeeCode!: string;

  @IsString()
  @IsNotEmpty()
  firstName!: string;

  @IsString()
  @IsNotEmpty()
  lastName!: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  fatherName?: string;

  @IsString()
  @IsOptional()
  cnic?: string;

  @IsString()
  @IsOptional()
  licenseNumber?: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsString()
  @IsOptional()
  agencyType?: string;

  @IsOptional()
  salary?: number;

  @IsString()
  @IsOptional()
  position?: string;

  @IsString()
  @IsOptional()
  joiningDate?: string;

  @IsString()
  @IsOptional()
  resignationDate?: string;

  @IsString()
  @IsOptional()
  terminationDate?: string;

  @IsString()
  @IsOptional()
  status?: string; // ACTIVE, RESIGNED, TERMINATED, INACTIVE

  @IsUUID()
  @IsOptional()
  managerId?: string;

  @IsUUID()
  @IsOptional()
  userId?: string;
}

export class UpdateEmployeeDto {
  @IsUUID()
  @IsOptional()
  departmentId?: string;

  @IsUUID()
  @IsOptional()
  plantId?: string;

  @IsUUID()
  @IsOptional()
  branchId?: string;

  @IsString()
  @IsOptional()
  firstName?: string;

  @IsString()
  @IsOptional()
  lastName?: string;

  @IsString()
  @IsOptional()
  fatherName?: string;

  @IsString()
  @IsOptional()
  cnic?: string;

  @IsString()
  @IsOptional()
  licenseNumber?: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsString()
  @IsOptional()
  agencyType?: string;

  @IsOptional()
  salary?: number;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  position?: string;

  @IsString()
  @IsOptional()
  joiningDate?: string;

  @IsString()
  @IsOptional()
  resignationDate?: string;

  @IsString()
  @IsOptional()
  terminationDate?: string;

  @IsString()
  @IsOptional()
  status?: string;

  @IsUUID()
  @IsOptional()
  managerId?: string;

  @IsUUID()
  @IsOptional()
  userId?: string;
}

export * from './phase-4-5.dto';
export * from './market-management.dto';
