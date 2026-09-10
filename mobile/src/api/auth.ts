/* Authentication.
 *
 * Account mode is the same Cognito user pool the desktop uses (lib/auth.ts):
 * Hosted UI, Authorization Code + PKCE, public client. The only difference is
 * the redirect - the desktop registers `spark-engine://auth/callback`, the
 * phone registers `sparkmobile://auth/callback` - which is why this needs its
 * own app client in the pool rather than reusing the desktop's.
 *
 * Pairing mode is a development fallback for demonstrating the query loop
 * before that app client exists. It is not authentication: the code IS the
 * identity, and the relay only accepts it when started in dev mode. The UI
 * says so plainly rather than dressing it up as a sign-in.
 */

import * as AuthSession from 'expo-auth-session';

import {
  AUTH_REDIRECT_SCHEME,
  COGNITO_CLIENT_ID,
  COGNITO_DOMAIN,
} from '../config';
import { saveSession, type StoredSession } from './storage';

const discovery = (): AuthSession.DiscoveryDocument => ({
  authorizationEndpoint: `${COGNITO_DOMAIN}/oauth2/authorize`,
  tokenEndpoint: `${COGNITO_DOMAIN}/oauth2/token`,
  revocationEndpoint: `${COGNITO_DOMAIN}/oauth2/revoke`,
});

export function redirectUri(): string {
  // In Expo Go this yields an exp:// proxy URL; in a standalone build it is the
  // custom scheme. Both must be registered as callback URLs on the app client
  // or Cognito rejects the request before the user sees a login form.
  return AuthSession.makeRedirectUri({ scheme: AUTH_REDIRECT_SCHEME, path: 'auth/callback' });
}

/** Decodes the `sub` and `email` out of an ID token without verifying it.
    Safe here and only here: the token is used purely to label the UI, and the
    RELAY verifies the signature before it will route anything. The phone
    trusting its own token buys an attacker nothing - they would be forging a
    claim about themselves that the relay independently rejects. */
export function decodeIdToken(idToken: string): { userId?: string; email?: string } {
  try {
    const payload = idToken.split('.')[1];
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
    const json = JSON.parse(globalThis.atob(padded));
    return { userId: json.sub, email: json.email };
  } catch {
    return {};
  }
}

export interface SignInResult {
  session: StoredSession;
}

/** Runs the full Hosted UI + PKCE exchange. Throws with a message fit for
    display; the caller shows it on the auth screen. */
export async function signInWithAccount(): Promise<SignInResult> {
  if (!COGNITO_DOMAIN || !COGNITO_CLIENT_ID) {
    throw new Error('Account sign-in is not configured in this build.');
  }

  const uri = redirectUri();
  const request = await AuthSession.loadAsync(
    {
      clientId: COGNITO_CLIENT_ID,
      redirectUri: uri,
      responseType: AuthSession.ResponseType.Code,
      scopes: ['openid', 'email', 'profile'],
      usePKCE: true,
    },
    discovery()
  );

  const result = await request.promptAsync(discovery());

  if (result.type === 'dismiss' || result.type === 'cancel') {
    throw new Error('Sign-in was cancelled.');
  }
  if (result.type !== 'success' || !result.params.code) {
    const description = (result as any)?.params?.error_description;
    throw new Error(description || 'Sign-in did not complete.');
  }

  const tokens = await AuthSession.exchangeCodeAsync(
    {
      clientId: COGNITO_CLIENT_ID,
      code: result.params.code,
      redirectUri: uri,
      extraParams: request.codeVerifier ? { code_verifier: request.codeVerifier } : undefined,
    },
    discovery()
  );

  if (!tokens.idToken) {
    throw new Error('Cognito returned no ID token. Check the app client scopes.');
  }

  const claims = decodeIdToken(tokens.idToken);
  const session: StoredSession = {
    mode: 'account',
    token: tokens.idToken,
    refreshToken: tokens.refreshToken ?? undefined,
    expiresAt: tokens.expiresIn ? Date.now() + tokens.expiresIn * 1000 : undefined,
    email: claims.email,
    userId: claims.userId,
  };
  await saveSession(session);
  return { session };
}

/** Cognito ID tokens last an hour. Called on launch and on resume so a phone
    left in a pocket overnight reconnects without a visible sign-in. Returns
    null when the refresh token is gone or rejected, which means "sign in
    again" rather than an error to display. */
export async function refreshAccountSession(
  session: StoredSession
): Promise<StoredSession | null> {
  if (session.mode !== 'account' || !session.refreshToken) return null;
  try {
    const tokens = await AuthSession.refreshAsync(
      { clientId: COGNITO_CLIENT_ID, refreshToken: session.refreshToken },
      discovery()
    );
    if (!tokens.idToken) return null;
    const claims = decodeIdToken(tokens.idToken);
    const next: StoredSession = {
      mode: 'account',
      token: tokens.idToken,
      // Cognito does not always rotate the refresh token; keep the old one.
      refreshToken: tokens.refreshToken ?? session.refreshToken,
      expiresAt: tokens.expiresIn ? Date.now() + tokens.expiresIn * 1000 : undefined,
      email: claims.email ?? session.email,
      userId: claims.userId ?? session.userId,
    };
    await saveSession(next);
    return next;
  } catch {
    return null;
  }
}

/** True when the stored token is close enough to expiry that it should be
    refreshed before being used to open a socket. */
export function needsRefresh(session: StoredSession): boolean {
  if (session.mode !== 'account' || !session.expiresAt) return false;
  return Date.now() > session.expiresAt - 120000;
}

/** Pairing mode. The code is normalised so "k7x2m9" and "K7X2M9" pair. */
export async function signInWithPairingCode(code: string): Promise<SignInResult> {
  const normalized = code.trim().toUpperCase();
  if (!/^[A-Z0-9]{6}$/.test(normalized)) {
    throw new Error('A pairing code is 6 letters or digits.');
  }
  const session: StoredSession = { mode: 'pairing', token: `dev:${normalized}` };
  await saveSession(session);
  return { session };
}
