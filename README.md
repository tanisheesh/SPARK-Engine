<p align="center">
  <img src="public/icon.png" alt="SPARK Engine Logo" width="96" height="96">
</p>

<h1 align="center">SPARK Engine</h1>

<p align="center">
  <strong>Speech Powered Analytics Relational Kit — ask your database anything, out loud.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-black?style=flat-square&logo=next.js" alt="Next.js">
  <img src="https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript">
  <img src="https://img.shields.io/badge/Electron-47848F?style=flat-square&logo=electron&logoColor=white" alt="Electron">
  <img src="https://img.shields.io/badge/DuckDB-FFF000?style=flat-square&logo=duckdb&logoColor=black" alt="DuckDB">
  <img src="https://img.shields.io/badge/Groq-F55036?style=flat-square" alt="Groq">
  <img src="https://img.shields.io/badge/Supabase-3ECF8E?style=flat-square&logo=supabase&logoColor=white" alt="Supabase">
  <img src="https://img.shields.io/badge/license-GPL--3.0-D97706?style=flat-square" alt="License">
</p>

---

## What is SPARK Engine?

SPARK Engine is a voice-first data analytics desktop application that removes the SQL barrier between business stakeholders and their data. Connect any data source — CSV, MySQL, PostgreSQL, or SQLite — ask a question in plain English spoken aloud, and SPARK generates the SQL via Groq AI, executes it against a local DuckDB instance, and reads the answer back through Inworld AI voice synthesis. Auto-generated ER diagrams in Chen and Crow's Foot notation appear the moment a database is connected, giving both technical and non-technical users an instant understanding of data relationships.

The core value proposition: a product manager, analyst, or executive can interrogate a production database export or a live database connection without writing a single line of SQL — and without routing sensitive data through any third-party server.

---

## What you get

- **Voice-to-SQL pipeline** — Speak a question; Deepgram transcribes it in real time, Groq (Qwen 3) writes the SQL, DuckDB runs it, and Inworld AI reads the answer back. The end-to-end loop completes in under 10 seconds on a stable connection.
- **Universal data sources** — Connect CSV files of any size (100 GB+), MySQL, PostgreSQL, or SQLite. All data is imported into a local DuckDB instance and wiped clean on disconnect — no data ever leaves the user's machine.
- **Self-healing SQL** — If the generated query fails, the engine automatically retries with the error context, up to 3 attempts, before surfacing a clear message. This reduces user-facing errors without any manual intervention.
- **Instant ER diagrams** — Real foreign-key relationships are extracted from `INFORMATION_SCHEMA` / `PRAGMA` and rendered as interactive Chen or Crow's Foot diagrams via ReactFlow. Export as PNG for stakeholder presentations.
- **Developer debug panel** — Toggle to see the generated SQL, raw DuckDB results, processing pipeline steps, and the AI-formatted response side by side — useful for validating accuracy before sharing results with stakeholders.
- **Saved prompts with RLS** — Authenticated users can save, name, and reuse frequent queries. Row Level Security on Supabase ensures no user can access another's saved prompts.

---

## Business Impact

| Stakeholder | Problem Solved |
|---|---|
| Data analysts | Eliminate boilerplate SQL for ad-hoc queries; stay in flow |
| Non-technical executives / PMs | Self-serve data questions without engaging engineering |
| Engineering leads | Onboard to an unfamiliar schema in under a minute via ER diagrams |
| Security-conscious orgs | All data stays local; API keys are user-managed, never centralized |

---

## Stack

| Layer | Tech |
|---|---|
| Desktop shell | Electron 32 |
| UI framework | Next.js 16 (App Router, TypeScript, static build) |
| Styling | Tailwind CSS v3 · Framer Motion |
| ER diagrams | ReactFlow 11 · Dagre (auto-layout) |
| Analytics engine | DuckDB (embedded, via CLI) |
| AI — SQL generation | Groq API · Qwen 3 27B |
| Voice input | Deepgram WebSocket (nova-2 model) |
| Voice output | Inworld AI TTS (inworld-tts-1.5-max) |
| Auth | Supabase — Google OAuth |
| Saved prompts | Supabase Postgres (Row Level Security) |
| DB connectors | mysql2 · pg · better-sqlite3 |

---

## Engineering Decisions

**Why DuckDB over running queries directly against MySQL/PostgreSQL?**
Pulling all data into a local DuckDB instance provides a single query surface regardless of source type — CSV, MySQL, PostgreSQL, and SQLite all become DuckDB tables. This means the SQL generation prompt only needs to know one dialect, the query executor path is identical for every source, and customer data never travels over the network during query execution. The tradeoff is a one-time import cost at connect time, which is acceptable given the latency requirements.

**Why Groq over a hosted OpenAI model?**
Groq's inference is significantly faster at lower latency, which is critical in a real-time voice pipeline where the user is waiting to hear an answer spoken aloud. The architecture also avoids a centralised backend service — the API key is user-managed — which reduces operational risk and aligns with the data privacy requirements of enterprise customers.

**Why Electron over a web app?**
DuckDB's CLI needs filesystem access to the `.duckdb` database file, and large CSV files (100 GB+) are referenced by path rather than copied. Both requirements demand native OS access that a browser sandbox cannot provide. A desktop model also makes it straightforward to enforce single-instance behaviour, preventing concurrent file access errors.

**Why fresh DuckDB instance per session?**
The database file is wiped on every app start and on every disconnect. This eliminates stale state from a previous crash, prevents cross-session table leakage, and ensures the schema context fed to the LLM is always accurate — removing an entire class of silent data-correctness bugs.

**What would you do differently in v2?**
Use the DuckDB Node.js bindings (`@duckdb/node-api`) instead of shelling out to a CLI binary — it would eliminate the subprocess overhead, enable streaming result sets, and remove the awkward SQL string escaping the current approach requires. Additionally, migrate auth to support Azure AD / Entra ID for enterprise single sign-on.

---

## Risk Register

| Risk | Mitigation |
|---|---|
| SQL injection from AI-generated queries | Regex-validated to `SELECT`/`WITH` only; table names sanitised; DuckDB has no write access to source databases |
| Stale schema context corrupting LLM output | DuckDB wiped on every startup and disconnect; schema re-extracted fresh per query |
| API key exposure | Keys stored only in local `AppData/settings.json`; never logged, transmitted, or committed to VCS |
| DuckDB subprocess fragility | Multi-path search at startup; auto-installer falls back to system binary |
| Groq rate limits on heavy usage | Two API calls per query only (SQL generation + response formatting); no background polling |
| Large CSV import blocking the UI | Files >500 MB imported asynchronously in background; progress events pushed to renderer |

---

## Docs

| Document | Description |
|---|---|
| [PRD](docs/PRD.md) | Product requirements — goals, user stories, non-goals |
| [Architecture](docs/ARCHITECTURE.md) | System design, data flow, component breakdown |
| [Decisions](docs/DECISIONS.md) | Every major technical decision and why |
| [Setup](docs/SETUP.md) | Local dev setup, env vars, building the installer |

---

## Author

**Tanish Poddar** — [tanisheesh.in](https://tanisheesh.in) · [LinkedIn](https://linkedin.com/in/tanisheesh) · [GitHub](https://github.com/tanisheesh)
