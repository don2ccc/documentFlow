import { describe, expect, it } from '@jest/globals';
import { computeDailyResults, validateSegments } from '../src/modules/attendance/attendance-calc';

/**
 * 考勤计算口径回归测试。
 *
 * 样例班次 M10：7:30-11:30 / 12:30-16:30 / 17:00-20:00（共 11 小时，标准工时 8 小时）。
 */

const M10 = {
  segments: [
    { start: '07:30', end: '11:30' },
    { start: '12:30', end: '16:30' },
    { start: '17:00', end: '20:00' }
  ],
  standardMinutes: 480
};

const M21 = {
  segments: [
    { start: '20:00', end: '00:00' },
    { start: '01:00', end: '08:00' }
  ],
  standardMinutes: 480
};

function punch(punchAt: string) {
  return { employeeNo: '10000001', employeeName: '测试', department: '总公司', machine: '1', punchAt };
}

describe('班次时间段校验', () => {
  it('接受正常多段班次', () => {
    expect(validateSegments(M10.segments)).toBeNull();
  });

  it('拒绝重叠段', () => {
    expect(validateSegments([
      { start: '07:30', end: '12:00' },
      { start: '11:30', end: '16:30' }
    ])).toContain('重叠');
  });

  it('拒绝零长度段', () => {
    expect(validateSegments([{ start: '08:00', end: '08:00' }])).toContain('长度为 0');
  });
});

describe('computeDailyResults', () => {
  it('满勤：11 小时工时，超过 8 小时部分计加班', () => {
    const [row] = computeDailyResults(M10, [
      punch('2026-10-23 07:20:00'),
      punch('2026-10-23 11:31:00'),
      punch('2026-10-23 12:29:00'),
      punch('2026-10-23 16:31:00'),
      punch('2026-10-23 17:00:00'),
      punch('2026-10-23 20:09:00')
    ]);
    expect(row.workDate).toBe('2026-10-23');
    expect(row.firstIn).toBe('07:20:00');
    expect(row.lastOut).toBe('20:09:00');
    expect(row.normalMinutes).toBe(660);
    expect(row.workMinutes).toBe(669);
    expect(row.overtimeMinutes).toBe(189);
    expect(row.lateMinutes).toBe(0);
    expect(row.earlyMinutes).toBe(0);
    expect(row.status).toBe('正常');
  });

  it('迟到 10 分钟、早退 10 分钟都要计', () => {
    const [row] = computeDailyResults(M10, [
      punch('2026-10-23 07:40:00'),
      punch('2026-10-23 11:30:00'),
      punch('2026-10-23 12:30:00'),
      punch('2026-10-23 16:30:00'),
      punch('2026-10-23 17:00:00'),
      punch('2026-10-23 19:50:00')
    ]);
    expect(row.lateMinutes).toBe(10);
    expect(row.earlyMinutes).toBe(10);
    expect(row.workMinutes).toBe(640);
    expect(row.overtimeMinutes).toBe(160);
    expect(row.status).toBe('迟到/早退');
  });

  it('只打一次卡：标记缺卡，工时按实际（0）计算', () => {
    const [row] = computeDailyResults(M10, [punch('2026-10-23 07:29:00')]);
    expect(row.punchCount).toBe(1);
    expect(row.status).toBe('缺卡');
    expect(row.workMinutes).toBe(0);
    expect(row.abnormal).toContain('缺少配对打卡');
  });

  it('只打上下班两次卡（中间不打卡）不误判缺卡', () => {
    const [row] = computeDailyResults(M10, [
      punch('2026-10-23 07:20:00'),
      punch('2026-10-23 20:09:00')
    ]);
    expect(row.punchCount).toBe(2);
    expect(row.status).toBe('正常');
    expect(row.workMinutes).toBe(669);
  });

  it('跨天夜班：次日凌晨打卡归到前一天', () => {
    const rows = computeDailyResults(M21, [
      punch('2026-10-23 19:55:00'),
      punch('2026-10-24 00:02:00'),
      punch('2026-10-24 01:00:00'),
      punch('2026-10-24 07:58:00')
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].workDate).toBe('2026-10-23');
    expect(rows[0].normalMinutes).toBe(658);
    expect(rows[0].overtimeMinutes).toBe(178);
    expect(rows[0].earlyMinutes).toBe(2);
  });

  it('多天数据按员工拆成多行', () => {
    const rows = computeDailyResults(M10, [
      punch('2026-10-23 07:20:00'),
      punch('2026-10-23 20:00:00'),
      punch('2026-10-24 07:20:00'),
      punch('2026-10-24 20:00:00')
    ]);
    expect(rows.map((r) => r.workDate)).toEqual(['2026-10-23', '2026-10-24']);
  });
});
