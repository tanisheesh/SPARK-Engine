/* Account and connection detail. Diagnostics, not settings - there is
   nothing here to configure, because everything configurable lives on the
   desktop where the data is. */

import React from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { PROTOCOL_VERSION } from '../protocol';
import { RELAY_URL } from '../config';
import { useSession } from '../state/SessionProvider';
import { color, space } from '../theme';
import type { RootStackParams } from '../navigation';
import { Button, Divider, Dot, Mono, Row, Txt } from '../components/Primitives';

type Props = NativeStackScreenProps<RootStackParams, 'Account'>;

export function AccountScreen({ navigation }: Props) {
  const { session, relay, desktopName, activeSource, queue, signOut, unpair } = useSession();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: color.bg }} edges={['top']}>
      <Row style={{ paddingHorizontal: space.lg, paddingTop: space.sm, paddingBottom: space.md }}>
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={14}
          accessibilityRole="button"
          accessibilityLabel="Back"
          style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1, paddingRight: space.md }]}
        >
          <Mono size="meta" weight="accent">
            ‹ Back
          </Mono>
        </Pressable>
        <Txt size="small" medium>
          Account
        </Txt>
      </Row>
      <Divider subtle />

      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.xl }}>
        <Field label="SIGNED IN AS">
          <Txt size="body">{session?.email ?? (session?.mode === 'pairing' ? 'Paired device' : 'Unknown')}</Txt>
          {session?.mode === 'pairing' ? (
            <Mono size="micro" weight="warning" style={{ marginTop: space.xs }}>
              PAIRING MODE — DEVELOPMENT ONLY
            </Mono>
          ) : null}
        </Field>

        <Field label="DESKTOP">
          <Row gap={space.sm}>
            <Dot tone={relay.engineOnline ? 'online' : 'offline'} />
            <Txt size="body">
              {relay.engineOnline ? (relay.engineName ?? desktopName ?? 'Connected') : 'Offline'}
            </Txt>
          </Row>
          {activeSource?.name ? (
            <Mono size="micro" weight="faint" style={{ marginTop: space.xs }}>
              DATASET · {activeSource.name}
            </Mono>
          ) : relay.engineOnline ? (
            <Mono size="micro" weight="faint" style={{ marginTop: space.xs }}>
              NO DATASET CONNECTED
            </Mono>
          ) : null}
        </Field>

        <Field label="RELAY">
          <Mono size="meta" weight="muted">
            {RELAY_URL || 'not configured'}
          </Mono>
          <Mono size="micro" weight="faint" style={{ marginTop: space.xs }}>
            {relay.state.toUpperCase()} · PROTOCOL V{PROTOCOL_VERSION}
          </Mono>
          {relay.error ? (
            <Mono size="micro" weight="faint" style={{ marginTop: space.xs }}>
              {relay.error}
            </Mono>
          ) : null}
        </Field>

        {queue.length ? (
          <Field label="QUEUED QUESTIONS">
            <Txt size="body">{queue.length}</Txt>
          </Field>
        ) : null}

        {/* The reassurance that matters for this product: the phone holds no
            data. Stated plainly because it is a real property of the design,
            not a marketing line. */}
        <Field label="ON THIS DEVICE">
          <Txt size="small" weight="muted">
            No dataset is stored on this phone. Questions run on your desktop, against data that
            never leaves it. Only answers and a small preview are sent here.
          </Txt>
        </Field>

        {/* In pairing mode there is no account to sign out of, and the thing
            people actually need is to re-enter a rotated code. Naming that
            action "Sign out" hides it behind the wrong word. */}
        <View style={{ marginTop: space.md, gap: space.sm }}>
          {session?.mode === 'pairing' ? (
            <>
              <Button label="Enter a new pairing code" onPress={() => void unpair()} />
              <Button label="Unpair and clear this phone" variant="ghost" onPress={() => void signOut()} />
            </>
          ) : (
            <Button label="Sign out" onPress={() => void signOut()} />
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View>
      <Mono size="micro" weight="faint" style={{ marginBottom: space.sm }}>
        {label}
      </Mono>
      {children}
    </View>
  );
}
