'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { IconCheck, IconClose, IconCopy } from './Icons';

export const cx = (...parts: Array<string | false | null | undefined>) =>
  parts.filter(Boolean).join(' ');

/* =============================================================
   Button

   Three ranks, and they are genuinely different — a filled accent,
   a bordered surface, and plain text. Nothing is a pill.
   ============================================================= */

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

const BTN_BASE =
  'inline-flex items-center justify-center gap-1.5 rounded-md border font-medium whitespace-nowrap ' +
  'transition-colors duration-1 ease-out disabled:opacity-40 disabled:pointer-events-none';

const BTN_VARIANT: Record<ButtonVariant, string> = {
  primary:
    'border-accent-lo bg-accent text-accent-ink hover:bg-accent-hi hover:border-accent-hi active:bg-accent-lo',
  secondary:
    'border-line bg-surface2 text-ink hover:bg-surface3 hover:border-[#3A3B3B]',
  ghost: 'border-transparent bg-transparent text-muted hover:bg-surface2 hover:text-ink',
  danger:
    'border-line bg-transparent text-negative hover:border-negative/45 hover:bg-negative/10',
};

const BTN_SIZE: Record<ButtonSize, string> = {
  sm: 'h-6 px-2 text-xs',
  md: 'h-7 px-2.5 text-sm',
  lg: 'h-8 px-3.5 text-base',
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

export function Button({
  variant = 'secondary',
  size = 'md',
  loading = false,
  className,
  children,
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled || loading}
      className={cx(BTN_BASE, BTN_VARIANT[variant], BTN_SIZE[size], className)}
      {...rest}
    >
      {loading && <Spinner size={11} />}
      {children}
    </button>
  );
}

/* =============================================================
   IconButton — every icon-only control carries a name
   ============================================================= */

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  active?: boolean;
  size?: 'sm' | 'md';
  tone?: 'default' | 'danger';
  side?: 'top' | 'bottom' | 'left' | 'right';
}

export function IconButton({
  label,
  active = false,
  size = 'md',
  tone = 'default',
  side = 'bottom',
  className,
  children,
  ...rest
}: IconButtonProps) {
  return (
    <Tooltip label={label} side={side}>
      <button
        type="button"
        aria-label={label}
        className={cx(
          'inline-flex items-center justify-center rounded-sm border border-transparent',
          'transition-colors duration-1 ease-out disabled:opacity-30 disabled:pointer-events-none',
          size === 'sm' ? 'h-[22px] w-[22px]' : 'h-6.5 w-6.5 min-h-[26px] min-w-[26px]',
          active
            ? 'bg-accent-soft text-accent'
            : tone === 'danger'
            ? 'text-faint hover:bg-surface2 hover:text-negative'
            : 'text-faint hover:bg-surface2 hover:text-ink',
          className
        )}
        {...rest}
      >
        {children}
      </button>
    </Tooltip>
  );
}

/* =============================================================
   Tooltip — 11px, one line, no arrow, no animation
   ============================================================= */

export function Tooltip({
  label,
  side = 'bottom',
  children,
}: {
  label: string;
  side?: 'top' | 'bottom' | 'right' | 'left';
  children: React.ReactNode;
}) {
  const pos =
    side === 'top'
      ? 'bottom-full left-1/2 -translate-x-1/2 mb-1'
      : side === 'right'
      ? 'left-full top-1/2 -translate-y-1/2 ml-1.5'
      : side === 'left'
      ? 'right-full top-1/2 -translate-y-1/2 mr-1.5'
      : 'top-full left-1/2 -translate-x-1/2 mt-1';

  return (
    <span className="relative inline-flex group/tt">
      {children}
      <span
        role="tooltip"
        className={cx(
          'pointer-events-none absolute z-50 whitespace-nowrap rounded-sm border border-line',
          'bg-surface3 px-1.5 py-[3px] text-2xs text-ink shadow-pop',
          'opacity-0 group-hover/tt:opacity-100 group-focus-within/tt:opacity-100',
          'transition-opacity duration-1 ease-out',
          pos
        )}
      >
        {label}
      </span>
    </span>
  );
}

