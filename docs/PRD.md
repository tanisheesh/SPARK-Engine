# SPARK Engine — Product Requirements Document

**Status:** Final
**Owner:** Tanish Poddar
**One-liner:** A voice-first desktop analytics app that lets you ask any database a question in plain English and hear the answer spoken aloud.

---

## 1. Problem

Working with data today requires knowing SQL — or waiting for someone who does. Analysts and engineers spend significant time writing boilerplate queries, switching between a terminal and a BI tool, and explaining results to non-technical stakeholders. There is no tool that lets a user point at a CSV, a MySQL database, or a PostgreSQL instance, ask a plain-English question aloud, and immediately hear a conversational answer — with the schema diagram generated automatically in the background.

---

## 2. Goals (v1 / MVP)

1. Accept voice input (Deepgram WebSocket) and text input on the same query surface.
2. Connect to CSV files of any size, MySQL, PostgreSQL, and SQLite databases without any separate backend service.
3. Translate natural language questions to DuckDB SQL using Groq (Llama 3.3-70B) and execute them locally.
4. Read the answer back to the user using Inworld AI TTS.
5. Auto-generate interactive ER diagrams (Chen and Crow's Foot) from real schema metadata the moment a data source is connected.
6. Authenticate via Google OAuth (Supabase) and persist saved prompts per user with Row Level Security.
7. Ship a native desktop installer for Windows (NSIS), macOS (DMG), and Linux (AppImage).
8. Developer debug panel showing generated SQL, raw results, and processing pipeline steps.

---

## 3. Non-Goals (explicit scope cuts)

- **Web-hosted version** — The CLI subprocess model for DuckDB and large-file path references require native OS access; a browser-based version is deferred.
- **Real-time database sync** — Data is imported in full at connect time; incremental sync or change-data-capture is out of scope for v1.
- **Query history / audit log** — No persistent log of past queries; the debug panel is session-only.
- **Multi-user collaboration** — Saved prompts are per-user; sharing dashboards or query results with teammates is deferred.
- **Custom LLM fine-tuning** — Groq's hosted Llama 3.3-70B is used as-is; fine-tuning on domain-specific SQL dialects is v2.
- **Write operations** — Only SELECT/WITH queries are permitted; INSERT, UPDATE, DELETE are blocked at the validation layer.

---

## 4. Users

**Primary:** Data analysts, engineers, and technical product managers who work with structured data regularly and want a faster, voice-accessible query interface without context-switching to a SQL IDE.

**Secondary:** Non-technical stakeholders (PMs, founders) who want to ask questions about data exports (CSVs) without learning SQL — they speak the question and hear the answer.

**Tertiary:** Recruiters and engineers evaluating this as a portfolio piece — the app must work with a real database on their machine.

---

## 5. User Stories

1. *As a data analyst,* I connect my MySQL database by entering host/user/password so that all tables are immediately available for natural language queries without writing a single line of SQL.
2. *As a product manager,* I upload a 2 GB CSV export and ask "what is the average order value by region?" so that I get a spoken answer in seconds without opening a spreadsheet.
3. *As a developer,* I toggle Developer Mode so that I can see the exact SQL SPARK generated and the raw DuckDB output alongside the AI-formatted response.
4. *As a returning user,* I save a frequently used prompt ("show me the top 10 customers by revenue") with a custom title so that I can run it again from the sidebar with a single click.
5. *As a non-technical user,* I press the microphone button and speak my question so that I never have to type SQL or even English text.
6. *As an engineer reviewing an unfamiliar database,* I switch to the ER Diagram view and see a Crow's Foot diagram of every table and foreign key relationship so that I understand the schema in under a minute.
7. *As a security-conscious user,* I enter my own API keys in the Settings modal so that my data never passes through any intermediary server controlled by SPARK Engine.

---

## 6. Functional Requirements

### 6.1 Voice Input

- The app must open a Deepgram WebSocket connection when the user clicks the microphone button.
- Transcription must appear in the query input field in real time as the user speaks.
- Recording must stop automatically after 2 seconds of silence (Deepgram `speech_final` + local silence timer).
- The user must be able to stop recording manually by clicking the microphone button again.

### 6.2 Data Connection

- The app must support CSV files of any size; files larger than 500 MB must be referenced by path rather than copied.
- The app must support MySQL, PostgreSQL, and SQLite connections via host/user/password/database credentials.
- On connection, all tables from the source must be imported into a fresh local DuckDB instance.
- On disconnect, all DuckDB tables belonging to that source must be dropped immediately.
- The DuckDB database file must be wiped on every app startup to prevent stale state.

### 6.3 Query Processing

- The app must extract schema (table names, column names, data types) and a 3-row sample from DuckDB before calling Groq.
- The Groq prompt must include all table schemas and sample data so multi-table JOINs are possible.
- The generated SQL must be validated to start with SELECT or WITH before execution.
- If the SQL includes a LIKE operator on a column whose name contains "id", the app must automatically cast the column to VARCHAR.
- Query results must be formatted into a natural language response by a second Groq call.

### 6.4 Voice Output

- If Inworld API keys are configured, the formatted response must be sent to Inworld TTS and played as audio automatically.
- If Inworld keys are absent, the response must be displayed as text only — no silent failure.
- The user must be able to mute/unmute audio without stopping or re-running the query.
- The user must be able to replay the last response's audio via a dedicated button.

### 6.5 ER Diagram Visualization

- On switching to the ER Diagram view, the app must call the database's native metadata APIs (INFORMATION_SCHEMA, PRAGMA) to extract real foreign key relationships.
- The app must render both Chen notation and Crow's Foot notation diagrams switchable with one click.
- The user must be able to export the current diagram as a PNG.
- For CSV sources, the app must infer relationships from `*_id` column name heuristics.

### 6.6 Auth and Saved Prompts

- The app must require Google OAuth login (via Supabase) before any query can be run.
- The user must be able to save the current query with a custom title.
- Saved prompts must be listed in a sidebar panel; clicking one must fill the query input.
- The user must be able to delete saved prompts individually.
- Row Level Security must prevent any user from reading another user's saved prompts.

### 6.7 Developer Mode

- Toggling Developer Mode must display a debug panel showing: the original question, generated SQL, raw DuckDB results (up to 5 rows), total row count, processing pipeline steps, and the AI-formatted response.

---

## 7. Non-Functional Requirements

- **Latency:** Voice-to-answer for a simple aggregation query on a pre-connected database should complete in under 10 seconds on a typical internet connection (Groq + Inworld round trips).
- **Scale:** CSV files up to at least 100 GB must be importable via DuckDB path reference without copying to AppData.
- **Security:** API keys are stored only in local AppData `settings.json`; they are never logged, transmitted to SPARK servers, or committed to version control. Only SELECT/WITH queries are executed.
- **Reliability:** App startup always wipes the DuckDB file to prevent state corruption from a previous crash. Single-instance enforcement prevents concurrent file access.
- **Accessibility:** The app is keyboard-navigable; voice input is an enhancement, not a requirement — all features are reachable by text input and mouse.
- **Cost:** All external AI calls are on-demand (per query), never per-page-load. User-provided API keys keep SPARK Engine's own hosting cost at zero.

---

## 8. Success Metrics

| Metric | Target |
|---|---|
| CSV import and query end-to-end | Works on files from 1 KB to 12 GB in CI test |
| MySQL / PostgreSQL / SQLite connection | All four source types queryable with a natural language question |
| ER diagram accuracy | Foreign keys match `INFORMATION_SCHEMA` / `PRAGMA` output exactly |
| Voice round-trip | Spoken question → spoken answer in < 10 s on a stable connection |
| Installer build | NSIS `.exe` installer builds and runs on a clean Windows machine |

---

## 9. Risks & Open Questions

- **DuckDB CLI subprocess fragility** — Spawning a subprocess for every query adds overhead and is sensitive to the CLI binary's location. Mitigated by a multi-path search at startup and an auto-installer. Resolved long-term by switching to `@duckdb/node-api` in v2.
- **Groq rate limits** — Free-tier Groq limits can throttle heavy usage. Mitigated by two calls per query only (SQL generation + response formatting), no background polling.
- **Inworld TTS cost** — TTS is optional; users without Inworld keys get text-only responses. Cost is proportional to usage since keys are user-managed.
- **Large CSV import UX** — Importing a 12 GB file into DuckDB can take minutes. Current UX shows a progress notification but the query input is blocked. Open question: should import happen in a background worker with the UI remaining usable?
- **SQL injection surface** — The AI generates SQL from user input; the validation regex (`/^(SELECT|WITH)/i`) and table name sanitisation reduce but do not fully eliminate risk. DuckDB runs with no network access and no write permissions to source databases, which limits blast radius.

---

## 10. v2 Candidates

- **DuckDB Node.js bindings** — Replace subprocess CLI calls with `@duckdb/node-api` for streaming results, lower latency, and cleaner error handling.
- **Query history** — Persist the last N query/SQL/result tuples per user so they can review or re-run past analyses.
- **Real-time database sync** — Poll the source database for schema changes and incrementally update DuckDB without a full reconnect.
- **Export to CSV / JSON** — Let the user download query results directly from the app.
- **Shareable dashboards** — Save a set of queries as a named dashboard and share a read-only link with teammates (requires a backend).
- **More LLM providers** — OpenAI, Anthropic Claude, and local Ollama models as drop-in alternatives to Groq.
