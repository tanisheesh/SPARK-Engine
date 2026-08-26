# SPARK Engine — Architecture

<!--
Companion to PRD.md.
PRD says WHAT the system does. This says HOW.
Audience: an engineer who needs to understand the system well enough
to build it, debug it, or extend it.
-->

---

## 1. Stack

| Layer | Tech |
|---|---|
| Desktop shell | Electron 32 (main + renderer processes) |
| UI framework | Next.js 16 (App Router, TypeScript) — compiled to a static build |
| Styling | Tailwind CSS v3 · Framer Motion 12 |
| ER diagrams | ReactFlow 11 · Dagre (auto-layout) |
| Analytics engine | DuckDB (embedded CLI binary, auto-downloaded on first run) |
| AI — SQL + NL | Groq API · Qwen 3 27B |
| Voice input | Deepgram WebSocket API (nova-2 model) |
| Voice output | Inworld AI TTS (inworld-tts-1.5-max, Dennis voice) |
| Auth | Supabase — Google OAuth via `@supabase/supabase-js` |
| Saved prompts | Supabase Postgres (Row Level Security per user) |
| DB connectors | mysql2 (MySQL) · pg (PostgreSQL) · better-sqlite3 (SQLite) |
| Packaging | electron-builder — NSIS (Windows), DMG (macOS), AppImage (Linux) |

---

## 2. Components

```
app/
  page.tsx              Main chat interface — voice input, query submission, response display
  layout.tsx            Root layout with global CSS
components/
  FileUpload.tsx         Data source connection modal (CSV / MySQL / PostgreSQL / SQLite)
  VisualizationView.tsx  ER diagram container — switches between Chen and Crow notation
  ChenDiagram.tsx        Chen notation ER diagram using ReactFlow + Dagre
  CrowDiagram.tsx        Crow's Foot notation ER diagram using ReactFlow + Dagre
  EntityNode.tsx         ReactFlow custom node — entity box with attributes
  AttributeNode.tsx      ReactFlow custom node — attribute ellipse (Chen)
  RelationshipNode.tsx   ReactFlow custom node — diamond relationship (Chen)
  CrowNode.tsx           ReactFlow custom node — entity box (Crow's Foot)
  ISANode.tsx            ReactFlow custom node — ISA (inheritance) triangle
  WaypointEdge.tsx       ReactFlow custom edge — orthogonal routing
  SettingsModal.tsx      API key configuration modal
  SavedPrompts.tsx       Saved prompt sidebar panel
  LoginScreen.tsx        Google OAuth login screen
  ErrorBoundary.tsx      React error boundary for diagram rendering
electron/
  main.js               Electron main process — window, IPC handlers, DuckDB lifecycle
  api-handler.js         IPC handlers for query processing and TTS generation
  database-connector.js  MySQL / PostgreSQL / SQLite → DuckDB import logic
  preload.js             contextBridge — exposes electronAPI to renderer
  duckdb-installer.js    Auto-downloads DuckDB CLI binary on first run
  system-check.js        Validates system requirements before window is shown
lib/
  supabase.ts            Supabase client initialisation
```

### Electron Main Process (`electron/main.js`)

Manages the BrowserWindow, loads the static Next.js build from `out/index.html`, registers IPC handlers for file management, CSV upload, database connection/disconnection, and schema extraction. Cleans up the DuckDB database file on every startup to ensure a fresh session. Enforces single-instance via `app.requestSingleInstanceLock()`.

### API Handler (`electron/api-handler.js`)

Contains the core `process-query` IPC handler. On each query: discovers DuckDB tables, fetches schema, calls Groq to generate SQL, executes SQL via DuckDB CLI, calls Groq again to format the result as natural language, then optionally calls Inworld TTS for audio. Returns `{ textResponse, sqlQuery, results, totalRows, tts }` to the renderer.

### Database Connector (`electron/database-connector.js`)

Handles MySQL, PostgreSQL, and SQLite connections. For each: verifies credentials using the native driver, then uses DuckDB's first-party extensions (`ATTACH ... TYPE mysql/postgres/sqlite`) to import all tables into the local DuckDB instance as prefixed tables (`mysql_<db>_<table>`, `postgres_<db>_<table>`, `sqlite_<db>_<table>`). Tables are wiped before each connection.

### Renderer / UI (`app/page.tsx`)

