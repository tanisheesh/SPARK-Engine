'use client';

import { useState, useEffect } from 'react';
import { Button, Field, Input, Modal, Spinner } from './ui/Primitives';
import { IconCheck, IconClose, IconSearch } from './ui/Icons';

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
    label: 'Local only',
    detail: 'Nothing leaves this machine — not even your question. Requires a downloaded local model, and answer quality is noticeably lower.',
  },
];

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (settings: Settings) => void;
}

type TestState = 'success' | 'error' | 'testing';

export default function SettingsModal({ isOpen, onClose, onSave }: SettingsModalProps) {
  const [settings, setSettings] = useState<Settings>({
    groqApiKey: '',
    deepgramApiKey: '',
    privacy: { level: 'standard' }
  });

  const [isLoading, setIsLoading] = useState(false);
  const [testResults, setTestResults] = useState<{ [key: string]: TestState }>({});

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
        await window.electronAPI.saveSettings(settings);
        onSave(settings);
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

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title="Settings"
      subtitle="Keys are stored locally on this machine."
      width={560}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={isLoading} onClick={handleSave}>
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        <KeySection
          title="Groq"
          required
          note="Interprets your question and writes the SQL. SPARK cannot answer anything without it."
          docs="https://console.groq.com/keys"
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
          docs="https://console.deepgram.com"
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
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setSettings({ ...settings, privacy: { level: opt.value } })}
                  className={`text-left rounded-lg border px-3 py-2.5 transition-colors ${
                    active
                      ? 'border-accent-line bg-accent-soft'
                      : 'border-line-subtle hover:border-line'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`h-3 w-3 shrink-0 rounded-full border ${
                        active ? 'border-accent bg-accent' : 'border-line'
                      }`}
                    />
                    <span className="text-sm font-medium text-ink">{opt.label}</span>
                  </div>
                  <p className="mt-1 pl-5 text-xs leading-relaxed text-muted">{opt.detail}</p>
                </button>
              );
            })}
          </div>
        </KeySection>
      </div>
    </Modal>
  );
}

/* ---------- structure ---------- */

function KeySection({
  title,
  note,
  required,
  docs,
  children,
}: {
  title: string;
  note: string;
  required?: boolean;
  docs?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="flex items-baseline gap-2">
        <h3 className="text-md font-medium text-ink">{title}</h3>
        {docs ? (
          required ? (
            <span className="text-xs text-accent">Required</span>
          ) : (
            <span className="text-xs text-faint">Optional</span>
          )
        ) : null}
        <span className="flex-1" />
        {docs ? (
          <button
            type="button"
            onClick={() => window.electronAPI?.openExternal(docs)}
            className="text-xs text-faint transition-colors duration-1 hover:text-ink"
          >
            Get a key
          </button>
        ) : null}
      </div>
      <p className="mb-2.5 mt-0.5 max-w-[58ch] text-sm leading-relaxed text-muted">{note}</p>
      <div className="space-y-2">{children}</div>
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
