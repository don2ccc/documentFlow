import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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
    return this.roleRepo.find({ relations: { permissions: true } });
  }
}