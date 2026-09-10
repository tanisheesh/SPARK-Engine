const { ipcMain, app } = require('electron');
const fs = require('fs');
const path = require('path');
const duckdbClient = require('./duckdb-client');
const localLlmClient = require('./local-llm-client');
const sourceRegistry = require('./source-registry');
const policy = require('./privacy/policy');
const sqlGuard = require('./privacy/sql-guard');
const profiler = require('./privacy/synthesize');
const tokenizer = require('./privacy/tokenize');
const audit = require('./privacy/audit');

// Settings directory - cross-platform (Windows: %APPDATA%, macOS: ~/Library/Application Support)
const settingsDir = app.getPath('userData');
const uploadsDir = path.join(settingsDir, 'uploads');
const settingsFile = path.join(settingsDir, 'settings.json');

audit.init(settingsDir);

// Store mainWindow reference
let mainWindow = null;

// Function to set mainWindow reference
function setMainWindow(window) {
  mainWindow = window;
}

// Helper function to send progress updates
function sendProgress(stage, message) {
  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.send('query-progress', { stage, message });
  }
}

// Database operations - native DuckDB bindings, no CLI/shell involved
async function queryDuckDB(sql, csvFile = null) {
  try {
    const dbFile = path.join(settingsDir, 'data.duckdb');
    const safeDbFile = path.resolve(dbFile);

    // Only process CSV file if provided
    if (csvFile) {
      const rawTableName = path.basename(csvFile, '.csv');
      const tableName = rawTableName.replace(/[^a-zA-Z0-9_]/g, '_');
      duckdbClient.assertValidIdentifier(tableName);

      if (!fs.existsSync(csvFile)) {
        throw new Error('CSV file not found');
      }

      const safeCsvFile = path.resolve(csvFile);
      await duckdbClient.importCSV(safeDbFile, tableName, safeCsvFile, { replace: false });
    }

    // Same guard as the main query path. This helper has no caller today but is
    // exported, so leaving the old leading-keyword check here would just be a
    // second, weaker door into the same database.
    const normalizedSql = sqlGuard.assertSafeSelect(sql);

    return await duckdbClient.all(safeDbFile, normalizedSql);
  } catch (error) {
    console.error('Database error:', error);
    throw new Error(`Database query failed: ${error.message}`);
  }
}

// API call to Groq.
//
// Every privacy control that has to be unbypassable lives HERE rather than in
// the callers: the network-mode guard, the outbound tripwire, and the audit
// record all act on the exact string handed to fetch. Putting them in the
// transport means a future code path cannot route around them by accident.
async function callGroqAPI(messages, apiKey, privacyCtx = {}) {
  const level = privacyCtx.level || policy.DEFAULTS.level;
  policy.assertNetworkAllowed(level, 'Groq');

  const bodyString = JSON.stringify({
    model: 'openai/gpt-oss-120b',
    messages,
    temperature: 0.1,
    reasoning_effort: 'low',
  });

  // Tripwire: if any real value survived tokenization — a nested STRUCT/LIST
  // column, a Date that serializes differently than it compares, a value that
  // also appears inside the SQL string — the request never leaves the machine.
  try {
    tokenizer.assertNoRealValues(bodyString, privacyCtx.vault);
  } catch (err) {
    audit.recordBlocked({
      provider: 'groq',
      callKind: privacyCtx.callKind,
      privacyLevel: level,
      reason: err.message,
    });
    throw err;
  }

  const startedAt = Date.now();
  const auditId = audit.recordOutbound({
    provider: 'groq',
    endpoint: 'https://api.groq.com/openai/v1/chat/completions',
    model: 'openai/gpt-oss-120b',
    callKind: privacyCtx.callKind || 'unknown',
    privacyLevel: level,
    bodyString,
    tokensRedacted: privacyCtx.tokensRedacted || 0,
    retainPayload: privacyCtx.retainPayload === true,
  });

  // A hung/stalled Groq call (not just an error response) must still time out,
  // otherwise generateText()'s fallback to the local model never kicks in.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  let response;
  try {
    response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: bodyString,
      signal: controller.signal,
    });
  } catch (error) {
    audit.recordOutcome(auditId, { status: 'error', durationMs: Date.now() - startedAt });
    if (error.name === 'AbortError') {
      throw new Error('Groq request timed out after 15s');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    let errorDetail = `HTTP ${response.status}`;
    try {
      const errBody = await response.json();
      errorDetail = errBody?.error?.message || JSON.stringify(errBody);
    } catch (_) {
      errorDetail = await response.text().catch(() => `HTTP ${response.status}`);
    }
    console.error('Groq API error:', response.status, errorDetail);
    throw new Error(`Groq API error (${response.status}): ${errorDetail}`);
  }

  const data = await response.json();
  audit.recordOutcome(auditId, { status: 'ok', durationMs: Date.now() - startedAt });
  return data.choices?.[0]?.message?.content?.trim() || '';
}

