import { DailySegmentDetail } from './entities/attendance-daily.entity';
import { ShiftSegmentValue } from './entities/attendance-shift.entity';

/**
 * 考勤计算核心（纯函数，不碰数据库，便于单测）。
 *
 * 计算口径（与业务确认过）：
 *   1. 原始数据里带「班次」列时按每行班次分别计算；没有该列时整批使用默认班次；
 *   2. 迟到 / 早退 0 分钟宽限，按秒向上取整到分钟；早退只算到「正常下班时间」
 *      （按班次各时间段累计到标准工时为止），加班时段不参与迟到 / 早退；
 *   3. 工作时长 = 打卡区间与前班次各时间段的交集之和，加上班次结束后的时间；
 *   4. 加班时长 = 工作时长 - 标准工时，按 30 分钟为单位向下取整（不足 30 分钟舍去，不足 0 记 0）；
 *   5. 正常班次时段内有应打卡点没打视为缺卡；加班时段可以没有打卡，不算缺卡；
 *   6. 每个班次时间段都输出「上班 / 下班」两个应打卡点，缺卡的位置留空。
 *
 * 跨天班次（如 20:00-00:00 / 01:00-08:00）会把次日凌晨的打卡归到前一天，
 * 通过「就近班次窗口」实现，不再按打卡日期简单分组。
 */

export interface ShiftConfig {
  segments: ShiftSegmentValue[];
  standardMinutes: number;
}

/** 带编码的班次，用于按打卡行分别匹配 */
export interface NamedShiftConfig extends ShiftConfig {
  code: string;
  name?: string;
}

export interface PunchInput {
  employeeNo: string;
  employeeName: string;
  department: string | null;
  machine: string | null;
  /** YYYY-MM-DD HH:mm:ss */
  punchAt: string;
  /** 原始数据「班次」列的值，为空时使用上传时选择的默认班次 */
  shiftCode?: string | null;
}

/**
 * 工号归一化：OT 申请表常用 8 位补零工号（00119260），
 * 打卡文件用 6 位（119260），比较时去掉前导零。
 */
export function normalizeEmployeeNo(value: string): string {
  const text = value.trim();
  return text.replace(/^0+/, '') || text;
}

/** OT（加班）申请：某员工某段区间内的打卡全部算加班 */
export interface OtApplicationInput {
  employeeNo: string;
  /** YYYY-MM-DD HH:mm:ss */
  startAt: string;
  /** YYYY-MM-DD HH:mm:ss */
  endAt: string;
  /** 加班代码，如 OTS */
  otCode?: string | null;
}

export interface DailyResult {
  workDate: string;
  employeeNo: string;
  employeeName: string;
  department: string | null;
  shiftCode: string | null;
  shiftName: string | null;
  firstIn: string | null;
  lastOut: string | null;
  punchCount: number;
  /** 班次标准工时（分钟），例如 8 小时 = 480 */
  standardMinutes: number;
  normalMinutes: number;
  workMinutes: number;
  overtimeMinutes: number;
  lateMinutes: number;
  earlyMinutes: number;
  status: string;
  abnormal: string | null;
  segments: DailySegmentDetail[];
}

const DAY_MINUTES = 1440;
const MINUTES_MS = 60_000;
/** 加班以 30 分钟为单位，不足 30 分钟舍去 */
const OVERTIME_UNIT_MINUTES = 30;

const pad = (n: number) => String(n).padStart(2, '0');

/** "HH:mm" → 当天第几分钟；非法返回 NaN */
export function hmToMinutes(hm: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hm ?? '').trim());
  if (!m) return NaN;
  const h = Number(m[1]);
  const mi = Number(m[2]);
  if (h < 0 || h > 23 || mi < 0 || mi > 59) return NaN;
  return h * 60 + mi;
}

