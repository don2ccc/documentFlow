import { IsEmail, IsOptional, IsString, IsUUID } from 'class-validator';

export class UpdateMeDto {
  @IsOptional() @IsString() employeeNo?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() directSupervisor?: string;
  @IsOptional() @IsString() productionLine?: string;
  @IsOptional() @IsString() position?: string;
  @IsOptional() @IsUUID() departmentId?: string;
}