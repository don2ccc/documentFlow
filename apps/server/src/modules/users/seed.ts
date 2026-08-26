import { DataSource } from 'typeorm';
import { UserStatus } from '@document-flow/shared';
import * as bcrypt from 'bcryptjs';
import { Role } from '../roles/entities/role.entity';
import { Permission } from '../roles/entities/permission.entity';
import { User } from './entities/user.entity';

const PERMISSIONS = [
  ['上传文档', 'document:upload'],
  ['处理审批', 'approval:handle'],
  ['管理用户', 'user:manage'],
  ['管理角色', 'role:manage'],
  ['管理分类', 'category:manage'],
  ['管理流程', 'workflow:manage'],
  ['查看审计', 'audit:view'],
  ['查看仪表盘', 'dashboard:view']
] as const;

export async function seedAdmin(ds: DataSource) {
  const permissionRepo = ds.getRepository(Permission);
  const permissions = await Promise.all(
    PERMISSIONS.map(async ([name, code]) => {
      let p = await permissionRepo.findOneBy({ code });
      if (!p) p = await permissionRepo.save(permissionRepo.create({ name, code }));
      return p;
    })
  );
  let adminRole = await ds.getRepository(Role).findOneBy({ code: 'sys_admin' });
  if (!adminRole) {
    adminRole = await ds.getRepository(Role).save(
      ds.getRepository(Role).create({ name: '系统管理员', code: 'sys_admin', description: '拥有全部权限', permissions })
    );
  }
  const userRepo = ds.getRepository(User);
  if (!(await userRepo.findOneBy({ username: 'admin' }))) {
    const hash = await bcrypt.hash('Admin@123', 10);
    await userRepo.save(
      userRepo.create({ username: 'admin', passwordHash: hash, name: '系统管理员', status: UserStatus.Active, roles: [adminRole] })
    );
  }
}