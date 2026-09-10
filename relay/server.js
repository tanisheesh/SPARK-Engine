/* SPARK remote-session relay.
 *
 * Both the desktop engine and the phone dial OUT to this process. Neither ever
 * opens a listening port of its own, which is the entire reason this exists:
 * remote access without exposing a local port, a local DuckDB file, or an
 * Electron IPC surface to the network.
 *
 * What it does: authenticate each socket, learn its Cognito `sub`, and copy
 * frames between sockets that share that `sub`.
 *
 * What it deliberately does NOT do: store anything. No question, answer, row,
 * dataset name or credential is written to disk or held beyond the lifetime of
 * the socket. If this process is compromised an attacker sees traffic for
 * whoever is connected at that moment, and nothing historical. That is a
 * conscious trade: the alternative - a relay that persists conversations - puts
 * the user's analytical history in a place the user does not control, which is
 * the opposite of what the desktop product promises.
 *
 * Run:
 *   node server.js                 # dev mode (pairing codes, no AWS needed)
 *   SPARK_RELAY_MODE=cognito ...   # production (verifies real ID tokens)
 */

const http = require('http');
const { WebSocketServer } = require('ws');

const proto = require('./protocol');
const { verifyIdToken } = require('./jwt');

const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || '0.0.0.0';
const MODE = process.env.SPARK_RELAY_MODE === 'cognito' ? 'cognito' : 'dev';

const COGNITO = {
  region: process.env.COGNITO_REGION || 'ap-south-1',
  userPoolId: process.env.COGNITO_USER_POOL_ID || '',
  allowedAudiences: [
    process.env.COGNITO_CLIENT_ID_DESKTOP,
    process.env.COGNITO_CLIENT_ID_MOBILE
  ].filter(Boolean)
};

/* ---------- rooms ---------- */

// userId -> { engines: Map<connId, conn>, clients: Map<connId, conn> }
// A "room" is one user. It is created on demand and dropped when empty, so an
// idle relay holds no state at all.
const rooms = new Map();

function roomFor(userId) {
  let room = rooms.get(userId);
  if (!room) {
    room = { engines: new Map(), clients: new Map() };
    rooms.set(userId, room);
  }
  return room;
}

function dropIfEmpty(userId) {
  const room = rooms.get(userId);
  if (room && room.engines.size === 0 && room.clients.size === 0) rooms.delete(userId);
}

let nextConnId = 1;

/* ---------- framing ---------- */

function send(conn, type, payload) {
  if (conn.ws.readyState !== conn.ws.OPEN) return;
  try {
    conn.ws.send(JSON.stringify(Object.assign({ t: type }, payload || {})));
  } catch (error) {
    log('send failed', type, error.message);
  }
}

function log(...args) {
  console.log(new Date().toISOString(), '|', ...args);
}

/* ---------- authentication ---------- */

/* Dev mode trades real identity for a shared pairing code so the query loop can
   be demonstrated before a Cognito mobile app client exists. The code IS the
   identity: everyone presenting `dev:ABC123` lands in the same room. That is
   obviously not access control, which is why it is refused unless the relay was
   started in dev mode, and why the desktop labels it as such in Settings. */
async function authenticate(frame) {
  const token = typeof frame.token === 'string' ? frame.token : '';

  if (token.startsWith('dev:')) {
    if (MODE !== 'dev') {
      throw new Error('This relay only accepts Cognito tokens. Sign in to SPARK on both devices.');
    }
    const code = token.slice(4).trim().toUpperCase();
    if (!/^[A-Z0-9]{6}$/.test(code)) throw new Error('A pairing code is 6 letters or digits');
    return { userId: `dev:${code}`, label: `pairing ${code}`, dev: true };
  }

  if (MODE === 'dev') {
    throw new Error('This relay is in dev mode and expects a pairing code, not a Cognito token');
  }
  if (!COGNITO.userPoolId) {
    throw new Error('Relay is misconfigured: COGNITO_USER_POOL_ID is not set');
  }
  const claims = await verifyIdToken(token, COGNITO);
  return { userId: claims.sub, label: claims.email || claims.sub, dev: false };
}

