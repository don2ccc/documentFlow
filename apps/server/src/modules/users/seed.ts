import { DataSource } from 'typeorm';
import { UserStatus } from '@document-flow/shared';
import * as bcrypt from 'bcryptjs';
import { Role } from '../roles/entities/role.entity';
import { Permission } from '../roles/entities/permission.entity';
import { User } from './entities/user.entity';

const PERMISSIONS = [
  ['上传文档', 'document:upload'],
  ['预览文档', 'document:preview'],
  ['处理审批', 'approval:handle'],
  ['管理用户', 'user:manage'],
  ['管理角色', 'role:manage'],
  ['管理分类', 'category:manage'],
  ['管理部门', 'department:manage'],
  ['管理流程', 'workflow:manage'],
  ['管理科室', 'workshop:manage'],
  ['管理系统设置', 'setting:manage'],
  ['查看审计', 'audit:view'],
  ['查看仪表盘', 'dashboard:view'],
  ['管理数据库', 'database:manage'],

  ['管理宿舍', 'dormitory:manage'],  ['申请查询', 'application:query']
] as const;

export async function seedAdmin(ds: DataSource) {
  const permissionRepo = ds.getRepository(Permission);
  const roleRepo = ds.getRepository(Role);

  // 一次性迁移：把角色上残留的 document:view-all 替换为 application:query，然后删掉旧权限记录
  const oldPerm = await permissionRepo.findOneBy({ code: 'document:view-all' });
  const newPerm = await permissionRepo.findOneBy({ code: 'application:query' });
  if (oldPerm) {
    if (newPerm) {
      const roles = await roleRepo.find({ where: { permissions: { id: oldPerm.id } }, relations: { permissions: true } });
      for (const role of roles) {
        role.permissions = (role.permissions ?? []).filter((p) => p.id !== oldPerm.id);
        if (!role.permissions.find((p) => p.id === newPerm.id)) role.permissions.push(newPerm);
        await roleRepo.save(role);
      }
    }
    await permissionRepo.delete({ id: oldPerm.id });
  }

  const permissions = await Promise.all(
    PERMISSIONS.map(async ([name, code]) => {
      let p = await permissionRepo.findOneBy({ code });
      if (!p) p = await permissionRepo.save(permissionRepo.create({ name, code }));
      return p;
    })
  );
  let adminRole = await roleRepo.findOneBy({ code: 'sys_admin' });
  if (!adminRole) {
    adminRole = await roleRepo.save(
      roleRepo.create({ name: '系统管理员', code: 'sys_admin', description: '拥有全部权限', permissions })
    );
  } else {
    // 已有角色：补齐可能新增的权限（idempotent）
    const existingCodes = new Set((adminRole.permissions ?? []).map((p) => p.code));
    const missing = permissions.filter((p) => !existingCodes.has(p.code));
    if (missing.length > 0) {
      adminRole.permissions = [...(adminRole.permissions ?? []), ...missing];
      adminRole = await roleRepo.save(adminRole);
    }
  }
  const userRepo = ds.getRepository(User);
  if (!(await userRepo.findOneBy({ username: 'admin' }))) {
    const hash = await bcrypt.hash('Admin@123', 10);
    await userRepo.save(
      userRepo.create({ username: 'admin', passwordHash: hash, name: '系统管理员', status: UserStatus.Active, roles: [adminRole] })
    );
  }
}
