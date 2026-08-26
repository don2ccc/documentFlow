import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { UsersService } from '../users/users.service';

export interface LoginResult {
  accessToken: string;
  user: { id: string; username: string; name: string; departmentId: string | null; roles: string[] };
}

@Injectable()
export class AuthService {
  constructor(private readonly users: UsersService, private readonly jwt: JwtService) {}

  async login(username: string, password: string): Promise<LoginResult> {
    const user = await this.users.findByUsernameWithRoles(username);
    if (!user || user.status !== 'active' || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new UnauthorizedException('用户名或密码错误');
    }
    const roles = user.roles.map((r) => r.code);
    const roleIds = user.roles.map((r) => r.id);
    const permissions = [...new Set(user.roles.flatMap((r) => r.permissions.map((p) => p.code)))];
    const accessToken = await this.jwt.signAsync({ sub: user.id, username: user.username, roles, permissions, roleIds });
    return {
      accessToken,
      user: { id: user.id, username: user.username, name: user.name, departmentId: user.departmentId, roles }
    };
  }
}