/* ---------- connection lifecycle ---------- */

function handleConnection(ws) {
  const conn = {
    id: String(nextConnId++),
    ws,
    role: null,
    userId: null,
    deviceName: null,
    alive: true
  };

  ws.on('pong', () => { conn.alive = true; });

  ws.on('message', (raw, isBinary) => {
    if (isBinary || raw.length > proto.MAX_FRAME_BYTES) {
      return send(conn, proto.T.AUTH_ERR, { message: 'Frame rejected' });
    }
    let frame;
    try {
      frame = JSON.parse(raw.toString('utf8'));
    } catch {
      return;
    }
    if (!frame || typeof frame.t !== 'string') return;

    if (!conn.userId) {
      if (frame.t !== proto.T.AUTH) return; // nothing is routed before auth
      return void handleAuth(conn, frame);
    }
    routeFrame(conn, frame);
  });

  ws.on('close', () => {
    if (!conn.userId) return;
    const room = rooms.get(conn.userId);
    if (!room) return;

    if (conn.role === proto.ROLE.ENGINE) {
      room.engines.delete(conn.id);
      // Tell every phone in this room immediately rather than letting them
      // discover it via a two-minute RPC timeout.
      if (room.engines.size === 0) {
        for (const client of room.clients.values()) {
          send(client, proto.T.PRESENCE, { engineOnline: false });
        }
      }
    } else {
      room.clients.delete(conn.id);
    }
    log(`- ${conn.role} ${conn.id} left room ${redact(conn.userId)}`);
    dropIfEmpty(conn.userId);
  });

  ws.on('error', (error) => log('socket error', error.message));
}

async function handleAuth(conn, frame) {
  if (frame.v !== proto.PROTOCOL_VERSION) {
    send(conn, proto.T.AUTH_ERR, {
      code: proto.ERR.VERSION_MISMATCH,
      message: `Relay speaks protocol v${proto.PROTOCOL_VERSION}, this app sent v${frame.v || 'none'}.`
    });
    return conn.ws.close(proto.CLOSE.VERSION_MISMATCH, 'version');
  }
  if (frame.role !== proto.ROLE.ENGINE && frame.role !== proto.ROLE.CLIENT) {
    send(conn, proto.T.AUTH_ERR, { message: 'Unknown role' });
    return conn.ws.close(proto.CLOSE.AUTH_FAILED, 'role');
  }

  let identity;
  try {
    identity = await authenticate(frame);
  } catch (error) {
    send(conn, proto.T.AUTH_ERR, { code: proto.ERR.UNAUTHORIZED, message: error.message });
    return conn.ws.close(proto.CLOSE.AUTH_FAILED, 'auth');
  }

  conn.userId = identity.userId;
  conn.role = frame.role;
  conn.deviceName = String(frame.deviceName || 'Unknown device').slice(0, 60);

  const room = roomFor(conn.userId);

  if (conn.role === proto.ROLE.ENGINE) {
    // One engine per user. A second desktop signing in replaces the first
    // rather than racing it for the same phone's questions.
    for (const existing of room.engines.values()) {
      send(existing, proto.T.AUTH_ERR, { message: 'Another desktop connected for this account' });
      existing.ws.close(proto.CLOSE.REPLACED, 'replaced');
    }
    room.engines.clear();
    room.engines.set(conn.id, conn);
  } else {
    room.clients.set(conn.id, conn);
  }

  const engine = firstEngine(room);
  send(conn, proto.T.AUTH_OK, {
    userId: conn.userId,
    connectionId: conn.id,
    role: conn.role,
    dev: identity.dev,
    engineOnline: Boolean(engine),
    engineName: engine ? engine.deviceName : null
  });

  // An engine arriving unblocks every phone that was staring at an offline state.
  if (conn.role === proto.ROLE.ENGINE) {
    for (const client of room.clients.values()) {
      if (client.id !== conn.id) {
        send(client, proto.T.PRESENCE, { engineOnline: true, engineName: conn.deviceName });
      }
    }
  }

  log(`+ ${conn.role} ${conn.id} "${conn.deviceName}" joined room ${redact(conn.userId)}`);
}

