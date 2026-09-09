'use client';

import React from 'react';
import { IconSearch, IconPlus } from '../ui/Icons';
import { IconButton, Kbd, cx } from '../ui/Primitives';

/* ============================================================
   A 44px rule with a title and one control. Everything else that
   wanted to live up here belongs in the palette behind it.
   ============================================================ */

export function Topbar({
  title,
  subtitle,
  onOpenPalette,
  onNewConversation,
}: {
  title: string;
  subtitle?: string;
  onOpenPalette: () => void;
  onNewConversation?: () => void;
}) {
  return (
    <header className="flex h-11 shrink-0 items-center gap-3 border-b border-line-subtle px-4">
      <div className="flex min-w-0 items-baseline gap-2">
        <h1 className="truncate text-base font-medium text-ink">{title}</h1>
        {subtitle && <span className="truncate text-sm text-faint">{subtitle}</span>}
      </div>

      <div className="flex-1" />

      <button
        type="button"
        onClick={onOpenPalette}
        className={cx(
          'group flex h-7 w-[220px] items-center gap-2 rounded-lg border border-line-subtle bg-bg px-2.5',
          'text-left transition-colors duration-1 ease-out hover:border-line'
        )}
      >
        <IconSearch size={13} className="shrink-0 text-faint" />
        <span className="flex-1 truncate text-sm text-faint">Search or run a command</span>
        <Kbd>⌘K</Kbd>
      </button>

      {onNewConversation && (
        <IconButton label="New conversation" onClick={onNewConversation}>
          <IconPlus size={15} />
        </IconButton>
      )}
    </header>
  );
}
