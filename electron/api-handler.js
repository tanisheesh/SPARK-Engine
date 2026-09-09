const { ipcMain, app } = require('electron');
const fs = require('fs');
const path = require('path');
const duckdbClient = require('./duckdb-client');
const localLlmClient = require('./local-llm-client');
const sourceRegistry = require('./source-registry');

// Settings directory - cross-platform (Windows: %APPDATA%, macOS: ~/Library/Application Support)
const settingsDir = app.getPath('userData');
const uploadsDir = path.join(settingsDir, 'uploads');

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

    // Execute query with sanitized SQL
    const normalizedSql = sql.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();

    // Basic SQL injection prevention - only SELECT/WITH allowed
    if (!normalizedSql.match(/^(SELECT|WITH)/i)) {
      throw new Error('Only SELECT queries are allowed');
    }

    return await duckdbClient.all(safeDbFile, normalizedSql);
  } catch (error) {
    console.error('Database error:', error);
    throw new Error(`Database query failed: ${error.message}`);
  }
}

// API call to Groq
async function callGroqAPI(messages, apiKey) {
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
      body: JSON.stringify({
        model: 'openai/gpt-oss-120b',
        messages,
        temperature: 0.1,
        reasoning_effort: 'low',
      }),
      signal: controller.signal,
    });
  } catch (error) {
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
  return data.choices?.[0]?.message?.content?.trim() || '';
}

// Tries Groq first (fast, high quality); if there's no API key or the call
// fails (network error, Groq outage, rate limit), falls back to the bundled
// local model so the app keeps working offline / when Groq is down.
async function generateText(messages, apiKey) {
  if (apiKey) {
    try {
      const text = await callGroqAPI(messages, apiKey);
      return { text, source: 'groq' };
    } catch (error) {
      console.warn('⚠️ Groq call failed, falling back to local model:', error.message);
    }
  }

  if (!localLlmClient.isModelAvailable()) {
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

// Main query handler with progress updates
ipcMain.handle('process-query', async (event, { question, csvFile, settings }) => {
  try {
    if (!settings.groqApiKey) {
      throw new Error('Groq API key is required');
    }

    // Send progress updates
    const sendProgress = (stage, message) => {
      if (mainWindow && mainWindow.webContents) {
        mainWindow.webContents.send('query-progress', { stage, message });
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
    for (const table of tables) {
      const tableName = table.table_name;
      const schema = await duckdbClient.getColumns(safeDbFile, tableName);

      if (schema.length > 0) {
        const schemaText = schema.map(row => `${row.column_name} (${row.data_type})`).join(', ');
        allSchemas.push(`Table: ${tableName}\nColumns: ${schemaText}`);
      }
    }

    sendProgress('sample', 'Getting sample data...');

    // Get sample data from first table
    const firstTable = tables[0].table_name;
    duckdbClient.assertValidIdentifier(firstTable);
    const sampleData = await duckdbClient.all(safeDbFile, `SELECT * FROM "${firstTable}" LIMIT 3`);

    sendProgress('sql', 'Generating SQL query...');

    // Generate SQL using Groq with all table schemas
    const sqlPrompt = [
      {
        role: 'system',
        content: `You are a SQL expert. Generate a DuckDB SQL query based on the user's question.
        
        Available Tables and Schemas:
        ${allSchemas.join('\n\n')}
        
        Sample data from ${firstTable}: ${JSON.stringify(sampleData)}
        
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
        
        Return ONLY the SQL query, nothing else.`
      },
      {
        role: 'user',
        content: question
      }
    ];

    // SQL generation always goes through Groq - the 1.5B local model isn't
    // reliable enough at writing correct SQL against an arbitrary schema, so
    // there's no local fallback here (only for the NLP response-formatting step below).
    let sqlQuery = await callGroqAPI(sqlPrompt, settings.groqApiKey);
    sqlQuery = sqlQuery.replace(/```sql\n?/g, '').replace(/```\n?/g, '').trim();
    
    // Auto-fix common type casting issues
    sqlQuery = sqlQuery.replace(/(\w+)\s+LIKE\s+('[^']*')/gi, (match, column, pattern) => {
      if (column.toLowerCase().includes('id') || column.toLowerCase().includes('user_id') || column.toLowerCase().includes('number')) {
        return `CAST(${column} AS VARCHAR) LIKE ${pattern}`;
      }
      return match;
    });

    sendProgress('execute', 'Executing database query...');

    // Execute SQL query directly on DuckDB
    const normalizedSql = sqlQuery.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();

    if (!normalizedSql.match(/^(SELECT|WITH)/i)) {
      throw new Error('Only SELECT queries are allowed');
    }

    const queryResults = await duckdbClient.all(safeDbFile, normalizedSql);

    sendProgress('format', 'Formatting response...');

    // Format response using Groq
    const limitedResults = queryResults.slice(0, 5);
    const formatPrompt = [
      {
        role: 'system',
        content: 'You are a helpful assistant. Convert the query results into a natural, conversational response. Keep it concise and clear. If there are many rows, summarize the findings.'
      },
      {
        role: 'user',
        content: `Question: ${question}\n\nSQL Query: ${sqlQuery}\n\nResults Summary: Found ${queryResults.length} total rows. Sample data: ${JSON.stringify(limitedResults)}`
      }
    ];

    const formatGen = await generateText(formatPrompt, settings.groqApiKey);
    const textResponse = formatGen.text;
    if (formatGen.source === 'local') {
      sendProgress('format', 'Groq unavailable — using local model to phrase the response...');
    }
    const usedLocalFallback = formatGen.source === 'local';

    sendProgress('tts', 'Generating voice response...');

    // Generate TTS (only with API keys)
    let ttsData = { useBrowserTTS: false, text: textResponse, hasAudio: false };
    
    if (settings.deepgramApiKey) {
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
      usedLocalFallback
    };

  } catch (error) {
    if (mainWindow && mainWindow.webContents) {
      mainWindow.webContents.send('query-progress', { 
        stage: 'error', 
        message: `Query failed: ${error.message}` 
      });
    }
    return {
      success: false,
      error: error.message
    };
  }
});

// Separate TTS generation handler
ipcMain.handle('generate-tts', async (event, { text, settings }) => {
  try {
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

module.exports = { queryDuckDB, callGroqAPI, callDeepgramTTS, setMainWindow };