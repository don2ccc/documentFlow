import { IsArray, IsEmail, IsNotEmpty, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class CreateUserDto {
  @IsString() @IsNotEmpty() username!: string;
  @IsString() @MinLength(8) password!: string;
  @IsString() @IsNotEmpty() name!: string;
  @IsOptional() @IsString() employeeNo?: string;
  @IsEmail({}, { message: '请输入合法邮箱' }) @IsNotEmpty({ message: '邮箱为必填' }) email!: string;
  @IsOptional() @IsString() directSupervisor?: string;
  @IsOptional() @IsUUID() workshopId?: string;
  @IsOptional() @IsString() position?: string;
  @IsOptional() @IsUUID() departmentId?: string;
  @IsOptional() @IsArray() @IsUUID('4', { each: true }) roleIds?: string[];
}
