'use client';

import { useState, useEffect } from 'react';
import { Button, Field, Input, Spinner, cx } from './ui/Primitives';
import { IconCheck, IconClose, IconLock, IconSearch } from './ui/Icons';
import { quotaFor } from '../lib/spark/quotas';
import type { Tier } from '../lib/api';
import type { LegalDoc } from './legal/TermsBody';

type PrivacyLevel = 'standard' | 'strict' | 'local';

interface Settings {
  groqApiKey: string;
  deepgramApiKey: string;
  privacy?: { level: PrivacyLevel };
}

const PRIVACY_OPTIONS: { value: PrivacyLevel; label: string; detail: string }[] = [
  {
    value: 'standard',
    label: 'Standard',
    detail: 'Schema and fabricated sample rows go to Groq. Real names, emails and other personal values are replaced with placeholders and restored on your machine.',
  },
  {
    value: 'strict',
    label: 'Strict',
    detail: 'Every result value is replaced with a placeholder, no column values are ever shared, and voice output stays on-device. Filters on status-like columns may be less accurate.',
  },
  {
    value: 'local',
    label: 'Offline support',
    detail: 'Nothing leaves this machine — not even your question. Requires a downloaded local model, and answer quality is noticeably lower.',
  },
];

const LEGAL_DOCS: { label: string; doc: LegalDoc }[] = [
  { label: 'Terms of Service', doc: 'terms' },
  { label: 'Privacy Policy', doc: 'privacy' },
  { label: 'Refund & Cancellation', doc: 'refund' },
];

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (settings: Settings) => void;
  plan: Tier | null;
  onUpgrade?: () => void;
  /** Switches the main column to the in-app Terms/Privacy/Refund view. */
  onOpenLegal?: (doc: LegalDoc) => void;
}

type TestState = 'success' | 'error' | 'testing';

