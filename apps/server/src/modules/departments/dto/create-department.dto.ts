import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateDepartmentDto {
  @IsString() @IsNotEmpty() name!: string;
  @IsOptional() @IsUUID() parentId?: string;
  @IsOptional() @IsUUID() managerId?: string;
}