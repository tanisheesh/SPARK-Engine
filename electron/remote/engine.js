/* The desktop half of the remote session.
 *
 * Dials OUT to the relay and answers RPCs from the user's own phone. There is
 * no listening socket anywhere in this file, and that is the security posture:
 * nothing about the desktop - not DuckDB, not the uploads folder, not the
 * Electron IPC surface, not a port - is reachable from the network. The only
 * thing that crosses is a natural-language question in and a trimmed answer
 * out, over a connection this process opened itself.
 *
 * Everything the desktop can actually do arrives through `handlers`, injected
 * by electron/remote/index.js. That keeps this file free of Electron imports
 * and testable headlessly against a real relay.
 */

const WebSocket = require('ws');
const os = require('os');

const proto = require('./protocol');
const conversations = require('./conversations');

const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 30000;

let ws = null;
let config = null;      // { relayUrl, token, deviceName }
let handlers = {};
let onStatus = () => {};

let state = 'idle';     // idle | connecting | online | retrying | error
let lastError = null;
let reconnectTimer = null;
let attempt = 0;
let manualStop = false;
let heartbeat = null;

// One question at a time, per protocol. Keyed by the phone's turn id.
const inflight = new Map();

/* ---------- status ---------- */

function status() {
  return {
    state,
    relayUrl: config ? config.relayUrl : null,
    deviceName: config ? config.deviceName : null,
    mode: config && config.token && config.token.startsWith('dev:') ? 'pairing' : 'account',
    pairingCode: config && config.token && config.token.startsWith('dev:')
      ? config.token.slice(4)
      : null,
    lastError,
    busy: inflight.size > 0
  };
}

function setState(next, error) {
  state = next;
  lastError = error || null;
  try {
    onStatus(status());
  } catch (e) {
    console.error('remote status listener threw:', e.message);
  }
}

/* ---------- framing ---------- */

function send(type, payload) {
  if (!ws || ws.readyState !== WebSocket.OPEN) return false;
  try {
    ws.send(JSON.stringify(Object.assign({ t: type }, payload || {})));
    return true;
  } catch (error) {
    console.error('remote: send failed', type, error.message);
    return false;
  }
}

function reply(to, id, result) {
  send(proto.T.RPC_RESULT, { to, id, result });
}

function replyError(to, id, code, message) {
  send(proto.T.RPC_ERROR, { to, id, error: { code, message } });
}

/* ---------- connection ---------- */

function connect(options) {
  disconnect({ silent: true });
  manualStop = false;
  config = {
    relayUrl: options.relayUrl,
    token: options.token,
    deviceName: options.deviceName || os.hostname()
  };
  attempt = 0;
  open();
  return status();
}

function open() {
  setState('connecting');

  try {
    ws = new WebSocket(config.relayUrl, { handshakeTimeout: 15000 });
  } catch (error) {
    return scheduleReconnect(`Could not open ${config.relayUrl}: ${error.message}`);
  }

  ws.on('open', () => {
    send(proto.T.AUTH, {
      v: proto.PROTOCOL_VERSION,
      role: proto.ROLE.ENGINE,
      token: config.token,
      deviceName: config.deviceName
    });
  });

  ws.on('message', (raw) => {
    let frame;
    try {
      frame = JSON.parse(raw.toString('utf8'));
    } catch {
      return;
    }
    handleFrame(frame);
  });

  ws.on('close', (code, reasonBuf) => {
    const reason = reasonBuf ? reasonBuf.toString() : '';
    stopHeartbeat();
    if (manualStop) return setState('idle');

    // Auth and version failures will fail identically forever, so retrying
    // just burns battery and fills the log. Surface them and stop.
    if (code === proto.CLOSE.AUTH_FAILED || code === proto.CLOSE.VERSION_MISMATCH) {
      return setState('error', lastError || `Relay refused the connection (${reason || code})`);
    }
    if (code === proto.CLOSE.REPLACED) {
      return setState('error', 'Another SPARK Desktop connected for this account');
    }
    scheduleReconnect(lastError || 'Connection to the relay closed');
  });

  ws.on('error', (error) => {
    // 'close' always follows, which is where the retry decision is made.
    lastError = error.message;
  });

  ws.on('pong', () => { /* liveness only */ });
}

