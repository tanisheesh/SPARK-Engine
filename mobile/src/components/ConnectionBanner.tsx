/* Connection truth-telling.
 *
 * Two different things can be wrong and the user needs to know which:
 *   - the PHONE cannot reach the relay (no signal, relay down, bad URL)
 *   - the phone is fine but the DESKTOP is not connected (laptop shut)
 *
 * Only the second is actionable by going and opening SPARK, so they never
 * share a message. Nothing here ever implies a query might still work.
 */

import React from 'react';
import { View } from 'react-native';

import type { RelaySnapshot } from '../api/relay';
import { color, radius, space } from '../theme';
import { Button, Dot, Mono, Row, Txt } from './Primitives';

export function canAsk(relay: RelaySnapshot): boolean {
  return relay.state === 'online' && relay.engineOnline;
}

/** One line for the top of a screen. */
export function ConnectionStrip({ relay, desktopName }: { relay: RelaySnapshot; desktopName?: string | null }) {
  const { tone, label } = describe(relay, desktopName);
  return (
    <Row gap={space.sm} style={{ paddingHorizontal: space.lg, paddingBottom: space.sm }}>
      <Dot tone={tone} />
      <Mono size="micro" weight="faint">
        {label}
      </Mono>
    </Row>
  );
}

function describe(
  relay: RelaySnapshot,
  desktopName?: string | null
): { tone: 'online' | 'offline' | 'busy'; label: string } {
  if (relay.state === 'connecting') return { tone: 'busy', label: 'CONNECTING' };
  if (relay.state === 'offline') return { tone: 'offline', label: 'NO CONNECTION' };
  if (relay.state === 'error') return { tone: 'offline', label: 'CONNECTION REFUSED' };
  if (relay.state === 'idle') return { tone: 'offline', label: 'NOT CONNECTED' };
  if (!relay.engineOnline) return { tone: 'offline', label: 'DESKTOP OFFLINE' };
  const name = relay.engineName ?? desktopName;
  return { tone: 'online', label: name ? `CONNECTED · ${name.toUpperCase()}` : 'CONNECTED' };
}

/* The full explanation, shown in a conversation when a question cannot be
   sent. Names the dataset so the user knows exactly what is unreachable. */
export function OfflineNotice({
  relay,
  sourceName,
  queued,
  pairingMode,
  onRepair,
}: {
  relay: RelaySnapshot;
  sourceName?: string | null;
  queued: number;
  /** True when the session is a dev pairing code rather than an account. */
  pairingMode?: boolean;
  onRepair?: () => void;
}) {
  const phoneProblem = relay.state !== 'online';

  /* The specific trap this covers: the desktop mints a NEW pairing code every
     time it reconnects, which silently strands the phone in the old code's
     room. From here it looks identical to "desktop is asleep", so the fix has
     to be offered here — hunting for a "sign out" button to re-pair is not a
     path anyone will find. */
  const codeMayHaveChanged = pairingMode && !phoneProblem && !relay.engineOnline;

  return (
    <View
      style={{
        marginHorizontal: space.lg,
        marginBottom: space.md,
        borderWidth: 1,
        borderColor: color.line,
        borderRadius: radius.xl,
        backgroundColor: color.surface,
        padding: space.lg,
      }}
    >
      <Mono size="micro" weight="faint">
        {phoneProblem ? 'NO CONNECTION' : 'DESKTOP OFFLINE'}
      </Mono>

      {sourceName ? (
        <View style={{ marginTop: space.md }}>
          <Txt size="small" weight="muted">
            This conversation is connected to
          </Txt>
          <Mono size="small" weight="muted" style={{ marginTop: 2 }}>
            {sourceName}
          </Mono>
        </View>
      ) : null}

      <Txt size="small" weight="muted" style={{ marginTop: space.md }}>
        {phoneProblem
          ? 'SPARK can’t reach the relay right now. Your question can be queued and sent once the connection returns.'
          : 'SPARK can’t query this dataset right now. Your question can be queued and sent when the desktop becomes available.'}
      </Txt>

      {codeMayHaveChanged ? (
        <View style={{ marginTop: space.lg }}>
          <Txt size="small" weight="muted">
            If you reconnected the desktop, it generated a new pairing code and this phone is
            still using the old one.
          </Txt>
          <Button
            label="Enter a new pairing code"
            style={{ marginTop: space.md }}
            onPress={() => onRepair?.()}
          />
        </View>
      ) : null}

      {queued > 0 ? (
        <Mono size="micro" weight="accent" style={{ marginTop: space.md }}>
          {queued} question{queued === 1 ? '' : 's'} queued
        </Mono>
      ) : null}
    </View>
  );
}
