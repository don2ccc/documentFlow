-- Migration 009: 考勤支持 OT（加班）申请表
-- 线上 NODE_ENV=production 且 DB_SYNC=false，TypeORM 不会自动建表，必须执行本脚本。
-- Safe to re-run: 所有语句都是幂等的。
--
-- 变更点：
--   1. 新增 attendance_ot_applications：随打卡文件一起上传的「OT申请」表
--      （员工编号 / 开始日期时间 / 结束日期时间 / 加班代码）
--   2. attendance_uploads 新增 "otCount"：本批次导入的 OT 申请条数

BEGIN;

CREATE TABLE IF NOT EXISTS attendance_ot_applications (
  "id"           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  "uploadId"     uuid        NOT NULL,
  "employeeNo"   varchar(40) NOT NULL,
  "employeeName" varchar(50),
  "workDate"     varchar(10) NOT NULL,
  "startAt"      varchar(19) NOT NULL,
  "endAt"        varchar(19) NOT NULL,
  "otCode"       varchar(20),
  "shiftCode"    varchar(20)
);

CREATE INDEX IF NOT EXISTS idx_attendance_ot_upload ON attendance_ot_applications ("uploadId");
CREATE INDEX IF NOT EXISTS idx_attendance_ot_emp ON attendance_ot_applications ("uploadId", "employeeNo");

ALTER TABLE attendance_uploads ADD COLUMN IF NOT EXISTS "otCount" integer NOT NULL DEFAULT 0;

COMMIT;

-- ---------------------------------------------------------------- 核对
SELECT 'table' AS kind, to_regclass('public.attendance_ot_applications')::text AS detail
UNION ALL
SELECT 'column', 'attendance_uploads.otCount'
WHERE EXISTS (
  SELECT 1 FROM information_schema.columns
  WHERE table_name = 'attendance_uploads' AND column_name = 'otCount'
);
