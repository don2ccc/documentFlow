import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { PasswordResetCode } from './entities/password-reset-code.entity';
import { MailerService } from '../notifications/mailer.service';

const CODE_TTL_MIN = 10;

@Injectable()
export class PasswordResetService {
  private readonly logger = new Logger(PasswordResetService.name);

  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(PasswordResetCode) private readonly codeRepo: Repository<PasswordResetCode>,
    private readonly mailer: MailerService
  ) {}

  // 发送验证码：邮箱不存在也返回 ok，避免泄露账号
  async requestCode(rawEmail: string): Promise<{ ok: true }> {
    const email = rawEmail.trim().toLowerCase();
    const user = await this.userRepo.findOne({ where: { email } });
    if (!user) {
      this.logger.log(`forgot-password request for unknown email ${email}`);
      return { ok: true };
    }
    // 让之前未使用的验证码失效，避免被滥用
    await this.codeRepo.update({ userId: user.id, used: false }, { used: true });
    const code = String(Math.floor(Math.random() * 1_000_000)).padStart(6, '0');
    const codeHash = await bcrypt.hash(code, 10);
    await this.codeRepo.save(
      this.codeRepo.create({
        userId: user.id,
        codeHash,
        expiresAt: new Date(Date.now() + CODE_TTL_MIN * 60_000)
      })
    );
    const text = `您正在重置「${user.username}」的登录密码，验证码：${code}（${CODE_TTL_MIN} 分钟内有效）。如果不是您本人操作，请忽略本邮件。`;
    const html = `<p>${text}</p>`;
    const sent = await this.mailer.send(email, '【文档审批系统】密码重置验证码', text, html);
    this.logger.log(`forgot-password code sent to=${email} ok=${sent}`);
    return { ok: true };
  }

  async resetPassword(email: string, code: string, newPassword: string): Promise<{ ok: true }> {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await this.userRepo.findOne({ where: { email: normalizedEmail } });
    if (!user) throw new BadRequestException('验证码无效或已过期');
    const record = await this.codeRepo.findOne({
      where: { userId: user.id, used: false },
      order: { createdAt: 'DESC' }
    });
    if (!record || record.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException('验证码无效或已过期');
    }
    const ok = await bcrypt.compare(code, record.codeHash);
    if (!ok) throw new BadRequestException('验证码无效或已过期');
    record.used = true;
    await this.codeRepo.save(record);
    user.passwordHash = await bcrypt.hash(newPassword, 10);
    user.mustChangePassword = false;
    await this.userRepo.save(user);
    this.logger.log(`password reset via code user=${user.username}`);
    return { ok: true };
  }
}