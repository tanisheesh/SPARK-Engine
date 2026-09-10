/* SPARK remote-session wire protocol - RELAY COPY.
 *
 * Kept byte-identical to electron/remote/protocol.js on purpose. The relay is
 * meant to be deployable on its own (Render, Fly, a small EC2 box) without
 * dragging the Electron app along, so it carries its own copy rather than
 * reaching up into the desktop tree. PROTOCOL_VERSION catches drift.
 *
 * Three parties speak this: the desktop engine (electron/remote/), the relay
 * (relay/server.js) and the phone (mobile/src/protocol.ts). The mobile copy is
 * a hand-kept TypeScript mirror of this file - deliberately duplicated so
 * /mobile can be lifted into its own repository without a shared package.
 * PROTOCOL_VERSION is what stops the copies drifting silently: a mismatch is
 * refused at connect time with a message naming both versions.
 *
 * Transport shape
 * ---------------
 * Every frame is JSON `{ t: <type>, ... }`.
 *
 * Both the desktop and the phone dial OUT to the relay over wss. Neither ever
 * listens on a port. The relay authenticates each side, learns which Cognito
 * `sub` it belongs to, and will only ever copy frames between sockets sharing
 * that same `sub`. Cross-user access is therefore structurally impossible
 * rather than policy-enforced: there is no code path that looks up an engine
 * by anything other than the caller's own verified subject.
 *
 * The relay is stateless with respect to user data. It holds sockets and
 * copies bytes. No question, answer, row or dataset name is persisted by it.
 */

const PROTOCOL_VERSION = 1;

/* ---------- roles ---------- */

const ROLE = {
  ENGINE: 'engine', // the desktop app - runs the real pipeline
  CLIENT: 'client'  // the phone - asks questions, renders answers
};

/* ---------- transport frames (party <-> relay) ---------- */

const T = {
  // client/engine -> relay, first frame on every connection
  AUTH: 'auth',            // { v, role, token, deviceName }
  AUTH_OK: 'auth-ok',      // { userId, connectionId, role, engineOnline? }
  AUTH_ERR: 'auth-err',    // { message } then close

  // relay -> client, whenever the engine's availability changes
  PRESENCE: 'presence',    // { engineOnline, engineName? }

  // client -> engine (routed), a request expecting exactly one reply
  RPC: 'rpc',              // { id, method, params }  (+ `from` when relayed)
  RPC_RESULT: 'rpc-result',// { id, result }          (+ `to` when engine sends)
  RPC_ERROR: 'rpc-error',  // { id, error: { code, message } } (+ `to`)

  // engine -> client (routed), fire-and-forget progress
  EVENT: 'event',          // { event, data }         (+ `to` when engine sends)

  PING: 'ping',
  PONG: 'pong'
};

/* ---------- application methods (client -> engine) ---------- */

const METHOD = {
  // -> { conversations: ConversationSummary[], source, desktopName }
  CONVERSATIONS_LIST: 'conversations.list',
  // { conversationId } -> { conversation: Conversation }
  CONVERSATION_GET: 'conversation.get',
  // { conversationId? , question, turnId, deviceName } -> { conversationId, turn }
  QUERY_RUN: 'query.run',
  // { turnId } -> {} - best effort, the pipeline itself is not interruptible
  QUERY_CANCEL: 'query.cancel'
};

/* ---------- events (engine -> client) ---------- */

const EVENT = {
  // { turnId, stage, message } - stage is a TraceStage from lib/spark/types.ts.
  // These are the desktop's own pipeline stages, forwarded verbatim. The phone
  // never invents a stage or a percentage.
  QUERY_PROGRESS: 'query.progress',
  // { conversationId } - the engine's conversation set changed
  CONVERSATIONS_CHANGED: 'conversations.changed'
};

/* ---------- error codes the phone branches on ---------- */

const ERR = {
  UNAUTHORIZED: 'unauthorized',
  VERSION_MISMATCH: 'version_mismatch',
  ENGINE_OFFLINE: 'engine_offline',
  NOT_FOUND: 'not_found',
  NO_SOURCE: 'no_source',
  BUSY: 'busy',
  QUERY_FAILED: 'query_failed',
  BAD_REQUEST: 'bad_request',
  TIMEOUT: 'timeout'
};

/* ---------- close codes (4xxx is the RFC 6455 private range) ---------- */

const CLOSE = {
  AUTH_FAILED: 4001,
  VERSION_MISMATCH: 4002,
  REPLACED: 4003,     // same role reconnected; the older socket loses
  SHUTTING_DOWN: 4004
};

/* ---------- limits ---------- */

// A question, not a payload. The engine's answers are capped separately by
// trimming rows before they ever reach the relay.
const MAX_FRAME_BYTES = 256 * 1024;

// Rows the engine will forward to a phone. The desktop pipeline already caps
// its own return at 100; this is the mobile-side promise that a phone is never
// sent a dataset. "View full result on desktop" covers the rest.
const MAX_ROWS_TO_PHONE = 20;

// One question in flight per phone. The desktop pipeline is not built for
// concurrent callers and a phone on flaky mobile data retrying a question must
// not be able to stack work on it.
const MAX_INFLIGHT_PER_CLIENT = 1;

// How long the phone waits for an engine reply before calling it a timeout.
// Generous: a cold local-model fallback on a laptop can genuinely take a while.
const RPC_TIMEOUT_MS = 120000;

const HEARTBEAT_MS = 30000;

module.exports = {
  PROTOCOL_VERSION,
  ROLE,
  T,
  METHOD,
  EVENT,
  ERR,
  CLOSE,
  MAX_FRAME_BYTES,
  MAX_ROWS_TO_PHONE,
  MAX_INFLIGHT_PER_CLIENT,
  RPC_TIMEOUT_MS,
  HEARTBEAT_MS
};
