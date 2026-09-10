'use client';

import React, { useEffect, useRef } from 'react';
import { IconMic, IconSend, IconStop, IconSpeaker, IconSpeakerOff } from '../ui/Icons';
import { cx, IconButton, Spinner } from '../ui/Primitives';
import type { VoiceState } from '../../lib/spark/types';

/* ============================================================
   The composer anchors the conversation. A rectangle with a
   border, not a floating pill — it belongs to the pane it sits in.
   ============================================================ */

const BUSY: VoiceState[] = ['thinking', 'querying', 'answering'];

const STATUS_COPY: Partial<Record<VoiceState, string>> = {
  listening: 'Listening',
  thinking: 'Understanding your question',
  querying: 'Running analysis',
  answering: 'Preparing your answer',
  speaking: 'Speaking',
};

export interface QueryComposerProps {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  onCancel: () => void;

  voiceState: VoiceState;
  onToggleVoice: () => void;
  micEnabled: boolean;
  micHint?: string;

  muted: boolean;
  onToggleMute: () => void;
  canSpeak: boolean;

  disabled?: boolean;
  inputRef?: React.RefObject<HTMLTextAreaElement | null>;
}

export function QueryComposer({
  value,
  onChange,
  onSubmit,
  onCancel,
  voiceState,
  onToggleVoice,
  micEnabled,
  micHint,
  muted,
  onToggleMute,
  canSpeak,
  disabled,
  inputRef,
}: QueryComposerProps) {
  const localRef = useRef<HTMLTextAreaElement>(null);
  const ref = inputRef ?? localRef;

  const busy = BUSY.includes(voiceState);
  const listening = voiceState === 'listening';
  const canSubmit = value.trim().length > 0 && !busy && !disabled;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [value, ref]);

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (canSubmit) onSubmit();
    }
  };

  return (
    <div className="w-full">
      {/* One line of state, in place. No toast, no overlay. */}
      <div aria-live="polite" className="h-[18px] px-0.5">
        {(listening || busy || voiceState === 'speaking') && (
          <div className="a-in flex items-center gap-2 pb-1">
            {listening ? <Meter /> : <Spinner size={10} className="text-muted" />}
            <span className="text-xs text-muted">{STATUS_COPY[voiceState]}</span>
            {voiceState === 'listening' && (
              <span className="text-xs text-faint">— pause when done, or Esc</span>
            )}
          </div>
        )}
      </div>

      <div
        className={cx(
          'rounded-xl border bg-surface transition-colors duration-1 ease-out',
          listening ? 'border-accent-line' : 'border-line focus-within:border-[#3A3B3B]'
        )}
      >
        <label htmlFor="spark-composer" className="sr-only">
          Ask a question about your data
        </label>
        <textarea
          id="spark-composer"
          ref={ref}
          rows={1}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKey}
          placeholder={listening ? 'Speak now' : 'Ask anything about your data'}
          className={cx(
            'block w-full resize-none bg-transparent px-3 pt-2.5 text-prose text-ink',
            'placeholder:text-faint focus:outline-none disabled:opacity-50'
          )}
        />

        <div className="flex items-center gap-1 px-2 pb-2 pt-1">
          {/* Voice matters, so it is a labelled control — but a neutral
              one until it is actually open. */}
          <button
            type="button"
            onClick={onToggleVoice}
            disabled={!micEnabled || busy}
            title={micEnabled ? (listening ? 'Stop listening' : 'Ask by voice') : micHint}
            aria-label={listening ? 'Stop listening' : 'Start voice input'}
            aria-pressed={listening}
            className={cx(
              'flex h-7 items-center gap-1.5 rounded-md border px-2 transition-colors duration-1 ease-out',
              'disabled:opacity-30 disabled:pointer-events-none',
              listening
                ? 'border-accent-lo bg-accent text-accent-ink'
                : 'border-line-subtle text-muted hover:border-line hover:bg-surface2 hover:text-ink'
            )}
          >
            <IconMic size={14} />
            <span className="text-sm font-medium">{listening ? 'Listening' : 'Voice'}</span>
          </button>

          <div className="flex-1" />

          {canSpeak && (
            <IconButton
              label={muted ? 'Unmute answers' : 'Mute answers'}
              side="top"
              onClick={onToggleMute}
              active={muted}
            >
              {muted ? <IconSpeakerOff size={14} /> : <IconSpeaker size={14} />}
            </IconButton>
          )}

          {busy ? (
            <button
              type="button"
              onClick={onCancel}
              className="flex h-7 items-center gap-1.5 rounded-md border border-line-subtle px-2 text-sm text-muted transition-colors duration-1 hover:border-line hover:bg-surface2 hover:text-ink"
            >
              <IconStop size={12} />
              Stop
            </button>
          ) : (
            <button
              type="button"
              onClick={onSubmit}
              disabled={!canSubmit}
              aria-label="Send question"
              className={cx(
                'flex h-7 items-center gap-1.5 rounded-md border px-2.5 text-sm font-medium',
                'transition-colors duration-1 ease-out disabled:opacity-30 disabled:pointer-events-none',
                'border-accent-lo bg-accent text-accent-ink hover:bg-accent-hi hover:border-accent-hi'
              )}
            >
              Ask
              <IconSend size={12} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* Four bars. It reports that the microphone is open — it is not
   pretending to measure amplitude, so it stays a fixed cadence. */
// Driven by a timer, not the CSS `animation` property: Chromium clamps
// animation/transition durations to ~instant whenever the OS says to
// reduce motion (Windows Settings > Accessibility > Visual effects >
// Animation effects, off) — every bar would still be present in the DOM,
// just visibly frozen at its resting frame. A JS-driven loop is just
// repeated style writes, not a CSS timing primitive, so that clamp
// doesn't apply to it — the meter keeps moving regardless of the OS
// setting, same as the mic itself keeps recording regardless of it.
function Meter() {
  const barsRef = useRef<(HTMLSpanElement | null)[]>([]);

  useEffect(() => {
    const start = performance.now();
    const id = setInterval(() => {
      const t = performance.now() - start;
      barsRef.current.forEach((el, i) => {
        if (!el) return;
        const phase = ((t + i * 120) % 900) / 900;
        const scale = 0.3 + 0.7 * Math.abs(Math.sin(phase * Math.PI));
        el.style.transform = `scaleY(${scale.toFixed(3)})`;
      });
    }, 50);
    return () => clearInterval(id);
  }, []);

  return (
    <span className="flex h-2.5 items-center gap-[2px]" aria-hidden="true">
      {[0, 1, 2, 3].map((i) => (
        <span
          key={i}
          ref={(el) => {
            barsRef.current[i] = el;
          }}
          className="block h-full w-[2px] rounded-full bg-accent"
          style={{ transformOrigin: '50% center' }}
        />
      ))}
    </span>
  );
}
