const { ipcMain, app } = require('electron');
const fs = require('fs');
const path = require('path');
const duckdbClient = require('./duckdb-client');

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
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
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
  });

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

// API call to Inworld TTS
async function callInworldTTS(text, apiKey, apiSecret) {
  const response = await fetch('https://api.inworld.ai/tts/v1/voice', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${Buffer.from(`${apiKey}:${apiSecret}`).toString('base64')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text: text.substring(0, 2000),
      voiceId: 'Dennis',
      modelId: 'inworld-tts-1.5-max',
      timestampType: 'TIMESTAMP_TYPE_UNSPECIFIED',
    }),
  });

  if (!response.ok) {
    return null; // Fallback to browser TTS
  }

  const data = await response.json();
  return data.audioContent;
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

    // Determine which tables to query based on csvFile path
    const tableFilter = (csvFile && csvFile !== 'duckdb://direct')
      ? `table_name NOT LIKE 'mysql_%' AND table_name NOT LIKE 'sqlite_%' AND table_name NOT LIKE 'postgres_%'`
      : `table_name LIKE 'mysql_%' OR table_name LIKE 'sqlite_%' OR table_name LIKE 'postgres_%'`;

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

    const textResponse = await callGroqAPI(formatPrompt, settings.groqApiKey);

    sendProgress('tts', 'Generating voice response...');

    // Generate TTS (only with API keys)
    let ttsData = { useBrowserTTS: false, text: textResponse, hasAudio: false };
    
    if (settings.inworldApiKey && settings.inworldApiSecret) {
      try {
        const audioContent = await callInworldTTS(textResponse, settings.inworldApiKey, settings.inworldApiSecret);
        if (audioContent) {
          ttsData = {
            useBrowserTTS: false,
            audioData: audioContent,
            mimeType: 'audio/wav',
            hasAudio: true
          };
        }
      } catch (error) {
        console.log('Inworld TTS failed, no audio will be generated');
      }
    }

    sendProgress('complete', 'Query completed successfully!');

    return {
      success: true,
      textResponse,
      sqlQuery,
      results: queryResults.slice(0, 100),
      totalRows: queryResults.length,
      tts: ttsData
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
    if (!settings.inworldApiKey || !settings.inworldApiSecret) {
      return {
        success: false,
        error: 'Inworld API keys are required for TTS'
      };
    }

    const audioContent = await callInworldTTS(text, settings.inworldApiKey, settings.inworldApiSecret);
    
    if (audioContent) {
      return {
        success: true,
        audioData: audioContent,
        mimeType: 'audio/wav'
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

module.exports = { queryDuckDB, callGroqAPI, callInworldTTS, setMainWindow };