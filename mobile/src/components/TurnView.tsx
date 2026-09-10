/* One question and everything SPARK produced from it.
 *
 * Reads as an analytical exchange, not a chat: no bubbles, no avatars, no
 * tails. The speaker is a small mono label, the answer is the largest text on
 * the screen, and everything technical is secondary and collapsed.
 *
 * Priority order, per the product brief: answer, then chart if genuinely
 * useful, then a small data preview, then optional technical detail.
 */

import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View, useWindowDimensions } from 'react-native';

import { inferChart } from '../chart';
import { formatCell, classifyColumns, humanizeColumn, relativeTime } from '../format';
import { STAGE_LABELS, type Turn } from '../types';
import { color, radius, space } from '../theme';
import type { AskProgress } from '../state/SessionProvider';
import { Chart } from './Chart';
import { Divider, Mono, Row, Txt } from './Primitives';

export function TurnView({
  turn,
  progress,
  sourceName,
}: {
  turn: Turn;
  progress?: AskProgress | null;
  sourceName?: string | null;
}) {
  const { width } = useWindowDimensions();
  const [showData, setShowData] = useState(false);
  const [showSql, setShowSql] = useState(false);

  const running = turn.status !== 'done' && turn.status !== 'error' && turn.status !== 'cancelled';
  const chart = useMemo(
    () => (turn.status === 'done' ? inferChart(turn.rows, turn.totalRows) : null),
    [turn.rows, turn.totalRows, turn.status]
  );

  const contentW = width - space.lg * 2 - space.md * 2;

  return (
    <View style={{ paddingVertical: space.lg }}>
      {/* ---- question ---- */}
      <Row gap={space.sm} style={{ marginBottom: space.sm }}>
        <Mono size="micro" weight="faint">
          YOU
        </Mono>
        {turn.origin === 'mobile' ? (
          <Mono size="micro" weight="faint">
            · mobile
          </Mono>
        ) : null}
        <View style={{ flex: 1 }} />
        <Mono size="micro" weight="faint">
          {relativeTime(turn.createdAt)}
        </Mono>
      </Row>
      <Txt size="body" style={{ marginBottom: space.xl }}>
        {turn.question}
      </Txt>

      {/* ---- answer ---- */}
      <Row gap={space.sm} style={{ marginBottom: space.sm }}>
        <Mono size="micro" weight="accent">
          SPARK
        </Mono>
        {turn.usedLocalFallback ? (
          <Mono size="micro" weight="faint">
            · local model
          </Mono>
        ) : null}
      </Row>

      {running ? (
        <RunningState turn={turn} progress={progress} />
      ) : turn.status === 'error' ? (
        <View
          style={{
            borderLeftWidth: 2,
            borderLeftColor: color.negative,
            paddingLeft: space.md,
          }}
        >
          <Txt size="small" weight="muted">
            {turn.error || 'This question could not be answered.'}
          </Txt>
        </View>
      ) : (
        <>
          <Txt size="answer" selectable>
            {turn.answer}
          </Txt>

          {chart ? (
            <View style={{ marginTop: space.xl }}>
              <Chart spec={chart} width={contentW} />
            </View>
          ) : null}

          {/* ---- provenance ---- */}
          {sourceName || turn.privacy ? (
            <View style={{ marginTop: space.xl }}>
              <Mono size="micro" weight="faint">
                SOURCE
              </Mono>
              <Row gap={space.sm} style={{ marginTop: 2, flexWrap: 'wrap' }}>
                {sourceName ? <Mono size="meta">{sourceName}</Mono> : null}
                {turn.totalRows != null ? (
                  <Mono size="micro" weight="faint">
                    · {turn.totalRows.toLocaleString('en-US')} row
                    {turn.totalRows === 1 ? '' : 's'}
                  </Mono>
                ) : null}
                {turn.privacy && turn.privacy.tokensRedacted > 0 ? (
                  <Mono size="micro" weight="faint">
                    · {turn.privacy.tokensRedacted} value
                    {turn.privacy.tokensRedacted === 1 ? '' : 's'} redacted
                  </Mono>
                ) : null}
              </Row>
            </View>
          ) : null}

          {/* ---- secondary actions ---- */}
          <Row gap={space.lg} style={{ marginTop: space.lg }}>
            {turn.rows && turn.rows.length ? (
              <Action
                label={showData ? 'Hide data' : 'View data'}
                onPress={() => setShowData((v) => !v)}
              />
            ) : null}
            {turn.sql ? (
              <Action
                label={showSql ? 'Hide SQL' : 'View SQL'}
                onPress={() => setShowSql((v) => !v)}
              />
            ) : null}
          </Row>

          {showData && turn.rows ? (
            <DataPreview rows={turn.rows} totalRows={turn.totalRows} />
          ) : null}
          {showSql && turn.sql ? <SqlBlock sql={turn.sql} /> : null}
        </>
      )}
    </View>
  );
}

