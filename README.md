# 🤖 SPARK ENGINE

### *Your Futuristic Voice-Enabled Data Analytics Companion*

[![Next.js](https://img.shields.io/badge/Next.js-16.1.2-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![DuckDB](https://img.shields.io/badge/DuckDB-Latest-yellow?style=for-the-badge&logo=duckdb)](https://duckdb.org/)
[![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)](LICENSE)

*Ask questions about your data in natural language and get intelligent voice responses*


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
- Typing animation effect

### 🗄️ Any CSV Works
- Zero configuration data loading
- Automatic schema detection
- Smart caching system
- Works with any structure

### 🧠 Self-Healing SQL
- Intelligent query generation
- Groq AI generates SQL
- Auto-fixes errors (3 retries)
- Natural language queries

### 🎨 Futuristic UI
- Beautiful dark-themed interface
- Animated female avatar
- Particle effects & glowing orbs
- Fully responsive design

### ⚡ Lightning Fast
- Optimized performance
- DuckDB for analytics
- Smart caching (instant reload)
- Turbopack compilation


## 🚀 Quick Start

### Prerequisites

- Node.js 18+ installed
- DuckDB CLI installed ([Download](https://duckdb.org/docs/installation/))
- A CSV file with your data

### Installation

```bash
# Clone the repository
git clone https://github.com/tanisheesh/nexus-ai.git
cd nexus-ai

# Install dependencies
npm install
```

### Environment Setup

Create `.env.local` with your API keys:

```env
# Groq API (for SQL generation)
GROQ_API_KEY=your_groq_api_key

# Deepgram API (for speech-to-text)
DEEPGRAM_API_KEY=your_deepgram_api_key
NEXT_PUBLIC_DEEPGRAM_API_KEY=your_deepgram_api_key

# Inworld AI (for text-to-speech)
INWORLD_WORKSPACE=your_workspace
INWORLD_API_KEY=your_api_key
INWORLD_API_SECRET=your_api_secret
```

### Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) 🎉


## 🛠️ Tech Stack

### Frontend
- **Next.js 16** - React framework with Turbopack
- **TypeScript** - Type-safe development
- **Framer Motion** - Smooth animations
- **Tailwind CSS v3** - Utility-first styling

### Backend
- **DuckDB** - Embedded analytics database
- **Groq AI** - SQL generation (Llama 3.3 70B)
- **Deepgram** - Real-time speech-to-text
- **Inworld AI** - Natural text-to-speech

### Architecture

```
┌─────────────┐
│   User      │
│  (Voice)    │
└──────┬──────┘
       │
       ▼
┌─────────────────────────────────────┐
│         Frontend (Next.js)          │
│  • Voice Input (Deepgram WebSocket) │
│  • Animated Avatar UI               │
│  • Real-time Transcription          │
└──────┬──────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│      Backend API Routes             │
│  • /api/query (Main Pipeline)       │
│  • /api/transcribe (STT)            │
│  • /api/tts (Voice Output)          │
└──────┬──────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│         Data Pipeline               │
│  1. CSV → DuckDB (Auto-load)        │
│  2. Schema Detection                │
│  3. Groq → SQL Generation           │
│  4. DuckDB → Query Execution        │
│  5. Groq → Natural Language         │
│  6. Inworld AI → Voice Output       │
└─────────────────────────────────────┘
```
## 🔧 Configuration

### Smart Caching

The app automatically caches loaded CSV files:

- **First run**: Loads CSV into DuckDB (one-time)
- **Subsequent runs**: Instant (uses cache)
- **CSV changed**: Auto-detects and reloads

---
### ⭐ Star this repo if you find it useful!

This project is licensed under the **GNU General Public License v3.0** - see the [LICENSE](LICENSE) file for details.