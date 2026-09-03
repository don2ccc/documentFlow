import { IsEmail, IsNotEmpty } from 'class-validator';

export class ForgotPasswordDto {
  @IsEmail({}, { message: '请输入合法的邮箱地址' })
  @IsNotEmpty({ message: '请输入邮箱' })
  email!: string;
}