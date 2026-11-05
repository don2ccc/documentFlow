import { describe, expect, it } from '@jest/globals';
import {
  computeDailyResults, computeDailyResultsForShifts, validateSegments
} from '../src/modules/attendance/attendance-calc';

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

const M11 = {
  segments: [
    { start: '07:45', end: '11:45' },
    { start: '12:45', end: '16:45' },
    { start: '17:15', end: '20:15' }
  ],
  standardMinutes: 480
};

const M12 = {
  segments: [
    { start: '08:00', end: '12:00' },
    { start: '13:00', end: '17:00' },
    { start: '17:30', end: '20:30' }
  ],
  standardMinutes: 480
};

function punch(punchAt: string) {
  return { employeeNo: '10000001', employeeName: '测试', department: '总公司', machine: '1', punchAt };
}

function shiftPunch(punchAt: string, shiftCode: string | null) {
  return { ...punch(punchAt), shiftCode };
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
  it('满勤：11 小时工时，超过 8 小时的部分按 30 分钟向下取整计加班', () => {
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
    expect(row.overtimeMinutes).toBe(180);
    expect(row.lateMinutes).toBe(0);
    expect(row.earlyMinutes).toBe(0);
    expect(row.status).toBe('正常');
  });

  it('迟到 10 分钟、早退 10 分钟都要计（早退只算正常班次部分）', () => {
    const [row] = computeDailyResults(M10, [
      punch('2026-10-23 07:40:00'),
      punch('2026-10-23 11:30:00'),
      punch('2026-10-23 12:30:00'),
      punch('2026-10-23 16:20:00')
    ]);
    expect(row.lateMinutes).toBe(10);
    expect(row.earlyMinutes).toBe(10);
    expect(row.workMinutes).toBe(460);
    expect(row.overtimeMinutes).toBe(0);
    expect(row.status).toBe('迟到/早退');
  });

  it('加班时段没有打卡不算早退、不算缺卡', () => {
    const [row] = computeDailyResults(M10, [
      punch('2026-10-23 07:30:00'),
      punch('2026-10-23 11:30:00'),
      punch('2026-10-23 12:30:00'),
      punch('2026-10-23 16:30:00')
    ]);
    expect(row.standardMinutes).toBe(480);
    expect(row.segments.map((s) => s.missing)).toEqual([false, false, true]);
    expect(row.earlyMinutes).toBe(0);
    expect(row.overtimeMinutes).toBe(0);
    expect(row.status).toBe('正常');
  });

  it('只打一次卡：标记缺卡，工时按实际（0）计算', () => {
    const [row] = computeDailyResults(M10, [punch('2026-10-23 07:29:00')]);
    expect(row.punchCount).toBe(1);
    expect(row.status).toBe('缺卡');
    expect(row.workMinutes).toBe(0);
    expect(row.abnormal).toContain('缺卡');
  });

  it('只打上下班两次卡：中间的应打卡点留空，不硬塞', () => {
    const [row] = computeDailyResults(M10, [
      punch('2026-10-23 07:20:00'),
      punch('2026-10-23 20:09:00')
    ]);
    expect(row.punchCount).toBe(2);
    expect(row.segments.map((s) => [s.in, s.out])).toEqual([
      ['07:20:00', null],
      [null, null],
      [null, '20:09:00']
    ]);
    expect(row.workMinutes).toBe(669);
    expect(row.status).toBe('缺卡');
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
    expect(rows[0].overtimeMinutes).toBe(150);
    // 夜班正常下班时间是 05:00（20:00 起累计满 8 小时），之后算加班，不再算早退
    expect(rows[0].earlyMinutes).toBe(0);
    expect(rows[0].status).toBe('正常');
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

  it('每个时间段都显示上班 / 下班打卡点，打卡不在段内也能归位', () => {
    const [row] = computeDailyResults(M10, [
      punch('2026-11-01 07:19:57'),
      punch('2026-11-01 11:34:00'),
      punch('2026-11-01 11:45:11'),
      punch('2026-11-01 16:34:31'),
      punch('2026-11-01 16:45:24'),
      punch('2026-11-01 20:08:04')
    ]);
    expect(row.segments.map((s) => [s.start, s.end, s.in, s.out, s.missing])).toEqual([
      ['07:30', '11:30', '07:19:57', '11:34:00', false],
      ['12:30', '16:30', '11:45:11', '16:34:31', false],
      ['17:00', '20:00', '16:45:24', '20:08:04', false]
    ]);
  });

  it('漏打的时间段留空，不把相邻打卡硬塞进去', () => {
    const [row] = computeDailyResults(M10, [
      punch('2026-11-01 07:20:00'),
      punch('2026-11-01 11:30:00'),
      punch('2026-11-01 12:30:00'),
      punch('2026-11-01 16:30:00'),
      punch('2026-11-01 20:05:00')
    ]);
    expect(row.segments[2].in).toBeNull();
    expect(row.segments[2].out).toBe('20:05:00');
    expect(row.segments[2].missing).toBe(true);
  });

  it('重复刷卡的额外记录不会占用后面的应打卡点', () => {
    const [row] = computeDailyResults(M10, [
      punch('2026-11-01 07:21:24'),
      punch('2026-11-01 11:32:25'),
      punch('2026-11-01 11:53:59'),
      punch('2026-11-01 16:34:03'),
      punch('2026-11-01 16:47:03'),
      punch('2026-11-01 16:47:32'),
      punch('2026-11-01 20:01:43')
    ]);
    expect(row.segments.map((s) => [s.in, s.out])).toEqual([
      ['07:21:24', '11:32:25'],
      ['11:53:59', '16:34:03'],
      ['16:47:03', '20:01:43']
    ]);
    expect(row.status).toBe('正常');
  });

  it('相邻应打卡点挨得近时按整体最优对齐，不会前后串位', () => {
    const [row] = computeDailyResults(M12, [
      punch('2026-11-01 07:55:35'),
      punch('2026-11-01 12:00:41'),
      punch('2026-11-01 12:14:56'),
      punch('2026-11-01 17:15:12'),
      punch('2026-11-01 17:27:04'),
      punch('2026-11-01 20:30:12')
    ]);
    expect(row.segments.map((s) => [s.start, s.in, s.out])).toEqual([
      ['08:00', '07:55:35', '12:00:41'],
      ['13:00', '12:14:56', '17:15:12'],
      ['17:30', '17:27:04', '20:30:12']
    ]);
    expect(row.status).toBe('正常');
  });

  it('第 2 段没有上班卡但第 3 段有下班卡时，优先满足第 3 段', () => {
    const [row] = computeDailyResults(M10, [
      punch('2026-10-31 16:34:40'),
      punch('2026-10-31 20:03:21')
    ]);
    // 16:34 既可以当第 2 段下班卡，也可以当第 3 段上班卡；
    // 第 3 段已有 20:03 下班卡证明在岗，因此 16:34 归到第 3 段上班，第 2 段整段为空。
    expect(row.segments.map((s) => [s.start, s.in, s.out])).toEqual([
      ['07:30', null, null],
      ['12:30', null, null],
      ['17:00', '16:34:40', '20:03:21']
    ]);
    expect(row.status).toBe('缺卡');
  });

  it('优先满足第 3 段时加班按第 3 段实际在岗时间算', () => {
    const [row] = computeDailyResults(M10, [
      punch('2026-10-31 16:34:40'),
      punch('2026-10-31 20:03:21')
    ], [{
      employeeNo: '10000001',
      startAt: '2026-10-31 12:30:00',
      endAt: '2026-10-31 20:00:00',
      otCode: 'OTS'
    }]);
    // 第 1、2 段缺卡整段不计；第 3 段 17:00-20:00 = 180 分钟 → 180
    expect(row.overtimeMinutes).toBe(180);
    expect(row.segments.map((s) => [s.start, s.in, s.out])).toEqual([
      ['07:30', null, null],
      ['12:30', null, null],
      ['17:00', '16:34:40', '20:03:21']
    ]);
  });

  it('相邻两段都只缺上班卡时，仍按偏差最小归位（不硬移）', () => {
    const [row] = computeDailyResults(M10, [
      punch('2026-11-01 07:30:00'),
      punch('2026-11-01 11:30:00'),
      punch('2026-11-01 12:30:00'),
      punch('2026-11-01 16:30:00'),
      punch('2026-11-01 20:00:00')
    ]);
    // 16:30 已经能完整收尾第 2 段，就留在第 2 段，不挪到第 3 段上班
    expect(row.segments.map((s) => [s.start, s.in, s.out])).toEqual([
      ['07:30', '07:30:00', '11:30:00'],
      ['12:30', '12:30:00', '16:30:00'],
      ['17:00', null, '20:00:00']
    ]);
  });
});

describe('OT 申请（加班单）', () => {
  const ot = (startAt: string, endAt: string) => ({
    employeeNo: '10000001',
    startAt,
    endAt,
    otCode: 'OTS'
  });

  it('有 OT 申请：按每个时间段实际上下班打卡累计加班，不判迟到早退', () => {
    const [row] = computeDailyResults(M10, [
      punch('2026-11-01 07:19:00'),
      punch('2026-11-01 11:34:00'),
      punch('2026-11-01 12:40:00'),
      punch('2026-11-01 16:34:00'),
      punch('2026-11-01 17:00:00'),
      punch('2026-11-01 20:05:00')
    ], [ot('2026-11-01 07:30:00', '2026-11-01 20:00:00')]);
    // 第 1 段 4h + 第 2 段 12:40-16:30 共 3h50m + 第 3 段 3h = 650 分钟 → 630
    expect(row.overtimeMinutes).toBe(630);
    expect(row.standardMinutes).toBe(0);
    expect(row.lateMinutes).toBe(0);
    expect(row.earlyMinutes).toBe(0);
    expect(row.status).toBe('OT加班');
    expect(row.abnormal).toContain('OT 申请');
    expect(row.abnormal).toContain('07:30-20:00');
  });

  it('中午晚回岗（13:16）按实际在岗时间累计，不按首末卡整段算', () => {
    const [row] = computeDailyResults(M10, [
      punch('2026-11-01 07:20:00'),
      punch('2026-11-01 11:32:00'),
      punch('2026-11-01 13:16:00'),
      punch('2026-11-01 16:33:00'),
      punch('2026-11-01 16:44:00'),
      punch('2026-11-01 20:02:00')
    ], [ot('2026-11-01 07:30:00', '2026-11-01 20:00:00')]);
    // 4h + 13:16-16:30 共 3h14m + 3h = 614 分钟 → 600（10h）
    expect(row.overtimeMinutes).toBe(600);
    expect(row.workMinutes).toBe(614);
    expect(row.status).toBe('OT加班');
  });

  it('缺卡的时段整段扣完（王梅：第 2 段缺上班卡 → 7h）', () => {
    const [row] = computeDailyResults(M10, [
      punch('2026-11-01 07:20:00'),
      punch('2026-11-01 11:31:00'),
      punch('2026-11-01 16:30:00'),
      punch('2026-11-01 16:42:00'),
      punch('2026-11-01 20:02:00')
    ], [ot('2026-11-01 07:30:00', '2026-11-01 20:00:00')]);
    // 第 1 段 4h + 第 2 段缺卡整段扣完 + 第 3 段 3h = 420（7h）
    expect(row.overtimeMinutes).toBe(420);
    expect(row.abnormal).toContain('缺卡：第 2 段上班');
  });

  it('第 3 段缺上班打卡同样整段扣完（贵小华 → 8.5h）', () => {
    const [row] = computeDailyResults(M12, [
      punch('2026-11-01 07:24:13'),
      punch('2026-11-01 12:03:21'),
      punch('2026-11-01 12:20:38'),
      punch('2026-11-01 17:05:31'),
      punch('2026-11-01 20:04:22')
    ], [ot('2026-11-01 07:30:00', '2026-11-01 20:30:00')]);
    // 07:30-08:00 提前到岗 30 + 第 1 段 4h + 第 2 段 4h + 第 3 段缺上班卡整段扣完 = 510（8.5h）
    expect(row.overtimeMinutes).toBe(510);
  });

  it('缺卡的时段整段扣完：只有首末两次打卡时加班为 0', () => {
    const [row] = computeDailyResults(M10, [
      punch('2026-11-01 07:30:00'),
      punch('2026-11-01 16:44:00')
    ], [ot('2026-11-01 07:30:00', '2026-11-01 20:00:00')]);
    // 第 1 段缺下班卡、第 2 段缺上班卡，均整段扣完
    expect(row.overtimeMinutes).toBe(0);
    expect(row.status).toBe('OT加班');
  });

  it('OT 申请超出部分的打卡不计入加班', () => {
    const [row] = computeDailyResults(M10, [
      punch('2026-11-01 07:00:00'),
      punch('2026-11-01 11:30:00'),
      punch('2026-11-01 12:30:00'),
      punch('2026-11-01 16:30:00'),
      punch('2026-11-01 17:00:00'),
      punch('2026-11-01 21:30:00')
    ], [ot('2026-11-01 07:30:00', '2026-11-01 20:00:00')]);
    // 07:30-20:00 共 660 分钟，20:00 之后的 90 分钟不计
    expect(row.overtimeMinutes).toBe(660);
  });

  it('打卡比 OT 开始晚几十秒不会白丢半小时', () => {
    const [row] = computeDailyResults(M10, [
      punch('2026-11-01 07:30:26'),
      punch('2026-11-01 11:34:46'),
      punch('2026-11-01 11:53:45'),
      punch('2026-11-01 16:34:33'),
      punch('2026-11-01 16:48:29'),
      punch('2026-11-01 20:04:27')
    ], [ot('2026-11-01 07:30:00', '2026-11-01 20:00:00')]);
    expect(row.overtimeMinutes).toBe(660);
  });

  it('OT 申请早于班次开始时，提前打卡的时间计入加班', () => {
    const [row] = computeDailyResults(M12, [
      punch('2026-11-01 07:30:00'),
      punch('2026-11-01 12:00:00'),
      punch('2026-11-01 13:00:00'),
      punch('2026-11-01 17:00:00'),
      punch('2026-11-01 17:30:00'),
      punch('2026-11-01 20:30:00')
    ], [ot('2026-11-01 07:30:00', '2026-11-01 20:30:00')]);
    // 07:30-08:00 提前到岗 30 + 4h + 4h + 3h = 690（比班次 08:00 开始多算 30 分钟）
    expect(row.overtimeMinutes).toBe(690);
  });

  it('下班比班次边界早 1 分钟按实际扣减（16:44 下班 → 10.5h）', () => {
    const [row] = computeDailyResults(M11, [
      punch('2026-11-01 07:45:00'),
      punch('2026-11-01 11:45:00'),
      punch('2026-11-01 12:45:00'),
      punch('2026-11-01 16:44:00'),
      punch('2026-11-01 17:15:00'),
      punch('2026-11-01 20:15:00')
    ], [ot('2026-11-01 07:45:00', '2026-11-01 20:15:00')]);
    // 第 2 段 12:45-16:44 只有 3h59m，全天 659 分钟 → 630
    expect(row.overtimeMinutes).toBe(630);
  });

  it('下班 16:44:56 秒数舍去后按 16:44 算，同样扣 30 分钟', () => {
    const [row] = computeDailyResults(M11, [
      punch('2026-11-01 07:45:00'),
      punch('2026-11-01 11:45:00'),
      punch('2026-11-01 12:45:00'),
      punch('2026-11-01 16:44:56'),
      punch('2026-11-01 17:15:00'),
      punch('2026-11-01 20:15:00')
    ], [ot('2026-11-01 07:45:00', '2026-11-01 20:15:00')]);
    expect(row.overtimeMinutes).toBe(630);
  });

  it('下班提前超过 5 分钟同样按实际时间算', () => {
    const [row] = computeDailyResults(M10, [
      punch('2026-11-01 07:30:00'),
      punch('2026-11-01 11:30:00'),
      punch('2026-11-01 12:30:00'),
      punch('2026-11-01 16:24:00'),
      punch('2026-11-01 17:00:00'),
      punch('2026-11-01 20:00:00')
    ], [ot('2026-11-01 07:30:00', '2026-11-01 20:00:00')]);
    // 16:24 早 6 分钟 → 4h + 3h54m + 3h = 654 → 630
    expect(row.overtimeMinutes).toBe(630);
  });

  it('OT 当天有缺卡仍然记录并显示，且缺卡时段整段扣完', () => {
    const [row] = computeDailyResults(M10, [
      punch('2026-11-01 07:30:00'),
      punch('2026-11-01 11:30:00'),
      punch('2026-11-01 16:30:00'),
      punch('2026-11-01 20:00:00')
    ], [ot('2026-11-01 07:30:00', '2026-11-01 20:00:00')]);
    expect(row.status).toBe('OT加班');
    // 16:30 归到第 3 段上班（第 3 段有 20:00 下班卡证明在岗），第 2 段整段为空；
    // 只剩第 1 段 4h + 第 3 段 3h = 420
    expect(row.overtimeMinutes).toBe(420);
    expect(row.abnormal).toContain('缺卡：第 2 段上班');
  });

  it('OT 申请工号补零（00119260）与打卡工号（119260）能匹配', () => {
    const defs = [{ code: 'M10', name: '白班1#', ...M10 }];
    const at = (t: string) => ({ ...punch(`2026-11-01 ${t}`), employeeNo: '119260' });
    const rows = computeDailyResultsForShifts(
      defs,
      [at('07:19:57'), at('11:34:00'), at('11:45:11'), at('16:34:00'), at('16:45:00'), at('20:08:04')],
      defs[0],
      [{ employeeNo: '00119260', startAt: '2026-11-01 07:30:00', endAt: '2026-11-01 20:00:00', otCode: 'OTS' }]
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe('OT加班');
    expect(rows[0].overtimeMinutes).toBe(660);
  });

  it('没有 OT 申请的员工仍按常规口径计算', () => {
    const [row] = computeDailyResults(M10, [
      punch('2026-11-01 07:40:00'),
      punch('2026-11-01 11:30:00'),
      punch('2026-11-01 12:30:00'),
      punch('2026-11-01 16:20:00')
    ], []);
    expect(row.status).toBe('迟到/早退');
    expect(row.lateMinutes).toBe(10);
    expect(row.earlyMinutes).toBe(10);
    expect(row.standardMinutes).toBe(480);
  });
});

describe('computeDailyResultsForShifts（原始数据自带班次列）', () => {
  const shifts = [
    { code: 'M10', name: '白班1#', ...M10 },
    { code: 'M21', name: '夜班1#', ...M21 }
  ];

  it('同一天同一员工按行班次拆成两行，各按自己的标准工时算加班', () => {
    const rows = computeDailyResultsForShifts(shifts, [
      shiftPunch('2026-11-01 07:19:57', 'M10'),
      shiftPunch('2026-11-01 20:08:04', 'M10'),
      shiftPunch('2026-11-01 19:55:00', 'M21'),
      shiftPunch('2026-11-02 00:02:00', 'M21'),
      shiftPunch('2026-11-02 01:00:00', 'M21'),
      shiftPunch('2026-11-02 07:58:00', 'M21')
    ]);
    expect(rows).toHaveLength(2);
    const m10 = rows.find((r) => r.shiftCode === 'M10')!;
    const m21 = rows.find((r) => r.shiftCode === 'M21')!;
    expect(m10.workDate).toBe('2026-11-01');
    expect(m10.shiftName).toBe('白班1#');
    expect(m10.workMinutes).toBe(668);
    expect(m10.overtimeMinutes).toBe(180);
    // 只打了两头两次卡，中间的应打卡点为空白，按新口径算缺卡
    expect(m10.status).toBe('缺卡');
    expect(m21.workDate).toBe('2026-11-01');
    expect(m21.workMinutes).toBe(658);
    expect(m21.overtimeMinutes).toBe(150);
    expect(m21.standardMinutes).toBe(480);
    expect(m21.earlyMinutes).toBe(0);
    expect(m21.status).toBe('正常');
  });

  it('班次编码忽略大小写与首尾空格', () => {
    const rows = computeDailyResultsForShifts(shifts, [
      shiftPunch('2026-11-01 07:19:57', ' m10 '),
      shiftPunch('2026-11-01 20:08:04', 'M10')
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].shiftCode).toBe('M10');
  });

  it('班次列为空时使用默认班次', () => {
    const rows = computeDailyResultsForShifts(shifts, [
      shiftPunch('2026-11-01 07:19:57', null),
      shiftPunch('2026-11-01 20:08:04', '')
    ], shifts[0]);
    expect(rows).toHaveLength(1);
    expect(rows[0].shiftCode).toBe('M10');
  });

  it('未配置的班次编码直接报错，不静默按默认班次计算', () => {
    expect(() => computeDailyResultsForShifts(shifts, [
      shiftPunch('2026-11-01 07:19:57', 'M99')
    ])).toThrow('M99');
  });
});