/** "YYYY-MM-DD" → 本地零点 Date（避免 new Date('YYYY-MM-DD') 被当成 UTC） */
export function parseDateOnly(value: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) throw new Error(`日期格式不正确: ${value}`);
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/** "YYYY-MM-DD HH:mm:ss" → 本地时间 Date */
export function parseDateTime(value: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value);
  if (!m) throw new Error(`日期时间格式不正确: ${value}`);
  return new Date(
    Number(m[1]), Number(m[2]) - 1, Number(m[3]),
    Number(m[4]), Number(m[5]), Number(m[6] ?? 0)
  );
}

export function formatDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function formatTime(d: Date): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function addDays(date: string, delta: number): string {
  const d = parseDateOnly(date);
  d.setDate(d.getDate() + delta);
  return formatDate(d);
}

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * MINUTES_MS);
}

export interface ShiftSpan {
  start: Date;
  end: Date;
}

export interface ShiftWindow {
  /** 班次开始日期 YYYY-MM-DD */
  date: string;
  start: Date;
  end: Date;
  spans: ShiftSpan[];
  /** 相邻时间段之间的休息间隔（如午休 / 晚餐），计加班时要扣除 */
  gaps: ShiftSpan[];
  crossDay: boolean;
}

/** 校验时间段：格式正确、非零长度、互不重叠（按班次开始时间归一化后判断） */
export function validateSegments(segments: ShiftSegmentValue[]): string | null {
  if (!Array.isArray(segments) || segments.length === 0) return '至少需要一个班次时间段';
  const normalized: Array<{ start: number; end: number }> = [];
  for (const seg of segments) {
    const s = hmToMinutes(seg?.start);
    const e = hmToMinutes(seg?.end);
    if (Number.isNaN(s) || Number.isNaN(e)) return '时间格式必须为 HH:mm';
    if (s === e) return `时间段 ${seg.start}-${seg.end} 长度为 0`;
    normalized.push({ start: s, end: e });
  }
  const first = normalized[0].start;
  const rel = normalized
    .map((n) => ({
      start: (n.start - first + DAY_MINUTES) % DAY_MINUTES,
      end: (n.end - first + DAY_MINUTES) % DAY_MINUTES
    }))
    .sort((a, b) => a.start - b.start);
  for (const r of rel) {
    if (r.end <= r.start) return '时间段不能跨越自身起点（请拆成两段）';
  }
  for (let i = 1; i < rel.length; i += 1) {
    if (rel[i].start < rel[i - 1].end) return '班次时间段不能重叠';
  }
  return null;
}

/** 根据班次开始日期构造真实时间窗口 */
export function buildShiftWindow(date: string, segments: ShiftSegmentValue[]): ShiftWindow {
  const firstStart = hmToMinutes(segments[0].start);
  const base = parseDateOnly(date);
  const start = addMinutes(base, firstStart);
  const spans = segments
    .map((seg) => {
      const relStart = (hmToMinutes(seg.start) - firstStart + DAY_MINUTES) % DAY_MINUTES;
      const relEnd = (hmToMinutes(seg.end) - firstStart + DAY_MINUTES) % DAY_MINUTES;
      return { relStart, relEnd, seg };
    })
    .filter((s) => s.relEnd > s.relStart)
    .sort((a, b) => a.relStart - b.relStart)
    .map((s) => ({
      start: addMinutes(start, s.relStart),
      end: addMinutes(start, s.relEnd)
    }));
  if (spans.length === 0) throw new Error('班次时间段无效');
  const end = spans[spans.length - 1].end;
  const gaps: ShiftSpan[] = [];
  for (let i = 1; i < spans.length; i += 1) {
    if (spans[i].start.getTime() > spans[i - 1].end.getTime()) {
      gaps.push({ start: spans[i - 1].end, end: spans[i].start });
    }
  }
  return {
    date,
    start,
    end,
    spans,
    gaps,
    crossDay: end.getTime() - start.getTime() > DAY_MINUTES * MINUTES_MS
  };
}

