import type { ColumnInfo, Turn } from './types';
import { classifyColumns, isIdentifier } from './format';

/* ============================================================
   The Studio catalogue.

   Every action declares how it is actually backed:

   'local'   — computed in the renderer from rows this query already
               returned. No new work, instant.
   'query'   — builds a self-contained question and runs it through
               the real processQuery pipeline (Groq → SQL → DuckDB).
               Genuinely the user's data, genuinely new SQL.
   'view'    — navigates to an existing screen.
   'pending' — no honest implementation behind it yet. Rendered
               disabled with a plain reason. Never faked.

   The backend has no conversation memory, so every 'query' prompt
   restates the original question. That is why they read the way
   they do.
   ============================================================ */

export type StudioBacking = 'local' | 'query' | 'view' | 'pending';
export type StudioGroup = 'analyze' | 'explore' | 'create' | 'understand' | 'discover';

export interface StudioAction {
  id: string;
  label: string;
  blurb: string;
  group: StudioGroup;
  backing: StudioBacking;
  /** Shown on the disabled state — says exactly what is missing. */
  pendingReason?: string;
  /** Builds the question sent through processQuery. */
  prompt?: (turn: Turn | null, ctx: StudioContext) => string;
}

export interface StudioContext {
  datasetName: string;
  sourceType: string | null;
}

export const STUDIO_GROUPS: { id: StudioGroup; label: string }[] = [
  { id: 'analyze', label: 'Analyze' },
  { id: 'explore', label: 'Explore' },
  { id: 'create', label: 'Create' },
  { id: 'understand', label: 'Understand' },
  { id: 'discover', label: 'Discover' },
];

/** Restates the question so a stateless SQL generator has full context. */
const basis = (t: Turn | null) =>
  t?.question ? `Original question: "${t.question}".` : '';

