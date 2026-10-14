import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { ILike, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { UserStatus } from '@document-flow/shared';
import { UsersService } from '../users/users.service';
import { User } from '../users/entities/user.entity';
import { AuditService } from '../audit/audit.service';
import { RegisterDto } from './dto/register.dto';

export interface LoginResult {
  accessToken: string;
  user: { id: string; username: string; name: string; departmentId: string | null; roles: string[] };
  mustChangePassword: boolean;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
    private readonly audit: AuditService,
    @InjectRepository(User) private readonly userRepo: Repository<User>
  ) {}

  async login(username: string, password: string): Promise<LoginResult> {
    const user = await this.users.findByUsernameWithRoles(username);

    // 用户名不存在 / 账号停用 / 密码错误 拆成三条不同的提示，便于用户排查。
    // 为防时序攻击，对「用户不存在」分支也跑一次 bcrypt 对照一个固定的 dummy hash，
    // 这样三条分支响应时间相近，不会因为响应快慢泄露用户名是否存在。
    const DUMMY_HASH = '$2a$10$CwTycUXWue0Thq9StjUM0uJ8h2nC1J0sB1jKp5z4wU7zH8h8jH8jG';
    if (!user) {
      await bcrypt.compare(password, DUMMY_HASH);
      throw new UnauthorizedException('用户名不存在，请确认后重试');
    }
    if (user.status !== UserStatus.Active) {
      // 也跑一次对照，保持响应时间一致
      await bcrypt.compare(password, user.passwordHash);
      if (user.status === UserStatus.Pending) {
        throw new UnauthorizedException('账号待激活，请联系管理员审批后再登录');
      }
      throw new UnauthorizedException('账号已停用，请联系管理员');
    }
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('密码错误，请确认后重试');
    }

    const roles = user.roles.map((r) => r.code);
    const roleIds = user.roles.map((r) => r.id);
    const permissions = [...new Set(user.roles.flatMap((r) => r.permissions.map((p) => p.code)))];
    const accessToken = await this.jwt.signAsync({ sub: user.id, username: user.username, roles, permissions, roleIds });
    await this.userRepo.update(user.id, { lastLoginAt: new Date() });
    await this.audit.log(user.id, 'login', 'auth', undefined, { username });
    return {
      accessToken,
      user: { id: user.id, username: user.username, name: user.name, departmentId: user.departmentId, roles },
      mustChangePassword: !!user.mustChangePassword
    };
  }

  // 公开注册：写入待激活账号，写审计日志。
  // 邮箱唯一性通过 DB 索引保证，应用层做一次友好提示。
  async register(dto: RegisterDto): Promise<{ ok: true }> {
    const username = dto.username.trim();
    const email = dto.email.trim().toLowerCase();
    const employeeNo = dto.employeeNo?.trim() || null;
    // 用户名、工号、邮箱都需单独检查，且用户名/工号不区分大小写。
    if (await this.userRepo.findOne({ where: { username: ILike(username) } })) {
      throw new ConflictException('用户名已被占用');
    }
    if (await this.userRepo.findOne({ where: { email } })) {
      throw new ConflictException('邮箱已被占用');
    }
    if (employeeNo && await this.userRepo.findOne({ where: { employeeNo: ILike(employeeNo) } })) {
      throw new ConflictException('工号已被占用');
    }
    const user = this.userRepo.create({
      username,
      passwordHash: await bcrypt.hash(dto.password, 10),
      name: dto.name.trim(),
      email,
      employeeNo,
      directSupervisor: dto.directSupervisor ?? null,
      workshopId: dto.workshopId ?? null,
      position: dto.position ?? null,
      status: UserStatus.Pending,
      mustChangePassword: false,
      roles: []
    });
    const saved = await this.userRepo.save(user);
    await this.audit.log(saved.id, 'user:register', 'user', saved.id, { username: saved.username, email: saved.email });
    return { ok: true };
  }

  // 续期 token：按当前用户重新解析角色与权限后签发新 token
  async refresh(userId: string): Promise<LoginResult> {
    const fresh = await this.userRepo.findOne({ where: { id: userId }, relations: { roles: { permissions: true } } });
    if (!fresh || fresh.status !== 'active') {
      throw new UnauthorizedException('用户不可用');
    }
    const roles = fresh.roles.map((r) => r.code);
    const roleIds = fresh.roles.map((r) => r.id);
    const permissions = [...new Set(fresh.roles.flatMap((r) => (r.permissions ?? []).map((p) => p.code)))];
    const accessToken = await this.jwt.signAsync({ sub: fresh.id, username: fresh.username, roles, permissions, roleIds });
    await this.audit.log(fresh.id, 'token-refresh', 'auth', undefined, undefined);
    return {
      accessToken,
      user: { id: fresh.id, username: fresh.username, name: fresh.name, departmentId: fresh.departmentId, roles },
      mustChangePassword: !!fresh.mustChangePassword
    };
  }
}