/* Formatting helpers - the mobile subset of lib/spark/format.ts.
   Same behaviour, fewer functions: only what a phone screen actually renders. */

import type { Row } from './types';

export type ColumnKind = 'numeric' | 'temporal' | 'categorical' | 'boolean' | 'other';

export interface ColumnInfo {
  name: string;
  kind: ColumnKind;
  distinct: number;
  nulls: number;
}

export function toNumber(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'bigint') return Number(v);
  if (typeof v === 'string') {
    const cleaned = v.replace(/[, ]/g, '');
    if (!cleaned || !/^-?\d*\.?\d+(e[-+]?\d+)?$/i.test(cleaned)) return null;
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export function toDate(v: unknown): Date | null {
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v;
  if (typeof v === 'string') {
    // Only trust strings that actually look like dates. Letting the Date
    // constructor guess turns "12" and "Q1" into dates and produces charts
    // with a fabricated time axis.
    if (!/^\d{4}-\d{2}(-\d{2})?([ T]|$)/.test(v)) return null;
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

export function compactNumber(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1e9) return trimZero(n / 1e9) + 'B';
  if (abs >= 1e6) return trimZero(n / 1e6) + 'M';
  if (abs >= 1e4) return trimZero(n / 1e3) + 'K';
  if (Number.isInteger(n)) return n.toLocaleString('en-US');
  return trimZero(n);
}

function trimZero(n: number): string {
  return n.toFixed(1).replace(/\.0$/, '');
}

export function fullNumber(n: number): string {
  return Number.isInteger(n)
    ? n.toLocaleString('en-US')
    : n.toLocaleString('en-US', { maximumFractionDigits: 4 });
}

export function relativeTime(ts: number): string {
  if (!ts) return '';
  const diff = Date.now() - ts;
  const min = Math.round(diff / 60000);
  if (min < 1) return 'Just now';
  if (min < 60) return `${min}m ago`;
  const hours = Math.round(min / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function duration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export function formatCell(v: unknown, kind?: ColumnKind): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (kind === 'numeric' || typeof v === 'number' || typeof v === 'bigint') {
    const n = toNumber(v);
    if (n !== null) return fullNumber(n);
  }
  if (kind === 'temporal') {
    const d = toDate(v);
    if (d) return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  }
  return String(v);
}

/** "created_at" -> "Created at". Mirrors the desktop's humanizeColumn. */
export function humanizeColumn(name: string): string {
  const spaced = name
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase();
}

export function isIdentifier(name: string): boolean {
  return /(^|_)(id|uuid|guid|key|code|zip|postal|phone)$/i.test(name) || /^id$/i.test(name);
}

export function classifyColumns(rows: Row[]): ColumnInfo[] {
  if (!rows.length) return [];
  const names = Object.keys(rows[0] ?? {});
  return names.map((name) => {
    const values = rows.map((r) => r[name]);
    const present = values.filter((v) => v !== null && v !== undefined);
    const distinct = new Set(present.map((v) => String(v))).size;
    const nulls = values.length - present.length;

    let kind: ColumnKind = 'other';
    if (present.length) {
      if (present.every((v) => typeof v === 'boolean')) kind = 'boolean';
      else if (present.every((v) => toNumber(v) !== null)) kind = 'numeric';
      else if (present.every((v) => toDate(v) !== null)) kind = 'temporal';
      else kind = 'categorical';
    }
    return { name, kind, distinct, nulls };
  });
}
