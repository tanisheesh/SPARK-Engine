/* The home screen: the user's existing conversations, from the desktop.
 *
 * Everything shown here is real data returned by the engine. Nothing is
 * placeholder, and a conversation with no answer yet shows no answer rather
 * than an invented preview.
 */

import React, { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { relativeTime } from '../format';
import { useSession } from '../state/SessionProvider';
import { color, radius, space } from '../theme';
import type { ConversationSummary } from '../types';
import type { RootStackParams } from '../navigation';
import { ConnectionStrip, canAsk } from '../components/ConnectionBanner';
import {
  Button,
  Divider,
  EmptyState,
  Mono,
  Panel,
  Row,
  SparkMark,
  Tag,
  Txt,
} from '../components/Primitives';

type Props = NativeStackScreenProps<RootStackParams, 'Conversations'>;

export function ConversationsScreen({ navigation }: Props) {
  const {
    session,
    unpair,
    conversations,
    conversationsStale,
    relay,
    desktopName,
    refreshConversations,
    queue,
  } = useSession();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshConversations();
    setRefreshing(false);
  }, [refreshConversations]);

  const ready = canAsk(relay);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: color.bg }} edges={['top']}>
      {/* ---- header ---- */}
      <Row style={{ paddingHorizontal: space.lg, paddingTop: space.sm, paddingBottom: space.md }}>
        <Row gap={space.sm} style={{ flex: 1 }}>
          <SparkMark size={20} />
          <Mono size="meta" weight="muted">
            SPARK
          </Mono>
        </Row>
        <Pressable
          onPress={() => navigation.navigate('Account')}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Account and settings"
          style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}
        >
          <Mono size="meta" weight="accent">
            Account
          </Mono>
        </Pressable>
      </Row>

      <ConnectionStrip relay={relay} desktopName={desktopName} />
      <Divider subtle />

      <FlatList
        data={conversations}
        keyExtractor={(item) => item.id}
        contentContainerStyle={
          conversations.length
            ? { paddingBottom: space.xxxl }
            : { flexGrow: 1 }
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={color.muted}
            colors={[color.accent]}
          />
        }
        ListHeaderComponent={
          <View>
            {/* The desktop mints a fresh pairing code on every reconnect, which
                strands this phone in the old code's room. Indistinguishable
                from "desktop asleep" unless we say so here. */}
            {session?.mode === 'pairing' && relay.state === 'online' && !relay.engineOnline ? (
              <Panel style={{ margin: space.lg, marginBottom: 0 }}>
                <Mono size="micro" weight="faint">
                  DESKTOP OFFLINE
                </Mono>
                <Txt size="small" weight="muted" style={{ marginTop: space.sm }}>
                  If you reconnected the desktop it generated a new pairing code, and this phone
                  is still using the old one.
                </Txt>
                <Button
                  label="Enter a new pairing code"
                  style={{ marginTop: space.md }}
                  onPress={() => void unpair()}
                />
              </Panel>
            ) : null}

            {queue.length ? (
              <Panel style={{ margin: space.lg, marginBottom: 0 }}>
                <Mono size="micro" weight="accent">
                  {queue.length} QUEUED
                </Mono>
                <Txt size="small" weight="muted" style={{ marginTop: space.xs }}>
                  Waiting for the desktop. Open the conversation to send.
                </Txt>
              </Panel>
            ) : null}

            {conversationsStale && conversations.length ? (
              <Mono
                size="micro"
                weight="faint"
                style={{ paddingHorizontal: space.lg, paddingTop: space.md }}
              >
                SHOWING CACHED — PULL TO REFRESH
              </Mono>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            title={ready ? 'No conversations yet' : 'Nothing cached yet'}
            body={
              ready
                ? 'Ask your first question, or start one on SPARK Desktop and it will appear here.'
                : 'Connect to your desktop to load the conversations you already have.'
            }
          >
            {ready ? (
              <Button
                label="Ask a question"
                variant="primary"
                onPress={() =>
                  navigation.navigate('Conversation', { conversationId: null, title: 'New question' })
                }
              />
            ) : null}
          </EmptyState>
        }
        renderItem={({ item }) => (
          <ConversationRow
            item={item}
            onPress={() =>
              navigation.navigate('Conversation', {
                conversationId: item.id,
                title: item.title,
              })
            }
          />
        )}
        ItemSeparatorComponent={() => <Divider subtle style={{ marginHorizontal: space.lg }} />}
      />

      {/* Starting a new question is the primary action, so it stays reachable
          without scrolling back to an empty state. */}
      {conversations.length && ready ? (
        <View
          style={{
            paddingHorizontal: space.lg,
            paddingBottom: space.lg,
            paddingTop: space.md,
            borderTopWidth: 1,
            borderTopColor: color.line,
          }}
        >
          <Button
            label="New question"
            variant="primary"
            onPress={() =>
              navigation.navigate('Conversation', { conversationId: null, title: 'New question' })
            }
          />
        </View>
      ) : null}
    </SafeAreaView>
  );
}

function ConversationRow({
  item,
  onPress,
}: {
  item: ConversationSummary;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={item.title}
      style={({ pressed }) => [
        {
          paddingHorizontal: space.lg,
          paddingVertical: space.lg,
          backgroundColor: pressed ? color.surface : 'transparent',
          borderRadius: radius.md,
        },
      ]}
    >
      <Row style={{ marginBottom: 2 }}>
        <Txt size="body" medium numberOfLines={1} style={{ flex: 1 }}>
          {item.title}
        </Txt>
        <Mono size="micro" weight="faint" style={{ marginLeft: space.sm }}>
          {relativeTime(item.updatedAt)}
        </Mono>
      </Row>

      {item.source?.name ? (
        <Mono size="micro" weight="faint" numberOfLines={1}>
          {item.source.name}
        </Mono>
      ) : null}

      {item.lastQuestion ? (
        <Txt
          size="small"
          weight="muted"
          numberOfLines={2}
          style={{ marginTop: space.sm }}
        >
          “{item.lastQuestion}”
        </Txt>
      ) : null}

      <Row gap={space.sm} style={{ marginTop: space.sm }}>
        <Mono size="micro" weight="faint">
          {item.turnCount} question{item.turnCount === 1 ? '' : 's'}
        </Mono>
        {item.lastStatus === 'error' ? <Tag label="FAILED" tone="negative" /> : null}
        {item.lastStatus && item.lastStatus !== 'done' && item.lastStatus !== 'error' ? (
          <Tag label="IN PROGRESS" tone="warning" />
        ) : null}
      </Row>
    </Pressable>
  );
}
