// Builds the Call A sample block WITHOUT sending real rows.
//
// The three sample rows the prompt used to carry existed only to show the model
// the FORMAT of the data — is `status` 'active' or 1? is a date ISO or
// DD/MM/YYYY? That signal is derivable locally and re-emitted as fabricated
// rows, so the model gets the same structural hint and none of the real values.

const { isPiiColumnName, detectValueShape, maskOf, magnitudeOf } = require('./classify');

const SAMPLE_SIZE = 200;
const ENUM_MAX_CARDINALITY = 12;
const ENUM_K_ANONYMITY = 5;
const ENUM_SAFE_VALUE = /^[A-Za-z0-9_ .-]{1,32}$/;

// A 50-100 column table would otherwise get a fabricated sample row PLUS an
// enum-cardinality check per column, every one of which either widens the
// prompt sent to Groq or costs a DuckDB round-trip. The full schema (every
// column's name and type) still goes to the SQL-gen prompt regardless —
// this cap only thins the auxiliary sample-row profiling, so a query
// against an uncapped column still works; it just loses the fabricated
// format hint for it.
//
// The real cap is tier-derived (lib/spark/quotas.ts's wideTableColumnCap,
// passed in via options.columnCap from the renderer) — this is only the
// fallback for a caller that doesn't supply one. It must stay a pure
// function of (table, level, cap), never of any one question, or the cache
// would serve one question's narrowing to another — hence it's part of the
// cache key below rather than baked into which rows get fetched.
const DEFAULT_WIDE_TABLE_COLUMN_CAP = 40;

// Column names come from information_schema, but a CSV header cell can put a
// double quote into one (`a""b` in the header becomes the column `a"b`), which
// would break straight out of a naively quoted identifier. SQL escapes a quote
// inside an identifier by doubling it.
function quoteIdent(name) {
  return '"' + String(name).replace(/"/g, '""') + '"';
}

// Deterministic PRNG so a table always yields the same synthetic rows: stable
// prompts are cacheable, reproducible in the audit log, and make the accuracy
// regression suite comparable run to run.
function seededRandom(seed) {
  let s = 0;
  for (const ch of String(seed)) s = (s * 31 + ch.charCodeAt(0)) >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 0x100000000; };
}

const FIRST = ['Ada', 'Bram', 'Cleo', 'Dara', 'Emil', 'Fern', 'Gus', 'Hana'];
const LAST = ['Marsh', 'Oyelaran', 'Quill', 'Rivas', 'Sandoval', 'Thorne'];

function fromMask(mask, rand) {
  return mask.replace(/[Aa9]/g, ch => {
    if (ch === '9') return String(Math.floor(rand() * 10));
    const alpha = 'abcdefghijklmnopqrstuvwxyz';
    const c = alpha[Math.floor(rand() * alpha.length)];
    return ch === 'A' ? c.toUpperCase() : c;
  });
}

// Every generator uses reserved/fictional ranges only: example.com is RFC 2606,
// 555-01xx is the reserved phone block, 192.0.2.0/24 is TEST-NET-1.
function fabricate(profile, rand, i) {
  const { shape, mask, magnitude, decimals, name } = profile;
  switch (shape) {
    case 'email': return 'user' + (i + 1) + '@example.com';
    case 'phone': return '555-01' + String(10 + i).slice(-2);
    case 'ssn': return '000-00-00' + String(10 + i).slice(-2);
    case 'card': return '4111111111111111';
    case 'url': return 'https://example.com/item/' + (i + 1);
    case 'ipv4': return '192.0.2.' + (i + 1);
    case 'uuid': return '00000000-0000-4000-8000-' + String(i + 1).padStart(12, '0');
    case 'iso-date': return '2024-0' + ((i % 9) + 1) + '-1' + (i % 10);
    case 'bool': return i % 2 === 0 ? 'true' : 'false';
    case 'number': {
      const base = Math.pow(10, Math.max(0, magnitude));
      const v = base + Math.floor(rand() * base) + i;
      return decimals > 0 ? Number(v.toFixed(decimals)) : v;
    }
    default: {
      if (/name|first|last|surname/.test(String(name).toLowerCase())) {
        return FIRST[i % FIRST.length] + ' ' + LAST[i % LAST.length];
      }
      return mask ? fromMask(mask, rand) : 'sample_' + (i + 1);
    }
  }
}

