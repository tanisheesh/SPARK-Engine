const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const duckdbClient = require('./duckdb-client');
const { sanitizeIdentifier, prefixFor } = require('./source-registry');

// Database connector for MySQL, SQLite, PostgreSQL and Supabase
class DatabaseConnector {
  constructor() {
    this.dataDir = path.join(app.getPath('userData'), 'csv_data');
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
    this.dbFile = path.resolve(path.join(path.dirname(this.dataDir), 'data.duckdb'));
  }

  /**
   * Connect to MySQL and import directly to DuckDB
   */
  async connectMySQL(config) {
    try {
      console.log('🐬 Connecting to MySQL...', config);

      const mysql = require('mysql2/promise');

      // Create connection to verify credentials
      const connection = await mysql.createConnection({
        host: config.host,
        port: parseInt(config.port),
        user: config.user,
        password: config.password,
        database: config.database
      });

      console.log('✅ MySQL connected successfully');

      // Get all tables if no specific table provided
      let tables = [];
      if (config.table && config.table.trim()) {
        tables = [config.table];
      } else {
        const [tableRows] = await connection.execute('SHOW TABLES');
        tables = tableRows.map(row => Object.values(row)[0]);
        console.log(`📋 Found ${tables.length} tables:`, tables.join(', '));
      }

      await connection.end();

      const prefix = prefixFor('mysql');
      const tableNameFor = table => sanitizeIdentifier(`${prefix}${config.database}_${table}`);

      // STEP 1: Clean up old MySQL tables from DuckDB
      console.log('🧹 Cleaning up old MySQL tables...');
      try {
        const dropped = await duckdbClient.dropTablesWhere(this.dbFile, `table_name LIKE '${prefix}%'`);
        if (dropped > 0) console.log(`✅ Cleaned up ${dropped} old MySQL tables`);
      } catch (error) {
        console.log('⚠️ No old tables to clean up');
      }

      // STEP 2: Install MySQL extension
      console.log('📦 Installing MySQL extension...');
      try {
        await duckdbClient.execBatch(this.dbFile, ['INSTALL mysql', 'LOAD mysql']);
        console.log('✅ MySQL extension loaded');
      } catch (error) {
        console.log('⚠️ MySQL extension may already be installed');
      }

      const importedTables = [];
      let totalRows = 0;

      // STEP 3: Build connection string for DuckDB (values only, not user-controlled free text)
      const connectionString = `host=${config.host} port=${config.port} user=${config.user} password=${escapeSqlLiteral(config.password)} database=${config.database}`;

      // STEP 4: Build all SQL commands in one batch
      const sqlCommands = [`ATTACH '${connectionString}' AS mysql_source (TYPE mysql)`];

      for (const table of tables) {
        const sanitizedTableName = tableNameFor(table);
        sqlCommands.push(`DROP TABLE IF EXISTS "${sanitizedTableName}"`);
        sqlCommands.push(`CREATE TABLE "${sanitizedTableName}" AS SELECT * FROM mysql_source."${table}"`);
      }

      sqlCommands.push('DETACH mysql_source');

      console.log('📊 Importing all tables in batch...');
      try {
        await duckdbClient.execBatch(this.dbFile, sqlCommands);
        console.log('✅ Batch import completed');
      } catch (error) {
        console.error('❌ Batch import failed:', error.message);
        throw error;
      }

      // STEP 5: Get row counts for each table
      for (const table of tables) {
        const sanitizedTableName = tableNameFor(table);

        try {
          const result = await duckdbClient.all(this.dbFile, `SELECT COUNT(*) as count FROM "${sanitizedTableName}"`);
          const rowCount = result[0]?.count || 0;

          importedTables.push({ table, duckdbTable: sanitizedTableName, rows: rowCount });
          totalRows += rowCount;
          console.log(`  ✅ ${table}: ${rowCount} rows imported`);
        } catch (error) {
          console.error(`  ⚠️ Could not get count for ${table}`);
        }
      }

      console.log(`✅ MySQL import complete: ${importedTables.length} tables, ${totalRows} total rows`);

      return {
        success: true,
        message: `Imported ${importedTables.length} tables (${totalRows} rows) from MySQL`,
        tables: importedTables,
        totalRows,
        connectionType: 'mysql'
      };

    } catch (error) {
      console.error('❌ MySQL connection error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Connect to SQLite and import directly into DuckDB
   */
  async connectSQLite(config) {
    try {
      console.log('💾 Connecting to SQLite...', config);

      if (!fs.existsSync(config.filePath)) {
        throw new Error('SQLite database file not found');
      }

      // Node's built-in sqlite module — no native compile step, unlike
      // better-sqlite3, so this never blocks `npm install` on a machine
      // without build tools. Only used here to list table names; the
      // actual data import runs entirely through DuckDB's own sqlite
      // extension below.
      const { DatabaseSync } = require('node:sqlite');
      const db = new DatabaseSync(config.filePath, { readOnly: true });
      console.log('✅ SQLite connected successfully');

      // Get all tables
      let tables = [];
      if (config.table && config.table.trim()) {
        tables = [config.table];
      } else {
        const tableRows = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all();
        tables = tableRows.map(row => row.name);
        console.log(`📋 Found ${tables.length} tables:`, tables.join(', '));
      }

      db.close();

      const safeFilePath = path.resolve(config.filePath);
      const dbName = path.basename(config.filePath, '.db').replace(/[^a-zA-Z0-9_]/g, '_');

      const prefix = prefixFor('sqlite');

      // Clean up old sqlite tables
      console.log('🧹 Cleaning up old SQLite tables...');
      try {
        const dropped = await duckdbClient.dropTablesWhere(this.dbFile, `table_name LIKE '${prefix}%'`);
        if (dropped > 0) console.log(`✅ Cleaned up ${dropped} old SQLite tables`);
      } catch (e) { /* no old tables */ }

      // Import each table directly from SQLite file using DuckDB's sqlite extension
      console.log('📦 Installing SQLite extension...');
      try {
        await duckdbClient.execBatch(this.dbFile, ['INSTALL sqlite', 'LOAD sqlite']);
        console.log('✅ SQLite extension loaded');
      } catch (e) {
        console.log('⚠️ SQLite extension may already be installed');
      }

      // Build batch import SQL - ATTACH accepts a bound parameter for the file path,
      // so it runs separately (via run()) from the rest of the batch (via execBatch()).
      const sanitizedNames = tables.map(table => sanitizeIdentifier(`${prefix}${dbName}_${table}`));
      const restCommands = [];
      for (let i = 0; i < tables.length; i++) {
        restCommands.push(`DROP TABLE IF EXISTS "${sanitizedNames[i]}"`);
        restCommands.push(`CREATE TABLE "${sanitizedNames[i]}" AS SELECT * FROM sqlite_source."${tables[i]}"`);
      }
      restCommands.push('DETACH sqlite_source');

      console.log('📊 Importing all SQLite tables into DuckDB...');
      await duckdbClient.run(this.dbFile, 'ATTACH ? AS sqlite_source (TYPE sqlite)', [safeFilePath]);
      await duckdbClient.execBatch(this.dbFile, restCommands);

      // Get row counts
      const importedTables = [];
      let totalRows = 0;
      for (let i = 0; i < tables.length; i++) {
        const sanitizedName = sanitizedNames[i];
        try {
          const result = await duckdbClient.all(this.dbFile, `SELECT COUNT(*) as count FROM "${sanitizedName}"`);
          const rowCount = result[0]?.count || 0;
          importedTables.push({ table: tables[i], duckdbTable: sanitizedName, rows: rowCount });
          totalRows += rowCount;
          console.log(`  ✅ ${tables[i]}: ${rowCount} rows imported`);
        } catch (e) {
          console.error(`  ⚠️ Could not get count for ${tables[i]}`);
        }
      }

      console.log(`✅ SQLite import complete: ${importedTables.length} tables, ${totalRows} total rows`);

      return {
        success: true,
        message: `Imported ${importedTables.length} tables (${totalRows} rows) from SQLite`,
        tables: importedTables,
        totalRows,
        connectionType: 'sqlite'
      };

    } catch (error) {
      console.error('❌ SQLite connection error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Connect to PostgreSQL directly via DuckDB postgres extension.
   *
   * Supabase is Postgres over the wire, so it reuses this whole path - it only
   * varies the table prefix and requires TLS. Those are the `options`.
   */
  async connectPostgreSQL(config, options = {}) {
    const {
      prefix = 'postgres_',
      ssl = false,
      connectionType = 'postgresql',
      label = 'PostgreSQL'
    } = options;

    try {
      console.log(`🐘 Connecting to ${label}...`, redactConfig(config));

      const { Client } = require('pg');
      const client = new Client({
        host: config.host, port: parseInt(config.port),
        user: config.user, password: config.password, database: config.database,
        // Supabase terminates TLS with a cert this client has no CA for; the
        // connection is still encrypted, we just don't verify the chain.
        ...(ssl ? { ssl: { rejectUnauthorized: false } } : {})
      });
      await client.connect();
      console.log(`✅ ${label} connected successfully`);

      let tables = [];
      if (config.table && config.table.trim()) {
        tables = [config.table];
      } else {
        const result = await client.query(`SELECT tablename FROM pg_tables WHERE schemaname = 'public'`);
        tables = result.rows.map(row => row.tablename);
        console.log(`📋 Found ${tables.length} tables:`, tables.join(', '));
      }
      await client.end();

      const dbName = config.database.replace(/[^a-zA-Z0-9_]/g, '_');
      const tableNameFor = table => sanitizeIdentifier(`${prefix}${dbName}_${table}`);

      // Clean old tables for this source only
      console.log(`🧹 Cleaning up old ${label} tables...`);
      try {
        const dropped = await duckdbClient.dropTablesWhere(this.dbFile, `table_name LIKE '${prefix}%'`);
        if (dropped > 0) console.log(`✅ Cleaned up ${dropped} old ${label} tables`);
      } catch (e) { /* no old tables */ }

      // Install postgres extension
      console.log('📦 Installing PostgreSQL extension...');
      try {
        await duckdbClient.execBatch(this.dbFile, ['INSTALL postgres', 'LOAD postgres']);
        console.log('✅ PostgreSQL extension loaded');
      } catch (e) { console.log('⚠️ PostgreSQL extension may already be installed'); }

      // Build batch import SQL
      const sslParam = ssl ? ' sslmode=require' : '';
      const connStr = `host=${config.host} port=${config.port} user=${config.user} password=${escapeSqlLiteral(config.password)} dbname=${config.database}${sslParam}`;
      const sqlCommands = [`ATTACH '${connStr}' AS pg_source (TYPE postgres)`];
      for (const table of tables) {
        const sanitizedName = tableNameFor(table);
        sqlCommands.push(`DROP TABLE IF EXISTS "${sanitizedName}"`);
        sqlCommands.push(`CREATE TABLE "${sanitizedName}" AS SELECT * FROM pg_source."${table}"`);
      }
      sqlCommands.push('DETACH pg_source');

      console.log(`📊 Importing all ${label} tables into DuckDB...`);
      await duckdbClient.execBatch(this.dbFile, sqlCommands);

      // Get row counts
      const importedTables = [];
      let totalRows = 0;
      for (const table of tables) {
        const sanitizedName = tableNameFor(table);
        try {
          const result = await duckdbClient.all(this.dbFile, `SELECT COUNT(*) as count FROM "${sanitizedName}"`);
          const rowCount = result[0]?.count || 0;
          importedTables.push({ table, duckdbTable: sanitizedName, rows: rowCount });
          totalRows += rowCount;
          console.log(`  ✅ ${table}: ${rowCount} rows imported`);
        } catch (e) { console.error(`  ⚠️ Could not get count for ${table}`); }
      }

      console.log(`✅ ${label} import complete: ${importedTables.length} tables, ${totalRows} total rows`);
      return { success: true, message: `Imported ${importedTables.length} tables (${totalRows} rows) from ${label}`, tables: importedTables, totalRows, connectionType };

    } catch (error) {
      console.error(`❌ ${label} connection error:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Connect to a Supabase project. Supabase is managed Postgres, so this parses
   * the connection URI from the dashboard (Settings -> Database -> Connection
   * string) and hands it to the PostgreSQL path with TLS on and its own prefix.
   *
   * Taking the whole URI rather than separate host/port fields sidesteps the
   * IPv4/IPv6 split: direct db.<ref>.supabase.co hosts are IPv6-only on the free
   * tier, while the pooler host is IPv4. Whichever the user copies is the one used.
   */
  async connectSupabase(config) {
    let parsed;
    try {
      parsed = parseSupabaseConnectionString(config.connectionString);
    } catch (error) {
      return { success: false, error: error.message };
    }

    return this.connectPostgreSQL(
      { ...parsed, table: config.table },
      { prefix: 'supabase_', ssl: true, connectionType: 'supabase', label: 'Supabase' }
    );
  }

  /**
   * Main connect method - routes to appropriate database
   */
  async connect(type, config) {
    switch (type) {
      case 'mysql':
        return await this.connectMySQL(config);
      case 'sqlite':
        return await this.connectSQLite(config);
      case 'postgresql':
        return await this.connectPostgreSQL(config);
      case 'supabase':
        return await this.connectSupabase(config);
      default:
        return {
          success: false,
          error: 'Unsupported database type'
        };
    }
  }
}

// Doubles single quotes for safe interpolation into SQL string literals
// (connection strings built from config fields, not raw user SQL).
function escapeSqlLiteral(value) {
  return String(value).replace(/'/g, "''");
}

// Connection configs get logged on connect; keep the password out of the log.
function redactConfig(config) {
  const { password, connectionString, ...rest } = config || {};
  return { ...rest, ...(password ? { password: '***' } : {}) };
}

/**
 * Parse a Supabase/Postgres connection URI into discrete connection fields.
 * Accepts both the pooler and direct forms, e.g.
 *   postgresql://postgres.abcdefgh:PASSWORD@aws-0-ap-south-1.pooler.supabase.com:6543/postgres
 *   postgresql://postgres:PASSWORD@db.abcdefgh.supabase.co:5432/postgres
 */
function parseSupabaseConnectionString(uri) {
  const raw = String(uri || '').trim();
  if (!raw) {
    throw new Error('Paste your Supabase connection string (Dashboard → Settings → Database → Connection string).');
  }

  let parsed;
  try {
    parsed = new URL(raw);
  } catch (e) {
    throw new Error('That does not look like a valid connection string. It should start with postgresql://');
  }

  if (!/^postgres(ql)?:$/.test(parsed.protocol)) {
    throw new Error('Connection string must start with postgresql://');
  }
  if (!parsed.hostname) {
    throw new Error('Connection string is missing a host');
  }

  // Credentials are percent-encoded in a URI; Supabase passwords routinely
  // contain characters that get escaped, so decode before use.
  const user = decodeURIComponent(parsed.username || '');
  const password = decodeURIComponent(parsed.password || '');
  if (!user) throw new Error('Connection string is missing a username');
  if (!password) {
    throw new Error('Connection string has no password - replace [YOUR-PASSWORD] with your database password');
  }

  const database = parsed.pathname.replace(/^\//, '') || 'postgres';

  return {
    host: parsed.hostname,
    port: parsed.port || '5432',
    user,
    password,
    database
  };
}

module.exports = DatabaseConnector;
// Exposed for the schema extractor in main.js, which needs the same parse.
module.exports.parseSupabaseConnectionString = parseSupabaseConnectionString;
