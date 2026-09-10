/* The active conversation - the core of the app.
 *
 * Loads the real conversation from the desktop, appends the answer to a
 * question asked here, and never shows an optimistic result: a turn is
 * rendered as running until the engine actually returns, and as failed if it
 * does not. There is no local guess at what the answer might be.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { explainError, type RpcError } from '../protocol';
import { useSession } from '../state/SessionProvider';
import { color, space } from '../theme';
import type { Conversation, Turn } from '../types';
import type { RootStackParams } from '../navigation';
import { Composer } from '../components/Composer';
import { ConnectionStrip, OfflineNotice, canAsk } from '../components/ConnectionBanner';
import { Button, Divider, Mono, Row, Txt } from '../components/Primitives';
import { TurnView } from '../components/TurnView';

type Props = NativeStackScreenProps<RootStackParams, 'Conversation'>;

export function ConversationScreen({ route, navigation }: Props) {
  const initialId = route.params.conversationId;
  const {
    relay,
    activeSource,
    desktopName,
    progress,
    getConversation,
    ask,
    queue,
    queueQuestion,
    removeQueued,
  } = useSession();

  const [conversationId, setConversationId] = useState<string | null>(initialId);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [loading, setLoading] = useState(Boolean(initialId));
  const [loadError, setLoadError] = useState<string | null>(null);
  /* The question currently being asked, held locally so it appears the instant
     it is sent. It is merged into the list below with status 'thinking' - a
     real state, not a fake answer. */
  const [pendingTurn, setPendingTurn] = useState<Turn | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);

  const listRef = useRef<FlatList<Turn>>(null);
  const ready = canAsk(relay);
  const sourceName = conversation?.source?.name ?? activeSource?.name ?? null;

  const load = useCallback(
    async (id: string) => {
      setLoading(true);
      setLoadError(null);
      try {
        setConversation(await getConversation(id));
      } catch (error) {
        setLoadError(explainError(error as RpcError));
      } finally {
        setLoading(false);
      }
    },
    [getConversation]
  );

  useEffect(() => {
    if (conversationId && ready) void load(conversationId);
  }, [conversationId, ready, load]);

  const turns: Turn[] = [...(conversation?.turns ?? []), ...(pendingTurn ? [pendingTurn] : [])];

  useEffect(() => {
    if (turns.length) {
      // Defer so the row exists before we scroll to it.
      const timer = setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 60);
      return () => clearTimeout(timer);
    }
  }, [turns.length]);

  const send = useCallback(
    async (question: string) => {
      setSendError(null);
      const optimistic: Turn = {
        id: `local-${Date.now()}`,
        question,
        status: 'thinking',
        createdAt: Date.now(),
        origin: 'mobile',
      };
      setPendingTurn(optimistic);

      try {
        const result = await ask({ conversationId, question });
        setPendingTurn(null);

        // A brand-new conversation gets its id from the engine.
        if (!conversationId) {
          setConversationId(result.conversationId);
          navigation.setParams({ conversationId: result.conversationId } as never);
        }

        setConversation((prev) => {
          const base: Conversation =
            prev ??
            {
              id: result.conversationId,
              title: question,
              source: null,
              turns: [],
              createdAt: Date.now(),
              updatedAt: Date.now(),
            };
          const withoutDupe = base.turns.filter((t) => t.id !== result.turn.id);
          return { ...base, turns: [...withoutDupe, result.turn], updatedAt: Date.now() };
        });
      } catch (error) {
        setPendingTurn(null);
        setSendError(explainError(error as RpcError));
      }
    },
    [ask, conversationId, navigation]
  );

  const relevantQueue = queue.filter(
    (q) => q.conversationId === conversationId || (!conversationId && !q.conversationId)
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: color.bg }} edges={['top']}>
      {/* ---- header ---- */}
      <Row style={{ paddingHorizontal: space.lg, paddingTop: space.sm, paddingBottom: space.md }}>
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={14}
          accessibilityRole="button"
          accessibilityLabel="Back to conversations"
          style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1, paddingRight: space.md }]}
        >
          <Mono size="meta" weight="accent">
            ‹ Back
          </Mono>
        </Pressable>
        <View style={{ flex: 1 }}>
          <Txt size="small" medium numberOfLines={1}>
            {conversation?.title ?? route.params.title ?? 'New question'}
          </Txt>
          {sourceName ? (
            <Mono size="micro" weight="faint" numberOfLines={1}>
              {sourceName}
            </Mono>
          ) : null}
        </View>
      </Row>

      <ConnectionStrip relay={relay} desktopName={desktopName} />
      <Divider subtle />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {loading && !turns.length ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator color={color.accent} />
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={turns}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: space.lg }}
            ItemSeparatorComponent={() => <Divider subtle />}
            ListHeaderComponent={
              loadError ? (
                <View style={{ paddingTop: space.lg }}>
                  <Txt size="small" weight="muted">
                    {loadError}
                  </Txt>
                  {conversationId ? (
                    <Button
                      label="Try again"
                      style={{ marginTop: space.md }}
                      onPress={() => void load(conversationId)}
                    />
                  ) : null}
                </View>
              ) : null
            }
            ListEmptyComponent={
              !loadError ? (
                <View style={{ paddingTop: space.xxxl }}>
                  <Txt size="small" weight="muted">
                    {sourceName
                      ? 'Ask anything about this dataset.'
                      : 'Ask a question and SPARK will answer from the dataset connected on your desktop.'}
                  </Txt>
                </View>
              ) : null
            }
            renderItem={({ item }) => (
              <TurnView turn={item} progress={progress} sourceName={sourceName} />
            )}
          />
        )}

        {/* ---- queued questions ---- */}
        {relevantQueue.length ? (
          <View style={{ paddingHorizontal: space.lg, paddingBottom: space.sm }}>
            {relevantQueue.map((q) => (
              <Row key={q.id} gap={space.sm} style={{ paddingVertical: space.sm }}>
                <Mono size="micro" weight="accent">
                  QUEUED
                </Mono>
                <Txt size="small" weight="muted" numberOfLines={1} style={{ flex: 1 }}>
                  {q.question}
                </Txt>
                {ready ? (
                  <Pressable
                    onPress={async () => {
                      await removeQueued(q.id);
                      await send(q.question);
                    }}
                    hitSlop={10}
                    accessibilityRole="button"
                    accessibilityLabel={`Send queued question: ${q.question}`}
                  >
                    <Mono size="micro" weight="accent">
                      Send
                    </Mono>
                  </Pressable>
                ) : (
                  <Pressable
                    onPress={() => void removeQueued(q.id)}
                    hitSlop={10}
                    accessibilityRole="button"
                    accessibilityLabel={`Discard queued question: ${q.question}`}
                  >
                    <Mono size="micro" weight="faint">
                      Discard
                    </Mono>
                  </Pressable>
                )}
              </Row>
            ))}
          </View>
        ) : null}

        {!ready ? (
          <OfflineNotice relay={relay} sourceName={sourceName} queued={relevantQueue.length} />
        ) : null}

        {sendError ? (
          <View style={{ paddingHorizontal: space.lg, paddingBottom: space.sm }}>
            <Txt size="small" weight="muted">
              {sendError}
            </Txt>
          </View>
        ) : null}

        <Composer
          onSubmit={(question) =>
            ready ? void send(question) : void queueQuestion({ conversationId, question })
          }
          busy={Boolean(pendingTurn)}
          placeholder={ready ? 'Ask your data…' : 'Queue a question…'}
          hint={
            !ready
              ? 'The desktop is unavailable — questions will be queued, not answered.'
              : pendingTurn
                ? 'One question at a time.'
                : null
          }
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
