/* Shared shapes for the SPARK client. Everything here mirrors what the
   Electron main process actually returns — no speculative fields. */

// lib/data-sources.ts is the single source of truth for which source types
// exist (it also mirrors electron/source-registry.js) - re-exported here so
// existing SourceType imports keep working without duplicating the union.
export type { DataSourceType as SourceType } from '../data-sources';

export type Row = Record<string, unknown>;

/* ---------- Query trace ----------
   Stages emitted by electron/api-handler.js over the 'query-progress'
   channel. Durations are measured in the renderer as each stage arrives,
   so they are real wall-clock timings, not estimates. */

export type TraceStage =
  | 'schema'
  | 'sample'
  | 'sql'
  | 'execute'
  | 'format'
  | 'tts'
  | 'complete'
  | 'error';

export interface TraceStep {
  stage: TraceStage;
  label: string;
  startedAt: number;
  endedAt?: number;
  status: 'running' | 'done' | 'error';
  detail?: string;
}

export const TRACE_LABELS: Record<TraceStage, string> = {
  schema: 'Reading schema',
  sample: 'Sampling data',
  sql: 'Generating SQL',
  execute: 'Running on DuckDB',
  format: 'Composing answer',
  tts: 'Synthesising voice',
  complete: 'Done',
  error: 'Failed',
};

/* ---------- Conversation ---------- */

export type TurnStatus =
  | 'thinking'
  | 'querying'
  | 'answering'
  | 'done'
  | 'error'
  /* The user stopped waiting. The query itself cannot be recalled once it
     is in flight, so this means "discard the result", and says so. */
  | 'cancelled';

/** A turn is one question and everything SPARK produced from it. */
export interface Turn {
  id: string;
  question: string;
  /** Set when the turn was started by a Studio action rather than typed. */
  originAction?: string;
  /**
   * The full text actually sent to processQuery, when it differs from the
   * clean `question` shown in the UI — e.g. a Studio action restates the
   * prior turn's question plus its own instructions for the stateless SQL
   * generator. Retry needs this, not just the display text. Absent for a
   * plain typed question, where `question` already is the full prompt.
   */
  prompt?: string;
  status: TurnStatus;
  createdAt: number;
  completedAt?: number;

  answer?: string;
  sql?: string;
  rows?: Row[];
  totalRows?: number;
  columns?: string[];

  trace: TraceStep[];

  /** Human-readable failure, plus the raw text behind a disclosure. */
  error?: string;
  errorDetail?: string;

  hasAudio?: boolean;
}

export interface Conversation {
  id: string;
  title: string;
  turns: Turn[];
  createdAt: number;
  updatedAt: number;
  pinned?: boolean;
}

/* ---------- Column classification ---------- */

export type ColumnKind = 'numeric' | 'temporal' | 'categorical' | 'boolean' | 'other';

export interface ColumnInfo {
  name: string;
  kind: ColumnKind;
  /** Distinct values seen in the returned rows. */
  distinct: number;
  nulls: number;
}

/* ---------- Charts ---------- */

export type ChartKind = 'bar' | 'hbar' | 'line' | 'area' | 'donut';

export interface ChartSeries {
  key: string;
  values: number[];
}

export interface ChartSpec {
  kind: ChartKind;
  labelKey: string;
  labels: string[];
  series: ChartSeries[];
  /** Why this shape was chosen — surfaced to the user, not hidden magic. */
  rationale: string;
  truncated?: number;
}

/* ---------- Settings (electron get-settings) ---------- */

export interface ApiSettings {
  groqApiKey?: string;
  deepgramApiKey?: string;
}

/* ---------- Voice ---------- */

export type VoiceState =
  | 'idle'
  | 'listening'
  | 'thinking'
  | 'querying'
  | 'answering'
  | 'speaking'
  | 'error';

/* ---------- Rows returned by the surrounding services ---------- */

/** An entry from the main process `list-csv-files` handler. */
export interface CsvFileRow {
  name: string;
  path: string;
  size: number;
  modified: string | Date;
}
