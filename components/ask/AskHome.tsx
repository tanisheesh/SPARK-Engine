'use client';

import React from 'react';
import { IconArrowRight, IconSurprise } from '../ui/Icons';
import { Button, Chip, cx } from '../ui/Primitives';

/* ============================================================
   The opening screen. One sentence of orientation, one clear
   action, and the user's own recent work. No hero, no artwork.
   ============================================================ */

/* Schema-neutral openers: these run against any table in any of the
   supported sources, so nothing suggested here can fail because it
   guessed at a column it has never seen. */
const OPENERS = [
  'What tables are in this database?',
  'Show me the first 20 rows',
  'How many records are there in total?',
];

export interface AskHomeProps {
  connected: boolean;
  datasetName: string;
  onConnect: () => void;
  onAsk: (q: string) => void;
  onSurprise: () => void;
  recents: string[];
  saved: { id: string; title: string; prompt_text: string }[];
}

export function AskHome({
  connected,
  datasetName,
  onConnect,
  onAsk,
  onSurprise,
  recents,
  saved,
}: AskHomeProps) {
  return (
    <div className="mx-auto w-full max-w-[640px] px-6 py-14">
      <h1 className="text-2xl font-semibold text-ink">Talk to your data.</h1>

      <p className="mt-2 max-w-[54ch] text-prose text-muted">
        {connected ? (
          <>
            Ask a question about <span className="text-ink">{datasetName}</span> in plain English.
            SPARK writes the SQL, runs it locally, and explains what it found.
          </>
        ) : (
          <>
            Connect a database or a CSV to start asking questions. Nothing leaves this machine except
            the question itself.
          </>
        )}
      </p>

      {!connected ? (
        <div className="mt-6">
          <Button variant="primary" size="lg" onClick={onConnect}>
            Connect data
          </Button>
        </div>
      ) : (
        <>
          <button
            type="button"
            onClick={onSurprise}
            className={cx(
              'group mt-6 flex w-full items-center gap-3 rounded-xl border border-line-subtle px-3.5 py-3 text-left',
              'transition-colors duration-1 ease-out hover:border-line hover:bg-surface'
            )}
          >
            <IconSurprise size={16} className="shrink-0 text-accent" />
            <span className="min-w-0 flex-1">
              <span className="block text-base font-medium text-ink">Surprise me</span>
              <span className="block text-sm text-faint">
                Look for the most interesting pattern in this data
              </span>
            </span>
            <IconArrowRight
              size={14}
              className="shrink-0 text-faint opacity-0 transition-opacity duration-1 group-hover:opacity-100"
            />
          </button>

          <section className="mt-8">
            <h2 className="eyebrow mb-2">Start here</h2>
            <div className="flex flex-wrap gap-1.5">
              {OPENERS.map((q) => (
                <Chip key={q} onClick={() => onAsk(q)}>
                  {q}
                </Chip>
              ))}
            </div>
          </section>
        </>
      )}

      {saved.length > 0 && (
        <section className="mt-8">
          <h2 className="eyebrow mb-1">Saved</h2>
          <ul className="m-0 list-none p-0">
            {saved.slice(0, 4).map((s) => (
              <li key={s.id}>
                <Row label={s.title} sub={s.prompt_text} onClick={() => onAsk(s.prompt_text)} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {recents.length > 0 && (
        <section className="mt-7">
          <h2 className="eyebrow mb-1">Recent</h2>
          <ul className="m-0 list-none p-0">
            {recents.slice(0, 5).map((q, i) => (
              <li key={`${q}-${i}`}>
                <Row label={q} onClick={() => onAsk(q)} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Row({ label, sub, onClick }: { label: string; sub?: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group -mx-2 flex w-[calc(100%+16px)] items-center gap-3 rounded-md px-2 py-1.5 text-left transition-colors duration-1 hover:bg-surface"
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate text-base text-muted transition-colors duration-1 group-hover:text-ink">
          {label}
        </span>
        {sub && <span className="block truncate text-xs text-faint">{sub}</span>}
      </span>
      <IconArrowRight
        size={13}
        className="shrink-0 text-faint opacity-0 transition-opacity duration-1 group-hover:opacity-100"
      />
    </button>
  );
}
