import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SystemSetting } from './entities/system-setting.entity';

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
  configured: boolean;
}

const SMTP_KEYS = {
  host: 'smtp.host',
  port: 'smtp.port',
  secure: 'smtp.secure',
  user: 'smtp.user',
  pass: 'smtp.pass',
  from: 'smtp.from'
} as const;

const PUBLIC_BASE_URL_KEY = 'public.baseUrl';

@Injectable()
export class SystemSettingsService {
  private readonly logger = new Logger(SystemSettingsService.name);

  constructor(
    @InjectRepository(SystemSetting) private readonly repo: Repository<SystemSetting>,
    private readonly config: ConfigService
  ) {}

  async remove(key: string): Promise<void> {
    await this.repo.delete({ key });
  }

  async getAll(): Promise<SystemSetting[]> {
    return this.repo.find({ order: { key: 'ASC' } });
  }

  async get(key: string): Promise<string | undefined> {
    const row = await this.repo.findOne({ where: { key } });
    return row?.value;
  }

  async getOrDefault(key: string, fallback: string | undefined): Promise<string | undefined> {
    const row = await this.repo.findOne({ where: { key } });
    if (row !== null) return row.value;
    return fallback;
  }

  async set(key: string, value: string, updatedBy: string | null): Promise<SystemSetting> {
    const existing = await this.repo.findOne({ where: { key } });
    if (existing) {
      existing.value = value;
      existing.updatedBy = updatedBy;
      return this.repo.save(existing);
    }
    return this.repo.save(this.repo.create({ key, value, updatedBy }));
  }

  /** SMTP 配置：以数据库为准，env 作 fallback */
  async getSmtpConfig(): Promise<SmtpConfig> {
    const host = await this.getOrDefault(SMTP_KEYS.host, this.config.get<string>('SMTP_HOST'));
    const portStr = await this.getOrDefault(SMTP_KEYS.port, this.config.get<string>('SMTP_PORT'));
    const secureStr = await this.getOrDefault(SMTP_KEYS.secure, this.config.get<string>('SMTP_SECURE'));
    const user = await this.getOrDefault(SMTP_KEYS.user, this.config.get<string>('SMTP_USER'));
    const pass = await this.getOrDefault(SMTP_KEYS.pass, this.config.get<string>('SMTP_PASS'));
    const fromDefault = user || 'no-reply@example.com';
    const from = await this.getOrDefault(SMTP_KEYS.from, this.config.get<string>('SMTP_FROM') ?? fromDefault);

    const port = Number(portStr ?? '465') || 465;
    const secure = (secureStr ?? 'true').toLowerCase() !== 'false';
    const configured = !!(host && user && pass);

    return { host: host ?? '', port, secure, user: user ?? '', pass: pass ?? '', from: from ?? fromDefault, configured };
  }

  async getPublicBaseUrl(): Promise<string> {
    const raw =
      (await this.getOrDefault(PUBLIC_BASE_URL_KEY, this.config.get<string>('PUBLIC_BASE_URL'))) ??
      'https://localhost:8443';
    // 该值可由管理员在系统设置里填写，末尾斜杠会导致拼接出 `//login` 这类 URL
    return raw.trim().replace(/\/+$/, '');
  }
}
