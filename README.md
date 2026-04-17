# ⚡ SPARK ENGINE

### *Speech Powered Analytics Relational Kit*

[![Next.js](https://img.shields.io/badge/Next.js-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-blue?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![DuckDB](https://img.shields.io/badge/DuckDB-Latest-yellow?style=for-the-badge&logo=duckdb)](https://duckdb.org/)
[![Electron](https://img.shields.io/badge/Electron-Desktop-47848F?style=for-the-badge&logo=electron)](https://www.electronjs.org/)

*Ask questions about your data in natural language and get intelligent responses — voice, text, and visual.*


## 🌟 Features

### 🎤 Voice Input
- Real-time speech-to-text with Deepgram WebSocket
- Auto-stop on silence detection
- Live transcription as you speak
- No manual stop needed

### 🔊 Voice Output
- Natural voice responses with Inworld AI
- Animated avatar while speaking
- Text reveals as voice speaks

### 🗄️ Universal Data Sources
- **CSV** — any size, even 100GB+, path-based import
- **MySQL** — full database import via DuckDB MySQL extension
- **PostgreSQL** — full database import via DuckDB Postgres extension
- **SQLite** — full database import via DuckDB SQLite extension
- Fresh DuckDB instance on every connection, automatic cleanup on disconnect

### 🧠 Self-Healing SQL
- Natural language to SQL via Groq AI (Llama 3.3 70B)
- Auto-fixes errors with up to 3 retries
- Schema-aware query generation per data source

### 📊 ER Diagram Visualization
- **Auto-generated** Chen Notation and Crow's Foot diagrams
- Works for all data sources — MySQL, PostgreSQL, SQLite, CSV
- Real foreign key relationships from INFORMATION_SCHEMA and PRAGMA
- Switch between notations with one click
- Export diagrams as PNG
- No manual drawing — connect and diagram is ready instantly

### 🔐 Authentication & Saved Prompts
- Google OAuth via Supabase
- Save frequently used prompts with custom titles
- Access saved prompts from sidebar, click to auto-fill
- Per-user data with Row Level Security

### 🎨 Midnight Obsidian UI
- Dark theme with orange (#D97706) and purple (#8B5CF6) accents
- Particle effects and animated background
- Developer mode with SQL debug panel
- Fully responsive desktop layout


## 🛠️ Tech Stack

### Frontend
- **Next.js 16** — React framework with Turbopack
- **TypeScript** — Type-safe development
- **Framer Motion** — Smooth animations
- **Tailwind CSS v3** — Utility-first styling
- **ReactFlow** — ER diagram rendering

### Backend & Data
- **Electron** — Desktop app shell
- **DuckDB** — Embedded analytics engine (handles 100GB+ files)
- **Groq AI** — SQL generation (Llama 3.3 70B)
- **Deepgram** — Real-time speech-to-text
- **Inworld AI** — Natural text-to-speech
- **Supabase** — Auth (Google OAuth) + saved prompts storage

### Architecture

```
┌─────────────┐
│    User     │
│ Voice/Text  │
└──────┬──────┘
       │
       ▼
┌─────────────────────────────────────┐
│        Electron Desktop App         │
│  • Next.js UI (static build)        │
│  • Voice Input (Deepgram)           │
│  • ER Diagram Visualization         │
│  • Google Auth (Supabase)           │
└──────┬──────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│         Data Pipeline               │
│  1. Connect → DuckDB import         │
│  2. Schema extraction               │
│  3. Groq → SQL generation           │
│  4. DuckDB → Query execution        │
│  5. Groq → Natural language answer  │
│  6. Inworld AI → Voice output       │
└──────┬──────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│         Data Sources                │
│  CSV │ MySQL │ PostgreSQL │ SQLite  │
└─────────────────────────────────────┘
```

## 🔧 Data Connection Flow

- **CSV**: Select file path → Connect → DuckDB imports directly from path
- **MySQL / PostgreSQL / SQLite**: Enter credentials → Connect → All tables imported into DuckDB
- **Disconnect**: All tables dropped, DuckDB wiped clean
- **App restart**: Automatic cleanup of previous session data

---

### ⭐ Star this repo if you find it useful!

This project is licensed under the **GNU General Public License v3.0** — see the [LICENSE](LICENSE) file for details.
