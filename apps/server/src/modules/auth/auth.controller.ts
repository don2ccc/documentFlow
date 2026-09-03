import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { PasswordResetService } from './password-reset.service';
import { ChangeOwnPasswordDto } from './dto/change-own-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/require-permission.decorator';
import { AuthUser } from '@document-flow/shared';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly users: UsersService,
    private readonly passwordReset: PasswordResetService
  ) {}

  @Public()
  @Post('login')
  @HttpCode(200)
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto.username, dto.password);
  }

  @Post('change-password')
  changePassword(@CurrentUser() user: AuthUser, @Body() dto: ChangeOwnPasswordDto) {
    return this.users.changeOwnPassword(user.id, dto.newPassword);
  }

  // 找回密码：发送验证码（公开）
  @Public()
  @Post('forgot-password')
  @HttpCode(200)
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.passwordReset.requestCode(dto.email);
  }

  // 找回密码：验证码 + 新密码（公开）
  @Public()
  @Post('reset-password')
  @HttpCode(200)
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.passwordReset.resetPassword(dto.email, dto.code, dto.newPassword);
  }

  // 新用户注册（公开，提交后账号为待激活状态，需管理员审批）
  @Public()
  @Post('register')
  @HttpCode(200)
  async register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }
}