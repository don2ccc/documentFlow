import { IsEmail, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

export class RegisterDto {
  @IsString() @IsNotEmpty({ message: '请输入用户名' })
  @MinLength(3, { message: '用户名至少 3 位' })
  username!: string;

  @IsString() @IsNotEmpty({ message: '请输入密码' })
  @MinLength(8, { message: '密码至少 8 位' })
  password!: string;

  @IsString() @IsNotEmpty({ message: '请输入姓名' })
  name!: string;

  @IsEmail({}, { message: '请输入合法邮箱' })
  @IsNotEmpty({ message: '邮箱为必填' })
  email!: string;

  @IsOptional() @IsString() employeeNo?: string;
  @IsOptional() @IsString() directSupervisor?: string;
  @IsOptional() @IsString() productionLine?: string;
  @IsOptional() @IsString() position?: string;
}