export const STUDIO_ACTIONS: StudioAction[] = [
  /* ---------- Analyze ---------- */
  {
    id: 'chart',
    label: 'Chart',
    blurb: 'Visualize your data',
    group: 'analyze',
    backing: 'local',
  },
  {
    id: 'insights',
    label: 'Key Insights',
    blurb: 'Find what matters',
    group: 'analyze',
    backing: 'query',
    prompt: (t) =>
      `${basis(t)} Return the few rows that matter most from this result — the largest contributors, ` +
      `the biggest movers and anything unusually far from the rest. Include the measure and its share of the total.`,
  },
  {
    id: 'deepdive',
    label: 'Deep Dive',
    blurb: 'Go deeper',
    group: 'analyze',
    backing: 'query',
    prompt: (t) =>
      `${basis(t)} Go one level deeper: return the same measure broken out by the most granular ` +
      `dimension available that is related to it, ordered by the measure descending.`,
  },
  {
    id: 'anomalies',
    label: 'Find Anomalies',
    blurb: 'Detect outliers',
    group: 'analyze',
    backing: 'query',
    prompt: (t) =>
      `${basis(t)} Find outliers: return rows whose measure is more than two standard deviations from ` +
      `the average, together with the average and the deviation, ordered by the size of the deviation.`,
  },

  /* ---------- Explore ---------- */
  {
    id: 'breakdown',
    label: 'Breakdown',
    blurb: 'Split by category',
    group: 'explore',
    backing: 'query',
    prompt: (t) =>
      `${basis(t)} Split this by the most meaningful category column in the schema and return the ` +
      `category, the aggregated measure and each category's percentage of the total, ordered descending.`,
  },
  {
    id: 'compare',
    label: 'Compare',
    blurb: 'Find differences',
    group: 'explore',
    backing: 'query',
    prompt: (t) =>
      `${basis(t)} Compare across the two most recent complete periods available in the data. Return the ` +
      `dimension, the value in each period, the absolute change and the percentage change, ordered by change.`,
  },
  {
    id: 'forecast',
    label: 'Forecast',
    blurb: 'Predict trends',
    group: 'explore',
    backing: 'pending',
    pendingReason: 'Forecasting needs a model SPARK does not run yet. DuckDB returns history only.',
  },
  {
    id: 'datamap',
    label: 'Data Map',
    blurb: 'See geography',
    group: 'explore',
    backing: 'pending',
    pendingReason: 'No geocoding or map layer is bundled, so locations cannot be plotted honestly.',
  },

  /* ---------- Create ---------- */
  {
    id: 'dashboard',
    label: 'Dashboard',
    blurb: 'Build a view',
    group: 'create',
    backing: 'pending',
    pendingReason: 'Saved multi-panel dashboards need persistence that is not built yet.',
  },
  {
    id: 'report',
    label: 'Report',
    blurb: 'Package results',
    group: 'create',
    backing: 'query',
    prompt: (t) =>
      `${basis(t)} Produce the summary numbers for a short written report: the headline total, the ` +
      `count of records behind it, and the top five contributors with their values.`,
  },
  {
    id: 'table',
    label: 'Data Table',
    blurb: 'View and explore',
    group: 'create',
    backing: 'local',
  },
  {
    id: 'sql',
    label: 'SQL',
    blurb: 'Inspect and edit',
    group: 'create',
    backing: 'local',
  },

  /* ---------- Understand ---------- */
  {
    id: 'explain',
    label: 'Explain',
    blurb: 'Why is this happening?',
    group: 'understand',
    backing: 'query',
    prompt: (t) =>
      `${basis(t)} Pull the supporting detail needed to explain this result: the underlying rows ` +
      `grouped by the dimensions that drive the measure, so the cause can be reasoned about.`,
  },
  {
    id: 'schema',
    label: 'Schema Map',
    blurb: 'How your data connects',
    group: 'understand',
    backing: 'view',
  },

  /* ---------- Discover ---------- */
  {
    id: 'surprise',
    label: 'Surprise Me',
    blurb: 'Find something interesting in your data',
    group: 'discover',
    backing: 'query',
    prompt: (_t, ctx) =>
      `Find the single most interesting or surprising pattern in ${ctx.datasetName || 'this database'}: ` +
      `a concentration, an imbalance, an unexpected leader or a sharp change over time. ` +
      `Return the rows that show it, ordered so the pattern is obvious.`,
  },
];

export const ACTION_BY_ID = Object.fromEntries(
  STUDIO_ACTIONS.map((a) => [a.id, a])
) as Record<string, StudioAction>;

/* ============================================================
   Availability — what can actually run right now
   ============================================================ */

export interface Availability {
  enabled: boolean;
  reason?: string;
}

export function availability(
  action: StudioAction,
  turn: Turn | null,
  connected: boolean
): Availability {
  if (action.backing === 'pending') {
    return { enabled: false, reason: action.pendingReason };
  }
  if (!connected) {
    return { enabled: false, reason: 'Connect a data source first.' };
  }

  const hasRows = !!turn?.rows?.length;

  switch (action.id) {
    case 'chart':
      return hasRows
        ? { enabled: true }
        : { enabled: false, reason: 'Ask a question that returns rows to chart.' };
    case 'table':
      return hasRows
        ? { enabled: true }
        : { enabled: false, reason: 'No rows in the current answer.' };
    case 'sql':
      return turn?.sql
        ? { enabled: true }
        : { enabled: false, reason: 'No query has run yet.' };
    case 'schema':
      return { enabled: true };
    case 'surprise':
      return { enabled: true };
    default:
      // Every other 'query' action reworks the previous answer.
      return turn && turn.status === 'done'
        ? { enabled: true }
        : { enabled: false, reason: 'Ask a question first.' };
  }
}

/* ============================================================
   Context ranking

   The panel keeps a stable shape — the same five groups, always in
   the same order — but promotes a handful of actions into a
   "Suggested" strip based on the question and the result shape.
   Ranking never removes anything, so the UI cannot feel random.
   ============================================================ */

