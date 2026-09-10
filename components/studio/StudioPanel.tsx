'use client';

import React, { useEffect, useState } from 'react';
import {
  ACTION_BY_ID,
  STUDIO_ACTIONS,
  STUDIO_GROUPS,
  availability,
  type StudioAction,
  type StudioGroup,
} from '../../lib/spark/studio';
import type { Conversation, Turn } from '../../lib/spark/types';
import { relativeTime } from '../../lib/spark/format';
import { Button, EmptyState, Spinner, cx } from '../ui/Primitives';
import {
  IconAnomaly,
  IconBreakdown,
  IconChart,
  IconChevronRight,
  IconCompare,
  IconDashboard,
  IconDeepDive,
  IconExplain,
  IconForecast,
  IconInsights,
  IconMap,
  IconReport,
  IconSQL,
  IconSchema,
  IconSurprise,
  IconTable,
} from '../ui/Icons';

const COLLAPSE_KEY = 'spark.studio.collapsed';

const ICONS: Record<string, React.ComponentType<{ size?: number }>> = {
  chart: IconChart,
  insights: IconInsights,
  deepdive: IconDeepDive,
  anomalies: IconAnomaly,
  breakdown: IconBreakdown,
  compare: IconCompare,
  forecast: IconForecast,
  datamap: IconMap,
  dashboard: IconDashboard,
  report: IconReport,
  table: IconTable,
  sql: IconSQL,
  explain: IconExplain,
  schema: IconSchema,
  surprise: IconSurprise,
};

type Tab = 'generate' | 'history';

export interface StudioPanelProps {
  turn: Turn | null;
  connected: boolean;
  busy: boolean;
  runningAction: string | null;
  onRun: (action: StudioAction) => void;
  onConnect: () => void;

  conversation: Conversation | null;
  onJumpToTurn: (turnId: string) => void;
}

export function StudioPanel({
  turn,
  connected,
  busy,
  runningAction,
  onRun,
  onConnect,
  conversation,
  onJumpToTurn,
}: StudioPanelProps) {
  const [tab, setTab] = useState<Tab>('generate');
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(COLLAPSE_KEY) === '1');
    } catch {
      /* localStorage unavailable — stay expanded */
    }
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((v) => {
      const next = !v;
      try {
        localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0');
      } catch {
        /* best-effort persistence only */
      }
      return next;
    });
  };

  if (collapsed) {
    return (
      <div className="relative flex h-full shrink-0">
        <aside
          aria-label="Studio"
          className="flex h-full w-[44px] shrink-0 flex-col items-center border-l border-line-subtle bg-surface pt-3.5"
        >
          <IconSurprise size={16} className="text-faint" aria-hidden="true" />
        </aside>
        <button
          type="button"
          onClick={toggleCollapsed}
          title="Expand Studio"
          aria-label="Expand Studio"
          className={cx(
            'absolute top-1/2 z-10 flex h-9 w-4 -translate-y-1/2 items-center justify-center',
            'rounded-full border border-line bg-surface2 text-faint shadow-pop',
            'transition-colors duration-1 ease-out hover:border-accent-line hover:bg-surface3 hover:text-ink'
          )}
          style={{ left: -8 }}
        >
          <IconChevronRight size={11} className="rotate-180" />
        </button>
      </div>
    );
  }

  return (
    <div className="relative flex h-full shrink-0">
      <aside
        aria-label="Studio"
        className="flex h-full w-[272px] shrink-0 flex-col border-l border-line-subtle bg-surface"
      >
      <header className="px-4 pb-3 pt-3.5">
        <h2 className="text-lg font-semibold leading-tight text-ink">Studio</h2>
        <p className="mt-0.5 text-sm leading-snug text-faint">
          Turn your analysis into something useful.
        </p>
      </header>

      <div className="flex gap-4 border-b border-line-subtle px-4">
        {(['generate', 'history'] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            aria-current={tab === t ? 'true' : undefined}
            className={cx(
              'relative -mb-px border-b pb-2 text-sm capitalize transition-colors duration-1 ease-out',
              tab === t
                ? 'border-accent text-ink'
                : 'border-transparent text-faint hover:text-muted'
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {!connected ? (
        <EmptyState
          title="Nothing to work on"
          body="Connect a source and these tools start acting on your data."
          action={
            <Button variant="primary" size="sm" onClick={onConnect}>
              Connect data
            </Button>
          }
        />
      ) : tab === 'generate' ? (
        <div className="min-h-0 flex-1 overflow-y-auto px-2 py-3">
          {runningAction && (
            <div className="a-in mb-3 flex items-center gap-2 px-2">
              <Spinner size={11} className="text-accent" />
              <span className="truncate text-sm text-muted">
                {ACTION_BY_ID[runningAction]?.label ?? 'Working'} — running on your data
              </span>
            </div>
          )}

          {STUDIO_GROUPS.map((g) => (
            <Group key={g.id} group={g} turn={turn} connected={connected} busy={busy} onRun={onRun} />
          ))}

          {!turn && (
            <p className="px-2 pb-1 pt-2 text-xs leading-relaxed text-faint">
              Ask a question and these begin working on that answer.
            </p>
          )}
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto px-2 py-3">
          {!conversation?.turns.length ? (
            <p className="px-2 py-6 text-sm leading-relaxed text-faint">
              Every question in this conversation appears here.
            </p>
          ) : (
            [...conversation.turns].reverse().map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => onJumpToTurn(t.id)}
                className="block w-full rounded-md px-2 py-1.5 text-left transition-colors duration-1 hover:bg-surface2"
              >
                <span className="block truncate text-base text-muted">{t.question}</span>
                <span className="flex items-center gap-1.5 text-xs text-faint">
                  {t.status !== 'done' && <span className="capitalize">{t.status}</span>}
                  {t.completedAt && <span>{relativeTime(t.completedAt)}</span>}
                  {t.totalRows !== undefined && t.status === 'done' && (
                    <span className="tnum font-mono">{t.totalRows.toLocaleString()} rows</span>
                  )}
                </span>
              </button>
            ))
          )}
        </div>
      )}
      </aside>

      {/* Edge-mounted fold handle — same fixed spot as the sidebar's,
          straddling the border, regardless of collapsed state. */}
      <button
        type="button"
        onClick={toggleCollapsed}
        title="Collapse Studio"
        aria-label="Collapse Studio"
        className={cx(
          'absolute top-1/2 z-10 flex h-9 w-4 -translate-y-1/2 items-center justify-center',
          'rounded-full border border-line bg-surface2 text-faint shadow-pop',
          'transition-colors duration-1 ease-out hover:border-accent-line hover:bg-surface3 hover:text-ink'
        )}
        style={{ left: -8 }}
      >
        <IconChevronRight size={11} />
      </button>
    </div>
  );
}

