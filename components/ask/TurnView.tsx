'use client';

import { useMemo, useState } from 'react';
import type { Turn } from '../../lib/spark/types';
import { inferChart } from '../../lib/spark/chart';
import { followUps, rootQuestion } from '../../lib/spark/studio';
import { humanizeError } from '../../lib/spark/errors';
import { duration, relativeTime } from '../../lib/spark/format';
import { ChartCard, Disclosure, QueryTrace, SQLViewer, tablesUsed } from './Evidence';
import { DataTable } from './DataTable';
import {
  IconAsk,
  IconEdit,
  IconPlug,
  IconRefresh,
  IconSettings,
  IconSpeaker,
  IconTable,
} from '../ui/Icons';
import { Badge, Button, Chip, IconButton, Skeleton } from '../ui/Primitives';

/* ============================================================
   One turn.

   The question is a quiet line of context. The response is an
   analytical note: answer, evidence, then where to go next.
   Neither is a bubble.
   ============================================================ */

export interface TurnViewProps {
  turn: Turn;
  isLast: boolean;
  onFollowUp: (q: string) => void;
  onRetry: (turn: Turn) => void;
  onEditQuestion: (q: string) => void;
  onEdit: (turnId: string, newQuestion: string) => void;
  onFollowUpOnTurn: (turn: Turn) => void;
  onOpenSettings: () => void;
  onConnect: () => void;
  onSpeak: (text: string) => void;
  canSpeak: boolean;
}

