// Validation for model-generated SQL before it reaches DuckDB.
//
// The previous check was `sql.match(/^(SELECT|WITH)/i)` — it looked at the
// leading keyword and nothing else. That let through
//   SELECT * FROM read_csv_auto('C:/Users/<user>/Documents/payroll.csv')
// which DuckDB happily executes; the rows then flow into the response-formatting
// prompt and straight out to Groq. So a bad model completion was a working
// local-file exfiltration chain. This module closes that.

const MAX_ROWS = 10000;

// DuckDB functions/statements that read the filesystem or the network, plus the
// URL schemes httpfs accepts. Matched as whole words against code only (string
// literal contents are blanked first), so a row whose value happens to be the
// text 'read_csv_auto' doesn't trip the guard.
const DENIED = [
  'read_csv', 'read_csv_auto', 'read_parquet', 'read_json', 'read_json_auto',
  'read_ndjson', 'read_ndjson_auto', 'read_text', 'read_blob', 'glob',
  'parquet_scan', 'json_scan', 'csv_scan', 'iceberg_scan', 'delta_scan',
  'sniff_csv', 'copy', 'attach', 'detach', 'install', 'load', 'export',
  'import', 'pragma', 'set', 'reset', 'call', 'checkpoint',
];

// String.raw so the \b stays a word boundary — in a plain template literal it
// would be parsed as a backspace character and the deny-list would match nothing.
const DENIED_RE = new RegExp(String.raw`\b(${DENIED.join('|')})\b`, 'i');
const SCHEME_RE = /\b(?:https?|s3|gcs|az|azure|r2|hf|file):\/\//i;

// Walks the SQL once, tracking whether we're inside a single-quoted literal
// (DuckDB escapes a quote by doubling it: 'it''s'). Comments are only stripped
// outside literals, so a legitimate value like 'a -- b' survives intact.
// Returns the executable SQL plus a copy with literal contents blanked, which is
// what the deny-list is tested against.
function scan(sql) {
  let exec = '';
  let code = '';
  let inString = false;
  let inLine = false;
  let inBlock = false;

  for (let i = 0; i < sql.length; i++) {
    const c = sql[i];
    const next = sql[i + 1];

    if (inLine) {
      if (c === '\n') { inLine = false; exec += ' '; code += ' '; }
      continue;
    }
    if (inBlock) {
      if (c === '*' && next === '/') { inBlock = false; i++; exec += ' '; code += ' '; }
      continue;
    }
    if (inString) {
      exec += c;
      if (c === "'") {
        if (next === "'") { exec += next; i++; continue; }
        inString = false;
        code += "'";
      }
      continue;
    }

    if (c === '-' && next === '-') { inLine = true; i++; continue; }
    if (c === '/' && next === '*') { inBlock = true; i++; continue; }
    if (c === "'") { inString = true; exec += c; code += "'"; continue; }

    exec += c;
    code += c;
  }

  if (inString) throw new Error('Generated SQL has an unterminated string literal');
  return { exec, code };
}

// Names introduced by a WITH clause are legal in FROM even though they aren't
// real tables, so they have to be collected before the allowlist check runs.
function cteNames(codeNorm) {
  const names = new Set();
  const re = /(?:\bWITH\s+(?:RECURSIVE\s+)?|,\s*)("?)([a-zA-Z_][a-zA-Z0-9_]*)\1\s+AS\s*\(/gi;
  let m;
  while ((m = re.exec(codeNorm)) !== null) names.add(m[2].toLowerCase());
  return names;
}

// The deny-list is defense in depth; this is the actual control. DuckDB adds
// table functions faster than any regex gets updated, but a query that may only
// touch known-imported tables is safe by construction.
function assertTablesAllowed(codeNorm, allowedTables) {
  const allowed = new Set(allowedTables.map(t => String(t).toLowerCase()));
  const ctes = cteNames(codeNorm);
  const re = /\b(?:FROM|JOIN)\s+(?!\()("?)([a-zA-Z_][a-zA-Z0-9_]*)\1/gi;
  let m;
  while ((m = re.exec(codeNorm)) !== null) {
    const name = m[2].toLowerCase();
    if (ctes.has(name) || allowed.has(name)) continue;
    throw new Error(`Blocked: query references unknown table "${m[2]}"`);
  }
}

// Throws if the SQL is anything other than a single, read-only, local SELECT
// over known tables. Returns the normalized SQL to execute (LIMIT enforced).
function assertSafeSelect(rawSql, { allowedTables = null, maxRows = MAX_ROWS } = {}) {
  if (typeof rawSql !== 'string' || !rawSql.trim()) {
    throw new Error('No SQL query was generated');
  }

  const { exec, code } = scan(rawSql);
  let sql = exec.replace(/\s+/g, ' ').trim().replace(/;+\s*$/, '').trim();
  const codeNorm = code.replace(/\s+/g, ' ').trim().replace(/;+\s*$/, '').trim();

  if (!sql) throw new Error('Generated SQL was empty after removing comments');

  // Multiple statements: a trailing `;` is fine, anything after one is not.
  if (codeNorm.includes(';')) {
    throw new Error('Only a single SQL statement is allowed');
  }

  // The leading-keyword check, now applied after comments are stripped so a
  // leading `-- x` or `/* x */` can no longer smuggle past it.
  if (!/^(SELECT|WITH)\b/i.test(codeNorm)) {
    throw new Error('Only SELECT queries are allowed');
  }

  const denied = codeNorm.match(DENIED_RE);
  if (denied) {
    throw new Error(`Blocked: query uses the disallowed operation "${denied[1]}"`);
  }

  if (SCHEME_RE.test(codeNorm) || SCHEME_RE.test(sql)) {
    throw new Error('Blocked: query references a remote URL');
  }

  // DuckDB treats `FROM 'file.csv'` as a file scan with no function call, so the
  // deny-list above would miss it. Only bare identifiers may follow FROM/JOIN.
  if (/\b(?:FROM|JOIN)\s+'/i.test(codeNorm)) {
    throw new Error('Blocked: query reads directly from a file path');
  }

  if (allowedTables) {
    assertTablesAllowed(codeNorm, allowedTables);
  }

  // The row cap was only ever *requested* in the prompt. Enforce it.
  if (!/\bLIMIT\s+\d+/i.test(codeNorm)) {
    sql += ` LIMIT ${maxRows}`;
  }

  return sql;
}

module.exports = { assertSafeSelect, MAX_ROWS };
