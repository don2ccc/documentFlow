import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthUser } from '@document-flow/shared';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { SystemSettingsService } from '../core-settings/system-settings.service';
import { SmtpCertService } from './smtp-cert.service';
import { MailerService } from '../notifications/mailer.service';
import { UpdateSettingDto, TestEmailDto, RenewSslDto } from './dto/update-setting.dto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import { APP_VERSION } from '../../version.generated';
const execFile_p = promisify(execFile);

const SSL_INSPECT_SCRIPT = '/opt/documentflow/scripts/cert-inspect.sh';
const SSL_RENEW_SCRIPT = '/opt/documentflow/scripts/cert-renew.sh';


@Controller('system-settings')
export class SystemSettingsController {
  @Get('version')
  version() {
    return APP_VERSION;
  }

  constructor(
    private readonly settings: SystemSettingsService,
    private readonly mailer: MailerService,
    private readonly smtpCert: SmtpCertService
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
  @Get('smtp-cert')
  @RequirePermission('setting:manage')
  async smtpCertInfo() {
    return this.smtpCert.probe();
  }

  @Put('smtp-cert/ignore-tls')
  @RequirePermission('setting:manage')
  async setSmtpIgnoreTls(@Body() dto: { value: boolean }) {
    await this.smtpCert.setIgnoreTLS(!!dto?.value);
    return { ok: true, ignoreTLS: await this.smtpCert.getIgnoreTLS() };
  }

  @Post('test-email')
  @RequirePermission('setting:manage')
  async testEmail(@Body() dto: TestEmailDto) {
    const ok = await this.mailer.send(
      dto.to,
      'DocumentFlow ????',
      '???????????????????????',
      '<p>???????????????????????</p>'
    );
    return { ok, message: ok ? '???????' : 'SMTP ??????????????????' };
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
    const lines = stdout.trim().split('\n').filter(Boolean);
    const versions = await Promise.all(lines.map(async (line) => {
      const [tag, sha, date, ...subjectParts] = line.split('|');
      const subject = subjectParts.join('|') || '';
      // ?? tag ????? commit SHA?annotated tag ? %(objectname) ? tag object ????? commit?
      let commit = sha;
      try {
        const { stdout: c } = await execFile_p('git', ['-C', '/opt/documentflow', 'rev-parse', '--short', `${tag}^{commit}`]);
        commit = c.trim();
      } catch {}
      return { tag, sha, commit, date, subject };
    }));
    return { current, versions };
  }

  @Post('versions/snapshot')
  @RequirePermission('setting:manage')
  async snapshot() {
    const repo = '/opt/documentflow';
    const { stdout: tagOut } = await execFile_p('git', [
      '-C', repo, 'tag', '--list', '--sort=-version:refname', 'v[0-9]*'
    ]);
    const tags = tagOut.trim().split('\n').filter(Boolean);
    const latest = tags[0] || 'v0.0.0';
    const m = latest.match(/^v(\d+)\.(\d+)\.(\d+)$/);
    if (!m) {
      throw new Error(`Cannot parse latest tag: ${latest}`);
    }
    const next = `v${m[1]}.${m[2]}.${parseInt(m[3], 10) + 1}`;
    try {
      await execFile_p('git', ['-C', repo, 'rev-parse', next]);
      throw new Error(`Tag ${next} already exists`);
    } catch (e: any) {
      if (e?.message?.startsWith('Tag ')) throw e;
    }
    const sha = (await execFile_p('git', ['-C', repo, 'rev-parse', '--short', 'HEAD'])).stdout.trim();
    const subject = (await execFile_p('git', ['-C', repo, 'log', '-1', '--pretty=%s'])).stdout.trim();
    const message = `snapshot: ${next} (${sha}) - ${subject}`;
    await execFile_p('git', ['-C', repo, 'tag', '-a', next, '-m', message]);
    return { ok: true, message: `??????? ${next}`, tag: next, sha };
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

  @Get('ssl/status')
  @RequirePermission('setting:manage')
  async sslStatus() {
    try {
      const { stdout } = await execFile_p('bash', [SSL_INSPECT_SCRIPT], { timeout: 15_000 });
      const line = stdout.trim().split('\n').filter(Boolean).pop() ?? '';
      return JSON.parse(line);
    } catch (e: any) {
      return { exists: false, error: e?.message ?? 'inspect failed' };
    }
  }

  @Post('ssl/renew')
  @RequirePermission('setting:manage')
  async renewSsl(@Body() dto: RenewSslDto, @CurrentUser() user: AuthUser) {
    const env: Record<string, string> = {};
    if (dto.days) env.DAYS = String(dto.days);
    if (dto.country) env.COUNTRY = dto.country;
    if (dto.state) env.STATE = dto.state;
    if (dto.city) env.CITY = dto.city;
    if (dto.organization) env.ORG = dto.organization;
    if (dto.organizationalUnit) env.OU = dto.organizationalUnit;
    if (dto.commonName) env.CN = dto.commonName;

    try {
      const { stdout } = await execFile_p('sudo', ['-n', SSL_RENEW_SCRIPT], {
        env: { ...process.env, ...env },
        timeout: 60_000,
        maxBuffer: 2 * 1024 * 1024
      });
      const line = stdout.trim().split('\n').filter(Boolean).pop() ?? '';
      let result: any = {};
      try { result = JSON.parse(line); } catch { /* keep empty */ }
      return {
        ok: true,
        message: '????????nginx ???',
        requestedBy: user?.username ?? user?.id ?? null,
        ...result,
        log: stdout
      };
    } catch (e: any) {
      const stderr = e?.stderr ?? '';
      const stdout = e?.stdout ?? '';
      return {
        ok: false,
        error: e?.message ?? 'renew failed',
        stderr,
        stdout
      };
    }
  }
}
