/* SPARK remote-session wire protocol - MOBILE COPY.
 *
 * A hand-kept TypeScript mirror of electron/remote/protocol.js. Duplicated on
 * purpose: /mobile must be liftable into its own repository without a shared
 * package, so it reaches up into ../ for nothing at all.
 *
 * PROTOCOL_VERSION is the guard against the copies drifting. The relay refuses
 * a mismatched version at connect time and names both numbers, so drift shows
 * up as a clear message on first launch rather than as a subtly wrong payload
 * three screens later.
 */

export const PROTOCOL_VERSION = 1;

export const ROLE = {
  ENGINE: 'engine',
  CLIENT: 'client',
} as const;

export const T = {
  AUTH: 'auth',
  AUTH_OK: 'auth-ok',
  AUTH_ERR: 'auth-err',
  PRESENCE: 'presence',
  RPC: 'rpc',
  RPC_RESULT: 'rpc-result',
  RPC_ERROR: 'rpc-error',
  EVENT: 'event',
  PING: 'ping',
  PONG: 'pong',
} as const;

export const METHOD = {
  CONVERSATIONS_LIST: 'conversations.list',
  CONVERSATION_GET: 'conversation.get',
  QUERY_RUN: 'query.run',
  QUERY_CANCEL: 'query.cancel',
} as const;

export const EVENT = {
  QUERY_PROGRESS: 'query.progress',
  CONVERSATIONS_CHANGED: 'conversations.changed',
} as const;

export const ERR = {
  UNAUTHORIZED: 'unauthorized',
  VERSION_MISMATCH: 'version_mismatch',
  ENGINE_OFFLINE: 'engine_offline',
  NOT_FOUND: 'not_found',
  NO_SOURCE: 'no_source',
  BUSY: 'busy',
  QUERY_FAILED: 'query_failed',
  BAD_REQUEST: 'bad_request',
  TIMEOUT: 'timeout',
} as const;

export const RPC_TIMEOUT_MS = 120000;
export const MAX_ROWS_TO_PHONE = 20;

export type ErrCode = (typeof ERR)[keyof typeof ERR];

export interface RpcError {
  code: ErrCode;
  message: string;
}

/** Turns a protocol error into something a person can act on. The raw
    `message` from the engine is preferred where it is already specific;
    these cover the codes where it is not. */
export function explainError(error: RpcError | null | undefined): string {
  if (!error) return 'Something went wrong.';
  switch (error.code) {
    case ERR.ENGINE_OFFLINE:
      return 'SPARK Desktop is not connected.';
    case ERR.NO_SOURCE:
      return 'No dataset is connected on the desktop.';
    case ERR.BUSY:
      return 'The desktop is still working on your last question.';
    case ERR.UNAUTHORIZED:
      return error.message || 'Sign in again to continue.';
    case ERR.TIMEOUT:
      return 'The desktop did not answer in time.';
    default:
      return error.message || 'Something went wrong.';
  }
}
