import { IsArray, IsEmail, IsOptional, IsString, IsUUID } from 'class-validator';

export class UpdateUserDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() employeeNo?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() directSupervisor?: string;
  @IsOptional() @IsUUID() workshopId?: string;
  @IsOptional() @IsString() position?: string;
  @IsOptional() @IsUUID() departmentId?: string;
  @IsOptional() @IsArray() @IsUUID('4', { each: true }) roleIds?: string[];
}
