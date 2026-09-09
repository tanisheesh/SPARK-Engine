// Single source of truth for how each data source maps onto DuckDB table names.
//
// Two buckets exist:
//   - File sources (csv, xlsx, json) create UNPREFIXED tables named after the
//     file (and sheet, for workbooks). They share one bucket because the user
//     thinks of them as "my uploaded files", and because the query path in
//     app/page.tsx distinguishes files from live connections, not csv from json.
//   - Database sources create tables behind a per-source prefix so a connect
//     wipes only its own tables and the LLM never sees another source's schema.
//
// Everything that used to hardcode `table_name LIKE 'mysql_%' OR ...` reads
// from here instead - api-handler's schema filter, main's disconnect handler,
// and each connector's pre-import cleanup.

// Extension -> which importer handles it. Order matters only for the file dialog.
const FILE_SOURCES = {
  csv: { extensions: ['.csv'], label: 'CSV' },
  xlsx: { extensions: ['.xlsx', '.xls'], label: 'Excel' },
  json: { extensions: ['.json'], label: 'JSON' }
};

// Prefix is what lands in DuckDB; keep it in sync with the connectors.
const DB_SOURCES = {
  mysql: { prefix: 'mysql_', label: 'MySQL' },
  sqlite: { prefix: 'sqlite_', label: 'SQLite' },
  postgresql: { prefix: 'postgres_', label: 'PostgreSQL' },
  supabase: { prefix: 'supabase_', label: 'Supabase' }
};

const FILE_EXTENSIONS = Object.values(FILE_SOURCES).flatMap(s => s.extensions);

const DB_PREFIXES = Object.values(DB_SOURCES).map(s => s.prefix);

function isFileSource(type) {
  return Object.prototype.hasOwnProperty.call(FILE_SOURCES, type);
}

function isDatabaseSource(type) {
  return Object.prototype.hasOwnProperty.call(DB_SOURCES, type);
}

// Which file source owns this path, or null if the extension isn't supported.
function sourceForFile(filePath) {
  const lower = String(filePath).toLowerCase();
  for (const [type, meta] of Object.entries(FILE_SOURCES)) {
    if (meta.extensions.some(ext => lower.endsWith(ext))) return type;
  }
  return null;
}

function isSupportedFile(filePath) {
  return sourceForFile(filePath) !== null;
}

function prefixFor(type) {
  return DB_SOURCES[type] ? DB_SOURCES[type].prefix : '';
}

// Matches every table created by a live database connection.
function dbTableFilter() {
  return DB_PREFIXES.map(p => `table_name LIKE '${p}%'`).join(' OR ');
}

// Matches every table created from an uploaded file (i.e. anything not owned
// by a database source), which is how CSV/Excel/JSON tables are found.
function fileTableFilter() {
  return DB_PREFIXES.map(p => `table_name NOT LIKE '${p}%'`).join(' AND ');
}

// The cleanup filter for disconnecting one source. File sources share a bucket,
// so disconnecting any of them clears all uploaded-file tables.
function tableFilterForSource(type) {
  if (isFileSource(type)) return fileTableFilter();
  if (isDatabaseSource(type)) return `table_name LIKE '${prefixFor(type)}%'`;
  return null;
}

// Strips characters DuckDB won't accept in a bare identifier. Matches the rule
// already used across the connectors, plus a leading underscore when the name
// would otherwise start with a digit - duckdb-client's assertValidIdentifier
// rejects those, which a workbook like "2026_sales.xlsx" would otherwise hit.
function sanitizeIdentifier(name) {
  const cleaned = String(name).replace(/[^a-zA-Z0-9_]/g, '_');
  return /^[0-9]/.test(cleaned) ? `_${cleaned}` : cleaned;
}

module.exports = {
  FILE_SOURCES,
  DB_SOURCES,
  FILE_EXTENSIONS,
  DB_PREFIXES,
  isFileSource,
  isDatabaseSource,
  sourceForFile,
  isSupportedFile,
  prefixFor,
  dbTableFilter,
  fileTableFilter,
  tableFilterForSource,
  sanitizeIdentifier
};
