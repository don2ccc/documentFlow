-- 003: 工号改为「在职唯一」
--
-- 背景
--   hr_employees."employeeNo" 原本是整表 UNIQUE，但删除员工是逻辑删除
--   （active=false，行仍然保留）。于是员工离职后该工号永远无法再次使用：
--   前台会报「工号 xxx 已存在」，而同模块的身份证校验只看在职员工，口径不一致。
--
-- 改为部分唯一索引（partial unique index）：
--   只约束在职记录，离职记录保留工号，同工号可以再次入职。
--   这与 assertIdCardFree 的口径一致，也符合 HR 复职场景。
--
-- 列名风格：同 002，本项目未配置 SnakeNamingStrategy，camelCase 列名必须加双引号。
-- Safe to re-run: every statement is idempotent.

BEGIN;

-- 1. 自检：若已存在「两个在职员工共用同一工号」，直接报错，
--    不要把脏数据掩盖成新约束建不出来。
DO $$
DECLARE
  dup text;
BEGIN
  SELECT string_agg("employeeNo", ', ') INTO dup
    FROM (
      SELECT "employeeNo"
        FROM hr_employees
       WHERE active = true
       GROUP BY "employeeNo"
      HAVING count(*) > 1
    ) t;
  IF dup IS NOT NULL THEN
    RAISE EXCEPTION '存在重复的在职工号：% ，请先人工处理', dup;
  END IF;
END $$;

-- 2. 去掉 employeeNo 上的整表唯一约束。
--    注意：不能写死约束名 —— 不同库的约束名不一样：
--      migrations/002 建的是 hr_employees_employeeNo_key
--      而 TypeORM synchronize 建出来的是 UQ_<32位十六进制>
--    写死名字会在这里静默跳过（DROP ... IF EXISTS 不报错），旧约束继续生效。
--    改为按「列名 + 类型」从系统目录里查出来再删。
DO $$
DECLARE
  cname text;
BEGIN
  FOR cname IN
    SELECT con.conname
      FROM pg_constraint con
      JOIN pg_attribute att
        ON att.attrelid = con.conrelid
       AND att.attnum = ANY (con.conkey)
     WHERE con.conrelid = 'hr_employees'::regclass
       AND con.contype = 'u'
       AND att.attname = 'employeeNo'
       AND array_length(con.conkey, 1) = 1
  LOOP
    EXECUTE format('ALTER TABLE hr_employees DROP CONSTRAINT %I', cname);
  END LOOP;
END $$;

-- 3. 清掉可能残留的、非约束形式的整表唯一索引（同样是按列找，不认名字）
DO $$
DECLARE
  iname text;
BEGIN
  FOR iname IN
    SELECT indexname
      FROM pg_indexes
     WHERE tablename = 'hr_employees'
       AND indexdef ILIKE '%UNIQUE%'
       AND indexdef ILIKE '%"employeeNo"%'
       AND indexname <> 'hr_employees_employeeNo_active_key'
  LOOP
    EXECUTE format('DROP INDEX IF EXISTS %I', iname);
  END LOOP;
END $$;

-- 4. 建部分唯一索引：仅在职记录唯一
CREATE UNIQUE INDEX IF NOT EXISTS hr_employees_employeeNo_active_key
  ON hr_employees ("employeeNo")
  WHERE active = true;

-- 5. 身份证同样加部分唯一索引，让数据库也兜住「在职身份证重复」
--    （原先只有服务层校验，并发下可能漏检）
CREATE UNIQUE INDEX IF NOT EXISTS hr_employees_idCardNo_active_key
  ON hr_employees ("idCardNo")
  WHERE active = true AND "idCardNo" IS NOT NULL;

COMMIT;