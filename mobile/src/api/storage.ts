/* Device storage, split by sensitivity.
 *
 * Credentials (the Cognito refresh/ID token, or the pairing code that stands in
 * for one) go to expo-secure-store, which is the Android keystore. They are
 * bearer credentials for the user's data - AsyncStorage is world-readable on a
 * rooted device and is the wrong home for them.
 *
 * The conversation cache goes to AsyncStorage. It is a convenience copy so the
 * list renders instantly and remains readable with the desktop offline, and it
 * holds only what the engine already trimmed for the phone: at most 20 rows per
 * turn, no SQL credentials, no file paths. It is explicitly NOT a dataset - the
 * phone never downloads one.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

import type { ConversationSummary, QueuedQuestion } from '../types';

const KEY_SESSION = 'spark.session.v1';        // secure
const KEY_CONVERSATIONS = 'spark.conversations.cache.v1';
const KEY_QUEUE = 'spark.queue.v1';

export type AuthMode = 'account' | 'pairing';

export interface StoredSession {
  mode: AuthMode;
  /** Cognito ID token in account mode; `dev:CODE` in pairing mode. */
  token: string;
  refreshToken?: string;
  /** epoch ms; absent in pairing mode, which does not expire. */
  expiresAt?: number;
  email?: string;
  userId?: string;
}

/* ---------- session (secure) ---------- */

export async function saveSession(session: StoredSession): Promise<void> {
  await SecureStore.setItemAsync(KEY_SESSION, JSON.stringify(session));
}

export async function loadSession(): Promise<StoredSession | null> {
  try {
    const raw = await SecureStore.getItemAsync(KEY_SESSION);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredSession;
    return parsed && parsed.token ? parsed : null;
  } catch {
    // A keystore read can fail after a restore-from-backup onto a new device.
    // Treat it as signed out rather than crashing the launch.
    return null;
  }
}

export async function clearSession(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(KEY_SESSION);
  } catch {
    /* nothing stored */
  }
}

/* ---------- conversation cache ---------- */

export async function cacheConversations(list: ConversationSummary[]): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY_CONVERSATIONS, JSON.stringify(list.slice(0, 40)));
  } catch {
    /* a full disk must not break the session */
  }
}

export async function loadCachedConversations(): Promise<ConversationSummary[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY_CONVERSATIONS);
    const parsed = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/* ---------- offline queue ---------- */

export async function loadQueue(): Promise<QueuedQuestion[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY_QUEUE);
    const parsed = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function saveQueue(queue: QueuedQuestion[]): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY_QUEUE, JSON.stringify(queue));
  } catch {
    /* ignore */
  }
}

/** Wipes everything this app stored. Used by sign-out, which must not leave a
    previous user's questions readable to the next person holding the phone. */
export async function clearAll(): Promise<void> {
  await clearSession();
  try {
    await AsyncStorage.multiRemove([KEY_CONVERSATIONS, KEY_QUEUE]);
  } catch {
    /* ignore */
  }
}
