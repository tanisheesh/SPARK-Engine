const { DuckDBInstance } = require('@duckdb/node-api');
const fs = require('fs');

// Single shared native connection for the app's lifetime.
// Native bindings mean no child process, no shell quoting, no CLI binary to find/download.
let instance = null;
let connection = null;
let currentDbPath = null;

function sanitizeValue(value) {
  if (typeof value === 'bigint') return Number(value);
  if (value instanceof Date) return value;
  if (Array.isArray(value)) return value.map(sanitizeValue);
  if (value && typeof value === 'object') {
    const out = {};
    for (const key of Object.keys(value)) out[key] = sanitizeValue(value[key]);
    return out;
  }
  return value;
}

// DuckDB returns BigInt for BIGINT/HUGEINT/COUNT(*) columns, which JSON.stringify
// (used both for IPC replies and Groq prompt building) can't serialize.
function sanitizeRows(rows) {
  return (rows || []).map(sanitizeValue);
}

function closeSync() {
  if (connection) {
    try { connection.closeSync(); } catch (e) { /* ignore */ }
    connection = null;
  }
  if (instance) {
    try { instance.closeSync(); } catch (e) { /* ignore */ }
    instance = null;
  }
  currentDbPath = null;
}

async function getConnection(dbPath) {
  if (connection && currentDbPath === dbPath) return connection;
  closeSync();
  instance = await DuckDBInstance.create(dbPath);
  connection = await instance.connect();
  currentDbPath = dbPath;
  return connection;
}

async function all(dbPath, sql, params = []) {
  const conn = await getConnection(dbPath);
  const reader = params.length
    ? await conn.runAndReadAll(sql, params)
    : await conn.runAndReadAll(sql);
  return sanitizeRows(reader.getRowObjectsJS());
}

async function run(dbPath, sql, params = []) {
  const conn = await getConnection(dbPath);
  if (params.length) {
    await conn.run(sql, params);
  } else {
    await conn.run(sql);
  }
}

// Runs multiple statements in sequence (no parameter binding) - used for
// batched DDL like ATTACH/CREATE TABLE/DETACH or multi-table DROP cleanup.
async function execBatch(dbPath, statements) {
  const conn = await getConnection(dbPath);
  for (const statement of statements) {
    const trimmed = statement.trim();
    if (trimmed) await conn.run(trimmed);
  }
}

// Closes the connection (releasing the file lock) and deletes the db file
// for a clean-slate reset. Must close before unlinking or Windows will EBUSY.
async function reset(dbPath) {
  closeSync();
  for (const suffix of ['', '.wal']) {
    const f = dbPath + suffix;
    if (fs.existsSync(f)) {
      try { fs.unlinkSync(f); } catch (e) { console.warn(`⚠️ Could not remove ${f}:`, e.message); }
    }
  }
}

async function getTables(dbPath, whereExtra) {
  const sql = whereExtra
    ? `SELECT table_name FROM information_schema.tables WHERE table_schema='main' AND (${whereExtra})`
    : `SELECT table_name FROM information_schema.tables WHERE table_schema='main'`;
  return all(dbPath, sql);
}

async function dropTablesWhere(dbPath, whereExtra) {
  const tables = await getTables(dbPath, whereExtra);
  if (tables.length === 0) return 0;
  await execBatch(dbPath, tables.map(t => `DROP TABLE IF EXISTS "${t.table_name}"`));
  return tables.length;
}

async function getColumns(dbPath, tableName) {
  return all(
    dbPath,
    `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = ? ORDER BY ordinal_position`,
    [tableName]
  );
}

const VALID_IDENTIFIER = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

function assertValidIdentifier(name) {
  if (!VALID_IDENTIFIER.test(name)) {
    throw new Error(`Invalid table name: ${name}`);
  }
}

// read_csv_auto takes the path as a bound parameter, so paths with spaces
// or special characters (e.g. this repo's own "Portfolio Projects" path) are safe.
async function importCSV(dbPath, tableName, csvPath, { replace = true } = {}) {
  assertValidIdentifier(tableName);
  const verb = replace ? 'CREATE OR REPLACE TABLE' : 'CREATE TABLE IF NOT EXISTS';
  await run(dbPath, `${verb} "${tableName}" AS SELECT * FROM read_csv_auto(?)`, [csvPath]);
}

// Same shape as importCSV. The json extension is statically linked into the
// bundled DuckDB and pre-loaded, so this needs no INSTALL and works offline.
// Handles both a top-level array of objects and newline-delimited JSON; nested
// objects land as STRUCT columns.
async function importJSON(dbPath, tableName, jsonPath, { replace = true } = {}) {
  assertValidIdentifier(tableName);
  const verb = replace ? 'CREATE OR REPLACE TABLE' : 'CREATE TABLE IF NOT EXISTS';
  await run(dbPath, `${verb} "${tableName}" AS SELECT * FROM read_json_auto(?)`, [jsonPath]);
}

module.exports = {
  getConnection,
  all,
  run,
  execBatch,
  reset,
  closeSync,
  getTables,
  dropTablesWhere,
  getColumns,
  importCSV,
  importJSON,
  assertValidIdentifier,
  sanitizeRows
};
