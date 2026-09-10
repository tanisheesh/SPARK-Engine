'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getSession, signOut, type SparkUser } from '../../lib/auth';
import { consumeQuery, fetchBillingStatus } from '../../lib/api';
import type { Tier } from '../../lib/api';

import SettingsModal from '../../components/SettingsModal';
import FileUpload from '../../components/FileUpload';
import VisualizationView from '../../components/VisualizationView';
import LoginScreen from '../../components/LoginScreen';
import { PricingScreen } from '../../components/PricingScreen';
import { LegalView } from '../../components/LegalView';
import type { LegalDoc } from '../../components/legal/TermsBody';
import { isFileSource, type DataSourceType } from '../../lib/data-sources';
import { quotaFor } from '../../lib/spark/quotas';

import { Sidebar, type NavKey } from '../../components/shell/Sidebar';
import { QueryComposer } from '../../components/ask/QueryComposer';
import { TurnView } from '../../components/ask/TurnView';
import { AskHome } from '../../components/ask/AskHome';
import { StudioPanel } from '../../components/studio/StudioPanel';
import { Topbar } from '../../components/shell/Topbar';
import { CommandPalette } from '../../components/shell/CommandPalette';
import { ArtifactView, type ArtifactKind } from '../../components/studio/ArtifactView';
import { ExploreView } from '../../components/explore/ExploreView';
import { ConversationsView } from '../../components/conversations/ConversationsView';

import {
  Button,
  ConnState,
  Spinner,
  ToastMsg,
  ToastStack,
} from '../../components/ui/Primitives';
import { IconPlug, SparkMark } from '../../components/ui/Icons';

import type {
  ApiSettings,
  Conversation,
  CsvFileRow,
  SourceType,
  TraceStage,
  Turn,
  VoiceState,
} from '../../lib/spark/types';
import { TRACE_LABELS } from '../../lib/spark/types';
import { ACTION_BY_ID, rootQuestion, type StudioAction } from '../../lib/spark/studio';

const STORE_KEY = 'spark.conversations.v1';

const NAV_TITLE: Record<NavKey, string> = {
  ask: 'Ask',
  explore: 'Explore',
  data: 'Schema',
  conversations: 'Conversations',
};

const LEGAL_TITLES: Record<LegalDoc, string> = {
  terms: 'Terms of Service',
  privacy: 'Privacy Policy',
  refund: 'Refund & Cancellation',
};

/* ============================================================
   Persistence

   Conversations are kept locally so a restart does not lose the
   thread. Result rows are large, so only the two most recent turns
   of each conversation keep theirs; older turns keep their question,
   answer, SQL and trace. Anything that needs the dropped rows is
   disabled with a reason rather than silently misbehaving.
   ============================================================ */

function serialize(convos: Conversation[]): string {
  const trimmed = convos.slice(0, 40).map((c) => ({
    ...c,
    turns: c.turns.map((t, i) =>
      i >= c.turns.length - 2 ? t : { ...t, rows: undefined }
    ),
  }));
  return JSON.stringify(trimmed);
}

