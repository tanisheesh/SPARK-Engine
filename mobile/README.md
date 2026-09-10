# SPARK Mobile

The Android companion to **SPARK Desktop**.

You already set your data up on your computer. This is for the moment you are
somewhere else and want to ask it something.

```
open → pick a conversation → ask → answer
```

That is the whole product. It is not a second analytics engine.

## What it is not

The phone does **not**:

- download your datasets
- store CSV files
- run DuckDB
- install database drivers
- run the Groq pipeline
- bundle any part of the Electron app

Every question is executed by your desktop, against data that never leaves it.
The phone sends a sentence and receives an answer, a preview of at most 20 rows,
and the SQL. Nothing else crosses.

## How it works

```
phone ──▶ relay ──▶ SPARK Desktop ──▶ existing query pipeline ──▶ back
```

Your desktop dials *out* to the relay, so no port is opened on your machine and
nothing about it is reachable from the network. The relay routes strictly within
one authenticated identity — there is no code path from one account to another's
desktop.

Conversations live on the desktop, which stays the source of truth. Ask something
here and it appears in the same conversation when you next open SPARK Desktop,
marked as having come from mobile. The phone keeps a small cache so the list still
renders with the desktop asleep.

Full detail: [ARCHITECTURE.md](./ARCHITECTURE.md).

## Running it

**1. Start a relay** (from the repository root):

```bash
cd relay && npm install && npm start
```

**2. Configure the app:**

```bash
cp .env.example .env
```

Set `EXPO_PUBLIC_RELAY_URL` to your machine's **LAN IP** — not `localhost`, which
on a phone means the phone:

```
EXPO_PUBLIC_RELAY_URL=ws://192.168.1.20:8787/session
```

**3. Connect the desktop:** open SPARK Desktop → Settings → **Remote access**,
enter the same relay address, and press **Pair a device**. A six-character code
appears.

**4. Run the app:**

```bash
npm install
npm start        # then press 'a', or scan the QR with Expo Go
```

Enter the pairing code. You should see your desktop's conversations.

### "This app is not valid for SDK NN"

Expo Go from the Play Store only ever supports the **latest** Expo SDK, so a
project pinned to an older one can never open in it. When Expo Go moves on,
move with it:

```bash
npx expo install expo@^NN.0.0 --fix   # NN = the SDK Expo Go asks for
npx expo install --fix
npx expo-doctor
npm run typecheck
```

Two things have moved between SDKs so far and will need fixing by hand if they
resurface: `android.edgeToEdgeEnabled` was removed once edge-to-edge became
mandatory, and `splash` moved out of `app.json` into the `expo-splash-screen`
plugin. `expo-doctor` names both precisely.

The alternative — staying on an old SDK and sideloading a matching Expo Go APK —
is not worth it. A development build (`npx expo run:android`) is the real answer
if you ever need to pin.

### Account sign-in

Pairing codes are for local development — the code *is* the identity, and the
relay only accepts them in dev mode.

For real use, run `infra/aws/06-cognito-mobile.sh` to add a mobile app client to
the existing Cognito pool, put its values in `.env`, and start the relay with
`SPARK_RELAY_MODE=cognito`. The app then shows a normal **Sign in** button and uses
the same account as the desktop.

## Layout

```
App.tsx                  auth gate, fonts, navigation
src/
  protocol.ts            wire contract (mirror of electron/remote/protocol.js)
  theme.ts               SPARK palette, spacing, type scale
  types.ts               the shapes the desktop actually sends
  format.ts              number/date/cell formatting
  chart.ts               chart inference — returns null when there is no honest chart
  config.ts              EXPO_PUBLIC_* configuration
  api/
    relay.ts             the socket: RPC, events, reconnection
    auth.ts              Cognito PKCE, and the pairing-code fallback
    storage.ts           keystore for credentials, AsyncStorage for the cache
  state/SessionProvider  one context; no state library
  components/            the entire UI kit, ~6 files
  screens/               Auth, Conversations, Conversation, Account
```

## Scripts

| Command | Does |
|---|---|
| `npm start` | Expo dev server |
| `npm run android` | build/run on a connected device or emulator |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run doctor` | `expo-doctor` dependency checks |
| `npm run build:apk` | EAS preview APK (needs an Expo account) |

## Design

Same visual language as the desktop, transcribed in `src/theme.ts`: warm charcoal
ground, one muted sage accent, three text weights, 1px borders, 6–10px radii.
Instrument Sans for human text, IBM Plex Mono for anything a database produced.

No gradients, no glow, no glassmorphism, no floating bubbles. Type sizes run two
points larger than the desktop — 13px is right on a monitor and wrong in a car park.

Charts are ~150 lines of `react-native-svg`, not a charting library, and render one
measure in one of three shapes. If the rows have no honest visual form, no chart is
drawn and the table is shown instead.

## Extracting this into its own repository

`/mobile` imports nothing from `../`. The protocol and formatting helpers are
deliberate copies, not shared modules, precisely so this works:

```bash
git subtree split -P mobile -b spark-mobile
git push git@github.com:you/spark-mobile.git spark-mobile:main
```

The only coupling left is `PROTOCOL_VERSION` in `src/protocol.ts`, which must match
the desktop and relay. A mismatch is refused at connect time with both versions
named, so it fails loudly rather than subtly.

## Known limits

- The desktop must be running. There is no cloud copy of your data, by design.
- One question at a time per phone; the desktop pipeline is not concurrent.
- Queued questions are held on the phone and sent when you tap **Send** — they are
  never auto-sent, so an answer always corresponds to a question you chose to ask.
- Voice input is not implemented. Text was the V1 priority.
