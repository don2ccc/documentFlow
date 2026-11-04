import { DailySegmentDetail } from './entities/attendance-daily.entity';
import { ShiftSegmentValue } from './entities/attendance-shift.entity';

/**
 * 考勤计算核心（纯函数，不碰数据库，便于单测）。
 *
 * 计算口径（与业务确认过）：
 *   1. 原始数据里带「班次」列时按每行班次分别计算；没有该列时整批使用默认班次；
 *   2. 迟到 / 早退 0 分钟宽限，按秒向上取整到分钟；
 *   3. 工作时长 = 打卡区间与前班次各时间段的交集之和，加上班次结束后的时间；
 *   4. 加班时长 = 工作时长 - 标准工时（不足 0 记 0）；
 *   5. 打卡次数为奇数（含只打 1 次）视为缺卡，工时仍按实际打卡计算。
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
  return {
    date,
    start,
    end,
    spans,
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

function buildSegmentDetail(window: ShiftWindow, times: Date[]): DailySegmentDetail[] {
  return window.spans.map((span) => {
    const inside = times.filter((t) => t >= span.start && t <= span.end);
    const minutes = inside.length >= 2
      ? Math.round((inside[inside.length - 1].getTime() - inside[0].getTime()) / MINUTES_MS)
      : 0;
    return {
      start: formatTime(span.start).slice(0, 5),
      end: formatTime(span.end).slice(0, 5),
      in: inside.length ? formatTime(inside[0]) : null,
      out: inside.length ? formatTime(inside[inside.length - 1]) : null,
      minutes,
      missing: inside.length === 0
    };
  });
}

function calcGroup(window: ShiftWindow, config: NamedShiftConfig, punches: PunchInput[]): DailyResult {
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
  const overtimeMinutes = Math.max(0, workMinutes - config.standardMinutes);

  const lateMinutes = first.getTime() > window.start.getTime()
    ? Math.ceil((first.getTime() - window.start.getTime()) / MINUTES_MS)
    : 0;
  const earlyMinutes = last.getTime() < window.end.getTime()
    ? Math.ceil((window.end.getTime() - last.getTime()) / MINUTES_MS)
    : 0;

  const punchCount = punches.length;
  // 奇数说明有一次打卡没有配对（只打一次、漏打下班卡等）。偶数视为正常进出。
  const missingCard = punchCount % 2 === 1;

  let status = '正常';
  if (missingCard) status = '缺卡';
  else if (lateMinutes > 0 && earlyMinutes > 0) status = '迟到/早退';
  else if (lateMinutes > 0) status = '迟到';
  else if (earlyMinutes > 0) status = '早退';
  else if (workMinutes === 0) status = '异常';

  const reasons: string[] = [];
  if (lateMinutes > 0) reasons.push(`迟到 ${lateMinutes} 分钟`);
  if (earlyMinutes > 0) reasons.push(`早退 ${earlyMinutes} 分钟`);
  if (missingCard) reasons.push(`打卡 ${punchCount} 次，缺少配对打卡`);

  const sample = punches[0];
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
    normalMinutes: Math.floor(normalMs / MINUTES_MS),
    workMinutes,
    overtimeMinutes,
    lateMinutes,
    earlyMinutes,
    status,
    abnormal: reasons.length ? reasons.join('；') : null,
    segments: buildSegmentDetail(window, times)
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
  defaultShift?: NamedShiftConfig
): DailyResult[] {
  if (!punches.length) return [];

  for (const shift of shifts) {
    const error = validateSegments(shift.segments);
    if (error) throw new Error(`班次 ${shift.code}：${error}`);
  }

  const normalizeCode = (code: string) => code.trim().toUpperCase();
  const byCode = new Map(shifts.map((s) => [normalizeCode(s.code), s]));
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
    .map(({ window, shift, punches: list }) => calcGroup(window, shift, list))
    .sort((a, b) => {
      if (a.workDate !== b.workDate) return a.workDate.localeCompare(b.workDate);
      if (a.employeeNo !== b.employeeNo) return a.employeeNo.localeCompare(b.employeeNo);
      return (a.shiftCode ?? '').localeCompare(b.shiftCode ?? '');
    });
}

/** 单班次计算的便捷入口（默认班次逻辑、历史调用与单测使用）。 */
export function computeDailyResults(config: ShiftConfig, punches: PunchInput[]): DailyResult[] {
  const shift: NamedShiftConfig = { ...config, code: 'DEFAULT', name: '默认班次' };
  return computeDailyResultsForShifts([shift], punches, shift);
}
