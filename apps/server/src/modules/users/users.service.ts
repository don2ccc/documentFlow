import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { In, Repository } from 'typeorm';
import { UserBriefDto, UserStatus } from '@document-flow/shared';
import { Role } from '../roles/entities/role.entity';
import { AuditService } from '../audit/audit.service';
import { MailerService } from '../notifications/mailer.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateMeDto } from './dto/update-me.dto';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { User } from './entities/user.entity';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectRepository(User) private readonly repo: Repository<User>,
    @InjectRepository(Role) private readonly roleRepo: Repository<Role>,
    private readonly audit: AuditService,
    private readonly mailer: MailerService
  ) {}

  async findByUsernameWithRoles(username: string): Promise<User | null> {
    return this.repo.findOne({ where: { username }, relations: { roles: { permissions: true } } });
  }

  async findById(id: string): Promise<User | null> {
    return this.repo.findOneBy({ id });
  }

  async getMe(id: string): Promise<UserBriefDto> {
    const user = await this.repo.findOne({ where: { id }, relations: { roles: true } });
    if (!user) throw new NotFoundException('用户不存在');
    return this.toBrief(user);
  }

  async create(dto: CreateUserDto) {
    if (await this.repo.findOneBy({ username: dto.username })) throw new ConflictException('用户名已存在');
    const roles = dto.roleIds?.length ? await this.roleRepo.findBy({ id: In(dto.roleIds) }) : [];
    const user = this.repo.create({
      username: dto.username,
      passwordHash: await bcrypt.hash(dto.password, 10),
      name: dto.name,
      employeeNo: dto.employeeNo ?? null,
      email: dto.email ?? null,
      directSupervisor: dto.directSupervisor ?? null,
      productionLine: dto.productionLine ?? null,
      position: dto.position ?? null,
      departmentId: dto.departmentId ?? null,
      status: UserStatus.Active,
      roles
    });
    const saved = await this.repo.save(user);
    await this.audit.log(dto.username === 'admin' ? 'system' : saved.id, 'user:create', 'user', saved.id, { username: saved.username });
    return this.toBrief(saved);
  }

  async findAll(query: ListUsersQueryDto) {
    const page = query.page ?? 1;
    const pageSize = Math.min(query.pageSize ?? 20, 100);
    const qb = this.repo.createQueryBuilder('u').leftJoinAndSelect('u.roles', 'r');
    if (query.departmentId) qb.andWhere('u.departmentId = :departmentId', { departmentId: query.departmentId });
    if (query.roleId) qb.andWhere('r.id = :roleId', { roleId: query.roleId });
    if (query.status) qb.andWhere('u.status = :status', { status: query.status });
    if (query.keyword) {
      qb.andWhere('(u.name ILIKE :k OR u.username ILIKE :k OR u.employeeNo ILIKE :k)', { k: `%${query.keyword}%` });
    }
    const [items, total] = await qb.orderBy('u.createdAt', 'DESC').skip((page - 1) * pageSize).take(pageSize).getManyAndCount();
    return { items: items.map((u) => this.toBrief(u)), total, page, pageSize };
  }

  async updateStatus(id: string, status: UserStatus, operatorId: string) {
    if (id === operatorId) throw new BadRequestException('不能停用自己的账号');
    const user = await this.repo.findOneBy({ id });
    if (!user) throw new NotFoundException('用户不存在');
    user.status = status;
    await this.audit.log(operatorId, 'user:update-status', 'user', id, { status });
    return this.toBrief(await this.repo.save(user));
  }

  async resetPassword(id: string, newPassword: string) {
    const user = await this.repo.findOneBy({ id });
    if (!user) throw new NotFoundException('用户不存在');
    user.passwordHash = await bcrypt.hash(newPassword, 10);
    user.mustChangePassword = true;
    await this.audit.log(id, 'user:reset-password', 'user', id);
    await this.repo.save(user);
    return { ok: true };
  }

  async delete(id: string, operatorId: string) {
    if (id === operatorId) throw new BadRequestException('不能删除自己的账号');
    const user = await this.repo.findOne({ where: { id }, relations: { roles: true } });
    if (!user) throw new NotFoundException('用户不存在');
    if (user.roles?.some((r) => r.code === 'sys_admin')) throw new BadRequestException('系统管理员账号不能删除');
    await this.audit.log(operatorId, 'user:delete', 'user', id, { username: user.username });
    await this.repo.delete(id);
    return { ok: true };
  }

  async update(id: string, dto: UpdateUserDto, operatorId: string) {
    const user = await this.repo.findOne({ where: { id }, relations: { roles: true } });
    if (!user) throw new NotFoundException('用户不存在');
    if (dto.name !== undefined) user.name = dto.name;
    if (dto.employeeNo !== undefined) user.employeeNo = dto.employeeNo ?? null;
    if (dto.email !== undefined) user.email = dto.email ?? null;
    if (dto.directSupervisor !== undefined) user.directSupervisor = dto.directSupervisor ?? null;
    if (dto.productionLine !== undefined) user.productionLine = dto.productionLine ?? null;
    if (dto.position !== undefined) user.position = dto.position ?? null;
    if (dto.departmentId !== undefined) user.departmentId = dto.departmentId ?? null;
    if (dto.roleIds !== undefined) {
      user.roles = dto.roleIds.length ? await this.roleRepo.findBy({ id: In(dto.roleIds) }) : [];
    }
    const saved = await this.repo.save(user);
    await this.audit.log(operatorId, 'user:update', 'user', id, dto as Record<string, unknown>);
    return this.toBrief(saved);
  }

  async updateMe(userId: string, dto: UpdateMeDto) {
    const user = await this.repo.findOneBy({ id: userId });
    if (!user) throw new NotFoundException('用户不存在');
    if (dto.employeeNo !== undefined) user.employeeNo = dto.employeeNo ?? null;
    if (dto.email !== undefined) user.email = dto.email ?? null;
    if (dto.directSupervisor !== undefined) user.directSupervisor = dto.directSupervisor ?? null;
    if (dto.productionLine !== undefined) user.productionLine = dto.productionLine ?? null;
    if (dto.position !== undefined) user.position = dto.position ?? null;
    if (dto.departmentId !== undefined) user.departmentId = dto.departmentId ?? null;
    const saved = await this.repo.save(user);
    await this.audit.log(userId, 'user:update-me', 'user', userId, dto as Record<string, unknown>);
    return this.toBrief(saved);
  }

  async changeOwnPassword(userId: string, newPassword: string) {
    const user = await this.repo.findOneBy({ id: userId });
    if (!user) throw new NotFoundException('用户不存在');
    user.passwordHash = await bcrypt.hash(newPassword, 10);
    user.mustChangePassword = false;
    await this.audit.log(userId, 'user:change-password', 'user', userId);
    await this.repo.save(user);
    return { ok: true };
  }

  // 管理员审批 + 发送账号密码邮件。
  // 生成 12 位临时密码（大小写字母+数字），覆盖原密码、激活账号、设置 mustChangePassword=true，
  // 然后通过 mailer 发送通知。返回新密码便于管理员备份。
  async approve(id: string, operatorId: string): Promise<{ user: UserBriefDto; initialPassword: string; emailSent: boolean }> {
    const user = await this.repo.findOne({ where: { id }, relations: { roles: true } });
    if (!user) throw new NotFoundException('用户不存在');
    if (user.status === UserStatus.Active) {
      throw new BadRequestException('该用户已激活，无需重复审批');
    }
    if (!user.email) {
      throw new BadRequestException('该用户未填写邮箱，无法发送账号通知');
    }
    const initialPassword = this.generateTempPassword();
    user.passwordHash = await bcrypt.hash(initialPassword, 10);
    user.status = UserStatus.Active;
    user.mustChangePassword = true;
    const saved = await this.repo.save(user);
    await this.audit.log(operatorId, 'user:approve', 'user', id, { username: saved.username });

    const subject = '【WorkFlow System For SPO】账号已开通';
    const text = [
      `您好 ${saved.name}：`,
      '',
      '您申请注册的「WorkFlow System For SPO」账号已通过审批，请使用以下信息登录：',
      `  用户名：${saved.username}`,
      `  初始密码：${initialPassword}`,
      `  登录地址：https://140.249.189.35:8443/login`,
      '',
      '为了您的账号安全，首次登录后系统会强制要求您修改密码。',
      '如非本人申请，请忽略本邮件。'
    ].join('\n');
    const html = `<p>${text.replace(/\n/g, '<br/>')}</p>`;
    let emailSent = false;
    try {
      emailSent = await this.mailer.send(user.email, subject, text, html);
    } catch (err: any) {
      this.logger.error(`approve email failed user=${saved.username} err=${err?.message ?? err}`);
    }
    if (!emailSent) {
      this.logger.warn(`approve email not sent (smtp not configured or send failed) user=${saved.username}`);
    }
    return { user: this.toBrief(saved), initialPassword, emailSent };
  }

  private generateTempPassword(): string {
    // 12 位：大小写字母 + 数字，去掉易混淆字符 0/O/1/l/I
    const chars = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let out = '';
    for (let i = 0; i < 12; i++) {
      out += chars[Math.floor(Math.random() * chars.length)];
    }
    return out;
  }

  private toBrief(u: User): UserBriefDto {
    return { id: u.id, username: u.username, name: u.name, departmentId: u.departmentId, email: u.email ?? null, directSupervisor: u.directSupervisor ?? null, productionLine: u.productionLine ?? null, position: u.position ?? null, status: u.status, roles: u.roles?.map((r) => r.code) ?? [], roleIds: u.roles?.map((r) => r.id) ?? [] };
  }
}