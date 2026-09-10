/* The ask bar.
 *
 * One text field and one send affordance. The microphone is deliberately
 * absent: voice is explicitly not a V1 requirement, and a mic button that
 * does nothing is worse than no mic button.
 */

import React, { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { TOUCH, color, font, radius, space, type } from '../theme';
import { Mono } from './Primitives';

export function Composer({
  onSubmit,
  disabled,
  busy,
  placeholder = 'Ask your data…',
  hint,
}: {
  onSubmit: (question: string) => void;
  disabled?: boolean;
  busy?: boolean;
  placeholder?: string;
  /** Shown above the field when the app cannot send right now. */
  hint?: string | null;
}) {
  const [value, setValue] = useState('');
  const [focused, setFocused] = useState(false);
  const canSend = value.trim().length > 0 && !busy && !disabled;

  const submit = () => {
    if (!canSend) return;
    const question = value.trim();
    setValue('');
    onSubmit(question);
  };

  return (
    <View
      style={{
        borderTopWidth: 1,
        borderTopColor: color.line,
        backgroundColor: color.bg,
        paddingHorizontal: space.lg,
        paddingTop: space.md,
        paddingBottom: space.md,
      }}
    >
      {hint ? (
        <Mono size="micro" weight="faint" style={{ marginBottom: space.sm }}>
          {hint}
        </Mono>
      ) : null}

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-end',
          gap: space.sm,
          borderWidth: 1,
          borderColor: focused ? color.accentLine : color.line,
          borderRadius: radius.xl,
          backgroundColor: color.surface,
          paddingLeft: space.md,
          paddingRight: space.xs,
          paddingVertical: space.xs,
        }}
      >
        <TextInput
          value={value}
          onChangeText={setValue}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder}
          placeholderTextColor={color.faint}
          editable={!disabled}
          multiline
          // Long questions are normal ("how did revenue change by region last
          // quarter compared to..."), so the field grows to four lines and
          // then scrolls rather than hiding what was typed.
          style={{
            flex: 1,
            color: color.ink,
            fontFamily: font.sans,
            fontSize: type.body.fontSize,
            lineHeight: type.body.lineHeight,
            maxHeight: type.body.lineHeight * 4,
            paddingTop: 9,
            paddingBottom: 9,
          }}
          onSubmitEditing={submit}
          blurOnSubmit={false}
          returnKeyType="send"
          accessibilityLabel="Your question"
        />

        <Pressable
          onPress={submit}
          disabled={!canSend}
          accessibilityRole="button"
          accessibilityLabel="Send question"
          accessibilityState={{ disabled: !canSend, busy: Boolean(busy) }}
          style={({ pressed }) => [
            {
              width: TOUCH - 8,
              height: TOUCH - 8,
              borderRadius: radius.md,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: canSend ? color.accent : color.surface3,
              opacity: pressed && canSend ? 0.82 : 1,
            },
          ]}
        >
          <ArrowUp color={canSend ? color.accentInk : color.faint} />
        </Pressable>
      </View>
    </View>
  );
}

function ArrowUp({ color: stroke }: { color: string }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24">
      <Path
        d="M12 19V5M5 12l7-7 7 7"
        stroke={stroke}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}
