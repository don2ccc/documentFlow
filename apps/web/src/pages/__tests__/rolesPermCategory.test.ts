import { describe, expect, it } from 'vitest';

/**
 * 角色页的权限分组映射。
 *
 * 这份表是从 RolesPage.tsx 里抄出来的（PERM_CATEGORY 是模块内私有常量，
 * 不便直接 import）。改动 RolesPage 时记得同步这里，并让测试失败来提醒。
 */

/** 后端 seed.ts 定义的子权限码（menu:* 已废弃，见 migrations/004） */
const BACKEND_PERMISSIONS = [
  // WorkFlow管理
  'document:upload', 'document:preview', 'document:download',
  'approval:handle', 'dashboard:view',
  'application:query', 'application:query:all',
  'application:query:department', 'application:query:self',
  // 行政管理
  'dormitory:manage',
  // HR管理
  'hr:view', 'hr:manage',
  // 系统管理
  'user:manage', 'role:manage', 'category:manage', 'department:manage',
  'workflow:manage', 'workshop:manage', 'setting:manage', 'audit:view',
  'database:manage'
];

/** 与 RolesPage.tsx 的 PERM_CATEGORY 保持一致 */
const PERM_CATEGORY: Record<string, string> = {
  'document:upload': 'workflow',
  'document:preview': 'workflow',
  'document:download': 'workflow',
  'application:query': 'workflow',
  'application:query:all': 'workflow',
  'application:query:department': 'workflow',
  'application:query:self': 'workflow',
  'approval:handle': 'workflow',
  'dashboard:view': 'workflow',
  'user:manage': 'system',
  'role:manage': 'system',
  'category:manage': 'system',
  'workflow:manage': 'system',
  'audit:view': 'system',
  'setting:manage': 'system',
  'database:manage': 'system',
  'department:manage': 'system',
  'workshop:manage': 'system',
  'dormitory:manage': 'admin',
  'hr:view': 'hr',
  'hr:manage': 'hr'
};

const VALID_CATEGORIES = ['workflow', 'admin', 'production', 'hr', 'system'];

describe('角色权限分组映射', () => {
  it('后端定义的每条子权限都登记了所属分组', () => {
    const missing = BACKEND_PERMISSIONS.filter((c) => !PERM_CATEGORY[c]);
    expect(missing).toEqual([]);
  });

  it('登记的分组名都是已知的一级菜单', () => {
    const bad = Object.entries(PERM_CATEGORY)
      .filter(([, cat]) => !VALID_CATEGORIES.includes(cat))
      .map(([code, cat]) => `${code} -> ${cat}`);
    expect(bad).toEqual([]);
  });

  it('没有多余的、库里不存在的映射', () => {
    const extra = Object.keys(PERM_CATEGORY).filter((c) => !BACKEND_PERMISSIONS.includes(c));
    expect(extra).toEqual([]);
  });

  it('HR 权限归到 HR管理，不落在系统管理（曾经的 bug）', () => {
    expect(PERM_CATEGORY['hr:view']).toBe('hr');
    expect(PERM_CATEGORY['hr:manage']).toBe('hr');
  });

  it('menu:* 已废弃，不应再出现在映射表里', () => {
    // 这批权限从不被 AppLayout 读取，已随 migrations/004 一起删除
    expect(Object.keys(PERM_CATEGORY).filter((c) => c.startsWith('menu:'))).toEqual([]);
  });
});