// Tries Groq first (fast, high quality); if there's no API key or the call
// fails (network error, Groq outage, rate limit), falls back to the bundled
// local model so the app keeps working offline / when Groq is down.
//
// In Local-only mode Groq is skipped entirely rather than tried-and-failed, so
// no request is ever constructed for it.
async function generateText(messages, apiKey, privacyCtx = {}) {
  const level = privacyCtx.level || policy.DEFAULTS.level;
  const caps = policy.capabilities(level);
  const cloudAllowed = privacyCtx.callKind === 'sql-gen' ? caps.cloudSqlGen : caps.cloudFormat;

  if (apiKey && cloudAllowed) {
    try {
      const text = await callGroqAPI(messages, apiKey, privacyCtx);
      return { text, source: 'groq' };
    } catch (error) {
      // A tripwire block is a privacy failure, not a transient one. Falling back
      // would re-send the same unsafe payload to the local model, which is safe,
      // but the error must not be swallowed as if Groq were merely down.
      console.warn('⚠️ Groq call failed, falling back to local model:', error.message);
    }
  }

  if (!localLlmClient.isModelAvailable()) {
    // Local-only mode deliberately refuses to reach the network, so an absent
    // model is a setup problem rather than an outage. Say so precisely instead
    // of reporting it as a Groq failure the user cannot act on.
    if (!cloudAllowed) {
      throw new Error(
        'Privacy mode is Local-only, but no local model is installed. ' +
        'Run "npm run fetch-model" to download it (about 1 GB), or switch to Standard or Strict mode in Settings.'
      );
    }
    throw new Error(apiKey
      ? 'Groq request failed and no local fallback model is bundled.'
      : 'Groq API key is required (no local fallback model is bundled).');
  }

  const systemPrompt = messages.find(m => m.role === 'system')?.content || '';
  const userPrompt = messages.find(m => m.role === 'user')?.content || '';
  const text = await localLlmClient.complete(systemPrompt, userPrompt);
  return { text, source: 'local' };
}

// API call to Deepgram Aura TTS - same API key as the existing voice-input
// (STT) setup, single credential instead of Inworld's key+secret+workspace.
async function callDeepgramTTS(text, apiKey) {
  // Same reasoning as callGroqAPI: a hung request must still time out so the
  // caller's try/catch (which falls back to browser TTS) actually runs.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  let response;
  try {
    response = await fetch('https://api.deepgram.com/v1/speak?model=aura-2-thalia-en&encoding=mp3', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text: text.substring(0, 2000) }),
      signal: controller.signal,
    });
  } catch (error) {
    return null; // Timed out or network error - fall back to browser TTS
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    return null; // Fallback to browser TTS
  }

  // Deepgram returns raw audio bytes (not JSON) - base64-encode to match the
  // string format the renderer's atob()-based playback code expects.
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer).toString('base64');
}

// Last rung of the fallback ladder: a correct, if plain, answer composed
// entirely on this machine. Used when the model's token round-trip fails, so a
// privacy failure degrades the prose rather than either leaking a value or
// showing the user a sentence full of raw SPK_Vn tokens.
function composeLocalAnswer(question, rows) {
  const n = rows.length;
  if (n === 0) return `No rows matched "${question}".`;

  const first = rows[0];
  const keys = Object.keys(first).slice(0, 3);
  const summary = keys.map(k => `${k}: ${first[k]}`).join(', ');
  return n === 1
    ? `Found 1 result — ${summary}.`
    : `Found ${n} results. The first is ${summary}. The full set is in the table below.`;
}

