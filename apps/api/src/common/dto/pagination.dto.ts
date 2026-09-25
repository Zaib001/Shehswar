/**
 * SHEHSWAR ONE360 - Pagination Query DTO
 */
import { IsOptional, IsInt, Min, Max, IsString, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

export class PaginationDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize: number = 20;

  @IsOptional()
  @IsString()
  sortBy?: string = 'createdAt';

  @IsOptional()
  @IsIn(['asc', 'desc', 'ASC', 'DESC'])
  sortOrder?: 'asc' | 'desc' = 'desc';

  @IsOptional()
  @IsString()
  search?: string;

  get skip(): number {
    return (this.page - 1) * this.pageSize;
  }

  get take(): number {
    return this.pageSize;
  }
}