/** 打卡时间到班次窗口的距离（毫秒），窗口内为 0 */
function distanceToWindow(time: Date, window: ShiftWindow): number {
  if (time < window.start) return window.start.getTime() - time.getTime();
  if (time > window.end) return time.getTime() - window.end.getTime();
  return 0;
}

function overlapMs(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): number {
  const start = Math.max(aStart.getTime(), bStart.getTime());
  const end = Math.min(aEnd.getTime(), bEnd.getTime());
  return Math.max(0, end - start);
}

interface Alignment {
  count: number;
  distance: number;
  choice: 'match' | 'skipPunch' | 'skipPoint';
}

/** 匹配数多的优先；数量相同则总偏差小的优先 */
function isBetter(a: Alignment, b: Alignment): boolean {
  if (a.count !== b.count) return a.count > b.count;
  return a.distance < b.distance;
}

/**
 * 正常下班时间：从班次开始依次累加各时间段，累计到标准工时的那一刻。
 * 之后的部分算加班时段，不参与早退判断。标准工时超过班次总时长时取班次结束。
 */
export function regularEndOf(window: ShiftWindow, standardMinutes: number): Date {
  let remaining = Math.max(0, standardMinutes) * MINUTES_MS;
  for (const span of window.spans) {
    const duration = span.end.getTime() - span.start.getTime();
    if (remaining <= duration) return new Date(span.start.getTime() + remaining);
    remaining -= duration;
  }
  return window.end;
}

interface SegmentAlignment {
  segments: DailySegmentDetail[];
  /** 正常班次时段内仍然空着的应打卡点，如「第 2 段上班」 */
  missingPoints: string[];
}

/**
 * 把打卡分配到每个班次时间段的「上班 / 下班」两个应打卡点。
 *
 * 打卡时间通常会比班次边界早/晚几分钟（例如 7:19 打 7:30 的上班卡），
 * 因此不要求打卡落在时间段内，而是把「打卡序列」和「应打卡点序列」做
 * 一次整体最优对齐：匹配数尽量多、总偏差尽量小，且顺序不能乱。
 *
 * 这样同一次打卡重复刷两下（如 16:47:03 / 16:47:32）只会占用一个应打卡点，
 * 多余的那次被跳过；某个应打卡点确实没有打卡时留空，不硬塞相邻打卡。
 */
