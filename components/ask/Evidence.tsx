'use client';

import React, { useMemo, useState } from 'react';
import type { ChartSpec, TraceStep } from '../../lib/spark/types';
import { alternateKinds, headline } from '../../lib/spark/chart';
import { compactNumber, duration, humanizeColumn, signedPercent } from '../../lib/spark/format';
import { Chart } from '../charts/Chart';
import { Badge, CopyButton, cx, IconButton, Spinner } from '../ui/Primitives';
import {
  IconArrowDown,
  IconArrowUp,
  IconChevronDown,
  IconChevronRight,
  IconExpand,
} from '../ui/Icons';

/* ============================================================
   Query trace

   A vertical timeline built from the real 'query-progress' events
   the main process emits. Status is a small mark; duration is the
   number that matters. No colour beyond the accent tick.
   ============================================================ */

export function QueryTrace({ steps }: { steps: TraceStep[] }) {
  if (!steps.length) return null;

  return (
    <ol className="relative flex flex-col">
      {/* the spine */}
      <span
        aria-hidden="true"
        className="absolute bottom-2 left-[3px] top-2 w-px bg-line-subtle"
      />
      {steps.map((s) => {
        const ms = s.endedAt ? s.endedAt - s.startedAt : 0;
        return (
          <li key={s.stage + s.startedAt} className="relative flex items-center gap-3 py-[3px] pl-4">
            <span className="absolute left-0 flex h-[7px] w-[7px] items-center justify-center">
              {s.status === 'running' ? (
                <Spinner size={9} className="text-accent" />
              ) : (
                <span
                  className="h-[7px] w-[7px] rounded-full"
                  style={{
                    background: s.status === 'error' ? 'var(--negative)' : 'var(--accent)',
                    opacity: s.status === 'error' ? 1 : 0.85,
                  }}
                />
              )}
            </span>

            <span
              className={cx(
                'min-w-0 flex-1 truncate text-sm',
                s.status === 'error'
                  ? 'text-negative'
                  : s.status === 'running'
                  ? 'text-ink'
                  : 'text-muted'
              )}
            >
              {s.label}
            </span>

            <span className="tnum shrink-0 font-mono text-2xs text-faint">
              {s.endedAt ? duration(ms) : '·'}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/* ============================================================
   SQL viewer — a developer tool, so it reads like one
   ============================================================ */

const KEYWORDS =
  /\b(SELECT|FROM|WHERE|GROUP BY|ORDER BY|LIMIT|JOIN|LEFT|RIGHT|INNER|OUTER|ON|AS|AND|OR|NOT|IN|IS|NULL|DESC|ASC|WITH|HAVING|CASE|WHEN|THEN|ELSE|END|UNION|ALL|DISTINCT|BETWEEN|CAST|OVER|PARTITION)\b/g;
const FUNCS =
  /\b(COUNT|SUM|AVG|MIN|MAX|ROUND|ABS|COALESCE|DATE_TRUNC|EXTRACT|STDDEV|LAG|LEAD|RANK)\s*\(/g;

/** Presentational only — the SQL text itself is never altered. */
function highlight(sql: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const marks: { start: number; end: number; cls: string }[] = [];

  for (const m of sql.matchAll(KEYWORDS)) {
    marks.push({ start: m.index!, end: m.index! + m[0].length, cls: 'text-ink' });
  }
  for (const m of sql.matchAll(FUNCS)) {
    marks.push({ start: m.index!, end: m.index! + m[0].length - 1, cls: 'text-info' });
  }
  for (const m of sql.matchAll(/'[^']*'/g)) {
    marks.push({ start: m.index!, end: m.index! + m[0].length, cls: 'text-accent' });
  }
  for (const m of sql.matchAll(/\b\d+(\.\d+)?\b/g)) {
    marks.push({ start: m.index!, end: m.index! + m[0].length, cls: 'text-warning' });
  }

  marks.sort((a, b) => a.start - b.start);

  let cursor = 0;
  let key = 0;
  for (const mk of marks) {
    if (mk.start < cursor) continue;
    if (mk.start > cursor) out.push(<span key={key++}>{sql.slice(cursor, mk.start)}</span>);
    out.push(
      <span key={key++} className={mk.cls}>
        {sql.slice(mk.start, mk.end)}
      </span>
    );
    cursor = mk.end;
  }
  if (cursor < sql.length) out.push(<span key={key++}>{sql.slice(cursor)}</span>);
  return out;
}

/** Table names read out of the SQL — derived, never invented. */
export function tablesUsed(sql: string): string[] {
  const found = new Set<string>();
  for (const m of sql.matchAll(/\b(?:FROM|JOIN)\s+"?([a-zA-Z_][a-zA-Z0-9_]*)"?/gi)) {
    found.add(m[1]);
  }
  return [...found];
}

/** Wrap long single-line SQL so the block does not scroll horizontally. */
function toLines(sql: string): string[] {
  const raw = sql.includes('\n')
    ? sql.split('\n')
    : sql.replace(
        /\s+(FROM|WHERE|GROUP BY|ORDER BY|LIMIT|HAVING|LEFT JOIN|RIGHT JOIN|INNER JOIN|JOIN|UNION)\b/gi,
        '\n$1'
      ).split('\n');
  return raw.map((l) => l.replace(/\s+$/, ''));
}

export function SQLViewer({ sql, rows, ms }: { sql: string; rows?: number; ms?: number }) {
  const tables = useMemo(() => tablesUsed(sql), [sql]);
  const lines = useMemo(() => toLines(sql), [sql]);

  return (
    <div className="overflow-hidden rounded-lg border border-line-subtle">
      <div className="flex flex-wrap items-center gap-1.5 border-b border-line-subtle bg-surface2 px-2.5 py-1.5">
        {tables.map((t) => (
          <Badge key={t} mono>
            {t}
          </Badge>
        ))}
        <span className="flex-1" />
        {rows !== undefined && (
          <span className="tnum font-mono text-2xs text-faint">
            {rows.toLocaleString()} {rows === 1 ? 'row' : 'rows'}
          </span>
        )}
        {ms !== undefined && (
          <span className="tnum font-mono text-2xs text-faint">{duration(ms)}</span>
        )}
        <CopyButton text={sql} label="Copy SQL" />
      </div>

      <div className="overflow-x-auto bg-bg">
        <table className="w-full border-collapse font-mono text-sm">
          <tbody>
            {lines.map((line, i) => (
              <tr key={i}>
                <td
                  className="tnum select-none border-r border-line-subtle px-2 py-[1px] text-right align-top text-2xs text-faint"
                  style={{ width: 1 }}
                >
                  {i + 1}
                </td>
                <td className="whitespace-pre-wrap py-[1px] pl-3 pr-3 text-muted">
                  {highlight(line) as React.ReactNode}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ============================================================
   Disclosure — the single "show me the machinery" pattern
   ============================================================ */

export function Disclosure({
  label,
  meta,
  defaultOpen = false,
  children,
}: {
  label: string;
  meta?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="group flex w-full items-center gap-1.5 py-1 text-left transition-colors duration-1"
      >
        {open ? (
          <IconChevronDown size={12} className="shrink-0 text-faint" />
        ) : (
          <IconChevronRight size={12} className="shrink-0 text-faint" />
        )}
        <span className="text-sm text-faint transition-colors duration-1 group-hover:text-muted">
          {label}
        </span>
        <span className="flex-1" />
        {meta}
      </button>
      {open && <div className="a-in pl-[18px] pt-1.5">{children}</div>}
    </div>
  );
}

/* ============================================================
   Chart block

   The metric is typography, not a tile. Title, figure, delta,
   then the plot. No container inside a container.
   ============================================================ */

export function ChartCard({
  spec,
  title,
  source,
  onExpand,
}: {
  spec: ChartSpec;
  title: string;
  source?: string;
  onExpand?: () => void;
}) {
  const alts = useMemo(() => alternateKinds(spec), [spec]);
  const [kind, setKind] = useState(spec.kind);
  const head = useMemo(() => headline(spec), [spec]);

  return (
    <figure className="m-0 rounded-xl border border-line-subtle bg-surface px-3.5 pb-3 pt-3">
      <figcaption className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm text-muted">{humanizeColumn(head?.label ?? title)}</div>
          {head && (
            <div className="mt-0.5 flex items-baseline gap-2">
              <span className="tnum text-2xl font-semibold leading-none text-ink">
                {compactNumber(head.value)}
              </span>
              {head.delta !== undefined && Number.isFinite(head.delta) && (
                <span
                  className={cx(
                    'tnum inline-flex items-center gap-0.5 text-sm',
                    head.delta >= 0 ? 'text-positive' : 'text-negative'
                  )}
                >
                  {head.delta >= 0 ? <IconArrowUp size={11} /> : <IconArrowDown size={11} />}
                  {signedPercent(head.delta)}
                </span>
              )}
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {alts.length > 1 && (
            <div role="group" aria-label="Chart type" className="flex items-center gap-0.5">
              {alts.map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setKind(k)}
                  aria-pressed={kind === k}
                  className={cx(
                    'rounded-sm px-1.5 py-0.5 text-2xs transition-colors duration-1',
                    kind === k
                      ? 'bg-surface3 text-ink'
                      : 'text-faint hover:bg-surface2 hover:text-muted'
                  )}
                >
                  {k === 'hbar' ? 'rank' : k}
                </button>
              ))}
            </div>
          )}
          {onExpand && (
            <IconButton label="Open full size" size="sm" onClick={onExpand}>
              <IconExpand size={12} />
            </IconButton>
          )}
        </div>
      </figcaption>

      <div className="pt-2.5">
        <Chart spec={spec} kind={kind} height={192} />
      </div>

      <div className="mt-2 flex items-center gap-2 border-t border-line-subtle pt-2 text-2xs text-faint">
        <span className="truncate">{spec.rationale}</span>
        {spec.truncated ? (
          <span className="shrink-0">
            · top {spec.labels.length} of {spec.labels.length + spec.truncated}
          </span>
        ) : null}
        <span className="flex-1" />
        {source && <span className="shrink-0 truncate font-mono">{source}</span>}
      </div>
    </figure>
  );
}
