-- Migration 008: 考勤结果新增「正常工时」（班次标准工时）
-- 线上 NODE_ENV=production 且 DB_SYNC=false，TypeORM 不会自动改表，必须执行本脚本。
-- Safe to re-run: 所有语句都是幂等的。
--
-- 变更点：
--   1. attendance_daily 新增 "standardMinutes"（该天班次的标准工时，单位分钟，默认 480 = 8 小时）
--   2. 用批次里的班次快照回填历史结果；没有快照时回退到班次表的配置

BEGIN;

ALTER TABLE attendance_daily ADD COLUMN IF NOT EXISTS "standardMinutes" int NOT NULL DEFAULT 480;

-- 回填：按班次快照里的 standardMinutes
UPDATE attendance_daily d
SET "standardMinutes" = (u."shiftSnapshot" -> (d."shiftCode") ->> 'standardMinutes')::int
FROM attendance_uploads u
WHERE d."uploadId" = u.id
  AND u."shiftSnapshot" ? d."shiftCode"
  AND (u."shiftSnapshot" -> (d."shiftCode") ->> 'standardMinutes') IS NOT NULL;

-- 回填：快照缺失时取班次表配置
UPDATE attendance_daily d
SET "standardMinutes" = s."standardMinutes"
FROM attendance_shifts s
WHERE d."shiftCode" = s.code
  AND d."standardMinutes" = 480
  AND s."standardMinutes" IS NOT NULL;

COMMIT;

-- ---------------------------------------------------------------- 核对
SELECT d."shiftCode", d."standardMinutes", count(*) AS rows
FROM attendance_daily d
GROUP BY 1, 2
ORDER BY 1;