function buildSegmentDetail(
  window: ShiftWindow,
  times: Date[],
  standardMinutes: number
): SegmentAlignment {
  /** 上班最多提前/延后 90 分钟，下班最多提前/延后 240 分钟 */
  const IN_TOLERANCE_MS = 90 * MINUTES_MS;
  const OUT_TOLERANCE_MS = 240 * MINUTES_MS;

  const expected = window.spans.flatMap((span, index) => ([
    { index, side: 'in' as const, at: span.start },
    { index, side: 'out' as const, at: span.end }
  ]));

  // 同一次刷卡重复刷两下（间隔 ≤ 3 分钟）合并成一次：上班取先刷的那次，下班取后刷的那次
  const DUPLICATE_WINDOW_MS = 3 * MINUTES_MS;
  const clusters: Array<{ first: Date; last: Date }> = [];
  for (const time of times) {
    const current = clusters[clusters.length - 1];
    if (current && time.getTime() - current.first.getTime() <= DUPLICATE_WINDOW_MS) current.last = time;
    else clusters.push({ first: time, last: time });
  }

  const n = clusters.length;
  const m = expected.length;
  const punchAt = (i: number, j: number) => (expected[j].side === 'in' ? clusters[i].first : clusters[i].last);
  const toleranceAt = (j: number) => (expected[j].side === 'in' ? IN_TOLERANCE_MS : OUT_TOLERANCE_MS);

  const memo = new Map<number, Alignment>();
  const solve = (i: number, j: number): Alignment => {
    if (i >= n || j >= m) return { count: 0, distance: 0, choice: 'skipPoint' };
    const key = i * (m + 1) + j;
    const cached = memo.get(key);
    if (cached) return cached;

    let best: Alignment = { ...solve(i + 1, j), choice: 'skipPunch' };
    const skipPoint = solve(i, j + 1);
    if (isBetter(skipPoint, best)) best = { ...skipPoint, choice: 'skipPoint' };

    const distance = Math.abs(punchAt(i, j).getTime() - expected[j].at.getTime());
    if (distance <= toleranceAt(j)) {
      const rest = solve(i + 1, j + 1);
      const matched = { count: rest.count + 1, distance: rest.distance + distance, choice: 'match' as const };
      if (isBetter(matched, best)) best = matched;
    }
    memo.set(key, best);
    return best;
  };

  const picked = new Map<string, Date>();
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    const step = solve(i, j).choice;
    if (step === 'match') {
      picked.set(`${expected[j].index}-${expected[j].side}`, punchAt(i, j));
      i += 1;
      j += 1;
    } else if (step === 'skipPunch') {
      i += 1;
    } else {
      j += 1;
    }
  }

  const segments = window.spans.map((span, index) => {
    const punchIn = picked.get(`${index}-in`) ?? null;
    const punchOut = picked.get(`${index}-out`) ?? null;
    const minutes = punchIn && punchOut
      ? Math.round((punchOut.getTime() - punchIn.getTime()) / MINUTES_MS)
      : 0;
    return {
      start: formatTime(span.start).slice(0, 5),
      end: formatTime(span.end).slice(0, 5),
      in: punchIn ? formatTime(punchIn) : null,
      out: punchOut ? formatTime(punchOut) : null,
      minutes,
      missing: !punchIn || !punchOut
    };
  });

  // 加班时段可以没有打卡：只把「正常下班时间」之前的空缺算作缺卡。
  const regularEndMs = regularEndOf(window, standardMinutes).getTime();
  const missingPoints = expected
    .filter((point) => !picked.has(`${point.index}-${point.side}`) && point.at.getTime() <= regularEndMs)
    .map((point) => `第 ${point.index + 1} 段${point.side === 'in' ? '上班' : '下班'}`);

  return { segments, missingPoints };
}

