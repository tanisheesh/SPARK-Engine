import type { ColumnInfo, ColumnKind, Row } from './types';

/* ============================================================
   Value coercion
   DuckDB rows arrive already sanitised (BigInt to Number) but
   dates can still surface as Date objects or {days} structs.
   ============================================================ */

export function toDate(v: unknown): Date | null {
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    if (typeof o.days === 'number') return new Date(o.days * 86400000);
    if (typeof o.micros === 'number') return new Date(o.micros / 1000);
  }
  if (typeof v === 'string') {
    // Only accept strings that genuinely look like dates — a bare "2024"
    // is a year label, not a timestamp, and must stay categorical.
    if (!/^\d{4}-\d{2}(-\d{2})?/.test(v)) return null;
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

export function toNumber(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'bigint') return Number(v);
  if (typeof v === 'string' && v.trim() !== '') {
    const cleaned = v.replace(/[$,\s%]/g, '');
    if (!/^-?\d*\.?\d+(e[-+]?\d+)?$/i.test(cleaned)) return null;
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/* ============================================================
   Display formatting
   ============================================================ */

/** 1_829_347 -> "1.83M".  Compact, for axes, tiles and chips. */
export function compactNumber(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1e12) return trimZeros(n / 1e12) + 'T';
  if (abs >= 1e9) return trimZeros(n / 1e9) + 'B';
  if (abs >= 1e6) return trimZeros(n / 1e6) + 'M';
  if (abs >= 1e3) return trimZeros(n / 1e3) + 'K';
  if (abs > 0 && abs < 0.01) return n.toExponential(1);
  return trimZeros(n);
}

function trimZeros(n: number): string {
  const s = Math.abs(n) >= 100 ? n.toFixed(0) : Math.abs(n) >= 10 ? n.toFixed(1) : n.toFixed(2);
  return s.replace(/\.?0+$/, '');
}

/** Full precision with thousands separators — for table cells. */
export function fullNumber(n: number): string {
  if (Number.isInteger(n)) return n.toLocaleString('en-US');
  const decimals = Math.abs(n) >= 1000 ? 0 : Math.abs(n) >= 1 ? 2 : 4;
  return n.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  });
}

/** 18.324 -> "18.3%" */
export function percent(n: number, digits = 1): string {
  return `${n.toFixed(digits).replace(/\.0$/, '')}%`;
}

export function signedPercent(n: number, digits = 1): string {
  return `${n > 0 ? '+' : ''}${percent(n, digits)}`;
}

export function formatDate(d: Date): string {
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

/** 340 -> "340ms";  1240 -> "1.2s" */
export function duration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
}

export function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  if (diff < 604_800_000) return `${Math.floor(diff / 86_400_000)}d ago`;
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** Format one table cell with the right alignment class implied by kind. */
export function formatCell(v: unknown, kind: ColumnKind): string {
  if (v === null || v === undefined) return '—';
  if (kind === 'numeric') {
    const n = toNumber(v);
    return n === null ? String(v) : fullNumber(n);
  }
  if (kind === 'temporal') {
    const d = toDate(v);
    return d ? formatDate(d) : String(v);
  }
  if (kind === 'boolean') return v ? 'Yes' : 'No';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

/** Turn snake_case / camelCase column names into readable headers. */
export function humanizeColumn(name: string): string {
  return name
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\w/, (c) => c.toUpperCase());
}

/* ============================================================
   Column classification — drives charts, alignment and follow-ups
   ============================================================ */

const TEMPORAL_HINT =
  /(date|time|month|year|quarter|week|day|created|updated|_at$|period)/i;

export function classifyColumns(rows: Row[]): ColumnInfo[] {
  if (!rows.length) return [];
  const names = Object.keys(rows[0]);
  const sample = rows.slice(0, 200);

  return names.map((name) => {
    const values = sample.map((r) => r[name]);
    const present = values.filter((v) => v !== null && v !== undefined);
    const nulls = values.length - present.length;
    const distinct = new Set(present.map((v) => (typeof v === 'object' ? JSON.stringify(v) : v))).size;

    let kind: ColumnKind = 'other';

    if (present.length === 0) {
      kind = 'other';
    } else if (present.every((v) => typeof v === 'boolean')) {
      kind = 'boolean';
    } else if (present.every((v) => toDate(v) !== null)) {
      kind = 'temporal';
    } else if (present.every((v) => toNumber(v) !== null)) {
      // A numeric column whose name reads as a period (year, month number)
      // is a time axis, not a measure — charting it as a bar height is wrong.
      kind = TEMPORAL_HINT.test(name) && distinct > 1 ? 'temporal' : 'numeric';
    } else {
      kind = 'categorical';
    }

    return { name, kind, distinct, nulls };
  });
}

/** Identifier-ish numeric columns must never be summed or plotted. */
export function isIdentifier(name: string): boolean {
  return /(^id$|_id$|^.*_?uuid$|^key$|_key$|^code$|zip|postal|phone)/i.test(name);
}
