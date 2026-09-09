'use client';

import React, { useMemo, useState } from 'react';
import type { Conversation } from '../../lib/spark/types';
import { relativeTime } from '../../lib/spark/format';
import { Button, EmptyState, IconButton, Input, cx } from '../ui/Primitives';
import { IconCheck, IconEdit, IconPin, IconPlus, IconSearch, IconTrash } from '../ui/Icons';

export function ConversationsView({
  conversations,
  activeId,
  onOpen,
  onRename,
  onDelete,
  onTogglePin,
  onNew,
}: {
  conversations: Conversation[];
  activeId: string | null;
  onOpen: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
  onTogglePin: (id: string) => void;
  onNew: () => void;
}) {
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const filtered = needle
      ? conversations.filter(
          (c) =>
            c.title.toLowerCase().includes(needle) ||
            c.turns.some((t) => t.question.toLowerCase().includes(needle))
        )
      : conversations;
    return [...filtered].sort((a, b) => {
      if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1;
      return b.updatedAt - a.updatedAt;
    });
  }, [conversations, q]);

  if (!conversations.length) {
    return (
      <EmptyState
        title="No conversations yet."
        body="Every question is kept here with its answer, its SQL and its results, so you can pick the thread back up."
        action={
          <Button variant="primary" onClick={onNew}>
            <IconPlus size={13} />
            Ask something
          </Button>
        }
      />
    );
  }

  return (
    <div className="mx-auto w-full max-w-[680px] px-6 py-10">
      <div className="mb-4 flex items-center gap-3">
        <h1 className="flex-1 text-2xl font-semibold text-ink">Conversations</h1>
        <Button size="md" onClick={onNew}>
          <IconPlus size={12} />
          New
        </Button>
      </div>

      <div className="mb-1 flex items-center gap-2 border-b border-line-subtle px-0.5 pb-2">
        <IconSearch size={13} className="text-faint" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search conversations"
          aria-label="Search conversations"
          className="h-6 flex-1 bg-transparent text-base text-ink placeholder:text-faint focus:outline-none"
        />
        {q && <span className="tnum font-mono text-2xs text-faint">{list.length}</span>}
      </div>

      {!list.length ? (
        <p className="px-1 py-10 text-center text-base text-faint">Nothing matches “{q}”.</p>
      ) : (
        <ul className="m-0 list-none divide-y divide-line-subtle p-0">
          {list.map((c) => {
            const isEditing = editing === c.id;
            const last = c.turns[c.turns.length - 1];
            return (
              <li key={c.id}>
                <div
                  className={cx(
                    'group flex items-center gap-3 py-2.5 transition-colors duration-1',
                    c.id === activeId && 'bg-surface'
                  )}
                >
                  <div className="min-w-0 flex-1">
                    {isEditing ? (
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          if (draft.trim()) onRename(c.id, draft.trim());
                          setEditing(null);
                        }}
                        className="flex items-center gap-1.5"
                      >
                        <Input
                          value={draft}
                          autoFocus
                          onChange={(e) => setDraft(e.target.value)}
                          onKeyDown={(e) => e.key === 'Escape' && setEditing(null)}
                          className="h-7"
                        />
                        <IconButton label="Save name" size="sm" type="submit">
                          <IconCheck size={12} />
                        </IconButton>
                      </form>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onOpen(c.id)}
                        className="block w-full text-left"
                      >
                        <span className="flex items-center gap-1.5">
                          {c.pinned && <IconPin size={11} className="shrink-0 text-accent" />}
                          <span className="truncate text-base text-ink">{c.title}</span>
                        </span>
                        {last && (
                          <span className="mt-0.5 block truncate text-sm text-faint">
                            {last.question}
                          </span>
                        )}
                      </button>
                    )}
                  </div>

                  <span className="shrink-0 whitespace-nowrap font-mono text-2xs text-faint">
                    <span className="tnum">{c.turns.length}</span> · {relativeTime(c.updatedAt)}
                  </span>

                  <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity duration-1 focus-within:opacity-100 group-hover:opacity-100">
                    <IconButton
                      label={c.pinned ? 'Unpin' : 'Pin'}
                      size="sm"
                      active={c.pinned}
                      onClick={() => onTogglePin(c.id)}
                    >
                      <IconPin size={12} />
                    </IconButton>
                    <IconButton
                      label="Rename"
                      size="sm"
                      onClick={() => {
                        setEditing(c.id);
                        setDraft(c.title);
                      }}
                    >
                      <IconEdit size={12} />
                    </IconButton>
                    <IconButton label="Delete" size="sm" tone="danger" onClick={() => onDelete(c.id)}>
                      <IconTrash size={12} />
                    </IconButton>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
