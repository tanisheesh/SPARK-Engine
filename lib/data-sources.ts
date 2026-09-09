// Renderer-side mirror of electron/source-registry.js.
//
// The main process owns the DuckDB table-prefix rules; the renderer only needs
// to know which sources are files and how to label them. Keep the two in sync -
// if a source is added here it must be added there too.

// Sources whose tables come from an uploaded file. They share one unprefixed
// bucket in DuckDB, so the query path treats them identically.
export type FileSourceType = 'csv' | 'xlsx' | 'json';

// Sources backed by a live connection; each owns a table-name prefix.
export type DatabaseSourceType = 'mysql' | 'sqlite' | 'postgresql' | 'supabase';

export type DataSourceType = FileSourceType | DatabaseSourceType;

export const FILE_SOURCE_TYPES: FileSourceType[] = ['csv', 'xlsx', 'json'];

export const DATABASE_SOURCE_TYPES: DatabaseSourceType[] = [
  'mysql',
  'sqlite',
  'postgresql',
  'supabase'
];

/**
 * True when the dataset came from an uploaded file rather than a live database.
 *
 * This is what decides whether a query is sent with the file's path or with the
 * 'duckdb://direct' sentinel, which in turn selects the file or database table
 * bucket in the main process. Getting it wrong points the LLM at the wrong tables.
 */
export function isFileSource(type: DataSourceType | null | undefined): boolean {
  return !!type && (FILE_SOURCE_TYPES as string[]).includes(type);
}

// File extensions accepted per file source, used for the upload UI copy.
export const FILE_SOURCE_EXTENSIONS: Record<FileSourceType, string[]> = {
  csv: ['.csv'],
  xlsx: ['.xlsx', '.xls'],
  json: ['.json']
};

export function extensionsFor(type: FileSourceType): string[] {
  return FILE_SOURCE_EXTENSIONS[type] || [];
}

/** Does this filename belong to the given file source? */
export function matchesFileSource(fileName: string, type: FileSourceType): boolean {
  const lower = fileName.toLowerCase();
  return extensionsFor(type).some(ext => lower.endsWith(ext));
}