function loadConversations(): Conversation[] {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveConversations(convos: Conversation[]) {
  try {
    localStorage.setItem(STORE_KEY, serialize(convos));
  } catch {
    // Quota exceeded — keep the newest few and drop every stored row.
    try {
      localStorage.setItem(
        STORE_KEY,
        JSON.stringify(
          convos.slice(0, 10).map((c) => ({
            ...c,
            turns: c.turns.map((t) => ({ ...t, rows: undefined })),
          }))
        )
      );
    } catch {
      /* give up quietly; the session still works in memory */
    }
  }
}

const uid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

const titleFrom = (q: string) => (q.length > 52 ? q.slice(0, 49).trimEnd() + '…' : q);

/* Which stage of the pipeline maps to which user-facing phase. */
const STAGE_STATUS: Partial<Record<TraceStage, Turn['status']>> = {
  schema: 'thinking',
  sample: 'thinking',
  sql: 'thinking',
  execute: 'querying',
  format: 'answering',
  tts: 'answering',
};

export default function Home() {
  /* ---------- auth ---------- */
  const [user, setUser] = useState<SparkUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  /* ---------- billing ---------- */
  const [plan, setPlan] = useState<Tier | null>(null);
  const [showPricing, setShowPricing] = useState(false);

  /* ---------- settings ---------- */
  const [apiSettings, setApiSettings] = useState<ApiSettings>({});
  const [showSettings, setShowSettings] = useState(false);

  /* ---------- data source ---------- */
  const [currentDataset, setCurrentDataset] = useState('');
  const [datasetType, setDatasetType] = useState<SourceType | null>(null);
  const [connectionConfig, setConnectionConfig] = useState<Record<string, unknown> | null>(null);
  const [showFileUpload, setShowFileUpload] = useState(false);

  /* ---------- legal docs ---------- */
  const [legalDoc, setLegalDoc] = useState<LegalDoc | null>(null);

  // Data sources, Pricing, Settings and Legal docs all render inline in the
  // main column (sidebar + studio stay visible), so only one can be open at
  // a time — opening one closes the others rather than stacking.
  const openFileUpload = useCallback(() => {
    setShowPricing(false);
    setShowSettings(false);
    setLegalDoc(null);
    setShowFileUpload(true);
  }, []);

  const openPricing = useCallback(() => {
    setShowFileUpload(false);
    setShowSettings(false);
    setLegalDoc(null);
    setShowPricing(true);
  }, []);

  const openSettings = useCallback(() => {
    setShowFileUpload(false);
    setShowPricing(false);
    setLegalDoc(null);
    setShowSettings(true);
  }, []);

  const openLegal = useCallback((doc: LegalDoc) => {
    setShowFileUpload(false);
    setShowPricing(false);
    setShowSettings(false);
    setLegalDoc(doc);
  }, []);

  /* ---------- navigation ---------- */
  const [nav, setNav] = useState<NavKey>('ask');
  const [paletteOpen, setPaletteOpen] = useState(false);

  /* ---------- conversation ---------- */
  const [conversations, setConversations] = useState<Conversation[]>(() =>
    typeof window === 'undefined' ? [] : loadConversations()
  );
  const [activeId, setActiveId] = useState<string | null>(null);
  const [question, setQuestion] = useState('');
  const [runningAction, setRunningAction] = useState<string | null>(null);
  const [artifact, setArtifact] = useState<ArtifactKind | null>(null);

  /* ---------- voice / audio ---------- */
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  /* ---------- misc ui ---------- */
  const [toasts, setToasts] = useState<ToastMsg[]>([]);

  /* ---------- refs ---------- */
  const activeTurnRef = useRef<string | null>(null);
  const cancelledRef = useRef<Set<string>>(new Set());
  const wsRef = useRef<WebSocket | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const silenceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pttRef = useRef(false);

  const toast = useCallback((text: string, tone?: ToastMsg['tone']) => {
    setToasts((t) => [...t, { id: Date.now() + Math.random(), text, tone }]);
  }, []);

  /* ============================================================
     Derived state
     ============================================================ */

  const connected = !!currentDataset && !!datasetType;
  const connState: ConnState = connected ? 'connected' : 'disconnected';
  const quota = quotaFor(plan);
  // Voice (both STT and TTS) is an IGNITE-and-up feature. A leftover
  // Deepgram key from a prior higher tier (or from before a downgrade)
  // must not re-enable it — the tier check comes first, always.
  const micEnabled = quota.voice && !!apiSettings.deepgramApiKey;
  const canSpeak = quota.voice && !!apiSettings.deepgramApiKey;
  const settingsConfigured = !!apiSettings.groqApiKey;

  const activeConversation = useMemo(
    () => conversations.find((c) => c.id === activeId) ?? null,
    [conversations, activeId]
  );
  const turns = useMemo(() => activeConversation?.turns ?? [], [activeConversation]);
  const lastTurn = turns.length ? turns[turns.length - 1] : null;
  const lastDoneTurn = useMemo(
    () => [...turns].reverse().find((t) => t.status === 'done') ?? null,
    [turns]
  );
  const busy = !!lastTurn && ['thinking', 'querying', 'answering'].includes(lastTurn.status);

  const voiceState: VoiceState = isListening
    ? question.trim()
      ? 'transcribing'
      : 'listening'
    : isSpeaking
    ? 'speaking'
    : busy
    ? (lastTurn!.status as VoiceState)
    : 'idle';

  const recents = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const c of conversations) {
      for (let i = c.turns.length - 1; i >= 0; i--) {
        const q = c.turns[i].question;
        if (!seen.has(q)) {
          seen.add(q);
          out.push(q);
        }
      }
    }
    return out;
  }, [conversations]);

  const loadBillingStatus = useCallback(async () => {
    try {
      const status = await fetchBillingStatus();
      setPlan(status.tier);
    } catch (e) {
      console.error('Failed to load billing status', e);
    }
  }, []);

  /* ============================================================
     Boot
     ============================================================ */

  useEffect(() => {
    (async () => {
      try {
        if (window.electronAPI) {
          const s = await window.electronAPI.getSettings();
          setApiSettings(s ?? {});
          if (!s?.groqApiKey) setTimeout(() => openSettings(), 800);
        }
      } catch (e) {
        console.error('Failed to load settings', e);
      }
    })();

    window.electronAPI?.onOpenSettings(() => openSettings());

    getSession().then((session) => {
      setUser(session?.user ?? null);
      setAuthLoading(false);
      if (session?.user) loadBillingStatus();
    });
  }, [loadBillingStatus]);

  // TIERS.txt's per-tier "query history" line (FREE none, IGNITE 7 days,
  // BLAZE 14, STORM 28, THUNDER unlimited) — purged locally since
  // conversations only ever live in this device's localStorage, never on a
  // server. Runs whenever the plan is (re)confirmed, e.g. right after
  // login or a tier change. The conversation currently open is exempt so
  // switching tiers never yanks away what you're actively looking at.
  //
  // plan starts null on every launch until loadBillingStatus() resolves,
  // and quotaFor(null) falls back to FREE (0-day retention) — without this
  // guard that fallback would run for real here, wiping every paying
  // user's history for the split second before their real tier loads.
  // Same "fail open, don't punish a network hiccup" rule as consumeQuery.
  useEffect(() => {
    if (plan === null) return;
    const days = quota.chatHistoryDays;
    if (days === null) return;
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    setConversations((prev) => {
      const kept = prev.filter((c) => c.id === activeId || c.pinned || c.updatedAt >= cutoff);
      return kept.length === prev.length ? prev : kept;
    });
  }, [plan, activeId]);

  /* Persist whenever the thread changes. */
  useEffect(() => {
    if (conversations.length) saveConversations(conversations);
  }, [conversations]);

  /* Keep the newest turn in view. */
  useEffect(() => {
    if (nav === 'ask' && scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [turns.length, lastTurn?.status, nav]);

  /* ============================================================
     Live query trace — real events from the main process
     ============================================================ */

  const patchTurn = useCallback((turnId: string, fn: (t: Turn) => Turn) => {
    setConversations((prev) =>
      prev.map((c) =>
        c.turns.some((t) => t.id === turnId)
          ? { ...c, updatedAt: Date.now(), turns: c.turns.map((t) => (t.id === turnId ? fn(t) : t)) }
          : c
      )
    );
  }, []);

  useEffect(() => {
    if (!window.electronAPI) return;

    window.electronAPI.onQueryProgress((_e: unknown, p: { stage: TraceStage; message: string }) => {
      const id = activeTurnRef.current;
      if (!id) return;

      patchTurn(id, (t) => {
        const now = Date.now();
        const trace = t.trace.map((s) =>
          s.status === 'running' ? { ...s, status: 'done' as const, endedAt: now } : s
        );

        if (p.stage === 'complete') return { ...t, trace };
        if (p.stage === 'error') {
          return {
            ...t,
            trace: [
              ...trace,
              {
                stage: 'error' as TraceStage,
                label: TRACE_LABELS.error,
                startedAt: now,
                endedAt: now,
                status: 'error' as const,
                detail: p.message,
              },
            ],
          };
        }

        return {
          ...t,
          status: STAGE_STATUS[p.stage] ?? t.status,
          trace: [
            ...trace,
            {
              stage: p.stage,
              label: TRACE_LABELS[p.stage] ?? p.message,
              startedAt: now,
              status: 'running' as const,
            },
          ],
        };
      });
    });

    return () => window.electronAPI?.removeAllListeners('query-progress');
  }, [patchTurn]);

  /* ============================================================
     Audio
     ============================================================ */

  const stopAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
      audioRef.current = null;
    }
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
    setIsSpeaking(false);
  }, []);

  const playAudio = useCallback(
    (base64: string, mime: string) => {
      stopAudio();
      try {
        const blob = new Blob([Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))], {
          type: mime || 'audio/wav',
        });
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audio.muted = isMuted;
        const done = () => {
          URL.revokeObjectURL(url);
          audioUrlRef.current = null;
          audioRef.current = null;
          setIsSpeaking(false);
        };
        audio.onended = done;
        audio.onerror = done;
        audioRef.current = audio;
        audioUrlRef.current = url;
        setIsSpeaking(true);
        audio.play().catch(done);
      } catch {
        setIsSpeaking(false);
      }
    },
    [isMuted, stopAudio]
  );

  const speak = useCallback(
    async (text: string) => {
      if (!canSpeak) {
        toast('Add your Deepgram key in Settings to hear answers.', 'error');
        openSettings();
        return;
      }
      try {
        const res = await window.electronAPI!.generateTTS({ text, settings: apiSettings, voiceAllowed: canSpeak });
        if (res?.success && res.audioData) playAudio(res.audioData, res.mimeType);
        else toast(res?.error ?? 'Voice output failed.', 'error');
      } catch (e) {
        toast('Voice output failed: ' + (e as Error).message, 'error');
      }
    },
    [apiSettings, canSpeak, playAudio, toast]
  );

  const toggleMute = () => {
    setIsMuted((m) => {
      const next = !m;
      if (audioRef.current) audioRef.current.muted = next;
      return next;
    });
  };

  useEffect(() => () => stopAudio(), [stopAudio]);

  /* ============================================================
     Voice input — Deepgram streaming
     ============================================================ */

  const stopListening = useCallback(() => {
    if (silenceRef.current) {
      clearTimeout(silenceRef.current);
      silenceRef.current = null;
    }
    try {
      recorderRef.current?.state === 'recording' && recorderRef.current.stop();
    } catch {
      /* recorder already torn down */
    }
    recorderRef.current = null;
    if (wsRef.current) {
      wsRef.current.onclose = null;
      try {
        wsRef.current.close();
      } catch {
        /* already closing */
      }
      wsRef.current = null;
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setIsListening(false);
  }, []);

  const startListening = useCallback(async () => {
    if (!micEnabled) {
      toast('Add a Deepgram key in Settings to ask by voice.', 'error');
      openSettings();
      return;
    }
    if (wsRef.current) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 16000 },
      });
      streamRef.current = stream;

      const ws = new WebSocket(
        'wss://api.deepgram.com/v1/listen?model=nova-2&smart_format=true&language=en&endpointing=true',
        ['token', apiSettings.deepgramApiKey!]
      );
      wsRef.current = ws;

      ws.onopen = () => {
        setIsListening(true);
        const rec = new MediaRecorder(stream, { mimeType: 'audio/webm' });
        recorderRef.current = rec;
        rec.addEventListener('dataavailable', (ev) => {
          if (ev.data.size > 0 && ws.readyState === WebSocket.OPEN) ws.send(ev.data);
        });
        rec.start(250);
      };

      ws.onmessage = (msg) => {
        const data = JSON.parse(msg.data);
        const transcript = data.channel?.alternatives?.[0]?.transcript;
        if (!transcript?.trim()) return;

        if (silenceRef.current) {
          clearTimeout(silenceRef.current);
          silenceRef.current = null;
        }
        setQuestion((prev) => (prev ? `${prev} ${transcript}` : transcript));

        // Deepgram marks the end of an utterance; give the speaker a
        // beat to continue before closing the mic.
        if (data.is_final || data.speech_final) {
          silenceRef.current = setTimeout(() => stopListening(), 2000);
        }
      };

      ws.onerror = () => {
        toast('Could not reach Deepgram. Check your API key.', 'error');
        stopListening();
      };
      ws.onclose = () => stopListening();
    } catch {
      toast('SPARK could not access your microphone.', 'error');
      stopListening();
    }
  }, [apiSettings.deepgramApiKey, micEnabled, stopListening, toast]);

  useEffect(() => () => stopListening(), [stopListening]);

  /* ============================================================
     Running a question
     ============================================================ */

  const ensureConversation = useCallback(
    (firstQuestion: string): string => {
      if (activeId && conversations.some((c) => c.id === activeId)) return activeId;
      const id = uid();
      const now = Date.now();
      setConversations((prev) => [
        { id, title: titleFrom(firstQuestion), turns: [], createdAt: now, updatedAt: now },
        ...prev,
      ]);
      setActiveId(id);
      return id;
    },
    [activeId, conversations]
  );

  const runQuestion = useCallback(
    async (q: string, originAction?: string, displayQuestion?: string) => {
      const text = q.trim();
      if (!text || busy) return;
      // Studio actions send a whole restated prompt to the backend (the
      // stateless SQL generator needs it), but that prompt is not fit to
      // show as "the question" in a turn or the conversations list —
      // displayQuestion carries the clean, human version instead.
      const shownQuestion = (displayQuestion ?? text).trim() || text;

      if (!apiSettings.groqApiKey) {
        toast('Add your Groq API key to start asking.', 'error');
        openSettings();
        return;
      }
      if (!connected) {
        toast('Connect a data source first.', 'error');
        openFileUpload();
        return;
      }

      // Enforced server-side (lambda/usage-consume) against the tier's
      // TIERS.txt quota — never trust a client-side counter for this.
      try {
        const usage = await consumeQuery();
        if (!usage.allowed) {
          const limit = usage.reason === 'monthly' ? usage.limitMonth : usage.limitDay;
          const period = usage.reason === 'monthly' ? 'this month' : 'today';
          toast(
            `You've used all ${limit} queries ${period} on the ${usage.tier} plan. Upgrade for more.`,
            'error'
          );
          openPricing();
          return;
        }
      } catch (e) {
        // Signed out, offline, or the API is unreachable — fail open rather
        // than block every question on a billing-service hiccup.
        console.error('Usage check failed, continuing without it', e);
      }

      setNav('ask');
      const convId = ensureConversation(shownQuestion);
      const turnId = uid();
      const turn: Turn = {
        id: turnId,
        question: shownQuestion,
        prompt: text !== shownQuestion ? text : undefined,
        originAction,
        status: 'thinking',
        createdAt: Date.now(),
        trace: [],
      };

      setConversations((prev) =>
        prev.map((c) =>
          c.id === convId ? { ...c, updatedAt: Date.now(), turns: [...c.turns, turn] } : c
        )
      );
      activeTurnRef.current = turnId;
      setQuestion('');
      if (originAction) setRunningAction(originAction);

      try {
        if (!window.electronAPI) throw new Error('Electron API not available');

        // Database sources already live in DuckDB; uploaded files (CSV/Excel/JSON) need a path.
        let path = 'duckdb://direct';
        if (isFileSource(datasetType)) {
          const files = await window.electronAPI.listCSVFiles();
          const file = files.find((f: CsvFileRow) => f.name === currentDataset);
          if (!file) throw new Error('Selected dataset not found');
          path = file.path;
        }

        const result = await window.electronAPI.processQuery({
          question: text,
          csvFile: path,
          settings: apiSettings,
          voiceAllowed: canSpeak,
          wideTableColumnCap: quota.wideTableColumnCap,
        });

        if (cancelledRef.current.has(turnId)) {
          cancelledRef.current.delete(turnId);
          return;
        }
        if (!result?.success) throw new Error(result?.error || 'Query failed');

        const now = Date.now();
        patchTurn(turnId, (t) => ({
          ...t,
          status: 'done',
          completedAt: now,
          answer: result.textResponse,
          sql: result.sqlQuery,
          rows: result.results ?? [],
          totalRows: result.totalRows ?? result.results?.length ?? 0,
          hasAudio: !!result.tts?.hasAudio,
          trace: t.trace.map((s) =>
            s.status === 'running' ? { ...s, status: 'done' as const, endedAt: now } : s
          ),
        }));

        // canSpeak already folds in quota.voice — the main process only knows
        // about the Deepgram key, not the subscription tier, so the tier check
        // has to happen here before any auto-play, not just on the manual
        // "speak" button.
        if (canSpeak && result.tts?.hasAudio && result.tts.audioData) {
          playAudio(result.tts.audioData, result.tts.mimeType);
        }
      } catch (err) {
        if (cancelledRef.current.has(turnId)) {
          cancelledRef.current.delete(turnId);
          return;
        }
        const now = Date.now();
        const detail = (err as Error).message;
        patchTurn(turnId, (t) => ({
          ...t,
          status: 'error',
          completedAt: now,
          error: detail,
          errorDetail: detail,
          trace: t.trace.map((s) =>
            s.status === 'running' ? { ...s, status: 'error' as const, endedAt: now } : s
          ),
        }));
      } finally {
        if (activeTurnRef.current === turnId) activeTurnRef.current = null;
        setRunningAction(null);
      }
    },
    [
      apiSettings,
      busy,
      canSpeak,
      connected,
      currentDataset,
      datasetType,
      ensureConversation,
      patchTurn,
      playAudio,
      quota,
      toast,
    ]
  );

  const cancelRun = useCallback(() => {
    const id = activeTurnRef.current;
    if (!id) return;
    cancelledRef.current.add(id);
    activeTurnRef.current = null;
    setRunningAction(null);
    patchTurn(id, (t) => ({
      ...t,
      status: 'cancelled',
      completedAt: Date.now(),
      trace: t.trace.map((s) =>
        s.status === 'running' ? { ...s, status: 'done' as const, endedAt: Date.now() } : s
      ),
    }));
  }, [patchTurn]);

  /* ============================================================
     Navigation — Data sources and Pricing render inline in place of the
     normal nav content (not as overlays), so switching to any regular
     nav tab needs to close whichever of those is currently open.
     ============================================================ */

  const navigateTo = useCallback((key: NavKey) => {
    setShowFileUpload(false);
    setShowPricing(false);
    setShowSettings(false);
    setLegalDoc(null);
    setNav(key);
  }, []);

  /* ============================================================
     Studio
     ============================================================ */

  const runStudioAction = useCallback(
    (action: StudioAction) => {
      if (action.backing === 'pending') {
        toast(action.pendingReason ?? 'Not available yet.', 'error');
        return;
      }
      if (action.backing === 'view') {
        navigateTo('data');
        return;
      }
      if (action.backing === 'local') {
        if (!lastDoneTurn) return;
        setArtifact(action.id as ArtifactKind);
        return;
      }
      if (action.prompt) {
        runQuestion(
          action.prompt(lastDoneTurn, {
            datasetName: currentDataset,
            sourceType: datasetType,
          }),
          action.label,
          lastDoneTurn ? rootQuestion(lastDoneTurn.question) : undefined
        );
      }
    },
    [currentDataset, datasetType, lastDoneTurn, navigateTo, runQuestion, toast]
  );

  /* ============================================================
     Conversation management
     ============================================================ */

  const newConversation = () => {
    setActiveId(null);
    setQuestion('');
    navigateTo('ask');
    setTimeout(() => composerRef.current?.focus(), 60);
  };

  const deleteConversation = (id: string) => {
    setConversations((prev) => {
      const next = prev.filter((c) => c.id !== id);
      saveConversations(next);
      if (!next.length) localStorage.removeItem(STORE_KEY);
      return next;
    });
    if (activeId === id) setActiveId(null);
  };

  /* ============================================================
     Data source
     ============================================================ */

  const handleFileSelected = (
    file: { name?: string } | null,
    type: SourceType,
    config?: Record<string, unknown>
  ) => {
    if (file?.name) {
      setCurrentDataset(file.name);
      setDatasetType(type);
      setConnectionConfig(config ?? null);
      toast(`Connected to ${file.name}.`, 'success');
    } else {
      setCurrentDataset('');
      setDatasetType(null);
      setConnectionConfig(null);
    }
  };

  /* ============================================================
     Keyboard
     ============================================================ */

  useEffect(() => {
    /* Space is push-to-talk, but Space also activates whatever is focused.
       Only claim it when focus is somewhere inert, or a keyboard user could
       never press a button again. */
    const isInteractive = (el: EventTarget | null) => {
      const n = el as HTMLElement | null;
      if (!n || !n.tagName) return false;
      return (
        ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'A', 'SUMMARY', 'OPTION'].includes(n.tagName) ||
        n.isContentEditable ||
        n.getAttribute('role') === 'button' ||
        n.closest('[role="dialog"]') !== null
      );
    };

    const onKeyDown = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;

      if (mod && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((v) => !v);
        return;
      }
      if (mod && e.key === '/') {
        e.preventDefault();
        navigateTo('ask');
        composerRef.current?.focus();
        return;
      }
      if (mod && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        newConversation();
        return;
      }
      if (e.key === 'Escape') {
        if (isListening) {
          stopListening();
          return;
        }
        if (busy) {
          cancelRun();
          return;
        }
        if (isSpeaking) stopAudio();
        return;
      }
      // Push-to-talk, only when focus is not on something Space already drives.
      if (e.code === 'Space' && !isInteractive(e.target) && !e.repeat && !busy && micEnabled) {
        e.preventDefault();
        pttRef.current = true;
        startListening();
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space' && pttRef.current) {
        pttRef.current = false;
        stopListening();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [busy, isListening, isSpeaking, micEnabled, navigateTo, startListening, stopListening, stopAudio, cancelRun]);

  /* ============================================================
     Render
     ============================================================ */

  if (authLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-bg">
        <div className="flex flex-col items-center gap-3">
          <SparkMark size={26} className="text-accent" />
          <Spinner size={16} className="text-muted" />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <LoginScreen
        onLogin={() =>
          getSession().then((session) => {
            setUser(session?.user ?? null);
            if (session?.user) loadBillingStatus();
          })
        }
      />
    );
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-bg text-ink">
      <Sidebar
        active={nav}
        onNavigate={navigateTo}
        datasetName={currentDataset}
        sourceType={datasetType}
        connState={connState}
        onManageData={() => openFileUpload()}
        onOpenSchema={() => navigateTo('data')}
        onOpenSettings={() => openSettings()}
        settingsConfigured={settingsConfigured}
        onNewConversation={newConversation}
        conversationCount={conversations.length}
        userEmail={user.email ?? undefined}
        userAvatar={user.avatarUrl}
        onLogout={async () => {
          await signOut();
          setUser(null);
          setPlan(null);
        }}
        plan={plan}
        onOpenPricing={() => openPricing()}
      />

      {/* ---------- main column ---------- */}
      <main className="flex min-w-0 flex-1 flex-col">
        <Topbar
          title={
            showFileUpload
              ? 'Data sources'
              : showPricing
              ? 'Pricing'
              : showSettings
              ? 'Settings'
              : legalDoc
              ? LEGAL_TITLES[legalDoc]
              : NAV_TITLE[nav]
          }
          subtitle={
            showFileUpload || showPricing || legalDoc
              ? undefined
              : showSettings
              ? 'Keys are stored locally on this machine.'
              : nav === 'ask'
              ? activeConversation?.title
              : nav === 'data' && connected
                ? currentDataset
                : undefined
          }
          onOpenPalette={() => setPaletteOpen(true)}
          onClose={
            showFileUpload
              ? () => setShowFileUpload(false)
              : showPricing
              ? () => setShowPricing(false)
              : showSettings
              ? () => setShowSettings(false)
              : legalDoc
              ? () => setLegalDoc(null)
              : undefined
          }
        />

        {showFileUpload ? (
          <FileUpload
            isOpen={showFileUpload}
            onClose={() => setShowFileUpload(false)}
            onFileSelected={handleFileSelected}
            currentDatasetType={datasetType}
            plan={plan}
            onUpgrade={() => {
              setShowFileUpload(false);
              openPricing();
            }}
          />
        ) : showPricing ? (
          <PricingScreen open={showPricing} user={user} toast={toast} />
        ) : showSettings ? (
          <SettingsModal
            isOpen={showSettings}
            onClose={() => setShowSettings(false)}
            onSave={(s: ApiSettings) => setApiSettings(s)}
            plan={plan}
            onUpgrade={() => {
              setShowSettings(false);
              openPricing();
            }}
            onOpenLegal={openLegal}
          />
        ) : legalDoc ? (
          <LegalView doc={legalDoc} onOpenDoc={openLegal} />
        ) : (
          <>
        {nav === 'ask' && (
          <>
            <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
              {turns.length === 0 ? (
                <AskHome
                  connected={connected}
                  datasetName={currentDataset}
                  onConnect={() => openFileUpload()}
                  onAsk={(q) => runQuestion(q)}
                  onSurprise={() => runStudioAction(ACTION_BY_ID.surprise)}
                  recents={recents}
                />
              ) : (
                <div className="mx-auto w-full max-w-[720px] divide-y divide-line-subtle">
                  {turns.map((t, i) => (
                    <div key={t.id} id={`turn-${t.id}`}>
                    <TurnView
                      turn={t}
                      isLast={i === turns.length - 1}
                      onFollowUp={(q) => runQuestion(q)}
                      onRetry={(t) => runQuestion(t.prompt ?? t.question, t.originAction, t.question)}
                      onEditQuestion={(q) => {
                        setQuestion(q);
                        composerRef.current?.focus();
                      }}
                      onOpenSettings={() => openSettings()}
                      onConnect={() => openFileUpload()}
                      onSpeak={speak}
                      canSpeak={canSpeak}
                    />
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="border-t border-line-subtle px-6 py-3">
              <div className="mx-auto w-full max-w-[720px]">
                <QueryComposer
                  value={question}
                  onChange={setQuestion}
                  onSubmit={() => runQuestion(question)}
                  onCancel={cancelRun}
                  voiceState={voiceState}
                  onToggleVoice={() => (isListening ? stopListening() : startListening())}
                  micEnabled={micEnabled}
                  micHint="Add a Deepgram key in Settings to ask by voice"
                  muted={isMuted}
                  onToggleMute={toggleMute}
                  canSpeak={canSpeak}
                  inputRef={composerRef}
                />
              </div>
            </div>
          </>
        )}

        {nav === 'explore' && (
          <div className="min-h-0 flex-1 overflow-y-auto">
            <ExploreView
              connected={connected}
              datasetName={currentDataset}
              busy={busy}
              onRun={runStudioAction}
              onConnect={() => openFileUpload()}
            />
          </div>
        )}

        {nav === 'data' && (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex items-center gap-3 border-b border-line-subtle px-6 py-2">
              <span className="text-sm text-faint">
                {connected ? 'Tables and relationships' : 'No source connected'}
              </span>
              <span className="flex-1" />
              <Button size="sm" onClick={() => openFileUpload()}>
                <IconPlug size={12} />
                Manage sources
              </Button>
            </div>
            <div className="min-h-0 flex-1">
              <VisualizationView
                isConnected={connected}
                connectionType={datasetType ?? 'csv'}
                connectionConfig={connectionConfig}
              />
            </div>
          </div>
        )}

        {nav === 'conversations' && (
          <div className="min-h-0 flex-1 overflow-y-auto">
            <ConversationsView
              conversations={conversations}
              activeId={activeId}
              onOpen={(id) => {
                setActiveId(id);
                setNav('ask');
              }}
              onRename={(id, title) =>
                setConversations((prev) =>
                  prev.map((c) => (c.id === id ? { ...c, title } : c))
                )
              }
              onDelete={deleteConversation}
              onTogglePin={(id) =>
                setConversations((prev) =>
                  prev.map((c) => (c.id === id ? { ...c, pinned: !c.pinned } : c))
                )
              }
              onNew={newConversation}
            />
          </div>
        )}
          </>
        )}
      </main>

      {/* ---------- studio ---------- */}
      <StudioPanel
        turn={lastDoneTurn}
        connected={connected}
        busy={busy}
        runningAction={runningAction}
        onRun={runStudioAction}
        onConnect={() => openFileUpload()}
        conversation={activeConversation}
        onJumpToTurn={(id) => {
          navigateTo('ask');
          document.getElementById(`turn-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }}
      />

      {/* ---------- overlays ---------- */}
      <ArtifactView kind={artifact} turn={lastDoneTurn} onClose={() => setArtifact(null)} />

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onNavigate={navigateTo}
        onNewConversation={newConversation}
        onOpenConversation={(id) => {
          setActiveId(id);
          navigateTo('ask');
        }}
        onConnect={() => openFileUpload()}
        onOpenSettings={() => openSettings()}
        onRunStudio={runStudioAction}
        conversations={conversations}
        turn={lastDoneTurn}
        connected={connected}
      />

      <ToastStack
        toasts={toasts}
        onDismiss={(id) => setToasts((t) => t.filter((x) => x.id !== id))}
      />
    </div>
  );
}
