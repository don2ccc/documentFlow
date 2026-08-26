import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { In, Repository } from 'typeorm';
import { UserBriefDto, UserStatus } from '@document-flow/shared';
import { Role } from '../roles/entities/role.entity';
import { AuditService } from '../audit/audit.service';
import { CreateUserDto } from './dto/create-user.dto';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { User } from './entities/user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly repo: Repository<User>,
    @InjectRepository(Role) private readonly roleRepo: Repository<Role>,
    private readonly audit: AuditService
  ) {}

  async findByUsernameWithRoles(username: string): Promise<User | null> {
    return this.repo.findOne({ where: { username }, relations: { roles: { permissions: true } } });
  }

  async findById(id: string): Promise<User | null> {
    return this.repo.findOneBy({ id });
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
    await this.audit.log(id, 'user:reset-password', 'user', id);
    await this.repo.save(user);
    return { ok: true };
  }

  private toBrief(u: User): UserBriefDto {
    return { id: u.id, username: u.username, name: u.name, departmentId: u.departmentId, roles: u.roles?.map((r) => r.code) ?? [] };
  }
}