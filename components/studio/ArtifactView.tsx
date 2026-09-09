'use client';

import React, { useMemo } from 'react';
import type { Turn } from '../../lib/spark/types';
import { inferChart } from '../../lib/spark/chart';
import { duration, relativeTime } from '../../lib/spark/format';
import { Chart } from '../charts/Chart';
import { DataTable } from '../ask/DataTable';
import { QueryTrace, SQLViewer } from '../ask/Evidence';
import { EmptyState, Modal } from '../ui/Primitives';

/* ============================================================
   One output from the current answer, opened full size. Same
   frame for every kind: what it is, where it came from, when.
   ============================================================ */

export type ArtifactKind = 'chart' | 'table' | 'sql';

const TITLE: Record<ArtifactKind, string> = {
  chart: 'Chart',
  table: 'Data table',
  sql: 'Generated SQL',
};

export function ArtifactView({
  kind,
  turn,
  onClose,
}: {
  kind: ArtifactKind | null;
  turn: Turn | null;
  onClose: () => void;
}) {
  const chart = useMemo(() => (turn ? inferChart(turn.rows) : null), [turn]);
  if (!kind || !turn) return null;

  const execStep = turn.trace.find((s) => s.stage === 'execute');
  const execMs = execStep?.endedAt ? execStep.endedAt - execStep.startedAt : undefined;

  return (
    <Modal
      open
      onClose={onClose}
      title={TITLE[kind]}
      subtitle={turn.question}
      width={kind === 'sql' ? 720 : 880}
    >
      {/* Provenance. Every artifact says where it came from. */}
      <div className="mb-3.5 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-2xs text-faint">
        <span className="tnum">
          {(turn.totalRows ?? turn.rows?.length ?? 0).toLocaleString()} rows
        </span>
        {execMs !== undefined && <span className="tnum">{duration(execMs)}</span>}
        {turn.completedAt && <span>{relativeTime(turn.completedAt)}</span>}
      </div>

      {kind === 'chart' &&
        (chart ? (
          <div className="rounded-xl border border-line-subtle bg-surface px-4 py-4">
            <Chart spec={chart} height={340} />
            <p className="mt-3 text-xs text-faint">{chart.rationale}</p>
          </div>
        ) : (
          <EmptyState
            title="Nothing here charts honestly."
            body="This result has no measure to plot against a category or a time axis. The table is the accurate view."
          />
        ))}

      {kind === 'table' &&
        (turn.rows?.length ? (
          <div className="overflow-hidden rounded-xl border border-line-subtle">
            <DataTable rows={turn.rows} totalRows={turn.totalRows} maxHeight={440} />
          </div>
        ) : (
          <EmptyState title="No rows returned." />
        ))}

      {kind === 'sql' && turn.sql && (
        <div className="space-y-4">
          <SQLViewer sql={turn.sql} rows={turn.totalRows} ms={execMs} />
          {turn.trace.length > 0 && (
            <section>
              <h3 className="eyebrow mb-2">Execution</h3>
              <QueryTrace steps={turn.trace} />
            </section>
          )}
        </div>
      )}
    </Modal>
  );
}
