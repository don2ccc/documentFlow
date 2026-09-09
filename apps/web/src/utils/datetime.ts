const BEIJING_OFFSET_MINUTES = 8 * 60;

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

// Parse various backend timestamp shapes into a UTC ms value.
// Accepts: ISO 8601 with/without offset/Z, JS Date.toString(), and "M/D/YYYY h:mm:ss [AM|PM]".
function parseToUtcMs(value: string): number | null {
  if (!value) return null;
  // ISO 8601 with explicit offset/Z is handled correctly by Date.parse.
  const isoMatch = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:?\d{2})?$/.test(value);
  if (isoMatch) {
    const t = Date.parse(value);
    if (!Number.isNaN(t)) return t;
  }
  // Windows-style: "9/9/2026 12:29:21 PM"
  const win = /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})\s*(AM|PM)?$/i.exec(value);
  if (win) {
    let month = parseInt(win[1], 10);
    const day = parseInt(win[2], 10);
    const year = parseInt(win[3], 10);
    let hour = parseInt(win[4], 10);
    const minute = parseInt(win[5], 10);
    const second = parseInt(win[6], 10);
    const ampm = (win[7] || '').toUpperCase();
    if (ampm === 'PM' && hour < 12) hour += 12;
    if (ampm === 'AM' && hour === 12) hour = 0;
    // Backend currently emits these in server-local time; we treat the literal digits as Beijing time.
    const asUtc = Date.UTC(year, month - 1, day, hour, minute, second);
    return asUtc - BEIJING_OFFSET_MINUTES * 60_000;
  }
  // Fallback: let Date try.
  const t = Date.parse(value);
  return Number.isNaN(t) ? null : t;
}

function toBeijingParts(value: string | Date | null | undefined): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
} | null {
  if (value === null || value === undefined || value === '') return null;
  const d0 = value instanceof Date ? value : parseToUtcMs(value);
  if (d0 === null) return null;
  const d: number = typeof d0 === 'number' ? d0 : d0.getTime();
  const beijingMs = d + BEIJING_OFFSET_MINUTES * 60_000;
  const b = new Date(beijingMs);
  return {
    year: b.getUTCFullYear(),
    month: b.getUTCMonth() + 1,
    day: b.getUTCDate(),
    hour: b.getUTCHours(),
    minute: b.getUTCMinutes(),
    second: b.getUTCSeconds()
  };
}

export function formatDateTime(
  value: string | Date | null | undefined,
  fallback = '-'
): string {
  const p = toBeijingParts(value);
  if (!p) return fallback;
  return `${p.year}-${pad(p.month)}-${pad(p.day)} ${pad(p.hour)}:${pad(p.minute)}:${pad(p.second)}`;
}

export function formatDate(
  value: string | Date | null | undefined,
  fallback = '-'
): string {
  const p = toBeijingParts(value);
  if (!p) return fallback;
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

export function formatDateMinute(
  value: string | Date | null | undefined,
  fallback = '-'
): string {
  const p = toBeijingParts(value);
  if (!p) return fallback;
  return `${p.year}-${pad(p.month)}-${pad(p.day)} ${pad(p.hour)}:${pad(p.minute)}`;
}
