import * as XLSX from 'xlsx';

/**
 * 中控考勤机导出的原始数据解析。
 *
 * 兼容的列名（不区分顺序，按表头文字匹配）：
 *   部门 / 姓名 / 考勤号码（或工号、员工编号）/ 日期时间（或打卡时间）/ 机器号 / 班次
 * 日期支持 "2026/10/25 7:20:54"、"2026-10-25 07:20:54"、Excel 日期单元格。
 */

export interface ParsedPunch {
  employeeNo: string;
  employeeName: string;
  department: string | null;
  machine: string | null;
  punchAt: string;
  /** 「班次」列的值（如 M10），没有该列时为 null */
  shiftCode: string | null;
}

/** OT（加班）申请表的一行：某员工某天申请的加班起止时间 */
export interface ParsedOtApplication {
  employeeNo: string;
  employeeName: string | null;
  /** YYYY-MM-DD HH:mm:ss */
  startAt: string;
  /** YYYY-MM-DD HH:mm:ss */
  endAt: string;
  /** 加班代码，如 OTS */
  otCode: string | null;
  /** 整班班值（原表里的可选列） */
  shiftCode: string | null;
}

export interface ParseResult {
  punches: ParsedPunch[];
  skipped: number;
  sheetName: string;
  totalRows: number;
  shiftCodes: string[];
  blankShiftCount: number;
  /** 同一个工作簿里的「OT申请」表，没有则为空数组 */
  otApplications: ParsedOtApplication[];
  otSheetName: string | null;
  /** OT 行里无法解析的条数 */
  otSkipped: number;
}

const HEADER_ALIASES = {
  department: ['部门', '单位', '部門', 'dept', 'department'],
  name: ['姓名', '员工姓名', '人员姓名', 'name'],
  employeeNo: ['考勤号码', '考勤号', '工号', '员工编号', '员工工号', '考勤编号', '编号'],
  punchAt: ['日期时间', '打卡时间', '时间', '刷卡时间', '考勤时间'],
  machine: ['机器号', '设备号', '机器', 'device'],
  shiftCode: ['班次', '班次编码', '班次名称', '班次代码', 'shift', 'shiftcode']
} as const;

type HeaderKey = keyof typeof HEADER_ALIASES;

function normalizeHeader(value: unknown): string {
  return String(value ?? '').replace(/\s+/g, '').trim();
}

function matchHeader(value: unknown): HeaderKey | null {
  const text = normalizeHeader(value).toLowerCase();
  if (!text) return null;
  for (const key of Object.keys(HEADER_ALIASES) as HeaderKey[]) {
    if (HEADER_ALIASES[key].some((alias) => text === alias.toLowerCase())) return key;
  }
  return null;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** 统一输出 YYYY-MM-DD HH:mm:ss */
export function normalizeDateTime(value: unknown): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())} ` +
      `${pad(value.getHours())}:${pad(value.getMinutes())}:${pad(value.getSeconds())}`;
  }
  const text = String(value ?? '').trim();
  if (!text) return null;

  const m = /^(\d{4})[\/.\-](\d{1,2})[\/.\-](\d{1,2})[ T]+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?/.exec(text);
  if (m) {
    const [, y, mo, d, h, mi, s] = m;
    const month = Number(mo);
    const day = Number(d);
    const hour = Number(h);
    const minute = Number(mi);
    if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59) return null;
    return `${y}-${pad(month)}-${pad(day)} ${pad(hour)}:${pad(minute)}:${pad(Number(s ?? 0))}`;
  }

  // Excel 序列号（例如 45678.5）
  const serial = Number(text);
  if (Number.isFinite(serial) && serial > 20000 && serial < 80000) {
    const parsed = XLSX.SSF.parse_date_code(serial);
    if (parsed) {
      return `${parsed.y}-${pad(parsed.m)}-${pad(parsed.d)} ` +
        `${pad(parsed.H)}:${pad(parsed.M)}:${pad(Math.floor(parsed.S))}`;
    }
  }
  return null;
}

function clean(value: unknown): string {
  return String(value ?? '').replace(/\u00a0/g, ' ').trim();
}

function cleanEmployeeNo(value: unknown): string {
  return clean(value).replace(/\.0+$/, '');
}

/** 解析「日期」单元格，输出 YYYY-MM-DD；无法识别返回 null */
export function parseLooseDate(value: unknown): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
  }
  const text = clean(value);
  if (!text) return null;
  const ymd = /^(\d{4})[\/.\-](\d{1,2})[\/.\-](\d{1,2})$/.exec(text);
  if (ymd) return `${ymd[1]}-${pad(Number(ymd[2]))}-${pad(Number(ymd[3]))}`;
  // 01/11/2026 这类：日/月/年（第二段大于 12 时按 月/日/年 处理）
  const dmy = /^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})$/.exec(text);
  if (dmy) {
    const a = Number(dmy[1]);
    const b = Number(dmy[2]);
    // 日/月/年 与 月/日/年 都合法时按「日/月/年」处理（SAP 等系统常见导出格式）
    const day = a > 12 ? a : (b > 12 ? b : a);
    const month = a > 12 ? b : (b > 12 ? a : b);
    if (day < 1 || day > 31 || month < 1 || month > 12) return null;
    return `${dmy[3]}-${pad(month)}-${pad(day)}`;
  }
  const serial = Number(text);
  if (Number.isFinite(serial) && serial > 20000 && serial < 80000) {
    const parsed = XLSX.SSF.parse_date_code(serial);
    if (parsed) return `${parsed.y}-${pad(parsed.m)}-${pad(parsed.d)}`;
  }
  return null;
}

/** 解析「时间」单元格，输出 HH:mm:ss；无法识别返回 null */
export function parseLooseTime(value: unknown): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${pad(value.getHours())}:${pad(value.getMinutes())}:${pad(value.getSeconds())}`;
  }
  const text = clean(value);
  if (!text) return null;
  const hm = /^(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?$/.exec(text);
  if (hm) {
    const h = Number(hm[1]);
    const mi = Number(hm[2]);
    const s = Number(hm[3] ?? 0);
    if (h > 23 || mi > 59 || s > 59) return null;
    return `${pad(h)}:${pad(mi)}:${pad(s)}`;
  }
  // Excel 时间序列号（0~1 的小数）或带日期的序列号
  const serial = Number(text);
  if (Number.isFinite(serial)) {
    const frac = serial - Math.floor(serial);
    if (serial >= 0 && serial < 80000 && frac > 0) {
      const total = Math.round(frac * 24 * 60);
      return `${pad(Math.floor(total / 60) % 24)}:${pad(total % 60)}:00`;
    }
  }
  return null;
}

