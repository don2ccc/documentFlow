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

export interface ParseResult {
  punches: ParsedPunch[];
  skipped: number;
  sheetName: string;
  totalRows: number;
  shiftCodes: string[];
  blankShiftCount: number;
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

  return {
    punches,
    skipped,
    sheetName,
    totalRows: Math.max(0, rows.length - headerRowIndex - 1),
    shiftCodes: Array.from(shiftCodeSet).sort(),
    blankShiftCount
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
  workMinutes: number;
  overtimeMinutes: number;
  lateMinutes: number;
  earlyMinutes: number;
  status: string;
  abnormal: string | null;
}

const toHours = (minutes: number) => Number((minutes / 60).toFixed(2));

export function buildAttendanceExport(rows: ExportDailyRow[]): Buffer {
  const header = [
    '排班日期', '工号', '姓名', '部门', '班次', '上班打卡', '下班打卡', '打卡次数',
    '工作时长(小时)', '加班时长(小时)', '迟到(分钟)', '早退(分钟)', '状态', '备注'
  ];
  const body = rows.map((r) => [
    r.workDate, r.employeeNo, r.employeeName, r.department ?? '',
    [r.shiftCode, r.shiftName].filter(Boolean).join(' '),
    r.firstIn ?? '', r.lastOut ?? '', r.punchCount,
    toHours(r.workMinutes), toHours(r.overtimeMinutes), r.lateMinutes, r.earlyMinutes,
    r.status, r.abnormal ?? ''
  ]);
  const sheet = XLSX.utils.aoa_to_sheet([header, ...body]);
  sheet['!cols'] = [
    { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 14 }, { wch: 18 }, { wch: 10 },
    { wch: 10 }, { wch: 8 }, { wch: 14 }, { wch: 14 }, { wch: 10 }, { wch: 10 },
    { wch: 10 }, { wch: 36 }
  ];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, '考勤结果');
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}
