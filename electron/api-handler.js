const { ipcMain } = require('electron');
const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs');
const path = require('path');
const os = require('os');

const execAsync = promisify(exec);

// Settings directory
const settingsDir = path.join(os.homedir(), 'AppData', 'Roaming', 'spark-engine');
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

// Database operations with proper sanitization
async function queryDuckDB(sql, csvFile = null) {
  try {
    const dbFile = path.join(settingsDir, 'data.duckdb');
    const safeDbFile = path.resolve(dbFile);
    
    let tableName = null;
    let safeCsvFile = null;
    
    // Only process CSV file if provided
    if (csvFile) {
      // Sanitize table name - only allow alphanumeric and underscores
      const rawTableName = path.basename(csvFile, '.csv');
      tableName = rawTableName.replace(/[^a-zA-Z0-9_]/g, '_');
      
      // Validate table name
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tableName)) {
        throw new Error('Invalid table name format');
      }
      
      // Validate CSV file path exists and is accessible
      if (!fs.existsSync(csvFile)) {
        throw new Error('CSV file not found');
      }
      
      // Get absolute paths to prevent path traversal
      safeCsvFile = path.resolve(csvFile);
    }
    
    // Try local DuckDB first (from app directory)
    let duckdbCommand = 'duckdb';
    
    // In production, always try to use the local DuckDB first
    if (process.env.NODE_ENV === 'production' || !process.env.NODE_ENV) {
      const appDir = path.dirname(process.execPath);
      const resourcesDir = process.resourcesPath || path.join(appDir, 'resources');
      
      // Try multiple possible locations for packaged app
      const possiblePaths = [
        // Direct in app directory
        path.join(appDir, process.platform === 'win32' ? 'duckdb.exe' : 'duckdb'),
        // In resources directory
        path.join(resourcesDir, process.platform === 'win32' ? 'duckdb.exe' : 'duckdb'),
        // In resources/app directory
        path.join(resourcesDir, 'app', process.platform === 'win32' ? 'duckdb.exe' : 'duckdb'),
        // Alternative path structure
        path.join(appDir, 'resources', 'app', process.platform === 'win32' ? 'duckdb.exe' : 'duckdb'),
        // Another common location
        path.join(process.cwd(), process.platform === 'win32' ? 'duckdb.exe' : 'duckdb')
      ];
      
      let duckdbFound = false;
      for (const duckdbPath of possiblePaths) {
        console.log(`🔍 Checking DuckDB at: ${duckdbPath}`);
        if (fs.existsSync(duckdbPath)) {
          try {
            // Test if DuckDB works
            await execAsync(`"${path.resolve(duckdbPath)}" --version`, { timeout: 10000 });
            duckdbCommand = `"${path.resolve(duckdbPath)}"`;
            duckdbFound = true;
            console.log(`✅ Found working DuckDB at: ${duckdbPath}`);
            break;
          } catch (testError) {
            console.log(`❌ DuckDB at ${duckdbPath} not working:`, testError.message);
          }
        } else {
          console.log(`❌ DuckDB not found at: ${duckdbPath}`);
        }
      }
      
      if (!duckdbFound) {
        console.error('❌ DuckDB not found in any location. Attempting system fallback...');
        // Try system DuckDB as last resort
        try {
          await execAsync('duckdb --version', { timeout: 5000 });
          duckdbCommand = 'duckdb';
          console.log('✅ Using system DuckDB');
        } catch (systemError) {
          throw new Error('DuckDB not found. Please restart the application to auto-install DuckDB, or install DuckDB manually.');
        }
      }
    } else {
      // Development mode - try local first, then system
      const appDir = path.dirname(process.execPath);
      const localDuckDB = path.join(appDir, process.platform === 'win32' ? 'duckdb.exe' : 'duckdb');
      
      if (fs.existsSync(localDuckDB)) {
        duckdbCommand = `"${path.resolve(localDuckDB)}"`;
      }
      // Otherwise use system duckdb
    }
    
    // Ensure table exists with parameterized approach (only if CSV file provided)
    if (csvFile && safeCsvFile && tableName) {
      const createTableCmd = [
        duckdbCommand,
        `"${safeDbFile}"`,
        '-c',
        `"CREATE TABLE IF NOT EXISTS ${tableName} AS SELECT * FROM '${safeCsvFile}'"`
      ];
      
      await execAsync(createTableCmd.join(' '), { timeout: 60000 });
    }
    
    // Execute query with sanitized SQL
    const normalizedSql = sql.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
    
    // Basic SQL injection prevention - validate SQL structure
    if (!normalizedSql.match(/^(SELECT|WITH)/i)) {
      throw new Error('Only SELECT queries are allowed');
    }
    
    // Escape quotes in SQL
    const escapedSql = normalizedSql.replace(/"/g, '\\"');
    
    const queryCmd = [
      duckdbCommand,
      `"${safeDbFile}"`,
      '-json',
      '-c',
      `"${escapedSql}"`
    ];
    
    const { stdout } = await execAsync(queryCmd.join(' '), { 
      maxBuffer: 50 * 1024 * 1024,
      timeout: 30000 
    });
    
    if (!stdout || !stdout.trim()) return [];
    
    try {
      const result = JSON.parse(stdout.trim());
      return Array.isArray(result) ? result : [result];
    } catch (e) {
      const lines = stdout.trim().split('\n').filter(line => line.trim());
      return lines.map(line => JSON.parse(line));
    }
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
      model: 'llama-3.3-70b-versatile',
      messages,
      temperature: 0.1,
    }),
  });

  if (!response.ok) {
    throw new Error(`Groq API error: ${response.status}`);
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
    
    // Try local DuckDB first
    let duckdbCommand = 'duckdb';
    if (process.env.NODE_ENV === 'production' || !process.env.NODE_ENV) {
      const appDir = path.dirname(process.execPath);
      const resourcesDir = process.resourcesPath || path.join(appDir, 'resources');
      const possiblePaths = [
        path.join(appDir, process.platform === 'win32' ? 'duckdb.exe' : 'duckdb'),
        path.join(resourcesDir, process.platform === 'win32' ? 'duckdb.exe' : 'duckdb'),
        path.join(resourcesDir, 'app', process.platform === 'win32' ? 'duckdb.exe' : 'duckdb'),
        path.join(appDir, 'resources', 'app', process.platform === 'win32' ? 'duckdb.exe' : 'duckdb'),
        path.join(process.cwd(), process.platform === 'win32' ? 'duckdb.exe' : 'duckdb')
      ];
      
      for (const duckdbPath of possiblePaths) {
        if (fs.existsSync(duckdbPath)) {
          try {
            await execAsync(`"${path.resolve(duckdbPath)}" --version`, { timeout: 10000 });
            duckdbCommand = `"${path.resolve(duckdbPath)}"`;
            break;
          } catch (testError) {
            // Continue to next path
          }
        }
      }
    }

    // Get list of all tables in DuckDB based on connection type
    let tableFilter = '';
    
    // Determine which tables to query based on csvFile path
    if (csvFile && csvFile !== 'duckdb://direct') {
      // CSV file - query only CSV tables (no prefix)
      tableFilter = `"SELECT table_name FROM information_schema.tables WHERE table_schema='main' AND table_name NOT LIKE 'mysql_%' AND table_name NOT LIKE 'sqlite_%' AND table_name NOT LIKE 'postgres_%'"`;
    } else {
      // Database connection - query only database tables (with prefix)
      tableFilter = `"SELECT table_name FROM information_schema.tables WHERE table_schema='main' AND (table_name LIKE 'mysql_%' OR table_name LIKE 'sqlite_%' OR table_name LIKE 'postgres_%')"`;
    }
    
    const listTablesCmd = [
      duckdbCommand,
      `"${safeDbFile}"`,
      '-json',
      '-c',
      tableFilter
    ];
    
    console.log('🔍 Executing table list command:', listTablesCmd.join(' '));
    const { stdout: tablesOutput } = await execAsync(listTablesCmd.join(' '), { timeout: 10000 });
    console.log('📋 Raw tables output:', tablesOutput);
    
    const tables = JSON.parse(tablesOutput.trim() || '[]');
    console.log('📋 Parsed tables:', JSON.stringify(tables));
    
    if (tables.length === 0) {
      // Try without filter to see all tables
      const allTablesCmd = [
        duckdbCommand,
        `"${safeDbFile}"`,
        '-json',
        '-c',
        `"SELECT table_name FROM information_schema.tables WHERE table_schema='main'"`
      ];
      const { stdout: allTablesOutput } = await execAsync(allTablesCmd.join(' '), { timeout: 10000 });
      console.log('📋 ALL tables in database:', allTablesOutput);
      
      throw new Error('No tables found in database. Please connect to a database first.');
    }
    
    console.log('📋 Available tables:', tables.map(t => t.table_name).join(', '));

    // Get schema for all tables
    let allSchemas = [];
    for (const table of tables) {
      const tableName = table.table_name;
      const schemaQuery = `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = '${tableName}'`;
      const schemaCmd = [
        duckdbCommand,
        `"${safeDbFile}"`,
        '-json',
        '-c',
        `"${schemaQuery}"`
      ];
      
      const { stdout: schemaOutput } = await execAsync(schemaCmd.join(' '), { timeout: 10000 });
      const schema = JSON.parse(schemaOutput.trim() || '[]');
      
      if (schema.length > 0) {
        const schemaText = schema.map(row => `${row.column_name} (${row.data_type})`).join(', ');
        allSchemas.push(`Table: ${tableName}\nColumns: ${schemaText}`);
      }
    }

    sendProgress('sample', 'Getting sample data...');

    // Get sample data from first table
    const firstTable = tables[0].table_name;
    const sampleQuery = `SELECT * FROM ${firstTable} LIMIT 3`;
    const sampleCmd = [
      duckdbCommand,
      `"${safeDbFile}"`,
      '-json',
      '-c',
      `"${sampleQuery}"`
    ];
    
    const { stdout: sampleOutput } = await execAsync(sampleCmd.join(' '), { timeout: 10000 });
    const sampleData = JSON.parse(sampleOutput.trim() || '[]');

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
    
    const escapedSql = normalizedSql.replace(/"/g, '\\"');
    const queryCmd = [
      duckdbCommand,
      `"${safeDbFile}"`,
      '-json',
      '-c',
      `"${escapedSql}"`
    ];
    
    const { stdout: queryOutput } = await execAsync(queryCmd.join(' '), { 
      maxBuffer: 50 * 1024 * 1024,
      timeout: 30000 
    });
    
    let queryResults = [];
    if (queryOutput && queryOutput.trim()) {
      try {
        const result = JSON.parse(queryOutput.trim());
        queryResults = Array.isArray(result) ? result : [result];
      } catch (e) {
        const lines = queryOutput.trim().split('\n').filter(line => line.trim());
        queryResults = lines.map(line => JSON.parse(line));
      }
    }

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