Single-page React component managing all UI state: auth, voice recording, query submission, developer mode debug panel, saved prompts panel. Communicates with Electron exclusively through `window.electronAPI` (the contextBridge interface). Deepgram WebSocket is opened and closed directly from the renderer.

### Visualization View (`components/VisualizationView.tsx` + diagram components)

Requests schema and relationship graph from Electron via `getDatabaseSchema`. Passes data to either `ChenDiagram` or `CrowDiagram` — both use ReactFlow with Dagre for automatic layout. Foreign keys come from `INFORMATION_SCHEMA` (MySQL/PostgreSQL), `PRAGMA foreign_key_list` (SQLite), or column-name heuristics (`*_id` suffix) for CSV.

---

## 3. Data Flow

```
[User] -- voice/text -->
    [Renderer: page.tsx]
        -- Deepgram WebSocket (voice only) --> transcript appended to input
        -- window.electronAPI.processQuery({ question, csvFile, settings }) -->
    [Electron IPC: api-handler.js]
        1. DuckDB CLI: list tables in data.duckdb
        2. DuckDB CLI: DESCRIBE each table → schema string
        3. DuckDB CLI: SELECT * FROM <table> LIMIT 3 → sample data
        4. Groq API: system prompt + schema + sample → SQL query
        5. DuckDB CLI: execute SQL query → JSON rows
        6. Groq API: question + SQL + row sample → natural language answer
        7. Inworld TTS API: text → base64 WAV audio (if keys configured)
        --> returns { textResponse, sqlQuery, results, tts }
    [Renderer]
        -- displays text response
        -- plays audio via HTMLAudioElement (if tts.hasAudio)
```

**ER Diagram flow:**

```
[User clicks ER Diagrams tab]
    --> window.electronAPI.getDatabaseSchema({ connectionType, connectionConfig })
    [Electron IPC: main.js]
        MySQL:      INFORMATION_SCHEMA.TABLES + COLUMNS + KEY_COLUMN_USAGE
        PostgreSQL: information_schema + constraint_column_usage
        SQLite:     PRAGMA table_info + PRAGMA foreign_key_list
        CSV/DuckDB: information_schema.tables + column _id suffix heuristics
        --> { schema: {table: [columns]}, graph: {table: [{to, type, column}]} }
    [Renderer: VisualizationView → ChenDiagram / CrowDiagram]
        --> ReactFlow nodes + Dagre layout → interactive diagram
        --> PNG export via html-to-image
```

---

## 4. Database Schema

SPARK Engine has no application-owned database schema. All query data lives in a session-local DuckDB file at `%APPDATA%\spark-engine\data.duckdb` and is wiped on startup. The only persistent data stored externally is in Supabase:

- `saved_prompts` — `id` (uuid), `user_id` (uuid, FK to auth.users), `title` (text), `prompt_text` (text), `created_at` (timestamptz). Row Level Security enforces `user_id = auth.uid()` on all operations.

**Indexes:** Supabase applies a primary key index on `id` and the RLS policy is evaluated against `user_id` on every query.

---

## 5. AI / LLM Design

### Input

Two separate Groq calls per query. Both use `qwen/qwen3.8-27b` at `temperature: 0.1`.

**SQL generation call:** System prompt includes all table names with column names and types (`column_name (data_type)`), plus 3 sample rows from the first table. User message is the raw question.

**Response formatting call:** System prompt instructs natural, conversational language. User message is `question + SQL + row count + up to 5 result rows as JSON`.

### System prompt strategy

SQL prompt: instructs DuckDB SQL dialect, mandates a LIMIT clause (max 10 000 rows unless aggregating), requires CAST to VARCHAR before LIKE on numeric columns, and forbids anything other than SELECT/WITH queries. Explicitly tells the model to return only the SQL with no markdown.

Formatting prompt: restricted to summarising the results conversationally. Does not re-run analysis or invent data beyond what was returned.

### Response schema

SQL generation returns raw SQL text (markdown fences stripped). Response formatting returns plain prose.

### Validation

Generated SQL is validated with a regex check (`/^(SELECT|WITH)/i`) before execution. Common type-casting errors (LIKE on numeric columns) are auto-corrected with a regex post-process step before the query is sent to DuckDB.

### Failure handling

