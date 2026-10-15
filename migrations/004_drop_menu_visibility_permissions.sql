-- 004: 移除已废弃的一级菜单「可见性」权限 menu:*
--
-- 背景
--   menu:* 这批权限原本想控制侧边栏显示，但 AppLayout 从来没有读取它们——
--   菜单实际是按子权限（user:manage / hr:view 等）显隐的。
--   于是角色编辑弹窗里的「可见」开关形同虚设：勾不勾，侧边栏都一样。
--   它唯一的作用是「取消勾选会连带清空该分组下的子权限」，容易让人误解。
--
--   已改为直接去掉该开关（RolesPage.tsx），并清理这批权限数据。
--   去掉后菜单行为不变 —— 仍按子权限显隐。
--
-- 列名风格：同 002，camelCase 列名必须加双引号。
-- Safe to re-run: every statement is idempotent.

BEGIN;

-- 先删角色关联，再删权限本身
DELETE FROM role_permissions
 WHERE "permissionId" IN (
   SELECT id FROM permissions WHERE code LIKE 'menu:%'
 );

DELETE FROM permissions WHERE code LIKE 'menu:%';

COMMIT;