function scheduleReconnect(message) {
  if (manualStop) return;
  attempt += 1;
  // Exponential backoff with jitter: a relay restart must not be met with
  // every desktop in the world reconnecting on the same tick.
  const base = Math.min(RECONNECT_BASE_MS * 2 ** (attempt - 1), RECONNECT_MAX_MS);
  const delay = Math.round(base * (0.7 + Math.random() * 0.6));
  setState('retrying', message);
  clearTimeout(reconnectTimer);
  reconnectTimer = setTimeout(open, delay);
}

function startHeartbeat() {
  stopHeartbeat();
  heartbeat = setInterval(() => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      try { ws.ping(); } catch { /* closing anyway */ }
    }
  }, proto.HEARTBEAT_MS);
}

function stopHeartbeat() {
  clearInterval(heartbeat);
  heartbeat = null;
}

function disconnect(options) {
  manualStop = true;
  clearTimeout(reconnectTimer);
  stopHeartbeat();
  if (ws) {
    try { ws.close(1000, 'disconnect'); } catch { /* already gone */ }
    ws = null;
  }
  inflight.clear();
  if (!options || !options.silent) setState('idle');
  return status();
}

/* ---------- frame handling ---------- */

function handleFrame(frame) {
  switch (frame.t) {
    case proto.T.AUTH_OK:
      attempt = 0;
      startHeartbeat();
      return setState('online');

    case proto.T.AUTH_ERR:
      lastError = frame.message || 'Relay rejected the connection';
      return; // the close handler decides whether to retry

    case proto.T.RPC:
      return void dispatch(frame).catch((error) => {
        console.error('remote rpc threw:', error);
        replyError(frame.from, frame.id, proto.ERR.QUERY_FAILED, error.message);
      });

    default:
      return;
  }
}

async function dispatch(frame) {
  const { id, from, method, params } = frame;
  const args = params || {};

  switch (method) {
    case proto.METHOD.CONVERSATIONS_LIST:
      return reply(from, id, {
        conversations: conversations.summaries(),
        source: handlers.getActiveSource(),
        desktopName: config.deviceName
      });

    case proto.METHOD.CONVERSATION_GET: {
      const convo = conversations.get(args.conversationId);
      if (!convo) {
        return replyError(from, id, proto.ERR.NOT_FOUND, 'That conversation is not on this desktop');
      }
      return reply(from, id, { conversation: trimForPhone(convo) });
    }

    case proto.METHOD.QUERY_RUN:
      return runQuery(from, id, args);

    case proto.METHOD.QUERY_CANCEL: {
      const entry = inflight.get(args.turnId);
      if (entry) entry.cancelled = true;
      return reply(from, id, {});
    }

    default:
      return replyError(from, id, proto.ERR.BAD_REQUEST, `Unknown method: ${method}`);
  }
}

/* Rows are the expensive part of a result and the phone only ever shows a
   preview, so the full set never crosses the wire. `totalRows` is preserved
   so the phone can say "20 of 4,182" honestly rather than implying it has
   everything. */
function trimRows(rows) {
  if (!Array.isArray(rows)) return [];
  return rows.slice(0, proto.MAX_ROWS_TO_PHONE);
}

function trimForPhone(convo) {
  return Object.assign({}, convo, {
    turns: (convo.turns || []).map(turn => Object.assign({}, turn, {
      rows: trimRows(turn.rows),
      // The desktop keeps the full trace; the phone shows stage names only.
      trace: undefined
    }))
  });
}