/* The honest processing state. The label comes from a real pipeline stage that
   the desktop emitted; when none has arrived yet it says "Sending", which is
   exactly what is happening. There is no percentage anywhere because the
   backend does not produce one. */
function RunningState({ turn, progress }: { turn: Turn; progress?: AskProgress | null }) {
  const relevant = progress && progress.turnId === turn.id ? progress : null;
  const label = !relevant
    ? 'Sending'
    : relevant.stage === 'sending'
      ? 'Sending'
      : (STAGE_LABELS[relevant.stage as keyof typeof STAGE_LABELS] ?? 'Working');

  return (
    <Row gap={space.md}>
      <ActivityIndicator size="small" color={color.accent} />
      <View>
        <Txt size="small" weight="muted">
          {label}
        </Txt>
        {relevant?.message ? (
          <Mono size="micro" weight="faint" numberOfLines={1}>
            {relevant.message}
          </Mono>
        ) : null}
      </View>
    </Row>
  );
}

function Action({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      hitSlop={12}
      style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1, paddingVertical: 6 }]}
    >
      <Mono size="meta" weight="accent">
        {label}
      </Mono>
    </Pressable>
  );
}

/* A preview, not a table viewer. Three columns and five rows is enough to
   sanity-check an answer; anything more is a desktop job and says so. */
function DataPreview({ rows, totalRows }: { rows: Record<string, unknown>[]; totalRows?: number }) {
  const cols = useMemo(() => classifyColumns(rows).slice(0, 3), [rows]);
  const preview = rows.slice(0, 5);
  const hiddenCols = Object.keys(rows[0] ?? {}).length - cols.length;

  return (
    <View
      style={{
        marginTop: space.md,
        borderWidth: 1,
        borderColor: color.lineSubtle,
        borderRadius: radius.md,
        backgroundColor: color.surface2,
        overflow: 'hidden',
      }}
    >
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View>
          <Row style={{ paddingHorizontal: space.md, paddingVertical: space.sm }}>
            {cols.map((c) => (
              <View key={c.name} style={{ width: 116 }}>
                <Mono size="micro" weight="faint" numberOfLines={1}>
                  {humanizeColumn(c.name)}
                </Mono>
              </View>
            ))}
          </Row>
          <Divider subtle />
          {preview.map((row, i) => (
            <View key={i}>
              <Row style={{ paddingHorizontal: space.md, paddingVertical: space.sm }}>
                {cols.map((c) => (
                  <View key={c.name} style={{ width: 116 }}>
                    <Mono size="meta" weight="muted" numberOfLines={1}>
                      {formatCell(row[c.name], c.kind)}
                    </Mono>
                  </View>
                ))}
              </Row>
              {i < preview.length - 1 ? <Divider subtle /> : null}
            </View>
          ))}
        </View>
      </ScrollView>

      <Divider subtle />
      <View style={{ paddingHorizontal: space.md, paddingVertical: space.sm }}>
        <Mono size="micro" weight="faint">
          {preview.length} of {(totalRows ?? rows.length).toLocaleString('en-US')} rows
          {hiddenCols > 0 ? ` · ${hiddenCols} more column${hiddenCols === 1 ? '' : 's'}` : ''}
          {' · view the full result on desktop'}
        </Mono>
      </View>
    </View>
  );
}

function SqlBlock({ sql }: { sql: string }) {
  return (
    <View
      style={{
        marginTop: space.md,
        borderWidth: 1,
        borderColor: color.lineSubtle,
        borderRadius: radius.md,
        backgroundColor: color.surface2,
        padding: space.md,
      }}
    >
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <Mono size="meta" weight="muted" selectable>
          {sql}
        </Mono>
      </ScrollView>
    </View>
  );
}
