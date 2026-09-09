'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { cx, Kbd } from '../ui/Primitives';
import {
  IconAsk,
  IconConversations,
  IconData,
  IconExplore,
  IconPlug,
  IconPlus,
  IconSchema,
  IconSearch,
  IconSettings,
} from '../ui/Icons';
import type { Conversation } from '../../lib/spark/types';
import { relativeTime } from '../../lib/spark/format';
import { ACTION_BY_ID, availability, type StudioAction } from '../../lib/spark/studio';
import type { Turn } from '../../lib/spark/types';

/* ============================================================
   Every entry here does something that already exists elsewhere
   in the product. The palette is a faster route to it, never a
   place where new capability appears.
   ============================================================ */

export interface Command {
  id: string;
  label: string;
  hint?: string;
  group: string;
  Icon: React.ComponentType<{ size?: number }>;
  run: () => void;
}

export function CommandPalette({
  open,
  onClose,
  onNavigate,
  onNewConversation,
  onOpenConversation,
  onConnect,
  onOpenSettings,
  onRunStudio,
  conversations,
  turn,
  connected,
}: {
  open: boolean;
  onClose: () => void;
  onNavigate: (k: 'ask' | 'explore' | 'data' | 'conversations') => void;
  onNewConversation: () => void;
  onOpenConversation: (id: string) => void;
  onConnect: () => void;
  onOpenSettings: () => void;
  onRunStudio: (a: StudioAction) => void;
  conversations: Conversation[];
  turn: Turn | null;
  connected: boolean;
}) {
  const [q, setQ] = useState('');
  const [cursor, setCursor] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const commands = useMemo<Command[]>(() => {
    const go = (fn: () => void) => () => {
      fn();
      onClose();
    };

    const base: Command[] = [
      { id: 'nav-ask', label: 'Go to Ask', group: 'Navigate', Icon: IconAsk, run: go(() => onNavigate('ask')) },
      { id: 'nav-explore', label: 'Go to Explore', group: 'Navigate', Icon: IconExplore, run: go(() => onNavigate('explore')) },
      { id: 'nav-data', label: 'Go to Data', group: 'Navigate', Icon: IconData, run: go(() => onNavigate('data')) },
      { id: 'nav-conv', label: 'Go to Conversations', group: 'Navigate', Icon: IconConversations, run: go(() => onNavigate('conversations')) },
      { id: 'new', label: 'New conversation', hint: '⌘N', group: 'Actions', Icon: IconPlus, run: go(onNewConversation) },
      { id: 'connect', label: 'Connect a data source', group: 'Actions', Icon: IconPlug, run: go(onConnect) },
      { id: 'schema', label: 'Open schema map', group: 'Actions', Icon: IconSchema, run: go(() => onNavigate('data')) },
      { id: 'settings', label: 'Open settings', group: 'Actions', Icon: IconSettings, run: go(onOpenSettings) },
    ];

    // Studio actions, but only the ones that can genuinely run right now.
    for (const id of ['insights', 'breakdown', 'compare', 'anomalies', 'explain', 'surprise']) {
      const action = ACTION_BY_ID[id];
      if (!action) continue;
      if (!availability(action, turn, connected).enabled) continue;
      base.push({
        id: `studio-${id}`,
        label: action.label,
        hint: action.blurb,
        group: 'Studio',
        Icon: IconSearch,
        run: go(() => onRunStudio(action)),
      });
    }

    for (const c of conversations.slice(0, 8)) {
      base.push({
        id: `conv-${c.id}`,
        label: c.title,
        hint: relativeTime(c.updatedAt),
        group: 'Recent',
        Icon: IconConversations,
        run: go(() => onOpenConversation(c.id)),
      });
    }

    return base;
  }, [
    conversations,
    connected,
    turn,
    onClose,
    onConnect,
    onNavigate,
    onNewConversation,
    onOpenConversation,
    onOpenSettings,
    onRunStudio,
  ]);

  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return commands;
    return commands.filter(
      (c) =>
        c.label.toLowerCase().includes(needle) ||
        c.group.toLowerCase().includes(needle) ||
        c.hint?.toLowerCase().includes(needle)
    );
  }, [commands, q]);

  useEffect(() => setCursor(0), [q]);

  useEffect(() => {
    if (!open) setQ('');
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setCursor((c) => Math.min(results.length - 1, c + 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setCursor((c) => Math.max(0, c - 1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        results[cursor]?.run();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, results, cursor, onClose]);

  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${cursor}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [cursor]);

  if (!open) return null;

  let lastGroup = '';

  return (
    <div
      className="a-in fixed inset-0 z-[70] flex items-start justify-center bg-black/55 p-6 pt-[14vh]"
      onMouseDown={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        onMouseDown={(e) => e.stopPropagation()}
        className="a-rise flex max-h-[62vh] w-full max-w-[520px] flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-overlay"
      >
        <div className="flex items-center gap-2.5 border-b border-line-subtle px-3.5">
          <IconSearch size={14} className="shrink-0 text-faint" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search or run a command"
            aria-label="Search or run a command"
            className="h-11 flex-1 bg-transparent text-md text-ink placeholder:text-faint focus:outline-none"
          />
          <Kbd>Esc</Kbd>
        </div>

        <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto py-1.5">
          {!results.length && (
            <p className="px-3.5 py-8 text-center text-base text-faint">
              Nothing matches “{q}”.
            </p>
          )}

          {results.map((c, i) => {
            const showGroup = c.group !== lastGroup;
            lastGroup = c.group;
            return (
              <React.Fragment key={c.id}>
                {showGroup && <div className="eyebrow px-3.5 pb-1 pt-2.5">{c.group}</div>}
                <button
                  type="button"
                  data-index={i}
                  onMouseMove={() => setCursor(i)}
                  onClick={c.run}
                  className={cx(
                    'flex w-full items-center gap-2.5 px-3.5 py-[7px] text-left',
                    i === cursor ? 'bg-surface2' : 'bg-transparent'
                  )}
                >
                  <c.Icon size={14} />
                  <span className="min-w-0 flex-1 truncate text-base text-ink">{c.label}</span>
                  {c.hint && <span className="shrink-0 text-xs text-faint">{c.hint}</span>}
                </button>
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
}
