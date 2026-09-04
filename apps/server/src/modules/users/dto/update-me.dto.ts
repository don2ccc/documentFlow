import { IsEmail, IsOptional, IsString, IsUUID } from 'class-validator';

export class UpdateMeDto {
  @IsOptional() @IsString() employeeNo?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() directSupervisor?: string;
  @IsOptional() @IsUUID() workshopId?: string;
  @IsOptional() @IsString() position?: string;
  @IsOptional() @IsUUID() departmentId?: string;
}
