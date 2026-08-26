# Engineering Decisions — SPARK Engine

Every decision here follows the same format: what the situation was, what I chose, why I chose it, and what I gave up. This is the reasoning I'd walk through with a technical interviewer or a stakeholder asking "why is it built this way?"

---

## Decision 1 — Import all data into DuckDB rather than querying source databases directly

**The situation:** When a user connects a MySQL or PostgreSQL database, the app needs to run AI-generated SQL against it. I had two options: send the generated SQL directly to MySQL/PostgreSQL, or first import everything into a local DuckDB instance and query from there.

**What I chose:** Import all data into local DuckDB first, then run every query against DuckDB — regardless of whether the original source is CSV, MySQL, PostgreSQL, or SQLite.

**Why:** This decision solved three problems at once. First, the AI only needs to know one SQL dialect (DuckDB, which is close to standard SQL) — it doesn't need to know whether the source is MySQL 5.7 or PostgreSQL 15, which would require separate prompts and increase failure modes. Second, all query logic — schema extraction, sample data fetching, execution — is identical code regardless of source type. Third, large CSV files (100 GB+) can be queried locally without sending them over a network.

From a stakeholder perspective: a user connecting their production MySQL database never has raw AI-generated SQL running against their live database. Every query hits a local read-only copy — which is a meaningful data safety guarantee.

**What I gave up:** The local DuckDB is a snapshot, not a live mirror. If someone updates the source database, SPARK won't see those changes until the user reconnects. For read-only analytics use cases this is fine. For operational queries against a live OLTP database, it would not be appropriate.

---

## Decision 2 — Use DuckDB via CLI subprocess, not the Node.js bindings

**The situation:** DuckDB has two ways to use it from Node.js/Electron: a CLI binary you spawn as a child process, or the official `@duckdb/node-api` package that links natively. Electron's native module rebuild process with native addons is known to be unreliable across platform and version combinations.

**What I chose:** Spawn the DuckDB CLI binary as a subprocess from the Electron main process, pipe results as JSON using the `-json` flag.

**Why:** The CLI binary is a self-contained executable — electron-builder can bundle it as an extra resource and ship it inside the installer. This eliminated an entire class of packaging failures (MODULE_NOT_FOUND, ABI mismatch errors) that would have made it impossible to ship a working installer on Windows, macOS, and Linux from the same build configuration. Shipping a working installer was a hard requirement for this to function as a portfolio piece.

**What I gave up:** Each query spawns a subprocess, adding 100–300ms overhead. Large result sets are fully buffered before being returned to the UI — streaming is not possible. SQL must be serialised carefully as a shell argument, which requires escaping. This is the decision I would reverse first in v2 by switching to `@duckdb/node-api`.

---

## Decision 3 — Two separate AI calls per query: one for SQL, one for the response

**The situation:** To go from a user's spoken question to a natural language answer, I needed the AI to both generate SQL and explain the results conversationally. I could do this in one call or two.

**What I chose:** Two calls — the first generates only SQL (strict rules, low temperature), the second receives the question, SQL, and query results and writes a conversational prose response.

**Why:** Asking a single model call to simultaneously reason about SQL syntax and write natural, conversational prose degrades accuracy on both. Separating them lets me give each call a focused system prompt: the SQL call has strict rules (SELECT-only, always add LIMIT, cast numeric columns before LIKE), while the formatting call has a completely different instruction set focused on clarity and tone. This produced noticeably more accurate SQL and more natural responses than a single-call approach in testing.

From a consulting perspective, this is the same principle as separating analysis from communication — you do the technical work precisely first, then translate for the audience.

**What I gave up:** Two API round trips per query add 1–3 seconds of latency on Groq's free tier. If the API is rate-limited, either call can fail independently.

---

## Decision 4 — Wipe the DuckDB file on every startup and every reconnect

**The situation:** DuckDB stores state in a persistent file. Between sessions, that file might contain tables from a completely different database connection, or be in a broken state from a previous crash.

**What I chose:** Delete the entire `.duckdb` file on app startup and before every new database connection.

**Why:** This guarantees a clean slate every time. The alternative — trying to detect and clean up stale tables programmatically — introduces its own complexity and failure modes. If the schema context fed to the AI ever contains tables that don't exist in the current data source, the AI will generate SQL that fails. A wipe-on-start eliminates that entire category of silent correctness bugs. DuckDB creates a new file in milliseconds, so the cost is negligible.

This is a risk mitigation decision: the cost of wiping (losing session-temporary state) is low, and the cost of not wiping (AI referencing wrong tables, confusing errors for the user) is high.

**What I gave up:** Any work done in a session — temporary views, computed tables — is lost on restart or reconnect. For an analytics read-only tool this is acceptable.

---

## Decision 5 — Open the Deepgram WebSocket from the renderer, not the Electron main process

**The situation:** Deepgram needs a WebSocket connection that streams real-time audio chunks from the microphone. The connection could be opened from either the Electron main process (Node.js) or the renderer (browser context).

**What I chose:** Open the Deepgram WebSocket directly from the renderer using the browser's native WebSocket API and `navigator.mediaDevices.getUserMedia`.

**Why:** The renderer already has native access to both the microphone (via `getUserMedia`) and real-time WebSocket communication. Routing audio chunks through Electron IPC to the main process would add serialisation overhead and latency that would visibly degrade the real-time transcription experience. The API key is loaded from settings before the connection is opened, so it is not hardcoded anywhere in the bundle.

**What I gave up:** The Deepgram API key exists in renderer memory while the WebSocket is open. A future v2 improvement would be to open the WebSocket from the main process and pipe only the transcript text back to the renderer — keeping the key entirely out of renderer memory.

---

## What I'd change in v2

**Replace DuckDB CLI with the Node.js bindings** — the subprocess model works but adds overhead and requires careful string escaping. The official `@duckdb/node-api` bindings would enable streaming results, lower latency, and proper async error handling.

**Add a retry loop with error feedback** — if DuckDB rejects the generated SQL, re-prompt the AI with the SQL and the error message. Currently the error is surfaced to the user; a retry with error context would resolve most failures automatically without user intervention.

**Azure AD / Entra ID auth** — the current Google OAuth via Supabase is sufficient for personal use, but enterprise clients would require SSO integration. This would also unlock role-based access controls for saved prompts and query history.

**Persist query history in Supabase** — even a simple log of `{ question, sql, timestamp }` would let users audit or replay past analyses, which is a common requirement in enterprise analytics workflows.
