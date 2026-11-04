-- Migration 007: 考勤分析支持「原始数据自带班次列」（多班次一次上传）
-- 线上 NODE_ENV=production 且 DB_SYNC=false，TypeORM 不会自动改表，必须执行本脚本。
-- Safe to re-run: 所有语句都是幂等的。
--
-- 变更点：
--   1. attendance_uploads."shiftId" 改为可空（纯按行班次计算时没有默认班次）
--   2. attendance_uploads 新增 "shiftSummary"（班次汇总文案）、"shiftSnapshot"（班次快照）
--   3. attendance_punches 新增 "shiftCode"（每行打卡的班次编码）
--   4. attendance_daily 新增 "shiftCode"/"shiftName"（该天实际使用的班次）
--   5. 回填历史批次与历史结果（老批次都是单班次，直接取 uploads 上的快照）

BEGIN;

ALTER TABLE attendance_uploads ALTER COLUMN "shiftId" DROP NOT NULL;
ALTER TABLE attendance_uploads ADD COLUMN IF NOT EXISTS "shiftSummary" varchar(200);
ALTER TABLE attendance_uploads ADD COLUMN IF NOT EXISTS "shiftSnapshot" jsonb;
ALTER TABLE attendance_punches ADD COLUMN IF NOT EXISTS "shiftCode" varchar(20);
ALTER TABLE attendance_daily ADD COLUMN IF NOT EXISTS "shiftCode" varchar(20);
ALTER TABLE attendance_daily ADD COLUMN IF NOT EXISTS "shiftName" varchar(50);

-- 历史批次：班次汇总
UPDATE attendance_uploads
SET "shiftSummary" = COALESCE("shiftSummary", "shiftCode" || ' ' || "shiftName")
WHERE "shiftSummary" IS NULL;

-- 历史批次：班次快照
UPDATE attendance_uploads u
SET "shiftSnapshot" = COALESCE(
  u."shiftSnapshot",
  jsonb_build_object(
    u."shiftCode",
    jsonb_build_object(
      'name', u."shiftName",
      'segments', u."shiftSegments",
      'standardMinutes', u."standardMinutes"
    )
  )
)
WHERE u."shiftSnapshot" IS NULL;

-- 历史原始打卡：班次编码
UPDATE attendance_punches p
SET "shiftCode" = u."shiftCode"
FROM attendance_uploads u
WHERE p."uploadId" = u.id
  AND p."shiftCode" IS NULL;

-- 历史日结果：班次编码 / 名称
UPDATE attendance_daily d
SET "shiftCode" = u."shiftCode",
    "shiftName" = u."shiftName"
FROM attendance_uploads u
WHERE d."uploadId" = u.id
  AND (d."shiftCode" IS NULL OR d."shiftName" IS NULL);

-- 查询过滤用索引
CREATE INDEX IF NOT EXISTS idx_attendance_daily_shift ON attendance_daily ("uploadId", "shiftCode");

COMMIT;

-- ---------------------------------------------------------------- 核对
SELECT 'attendance_uploads' AS tbl,
       count(*) FILTER (WHERE "shiftSummary" IS NULL) AS missing_summary,
       count(*) FILTER (WHERE "shiftSnapshot" IS NULL) AS missing_snapshot,
       count(*) FILTER (WHERE "shiftId" IS NULL) AS null_default_shift
FROM attendance_uploads
UNION ALL
SELECT 'attendance_punches', count(*) FILTER (WHERE "shiftCode" IS NULL), 0, 0 FROM attendance_punches
UNION ALL
SELECT 'attendance_daily', count(*) FILTER (WHERE "shiftCode" IS NULL), count(*) FILTER (WHERE "shiftName" IS NULL), 0 FROM attendance_daily;
