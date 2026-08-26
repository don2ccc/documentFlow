import { ArrayNotEmpty, IsArray, IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';

export class CreateRoleDto {
  @IsString() @IsNotEmpty() name!: string;
  @IsString() @Matches(/^[a-z_][a-z0-9_]*$/, { message: '编码只能包含小写字母、数字和下划线' }) code!: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsArray() @ArrayNotEmpty() permissionCodes?: string[];
}