/* Sign-in. The mark, one statement, and the shortest path to authenticated.
   No carousel, no marketing copy, no feature tour. */

import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CONFIG_HELP, accountAuthAvailable, configured } from '../config';
import { useSession } from '../state/SessionProvider';
import { color, font, radius, space, type } from '../theme';
import { Button, Divider, Mono, Row, SparkMark, Txt } from '../components/Primitives';

export function AuthScreen() {
  const { signInAccount, signInPairing } = useSession();

  // Pairing is the fallback, so it only takes over the screen when account
  // sign-in genuinely is not available in this build.
  const [mode, setMode] = useState<'account' | 'pairing'>(
    accountAuthAvailable ? 'account' : 'pairing'
  );
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (e: any) {
      setError(e?.message ?? 'Sign-in failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: color.bg }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: space.xxl }}>
          <Row gap={space.md}>
            <SparkMark size={26} />
            <Mono size="small" weight="muted">
              SPARK
            </Mono>
          </Row>

          <Txt size="display" medium style={{ marginTop: space.xxl }}>
            TALK TO YOUR DATA.
          </Txt>

          {!configured ? (
            <View style={{ marginTop: space.xxl }}>
              <Mono size="micro" weight="faint">
                NOT CONFIGURED
              </Mono>
              <Txt size="small" weight="muted" style={{ marginTop: space.sm }}>
                {CONFIG_HELP}
              </Txt>
            </View>
          ) : (
            <View style={{ marginTop: space.xxxl }}>
              {mode === 'account' ? (
                <Button
                  label="Sign in"
                  variant="primary"
                  busy={busy}
                  onPress={() => run(signInAccount)}
                />
              ) : (
                <>
                  <Mono size="micro" weight="faint">
                    PAIRING CODE
                  </Mono>
                  <Txt size="small" weight="muted" style={{ marginTop: space.sm }}>
                    Open SPARK Desktop → Settings → Remote access, then enter the six-character
                    code shown there.
                  </Txt>
                  <TextInput
                    value={code}
                    onChangeText={(next) => setCode(next.toUpperCase().slice(0, 6))}
                    placeholder="XXXXXX"
                    placeholderTextColor={color.faint}
                    autoCapitalize="characters"
                    autoCorrect={false}
                    maxLength={6}
                    accessibilityLabel="Pairing code"
                    style={{
                      marginTop: space.lg,
                      borderWidth: 1,
                      borderColor: code.length === 6 ? color.accentLine : color.line,
                      borderRadius: radius.md,
                      backgroundColor: color.surface,
                      color: color.ink,
                      fontFamily: font.mono,
                      fontSize: 22,
                      letterSpacing: 8,
                      textAlign: 'center',
                      paddingVertical: space.md,
                    }}
                  />
                  <Button
                    label="Pair"
                    variant="primary"
                    busy={busy}
                    disabled={code.length !== 6}
                    style={{ marginTop: space.md }}
                    onPress={() => run(() => signInPairing(code))}
                  />
                </>
              )}

              {error ? (
                <View
                  style={{
                    marginTop: space.lg,
                    borderLeftWidth: 2,
                    borderLeftColor: color.negative,
                    paddingLeft: space.md,
                  }}
                >
                  <Txt size="small" weight="muted">
                    {error}
                  </Txt>
                </View>
              ) : null}

              {accountAuthAvailable ? (
                <>
                  <Divider subtle style={{ marginVertical: space.xl }} />
                  <Button
                    label={mode === 'account' ? 'Use a pairing code instead' : 'Sign in with an account'}
                    variant="ghost"
                    onPress={() => {
                      setError(null);
                      setMode(mode === 'account' ? 'pairing' : 'account');
                    }}
                  />
                </>
              ) : null}
            </View>
          )}
        </View>

        {mode === 'pairing' && configured ? (
          <View style={{ paddingHorizontal: space.xxl, paddingBottom: space.lg }}>
            <Mono size="micro" weight="faint" style={{ lineHeight: type.micro.lineHeight }}>
              Pairing mode is for local development. The code is the only identity — anyone with it
              reaches the same desktop. Sign in with an account for real use.
            </Mono>
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
