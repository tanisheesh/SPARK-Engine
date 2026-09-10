# SPARK Relay

Routes messages between **SPARK Desktop** (the engine) and **SPARK Mobile** (the client).

Both sides dial *out* to this service. Neither opens a listening port. That is the
whole point: the phone can reach the desktop from anywhere without exposing DuckDB,
the uploads folder, an Electron IPC surface, or a local port to the network.

```
phone ──wss──▶  relay  ◀──wss── desktop
                  │
          routes only within one
          verified Cognito subject
```

## What it does not do

It stores nothing. No question, answer, row, dataset name or credential is written
to disk or kept past the life of a socket. Rooms exist only while someone is in them.

That is a deliberate trade. A relay that persisted conversations would put the
user's analytical history somewhere the user does not control — the opposite of
what the desktop product promises. The cost is that the desktop must be running
for a query to work, which the mobile app states plainly rather than hiding.

## Running it

```bash
npm install
npm start          # dev mode, port 8787
npm test           # 15 integration tests against a real socket
```

`GET /health` reports the protocol version and mode. WebSocket path is `/session`.

### Dev mode (default)

Identity is a 6-character pairing code. Everyone presenting `dev:K7X2M9` lands in
the same room.

**This is not access control.** It exists so the query loop can be demonstrated
before a Cognito mobile app client is configured. Keep it on your own network, and
never run it in dev mode on a public address.

### Production mode

```bash
SPARK_RELAY_MODE=cognito \
COGNITO_REGION=ap-south-1 \
COGNITO_USER_POOL_ID=ap-south-1_xxxxxxxxx \
COGNITO_CLIENT_ID_DESKTOP=... \
COGNITO_CLIENT_ID_MOBILE=... \
PORT=8787 npm start
```

Now every connection must present a real Cognito **ID token**, verified against the
pool's published JWKS: signature, issuer, audience, `token_use`, and expiry. The
room key is the token's `sub`, so one user's phone can only ever be routed to that
same user's desktop. Dev pairing codes are refused outright in this mode
(there is a test for it).

Run `infra/aws/06-cognito-mobile.sh` to create the mobile app client and print
these values.

### Deploying

One Node process, one dependency (`ws`), no database, no filesystem writes — it
runs on anything. Terminate TLS in front of it (Render, Fly, Nginx, an ALB) and
point both apps at `wss://your-host/session`.

Because it holds no state, restarting it is safe: both sides reconnect on their
own with exponential backoff.

## Environment

| Variable | Default | Meaning |
|---|---|---|
| `PORT` | `8787` | Listen port |
| `HOST` | `0.0.0.0` | Bind address |
| `SPARK_RELAY_MODE` | `dev` | `dev` (pairing codes) or `cognito` (real tokens) |
| `COGNITO_REGION` | `ap-south-1` | Region of the user pool |
| `COGNITO_USER_POOL_ID` | — | Required in cognito mode |
| `COGNITO_CLIENT_ID_DESKTOP` | — | Accepted audience |
| `COGNITO_CLIENT_ID_MOBILE` | — | Accepted audience |

## Protocol

`protocol.js` is kept identical to `electron/remote/protocol.js`; `mobile/src/protocol.ts`
is the TypeScript mirror. The copies are deliberate so each project can be extracted
on its own. `PROTOCOL_VERSION` is checked at connect time and a mismatch is refused
with both version numbers named, so drift surfaces immediately rather than as a
subtly wrong payload later.
