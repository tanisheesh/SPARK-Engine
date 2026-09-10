/* The shapes the desktop actually sends. Mirrors the subset of
   lib/spark/types.ts that survives the trip to a phone - no speculative
   fields, and nothing the engine strips before sending (full row sets,
   traces, TTS audio). */

export type Row = Record<string, unknown>;

/* Stages emitted by electron/api-handler.js. These are the desktop's own
   pipeline steps, forwarded verbatim over the relay. The phone renders their
   labels and nothing else - it never invents a stage, a percentage or an
   estimated time, because the backend does not provide any of those. */
export type TraceStage =
  | 'schema'
  | 'sample'
  | 'sql'
  | 'execute'
  | 'format'
  | 'tts'
  | 'complete'
  | 'error';

/* Shorter than the desktop's TRACE_LABELS: on a phone these sit on one line
   under the question, so "Running on DuckDB" becomes "Querying". The meaning
   is unchanged and still comes from a real stage. */
export const STAGE_LABELS: Record<TraceStage, string> = {
  schema: 'Reading schema',
  sample: 'Sampling data',
  sql: 'Generating SQL',
  execute: 'Querying',
  format: 'Answering',
  tts: 'Synthesising voice',
  complete: 'Complete',
  error: 'Failed',
};

export type TurnStatus = 'thinking' | 'querying' | 'answering' | 'done' | 'error' | 'cancelled';

/** Which device the question was asked from. Written by whichever side created
    the turn; the desktop stamps 'mobile' for anything arriving over the relay. */
export type TurnOrigin = 'desktop' | 'mobile';

export interface Turn {
  id: string;
  question: string;
  status: TurnStatus;
  createdAt: number;
  completedAt?: number;

  origin?: TurnOrigin;
  originDevice?: string;

  answer?: string;
  sql?: string;
  /** At most MAX_ROWS_TO_PHONE. `totalRows` says how many actually exist. */
  rows?: Row[];
  totalRows?: number;

  error?: string;
  usedLocalFallback?: boolean;
  privacy?: { level: string; tokensRedacted: number; syntheticSample: boolean } | null;
}

export interface ConversationSource {
  type: string;
  name: string;
}

export interface Conversation {
  id: string;
  title: string;
  source?: ConversationSource | null;
  turns: Turn[];
  createdAt: number;
  updatedAt: number;
  pinned?: boolean;
}

/** The compact row the conversations list is built from. The engine sends
    these instead of whole conversations so opening the app costs one small
    payload rather than every answer the user has ever received. */
export interface ConversationSummary {
  id: string;
  title: string;
  source?: ConversationSource | null;
  lastQuestion: string | null;
  lastAnswer: string | null;
  lastStatus: TurnStatus | null;
  updatedAt: number;
  turnCount: number;
  pinned: boolean;
}

/** A question typed while the desktop was unreachable. Held on the phone only,
    and never shown as though it had been answered. */
export interface QueuedQuestion {
  id: string;
  conversationId: string | null;
  question: string;
  queuedAt: number;
}
