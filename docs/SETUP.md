# Local Setup — SPARK Engine

> SPARK Engine is a native desktop app. There is no live web demo — you run it locally.
> This guide covers development setup, environment variables, and building the distributable installer.

---

## Prerequisites

- Node.js 20+
- npm 10+ (bundled with Node 20)
- Windows, macOS, or Linux desktop (Electron is required — no browser-only mode)
- A Groq API key (free tier works) — required to run any query
- Optionally: a Deepgram API key (voice input), Inworld API key + secret (voice output)

---

## 1. Clone and install

```bash
git clone https://github.com/tanisheesh/spark-engine
cd spark-engine
npm install
```

`postinstall` runs `electron-builder install-app-deps` automatically to rebuild any native modules (better-sqlite3) for the correct Electron ABI.

---

## 2. Build the Next.js UI

SPARK Engine loads a static Next.js build — there is no dev server. You must build before running the app.

```bash
npm run build
```

This outputs the static site to `out/`. Electron loads `out/index.html` directly.

---

## 3. Environment variables

Create a `.env` file at the project root (copy the values below and fill in your keys):

```bash
# Required — Supabase (auth + saved prompts)
NEXT_PUBLIC_SUPABASE_URL=https://<your-project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-supabase-anon-key>
```

> Groq, Deepgram, and Inworld keys are **not** in `.env` — they are entered by the user in the Settings modal inside the app and stored locally in `%APPDATA%\spark-engine\settings.json` (Windows) or `~/Library/Application Support/spark-engine/settings.json` (macOS).

| Variable | Where to get it |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase dashboard → Project Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase dashboard → Project Settings → API → anon (public) key |

### In-app settings (entered after launch)

| Setting | Where to get it |
|---|---|
| Groq API Key | [console.groq.com](https://console.groq.com) → API Keys |
| Deepgram API Key | [console.deepgram.com](https://console.deepgram.com) → API Keys (voice input only) |
| Inworld API Key | [studio.inworld.ai](https://studio.inworld.ai) → API keys (voice output only) |
| Inworld API Secret | Same location as above |

---

## 4. Supabase setup

You need one table in your Supabase project:

```sql
CREATE TABLE saved_prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  prompt_text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE saved_prompts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own prompts"
  ON saved_prompts
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

Enable Google as an auth provider in Supabase → Authentication → Providers → Google, and add your Google OAuth Client ID and Secret.

For OAuth to work in Electron, add `spark-engine://auth/callback` to the list of allowed redirect URIs in both Supabase and your Google Cloud OAuth credentials.

---

## 5. Run locally (development)

```bash
npm run app
```

This launches Electron and loads `out/index.html`. If you change any UI code, you must run `npm run build` again before restarting the app — there is no hot-reload in Electron mode.

DuckDB is auto-installed on first run. If you see a "DuckDB not found" error, restart the app — the installer runs once the window is shown.

---

## 6. Build the distributable installer

```bash
npm run dist
```

This runs `npm run build` (Next.js) then `electron-builder`. Output is in `release/`:

| Platform | Output |
|---|---|
| Windows | `SPARK Engine Setup 1.0.0.exe` (NSIS installer) |
| macOS | `SPARK Engine-1.0.0.dmg` |
| Linux | `SPARK Engine-1.0.0.AppImage` |

To build only for the current platform without creating an installer:

```bash
npm run pack
```

---

## 7. Data source setup (for testing)

Sample scripts are provided in `scripts/` to generate test databases:

```bash
# Generate a SQLite test database
node scripts/generate-sqlite-data.js

# Generate a MySQL test database (requires a running MySQL instance)
node scripts/generate-mysql-data.js

# Generate a PostgreSQL test database (requires a running PostgreSQL instance)
node scripts/generate-postgres-data.js

# Generate a large CSV (configurable row count)
python scripts/generate_csv.py
```

---

## Known local-only limitations

- **No hot-reload** — UI changes require a full `npm run build` + app restart.
- **DuckDB auto-install requires internet** — On first run, the DuckDB CLI binary is downloaded from the DuckDB GitHub releases. If you are offline, pre-place the correct binary in the app directory.
- **OAuth deep link requires registration** — The `spark-engine://auth/callback` URI must be registered in both Supabase and Google Cloud Console for OAuth to complete in Electron.
- **Large CSV imports block the progress panel** — Files over 500 MB are imported in a background subprocess; the UI shows a progress notification but the query input remains unavailable until import completes.
- **Windows-only AppData path** — Settings and uploads are stored in `%APPDATA%\spark-engine\`. On macOS the equivalent is `~/Library/Application Support/spark-engine/`.