export default function SettingsModal({ isOpen, onClose, onSave, plan, onUpgrade, onOpenLegal }: SettingsModalProps) {
  const [settings, setSettings] = useState<Settings>({
    groqApiKey: '',
    deepgramApiKey: '',
    privacy: { level: 'standard' }
  });

  const [isLoading, setIsLoading] = useState(false);
  const [testResults, setTestResults] = useState<{ [key: string]: TestState }>({});

  const quota = quotaFor(plan);

  useEffect(() => {
    if (isOpen) loadSettings();
  }, [isOpen]);

  const loadSettings = async () => {
    try {
      if (window.electronAPI) {
        const savedSettings = await window.electronAPI.getSettings();
        setSettings((prev) => ({ ...prev, ...savedSettings }));
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const handleSave = async () => {
    setIsLoading(true);
    try {
      if (window.electronAPI) {
        // A downgrade (or a key entered before upgrading, then never
        // cleared) shouldn't leave a locked feature silently configured.
        const toSave: Settings = {
          ...settings,
          deepgramApiKey: quota.voice ? settings.deepgramApiKey : '',
          privacy:
            !quota.offlineSupport && settings.privacy?.level === 'local'
              ? { level: 'standard' }
              : settings.privacy,
        };
        await window.electronAPI.saveSettings(toSave);
        onSave(toSave);
        onClose();
      }
    } catch (error) {
      console.error('Error saving settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const testApiKey = async (service: string, key: string) => {
    if (!key || key.trim().length < 10) {
      setTestResults((prev) => ({ ...prev, [service]: 'error' }));
      return;
    }

    setTestResults((prev) => ({ ...prev, [service]: 'testing' }));

    try {
      let testUrl = '';
      let testHeaders: Record<string, string> = {};

      switch (service) {
        case 'groq':
          if (!key.startsWith('gsk_')) {
            setTestResults((prev) => ({ ...prev, [service]: 'error' }));
            return;
          }
          testUrl = 'https://api.groq.com/openai/v1/models';
          testHeaders = { Authorization: `Bearer ${key}` };
          break;
        case 'deepgram':
          testUrl = 'https://api.deepgram.com/v1/projects';
          testHeaders = { Authorization: `Token ${key}` };
          break;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(testUrl, { headers: testHeaders, signal: controller.signal });

      clearTimeout(timeoutId);

      // 401 means the key is well-formed but rejected — still a reachable service.
      setTestResults((prev) => ({
        ...prev,
        [service]: response.ok || response.status === 401 ? 'success' : 'error',
      }));
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.error('API test timeout for', service);
      }
      setTestResults((prev) => ({ ...prev, [service]: 'error' }));
    }
  };

  if (!isOpen) return null;

  return (
    <div className="flex min-h-0 flex-1 flex-col" role="region" aria-label="Settings">
      <div className="mx-auto min-h-0 w-full max-w-[640px] flex-1 overflow-y-auto px-6 py-6">
        <div className="space-y-6">
          <KeySection
            title="Groq"
            required={!quota.managedKeys}
            note="Interprets your question and writes the SQL. SPARK cannot answer anything without it."
            docs="https://console.groq.com/keys"
            managed={quota.managedKeys}
          >
            <KeyRow
              label="API key"
              value={settings.groqApiKey}
              placeholder="gsk_…"
              state={testResults.groq}
              onChange={(v) => setSettings({ ...settings, groqApiKey: v })}
              onTest={() => testApiKey('groq', settings.groqApiKey)}
            />
          </KeySection>

          <KeySection
            title="Deepgram"
            note="Voice input and spoken answers. Without it the microphone stays disabled, you type instead, and answers are shown as text only."
            docs={quota.voice && !quota.managedKeys ? 'https://console.deepgram.com' : undefined}
            locked={!quota.voice}
            lockedNote="Voice is on IGNITE and up. FREE is text-only."
            managed={quota.managedKeys}
            onUpgrade={onUpgrade}
          >
            <KeyRow
              label="API key"
              value={settings.deepgramApiKey}
              state={testResults.deepgram}
              onChange={(v) => setSettings({ ...settings, deepgramApiKey: v })}
              onTest={() => testApiKey('deepgram', settings.deepgramApiKey)}
            />
          </KeySection>

          <KeySection
            title="Privacy"
            note="Controls what SPARK is allowed to send to Groq. Query execution is always local; this governs the AI calls only."
          >
            <div className="flex flex-col gap-2">
              {PRIVACY_OPTIONS.map((opt) => {
                const active = (settings.privacy?.level ?? 'standard') === opt.value;
                const locked = opt.value === 'local' && !quota.offlineSupport;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() =>
                      locked ? onUpgrade?.() : setSettings({ ...settings, privacy: { level: opt.value } })
                    }
                    className={cx(
                      'text-left rounded-lg border px-3 py-2.5 transition-colors',
                      active
                        ? 'border-accent-line bg-accent-soft'
                        : locked
                        ? 'border-line-subtle opacity-60'
                        : 'border-line-subtle hover:border-line'
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={cx(
                          'h-3 w-3 shrink-0 rounded-full border',
                          active ? 'border-accent bg-accent' : 'border-line'
                        )}
                      />
                      <span className="text-sm font-medium text-ink">{opt.label}</span>
                      {locked && <IconLock size={11} className="text-faint" />}
                      {locked && (
                        <span className="ml-auto text-xs text-accent">
                          BLAZE and up
                        </span>
                      )}
                    </div>
                    <p className="mt-1 pl-5 text-xs leading-relaxed text-muted">{opt.detail}</p>
                  </button>
                );
              })}
            </div>
          </KeySection>

          <section>
            <h3 className="text-md font-medium text-ink">Legal</h3>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5">
              {LEGAL_DOCS.map((d) => (
                <button
                  key={d.doc}
                  type="button"
                  onClick={() => onOpenLegal?.(d.doc)}
                  className="text-xs text-faint transition-colors duration-1 hover:text-ink"
                >
                  {d.label}
                </button>
              ))}
            </div>
          </section>
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-line-subtle px-6 py-3">
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="primary" loading={isLoading} onClick={handleSave}>
          Save
        </Button>
      </div>
    </div>
  );
}

/* ---------- structure ---------- */

function KeySection({
  title,
  note,
  required,
  docs,
  locked,
  lockedNote,
  managed,
  onUpgrade,
  children,
}: {
  title: string;
  note: string;
  required?: boolean;
  docs?: string;
  locked?: boolean;
  lockedNote?: string;
  /** THUNDER only — SPARK supplies this key, so there's nothing to enter. */
  managed?: boolean;
  onUpgrade?: () => void;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="flex items-baseline gap-2">
        <h3 className="text-md font-medium text-ink">{title}</h3>
        {managed ? (
          <span className="flex items-center gap-1 text-xs text-accent">
            <IconCheck size={10} />
            Managed by SPARK
          </span>
        ) : locked ? (
          <span className="flex items-center gap-1 text-xs text-faint">
            <IconLock size={10} />
            Locked
          </span>
        ) : docs ? (
          required ? (
            <span className="text-xs text-accent">Required</span>
          ) : (
            <span className="text-xs text-faint">Optional</span>
          )
        ) : null}
        <span className="flex-1" />
        {managed ? null : locked ? (
          <button
            type="button"
            onClick={onUpgrade}
            className="text-xs text-accent transition-colors duration-1 hover:text-accent-hi"
          >
            Upgrade →
          </button>
        ) : docs ? (
          <button
            type="button"
            onClick={() => window.electronAPI?.openExternal(docs)}
            className="text-xs text-faint transition-colors duration-1 hover:text-ink"
          >
            Get a key
          </button>
        ) : null}
      </div>
      <p className="mb-2.5 mt-0.5 max-w-[58ch] text-sm leading-relaxed text-muted">
        {managed
          ? `Your THUNDER plan includes this — SPARK's own key is used automatically, nothing to paste here.`
          : locked && lockedNote
          ? lockedNote
          : note}
      </p>
      {!managed && (
        <div className={cx('space-y-2', locked && 'pointer-events-none opacity-40')}>{children}</div>
      )}
    </section>
  );
}

function KeyRow({
  label,
  value,
  placeholder,
  state,
  onChange,
  onTest,
}: {
  label: string;
  value: string;
  placeholder?: string;
  state?: TestState;
  onChange: (v: string) => void;
  onTest?: () => void;
}) {
  return (
    <Field label={label}>
      <div className="flex items-center gap-1.5">
        <Input
          type="password"
          mono
          value={value}
          placeholder={placeholder ?? 'Paste your key'}
          onChange={(e) => onChange(e.target.value)}
        />
        {onTest && (
          <Button size="lg" onClick={onTest} disabled={!value || state === 'testing'}>
            {state === 'testing' ? (
              <Spinner size={11} />
            ) : state === 'success' ? (
              <IconCheck size={12} className="text-accent" />
            ) : state === 'error' ? (
              <IconClose size={12} className="text-negative" />
            ) : (
              <IconSearch size={12} />
            )}
            Test
          </Button>
        )}
      </div>
      {/* Result is a sentence, not just a coloured icon. */}
      {state === 'success' && <span className="mt-1 block text-xs text-accent">Key accepted.</span>}
      {state === 'error' && (
        <span className="mt-1 block text-xs text-negative">
          That key was rejected, or the service could not be reached.
        </span>
      )}
    </Field>
  );
}
