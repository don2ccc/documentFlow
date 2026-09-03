import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthUser } from '@document-flow/shared';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { SystemSettingsService } from '../core-settings/system-settings.service';
import { MailerService } from '../notifications/mailer.service';
import { UpdateSettingDto, TestEmailDto } from './dto/update-setting.dto';

@Controller('system-settings')
export class SystemSettingsController {
  constructor(
    private readonly settings: SystemSettingsService,
    private readonly mailer: MailerService
  ) {}

  @Get()
  @RequirePermission('setting:manage')
  list() {
    return this.settings.getAll();
  }

  @Put(':key')
  @RequirePermission('setting:manage')
  async update(@Param('key') key: string, @Body() dto: UpdateSettingDto, @CurrentUser() user: AuthUser) {
    const row = await this.settings.set(key, dto.value, user?.id ?? null);
    return row;
  }


  @Delete(':key')
  @RequirePermission('setting:manage')
  async remove(@Param('key') key: string) {
    await this.settings.remove(key);
    return { ok: true };
  }
  @Post('test-email')
  @RequirePermission('setting:manage')
  async testEmail(@Body() dto: TestEmailDto) {
    const ok = await this.mailer.send(
      dto.to,
      'DocumentFlow 邮件测试',
      '这是一封测试邮件，说明系统通知邮件已配置成功。',
      '<p>这是一封测试邮件，说明系统通知邮件已配置成功。</p>'
    );
    return { ok, message: ok ? '测试邮件已发送' : 'SMTP 未配置或发送失败（请查看服务器日志）' };
  }
}
