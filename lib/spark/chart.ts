import type { ChartKind, ChartSpec, Row } from './types';
import { classifyColumns, formatCell, isIdentifier, toDate, toNumber } from './format';

/* ============================================================
   Chart inference.

   Charts are derived strictly from the rows DuckDB returned. If
   the result set has no honest visual form — no measure, only one
   row, nothing but identifiers — this returns null and the UI shows
   the table instead. A decorative chart is worse than no chart.
   ============================================================ */

const MAX_CATEGORIES = 24;

export function inferChart(rows: Row[] | undefined): ChartSpec | null {
  if (!rows || rows.length < 2) return null;

  const cols = classifyColumns(rows);
  if (cols.length < 2) return null;

  const measures = cols.filter((c) => c.kind === 'numeric' && !isIdentifier(c.name));
  if (!measures.length) return null;

  // Label axis: prefer a real time column, else the most "category-like"
  // text column (few repeats relative to row count).
  const temporal = cols.find((c) => c.kind === 'temporal');
  const categorical = cols
    .filter((c) => c.kind === 'categorical' || c.kind === 'boolean')
    .sort((a, b) => b.distinct - a.distinct)[0];

  const labelCol = temporal ?? categorical;
  if (!labelCol) return null;

  // Every label repeated identically means the axis carries no information.
  if (labelCol.distinct < 2) return null;

  const isTime = labelCol.kind === 'temporal';

  // Keep at most three measures — beyond that a small card stops being readable.
  const chosen = measures.slice(0, 3);

  let working = rows;
  let truncated = 0;

  if (isTime) {
    working = [...rows].sort((a, b) => {
      const da = toDate(a[labelCol.name]);
      const db = toDate(b[labelCol.name]);
      if (da && db) return da.getTime() - db.getTime();
      const na = toNumber(a[labelCol.name]);
      const nb = toNumber(b[labelCol.name]);
      if (na !== null && nb !== null) return na - nb;
      return 0;
    });
    if (working.length > 120) {
      truncated = working.length - 120;
      working = working.slice(-120); // most recent window
    }
  } else if (rows.length > MAX_CATEGORIES) {
    // Rank by the primary measure and show the leaders, saying so plainly.
    const key = chosen[0].name;
    working = [...rows]
      .sort((a, b) => (toNumber(b[key]) ?? 0) - (toNumber(a[key]) ?? 0))
      .slice(0, MAX_CATEGORIES);
    truncated = rows.length - MAX_CATEGORIES;
  }

  const labels = working.map((r) => {
    const raw = r[labelCol.name];
    if (isTime) {
      const d = toDate(raw);
      if (d) {
        return working.length > 24
          ? d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
          : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      }
    }
    return formatCell(raw, labelCol.kind);
  });

  const series = chosen.map((m) => ({
    key: m.name,
    values: working.map((r) => toNumber(r[m.name]) ?? 0),
  }));

  // A series that is entirely zero adds nothing.
  const live = series.filter((s) => s.values.some((v) => v !== 0));
  if (!live.length) return null;

  const kind: ChartKind = isTime
    ? live.length === 1
      ? 'area'
      : 'line'
    : longestLabel(labels) > 12 || labels.length > 10
    ? 'hbar'
    : 'bar';

  const rationale = isTime
    ? `${labelCol.name} is a time axis, so values are shown in order.`
    : `Ranked by ${chosen[0].name} across ${labelCol.name}.`;

  return {
    kind,
    labelKey: labelCol.name,
    labels,
    series: live,
    rationale,
    truncated: truncated || undefined,
  };
}

function longestLabel(labels: string[]): number {
  return labels.reduce((m, l) => Math.max(m, l.length), 0);
}

/** Which alternate shapes make sense for a spec the user may want to switch to. */
export function alternateKinds(spec: ChartSpec): ChartKind[] {
  const single = spec.series.length === 1;
  const isTime = /(date|time|month|year|quarter|week|day|created|updated|_at$|period)/i.test(
    spec.labelKey
  );

  if (isTime) return single ? ['area', 'line', 'bar'] : ['line', 'bar'];

  const out: ChartKind[] = ['bar', 'hbar'];
  // A donut only tells the truth for a small set of non-negative parts.
  if (single && spec.labels.length <= 6 && spec.series[0].values.every((v) => v >= 0)) {
    out.push('donut');
  }
  return out;
}

/* Summing an average, a rate or a percentage produces a number that means
   nothing. For those measures the headline reports the largest value
   instead, and says so. */
const NON_ADDITIVE = /(avg|average|mean|median|pct|percent|percentage|ratio|rate|share|margin|score|index)/i;

/** Headline metric for the chart card: total, latest or peak — whichever is honest. */
export function headline(spec: ChartSpec): { label: string; value: number; delta?: number } | null {
  const s = spec.series[0];
  if (!s || !s.values.length) return null;

  const isTime = spec.kind === 'line' || spec.kind === 'area';

  if (isTime) {
    const latest = s.values[s.values.length - 1];
    const prev = s.values.length > 1 ? s.values[s.values.length - 2] : null;
    const delta = prev !== null && prev !== 0 ? ((latest - prev) / Math.abs(prev)) * 100 : undefined;
    return { label: `Latest ${s.key}`, value: latest, delta };
  }

  if (NON_ADDITIVE.test(s.key)) {
    return { label: `Highest ${s.key}`, value: Math.max(...s.values) };
  }

  return { label: `Total ${s.key}`, value: s.values.reduce((a, b) => a + b, 0) };
}