async function runQuery(from, id, args) {
  const question = typeof args.question === 'string' ? args.question.trim() : '';
  const turnId = args.turnId;

  if (!question || !turnId) {
    return replyError(from, id, proto.ERR.BAD_REQUEST, 'A query needs a question and a turnId');
  }
  if (inflight.size >= proto.MAX_INFLIGHT_PER_CLIENT) {
    return replyError(from, id, proto.ERR.BUSY, 'SPARK Desktop is still working on your last question');
  }

  const source = handlers.getActiveSource();
  if (!source) {
    return replyError(from, id, proto.ERR.NO_SOURCE,
      'No dataset is connected on the desktop. Connect one in SPARK Desktop first.');
  }

  // Resolve or create the conversation up front so the QUESTION is durable even
  // if the pipeline fails, the desktop is closed mid-query, or the phone drops
  // off Wi-Fi. A question that vanishes because the answer failed is worse than
  // a visible failed turn.
  let conversationId = args.conversationId;
  if (!conversationId || !conversations.get(conversationId)) {
    conversationId = args.conversationId || `m-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    conversations.createConversation({
      id: conversationId,
      title: question.length > 52 ? question.slice(0, 49).trimEnd() + '…' : question,
      source: { type: source.type, name: source.name }
    });
  }

  const now = Date.now();
  const pending = {
    id: turnId,
    question,
    origin: 'mobile',
    originDevice: args.deviceName || 'Phone',
    status: 'thinking',
    createdAt: now,
    trace: []
  };
  conversations.upsertTurn(conversationId, pending);

  const entry = { cancelled: false };
  inflight.set(turnId, entry);

  try {
    const result = await handlers.runQuery({
      question,
      source,
      onProgress: (stage, message) => {
        if (entry.cancelled) return;
        send(proto.T.EVENT, {
          to: from,
          event: proto.EVENT.QUERY_PROGRESS,
          data: { turnId, conversationId, stage, message }
        });
      }
    });

    const completedAt = Date.now();

    if (!result || !result.success) {
      const failed = Object.assign({}, pending, {
        status: 'error',
        completedAt,
        error: (result && result.error) || 'Query failed'
      });
      conversations.upsertTurn(conversationId, failed);
      return replyError(from, id, proto.ERR.QUERY_FAILED, failed.error);
    }

    // The desktop keeps every row; only the phone's copy is trimmed.
    const full = Object.assign({}, pending, {
      status: 'done',
      completedAt,
      answer: result.textResponse,
      sql: result.sqlQuery,
      rows: result.results || [],
      totalRows: result.totalRows != null ? result.totalRows : (result.results || []).length,
      usedLocalFallback: Boolean(result.usedLocalFallback),
      privacy: result.privacy || null
    });
    conversations.upsertTurn(conversationId, full);

    if (entry.cancelled) return; // phone walked away; the desktop keeps the turn

    return reply(from, id, {
      conversationId,
      turn: Object.assign({}, full, { rows: trimRows(full.rows) }),
      source: { type: source.type, name: source.name }
    });
  } catch (error) {
    conversations.upsertTurn(conversationId, Object.assign({}, pending, {
      status: 'error',
      completedAt: Date.now(),
      error: error.message
    }));
    if (!entry.cancelled) replyError(from, id, proto.ERR.QUERY_FAILED, error.message);
  } finally {
    inflight.delete(turnId);
  }
}

/* ---------- wiring ---------- */

function configure(options) {
  handlers = options.handlers || {};
  onStatus = options.onStatus || (() => {});
}

/** Push a conversation-changed hint to every phone. Best effort: if the socket
    is down the phone re-lists when it reconnects anyway. */
function broadcastConversationsChanged(conversationId) {
  // The relay routes engine frames by `to`, and the engine does not track which
  // phones are listening - so this is intentionally a no-op when no phone has
  // spoken yet. Phones poll on focus and reconnect, which covers it.
  void conversationId;
}

module.exports = {
  configure,
  connect,
  disconnect,
  status,
  broadcastConversationsChanged
};
