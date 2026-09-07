import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { SystemSettingsService } from '../core-settings/system-settings.service';

export interface MailAttachment {
  filename: string;
  path?: string;
  content?: Buffer;
  encoding?: string;
  cid?: string;
}

@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);

  constructor(private readonly settings: SystemSettingsService) {}

  async send(to: string | string[], subject: string, text: string, html?: string): Promise<boolean> {
    return this.sendWithAttachments(to, subject, text, html, []);
  }

  async sendWithAttachments(
    to: string | string[],
    subject: string,
    text: string,
    html: string | undefined,
    attachments: MailAttachment[]
  ): Promise<boolean> {
    const recipients = Array.isArray(to) ? to : [to];
    const smtp = await this.settings.getSmtpConfig();
    if (!smtp.configured) {
      const attNames = attachments.map((a) => a.filename).join(',');
      this.logger.log(`[mail-disabled] to=${recipients.join(',')} subject="${subject}" attachments=[${attNames}] body=${text.slice(0, 120)}`);
      return false;
    }
    const transporter = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      auth: { user: smtp.user, pass: smtp.pass }
    });
    const validAttachments = attachments.filter((a) => {
      if (a.path) {
        try { require('fs').accessSync(a.path); return true; } catch { return false; }
      }
      return !!a.content;
    });
    try {
      const info = await transporter.sendMail({
        from: smtp.from,
        to: recipients.join(','),
        subject,
        text,
        html: html ?? `<p>${text}</p>`,
        attachments: validAttachments.length > 0 ? validAttachments : undefined
      });
      this.logger.log(`email sent to=${recipients.join(',')} attachments=${validAttachments.length} messageId=${info.messageId}`);
      return true;
    } catch (err: any) {
      this.logger.error(`email send failed to=${recipients.join(',')} err=${err?.message ?? err}`);
      return false;
    }
  }
}
