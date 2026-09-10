'use client';

import React, { useEffect, useState } from 'react';
import {
  SparkLogo,
  SparkMark,
  IconAsk,
  IconExplore,
  IconData,
  IconConversations,
  IconSettings,
  IconLogout,
  IconPlug,
  IconPlus,
  IconSchema,
  IconZap,
  IconChevronRight,
} from '../ui/Icons';
import { Button, ConnState, cx, IconButton, Popover, StatusDot, statusLabel } from '../ui/Primitives';
import type { SourceType } from '../../lib/spark/types';

export type NavKey = 'ask' | 'explore' | 'data' | 'conversations';

const COLLAPSE_KEY = 'spark.sidebar.collapsed';

const NAV: { key: NavKey; label: string; Icon: React.ComponentType<{ size?: number }> }[] = [
  { key: 'ask', label: 'Ask', Icon: IconAsk },
  { key: 'explore', label: 'Explore', Icon: IconExplore },
  { key: 'data', label: 'Data', Icon: IconData },
  { key: 'conversations', label: 'Conversations', Icon: IconConversations },
];

const SOURCE_LABEL: Record<SourceType, string> = {
  postgresql: 'PostgreSQL',
  mysql: 'MySQL',
  sqlite: 'SQLite',
  supabase: 'Supabase',
  csv: 'CSV',
  xlsx: 'Excel',
  json: 'JSON',
};

export interface SidebarProps {
  active: NavKey;
  onNavigate: (key: NavKey) => void;

  datasetName: string;
  sourceType: SourceType | null;
  connState: ConnState;

  onManageData: () => void;
  onOpenSchema: () => void;
  onOpenSettings: () => void;
  settingsConfigured: boolean;

  onNewConversation: () => void;
  conversationCount: number;

  userEmail?: string;
  userAvatar?: string;
  onLogout: () => void;

  /** Current billing tier, e.g. "FREE" / "BLAZE" — null while status is loading. */
  plan: string | null;
  onOpenPricing: () => void;
}

