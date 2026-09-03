import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { Permission } from './entities/permission.entity';
import { Role } from './entities/role.entity';

@Injectable()
export class RolesService {
  constructor(
    @InjectRepository(Role) private readonly roleRepo: Repository<Role>,
    @InjectRepository(Permission) private readonly permissionRepo: Repository<Permission>
  ) {}

  async findAllPermissions(): Promise<Permission[]> {
    return this.permissionRepo.find({ order: { code: 'ASC' } });
  }

  async findAll(): Promise<Role[]> {
    return this.roleRepo.find({ relations: { permissions: true }, order: { name: 'ASC' } });
  }

  async create(dto: CreateRoleDto) {
    if (await this.roleRepo.findOneBy({ code: dto.code })) throw new ConflictException('角色编码已存在');
    if (await this.roleRepo.findOneBy({ name: dto.name })) throw new ConflictException('角色名称已存在');
    const permissions = dto.permissionCodes?.length
      ? await this.permissionRepo.findBy({ code: In(dto.permissionCodes) })
      : [];
    return this.roleRepo.save(
      this.roleRepo.create({ name: dto.name, code: dto.code, description: dto.description ?? null, permissions })
    );
  }

  async update(id: string, dto: UpdateRoleDto) {
    const role = await this.roleRepo.findOne({ where: { id }, relations: { permissions: true } });
    if (!role) throw new NotFoundException('角色不存在');
    if (dto.name !== undefined) role.name = dto.name;
    if (dto.description !== undefined) role.description = dto.description;
    if (dto.permissionCodes !== undefined) {
      role.permissions = dto.permissionCodes.length
        ? await this.permissionRepo.findBy({ code: In(dto.permissionCodes) })
        : [];
    }
    return this.roleRepo.save(role);
  }

  async remove(id: string) {
    const role = await this.roleRepo.findOne({ where: { id }, relations: { users: true } });
    if (!role) throw new NotFoundException('角色不存在');
    if (role.code === 'sys_admin') throw new BadRequestException('系统管理员角色不可删除');
    if (role.users?.length) throw new ConflictException('该角色已分配给用户，无法删除');
    await this.roleRepo.delete(id);
    return { ok: true };
  }
}