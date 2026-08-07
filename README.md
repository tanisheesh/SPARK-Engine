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

SPARK Engine is a voice-first data analytics desktop app that lets you interrogate any database — CSV, MySQL, PostgreSQL, or SQLite — using plain English spoken aloud or typed. You connect your data source, ask a question, and SPARK generates a SQL query via Groq AI, executes it against a local DuckDB instance, and reads the answer back to you through Inworld AI voice synthesis. It also auto-generates interactive ER diagrams in Chen and Crow's Foot notation the moment you connect, with no manual drawing required.

---

## What you get

- **Voice-to-SQL pipeline** — Speak a question; Deepgram transcribes it in real time, Groq (Llama 3.3-70B) writes the SQL, DuckDB runs it, and Inworld AI reads the answer back.
- **Universal data sources** — Connect CSV files of any size (100 GB+), MySQL, PostgreSQL, or SQLite; all data is imported into a fresh DuckDB instance and wiped clean on disconnect.
- **Self-healing SQL** — If the generated query fails, the engine automatically retries with the error context, up to 3 attempts, before surfacing a clear message.
- **Instant ER diagrams** — Real foreign-key relationships are extracted from `INFORMATION_SCHEMA` / `PRAGMA` and rendered as interactive Chen or Crow's Foot diagrams via ReactFlow; export as PNG.
- **Developer debug panel** — Toggle to see the generated SQL, raw DuckDB results, processing pipeline steps, and the AI-formatted response side by side.

---

## Stack

| Layer | Tech |
|---|---|
| Desktop shell | Electron 32 |
| UI framework | Next.js 16 (App Router, TypeScript, static build) |
| Styling | Tailwind CSS v3 · Framer Motion |
| ER diagrams | ReactFlow 11 · Dagre (auto-layout) |
| Analytics engine | DuckDB (embedded, via CLI) |
| AI — SQL generation | Groq API · Llama 3.3-70B |
| Voice input | Deepgram WebSocket (nova-2 model) |
| Voice output | Inworld AI TTS (inworld-tts-1.5-max) |
| Auth | Supabase — Google OAuth |
| Saved prompts | Supabase Postgres (Row Level Security) |
| DB connectors | mysql2 · pg · better-sqlite3 |

---

## Engineering Decisions

**Why DuckDB over running queries directly against MySQL/PostgreSQL?**
Pulling all data into a local DuckDB instance gives a single query surface regardless of source type — CSV, MySQL, PostgreSQL, and SQLite all become DuckDB tables. This means the SQL generation prompt only needs to know one dialect, and the query executor path is identical for every source.

**Why Groq (Llama 3.3-70B) over a hosted OpenAI model?**
Groq's inference is significantly faster at lower latency, which matters in a real-time voice pipeline where the user is waiting to hear an answer spoken aloud. The trade-off is that the API key is user-managed (entered in the settings modal), which avoids running a backend service.

**Why Electron over a web app?**
DuckDB's CLI needs filesystem access to the `.duckdb` database file, and large CSV files (100 GB+) are referenced by path rather than copied. Both requirements demand native OS access that a browser sandbox cannot provide.

**Why fresh DuckDB instance per session?**
The database file is wiped on every app start and on every disconnect. This eliminates stale state, prevents cross-session table leakage, and keeps the schema context fed to the LLM accurate without any synchronisation logic.

**What would you do differently in v2?**
Use the DuckDB Node.js bindings (`@duckdb/node-api`) instead of shelling out to a CLI binary — it would eliminate the subprocess overhead, enable streaming result sets, and remove the awkward SQL string escaping that the current approach requires.

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
