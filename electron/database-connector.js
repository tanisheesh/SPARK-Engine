const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

// Database connector for MySQL, SQLite, PostgreSQL
class DatabaseConnector {
  constructor() {
    this.dataDir = path.join(app.getPath('userData'), 'csv_data');
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
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

      // Get DuckDB path
      const dbFile = path.join(path.dirname(this.dataDir), 'data.duckdb');
      const safeDbFile = path.resolve(dbFile);
      
      // Find DuckDB executable
      let duckdbCommand = 'duckdb';
      const appDir = path.dirname(process.execPath);
      const possiblePaths = [
        path.join(appDir, process.platform === 'win32' ? 'duckdb.exe' : 'duckdb'),
        path.join(process.cwd(), process.platform === 'win32' ? 'duckdb.exe' : 'duckdb')
      ];
      
      for (const duckdbPath of possiblePaths) {
        if (fs.existsSync(duckdbPath)) {
          duckdbCommand = `"${path.resolve(duckdbPath)}"`;
          break;
        }
      }

      // STEP 1: Clean up old MySQL tables from DuckDB
      console.log('🧹 Cleaning up old MySQL tables...');
      try {
        const cleanupSQL = `
          SELECT 'DROP TABLE IF EXISTS ' || table_name || ';' as drop_stmt
          FROM information_schema.tables 
          WHERE table_schema='main' AND table_name LIKE 'mysql_%'
        `;
        
        const { stdout: dropStmts } = await execPromise(`${duckdbCommand} "${safeDbFile}" -json -c "${cleanupSQL}"`, { timeout: 10000 });
        const drops = JSON.parse(dropStmts.trim() || '[]');
        
        if (drops.length > 0) {
          const dropSQL = drops.map(d => d.drop_stmt).join(' ');
          await execPromise(`${duckdbCommand} "${safeDbFile}" -c "${dropSQL}"`, { timeout: 30000 });
          console.log(`✅ Cleaned up ${drops.length} old MySQL tables`);
        }
      } catch (error) {
        console.log('⚠️ No old tables to clean up');
      }

      // STEP 2: Install MySQL extension
      console.log('📦 Installing MySQL extension...');
      try {
        await execPromise(`${duckdbCommand} "${safeDbFile}" -c "INSTALL mysql; LOAD mysql;"`, { timeout: 30000 });
        console.log('✅ MySQL extension loaded');
      } catch (error) {
        console.log('⚠️ MySQL extension may already be installed');
      }

      const importedTables = [];
      let totalRows = 0;

      // STEP 3: Create connection string for DuckDB
      const connectionString = `host=${config.host} port=${config.port} user=${config.user} password=${config.password} database=${config.database}`;

      // STEP 4: Build all SQL commands in one batch
      const sqlCommands = [];
      
      // Attach database
      sqlCommands.push(`ATTACH '${connectionString}' AS mysql_source (TYPE mysql)`);
      
      // Import all tables
      for (const table of tables) {
        const sanitizedTableName = `mysql_${config.database}_${table}`.replace(/[^a-zA-Z0-9_]/g, '_');
        sqlCommands.push(`DROP TABLE IF EXISTS ${sanitizedTableName}`);
        sqlCommands.push(`CREATE TABLE ${sanitizedTableName} AS SELECT * FROM mysql_source.${table}`);
      }
      
      // Detach
      sqlCommands.push('DETACH mysql_source');
      
      // Execute all commands in one go
      const batchSQL = sqlCommands.join('; ');
      
      console.log('📊 Importing all tables in batch...');
      try {
        await execPromise(`${duckdbCommand} "${safeDbFile}" -c "${batchSQL}"`, { 
          timeout: 300000, // 5 minutes
          maxBuffer: 100 * 1024 * 1024 
        });
        console.log('✅ Batch import completed');
      } catch (error) {
        console.error('❌ Batch import failed:', error.message);
        throw error;
      }

      // STEP 5: Get row counts for each table
      for (const table of tables) {
        const sanitizedTableName = `mysql_${config.database}_${table}`.replace(/[^a-zA-Z0-9_]/g, '_');
        
        try {
          const countCmd = `${duckdbCommand} "${safeDbFile}" -json -c "SELECT COUNT(*) as count FROM ${sanitizedTableName}"`;
          const { stdout } = await execPromise(countCmd, { timeout: 10000 });
          const result = JSON.parse(stdout.trim());
          const rowCount = result[0]?.count || 0;
          
          importedTables.push({
            table,
            duckdbTable: sanitizedTableName,
            rows: rowCount
          });
          
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
   * Connect to SQLite and export data to CSV via DuckDB
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

      // Get all tables if no specific table provided
      let tables = [];
      if (config.table && config.table.trim()) {
        tables = [config.table];
      } else {
        // Get all tables in database
        const tableRows = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all();
        tables = tableRows.map(row => row.name);
        console.log(`📋 Found ${tables.length} tables:`, tables.join(', '));
      }

      const Papa = require('papaparse');
      const exportedFiles = [];

      // Export each table
      for (const table of tables) {
        console.log(`📊 Exporting table: ${table}...`);
        
        const rows = db.prepare(`SELECT * FROM ${table} LIMIT 100000`).all();
        
        if (rows.length === 0) {
          console.log(`⚠️  Table ${table} is empty, skipping...`);
          continue;
        }

        // Convert to CSV
        const csvFileName = `sqlite_${path.basename(config.filePath, '.db')}_${table}_${Date.now()}.csv`;
        const csvPath = path.join(this.dataDir, csvFileName);
        
        const csv = Papa.unparse(rows);
        
        fs.writeFileSync(csvPath, csv, 'utf8');
        
        exportedFiles.push({
          table,
          fileName: csvFileName,
          path: csvPath,
          rows: rows.length
        });

        console.log(`  ✅ ${table}: ${rows.length} rows exported`);
      }
      
      db.close();

      const totalRows = exportedFiles.reduce((sum, f) => sum + f.rows, 0);

      console.log(`✅ SQLite export complete: ${exportedFiles.length} tables, ${totalRows} total rows`);

      return {
        success: true,
        message: `Imported ${exportedFiles.length} tables (${totalRows} rows) from SQLite`,
        files: exportedFiles,
        totalRows
      };

    } catch (error) {
      console.error('❌ SQLite connection error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Connect to PostgreSQL and export data to CSV via DuckDB
   */
  async connectPostgreSQL(config) {
    try {
      console.log('🐘 Connecting to PostgreSQL...', config);
      
      const { Client } = require('pg');
      
      // Create connection
      const client = new Client({
        host: config.host,
        port: parseInt(config.port),
        user: config.user,
        password: config.password,
        database: config.database
      });

      await client.connect();

      console.log('✅ PostgreSQL connected successfully');

      // Get all tables if no specific table provided
      let tables = [];
      if (config.table && config.table.trim()) {
        tables = [config.table];
      } else {
        // Get all tables in database
        const result = await client.query(`
          SELECT tablename FROM pg_tables 
          WHERE schemaname = 'public'
        `);
        tables = result.rows.map(row => row.tablename);
        console.log(`📋 Found ${tables.length} tables:`, tables.join(', '));
      }

      const Papa = require('papaparse');
      const exportedFiles = [];

      // Export each table
      for (const table of tables) {
        console.log(`📊 Exporting table: ${table}...`);
        
        const result = await client.query(`SELECT * FROM ${table} LIMIT 100000`);
        
        if (result.rows.length === 0) {
          console.log(`⚠️  Table ${table} is empty, skipping...`);
          continue;
        }

        // Convert to CSV
        const csvFileName = `postgres_${config.database}_${table}_${Date.now()}.csv`;
        const csvPath = path.join(this.dataDir, csvFileName);
        
        const csv = Papa.unparse(result.rows);
        
        fs.writeFileSync(csvPath, csv, 'utf8');
        
        exportedFiles.push({
          table,
          fileName: csvFileName,
          path: csvPath,
          rows: result.rows.length
        });

        console.log(`  ✅ ${table}: ${result.rows.length} rows exported`);
      }
      
      await client.end();

      const totalRows = exportedFiles.reduce((sum, f) => sum + f.rows, 0);

      console.log(`✅ PostgreSQL export complete: ${exportedFiles.length} tables, ${totalRows} total rows`);

      return {
        success: true,
        message: `Imported ${exportedFiles.length} tables (${totalRows} rows) from PostgreSQL`,
        files: exportedFiles,
        totalRows
      };

    } catch (error) {
      console.error('❌ PostgreSQL connection error:', error);
      return {
        success: false,
        error: error.message
      };
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

module.exports = DatabaseConnector;