function firstEngine(room) {
  for (const engine of room.engines.values()) return engine;
  return null;
}

// Rooms are keyed by Cognito sub; logging it whole would put a stable user
// identifier in plaintext logs for no operational benefit.
function redact(userId) {
  return userId.startsWith('dev:') ? userId : userId.slice(0, 8) + '…';
}

/* ---------- routing ---------- */

function routeFrame(conn, frame) {
  const room = rooms.get(conn.userId);
  if (!room) return;

  if (frame.t === proto.T.PING) return send(conn, proto.T.PONG, { id: frame.id });

  if (conn.role === proto.ROLE.CLIENT) {
    // Phone -> engine. The engine is looked up ONLY within the caller's own
    // room, so there is no reachable code path from one user to another's
    // desktop even if a client sends a forged userId - it is never read.
    if (frame.t !== proto.T.RPC) return;
    const engine = firstEngine(room);
    if (!engine) {
      return send(conn, proto.T.RPC_ERROR, {
        id: frame.id,
        error: { code: proto.ERR.ENGINE_OFFLINE, message: 'SPARK Desktop is not connected' }
      });
    }
    return send(engine, proto.T.RPC, {
      id: frame.id,
      from: conn.id,
      method: frame.method,
      params: frame.params
    });
  }

  // Engine -> a specific phone. `to` must name a client in this same room.
  const target = frame.to ? room.clients.get(String(frame.to)) : null;
  if (!target) return;

  if (frame.t === proto.T.RPC_RESULT) {
    return send(target, proto.T.RPC_RESULT, { id: frame.id, result: frame.result });
  }
  if (frame.t === proto.T.RPC_ERROR) {
    return send(target, proto.T.RPC_ERROR, { id: frame.id, error: frame.error });
  }
  if (frame.t === proto.T.EVENT) {
    return send(target, proto.T.EVENT, { event: frame.event, data: frame.data });
  }
}

/* ---------- boot ---------- */

const httpServer = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' });
    return res.end(JSON.stringify({
      ok: true,
      service: 'spark-relay',
      v: proto.PROTOCOL_VERSION,
      mode: MODE,
      rooms: rooms.size
    }));
  }
  res.writeHead(404, { 'content-type': 'text/plain' });
  res.end('SPARK relay');
});

const wss = new WebSocketServer({
  server: httpServer,
  path: '/session',
  maxPayload: proto.MAX_FRAME_BYTES
});
wss.on('connection', handleConnection);

const heartbeat = setInterval(() => {
  for (const ws of wss.clients) {
    const conn = [...rooms.values()]
      .flatMap(r => [...r.engines.values(), ...r.clients.values()])
      .find(c => c.ws === ws);
    if (conn && !conn.alive) { ws.terminate(); continue; }
    if (conn) conn.alive = false;
    try { ws.ping(); } catch { /* closing anyway */ }
  }
}, proto.HEARTBEAT_MS);

httpServer.listen(PORT, HOST, () => {
  log(`SPARK relay listening on ${HOST}:${PORT} (protocol v${proto.PROTOCOL_VERSION}, mode: ${MODE})`);
  if (MODE === 'dev') {
    log('DEV MODE - pairing codes are the only identity. Do not expose this to the internet.');
  } else {
    log(`Verifying Cognito ID tokens for pool ${COGNITO.userPoolId || '(unset!)'} in ${COGNITO.region}`);
  }
});

function shutdown() {
  log('shutting down');
  clearInterval(heartbeat);
  for (const ws of wss.clients) {
    try { ws.close(proto.CLOSE.SHUTTING_DOWN, 'shutdown'); } catch { /* ignore */ }
  }
  httpServer.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 2000).unref();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

module.exports = { httpServer, wss };
