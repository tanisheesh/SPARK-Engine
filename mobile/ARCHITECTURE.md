# SPARK Mobile — architecture

Written before the code, kept with it. This records not just what the design is
but which alternatives were rejected and why, because those are the parts that
get re-litigated later.

## Three findings that shaped this

The brief assumed a backend that does not exist. Investigating first changed the
design substantially:

**1. Supabase is gone.** Commit `9ac06b2` replaced it with AWS Cognito, DynamoDB,
Lambda and API Gateway. The remaining `supabase` references are a *data source
type* users can connect to, not the backend. So Supabase Realtime, Postgres and
Edge Functions were never options.

**2. There is no conversation backend at all.** Conversations live in the
renderer's `localStorage` under `spark.conversations.v1`
(`app/app/page.tsx`). They are per-machine and never uploaded. DynamoDB holds only
`subscriptions`, `payments` and `usage`. The cloud is **auth and billing only —
there is no data plane.**

**3. The pipeline is entirely in the Electron main process.**
`ipcMain.handle('process-query')` in `electron/api-handler.js` owns schema
reading, sampling, SQL generation, DuckDB execution, the privacy tokenizer and
the local-model fallback. Nothing outside Electron can reach it.

## The shape

```
ANDROID ──wss──▶ RELAY ◀──wss── DESKTOP (outbound only)
                   │                 │
          routes only within         ▼
          one verified `sub`   process-query → DuckDB / Groq
```

The desktop **dials out**. It never listens. This was the central constraint:
"do not solve remote access by exposing a local port." An inbound port would mean
DuckDB, the uploads directory and the Electron IPC surface sitting behind one
authentication check on a consumer network. An outbound socket means there is
nothing to find and nothing to port-scan.

### Why a relay at all

The phone and the desktop are both behind NAT. Something with a stable address
has to introduce them. The relay is the smallest thing that can: it authenticates
both ends, and copies frames between sockets that share a Cognito `sub`.

It stores **nothing**. No question, answer, row, dataset name or credential
touches disk. Rooms exist only while occupied.

That is a deliberate trade, and it has a real cost: **the desktop must be running.**
A relay that cached conversations would remove that limitation and put the user's
analytical history somewhere they do not control — which is exactly what the
desktop product exists to avoid. The mobile app states the limitation plainly
instead of hiding it.

### Why not AWS API Gateway WebSockets

It was the other serious candidate and fits the existing infra style. It was not
chosen because it cannot be verified from a development machine: every change
needs a deploy before it can be tested, and the connection state has to live in
DynamoDB, which reintroduces exactly the persistence this design is trying not to
have. The standalone relay runs locally, is covered by tests that talk over real
sockets, and deploys to anything.

## Conversation sync

**The desktop is the source of truth. There is no new database.**

The phone fetches conversations from the desktop over the relay and caches them
read-only. A mobile turn is appended by the desktop's main process to
`conversations.json`, then pushed to the renderer, which merges it and saves to
its existing `localStorage`.

The one schema change is additive: turns gain `origin: 'desktop' | 'mobile'` and
`originDevice`.

### Why the merge is union-by-id, not last-writer-wins

Both sides hold a copy, so this needed care. The renderer saves its **whole**
array on nearly every state change. A mobile turn landing between a renderer read
and its next write would be silently erased by a naive overwrite — and that is
the common case, not an edge case.

So `electron/remote/conversations.js` merges:

- conversations union by `id`
- turns union by `id`, ordered by `createdAt`
- when both sides hold the same turn, the **more complete** one wins (finished
  beats in-flight), then the more recent

A finished answer can therefore never be overwritten by a stale "thinking"
record. There is a test for exactly this.

The renderer adopts the merged result, which is what makes the two stores
converge rather than drift.

## Security

| Concern | How it is handled |
|---|---|
| One user reaching another's data | The relay looks up an engine **only** within the caller's own verified `sub`. Forged `userId`, `room` and `to` fields are never read — tested. |
| Credentials on the wire | Cognito ID tokens, verified against the pool's JWKS: signature, `iss`, `aud`, `token_use`, `exp`. |
| Arbitrary SQL from a phone | Impossible: the phone sends **natural language only**. There is no SQL parameter in the protocol. |
| Local port exposure | None. Both sides dial out. |
| DB credentials / file paths | Never leave `electron/secure-store.js` and the main process. Not in any frame. |
| Relay compromise | Sees traffic for whoever is connected at that moment, and nothing historical — it stores nothing. |
| Bearer tokens on the device | `expo-secure-store` (Android keystore), never AsyncStorage. |
| Sign-out | Wipes the keystore entry, the conversation cache and the queue. |

## What the phone deliberately does not do

No dataset download. No DuckDB. No database drivers. No Groq SDK. No charting
library. No copy of the Electron backend. No Studio actions — `Chart`,
`Deep Dive`, `Find Anomalies`, `Forecast`, `Dashboard` and the rest stay on the
desktop, where there is screen space to use them. The phone exposes exactly three
secondary actions: **View data**, **View SQL**, and the chart it draws itself.

Results are capped at 20 rows before they reach the relay. `totalRows` is
preserved so the phone can say "20 of 4,182" honestly rather than implying it has
everything. TTS audio — base64 MP3, often megabytes — is stripped entirely.

## Honest states

Progress labels are the desktop's real pipeline stages, forwarded verbatim:
`schema → sample → sql → execute → format → complete`. The phone renders their
labels and adds one of its own, `Sending`, which is literally what is happening
before the first stage arrives.

There are no percentages, because the backend does not produce any. There is no
optimistic answer: a turn is *running* until the engine returns, then *done* or
*failed*. A queued question is never shown as answered, and is only sent when the
user taps **Send**.

## What changed on the desktop

Additive only:

| File | Change |
|---|---|
| `electron/remote/*` | New: protocol, relay client, conversation mirror, wiring |
| `electron/api-handler.js` | `processQuery()` extracted so the bridge and IPC share one path; optional `onProgress` |
| `electron/main.js` | Four lines: require, `init()`, `setMainWindow`, `shutdown` |
| `electron/preload.js` | Six named remote operations — no socket handle is exposed |
| `app/app/page.tsx` | Sync on save, listener for mobile turns, publishes the active source |
| `components/SettingsModal.tsx` | A Remote access section |
| `package.json` | Declares `ws` (already present transitively) |

Untouched: the DuckDB client, every connector, the entire privacy layer,
secure-store, the Groq and local-LLM clients, Studio, charts, the landing pages,
the billing Lambdas, and the existing infra scripts.

## Footprint

No analytics engine, no chart library, no icon pack, one 6.7 KB logo raster, and
three font files. The dependency list is Expo plus navigation, SVG, secure-store,
auth-session and AsyncStorage — nothing else.

## Extraction

`/mobile` imports nothing from `../`. `src/protocol.ts`, `src/types.ts` and
`src/format.ts` are deliberate copies of desktop concepts rather than shared
modules, so:

```bash
git subtree split -P mobile -b spark-mobile
```

produces a repository that builds on its own. `PROTOCOL_VERSION` is the only
remaining coupling, and it is checked at connect time.
