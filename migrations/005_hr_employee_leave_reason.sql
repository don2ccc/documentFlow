-- 005: 员工档案增加「离职原因」
--
-- 背景
--   原来叫「停用」，语义上只是把 active 置 false，没有留下任何痕迹。
--   实际业务里这是人事动作，离职是要能追溯的：为什么走的、什么时候走的。
--   界面上改叫「离职」后，必须有地方记录原因，否则只是换了个说法。
--
-- 本次
--   1. hr_employees 加 leaveReason 列（nullable，存量行无值，符合「历史记录原因未知」）
--   2. leaveDate 早已存在（002 里就建了），本次开始由服务端在办理离职时自动写入
--
-- 为什么写成幂等的 IF NOT EXISTS：
--   app.module 里 synchronize = NODE_ENV !== 'production' || DB_SYNC === 'true'，
--   开发与测试环境 synchronize 恒为 true，会自行把列建出来。
--   若这里是裸 ADD COLUMN，开发库上重跑就会因列已存在而失败。
--
-- 列名风格：同 002，camelCase 列名必须加双引号。
-- Safe to re-run: every statement is idempotent.

BEGIN;

ALTER TABLE hr_employees
  ADD COLUMN IF NOT EXISTS "leaveReason" varchar(200);

COMMIT;