/* =============================================================
   Input
   ============================================================= */

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  mono?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, mono, ...rest },
  ref
) {
  return (
    <input
      ref={ref}
      className={cx(
        'h-8 w-full rounded-lg border border-line bg-bg px-2.5 text-base text-ink',
        'placeholder:text-faint transition-colors duration-1 ease-out',
        'hover:border-[#3A3B3B] focus:border-accent-line',
        'disabled:opacity-45 disabled:pointer-events-none',
        mono && 'font-mono text-sm',
        className
      )}
      {...rest}
    />
  );
});

export function Field({
  label,
  hint,
  optional,
  children,
}: {
  label: string;
  hint?: string;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-baseline gap-2">
        <span className="text-sm font-medium text-ink">{label}</span>
        {optional && <span className="text-xs text-faint">Optional</span>}
      </span>
      {children}
      {hint && <span className="mt-1 block text-xs leading-relaxed text-faint">{hint}</span>}
    </label>
  );
}

/* =============================================================
   Eyebrow — the only uppercase in the product
   ============================================================= */

export function Eyebrow({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cx('eyebrow', className)}>{children}</div>;
}

/* =============================================================
   Badge — a quiet tag, not a status pill
   ============================================================= */

type BadgeTone = 'neutral' | 'accent' | 'negative' | 'warning' | 'info';

const BADGE_TONE: Record<BadgeTone, string> = {
  neutral: 'border-line text-muted',
  accent: 'border-accent-line text-accent',
  negative: 'border-negative/35 text-negative',
  warning: 'border-warning/35 text-warning',
  info: 'border-info/35 text-info',
};

export function Badge({
  tone = 'neutral',
  mono,
  className,
  children,
}: {
  tone?: BadgeTone;
  mono?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 rounded-xs border px-1.5 py-[1px] text-2xs',
        BADGE_TONE[tone],
        mono && 'font-mono tnum',
        className
      )}
    >
      {children}
    </span>
  );
}

/* =============================================================
   Status — a 5px dot plus a word. Never colour alone.
   ============================================================= */

export type ConnState = 'connected' | 'connecting' | 'disconnected' | 'error';

const STATE_META: Record<ConnState, { color: string; label: string }> = {
  connected: { color: 'var(--positive)', label: 'Connected' },
  connecting: { color: 'var(--warning)', label: 'Connecting' },
  disconnected: { color: 'var(--idle)', label: 'Not connected' },
  error: { color: 'var(--negative)', label: 'Error' },
};

export function StatusDot({ state, className }: { state: ConnState; className?: string }) {
  const meta = STATE_META[state];
  return (
    <span
      className={cx('inline-block h-[5px] w-[5px] shrink-0 rounded-full', className)}
      style={{ background: meta.color }}
      role="img"
      aria-label={meta.label}
    />
  );
}

export function statusLabel(state: ConnState) {
  return STATE_META[state].label;
}

/* =============================================================
   Spinner / Skeleton
   Prefer a skeleton wherever the shape is already known.
   ============================================================= */

export function Spinner({ size = 12, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={cx('animate-spin', className)}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" opacity="0.16" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx('a-skeleton rounded-xs', className)} aria-hidden="true" />;
}

/* =============================================================
   Panel — used only for things that are genuinely one object
   ============================================================= */

export function Panel({ className, children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cx('rounded-xl border border-line-subtle bg-surface', className)} {...rest}>
      {children}
    </div>
  );
}