// Real distinct values are the one exception to "no real values". They are
// worth it because the model cannot write WHERE status = 'active' without them,
// but every one of these gates must hold.
async function revealEnum(query, tableName, column, level, sampledValues) {
  if (level !== 'standard') return null;            // strict/local never reveal
  if (isPiiColumnName(column)) return null;

  // Prefilter from the rows already in memory before touching the table again.
  // The distinct count of a sample is a lower bound on the true distinct count,
  // so more than ENUM_MAX_CARDINALITY distinct values in the sample PROVES the
  // column cannot be a small enum. This is exact, not a heuristic, and it skips
  // the full-table GROUP BY for every high-cardinality column — which matters a
  // lot on the 100 GB CSVs this app is meant to handle.
  if (sampledValues && sampledValues.length) {
    if (new Set(sampledValues.map(String)).size > ENUM_MAX_CARDINALITY) return null;
  }

  // k-anonymity floor: a value held by fewer than k rows is identifying on its
  // own. A `diagnosis` column with 11 values passes a cardinality test, but the
  // single row with the rare condition is exactly what HIPAA cares about.
  const col = quoteIdent(column);
  const sql = 'SELECT ' + col + ' AS v, COUNT(*) AS n FROM ' + quoteIdent(tableName) +
    ' WHERE ' + col + ' IS NOT NULL GROUP BY 1 HAVING COUNT(*) >= ' + ENUM_K_ANONYMITY +
    ' ORDER BY 2 DESC LIMIT ' + (ENUM_MAX_CARDINALITY + 1);

  const rows = await query(sql).catch(() => null);
  if (!rows || rows.length === 0 || rows.length > ENUM_MAX_CARDINALITY) return null;

  const values = rows.map(r => String(r.v));
  if (!values.every(v => ENUM_SAFE_VALUE.test(v))) return null;
  if (!values.every(v => ['code', 'bool', 'number', null].includes(detectValueShape(v)))) return null;
  return values;
}

// Profiles are stable for as long as the data is: tables are imported once and
// never mutated, and DuckDB is wiped on every connect and disconnect. Without
// this cache the whole profile is recomputed on EVERY question, which replaced
// one `LIMIT 3` with a 200-row scan plus a GROUP BY per candidate column.
// Keyed on row count so it self-invalidates on re-import rather than needing
// invalidation wired through the importers.
const profileCache = new Map();

function clearProfileCache() {
  profileCache.clear();
}

// Reads real rows into this process to derive masks, then discards them. The
// privacy boundary is the network socket, not the process.
async function profileTable(query, tableName, columns, options) {
  const level = (options && options.level) || 'standard';
  // null explicitly means "no cap" (THUNDER); undefined/omitted means the
  // caller didn't say, so fall back rather than treat it as unlimited.
  const columnCap = options && 'columnCap' in options && options.columnCap !== undefined
    ? options.columnCap
    : DEFAULT_WIDE_TABLE_COLUMN_CAP;

  const countRow = await query('SELECT COUNT(*) AS n FROM ' + quoteIdent(tableName)).catch(() => null);
  const rowCount = countRow && countRow[0] ? Number(countRow[0].n) : -1;
  const cacheKey = tableName + '|' + level + '|' + rowCount + '|' + columns.length + '|' + columnCap;
  if (rowCount >= 0 && profileCache.has(cacheKey)) return profileCache.get(cacheKey);

  const sample = await query('SELECT * FROM ' + quoteIdent(tableName) + ' LIMIT ' + SAMPLE_SIZE).catch(() => []);

  const profiledColumns = (columnCap !== null && columns.length > columnCap)
    ? columns.slice(0, columnCap)
    : columns;

  const profiles = [];
  for (const col of profiledColumns) {
    const name = col.column_name;
    const values = sample.map(r => r[name]).filter(v => v !== null && v !== undefined);

    const shapes = values.map(detectValueShape).filter(Boolean);
    const shape = shapes.length
      ? shapes.slice().sort((a, b) =>
          shapes.filter(s => s === b).length - shapes.filter(s => s === a).length)[0]
      : null;

    const masks = values.filter(v => typeof v === 'string').map(maskOf);
    const mask = masks.length
      ? masks.slice().sort((a, b) =>
          masks.filter(m => m === b).length - masks.filter(m => m === a).length)[0]
      : null;

    const nums = values.filter(v => typeof v === 'number');
    const decimals = nums.some(n => !Number.isInteger(n)) ? 2 : 0;
    const magnitude = nums.length ? magnitudeOf(nums[0]) : 1;

    const profile = { name: name, dataType: col.data_type, shape: shape, mask: mask, decimals: decimals, magnitude: magnitude };
    profile.enumValues = shape === 'freetext'
      ? null
      : await revealEnum(query, tableName, name, level, values);
    profiles.push(profile);
  }

  const result = { tableName: tableName, columns: profiles };
  if (rowCount >= 0) profileCache.set(cacheKey, result);
  return result;
}

function synthesizeRows(tableProfile, n) {
  const count = n || 3;
  const rand = seededRandom(tableProfile.tableName);
  return Array.from({ length: count }, (_, i) => {
    const row = {};
    for (const p of tableProfile.columns) {
      row[p.name] = p.enumValues ? p.enumValues[i % p.enumValues.length] : fabricate(p, rand, i);
    }
    return row;
  });
}

// The prompt fragment. Labelled explicitly so the model never quotes these
// fabricated values back to the user as if they were real results.
function buildSampleBlock(tableProfile, n) {
  const rows = synthesizeRows(tableProfile, n);
  const enums = tableProfile.columns
    .filter(p => p.enumValues)
    .map(p => '  ' + p.name + ' is one of: ' + p.enumValues.map(v => "'" + v + "'").join(', '));

  return [
    'SYNTHETIC EXAMPLE ROWS for ' + tableProfile.tableName + ' — illustrative FORMAT ONLY.',
    'These are fabricated, not real data. Never repeat these values in your output.',
    JSON.stringify(rows),
    enums.length ? 'Known column values:\n' + enums.join('\n') : '',
  ].filter(Boolean).join('\n');
}

module.exports = { profileTable, synthesizeRows, buildSampleBlock, clearProfileCache, SAMPLE_SIZE };
