import { describe, expect, it } from '@jest/globals';
import { PERMISSIONS } from '../src/modules/users/seed';

/**
 * 权限清单的完整性。
 *
 * 背景：这套 seed 曾漏写 application:query:* 三项与 5 条 menu:*，
 * 而它们在既有生产库里是存在的——于是「从空库按 seed 初始化」会缺 8 条权限，
 * 角色编辑页的一级菜单「可见」开关失去数据来源。
 * 这个测试锁住清单本身。
 */

/** 与前端 RolesPage.tsx 的 CATEGORIES key 对应 */
const CATEGORY_KEYS = ['workflow', 'admin', 'production', 'hr', 'system'];

const codes = PERMISSIONS.map(([, code]) => code);
const names = PERMISSIONS.map(([name]) => name);

describe('权限清单 seed.PERMISSIONS', () => {
  it('权限码不重复', () => {
    const dup = codes.filter((c, i) => codes.indexOf(c) !== i);
    expect(dup).toEqual([]);
  });

  it('权限名不重复', () => {
    const dup = names.filter((n, i) => names.indexOf(n) !== i);
    expect(dup).toEqual([]);
  });

  it('五个一级菜单的可见性权限齐全（menu:*）', () => {
    const menuCodes = codes.filter((c) => c.startsWith('menu:'));
    expect(menuCodes.sort()).toEqual(CATEGORY_KEYS.map((k) => `menu:${k}`).sort());
  });

  it('每条权限都有名称和编码', () => {
    const bad = PERMISSIONS.filter(([name, code]) => !name || !code);
    expect(bad).toEqual([]);
  });

  it('权限码不含空格', () => {
    expect(codes.filter((c) => /\s/.test(c))).toEqual([]);
  });

  it('包含 HR 员工档案权限', () => {
    expect(codes).toContain('hr:view');
    expect(codes).toContain('hr:manage');
  });

  it('包含申请查询的三个范围权限', () => {
    expect(codes).toContain('application:query:all');
    expect(codes).toContain('application:query:department');
    expect(codes).toContain('application:query:self');
  });

  it('总计 26 条，与生产库一致', () => {
    expect(codes.length).toBe(26);
  });
});