const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const duckdbClient = require('./duckdb-client');

// Database connector for MySQL, SQLite, PostgreSQL
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

      // STEP 1: Clean up old MySQL tables from DuckDB
      console.log('🧹 Cleaning up old MySQL tables...');
      try {
        const dropped = await duckdbClient.dropTablesWhere(this.dbFile, `table_name LIKE 'mysql_%'`);
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
        const sanitizedTableName = `mysql_${config.database}_${table}`.replace(/[^a-zA-Z0-9_]/g, '_');
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
        const sanitizedTableName = `mysql_${config.database}_${table}`.replace(/[^a-zA-Z0-9_]/g, '_');

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

      const Database = require('better-sqlite3');
      const db = new Database(config.filePath, { readonly: true });
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

      // Clean up old sqlite tables
      console.log('🧹 Cleaning up old SQLite tables...');
      try {
        const dropped = await duckdbClient.dropTablesWhere(this.dbFile, `table_name LIKE 'sqlite_%'`);
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
      const sanitizedNames = tables.map(table => `sqlite_${dbName}_${table}`.replace(/[^a-zA-Z0-9_]/g, '_'));
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
   * Connect to PostgreSQL directly via DuckDB postgres extension
   */
  async connectPostgreSQL(config) {
    try {
      console.log('🐘 Connecting to PostgreSQL...', config);

      const { Client } = require('pg');
      const client = new Client({
        host: config.host, port: parseInt(config.port),
        user: config.user, password: config.password, database: config.database
      });
      await client.connect();
      console.log('✅ PostgreSQL connected successfully');

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

      // Clean old postgres tables
      console.log('🧹 Cleaning up old PostgreSQL tables...');
      try {
        const dropped = await duckdbClient.dropTablesWhere(this.dbFile, `table_name LIKE 'postgres_%'`);
        if (dropped > 0) console.log(`✅ Cleaned up ${dropped} old PostgreSQL tables`);
      } catch (e) { /* no old tables */ }

      // Install postgres extension
      console.log('📦 Installing PostgreSQL extension...');
      try {
        await duckdbClient.execBatch(this.dbFile, ['INSTALL postgres', 'LOAD postgres']);
        console.log('✅ PostgreSQL extension loaded');
      } catch (e) { console.log('⚠️ PostgreSQL extension may already be installed'); }

      // Build batch import SQL
      const connStr = `host=${config.host} port=${config.port} user=${config.user} password=${escapeSqlLiteral(config.password)} dbname=${config.database}`;
      const sqlCommands = [`ATTACH '${connStr}' AS pg_source (TYPE postgres)`];
      for (const table of tables) {
        const sanitizedName = `postgres_${dbName}_${table}`.replace(/[^a-zA-Z0-9_]/g, '_');
        sqlCommands.push(`DROP TABLE IF EXISTS "${sanitizedName}"`);
        sqlCommands.push(`CREATE TABLE "${sanitizedName}" AS SELECT * FROM pg_source."${table}"`);
      }
      sqlCommands.push('DETACH pg_source');

      console.log('📊 Importing all PostgreSQL tables into DuckDB...');
      await duckdbClient.execBatch(this.dbFile, sqlCommands);

      // Get row counts
      const importedTables = [];
      let totalRows = 0;
      for (const table of tables) {
        const sanitizedName = `postgres_${dbName}_${table}`.replace(/[^a-zA-Z0-9_]/g, '_');
        try {
          const result = await duckdbClient.all(this.dbFile, `SELECT COUNT(*) as count FROM "${sanitizedName}"`);
          const rowCount = result[0]?.count || 0;
          importedTables.push({ table, duckdbTable: sanitizedName, rows: rowCount });
          totalRows += rowCount;
          console.log(`  ✅ ${table}: ${rowCount} rows imported`);
        } catch (e) { console.error(`  ⚠️ Could not get count for ${table}`); }
      }

      console.log(`✅ PostgreSQL import complete: ${importedTables.length} tables, ${totalRows} total rows`);
      return { success: true, message: `Imported ${importedTables.length} tables (${totalRows} rows) from PostgreSQL`, tables: importedTables, totalRows, connectionType: 'postgresql' };

    } catch (error) {
      console.error('❌ PostgreSQL connection error:', error);
      return { success: false, error: error.message };
    }
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

module.exports = DatabaseConnector;
