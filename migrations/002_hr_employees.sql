-- Migration 002: 员工档案 (hr_employees) + hr:view / hr:manage 权限
-- 线上 DB_SYNC=false，TypeORM 不会自动建表，必须执行本脚本。
-- Safe to re-run: every statement is idempotent.
--
-- 列名风格（重要）：
--   本项目未配置 SnakeNamingStrategy，TypeORM 建的表使用 camelCase 且大小写敏感，
--   例如 users."employeeNo" / "lastLoginAt"。PostgreSQL 会把未加引号的标识符
--   折叠成小写，所以下面所有 camelCase 列名都必须用双引号包起来，
--   否则会建成 "employeeno" 而实体找不到列，报 column e.employeeNo does not exist。

BEGIN;

CREATE TABLE IF NOT EXISTS hr_employees (
  "id"               uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  "employeeNo"       varchar(8)   NOT NULL UNIQUE,
  "name"             varchar(50)  NOT NULL,
  "namePinyin"       varchar(50),
  "namePinyinRest"   varchar(100),
  "gender"           varchar(4),
  "nation"           varchar(30),
  "birthDate"        date,
  "age"              integer,
  "idCardNo"         varchar(18),
  "idCardAddress"    varchar(200),
  "address"          varchar(200),
  "phone"            varchar(30),
  "email"            varchar(100),
  "bankNo"           varchar(30),
  "cardNo"           varchar(30),
  "department"       varchar(50),
  "workGroup"        varchar(50),
  "jobTitle"         varchar(50),
  "workLocation"     varchar(50),
  "supervisor"       varchar(50),
  "joinDate"         date,
  "leaveDate"        date,
  "entryType"        varchar(10),
  "education"        varchar(20),
  "major"            varchar(50),
  "school"           varchar(50),
  "maritalStatus"    varchar(10),
  "salary"           numeric(18,2),
  "returnedStatus"   varchar(10),
  "photoPath"        varchar(200),
  "active"           boolean      NOT NULL DEFAULT true,
  "sDate"            timestamptz  NOT NULL DEFAULT now(),
  "createdAt"        timestamptz  NOT NULL DEFAULT now(),
  "updatedAt"        timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hr_employees_name       ON hr_employees ("name");
CREATE INDEX IF NOT EXISTS idx_hr_employees_department ON hr_employees ("department");
CREATE INDEX IF NOT EXISTS idx_hr_employees_workGroup  ON hr_employees ("workGroup");
CREATE INDEX IF NOT EXISTS idx_hr_employees_cardNo     ON hr_employees ("cardNo");

-- ---------------------------------------------------------------- 权限
INSERT INTO permissions (id, name, code)
SELECT uuid_generate_v4(), '查看员工档案', 'hr:view'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE code = 'hr:view');

INSERT INTO permissions (id, name, code)
SELECT uuid_generate_v4(), '管理员工档案', 'hr:manage'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE code = 'hr:manage');

INSERT INTO role_permissions ("roleId", "permissionId")
SELECT r.id, p.id
FROM roles r, permissions p
WHERE p.code IN ('hr:view', 'hr:manage')
  AND r.code = 'sys_admin'
  AND NOT EXISTS (
    SELECT 1 FROM role_permissions rp
    WHERE rp."roleId" = r.id AND rp."permissionId" = p.id
  );

COMMIT;

-- ---------------------------------------------------------------- 核对
SELECT 'table' AS kind, to_regclass('public.hr_employees')::text AS detail
UNION ALL
SELECT 'columns', count(*)::text FROM information_schema.columns WHERE table_name = 'hr_employees'
UNION ALL
SELECT 'permission_' || code, 'ok' FROM permissions WHERE code IN ('hr:view','hr:manage')
ORDER BY 1;