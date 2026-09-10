/* The whole UI kit. Small on purpose - the desktop's restraint comes from
   having few pieces used consistently, and that transfers directly.

   Conventions: `Txt` for human text, `Mono` for anything a database produced
   (dataset names, column names, SQL, timings, counts). That split is the
   loudest signal in SPARK's visual language and it is worth keeping exact. */

import React from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import { TOUCH, color, font, radius, space, type } from '../theme';

/* Three text weights plus the accent, exactly as the desktop defines them.
   'warning' is the one addition and is status only — it marks the
   development-mode pairing banner, never body copy. */
type Weight = 'ink' | 'muted' | 'faint' | 'accent' | 'warning';
type Size = keyof typeof type;

const WEIGHT: Record<Weight, string> = {
  ink: color.ink,
  muted: color.muted,
  faint: color.faint,
  accent: color.accent,
  warning: color.warning,
};

interface TxtProps {
  children: React.ReactNode;
  size?: Size;
  weight?: Weight;
  medium?: boolean;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
  selectable?: boolean;
}

export function Txt({
  children,
  size = 'body',
  weight = 'ink',
  medium,
  style,
  numberOfLines,
  selectable,
}: TxtProps) {
  return (
    <Text
      numberOfLines={numberOfLines}
      selectable={selectable}
      style={[
        type[size],
        { color: WEIGHT[weight], fontFamily: medium ? font.sansMedium : font.sans },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

export function Mono({
  children,
  size = 'meta',
  weight = 'muted',
  style,
  numberOfLines,
  selectable,
}: Omit<TxtProps, 'medium'>) {
  return (
    <Text
      numberOfLines={numberOfLines}
      selectable={selectable}
      style={[type[size], { color: WEIGHT[weight], fontFamily: font.mono }, style]}
    >
      {children}
    </Text>
  );
}

/* ---------- structure ---------- */

export function Divider({ subtle, style }: { subtle?: boolean; style?: StyleProp<ViewStyle> }) {
  return (
    <View
      style={[{ height: 1, backgroundColor: subtle ? color.lineSubtle : color.line }, style]}
    />
  );
}

export function Row({
  children,
  gap = space.sm,
  style,
}: {
  children: React.ReactNode;
  gap?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', gap }, style]}>{children}</View>
  );
}

/** A bordered container. One border, one radius, no shadow - depth is only for
    things that genuinely float, and a panel in a list does not. */
export function Panel({
  children,
  style,
  inset = space.md,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  inset?: number;
}) {
  return (
    <View
      style={[
        {
          backgroundColor: color.surface,
          borderColor: color.lineSubtle,
          borderWidth: 1,
          borderRadius: radius.xl,
          padding: inset,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

/* ---------- controls ---------- */

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  disabled?: boolean;
  busy?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function Button({
  label,
  onPress,
  variant = 'secondary',
  disabled,
  busy,
  style,
}: ButtonProps) {
  const inert = disabled || busy;
  const isPrimary = variant === 'primary';
  const isGhost = variant === 'ghost';

  return (
    <Pressable
      onPress={onPress}
      disabled={inert}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: Boolean(inert), busy: Boolean(busy) }}
      style={({ pressed }) => [
        styles.button,
        isPrimary && { backgroundColor: color.accent, borderColor: color.accent },
        variant === 'secondary' && {
          backgroundColor: color.surface2,
          borderColor: color.line,
        },
        isGhost && { backgroundColor: 'transparent', borderColor: 'transparent' },
        pressed && !inert && { opacity: 0.82 },
        inert && { opacity: 0.42 },
        style,
      ]}
    >
      {busy ? (
        <ActivityIndicator size="small" color={isPrimary ? color.accentInk : color.muted} />
      ) : (
        <Text
          style={[
            type.small,
            {
              fontFamily: font.sansMedium,
              color: isPrimary ? color.accentInk : isGhost ? color.muted : color.ink,
            },
          ]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

/** The one place a pill is allowed: status. */
export function Tag({
  label,
  tone = 'neutral',
}: {
  label: string;
  tone?: 'neutral' | 'accent' | 'warning' | 'negative';
}) {
  const tones = {
    neutral: { fg: color.faint, bd: color.lineSubtle, bg: 'transparent' },
    accent: { fg: color.accent, bd: color.accentLine, bg: color.accentSoft },
    warning: { fg: color.warning, bd: 'rgba(179,154,99,0.34)', bg: 'rgba(179,154,99,0.10)' },
    negative: { fg: color.negative, bd: 'rgba(180,119,106,0.34)', bg: 'rgba(180,119,106,0.10)' },
  }[tone];

  return (
    <View
      style={{
        paddingHorizontal: space.sm,
        paddingVertical: 3,
        borderRadius: radius.pill,
        borderWidth: 1,
        borderColor: tones.bd,
        backgroundColor: tones.bg,
      }}
    >
      <Text style={[type.micro, { color: tones.fg, fontFamily: font.mono }]}>{label}</Text>
    </View>
  );
}

/** A small status dot. Never the only signal - it always sits beside text. */
export function Dot({ tone }: { tone: 'online' | 'offline' | 'busy' }) {
  const fill =
    tone === 'online' ? color.accent : tone === 'busy' ? color.warning : color.faint;
  return <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: fill }} />;
}

/* ---------- identity ---------- */

/* The existing SPARK mark, unchanged: four cardinal directions for the four
   core strengths, smaller spokes for the unexpected ones, converging at the
   centre. Shipped as the same raster the desktop uses (public/logo-mark.png,
   6.7 KB) rather than redrawn, so the two products cannot drift apart. */
export function SparkMark({ size = 22 }: { size?: number }) {
  return (
    <Image
      source={require('../../assets/logo-mark.png')}
      style={{ width: size, height: size }}
      resizeMode="contain"
      accessibilityLabel="SPARK"
    />
  );
}

export function EmptyState({
  title,
  body,
  children,
}: {
  title: string;
  body?: string;
  children?: React.ReactNode;
}) {
  return (
    <View style={styles.empty}>
      <Txt size="title" medium>
        {title}
      </Txt>
      {body ? (
        <Txt size="small" weight="muted" style={{ textAlign: 'center', marginTop: space.sm }}>
          {body}
        </Txt>
      ) : null}
      {children ? <View style={{ marginTop: space.lg }}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: TOUCH,
    paddingHorizontal: space.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.xxl,
  },
});
