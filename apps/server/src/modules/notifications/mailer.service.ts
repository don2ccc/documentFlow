import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { SystemSettingsService } from '../core-settings/system-settings.service';

@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);

  constructor(private readonly settings: SystemSettingsService) {}

  async send(to: string | string[], subject: string, text: string, html?: string): Promise<boolean> {
    const recipients = Array.isArray(to) ? to : [to];
    const smtp = await this.settings.getSmtpConfig();
    if (!smtp.configured) {
      this.logger.log(`[mail-disabled] to=${recipients.join(',')} subject="${subject}" body=${text.slice(0, 120)}`);
      return false;
    }
    const transporter = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      auth: { user: smtp.user, pass: smtp.pass }
    });
    try {
      const info = await transporter.sendMail({
        from: smtp.from,
        to: recipients.join(','),
        subject,
        text,
        html: html ?? `<p>${text}</p>`
      });
      this.logger.log(`email sent to=${recipients.join(',')} messageId=${info.messageId}`);
      return true;
    } catch (err: any) {
      this.logger.error(`email send failed to=${recipients.join(',')} err=${err?.message ?? err}`);
      return false;
    }
  }
}
