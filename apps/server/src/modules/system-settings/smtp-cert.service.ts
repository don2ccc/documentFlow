import { Injectable, Logger } from '@nestjs/common';
import * as tls from 'node:tls';
import { SystemSettingsService } from '../core-settings/system-settings.service';

export interface SmtpCertInfo {
  configured: boolean;
  host?: string;
  port?: number;
  secure?: boolean;
  subject?: string;
  issuer?: string;
  validFrom?: string;
  validTo?: string;
  daysRemaining?: number;
  isExpired?: boolean;
  fingerprintSha256?: string;
  ignoreTLSActive?: boolean;
  error?: string;
  checkedAt: string;
}

const IGNORE_TLS_KEY = 'smtp.ignore_tls';
// raven.pulseeng.com 证书 2026-08-13 到期：默认跳过校验，等 IT 续上后再一键关掉
const IGNORE_TLS_DEFAULT = 'true';

@Injectable()
export class SmtpCertService {
  private readonly logger = new Logger(SmtpCertService.name);
  constructor(private readonly settings: SystemSettingsService) {}

  async getIgnoreTLS(): Promise<boolean> {
    const v = await this.settings.getOrDefault(IGNORE_TLS_KEY, IGNORE_TLS_DEFAULT);
    return String(v).toLowerCase() === 'true';
  }

  async setIgnoreTLS(value: boolean): Promise<void> {
    await this.settings.set(IGNORE_TLS_KEY, String(!!value), null);
  }

  async probe(): Promise<SmtpCertInfo> {
    const smtp = await this.settings.getSmtpConfig();
    const ignoreTLSActive = await this.getIgnoreTLS();
    const result: SmtpCertInfo = {
      configured: smtp.configured,
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      ignoreTLSActive,
      checkedAt: new Date().toISOString()
    };
    if (!smtp.configured) {
      result.error = 'SMTP 未配置';
      return result;
    }
    try {
      const cert = await this.fetchCert(smtp.host, smtp.port);
      result.subject = cert.subject;
      result.issuer = cert.issuer;
      result.validFrom = cert.validFrom;
      result.validTo = cert.validTo;
      result.fingerprintSha256 = cert.fingerprintSha256;
      const to = Date.parse(cert.validTo);
      if (!Number.isNaN(to)) {
        result.daysRemaining = Math.floor((to - Date.now()) / 86_400_000);
        result.isExpired = result.daysRemaining < 0;
      }
    } catch (e: any) {
      result.error = e?.message || '探测失败';
    }
    return result;
  }

  private fetchCert(host: string, port: number): Promise<{
    subject: string;
    issuer: string;
    validFrom: string;
    validTo: string;
    fingerprintSha256: string;
  }> {
    return new Promise((resolve, reject) => {
      const sock = tls.connect({
        host,
        port,
        servername: host,
        rejectUnauthorized: false,
        timeout: 8000
      });
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        try { sock.destroy(); } catch { /* ignore */ }
      };
      const timer = setTimeout(() => {
        finish();
        reject(new Error(`SMTP TLS 探测超时（${host}:${port}）`));
      }, 9000);
      sock.once('secureConnect', () => {
        try {
          const c: any = sock.getPeerCertificate(false);
          if (!c || Object.keys(c).length === 0) {
            clearTimeout(timer);
            finish();
            reject(new Error('未取到证书'));
            return;
          }
          clearTimeout(timer);
          const subject = c.subject
            ? Object.entries(c.subject).map(([k, v]) => `${k}=${v}`).join(', ')
            : (c.subjectName || '');
          const issuer = c.issuer
            ? Object.entries(c.issuer).map(([k, v]) => `${k}=${v}`).join(', ')
            : '';
          resolve({
            subject,
            issuer,
            validFrom: c.valid_from,
            validTo: c.valid_to,
            fingerprintSha256: c.fingerprint256 || ''
          });
        } finally {
          finish();
        }
      });
      sock.once('error', (err) => {
        clearTimeout(timer);
        finish();
        reject(err);
      });
    });
  }
}