export function TurnView({
  turn,
  isLast,
  onFollowUp,
  onRetry,
  onEditQuestion,
  onEdit,
  onFollowUpOnTurn,
  onOpenSettings,
  onConnect,
  onSpeak,
  canSpeak,
}: TurnViewProps) {
  const chart = useMemo(() => (turn.status === 'done' ? inferChart(turn.rows) : null), [turn]);
  const chips = useMemo(() => followUps(turn), [turn]);
  const [showTable, setShowTable] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState(false);
  const [draft, setDraft] = useState('');

  const elapsed = turn.completedAt ? turn.completedAt - turn.createdAt : undefined;

  const startEdit = () => {
    setDraft(rootQuestion(turn.question));
    setEditingQuestion(true);
  };
  const saveEdit = () => {
    const text = draft.trim();
    setEditingQuestion(false);
    if (text && text !== rootQuestion(turn.question)) onEdit(turn.id, text);
  };

  return (
    <article className="a-rise px-6 py-6">

      {/* The question. Understated, right-aligned, on its own line. */}
      <div className="mb-5 flex justify-end">
        {editingQuestion ? (
          <div className="w-full max-w-[80%] rounded-lg border border-accent-line bg-surface2 p-2">
            <textarea
              autoFocus
              rows={2}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  saveEdit();
                } else if (e.key === 'Escape') {
                  setEditingQuestion(false);
                }
              }}
              className="block w-full resize-none bg-transparent text-base leading-snug text-ink placeholder:text-faint focus:outline-none"
            />
            <div className="mt-1.5 flex items-center justify-end gap-1.5">
              <Button size="sm" onClick={() => setEditingQuestion(false)}>
                Cancel
              </Button>
              <Button size="sm" variant="primary" onClick={saveEdit}>
                Save &amp; regenerate
              </Button>
            </div>
          </div>
        ) : (
          <div className="group flex max-w-[80%] items-center gap-1">
            {turn.status === 'done' && (
              <button
                type="button"
                onClick={() => onFollowUpOnTurn(turn)}
                title="Follow up on this"
                className="opacity-0 transition-opacity duration-1 group-hover:opacity-100"
              >
                <IconAsk size={12} className="text-faint hover:text-ink" />
              </button>
            )}
            <button
              type="button"
              onClick={startEdit}
              title="Edit question"
              className="opacity-0 transition-opacity duration-1 group-hover:opacity-100"
            >
              <IconEdit size={12} className="text-faint hover:text-ink" />
            </button>
            <div className="rounded-lg border border-line-subtle bg-surface2 px-2.5 py-1.5">
              <p className="m-0 text-base leading-snug text-muted">{rootQuestion(turn.question)}</p>
              {turn.replyToTurnId && (
                <p className="m-0 mt-0.5 text-2xs text-faint">↪ following up on an earlier answer</p>
              )}
              {turn.edited && <p className="m-0 mt-0.5 text-2xs text-faint">edited</p>}
            </div>
          </div>
        )}
      </div>

      <div>
        <div className="mb-2 flex items-center gap-2">
          <span className="eyebrow">Spark</span>
          {turn.originAction && <Badge tone="neutral">{turn.originAction}</Badge>}
          <span className="flex-1" />
          {turn.status === 'done' && elapsed !== undefined && (
            <span className="tnum font-mono text-2xs text-faint">{duration(elapsed)}</span>
          )}
        </div>

        {turn.status === 'cancelled' ? (
          <Cancelled onRetry={() => onRetry(turn)} />
        ) : turn.status === 'error' ? (
          <ErrorState
            turn={turn}
            onRetry={() => onRetry(turn)}
            onEdit={() => onEditQuestion(rootQuestion(turn.question))}
            onOpenSettings={onOpenSettings}
            onConnect={onConnect}
          />
        ) : turn.status !== 'done' ? (
          <Pending turn={turn} />
        ) : (
          <>
            {/* 1 — the answer, in prose */}
            <p className="m-0 max-w-[68ch] text-prose text-ink">{turn.answer}</p>

            {/* 2 — the evidence */}
            {chart && (
              <div className="mt-4">
                <ChartCard
                  spec={chart}
                  title={rootQuestion(turn.question)}
                  source={turn.sql ? tablesUsed(turn.sql).join(' · ') : undefined}
                />
              </div>
            )}

            {/* 3 — supporting rows */}
            {!!turn.rows?.length && (
              <div className="mt-3">
                {showTable ? (
                  <div className="overflow-hidden rounded-xl border border-line-subtle">
                    <div className="flex items-center gap-2 border-b border-line-subtle bg-surface2 px-3 py-1.5">
                      <span className="text-sm text-muted">Rows returned</span>
                      <span className="flex-1" />
                      <button
                        type="button"
                        onClick={() => setShowTable(false)}
                        className="text-xs text-faint transition-colors duration-1 hover:text-ink"
                      >
                        Hide
                      </button>
                    </div>
                    <DataTable rows={turn.rows} totalRows={turn.totalRows} />
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowTable(true)}
                    className="inline-flex items-center gap-1.5 text-sm text-faint transition-colors duration-1 hover:text-ink"
                  >
                    <IconTable size={13} />
                    <span className="tnum">
                      {(turn.totalRows ?? turn.rows.length).toLocaleString()} rows
                    </span>
                  </button>
                )}
              </div>
            )}

            {/* 4 — the machinery, folded away */}
            {(turn.sql || turn.trace.length > 0) && (
              <div className="mt-3">
                <Disclosure label="How this was answered">
                  <div className="space-y-3.5">
                    {turn.trace.length > 0 && <QueryTrace steps={turn.trace} />}
                    {turn.sql && (
                      <SQLViewer sql={turn.sql} rows={turn.totalRows} ms={execMs(turn)} />
                    )}
                  </div>
                </Disclosure>
              </div>
            )}

            <div className="mt-2 flex items-center gap-0.5">
              {canSpeak && turn.answer && (
                <IconButton label="Read aloud" size="sm" onClick={() => onSpeak(turn.answer!)}>
                  <IconSpeaker size={13} />
                </IconButton>
              )}
              <IconButton label="Ask again" size="sm" onClick={() => onRetry(turn)}>
                <IconRefresh size={13} />
              </IconButton>
              <span className="flex-1" />
              {turn.completedAt && (
                <span className="text-2xs text-faint">{relativeTime(turn.completedAt)}</span>
              )}
            </div>

            {/* 5 — where next */}
            {isLast && chips.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-1.5">
                {chips.map((c) => (
                  <Chip key={c} onClick={() => onFollowUp(c)}>
                    {c}
                  </Chip>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </article>
  );
}


function execMs(turn: Turn): number | undefined {
  const s = turn.trace.find((x) => x.stage === 'execute');
  return s?.endedAt ? s.endedAt - s.startedAt : undefined;
}

/* ---------- in flight ---------- */

function Pending({ turn }: { turn: Turn }) {
  const copy =
    turn.status === 'thinking'
      ? 'Understanding your question'
      : turn.status === 'querying'
        ? 'Running analysis'
        : 'Preparing your answer';

  return (
    <div>
      <p className="m-0 text-prose text-muted">{copy}…</p>

      {/* The shape of the answer is known, so show that rather than a spinner. */}
      <div className="mt-3 max-w-[68ch] space-y-1.5">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-[86%]" />
        <Skeleton className="h-3 w-[62%]" />
      </div>

      {turn.trace.length > 0 && (
        <div className="mt-4 max-w-sm">
          <QueryTrace steps={turn.trace} />
        </div>
      )}
    </div>
  );
}

/* ---------- cancelled ---------- */

function Cancelled({ onRetry }: { onRetry: () => void }) {
  return (
    <div>
      <p className="m-0 text-prose text-muted">You stopped this before it finished.</p>
      <p className="m-0 mt-1 text-base text-faint">
        The query had already been sent, so it ran to completion locally — the result was discarded.
      </p>
      <div className="mt-3">
        <Button size="sm" onClick={onRetry}>
          <IconRefresh size={12} />
          Ask again
        </Button>
      </div>
    </div>
  );
}

/* ---------- failure ---------- */

function ErrorState({
  turn,
  onRetry,
  onEdit,
  onOpenSettings,
  onConnect,
}: {
  turn: Turn;
  onRetry: () => void;
  onEdit: () => void;
  onOpenSettings: () => void;
  onConnect: () => void;
}) {
  const f = useMemo(() => humanizeError(turn.errorDetail ?? turn.error ?? ''), [turn]);

  return (
    <div>
      <p className="m-0 text-prose text-ink">{f.headline}</p>
      {f.detail && <p className="m-0 mt-1 max-w-[64ch] text-prose text-muted">{f.detail}</p>}
      {f.hint && <p className="m-0 mt-1 max-w-[64ch] text-base text-faint">{f.hint}</p>}

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {f.actions.includes('retry') && (
          <Button size="sm" onClick={onRetry}>
            <IconRefresh size={12} />
            Try again
          </Button>
        )}
        {f.actions.includes('edit') && (
          <Button size="sm" onClick={onEdit}>
            <IconEdit size={12} />
            Edit question
          </Button>
        )}
        {f.actions.includes('settings') && (
          <Button size="sm" variant="primary" onClick={onOpenSettings}>
            <IconSettings size={12} />
            Settings
          </Button>
        )}
        {f.actions.includes('connect') && (
          <Button size="sm" variant="primary" onClick={onConnect}>
            <IconPlug size={12} />
            Connect data
          </Button>
        )}
      </div>

      <div className="mt-3 space-y-1">
        {turn.sql && (
          <Disclosure label="The SQL that failed">
            <SQLViewer sql={turn.sql} />
          </Disclosure>
        )}
        {turn.errorDetail && (
          <Disclosure label="Technical details">
            <pre className="m-0 overflow-x-auto whitespace-pre-wrap break-words rounded-lg border border-line-subtle bg-bg p-2.5 font-mono text-sm text-muted">
              {turn.errorDetail}
            </pre>
          </Disclosure>
        )}
      </div>
    </div>
  );
}