/* Main query pipeline.
 *
 * Extracted from the ipcMain handler below so that callers other than the
 * renderer can run a question through the exact same path - specifically the
 * remote-session bridge in electron/remote/, which serves questions arriving
 * from the phone. Keeping one implementation is the point: a second copy of
 * this pipeline would be a second place for the privacy guarantees to drift.
 *
 * `onProgress(stage, message)` is optional and additive - the renderer keeps
 * receiving its 'query-progress' events exactly as before whether or not a
 * remote caller is also listening.
 */
async function processQuery({ question, csvFile, settings, voiceAllowed, wideTableColumnCap, conversationHistory, onProgress }) {
  try {
    // The privacy level is read from disk here, NOT taken from the renderer
    // argument. A renderer-supplied level could be silently downgraded by a bug
    // or a compromised page, and the audit log would then faithfully record the
    // downgraded level — worse than having no audit log.
    const privacyCfg = policy.loadPolicy(settingsFile);
    const privacyLevel = privacyCfg.level;
    const caps = policy.capabilities(privacyLevel);

    if (!settings.groqApiKey && caps.cloudSqlGen) {
      throw new Error('Groq API key is required');
    }

    // Send progress updates. The renderer's channel is unconditional so the
    // desktop UI behaves identically whether or not a phone is watching; the
    // remote listener is an extra subscriber, never a replacement.
    const sendProgress = (stage, message) => {
      if (mainWindow && mainWindow.webContents) {
        mainWindow.webContents.send('query-progress', { stage, message });
      }
      if (onProgress) {
        try {
          onProgress(stage, message);
        } catch (progressError) {
          // A dead remote socket must never take down a query the user is
          // still waiting on at the desktop.
          console.error('remote progress listener threw:', progressError.message);
        }
      }
    };

    sendProgress('schema', 'Analyzing data structure...');

    // Get all tables in DuckDB
    const dbFile = path.join(settingsDir, 'data.duckdb');
    const safeDbFile = path.resolve(dbFile);

    // Determine which tables to query based on csvFile path. An uploaded file
    // (CSV/Excel/JSON) passes a real path; a live database connection passes the
    // 'duckdb://direct' sentinel. Prefixes come from the source registry so a new
    // source only has to be declared in one place.
    const tableFilter = (csvFile && csvFile !== 'duckdb://direct')
      ? sourceRegistry.fileTableFilter()
      : sourceRegistry.dbTableFilter();

    const tables = await duckdbClient.getTables(safeDbFile, tableFilter);
    console.log('📋 Parsed tables:', JSON.stringify(tables));

    if (tables.length === 0) {
      throw new Error('No tables found in database. Please connect to a database first.');
    }

    console.log('📋 Available tables:', tables.map(t => t.table_name).join(', '));

    // Get schema for all tables
    let allSchemas = [];
    const tableColumns = [];
    for (const table of tables) {
      const tableName = table.table_name;
      const schema = await duckdbClient.getColumns(safeDbFile, tableName);

      if (schema.length > 0) {
        const schemaText = schema.map(row => `${row.column_name} (${row.data_type})`).join(', ');
        allSchemas.push(`Table: ${tableName}\nColumns: ${schemaText}`);
        tableColumns.push({ tableName, schema });
      }
    }

    sendProgress('sample', 'Profiling data format...');

    // PRIVACY: this used to be `SELECT * FROM <firstTable> LIMIT 3` — three
    // complete rows of real customer data, sent to Groq on every single query
    // even when the question never touched that table. The rows only ever
    // existed to show the model the data's FORMAT, so the format is now derived
    // locally and re-emitted as fabricated rows. Real values stay on the machine.
    const firstTable = tables[0].table_name;
    duckdbClient.assertValidIdentifier(firstTable);
    const runQuery = (sql) => duckdbClient.all(safeDbFile, sql);
    const tableProfile = await profiler.profileTable(
      runQuery,
      firstTable,
      (tableColumns.find(t => t.tableName === firstTable) || { schema: [] }).schema,
      // wideTableColumnCap comes from the renderer's tier-derived quota
      // (lib/spark/quotas.ts) — undefined/omitted falls back to
      // profileTable's own default so an older renderer build still works.
      { level: privacyLevel, columnCap: wideTableColumnCap }
    );
    const sampleBlock = profiler.buildSampleBlock(tableProfile, privacyCfg.syntheticRows);

    // Generate SQL using Groq with all table schemas. generateText() falls
    // back to the local model here too — when Local-only privacy mode
    // disables cloud SQL gen, or Groq errors out and a local model is
    // installed — same as the format step below; there is no SQL-specific
    // exception. A local-generated query is exactly the case most likely to
    // need a retry, since a small model is more likely to reference a
    // column that doesn't exist or write invalid syntax.
    const sqlSystemPrompt = `You are a SQL expert. Generate a DuckDB SQL query based on the user's question.

        Available Tables and Schemas:
        ${allSchemas.join('\n\n')}

        ${sampleBlock}

        SQL RULES:
        - Write simple, clean SQL queries
        - Use the correct table names from the schema above
        - You can JOIN multiple tables if needed
        - ALWAYS add LIMIT clause (max 10000 rows) unless user specifically asks for counts/aggregations
        - Use simple SELECT statements with GROUP BY and aggregations
        - Keep queries DuckDB-compatible
        - For LIKE operations on numeric columns, use CAST(column_name AS VARCHAR) or column_name::VARCHAR
        - For pattern matching on numbers, always cast to VARCHAR first: WHERE CAST(user_id AS VARCHAR) LIKE '11%'
        - For exact numeric matches, use = operator: WHERE user_id = 123
        - For numeric ranges, use comparison operators: WHERE user_id BETWEEN 100 AND 200

        Return ONLY the SQL query, nothing else.`;

    // Failed queries are retried with the error fed back as context — up to
    // 3 attempts total — instead of failing on the first bad query a model
    // writes. A syntax error or a reference to a column that doesn't exist
    // is exactly the kind of mistake a model can correct once it's told
    // what DuckDB actually said.
    const MAX_SQL_ATTEMPTS = 3;
    let sqlQuery, normalizedSql, queryResults;

    // Follow-up questions ("ab 20k karke batao" after a query limited to 10k)
    // only resolve if the model can see what was actually asked and run before
    // — so recent turns come in as real conversation turns, not a stateless
    // one-shot. Capped to the last few: each entry costs prompt tokens, and a
    // stale table/column reference from turn 1 shouldn't leak into turn 20.
    const historyMessages = [];
    if (Array.isArray(conversationHistory)) {
      for (const turn of conversationHistory.slice(-4)) {
        if (!turn || !turn.question) continue;
        historyMessages.push({ role: 'user', content: turn.question });
        historyMessages.push({
          role: 'assistant',
          content: turn.sql ? `SQL used: ${turn.sql}` : (turn.answer || ''),
        });
      }
    }

    let sqlMessages = [
      { role: 'system', content: sqlSystemPrompt },
      ...historyMessages,
      { role: 'user', content: question },
    ];

    for (let attempt = 1; attempt <= MAX_SQL_ATTEMPTS; attempt++) {
      sendProgress('sql', attempt === 1
        ? 'Generating SQL query...'
        : `Query failed — retrying with the error (attempt ${attempt} of ${MAX_SQL_ATTEMPTS})...`);

      const sqlGen = await generateText(sqlMessages, settings.groqApiKey, {
        level: privacyLevel,
        callKind: 'sql-gen',
        retainPayload: privacyCfg.auditRetainPayload,
      });
      let candidate = sqlGen.text.replace(/```sql\n?/g, '').replace(/```\n?/g, '').trim();

      // Auto-fix common type casting issues
      candidate = candidate.replace(/(\w+)\s+LIKE\s+('[^']*')/gi, (match, column, pattern) => {
        if (column.toLowerCase().includes('id') || column.toLowerCase().includes('user_id') || column.toLowerCase().includes('number')) {
          return `CAST(${column} AS VARCHAR) LIKE ${pattern}`;
        }
        return match;
      });

      try {
        // Execute SQL query directly on DuckDB.
        //
        // The old check was `/^(SELECT|WITH)/i` on the raw string, which inspected
        // the leading keyword and nothing else. That let a model completion like
        //   SELECT * FROM read_csv_auto('C:/Users/<user>/Documents/payroll.csv')
        // execute, and its rows then flowed into the formatting prompt and out to
        // Groq. The guard strips comments, rejects stacked statements, denies
        // file/network table functions, enforces the row cap, and — the actual
        // control — requires every relation to be one of the tables we imported.
        const normalized = sqlGuard.assertSafeSelect(candidate, {
          allowedTables: tables.map(t => t.table_name),
        });

        sendProgress('execute', 'Executing database query...');
        const rows = await duckdbClient.all(safeDbFile, normalized);

        sqlQuery = candidate;
        normalizedSql = normalized;
        queryResults = rows;
        break;
      } catch (err) {
        if (attempt === MAX_SQL_ATTEMPTS) throw err;
        console.warn(`⚠️ SQL attempt ${attempt} failed, retrying with error context:`, err.message);
        sqlMessages = [
          ...sqlMessages,
          { role: 'assistant', content: candidate },
          {
            role: 'user',
            content: `That query failed with this error: ${err.message}\n\n` +
              `Write a corrected DuckDB SQL query that fixes this. Return ONLY the SQL query, nothing else.`,
          },
        ];
      }
    }

    sendProgress('format', 'Formatting response...');

    // PRIVACY: this used to send up to 5 complete rows of real answer data to
    // Groq, unredacted. Values are now swapped for opaque SPK_Vn tokens and put
    // back on this side of the network, so the model composes the sentence
    // without ever seeing a real value. The vault is per-request and in-memory
    // only — never persisted, never returned over IPC, never logged.
    // In Local-only mode the formatting call never leaves this machine, so
    // tokenizing would only hand the local model placeholders instead of real
    // values — degrading an already-weak model's phrasing for no privacy gain.
    const limitedResults = queryResults.slice(0, 5);
    const { rows: safeRows, vault, legend, tokenCount } = caps.cloudFormat
      ? tokenizer.tokenizeRows(limitedResults, { level: privacyLevel })
      : { rows: limitedResults, vault: null, legend: '', tokenCount: 0 };

    const formatPrompt = [
      {
        role: 'system',
        content: [
          'You are summarizing a database result for a non-technical user.',
          '',
          'The data below is REDACTED. Every SPK_Vn token stands for a real value',
          'you are not permitted to see. Rules, in priority order:',
          '1. Copy every SPK_Vn token character-for-character. Never change case,',
          '   never add or remove underscores, never swap one token for another.',
          '2. Never invent a SPK_Vn token that does not appear in the data below.',
          '3. Never guess or describe what a token "probably" contains.',
          '4. Write one to three sentences of plain prose. No markdown, no lists.',
        ].join('\n')
      },
      {
        role: 'user',
        content: `Question: ${question}\n\nSQL Query: ${sqlQuery}\n\n` +
          `Results Summary: Found ${queryResults.length} total rows. ` +
          `Sample data: ${JSON.stringify(safeRows)}` +
          (legend ? `\n\n${legend}` : '')
      }
    ];

    const formatGen = await generateText(formatPrompt, settings.groqApiKey, {
      level: privacyLevel,
      callKind: 'format',
      retainPayload: privacyCfg.auditRetainPayload,
      vault,
      tokensRedacted: tokenCount,
    });

    // Substitution is all-or-nothing. A half-substituted sentence ("SPK_V7 has
    // the highest balance at $84,200") reads as a bug to the user and as a leak
    // to an auditor, so anything short of a clean round trip falls through to a
    // deterministic sentence composed entirely on this machine.
    const detok = tokenCount
      ? tokenizer.detokenize(formatGen.text, vault)
      : { text: formatGen.text, ok: true, recovered: 0, unknown: [] };

    let textResponse;
    if (detok.ok) {
      textResponse = detok.text;
      if (detok.recovered > 0) {
        console.warn(`⚠️ Recovered ${detok.recovered} mangled token(s) from the model response`);
      }
    } else {
      console.warn('⚠️ Token round-trip failed (unknown:', detok.unknown.join(', ') || 'none',
        ') — using local template instead');
      textResponse = composeLocalAnswer(question, queryResults);
    }

    if (formatGen.source === 'local') {
      sendProgress('format', 'Groq unavailable — using local model to phrase the response...');
    }
    const usedLocalFallback = formatGen.source === 'local';

    // Generate TTS (only with API keys)
    let ttsData = { useBrowserTTS: false, text: textResponse, hasAudio: false };

    // PRIVACY: the answer text here is fully detokenized — it contains the real
    // values. Sending it to Deepgram would hand a second vendor exactly what we
    // just withheld from Groq, so Strict and Local-only use browser TTS instead.
    // voiceAllowed carries the renderer's tier check (voice is IGNITE and
    // up) — the main process has no notion of subscription tier on its own,
    // so this is the one place that check actually gets enforced for the
    // auto-play-on-completion path, not just the manual "speak" button.
    // The stage is only announced when an attempt will actually happen — a
    // FREE-tier query should never show a "Synthesising voice" step at all.
    if (voiceAllowed && settings.deepgramApiKey && caps.cloudTts) {
      sendProgress('tts', 'Generating voice response...');
      try {
        const audioContent = await callDeepgramTTS(textResponse, settings.deepgramApiKey);
        if (audioContent) {
          ttsData = {
            useBrowserTTS: false,
            audioData: audioContent,
            mimeType: 'audio/mpeg',
            hasAudio: true
          };
        }
      } catch (error) {
        console.log('Deepgram TTS failed, no audio will be generated');
      }
    }

    sendProgress('complete', 'Query completed successfully!');

    return {
      success: true,
      textResponse,
      sqlQuery,
      results: queryResults.slice(0, 100),
      totalRows: queryResults.length,
      tts: ttsData,
      usedLocalFallback,
      // Surfaced so the UI can show a truthful privacy badge. Note this carries
      // the COUNT of redacted values, never the vault contents — those would
      // land in localStorage via the renderer's conversation history and
      // outlive the process.
      privacy: {
        level: privacyLevel,
        tokensRedacted: tokenCount,
        syntheticSample: true,
      }
    };

  } catch (error) {
    if (mainWindow && mainWindow.webContents) {
      mainWindow.webContents.send('query-progress', {
        stage: 'error',
        message: `Query failed: ${error.message}`
      });
    }
    if (onProgress) {
      try {
        onProgress('error', `Query failed: ${error.message}`);
      } catch (progressError) {
        console.error('remote progress listener threw:', progressError.message);
      }
    }
    return {
      success: false,
      error: error.message
    };
  }
}

// The renderer's entry point into the pipeline above - unchanged in shape and
// payload from before the extraction.
ipcMain.handle('process-query', async (event, payload) => processQuery(payload || {}));

// Separate TTS generation handler
ipcMain.handle('generate-tts', async (event, { text, settings, voiceAllowed }) => {
  try {
    if (!voiceAllowed) {
      return {
        success: false,
        error: 'Voice is not available on your current plan'
      };
    }
    if (!settings.deepgramApiKey) {
      return {
        success: false,
        error: 'Deepgram API key is required for TTS'
      };
    }

    const audioContent = await callDeepgramTTS(text, settings.deepgramApiKey);

    if (audioContent) {
      return {
        success: true,
        audioData: audioContent,
        mimeType: 'audio/mpeg'
      };
    } else {
      return {
        success: false,
        error: 'Failed to generate TTS audio'
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
});

module.exports = { queryDuckDB, callGroqAPI, callDeepgramTTS, setMainWindow, processQuery };