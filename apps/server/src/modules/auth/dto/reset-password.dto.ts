import { IsEmail, IsNotEmpty, IsString, Length, Matches, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @IsEmail({}, { message: '请输入合法的邮箱地址' })
  @IsNotEmpty({ message: '请输入邮箱' })
  email!: string;

  @IsString()
  @IsNotEmpty({ message: '请输入验证码' })
  @Length(6, 6, { message: '验证码为 6 位数字' })
  @Matches(/^\d{6}$/, { message: '验证码为 6 位数字' })
  code!: string;

  @IsString()
  @MinLength(8, { message: '新密码至少 8 位' })
  newPassword!: string;
}