/* =============================================================
   Modal
   ============================================================= */

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  width = 620,
  footer,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  width?: number;
  footer?: React.ReactNode;
  children: React.ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key === 'Tab' && panelRef.current) {
        const f = panelRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (!f.length) return;
        const first = f[0];
        const last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      panelRef.current?.querySelector<HTMLElement>('input, button:not([data-close])')?.focus();
    }, 30);
    return () => clearTimeout(t);
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="a-in fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-6"
      onMouseDown={onClose}
      role="presentation"
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(e) => e.stopPropagation()}
        className="a-rise flex max-h-[86vh] w-full flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-overlay"
        style={{ maxWidth: width }}
      >
        <div className="flex items-start gap-3 border-b border-line-subtle px-4 py-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold text-ink">{title}</h2>
            {subtitle && <p className="mt-0.5 truncate text-sm text-muted">{subtitle}</p>}
          </div>
          <IconButton label="Close" data-close onClick={onClose}>
            <IconClose size={14} />
          </IconButton>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">{children}</div>

        {footer && (
          <div className="flex items-center justify-end gap-2 border-t border-line-subtle px-4 py-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

/* =============================================================
   Popover
   ============================================================= */

export function Popover({
  open,
  onClose,
  align = 'left',
  className,
  children,
}: {
  open: boolean;
  onClose: () => void;
  align?: 'left' | 'right';
  className?: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={ref}
      className={cx(
        'a-in absolute top-full z-40 mt-1 rounded-xl border border-line bg-surface2 shadow-overlay',
        align === 'right' ? 'right-0' : 'left-0',
        className
      )}
    >
      {children}
    </div>
  );
}

/* =============================================================
   Chip — a follow-up question. Understated text, not a coloured pill.
   ============================================================= */

export function Chip({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cx(
        'rounded-md border border-line-subtle bg-transparent px-2 py-1 text-left text-sm text-muted',
        'transition-colors duration-1 ease-out',
        'hover:border-line hover:bg-surface2 hover:text-ink',
        'disabled:opacity-40 disabled:pointer-events-none'
      )}
    >
      {children}
    </button>
  );
}

/* =============================================================
   CopyButton
   ============================================================= */

export function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);

  const copy = useCallback(() => {
    navigator.clipboard.writeText(text).then(
      () => {
        setDone(true);
        setTimeout(() => setDone(false), 1300);
      },
      () => setDone(false)
    );
  }, [text]);

  return (
    <IconButton label={done ? 'Copied' : label} onClick={copy} size="sm">
      {done ? <IconCheck size={12} className="text-accent" /> : <IconCopy size={12} />}
    </IconButton>
  );
}

/* =============================================================
   EmptyState — editorial. A sentence and one action, no artwork.
   ============================================================= */

export function EmptyState({
  title,
  body,
  action,
  align = 'center',
}: {
  title: string;
  body?: string;
  action?: React.ReactNode;
  align?: 'center' | 'left';
}) {
  return (
    <div
      className={cx(
        'flex h-full flex-col justify-center px-8 py-14',
        align === 'center' ? 'items-center text-center' : 'items-start'
      )}
    >
      <h3 className="text-lg font-medium text-ink">{title}</h3>
      {body && <p className="mt-1.5 max-w-[38ch] text-md leading-relaxed text-muted">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/* =============================================================
   Kbd
   ============================================================= */

export function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex h-[15px] min-w-[15px] items-center justify-center rounded-xs border border-line px-1 font-mono text-[10px] leading-none text-faint">
      {children}
    </kbd>
  );
}

/* =============================================================
   Toast
   ============================================================= */

export interface ToastMsg {
  id: number;
  text: string;
  tone?: 'neutral' | 'error' | 'success';
}

export function ToastStack({
  toasts,
  onDismiss,
}: {
  toasts: ToastMsg[];
  onDismiss: (id: number) => void;
}) {
  useEffect(() => {
    if (!toasts.length) return;
    const timers = toasts.map((t) => setTimeout(() => onDismiss(t.id), 4000));
    return () => timers.forEach(clearTimeout);
  }, [toasts, onDismiss]);

  if (!toasts.length) return null;

  return (
    <div className="pointer-events-none fixed bottom-4 left-1/2 z-[60] flex -translate-x-1/2 flex-col items-center gap-1.5">
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          className="a-rise pointer-events-auto flex items-center gap-2.5 rounded-lg border border-line bg-surface3 py-2 pl-3 pr-2 shadow-overlay"
        >
          {t.tone && t.tone !== 'neutral' && (
            <span
              aria-hidden="true"
              className="h-[5px] w-[5px] shrink-0 rounded-full"
              style={{
                background: t.tone === 'error' ? 'var(--negative)' : 'var(--positive)',
              }}
            />
          )}
          <span className="text-base text-ink">{t.text}</span>
          <button
            onClick={() => onDismiss(t.id)}
            aria-label="Dismiss"
            className="text-faint transition-colors duration-1 hover:text-ink"
          >
            <IconClose size={12} />
          </button>
        </div>
      ))}
    </div>
  );
}