const OT_HEADER_ALIASES = {
  employeeNo: ['员工编号', '工号', '考勤号码', '员工工号', '人员编号'],
  name: ['员工姓名', '姓名'],
  startDate: ['开始日期', '加班开始日期'],
  startTime: ['开始时间', '加班开始时间'],
  endDate: ['结束日期', '加班结束日期'],
  endTime: ['结束时间', '加班结束时间'],
  shiftCode: ['整班班值', '班次班值', '班次'],
  otCode: ['加班代码', '加班类型', 'OT代码']
} as const;

type OtHeaderKey = keyof typeof OT_HEADER_ALIASES;

function matchOtHeader(value: unknown): OtHeaderKey | null {
  const text = normalizeHeader(value).toLowerCase();
  if (!text) return null;
  for (const key of Object.keys(OT_HEADER_ALIASES) as OtHeaderKey[]) {
    if (OT_HEADER_ALIASES[key].some((alias) => text === alias.toLowerCase())) return key;
  }
  return null;
}

/** 在工作簿里找「OT申请」表：表头需要包含员工编号 + 开始/结束日期时间 */
export function parseOtApplications(workbook: XLSX.WorkBook): {
  rows: ParsedOtApplication[];
  sheetName: string | null;
  skipped: number;
} {
  for (const name of workbook.SheetNames) {
    const matrix = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[name], {
      header: 1, raw: false, defval: ''
    });
    for (let i = 0; i < Math.min(matrix.length, 10); i += 1) {
      const map: Partial<Record<OtHeaderKey, number>> = {};
      matrix[i].forEach((cell, index) => {
        const key = matchOtHeader(cell);
        if (key && map[key] === undefined) map[key] = index;
      });
      const looksLikeOt = map.employeeNo !== undefined
        && map.startDate !== undefined && map.startTime !== undefined
        && map.endDate !== undefined && map.endTime !== undefined;
      if (!looksLikeOt) continue;

      const rows: ParsedOtApplication[] = [];
      let skipped = 0;
      for (let r = i + 1; r < matrix.length; r += 1) {
        const row = matrix[r];
        const employeeNo = cleanEmployeeNo(row[map.employeeNo as number]);
        if (!employeeNo) {
          if (row.some((cell) => clean(cell))) skipped += 1;
          continue;
        }
        const startDate = parseLooseDate(row[map.startDate as number]);
        const startTime = parseLooseTime(row[map.startTime as number]);
        const endDate = parseLooseDate(row[map.endDate as number]);
        const endTime = parseLooseTime(row[map.endTime as number]);
        if (!startDate || !startTime || !endDate || !endTime) {
          skipped += 1;
          continue;
        }
        rows.push({
          employeeNo,
          employeeName: map.name === undefined ? null : clean(row[map.name]) || null,
          startAt: `${startDate} ${startTime}`,
          endAt: `${endDate} ${endTime}`,
          otCode: map.otCode === undefined ? null : clean(row[map.otCode]) || null,
          shiftCode: map.shiftCode === undefined ? null : clean(row[map.shiftCode]) || null
        });
      }
      return { rows, sheetName: name, skipped };
    }
  }
  return { rows: [], sheetName: null, skipped: 0 };
}