function calcGroup(
  window: ShiftWindow,
  config: NamedShiftConfig,
  punches: PunchInput[],
  otRanges: Array<{ start: Date; end: Date; otCode: string | null }> = []
): DailyResult {
  const times = punches.map((p) => parseDateTime(p.punchAt)).sort((a, b) => a.getTime() - b.getTime());
  const first = times[0];
  const last = times[times.length - 1];

  let normalMs = 0;
  for (const span of window.spans) {
    normalMs += overlapMs(first, last, span.start, span.end);
  }
  const extraMs = Math.max(0, last.getTime() - window.end.getTime());
  const workMs = normalMs + extraMs;
  const workMinutes = Math.floor(workMs / MINUTES_MS);

  const { segments, missingPoints } = buildSegmentDetail(window, times, config.standardMinutes);
  const regularEnd = regularEndOf(window, config.standardMinutes);
  const punchCount = punches.length;
  const sample = punches[0];

  // 有 OT 申请：按申请区间裁剪后的实际打卡全部算加班，不判迟到 / 早退；缺卡仍记录
  const applied = otRanges.filter((range) => (
    range.start.getTime() < window.end.getTime() && range.end.getTime() > window.start.getTime()
  ));
  if (applied.length) {
    let otMs = 0;
    let breakMs = 0;
    for (const range of applied) {
      const startMs = Math.max(first.getTime(), range.start.getTime());
      const endMs = Math.min(last.getTime(), range.end.getTime());
      if (endMs <= startMs) continue;
      let spanMs = endMs - startMs;
      // 扣除班次时间段之间的休息（午休 / 晚餐），休息不计入加班
      for (const gap of window.gaps) {
        const cut = Math.max(0, Math.min(endMs, gap.end.getTime()) - Math.max(startMs, gap.start.getTime()));
        spanMs -= cut;
        breakMs += cut;
      }
      otMs += Math.max(0, spanMs);
    }
    // 先按分钟取整再折算 30 分钟，避免打卡差几十秒（如 07:30:26）白丢半小时
    const otMinutes = Math.round(otMs / MINUTES_MS);
    const overtimeMinutes = Math.floor(otMinutes / OVERTIME_UNIT_MINUTES) * OVERTIME_UNIT_MINUTES;
    const breakMinutes = Math.floor(breakMs / MINUTES_MS);
    const rangeText = applied
      .map((range) => `${formatTime(range.start).slice(0, 5)}-${formatTime(range.end).slice(0, 5)}`)
      .join('、');
    const codeText = applied.map((range) => range.otCode).filter(Boolean)[0];
    const breakText = breakMinutes > 0 ? `（已扣休息 ${breakMinutes} 分钟）` : '';
    const missingText = missingPoints.length ? `；缺卡：${missingPoints.join('、')}` : '';
    return {
      workDate: window.date,
      employeeNo: sample.employeeNo,
      employeeName: sample.employeeName,
      department: sample.department,
      shiftCode: config.code || null,
      shiftName: config.name ?? null,
      firstIn: formatTime(first),
      lastOut: formatTime(last),
      punchCount,
      standardMinutes: 0,
      normalMinutes: 0,
      workMinutes,
      overtimeMinutes,
      lateMinutes: 0,
      earlyMinutes: 0,
      status: 'OT加班',
      abnormal: `OT 申请 ${rangeText}${codeText ? `（${codeText}）` : ''}，全天计加班${breakText}${missingText}`,
      segments
    };
  }

  const overtimeMinutes = Math.floor(
    Math.max(0, workMinutes - config.standardMinutes) / OVERTIME_UNIT_MINUTES
  ) * OVERTIME_UNIT_MINUTES;

  const lateMinutes = first.getTime() > window.start.getTime()
    ? Math.ceil((first.getTime() - window.start.getTime()) / MINUTES_MS)
    : 0;
  // 早退只看正常班次时段：加班时段（正常下班时间之后）没打满不算早退。
  const earlyMinutes = last.getTime() < regularEnd.getTime()
    ? Math.ceil((regularEnd.getTime() - last.getTime()) / MINUTES_MS)
    : 0;

  // 正常班次时段内有应打卡点没打才算缺卡；加班时段的空缺不计。
  const missingCard = missingPoints.length > 0;

  let status = '正常';
  if (missingCard) status = '缺卡';
  else if (lateMinutes > 0 && earlyMinutes > 0) status = '迟到/早退';
  else if (lateMinutes > 0) status = '迟到';
  else if (earlyMinutes > 0) status = '早退';
  else if (workMinutes === 0) status = '异常';

  const reasons: string[] = [];
  if (lateMinutes > 0) reasons.push(`迟到 ${lateMinutes} 分钟`);
  if (earlyMinutes > 0) reasons.push(`早退 ${earlyMinutes} 分钟`);
  if (missingCard) reasons.push(`缺卡：${missingPoints.join('、')}`);

  return {
    workDate: window.date,
    employeeNo: sample.employeeNo,
    employeeName: sample.employeeName,
    department: sample.department,
    shiftCode: config.code || null,
    shiftName: config.name ?? null,
    firstIn: formatTime(first),
    lastOut: formatTime(last),
    punchCount,
    standardMinutes: config.standardMinutes,
    normalMinutes: Math.floor(normalMs / MINUTES_MS),
    workMinutes,
    overtimeMinutes,
    lateMinutes,
    earlyMinutes,
    status,
    abnormal: reasons.length ? reasons.join('；') : null,
    segments
  };
}

/**
 * 多班次计算：每条打卡按自带的 shiftCode 匹配班次；为空则使用 defaultShift。
 *
 * 先为每条打卡的班次准备「当天及前后各一天」的窗口，再把打卡分配给距离最近的
 * 窗口 —— 跨天夜班（如 M21 20:00-08:00）的次日凌晨打卡会落到前一天。
 * 分组键包含班次编码，因此同一天同一员工如果跨两个班次，会分别生成两行。
 */
