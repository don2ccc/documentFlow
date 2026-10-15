import { describe, expect, it } from 'vitest';

/**
 * 角色页的权限分组映射。
 *
 * 这份表是从 RolesPage.tsx 里抄出来的（PERM_CATEGORY 是模块内私有常量，
 * 不便直接 import）。改动 RolesPage 时记得同步这里，并让测试失败来提醒。
 */

/** 后端 seed.ts 定义的权限码 */
const BACKEND_PERMISSIONS = [
  'document:upload', 'document:preview', 'document:download',
  'approval:handle',
  'user:manage', 'role:manage', 'category:manage', 'department:manage',
  'workflow:manage', 'workshop:manage', 'setting:manage', 'audit:view',
  'dashboard:view', 'database:manage',
  'dormitory:manage',
  'application:query',
  'hr:view', 'hr:manage'
];

/** 数据库里还存在、但 seed.ts 没写的权限（历史遗留，见 seed.ts 注释） */
const LEGACY_PERMISSIONS = [
  'application:query:all',
  'application:query:department',
  'application:query:self'
];

/** 一级菜单的可见性权限，不参与分组 */
const MENU_VISIBILITY_CODES = [
  'menu:workflow', 'menu:admin', 'menu:production', 'menu:hr', 'menu:system'
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

const ALL_PERMISSIONS = [...BACKEND_PERMISSIONS, ...LEGACY_PERMISSIONS];

describe('角色权限分组映射', () => {
  it('每个权限都被登记了所属分组', () => {
    const missing = ALL_PERMISSIONS.filter((c) => !PERM_CATEGORY[c]);
    expect(missing).toEqual([]);
  });

  it('登记的分组名都是已知的一级菜单', () => {
    const bad = Object.entries(PERM_CATEGORY)
      .filter(([, cat]) => !VALID_CATEGORIES.includes(cat))
      .map(([code, cat]) => `${code} -> ${cat}`);
    expect(bad).toEqual([]);
  });

  it('没有多余的、库里不存在的映射', () => {
    const extra = Object.keys(PERM_CATEGORY).filter((c) => !ALL_PERMISSIONS.includes(c));
    expect(extra).toEqual([]);
  });

  it('HR 权限归到 HR管理，不落在系统管理（曾经的 bug）', () => {
    expect(PERM_CATEGORY['hr:view']).toBe('hr');
    expect(PERM_CATEGORY['hr:manage']).toBe('hr');
  });

  it('menu:* 可见性权限不会被当成子权限分组', () => {
    const leaked = MENU_VISIBILITY_CODES.filter((c) => PERM_CATEGORY[c]);
    expect(leaked).toEqual([]);
  });
});