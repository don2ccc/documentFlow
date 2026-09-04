import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthUser } from '@document-flow/shared';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { SystemSettingsService } from '../core-settings/system-settings.service';
import { MailerService } from '../notifications/mailer.service';
import { UpdateSettingDto, TestEmailDto } from './dto/update-setting.dto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import { APP_VERSION } from '../../version.generated';
const execFile_p = promisify(execFile);


@Controller('system-settings')
export class SystemSettingsController {
  @Get('version')
  version() {
    return APP_VERSION;
  }

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


  @Get('versions')
  @RequirePermission('setting:manage')
  async versions() {
    const { stdout } = await execFile_p('git', [
      '-C', '/opt/documentflow',
      'tag', '--sort=-version:refname',
      '--format', '%(refname:short)|%(objectname:short)|%(taggerdate:iso8601)|%(subject)'
    ]);
    const current = (await execFile_p('git', ['-C', '/opt/documentflow', 'rev-parse', '--short', 'HEAD'])).stdout.trim();
    const lines = stdout.trim().split('\n').filter(Boolean).map((line) => {
      const [tag, sha, date, ...subjectParts] = line.split('|');
      return { tag, sha, date, subject: subjectParts.join('|') || '' };
    });
    return { current, versions: lines };
  }

  @Post('versions/:tag/rollback')
  @RequirePermission('setting:manage')
  rollback(@Param('tag') tag: string) {
    const script = '/opt/documentflow/scripts/rollback.sh';
    execFile_p('bash', [script, tag]).catch((err) => {
      console.error('[rollback] failed', err);
    });
    return { ok: true, message: 'Rollback to ' + tag + ' scheduled. Server will rebuild and restart in a few seconds.' };
  }
}