If DuckDB returns an error, the pipeline surfaces it to the user via an alert — there is no automatic SQL retry in the current `api-handler.js` implementation (retry logic described in README refers to the design intent). Groq calls have a 30-second fetch timeout. If Inworld TTS fails or keys are absent, the response degrades to text-only — the feature is "silent", not "broken".

---

## 6. IPC Surface (Electron contextBridge)

| Direction | Channel | Description |
|---|---|---|
| invoke | `process-query` | Full NL→SQL→DuckDB→NL→TTS pipeline |
| invoke | `generate-tts` | Standalone TTS re-generation for last response |
| invoke | `upload-csv` | Opens file picker, copies/references CSV, imports to DuckDB |
| invoke | `list-csv-files` | Lists uploaded CSV files from `%APPDATA%\spark-engine\uploads` |
| invoke | `delete-csv` | Removes a CSV file or its reference |
| invoke | `import-csv-to-duckdb` | Imports an already-selected CSV into DuckDB |
| invoke | `connect-database` | MySQL / PostgreSQL / SQLite → DuckDB import |
| invoke | `disconnect-database` | Drops prefixed tables from DuckDB |
| invoke | `get-database-schema` | Extracts schema + FK graph for ER diagrams |
| invoke | `get-settings` | Reads `settings.json` from AppData |
| invoke | `save-settings` | Writes `settings.json` to AppData |
| invoke | `open-external` | Opens a URL in the system browser |
| on | `query-progress` | Stage progress events during query processing |
| on | `upload-progress` | Progress events during CSV upload / DB import |
| on | `system-notification` | DuckDB install warnings / errors |
| on | `oauth-callback` | Deep-link OAuth callback on Windows |

---

## 7. Security

- **API keys:** Groq, Deepgram, and Inworld keys are stored in `%APPDATA%\spark-engine\settings.json` on the user's machine — never committed to the repo and never sent to any server other than the respective AI provider.
- **SQL injection:** Generated SQL is validated with `/^(SELECT|WITH)/i` before execution. Table names are sanitised to `[a-zA-Z0-9_]` before being used in shell commands. CSV file paths are resolved with `path.resolve()` to prevent traversal.
- **Electron security:** `nodeIntegration: false`, `contextIsolation: true`, `enableRemoteModule: false`. All Node.js access is through the contextBridge.
- **Supabase RLS:** Row Level Security enforces `user_id = auth.uid()` on `saved_prompts` — users can only read and write their own rows.
- **Single instance:** `app.requestSingleInstanceLock()` prevents multiple app instances from concurrently accessing the DuckDB file.

---

## 8. Error Handling & Reliability

| Failure | Behaviour |
|---|---|
| Groq API error / timeout | Error surfaced to user via alert; processing state reset to idle |
| DuckDB not found | Auto-installer runs on startup; user shown a warning notification if it fails |
| Inworld TTS failure | Silently skipped; response displayed as text only |
| Deepgram WebSocket error | Alert shown; recording stops, input field remains editable |
| DB connection failure | Error returned from `connect-database` IPC; shown in upload progress panel |
| DuckDB stale state | Entire `.duckdb` file deleted on startup and on every `connect-database` call |
| Invalid SQL returned by Groq | Blocked before execution by SELECT/WITH regex; user sees error alert |

---

## 9. Deployment

SPARK Engine ships as a native desktop installer. There is no server component.

1. `npm run build` — Next.js compiles the UI to `out/` (static export).
2. `npm run dist` — electron-builder packages `out/`, `electron/`, and `node_modules` into a platform-specific installer: NSIS `.exe` (Windows), DMG (macOS), AppImage (Linux).
3. On first run, `duckdb-installer.js` downloads the DuckDB CLI binary for the current platform and places it next to the app executable.
4. API keys (Groq, Deepgram, Inworld) are entered by the user in the Settings modal and persisted locally in AppData — no server configuration needed.

---

## 10. Explicit Scope Cuts

- **Streaming query results** — DuckDB is invoked as a CLI subprocess; streaming would require the Node.js bindings (`@duckdb/node-api`), deferred to v2.
- **Multi-user / cloud sync** — All query data is session-local; only saved prompts are synced via Supabase. Multi-user analytics sharing deferred to v2.
- **Query history** — No persistent log of past queries or their SQL; developer debug panel is session-only.
- **Real-time database sync** — Databases are imported in full at connect time; live changes to the source are not reflected until the user reconnects.
