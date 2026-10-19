/**
 * SHEHSWAR ONE360 - Market Management & User Assignment DTOs
 */
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsUUID,
} from 'class-validator';

export class CreateRegionDto {
  @IsUUID()
  @IsNotEmpty()
  companyId!: string;

  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsUUID()
  @IsOptional()
  managerId?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class UpdateRegionDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsUUID()
  @IsOptional()
  managerId?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class CreateZoneDto {
  @IsUUID()
  @IsNotEmpty()
  regionId!: string;

  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsUUID()
  @IsOptional()
  managerId?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class UpdateZoneDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsUUID()
  @IsOptional()
  managerId?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class CreateTerritoryDto {
  @IsUUID()
  @IsNotEmpty()
  zoneId!: string;

  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsUUID()
  @IsOptional()
  managerId?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class UpdateTerritoryDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsUUID()
  @IsOptional()
  managerId?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class CreateMarketAssignmentDto {
  @IsUUID()
  @IsNotEmpty()
  userId!: string;

  @IsUUID()
  @IsOptional()
  employeeId?: string;

  @IsUUID()
  @IsNotEmpty()
  companyId!: string;

  @IsUUID()
  @IsOptional()
  regionId?: string;

  @IsUUID()
  @IsOptional()
  zoneId?: string;

  @IsUUID()
  @IsOptional()
  territoryId?: string;

  @IsString()
  @IsOptional()
  roleScope?: string; // BUSINESS_MANAGER, AREA_MANAGER, SALES_OFFICER

  @IsBoolean()
  @IsOptional()
  isPrimary?: boolean;

  @IsOptional()
  effectiveFrom?: string | Date;

  @IsOptional()
  effectiveTo?: string | Date;

  @IsString()
  @IsOptional()
  status?: string;
}

export class UpdateMarketAssignmentDto {
  @IsUUID()
  @IsOptional()
  regionId?: string;

  @IsUUID()
  @IsOptional()
  zoneId?: string;

  @IsUUID()
  @IsOptional()
  territoryId?: string;

  @IsString()
  @IsOptional()
  roleScope?: string;

  @IsBoolean()
  @IsOptional()
  isPrimary?: boolean;

  @IsOptional()
  effectiveFrom?: string | Date;

  @IsOptional()
  effectiveTo?: string | Date;

  @IsString()
  @IsOptional()
  status?: string;
}
