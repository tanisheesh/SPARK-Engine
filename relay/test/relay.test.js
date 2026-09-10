/* Relay tests. No test framework: this is one file with a handful of asserts,
   and adding jest to a service with one dependency would be the larger cost.
   Run with `npm test` from relay/.

   Everything here talks to a real relay process over a real socket. The engine
   side is simulated with a raw ws client rather than importing the Electron
   app, so this suite stands alone if /relay is ever split into its own repo. */

const { spawn } = require('child_process');
const path = require('path');
const WebSocket = require('ws');

const proto = require('../protocol');

const PORT = Number(process.env.TEST_PORT || 8799);
const URL = `ws://127.0.0.1:${PORT}/session`;

let passed = 0;
let failed = 0;

function check(name, condition, detail) {
  if (condition) {
    passed++;
    console.log('  PASS  ' + name);
  } else {
    failed++;
    console.log('  FAIL  ' + name + (detail !== undefined ? '  -> ' + JSON.stringify(detail) : ''));
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* A socket that buffers every frame, so a test can await a frame that already
   arrived. Without this, two frames sent back to back race the listener. */
function open(role, token, deviceName) {
  const ws = new WebSocket(URL);
  ws.frames = [];
  ws.on('message', (raw) => {
    try {
      ws.frames.push(JSON.parse(raw.toString()));
    } catch {
      /* ignore */
    }
  });
  ws.waitFor = (type, ms = 5000) => {
    const deadline = Date.now() + ms;
    return new Promise((resolve, reject) => {
      (function poll() {
        const i = ws.frames.findIndex((f) => f.t === type);
        if (i !== -1) return resolve(ws.frames.splice(i, 1)[0]);
        if (Date.now() > deadline) return reject(new Error('timeout waiting for ' + type));
        setTimeout(poll, 10);
      })();
    });
  };
  ws.json = (obj) => ws.send(JSON.stringify(obj));
  ws.ready = new Promise((resolve) => ws.on('open', resolve)).then(() => {
    ws.json({ t: proto.T.AUTH, v: proto.PROTOCOL_VERSION, role, token, deviceName });
    return ws;
  });
  return ws;
}

async function main() {
  const relay = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], {
    env: { ...process.env, PORT: String(PORT), HOST: '127.0.0.1', SPARK_RELAY_MODE: 'dev' },
    stdio: ['ignore', 'ignore', 'inherit'],
  });
  await sleep(800);

  try {
    /* ---- health ---- */
    const health = await fetch(`http://127.0.0.1:${PORT}/health`).then((r) => r.json());
    check('health reports the protocol version', health.v === proto.PROTOCOL_VERSION, health);

    /* ---- version negotiation ---- */
    const old = new WebSocket(URL);
    old.frames = [];
    old.on('message', (raw) => old.frames.push(JSON.parse(raw.toString())));
    await new Promise((r) => old.on('open', r));
    old.send(JSON.stringify({ t: proto.T.AUTH, v: 99, role: proto.ROLE.CLIENT, token: 'dev:AAAAAA' }));
    await sleep(200);
    check(
      'protocol mismatch is refused with both versions named',
      old.frames.some((f) => f.t === proto.T.AUTH_ERR && /v1/.test(f.message) && /v99/.test(f.message)),
      old.frames
    );
    old.close();

    /* ---- bad pairing code ---- */
    const bad = new WebSocket(URL);
    bad.frames = [];
    bad.on('message', (raw) => bad.frames.push(JSON.parse(raw.toString())));
    await new Promise((r) => bad.on('open', r));
    bad.send(JSON.stringify({ t: proto.T.AUTH, v: 1, role: proto.ROLE.CLIENT, token: 'dev:xy' }));
    await sleep(200);
    check(
      'a malformed pairing code is rejected',
      bad.frames.some((f) => f.t === proto.T.AUTH_ERR),
      bad.frames
    );
    bad.close();

    /* ---- nothing routes before auth ---- */
    const silent = new WebSocket(URL);
    silent.frames = [];
    silent.on('message', (raw) => silent.frames.push(JSON.parse(raw.toString())));
    await new Promise((r) => silent.on('open', r));
    silent.send(JSON.stringify({ t: proto.T.RPC, id: 'x', method: proto.METHOD.CONVERSATIONS_LIST }));
    await sleep(200);
    check('an unauthenticated socket gets no reply at all', silent.frames.length === 0, silent.frames);
    silent.close();

    /* ---- engine + client in one room ---- */
    const engine = open(proto.ROLE.ENGINE, 'dev:ROOM01', 'Desktop');
    await engine.ready;
    await engine.waitFor(proto.T.AUTH_OK);

    const client = open(proto.ROLE.CLIENT, 'dev:ROOM01', 'Phone');
    await client.ready;
    const authOk = await client.waitFor(proto.T.AUTH_OK);
    check('client sees the engine as online on connect', authOk.engineOnline === true, authOk);

    /* ---- rpc round trip ---- */
    client.json({ t: proto.T.RPC, id: 'r1', method: proto.METHOD.QUERY_RUN, params: { q: 1 } });
    const relayed = await engine.waitFor(proto.T.RPC);
    check('rpc reaches the engine with a return address', relayed.id === 'r1' && Boolean(relayed.from), relayed);

    engine.json({ t: proto.T.RPC_RESULT, to: relayed.from, id: 'r1', result: { ok: true } });
    const result = await client.waitFor(proto.T.RPC_RESULT);
    check('result routes back to the calling phone', result.result.ok === true, result);

    /* ---- events ---- */
    engine.json({
      t: proto.T.EVENT,
      to: relayed.from,
      event: proto.EVENT.QUERY_PROGRESS,
      data: { stage: 'execute' },
    });
    const evt = await client.waitFor(proto.T.EVENT);
    check('progress events reach the phone', evt.data.stage === 'execute', evt);

    /* ---- CROSS-USER ISOLATION ---- */
    const intruder = open(proto.ROLE.CLIENT, 'dev:ROOM02', 'Intruder');
    await intruder.ready;
    await intruder.waitFor(proto.T.AUTH_OK);

    intruder.json({ t: proto.T.RPC, id: 'i1', method: proto.METHOD.CONVERSATIONS_LIST });
    const denied = await intruder.waitFor(proto.T.RPC_ERROR);
    check(
      'a phone in another room cannot reach this engine',
      denied.error.code === proto.ERR.ENGINE_OFFLINE,
      denied
    );

    // Forge the fields the relay would need to trust in order to leak.
    const engineFramesBefore = engine.frames.length;
    intruder.json({
      t: proto.T.RPC,
      id: 'i2',
      method: proto.METHOD.CONVERSATIONS_LIST,
      userId: 'dev:ROOM01',
      room: 'dev:ROOM01',
      to: relayed.from,
    });
    await sleep(300);
    check(
      'forged userId/room/to fields do not cross rooms',
      engine.frames.length === engineFramesBefore,
      { before: engineFramesBefore, after: engine.frames.length }
    );

    // An engine trying to address a phone outside its own room.
    const intruderFramesBefore = intruder.frames.length;
    engine.json({ t: proto.T.RPC_RESULT, to: '9999', id: 'i2', result: { leaked: true } });
    await sleep(200);
    check(
      'an engine cannot address a phone in another room',
      intruder.frames.length === intruderFramesBefore,
      intruder.frames
    );
    intruder.close();

    /* ---- presence on engine loss ---- */
    engine.close();
    const presence = await client.waitFor(proto.T.PRESENCE);
    check('phone is told when the engine disconnects', presence.engineOnline === false, presence);

    client.json({ t: proto.T.RPC, id: 'r2', method: proto.METHOD.QUERY_RUN, params: {} });
    const offline = await client.waitFor(proto.T.RPC_ERROR);
    check(
      'queries with no engine fail explicitly, never silently',
      offline.error.code === proto.ERR.ENGINE_OFFLINE,
      offline
    );

    /* ---- one engine per room ---- */
    const first = open(proto.ROLE.ENGINE, 'dev:ROOM03', 'Desktop A');
    await first.ready;
    await first.waitFor(proto.T.AUTH_OK);
    const second = open(proto.ROLE.ENGINE, 'dev:ROOM03', 'Desktop B');
    await second.ready;
    await second.waitFor(proto.T.AUTH_OK);
    const replaced = await first.waitFor(proto.T.AUTH_ERR, 3000).catch(() => null);
    check('a second desktop replaces the first rather than racing it', replaced !== null, replaced);
    first.close();
    second.close();
    client.close();

    /* ---- cognito mode refuses pairing codes ---- */
    relay.kill();
    await sleep(300);
    const strict = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], {
      env: {
        ...process.env,
        PORT: String(PORT + 1),
        HOST: '127.0.0.1',
        SPARK_RELAY_MODE: 'cognito',
        COGNITO_USER_POOL_ID: 'ap-south-1_test',
      },
      stdio: ['ignore', 'ignore', 'inherit'],
    });
    await sleep(800);
    const strictWs = new WebSocket(`ws://127.0.0.1:${PORT + 1}/session`);
    strictWs.frames = [];
    strictWs.on('message', (raw) => strictWs.frames.push(JSON.parse(raw.toString())));
    await new Promise((r) => strictWs.on('open', r));
    strictWs.send(
      JSON.stringify({ t: proto.T.AUTH, v: 1, role: proto.ROLE.CLIENT, token: 'dev:ROOM01' })
    );
    await sleep(400);
    check(
      'a production relay refuses dev pairing codes',
      strictWs.frames.some((f) => f.t === proto.T.AUTH_ERR && /Cognito/.test(f.message)),
      strictWs.frames
    );
    strictWs.close();
    strict.kill();
  } finally {
    relay.kill();
  }

  console.log(`\n=== ${passed} passed, ${failed} failed ===`);
  process.exit(failed ? 1 : 0);
}

main().catch((error) => {
  console.error('HARNESS ERROR:', error);
  process.exit(1);
});