const KEYWORD_WEIGHTS: { re: RegExp; ids: string[] }[] = [
  { re: /\bwhy\b|\bcause|\breason|\bdrop|\bfell|\bdecline|\bspike/i, ids: ['explain', 'deepdive', 'anomalies', 'compare'] },
  { re: /\btrend|over time|monthly|weekly|yearly|quarter|growth|changed?\b/i, ids: ['chart', 'compare', 'breakdown'] },
  { re: /\btop\b|\bbest|\bhighest|\blargest|\bmost\b|\brank/i, ids: ['chart', 'breakdown', 'table'] },
  { re: /\bcompare|\bversus|\bvs\b|\bdifference/i, ids: ['compare', 'breakdown', 'chart'] },
  { re: /\bby (region|category|product|segment|type|country|state)/i, ids: ['breakdown', 'chart', 'compare'] },
  { re: /\bunusual|\boutlier|\banomal|\bstrange|\bodd\b/i, ids: ['anomalies', 'deepdive', 'explain'] },
  { re: /\bhow many|\bcount\b|\btotal\b|\bsum\b/i, ids: ['breakdown', 'chart', 'insights'] },
];

export function suggestedActions(turn: Turn | null, connected: boolean): string[] {
  if (!connected) return [];
  if (!turn || turn.status !== 'done') return ['surprise', 'schema'];

  const score = new Map<string, number>();
  const bump = (id: string, n: number) => score.set(id, (score.get(id) ?? 0) + n);

  // 1. What the question asked for.
  for (const { re, ids } of KEYWORD_WEIGHTS) {
    if (re.test(turn.question)) ids.forEach((id, i) => bump(id, 10 - i * 2));
  }

  // 2. What the result actually looks like.
  const cols: ColumnInfo[] = classifyColumns(turn.rows ?? []);
  const measures = cols.filter((c) => c.kind === 'numeric' && !isIdentifier(c.name));
  const cats = cols.filter((c) => c.kind === 'categorical');
  const times = cols.filter((c) => c.kind === 'temporal');
  const rowCount = turn.rows?.length ?? 0;

  if (measures.length && rowCount > 1) bump('chart', 9);
  if (times.length) {
    bump('compare', 7);
    bump('chart', 4);
  }
  if (cats.length) bump('breakdown', 6);
  if (rowCount > 12) bump('insights', 5);
  if (rowCount > 20) bump('anomalies', 4);
  if (rowCount >= 1) bump('table', 3);
  if (measures.length >= 2) bump('compare', 3);

  // 3. Always keep a route into the technical layer and a way out.
  bump('sql', 2);
  bump('report', 1);

  const ranked = [...score.entries()]
    .filter(([id]) => availability(ACTION_BY_ID[id], turn, connected).enabled)
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => id);

  return ranked.slice(0, 5);
}

/* ============================================================
   Follow-up chips

   Written from the columns the query actually returned, so they
   always name real fields. They are questions, not results — no
   analysis is implied until one is clicked and really runs.
   ============================================================ */

export function followUps(turn: Turn | null): string[] {
  if (!turn || turn.status !== 'done' || !turn.rows?.length) return [];

  const cols = classifyColumns(turn.rows);
  const measure = cols.find((c) => c.kind === 'numeric' && !isIdentifier(c.name));
  const cat = cols.find((c) => c.kind === 'categorical');
  const time = cols.find((c) => c.kind === 'temporal');

  const out: string[] = [];

  if (measure && time) out.push(`How has ${measure.name} changed over time?`);
  if (measure && cat) out.push(`Break ${measure.name} down by ${cat.name}`);
  if (measure) out.push(`What is driving ${measure.name}?`);
  if (time) out.push('Compare this with the previous period');
  if (measure && (turn.rows.length ?? 0) > 5) out.push(`Which ${cat?.name ?? 'rows'} are furthest from average?`);
  if (!out.length) out.push('Show me more detail');

  return out.slice(0, 4);
}
