/* The app's single piece of shared state.
 *
 * One context, one relay client, plain useState. No state library: there are
 * four screens and the data is small, so a reducer framework would be more
 * code than it saves - and every dependency here is APK weight.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AppState, Platform } from 'react-native';

import { RELAY_URL } from '../config';
import { EVENT, METHOD, type RpcError } from '../protocol';
import {
  needsRefresh,
  refreshAccountSession,
  signInWithAccount,
  signInWithPairingCode,
} from '../api/auth';
import { RelayClient, type RelaySnapshot } from '../api/relay';
import {
  cacheConversations,
  clearAll,
  loadCachedConversations,
  loadQueue,
  loadSession,
  saveQueue,
  saveSession,
  type StoredSession,
} from '../api/storage';
import type {
  Conversation,
  ConversationSource,
  ConversationSummary,
  QueuedQuestion,
  TraceStage,
  Turn,
} from '../types';

/** Live progress for the question currently in flight. Mirrors real pipeline
    stages from the desktop - there is no synthetic progress anywhere. */
export interface AskProgress {
  turnId: string;
  conversationId: string | null;
  stage: TraceStage | 'sending';
  message: string;
}

interface SessionValue {
  ready: boolean;
  session: StoredSession | null;
  relay: RelaySnapshot;

  conversations: ConversationSummary[];
  conversationsStale: boolean;
  /** The dataset the DESKTOP currently has connected, as last reported. */
  activeSource: ConversationSource | null;
  desktopName: string | null;

  queue: QueuedQuestion[];
  progress: AskProgress | null;

  signInAccount: () => Promise<void>;
  signInPairing: (code: string) => Promise<void>;
  signOut: () => Promise<void>;

  refreshConversations: () => Promise<void>;
  getConversation: (id: string) => Promise<Conversation>;
  ask: (args: { conversationId: string | null; question: string }) => Promise<{
    conversationId: string;
    turn: Turn;
  }>;
  queueQuestion: (args: { conversationId: string | null; question: string }) => Promise<void>;
  removeQueued: (id: string) => Promise<void>;
}

const SessionContext = createContext<SessionValue | null>(null);

const deviceName =
  Platform.OS === 'android' ? 'Android phone' : Platform.OS === 'ios' ? 'iPhone' : 'Phone';

