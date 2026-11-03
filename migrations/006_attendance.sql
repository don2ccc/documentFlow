-- Migration 006: HR 考勤分析（班次 / 上传批次 / 原始打卡 / 每日结果）
-- 线上 NODE_ENV=production 且 DB_SYNC=false，TypeORM 不会自动建表，必须执行本脚本。
-- Safe to re-run: 所有语句都是幂等的。
--
-- 列名风格：本项目未配置 SnakeNamingStrategy，TypeORM 使用 camelCase 且大小写敏感，
-- 所有 camelCase 列名/索引名都必须用双引号包起来。

BEGIN;

CREATE TABLE IF NOT EXISTS attendance_shifts (
  "id"              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  "code"            varchar(20)  NOT NULL,
  "name"            varchar(50)  NOT NULL,
  "segments"        jsonb        NOT NULL,
  "standardMinutes" integer      NOT NULL DEFAULT 480,
  "active"          boolean      NOT NULL DEFAULT true,
  "createdAt"       timestamptz  NOT NULL DEFAULT now(),
  "updatedAt"       timestamptz  NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_attendance_shifts_code ON attendance_shifts ("code");

CREATE TABLE IF NOT EXISTS attendance_uploads (
  "id"              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  "fileName"        varchar(200) NOT NULL,
  "shiftId"         uuid         NOT NULL,
  "shiftCode"       varchar(20)  NOT NULL,
  "shiftName"       varchar(50)  NOT NULL,
  "shiftSegments"   jsonb        NOT NULL,
  "standardMinutes" integer      NOT NULL,
  "periodStart"     varchar(10)  NOT NULL,
  "periodEnd"       varchar(10)  NOT NULL,
  "punchCount"      integer      NOT NULL DEFAULT 0,
  "employeeCount"   integer      NOT NULL DEFAULT 0,
  "resultCount"     integer      NOT NULL DEFAULT 0,
  "createdBy"       uuid,
  "createdByName"   varchar(50),
  "createdAt"       timestamptz  NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_attendance_uploads_createdAt ON attendance_uploads ("createdAt");

CREATE TABLE IF NOT EXISTS attendance_punches (
  "id"           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  "uploadId"     uuid         NOT NULL,
  "employeeNo"   varchar(40)  NOT NULL,
  "employeeName" varchar(50)  NOT NULL,
  "department"   varchar(100),
  "punchAt"      varchar(19)  NOT NULL,
  "machine"      varchar(20)
);
CREATE INDEX IF NOT EXISTS idx_attendance_punches_upload ON attendance_punches ("uploadId");
CREATE INDEX IF NOT EXISTS idx_attendance_punches_emp ON attendance_punches ("uploadId", "employeeNo");

CREATE TABLE IF NOT EXISTS attendance_daily (
  "id"              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  "uploadId"        uuid         NOT NULL,
  "workDate"        varchar(10)  NOT NULL,
  "employeeNo"      varchar(40)  NOT NULL,
  "employeeName"    varchar(50)  NOT NULL,
  "department"      varchar(100),
  "firstIn"         varchar(8),
  "lastOut"         varchar(8),
  "punchCount"      integer      NOT NULL DEFAULT 0,
  "normalMinutes"   integer      NOT NULL DEFAULT 0,
  "workMinutes"     integer      NOT NULL DEFAULT 0,
  "overtimeMinutes" integer      NOT NULL DEFAULT 0,
  "lateMinutes"     integer      NOT NULL DEFAULT 0,
  "earlyMinutes"    integer      NOT NULL DEFAULT 0,
  "status"          varchar(20)  NOT NULL,
  "abnormal"        varchar(200),
  "segments"        jsonb        NOT NULL DEFAULT '[]'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_attendance_daily_upload ON attendance_daily ("uploadId");
CREATE INDEX IF NOT EXISTS idx_attendance_daily_date ON attendance_daily ("uploadId", "workDate");
CREATE INDEX IF NOT EXISTS idx_attendance_daily_emp ON attendance_daily ("uploadId", "employeeNo");

-- ---------------------------------------------------------------- 权限
INSERT INTO permissions (id, name, code)
SELECT uuid_generate_v4(), '查看考勤分析', 'hr:attendance:view'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE code = 'hr:attendance:view');

INSERT INTO permissions (id, name, code)
SELECT uuid_generate_v4(), '管理考勤分析', 'hr:attendance:manage'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE code = 'hr:attendance:manage');

INSERT INTO role_permissions ("roleId", "permissionId")
SELECT r.id, p.id
FROM roles r, permissions p
WHERE p.code IN ('hr:attendance:view', 'hr:attendance:manage')
  AND r.code = 'sys_admin'
  AND NOT EXISTS (
    SELECT 1 FROM role_permissions rp
    WHERE rp."roleId" = r.id AND rp."permissionId" = p.id
  );

COMMIT;

-- ---------------------------------------------------------------- 核对
SELECT 'table' AS kind, to_regclass('public.' || t)::text AS detail
FROM unnest(ARRAY['attendance_shifts','attendance_uploads','attendance_punches','attendance_daily']) AS t
UNION ALL
SELECT 'permission', code FROM permissions WHERE code LIKE 'hr:attendance%'
ORDER BY 1, 2;