export function parseAttendanceFile(buffer: Buffer): ParseResult {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  if (!workbook.SheetNames.length) throw new Error('Excel 里没有任何工作表');

  // 优先找带「日期时间 + 姓名」表头的工作表（原始打卡表通常是第一个）
  let sheetName = workbook.SheetNames[0];
  let headerRowIndex = -1;
  let columns: Partial<Record<HeaderKey, number>> = {};
  let rows: unknown[][] = [];

  for (const name of workbook.SheetNames) {
    const sheet = workbook.Sheets[name];
    const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: false, defval: '' });
    for (let i = 0; i < Math.min(matrix.length, 10); i += 1) {
      const map: Partial<Record<HeaderKey, number>> = {};
      matrix[i].forEach((cell, index) => {
        const key = matchHeader(cell);
        if (key && map[key] === undefined) map[key] = index;
      });
      if (map.punchAt !== undefined && map.name !== undefined) {
        sheetName = name;
        headerRowIndex = i;
        columns = map;
        rows = matrix;
        break;
      }
    }
    if (headerRowIndex >= 0) break;
  }

  if (headerRowIndex < 0) {
    throw new Error('未找到表头：需要包含「姓名」「日期时间」两列，例如中控考勤机导出的原卡数据');
  }
  if (columns.employeeNo === undefined) {
    throw new Error('未找到「考勤号码」列，无法区分员工');
  }

  const punches: ParsedPunch[] = [];
  const seen = new Set<string>();
  const shiftCodeSet = new Set<string>();
  let blankShiftCount = 0;
  let skipped = 0;

  for (let i = headerRowIndex + 1; i < rows.length; i += 1) {
    const row = rows[i];
    const name = clean(row[columns.name as number]);
    const employeeNo = cleanEmployeeNo(row[columns.employeeNo as number]);
    const punchAt = normalizeDateTime(row[columns.punchAt as number]);
    if (!employeeNo || !name || !punchAt) {
      if (row.some((cell) => clean(cell))) skipped += 1;
      continue;
    }
    const key = `${employeeNo}|${punchAt}`;
    if (seen.has(key)) {
      skipped += 1;
      continue;
    }
    seen.add(key);
    const shiftCode = columns.shiftCode === undefined ? null : clean(row[columns.shiftCode]) || null;
    if (shiftCode) shiftCodeSet.add(shiftCode);
    else blankShiftCount += 1;
    punches.push({
      employeeNo,
      employeeName: name,
      department: columns.department === undefined ? null : clean(row[columns.department]) || null,
      machine: columns.machine === undefined ? null : clean(row[columns.machine]) || null,
      punchAt,
      shiftCode
    });
  }

  const ot = parseOtApplications(workbook);

  return {
    punches,
    skipped,
    sheetName,
    totalRows: Math.max(0, rows.length - headerRowIndex - 1),
    shiftCodes: Array.from(shiftCodeSet).sort(),
    blankShiftCount,
    otApplications: ot.rows,
    otSheetName: ot.sheetName,
    otSkipped: ot.skipped
  };
}

export interface ExportDailyRow {
  workDate: string;
  employeeNo: string;
  employeeName: string;
  department: string | null;
  shiftCode: string | null;
  shiftName: string | null;
  firstIn: string | null;
  lastOut: string | null;
  punchCount: number;
  standardMinutes: number;
  workMinutes: number;
  overtimeMinutes: number;
  lateMinutes: number;
  earlyMinutes: number;
  status: string;
  abnormal: string | null;
  segments: Array<{
    start: string;
    end: string;
    in: string | null;
    out: string | null;
    minutes: number;
    missing: boolean;
  }>;
}

const toHours = (minutes: number) => Number((minutes / 60).toFixed(2));

export function buildAttendanceExport(rows: ExportDailyRow[]): Buffer {
  const segmentCount = Math.min(6, Math.max(1, ...rows.map((r) => r.segments?.length ?? 0)));
  const segmentHeader = Array.from({ length: segmentCount }, (_, i) => ([
    `第${i + 1}段上班`, `第${i + 1}段下班`
  ])).flat();
  const header = [
    '排班日期', '工号', '姓名', '部门', '班次', ...segmentHeader, '打卡次数',
    '正常工时(小时)', '工作时长(小时)', '加班时长(小时)', '迟到(分钟)', '早退(分钟)', '状态', '备注'
  ];
  const body = rows.map((r) => {
    const punches = Array.from({ length: segmentCount }, (_, i) => {
      const segment = r.segments?.[i];
      return [segment?.in ?? '', segment?.out ?? ''];
    }).flat();
    return [
      r.workDate, r.employeeNo, r.employeeName, r.department ?? '',
      [r.shiftCode, r.shiftName].filter(Boolean).join(' '),
      ...punches, r.punchCount,
      toHours(r.standardMinutes), toHours(r.workMinutes), toHours(r.overtimeMinutes), r.lateMinutes, r.earlyMinutes,
      r.status, r.abnormal ?? ''
    ];
  });
  const sheet = XLSX.utils.aoa_to_sheet([header, ...body]);
  sheet['!cols'] = [
    { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 14 }, { wch: 18 },
    ...Array.from({ length: segmentCount * 2 }, () => ({ wch: 12 })),
    { wch: 8 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 36 }
  ];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, '考勤结果');
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}