export function Sidebar({
  active,
  onNavigate,
  datasetName,
  sourceType,
  connState,
  onManageData,
  onOpenSchema,
  onOpenSettings,
  settingsConfigured,
  onNewConversation,
  conversationCount,
  userEmail,
  userAvatar,
  onLogout,
  plan,
  onOpenPricing,
}: SidebarProps) {
  const [ctxOpen, setCtxOpen] = useState(false);
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

  return (
    <div className="relative flex h-full shrink-0">
      <nav
        aria-label="Primary"
        className={cx(
          'flex h-full shrink-0 flex-col border-r border-line-subtle bg-surface transition-[width] duration-2 ease-out',
          collapsed ? 'w-[52px]' : 'w-[200px]'
        )}
      >
      <div className={cx('flex h-11 items-center', collapsed ? 'justify-center px-1' : 'px-3.5')}>
        {collapsed ? <SparkMark size={17} /> : <SparkLogo size={17} />}
      </div>

      {/* The one action that should never require a hunt: starting fresh. */}
      <div className={cx('pb-2.5', collapsed ? 'px-1.5' : 'px-2.5')}>
        {collapsed ? (
          <button
            type="button"
            onClick={onNewConversation}
            title="New conversation"
            aria-label="New conversation"
            className={cx(
              'flex w-full items-center justify-center rounded-md bg-accent py-1.5 text-accent-ink',
              'transition-colors duration-1 ease-out hover:bg-accent-hi'
            )}
          >
            <IconPlus size={15} />
          </button>
        ) : (
          <Button variant="primary" className="w-full justify-start" onClick={onNewConversation}>
            <IconPlus size={14} />
            New conversation
          </Button>
        )}
      </div>

      {/* Workspace. The one piece of context that is always on screen. */}
      <div className={cx('relative pb-2.5', collapsed ? 'px-1.5' : 'px-2.5')}>
        <button
          type="button"
          onClick={() => setCtxOpen((v) => !v)}
          aria-expanded={ctxOpen}
          aria-haspopup="dialog"
          title={collapsed ? datasetName || 'No source' : undefined}
          className={cx(
            'flex w-full items-center gap-2 rounded-lg text-left',
            'transition-colors duration-1 ease-out hover:bg-surface2',
            collapsed ? 'justify-center py-1.5' : 'px-2 py-1.5'
          )}
        >
          <StatusDot state={connState} />
          {!collapsed && (
            <span className="min-w-0 flex-1">
              <span className="block truncate text-base font-medium leading-tight text-ink">
                {datasetName || 'No source'}
              </span>
              <span className="block truncate text-xs leading-tight text-faint">
                {sourceType ? SOURCE_LABEL[sourceType] : 'Not connected'}
              </span>
            </span>
          )}
        </button>

        <Popover open={ctxOpen} onClose={() => setCtxOpen(false)} className="w-[228px] p-1">
          <div className="border-b border-line-subtle px-2.5 py-2">
            <div className="flex items-center gap-1.5">
              <StatusDot state={connState} />
              <span className="text-sm text-ink">{statusLabel(connState)}</span>
            </div>
            {datasetName && (
              <dl className="mt-2 space-y-1">
                <Row label="Source" value={sourceType ? SOURCE_LABEL[sourceType] : '—'} />
                <Row label="Name" value={datasetName} mono />
                <Row label="Engine" value="DuckDB · local" mono />
              </dl>
            )}
          </div>
          <div className="pt-1">
            <MenuItem
              icon={<IconPlug size={14} />}
              label={connState === 'connected' ? 'Manage sources' : 'Connect a source'}
              onClick={() => {
                setCtxOpen(false);
                onManageData();
              }}
            />
            <MenuItem
              icon={<IconSchema size={14} />}
              label="Schema map"
              disabled={connState !== 'connected'}
              onClick={() => {
                setCtxOpen(false);
                onOpenSchema();
              }}
            />
          </div>
        </Popover>
      </div>

      <ul className={cx('flex flex-col gap-px', collapsed ? 'px-1.5' : 'px-2.5')}>
        {NAV.map(({ key, label, Icon }) => {
          const isActive = active === key;
          return (
            <li key={key}>
              <button
                type="button"
                onClick={() => onNavigate(key)}
                aria-current={isActive ? 'page' : undefined}
                title={collapsed ? label : undefined}
                className={cx(
                  'group relative flex w-full items-center rounded-md py-1.5 text-base transition-colors duration-1 ease-out',
                  collapsed ? 'justify-center px-2' : 'gap-2.5 pl-2.5 pr-2',
                  isActive
                    ? 'bg-accent-soft text-ink'
                    : 'text-muted hover:bg-surface2 hover:text-ink'
                )}
              >
                {/* A 2px rule, not a filled pill. Shape carries the state
                    so it survives without colour. */}
                <span
                  aria-hidden="true"
                  className={cx(
                    'absolute left-0 top-1/2 h-3.5 w-[2px] -translate-y-1/2 rounded-r-sm bg-accent',
                    isActive ? 'opacity-100' : 'opacity-0'
                  )}
                />
                <Icon size={15} />
                {!collapsed && (
                  <>
                    <span className="flex-1 text-left">{label}</span>
                    {key === 'conversations' && conversationCount > 0 && (
                      <span className="tnum font-mono text-2xs text-faint">{conversationCount}</span>
                    )}
                  </>
                )}
              </button>
            </li>
          );
        })}
      </ul>

      <div className="flex-1" />

      <div className={cx('p-2.5', collapsed && 'px-1.5')}>
        {collapsed ? (
          <div className="mb-2 flex flex-col items-center gap-1.5">
            <IconButton label={plan && plan !== 'FREE' ? `${plan} plan` : 'Upgrade'} side="right" onClick={onOpenPricing}>
              <IconZap size={14} className="text-accent" />
            </IconButton>
          </div>
        ) : (
          <button
            type="button"
            onClick={onOpenPricing}
            className="mb-2 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors duration-1 hover:bg-surface2"
          >
            <IconZap size={13} className="shrink-0 text-accent" />
            <span className="flex-1 text-sm text-muted">
              {plan && plan !== 'FREE' ? `${plan.charAt(0)}${plan.slice(1).toLowerCase()} plan` : 'Upgrade'}
            </span>
            {(!plan || plan === 'FREE') && (
              <span className="text-2xs text-faint">Free</span>
            )}
          </button>
        )}

        {!settingsConfigured && !collapsed && (
          <button
            type="button"
            onClick={onOpenSettings}
            className="mb-2 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors duration-1 hover:bg-surface2"
          >
            <span
              aria-hidden="true"
              className="h-[5px] w-[5px] shrink-0 rounded-full"
              style={{ background: 'var(--warning)' }}
            />
            <span className="text-sm leading-snug text-warning">Add a Groq key</span>
          </button>
        )}

        {collapsed ? (
          <div className="flex flex-col items-center gap-1.5">
            <IconButton label="Settings" side="right" onClick={onOpenSettings}>
              <IconSettings size={14} />
            </IconButton>
            <IconButton label="Sign out" side="right" tone="danger" onClick={onLogout}>
              <IconLogout size={14} />
            </IconButton>
          </div>
        ) : (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onOpenSettings}
              className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-1.5 py-1.5 text-left text-muted transition-colors duration-1 hover:bg-surface2 hover:text-ink"
            >
              {userAvatar ? (
                <img src={userAvatar} alt="" className="h-5 w-5 shrink-0 rounded-full object-cover" />
              ) : (
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-surface3 text-2xs text-muted">
                  {userEmail?.[0]?.toUpperCase() ?? 'U'}
                </span>
              )}
              <span className="min-w-0 flex-1 truncate text-sm">
                {userEmail?.split('@')[0] ?? 'Account'}
              </span>
            </button>

            <IconButton label="Settings" side="top" onClick={onOpenSettings}>
              <IconSettings size={14} />
            </IconButton>
            <IconButton label="Sign out" side="top" tone="danger" onClick={onLogout}>
              <IconLogout size={14} />
            </IconButton>
          </div>
        )}
      </div>
      </nav>

      {/* Edge-mounted fold handle — always in the same visible spot,
          straddling the border, regardless of collapsed state. */}
      <button
        type="button"
        onClick={toggleCollapsed}
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        className={cx(
          'absolute top-1/2 z-10 flex h-9 w-4 -translate-y-1/2 items-center justify-center',
          'rounded-full border border-line bg-surface2 text-faint shadow-pop',
          'transition-colors duration-1 ease-out hover:border-accent-line hover:bg-surface3 hover:text-ink'
        )}
        style={{ left: collapsed ? 44 : 192 }}
      >
        <IconChevronRight size={11} className={collapsed ? '' : 'rotate-180'} />
      </button>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-xs text-faint">{label}</dt>
      <dd className={cx('m-0 min-w-0 truncate text-xs text-muted', mono && 'font-mono')}>
        {value}
      </dd>
    </div>
  );
}

function MenuItem({
  icon,
  label,
  onClick,
  disabled,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cx(
        'flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-base',
        'transition-colors duration-1 ease-out',
        disabled
          ? 'cursor-not-allowed text-faint opacity-45'
          : 'text-muted hover:bg-surface3 hover:text-ink'
      )}
    >
      <span className="shrink-0">{icon}</span>
      {label}
    </button>
  );
}