export function SessionProvider({ children }: { children: React.ReactNode }) {
  // One socket for the app's lifetime. Created lazily rather than as the
  // useRef initialiser so a new RelayClient is not constructed and discarded
  // on every render.
  const clientRef = useRef<RelayClient | null>(null);
  if (!clientRef.current) clientRef.current = new RelayClient();
  const client = clientRef.current;

  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<StoredSession | null>(null);
  const [relay, setRelay] = useState<RelaySnapshot>(client.getSnapshot());
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [conversationsStale, setConversationsStale] = useState(true);
  const [activeSource, setActiveSource] = useState<ConversationSource | null>(null);
  const [desktopName, setDesktopName] = useState<string | null>(null);
  const [queue, setQueue] = useState<QueuedQuestion[]>([]);
  const [progress, setProgress] = useState<AskProgress | null>(null);

  /* ---------- relay subscriptions ---------- */

  useEffect(() => client.onStateChange(setRelay), [client]);

  useEffect(
    () =>
      client.onEvent(EVENT.QUERY_PROGRESS, (data) => {
        setProgress({
          turnId: data.turnId,
          conversationId: data.conversationId ?? null,
          stage: data.stage,
          message: data.message,
        });
      }),
    [client]
  );

  /* ---------- boot ---------- */

  useEffect(() => {
    let cancelled = false;

    (async () => {
      // Show the cached list immediately. Opening the app should not begin with
      // a spinner when we already know what the user's conversations were.
      const [cached, storedQueue, stored] = await Promise.all([
        loadCachedConversations(),
        loadQueue(),
        loadSession(),
      ]);
      if (cancelled) return;

      setConversations(cached);
      setQueue(storedQueue);

      if (stored) {
        const fresh = needsRefresh(stored) ? await refreshAccountSession(stored) : stored;
        if (cancelled) return;
        if (fresh) {
          setSession(fresh);
          connect(fresh);
        } else {
          // Refresh token is gone or rejected - back to the auth screen, but
          // the cached conversation list stays readable.
          setSession(null);
        }
      }
      setReady(true);
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const connect = useCallback(
    (active: StoredSession) => {
      if (!RELAY_URL) return;
      client.connect(RELAY_URL, active.token, deviceName);
    },
    [client]
  );

  /* ---------- foreground handling ---------- */

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => {
      if (next !== 'active' || !session) return;
      // Android silently kills sockets of backgrounded apps, and the token may
      // have expired in the meantime. Do both checks on every resume.
      (async () => {
        if (needsRefresh(session)) {
          const fresh = await refreshAccountSession(session);
          if (fresh) {
            setSession(fresh);
            connect(fresh);
            return;
          }
        }
        client.refresh();
      })();
    });
    return () => subscription.remove();
  }, [client, connect, session]);

  /* ---------- conversations ---------- */

  const refreshConversations = useCallback(async () => {
    if (client.getSnapshot().state !== 'online') return;
    try {
      const result = await client.rpc<{
        conversations: ConversationSummary[];
        source: ConversationSource | null;
        desktopName: string | null;
      }>(METHOD.CONVERSATIONS_LIST);

      setConversations(result.conversations ?? []);
      setActiveSource(result.source ?? null);
      setDesktopName(result.desktopName ?? null);
      setConversationsStale(false);
      await cacheConversations(result.conversations ?? []);
    } catch (error) {
      // Keep showing the cache and mark it stale rather than emptying the
      // screen because one request failed.
      setConversationsStale(true);
      if ((error as RpcError)?.code) return;
      console.warn('conversations.list failed', error);
    }
  }, [client]);

  // The desktop coming online is the moment a refresh is worth doing.
  useEffect(() => {
    if (relay.state === 'online' && relay.engineOnline) void refreshConversations();
  }, [relay.state, relay.engineOnline, refreshConversations]);

  const getConversation = useCallback(
    async (id: string) => {
      const result = await client.rpc<{ conversation: Conversation }>(METHOD.CONVERSATION_GET, {
        conversationId: id,
      });
      return result.conversation;
    },
    [client]
  );

  /* ---------- asking ---------- */

  const ask = useCallback(
    async ({ conversationId, question }: { conversationId: string | null; question: string }) => {
      const turnId = `m-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      setProgress({ turnId, conversationId, stage: 'sending', message: 'Sending to desktop…' });
      try {
        const result = await client.rpc<{ conversationId: string; turn: Turn }>(METHOD.QUERY_RUN, {
          conversationId,
          question,
          turnId,
          deviceName,
        });
        void refreshConversations();
        return result;
      } finally {
        setProgress(null);
      }
    },
    [client, refreshConversations]
  );

  /* ---------- offline queue ---------- */

  const queueQuestion = useCallback(
    async ({ conversationId, question }: { conversationId: string | null; question: string }) => {
      const entry: QueuedQuestion = {
        id: `q-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        conversationId,
        question,
        queuedAt: Date.now(),
      };
      const next = [...queue, entry];
      setQueue(next);
      await saveQueue(next);
    },
    [queue]
  );

  const removeQueued = useCallback(
    async (id: string) => {
      const next = queue.filter((q) => q.id !== id);
      setQueue(next);
      await saveQueue(next);
    },
    [queue]
  );

  /* ---------- auth actions ---------- */

  const signInAccount = useCallback(async () => {
    const { session: next } = await signInWithAccount();
    setSession(next);
    connect(next);
  }, [connect]);

  const signInPairing = useCallback(
    async (code: string) => {
      const { session: next } = await signInWithPairingCode(code);
      setSession(next);
      connect(next);
    },
    [connect]
  );

  const signOut = useCallback(async () => {
    client.disconnect();
    await clearAll();
    setSession(null);
    setConversations([]);
    setQueue([]);
    setActiveSource(null);
    setDesktopName(null);
    setConversationsStale(true);
  }, [client]);

  const value = useMemo<SessionValue>(
    () => ({
      ready,
      session,
      relay,
      conversations,
      conversationsStale,
      activeSource,
      desktopName,
      queue,
      progress,
      signInAccount,
      signInPairing,
      signOut,
      refreshConversations,
      getConversation,
      ask,
      queueQuestion,
      removeQueued,
    }),
    [
      ready,
      session,
      relay,
      conversations,
      conversationsStale,
      activeSource,
      desktopName,
      queue,
      progress,
      signInAccount,
      signInPairing,
      signOut,
      refreshConversations,
      getConversation,
      ask,
      queueQuestion,
      removeQueued,
    ]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession must be used inside SessionProvider');
  return value;
}

/* Kept out of the context so unrelated re-renders do not depend on it. */
export function saveStoredSession(session: StoredSession) {
  return saveSession(session);
}
