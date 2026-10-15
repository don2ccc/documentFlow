import { DataSource } from 'typeorm';
import { UserStatus } from '@document-flow/shared';
import * as bcrypt from 'bcryptjs';
import { Role } from '../roles/entities/role.entity';
import { Permission } from '../roles/entities/permission.entity';
import { User } from './entities/user.entity';

/**
 * 权限清单。
 *
 * 按前端的五个一级菜单分组，顺序与 RolesPage.tsx 的 CATEGORIES 对应。
 * 新增权限时务必同步前端 RolesPage 的 PERM_CATEGORY，否则会落进「未分类权限」。
 *
 * menu:* 是一级菜单的可见性权限码（菜单可见：WorkFlow管理 等），
 * 与前端 RolesPage 的 MENU_VISIBILITY_CODES 对应。
 *
 * 注意：这套 seed 曾漏写过 application:query:* 三项，
 * 而它们在既有生产库里是存在的。若数据库从空库按本文件初始化，会缺这 3 条权限。
 *
 * menu:*（一级菜单可见性）曾经也在这里，但它是死代码 —— AppLayout 从不读取，
 * 菜单实际按子权限显隐，角色编辑页的「可见」开关形同虚设。
 * 已于 migrations/004 移除，不再写入。
 */
/** 供测试引用，见 test/seed-permissions.spec.ts */
export const PERMISSIONS = [
  // —— WorkFlow管理 ——
  ['上传文档', 'document:upload'],
  ['预览文档', 'document:preview'],
  ['下载文档', 'document:download'],
  ['处理审批', 'approval:handle'],
  ['查看仪表盘', 'dashboard:view'],
  ['申请查询', 'application:query'],
  ['申请查询-全部', 'application:query:all'],
  ['申请查询-本部门', 'application:query:department'],
  ['申请查询-我的', 'application:query:self'],

  // —— 行政管理 ——
  ['管理宿舍', 'dormitory:manage'],

  // —— 生产管理（占位模块，暂无子权限）——

  // —— HR管理 ——
  ['查看员工档案', 'hr:view'],
  ['管理员工档案', 'hr:manage'],

  // —— 系统管理 ——
  ['管理用户', 'user:manage'],
  ['管理角色', 'role:manage'],
  ['管理分类', 'category:manage'],
  ['管理部门', 'department:manage'],
  ['管理流程', 'workflow:manage'],
  ['管理科室', 'workshop:manage'],
  ['管理系统设置', 'setting:manage'],
  ['查看审计', 'audit:view'],
  ['管理数据库', 'database:manage']
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
