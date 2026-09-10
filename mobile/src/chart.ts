/* Chart inference for a phone screen.
 *
 * The desktop's lib/spark/chart.ts picks between five shapes and can render
 * three measures at once. On a 360pt-wide screen most of that is unreadable,
 * so this deliberately narrows to two shapes and one measure, and keeps the
 * one rule that actually matters:
 *
 *   if the rows have no honest visual form, return null and show the table.
 *
 * A decorative chart is worse than no chart, and a chart the user cannot check
 * against the numbers is worse still.
 */

import { classifyColumns, isIdentifier, toDate, toNumber } from './format';
import type { Row } from './types';

/** hbar carries long category names that would otherwise be unreadable
    rotated on a narrow x-axis; line carries anything with a time axis. */
export type MobileChartKind = 'bar' | 'hbar' | 'line';

export interface MobileChartSpec {
  kind: MobileChartKind;
  labelKey: string;
  valueKey: string;
  labels: string[];
  values: number[];
  /** Shown to the user. The desktop does the same - the shape is never magic. */
  rationale: string;
  /** Rows left out of the chart, so the UI can say so rather than imply the
      chart is the whole result. */
  truncated: number;
}

// More bars than this on a phone and each one is a hairline.
const MAX_BARS = 12;
const MAX_POINTS = 60;

export function inferChart(rows: Row[] | undefined, totalRows?: number): MobileChartSpec | null {
  if (!rows || rows.length < 2) return null;

  const cols = classifyColumns(rows);
  if (cols.length < 2) return null;

  // A measure must be numeric and not an identifier - summing customer ids
  // produces a chart that is arithmetically valid and completely meaningless.
  const measure = cols.find((c) => c.kind === 'numeric' && !isIdentifier(c.name));
  if (!measure) return null;

  const temporal = cols.find((c) => c.kind === 'temporal');
  const categorical = cols
    .filter((c) => (c.kind === 'categorical' || c.kind === 'boolean') && c.name !== measure.name)
    .sort((a, b) => b.distinct - a.distinct)[0];

  const labelCol = temporal ?? categorical;
  if (!labelCol) return null;
  // Every label identical means the axis carries no information.
  if (labelCol.distinct < 2) return null;

  const isTime = labelCol.kind === 'temporal';
  let working = [...rows];
  let truncated = 0;

  if (isTime) {
    working.sort((a, b) => {
      const da = toDate(a[labelCol.name]);
      const db = toDate(b[labelCol.name]);
      return da && db ? da.getTime() - db.getTime() : 0;
    });
    if (working.length > MAX_POINTS) {
      truncated = working.length - MAX_POINTS;
      working = working.slice(-MAX_POINTS); // the most recent window
    }
  } else {
    // Rank by the measure and show the leaders, saying so plainly.
    working.sort((a, b) => (toNumber(b[measure.name]) ?? 0) - (toNumber(a[measure.name]) ?? 0));
    if (working.length > MAX_BARS) {
      truncated = working.length - MAX_BARS;
      working = working.slice(0, MAX_BARS);
    }
  }

  const labels = working.map((r) => {
    const raw = r[labelCol.name];
    if (isTime) {
      const d = toDate(raw);
      if (d) {
        return working.length > 14
          ? d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
          : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      }
    }
    return String(raw ?? '—');
  });

  const values = working.map((r) => toNumber(r[measure.name]) ?? 0);
  if (!values.some((v) => v !== 0)) return null; // a flat zero line says nothing

  // Long category names need horizontal bars to stay legible.
  const longestLabel = labels.reduce((max, l) => Math.max(max, l.length), 0);
  const kind: MobileChartKind = isTime ? 'line' : longestLabel > 8 ? 'hbar' : 'bar';

  // If the engine trimmed rows before sending, that loss belongs in the count
  // too - otherwise the phone reports "showing 12 of 20" when the real result
  // had thousands.
  const unseen = totalRows && totalRows > rows.length ? totalRows - rows.length : 0;

  return {
    kind,
    labelKey: labelCol.name,
    valueKey: measure.name,
    labels,
    values,
    rationale: isTime
      ? `${measure.name} over ${labelCol.name}`
      : `top ${labels.length} by ${measure.name}`,
    truncated: truncated + unseen,
  };
}

/** Nice-ish axis maximum so bar heights are comparable between charts. */
export function axisMax(values: number[]): number {
  const max = Math.max(...values, 0);
  if (max === 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(max));
  return Math.ceil(max / magnitude) * magnitude;
}