export function computeDailyResultsForShifts(
  shifts: NamedShiftConfig[],
  punches: PunchInput[],
  defaultShift?: NamedShiftConfig,
  otApplications: OtApplicationInput[] = []
): DailyResult[] {
  if (!punches.length) return [];

  for (const shift of shifts) {
    const error = validateSegments(shift.segments);
    if (error) throw new Error(`班次 ${shift.code}：${error}`);
  }

  const normalizeCode = (code: string) => code.trim().toUpperCase();
  const byCode = new Map(shifts.map((s) => [normalizeCode(s.code), s]));
  const otByEmployee = new Map<string, OtApplicationInput[]>();
  for (const app of otApplications) {
    // OT 表工号常见 8 位补零（00119260），打卡文件用 6 位（119260），按去零后的键匹配
    const key = normalizeEmployeeNo(app.employeeNo);
    const list = otByEmployee.get(key);
    if (list) list.push(app);
    else otByEmployee.set(key, [app]);
  }
  const windowCache = new Map<string, ShiftWindow>();
  const getWindow = (code: string, date: string) => {
    const key = `${code}|${date}`;
    let w = windowCache.get(key);
    if (!w) {
      const shift = byCode.get(normalizeCode(code));
      if (!shift) throw new Error(`班次「${code}」未配置`);
      w = buildShiftWindow(date, shift.segments);
      windowCache.set(key, w);
    }
    return w;
  };

  const groups = new Map<string, { window: ShiftWindow; shift: NamedShiftConfig; punches: PunchInput[] }>();
  for (const punch of punches) {
    const rawCode = punch.shiftCode?.trim();
    const code = rawCode || (defaultShift ? defaultShift.code : '');
    const shift = byCode.get(normalizeCode(code));
    if (!shift) {
      throw new Error(`班次「${rawCode || code || '空'}」未配置，请先在「班次管理」中维护`);
    }
    const time = parseDateTime(punch.punchAt);
    const day = formatDate(time);
    const candidates = [addDays(day, -1), day, addDays(day, 1)].map((d) => getWindow(shift.code, d));
    let best = candidates[0];
    let bestDistance = distanceToWindow(time, best);
    for (const candidate of candidates.slice(1)) {
      const distance = distanceToWindow(time, candidate);
      if (distance < bestDistance) {
        best = candidate;
        bestDistance = distance;
      }
    }
    const key = `${shift.code}|${best.date}|${punch.employeeNo}`;
    const bucket = groups.get(key);
    if (bucket) bucket.punches.push(punch);
    else groups.set(key, { window: best, shift, punches: [punch] });
  }

  return Array.from(groups.values())
    .map(({ window, shift, punches: list }) => {
      const employeeNo = list[0].employeeNo;
      const ranges = (otByEmployee.get(normalizeEmployeeNo(employeeNo)) ?? []).map((r) => ({
        start: parseDateTime(r.startAt),
        end: parseDateTime(r.endAt),
        otCode: r.otCode ?? null
      }));
      return calcGroup(window, shift, list, ranges);
    })
    .sort((a, b) => {
      if (a.workDate !== b.workDate) return a.workDate.localeCompare(b.workDate);
      if (a.employeeNo !== b.employeeNo) return a.employeeNo.localeCompare(b.employeeNo);
      return (a.shiftCode ?? '').localeCompare(b.shiftCode ?? '');
    });
}

/** 单班次计算的便捷入口（默认班次逻辑、历史调用与单测使用）。 */
export function computeDailyResults(
  config: ShiftConfig,
  punches: PunchInput[],
  otApplications: OtApplicationInput[] = []
): DailyResult[] {
  const shift: NamedShiftConfig = { ...config, code: 'DEFAULT', name: '默认班次' };
  return computeDailyResultsForShifts([shift], punches, shift, otApplications);
}
