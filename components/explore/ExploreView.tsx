'use client';

import React from 'react';
import { ACTION_BY_ID, type StudioAction } from '../../lib/spark/studio';
import { Button, EmptyState, cx } from '../ui/Primitives';
import {
  IconAnomaly,
  IconArrowRight,
  IconBreakdown,
  IconDeepDive,
  IconInsights,
  IconSurprise,
} from '../ui/Icons';

/* ============================================================
   Ask is "I know what I want". Explore is "show me something".
   Every entry runs a real query through the same pipeline —
   nothing on this screen is a preview.
   ============================================================ */

const ANGLES: { id: string; Icon: React.ComponentType<{ size?: number }>; note: string }[] = [
  { id: 'insights', Icon: IconInsights, note: 'The rows carrying most of the total' },
  { id: 'anomalies', Icon: IconAnomaly, note: 'Values far from the average' },
  { id: 'breakdown', Icon: IconBreakdown, note: 'The biggest split in the data' },
  { id: 'deepdive', Icon: IconDeepDive, note: 'One level below the headline' },
];

export function ExploreView({
  connected,
  datasetName,
  busy,
  onRun,
  onConnect,
}: {
  connected: boolean;
  datasetName: string;
  busy: boolean;
  onRun: (action: StudioAction) => void;
  onConnect: () => void;
}) {
  if (!connected) {
    return (
      <EmptyState
        title="Your workspace is empty."
        body="Connect a data source and SPARK can start looking for what stands out in it."
        action={
          <Button variant="primary" onClick={onConnect}>
            Connect data
          </Button>
        }
      />
    );
  }

  return (
    <div className="mx-auto w-full max-w-[640px] px-6 py-14">
      <h1 className="text-2xl font-semibold text-ink">Find something worth knowing.</h1>
      <p className="mt-2 max-w-[54ch] text-prose text-muted">
        Each of these writes fresh SQL against <span className="text-ink">{datasetName}</span> and
        runs it in DuckDB on this machine. Results land in the conversation.
      </p>

      <button
        type="button"
        disabled={busy}
        onClick={() => onRun(ACTION_BY_ID.surprise)}
        className={cx(
          'group mt-6 flex w-full items-center gap-3 rounded-xl border border-line px-4 py-3.5 text-left',
          'transition-colors duration-1 ease-out hover:bg-surface',
          'disabled:opacity-40 disabled:pointer-events-none'
        )}
      >
        <IconSurprise size={18} className="shrink-0 text-accent" />
        <span className="min-w-0 flex-1">
          <span className="block text-lg font-medium text-ink">Surprise me</span>
          <span className="block text-sm text-faint">
            A concentration, an imbalance, or a sharp change over time
          </span>
        </span>
        <IconArrowRight
          size={15}
          className="shrink-0 text-faint opacity-0 transition-opacity duration-1 group-hover:opacity-100"
        />
      </button>

      <h2 className="eyebrow mb-2 mt-9">Or start from an angle</h2>

      <ul className="m-0 list-none divide-y divide-line-subtle border-y border-line-subtle p-0">
        {ANGLES.map(({ id, Icon, note }) => {
          const action = ACTION_BY_ID[id];
          return (
            <li key={id}>
              <button
                type="button"
                disabled={busy}
                onClick={() => onRun(action)}
                className={cx(
                  'group flex w-full items-center gap-3 py-2.5 text-left',
                  'transition-colors duration-1 ease-out',
                  'disabled:opacity-40 disabled:pointer-events-none'
                )}
              >
                <span className="shrink-0 text-faint transition-colors duration-1 group-hover:text-muted">
                  <Icon size={15} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-base text-ink">{action.label}</span>
                  <span className="block truncate text-sm text-faint">{note}</span>
                </span>
                <IconArrowRight
                  size={13}
                  className="shrink-0 text-faint opacity-0 transition-opacity duration-1 group-hover:opacity-100"
                />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
