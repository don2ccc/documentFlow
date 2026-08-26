import { IsArray, IsEmail, IsNotEmpty, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class CreateUserDto {
  @IsString() @IsNotEmpty() username!: string;
  @IsString() @MinLength(8) password!: string;
  @IsString() @IsNotEmpty() name!: string;
  @IsOptional() @IsString() employeeNo?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsUUID() departmentId?: string;
  @IsOptional() @IsArray() @IsUUID('4', { each: true }) roleIds?: string[];
}