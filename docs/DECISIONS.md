# Engineering Decisions — SPARK Engine

<!--
This is not user documentation. This is for technical interviewers
and senior engineers who want to understand WHY the system is built
the way it is.
-->

---

## Decision 1 — Import all data into DuckDB rather than querying sources directly

**Context:** When a user connects a MySQL or PostgreSQL database, we need to run LLM-generated SQL against it. The options were: (a) pass the generated SQL directly to the source database, or (b) import all data into a local DuckDB instance first.

**Decision:** Import into DuckDB using DuckDB's first-party extensions (`ATTACH ... TYPE mysql/postgres/sqlite`), then run all queries against the local DuckDB file.

**Reason:** A single query surface means the SQL generation prompt needs to know only one dialect (DuckDB, which is very close to standard SQL). Groq never has to know whether the source is MySQL 5.7 or PostgreSQL 15. It also means schema extraction, sample data fetching, and query execution all use the same code path regardless of source type. DuckDB's columnar engine also handles large CSV files (100 GB+) that would be impractical to send across a network connection to a remote database.

**Tradeoff:** The import step can be slow for large databases (minutes for multi-million-row tables). The data in DuckDB is a snapshot — live changes in the source are invisible until the user reconnects. For read-only analytics use cases this is acceptable; for operational queries against a live OLTP database it is not.

---

## Decision 2 — DuckDB via CLI subprocess, not Node.js bindings

**Context:** DuckDB has both a CLI binary and a `@duckdb/node-api` Node.js package. Electron's native module rebuild process (`electron-builder install-app-deps`) with native addons is notoriously brittle across platforms and Node/Electron version pairs.

**Decision:** Use the DuckDB CLI binary, spawned as a child process from the Electron main process, with results piped as JSON (`-json` flag).

**Reason:** The CLI binary is a self-contained executable with no native addon rebuild required. electron-builder can bundle it as an extraResource and auto-install it on first run. This eliminated a class of `MODULE_NOT_FOUND` and ABI mismatch errors during packaging for Windows, macOS, and Linux in the same build.

**Tradeoff:** Each query spawns a subprocess, which adds ~100–300 ms overhead and requires SQL to be serialised as a shell argument (with careful escaping). Streaming large result sets is not possible — the entire JSON result is buffered in memory before being returned to the renderer. For queries returning more than 100 000 rows this becomes a memory concern; the current implementation caps results at 100 rows returned to the UI.

---

## Decision 3 — Two separate Groq calls per query (SQL generation + response formatting)

**Context:** We need to go from a natural language question to a spoken answer. The options were: (a) one LLM call that outputs both SQL and a prose response, or (b) two separate calls — one for SQL, one for formatting.

**Decision:** Two calls: first call generates only SQL (temperature 0.1); second call receives the question, SQL, and query results and generates the prose response.

**Reason:** Asking a single model to simultaneously reason about SQL syntax and write conversational prose in one output degrades accuracy on both dimensions. Separating concerns lets the SQL call be constrained with strict rules (SELECT-only, LIMIT required, no markdown) while the formatting call can be given a different system prompt focused purely on clarity and tone. The SQL call uses `temperature: 0.1` to maximise determinism.

**Tradeoff:** Two API round trips per query add latency (roughly 1–3 seconds combined on Groq's free tier). If Groq is rate-limited, both calls can fail independently. An alternative would be a structured output schema with both SQL and prose in one response, but this requires a model that reliably produces valid JSON with embedded SQL — which was less reliable in testing.

---

## Decision 4 — Fresh DuckDB instance on every app start and every database connect

**Context:** DuckDB stores its state in a persistent `.duckdb` file in AppData. Between sessions, the file might contain tables from a different database connection, or be in an inconsistent state from a previous crash.

**Decision:** Delete the entire `.duckdb` file on app startup and before every `connect-database` call.

**Reason:** Guaranteed clean state eliminates an entire category of bugs: stale tables from a previous session appearing in schema context (causing the LLM to reference tables that don't exist in the current source), corrupted WAL files blocking new connections, and table name collisions when reconnecting to the same database after modifying the source schema. The cost is negligible — DuckDB creates a new file in milliseconds.

**Tradeoff:** Any uncommitted work or temporary views created during a session are lost on restart or reconnect. For an analytics read-only tool this is acceptable. It would not be acceptable for a use case requiring persistent computed tables or materialised views between sessions.

---

## Decision 5 — Voice input via Deepgram WebSocket opened from the renderer, not the main process

**Context:** Deepgram requires a WebSocket connection that streams audio chunks in real time. The connection could be opened from either the Electron main process (Node.js) or the renderer process (browser context).

**Decision:** Open the Deepgram WebSocket directly from the renderer using the browser's native WebSocket API and `navigator.mediaDevices.getUserMedia`.

**Reason:** The renderer already has access to `getUserMedia` for microphone capture and native WebSocket for streaming. Routing audio through IPC to the main process would add unnecessary serialisation overhead and latency for real-time transcription. The Deepgram API key is retrieved from settings before the connection is opened, so it is not hardcoded in the frontend bundle.

**Tradeoff:** The Deepgram API key is accessible in the renderer process's memory while the WebSocket is open. A compromised renderer (e.g. via XSS through user-controlled data rendered without sanitisation) could read the key. The current app does not render any untrusted HTML, and Electron's `contextIsolation: true` limits the blast radius of renderer compromise, but this is the weakest link in the key-management model.

---

## What I'd do differently in v2

- **Replace DuckDB CLI with `@duckdb/node-api`** — The subprocess model works but is fragile. The official Node.js bindings would eliminate shell argument escaping, enable streaming result sets, and give proper async error handling.
- **Add a retry loop with error feedback to Groq** — If DuckDB rejects the generated SQL, re-prompt Groq with the SQL and the error message. The current implementation surfaces the error to the user; a retry with error context would fix most common failures automatically.
- **Store Deepgram key in main process only** — Retrieve the key in main, open the WebSocket from main via a helper, and stream transcripts back to the renderer via IPC. This keeps the key out of renderer memory entirely.
- **Persist a query history table in Supabase** — Even a simple log of `{ question, sql, timestamp }` would be valuable for users who want to audit or replay past queries.
- **Add nonce-based CSP** — The current Content-Security-Policy is permissive enough to allow Electron to load the static build. A stricter policy with nonces on inline scripts would harden against any future XSS surface.

---

## Explicit non-decisions (deferred to v2)

| Feature | Why deferred |
|---|---|
| Write operations (INSERT/UPDATE/DELETE) | Analytics read-only scope keeps the permission model simple and prevents accidental data modification via LLM-generated SQL |
| Streaming query results from DuckDB | Requires `@duckdb/node-api` Node.js bindings — native addon rebuild complexity was the blocking issue for v1 |
| Real-time source database sync | Full-import-on-connect is simpler to reason about and sufficient for analytical (not operational) use cases |
| Local LLM support (Ollama) | Groq's hosted Llama is fast enough and eliminates the GPU/VRAM requirement for the end user |
| Multi-tenant cloud deployment | Single-user desktop scope; a cloud version would require a backend service, per-user DuckDB isolation, and billing |
