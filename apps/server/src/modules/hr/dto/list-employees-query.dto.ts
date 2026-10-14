import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';

export class ListEmployeesQueryDto {
  @IsOptional() @IsString() keyword?: string;
  @IsOptional() @IsString() department?: string;
  @IsOptional() @IsString() workGroup?: string;
  @IsOptional() @IsIn(['true', 'false']) @Transform(({ value }) => String(value)) active?: string;
  @IsOptional() @Type(() => Number) page?: number;
  @IsOptional() @Type(() => Number) pageSize?: number;
}