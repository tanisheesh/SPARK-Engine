/* Replaces the auth half of lib/supabase.ts. Cognito Hosted UI, Google
   federation, Authorization Code + PKCE (Electron is a public client — it
   can't hold a client secret any more than the Supabase setup could).

   Flow mirrors what LoginScreen already did with Supabase almost exactly:
   1. signInWithGoogle() opens the Hosted UI in the system browser via the
      existing window.electronAPI.openExternal IPC call.
   2. Cognito redirects to spark-engine://auth/callback?code=... — the
      existing deep-link plumbing in electron/main.js + preload.js forwards
      that URL to the renderer unchanged, no Electron-side code to touch.
   3. handleOAuthCallback() exchanges the code for tokens.

   Tokens are kept in localStorage, the same place supabase-js's
   persistSession:true kept its session — no new Electron IPC needed. */

import { COGNITO_DOMAIN, COGNITO_CLIENT_ID, COGNITO_REDIRECT_URI } from './aws-config';

const STORAGE_KEY = 'spark.auth.tokens.v1';
const VERIFIER_KEY = 'spark.auth.pkce_verifier';

export interface SparkUser {
  id: string; // Cognito `sub` — this is the user_id every backend table keys on
  email?: string;
  name?: string;
  avatarUrl?: string;
}

interface StoredTokens {
  idToken: string;
  accessToken: string;
  refreshToken: string;
  /** epoch ms */
  expiresAt: number;
}

/* ---------- PKCE ---------- */

function base64url(bytes: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function randomVerifier(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return base64url(bytes.buffer);
}

async function challengeFor(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return base64url(digest);
}

/* ---------- Token storage ---------- */

function readTokens(): StoredTokens | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StoredTokens) : null;
  } catch {
    return null;
  }
}

function writeTokens(tokens: StoredTokens) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens));
}

function clearTokens() {
  localStorage.removeItem(STORAGE_KEY);
}

function decodeIdToken(idToken: string): SparkUser {
  const payload = JSON.parse(atob(idToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
  return {
    id: payload.sub,
    email: payload.email,
    name: payload.name,
    avatarUrl: payload.picture,
  };
}

/* ---------- Public API ---------- */

export async function signInWithGoogle(): Promise<void> {
  const verifier = randomVerifier();
  sessionStorage.setItem(VERIFIER_KEY, verifier);
  const challenge = await challengeFor(verifier);

  const url = new URL(`${COGNITO_DOMAIN}/oauth2/authorize`);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', COGNITO_CLIENT_ID);
  url.searchParams.set('redirect_uri', COGNITO_REDIRECT_URI);
  url.searchParams.set('scope', 'openid email profile');
  url.searchParams.set('identity_provider', 'Google');
  url.searchParams.set('code_challenge', challenge);
  url.searchParams.set('code_challenge_method', 'S256');

  if (!window.electronAPI?.openExternal) throw new Error('Electron API not available');
  await window.electronAPI.openExternal(url.toString());
}

/** Called with the full spark-engine://auth/callback?code=... URL forwarded
    by the Electron deep-link handler. Exchanges the code for tokens. */
export async function handleOAuthCallback(callbackUrl: string): Promise<SparkUser> {
  const query = callbackUrl.includes('?') ? callbackUrl.split('?')[1] : '';
  const params = new URLSearchParams(query);
  const code = params.get('code');
  const error = params.get('error');
  if (error) throw new Error(params.get('error_description') || error);
  if (!code) throw new Error('No authorization code in callback URL');

  const verifier = sessionStorage.getItem(VERIFIER_KEY);
  if (!verifier) throw new Error('Missing PKCE verifier — sign-in was started in a different session');

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: COGNITO_CLIENT_ID,
    code,
    redirect_uri: COGNITO_REDIRECT_URI,
    code_verifier: verifier,
  });

  const res = await fetch(`${COGNITO_DOMAIN}/oauth2/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!res.ok) throw new Error(`Token exchange failed: ${await res.text()}`);
  const data = await res.json();

  sessionStorage.removeItem(VERIFIER_KEY);
  const tokens: StoredTokens = {
    idToken: data.id_token,
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
  writeTokens(tokens);
  return decodeIdToken(tokens.idToken);
}

/** Never throws — a network failure (offline, DNS blip, VPN reconnect) is
    treated the same as an expired/invalid token: null, meaning "no session,
    show the login screen" rather than leaving callers with an unhandled
    rejection and an app stuck on the loading spinner forever. */
async function refresh(tokens: StoredTokens): Promise<StoredTokens | null> {
  try {
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: COGNITO_CLIENT_ID,
      refresh_token: tokens.refreshToken,
    });
    const res = await fetch(`${COGNITO_DOMAIN}/oauth2/token`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const next: StoredTokens = {
      idToken: data.id_token,
      accessToken: data.access_token,
      refreshToken: data.refresh_token || tokens.refreshToken, // Cognito may not rotate it
      expiresAt: Date.now() + data.expires_in * 1000,
    };
    writeTokens(next);
    return next;
  } catch {
    return null;
  }
}

/** Returns the current user + a valid (refreshed if needed) ID token, or
    null if there is no session — the equivalent of supabase.auth.getSession().
    Never throws (see refresh() above and the catch below), so callers can
    safely .then() without a .catch(). */
export async function getSession(): Promise<{ user: SparkUser; idToken: string } | null> {
  let tokens = readTokens();
  if (!tokens) return null;

  try {
    // Refresh a little before actual expiry so an in-flight API call never
    // races an expiring token.
    if (Date.now() > tokens.expiresAt - 60_000) {
      tokens = await refresh(tokens);
      if (!tokens) {
        clearTokens();
        return null;
      }
    }
    return { user: decodeIdToken(tokens.idToken), idToken: tokens.idToken };
  } catch {
    // Malformed stored token, corrupted JWT, etc. — treat as signed out
    // rather than crash the boot sequence.
    clearTokens();
    return null;
  }
}

export async function signOut(): Promise<void> {
  clearTokens();
}