/* ---------- structure ---------- */

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="mb-4 last:mb-1">
      <h3 className="eyebrow px-2 pb-1">{label}</h3>
      <div className="flex flex-col">{children}</div>
    </section>
  );
}

function Group({
  group,
  turn,
  connected,
  busy,
  onRun,
}: {
  group: { id: StudioGroup; label: string };
  turn: Turn | null;
  connected: boolean;
  busy: boolean;
  onRun: (a: StudioAction) => void;
}) {
  const actions = STUDIO_ACTIONS.filter((a) => a.group === group.id);
  return (
    <Section label={group.label}>
      {actions.map((a) => (
        <ActionRow
          key={a.id}
          action={a}
          turn={turn}
          connected={connected}
          busy={busy}
          onRun={onRun}
        />
      ))}
    </Section>
  );
}

/* ---------- one action ----------
   A row, not a card: icon, name, and the description only where it
   earns its place. Monochrome until hover. */

function ActionRow({
  action,
  turn,
  connected,
  busy,
  suggested,
  onRun,
}: {
  action: StudioAction;
  turn: Turn | null;
  connected: boolean;
  busy: boolean;
  suggested?: boolean;
  onRun: (a: StudioAction) => void;
}) {
  const av = availability(action, turn, connected);
  const Icon = ICONS[action.id] ?? IconChart;
  const disabled = !av.enabled || busy;
  const pending = action.backing === 'pending';

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onRun(action)}
      title={av.reason ?? action.blurb}
      className={cx(
        'group flex w-full items-center gap-2.5 rounded-md px-2 py-[7px] text-left',
        'transition-colors duration-1 ease-out',
        disabled ? 'cursor-not-allowed' : 'hover:bg-surface2'
      )}
    >
      <span
        className={cx(
          'shrink-0 transition-colors duration-1',
          disabled
            ? 'text-[#4A4B4B]'
            : suggested
              ? 'text-accent'
              : 'text-faint group-hover:text-muted'
        )}
      >
        <Icon size={15} />
      </span>

      <span className="min-w-0 flex-1">
        <span
          className={cx(
            'block truncate text-base leading-tight',
            disabled ? 'text-[#5A5B5B]' : 'text-ink'
          )}
        >
          {action.label}
        </span>
        {suggested && (
          <span className="block truncate text-xs leading-tight text-faint">{action.blurb}</span>
        )}
      </span>

      {pending && <span className="shrink-0 text-2xs text-[#5A5B5B]">soon</span>}
    </button>
  );
}
