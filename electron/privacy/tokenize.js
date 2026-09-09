// Reversible, local-only substitution of real data values.
//
// This is the mechanism that replaces the rejected "encrypt/hash the payload"
// idea. Each real value is swapped for an opaque `SPK_Vn` token before the
// prompt is built; the model writes its sentence around the tokens; the real
// values are put back on this side of the network. The mapping lives in memory
// for one request and is never persisted, never sent over IPC, never logged.
//
// Token syntax matters more than it looks. Rejected alternatives:
//   <V17>    models HTML-escape it
//   {{V17}}  reads as a slot the model should FILL, not preserve
//   [V17]    markdown link syntax; gets rewritten to [V17](...)
//   __V17__  markdown emphasis; renderers eat the underscores
// SPK_V17 tokenizes as a plain identifier, so models copy it verbatim.

const { isPiiColumnName, detectValueShape, isSensitiveShape, magnitudeOf } = require('./classify');

const TOKEN_RE = /\bSPK_V(\d{1,4})\b/g;
// Tolerates the ways a model mangles a token: 'spk v17', 'SPK-V17', 'Spk_ V17'.
const LOOSE_TOKEN_RE = /\bSPK[\s_-]*V[\s_-]*(\d{1,4})\b/gi;

function createVault() {
  return {
    byToken: new Map(),   // 'SPK_V1' -> real value (as a string for output)
    byValue: new Map(),   // real value -> 'SPK_V1', so equal values share a token
    hints: new Map(),     // 'SPK_V1' -> 'person name'
    next: 1,
  };
}

function hintFor(column, value, shape) {
  if (shape === 'number') {
    const mag = magnitudeOf(value);
    const kind = Number.isInteger(Number(value)) ? 'whole number' : 'decimal number';
    return mag > 0 ? `${kind}, ~10^${mag}` : kind;
  }
  if (shape === 'iso-date') return 'a date';
  if (shape === 'email') return 'an email address';
  if (shape === 'phone') return 'a phone number';
  if (shape === 'bool') return 'yes/no value';
  const name = String(column || '').toLowerCase();
  if (/name|first|last|surname|patient/.test(name)) return 'person or entity name';
  if (/city|addr|street|zip|postal/.test(name)) return 'a location';
  return 'a text value';
}

function tokenFor(vault, column, value) {
  const key = `${typeof value}:${String(value)}`;
  if (vault.byValue.has(key)) return vault.byValue.get(key);

  const token = `SPK_V${vault.next++}`;
  vault.byToken.set(token, value instanceof Date ? value.toISOString() : String(value));
  vault.byValue.set(key, token);
  vault.hints.set(token, hintFor(column, value, detectValueShape(value)));
  return token;
}

// standard: redact only what is PII by name or by shape.
// strict:   redact every value that came out of the database.
function shouldTokenize(level, column, value) {
  if (value === null || value === undefined) return false;
  if (level === 'strict') return true;
  const shape = detectValueShape(value);
  return isPiiColumnName(column) || isSensitiveShape(shape);
}

// DuckDB columns can be STRUCT/LIST, so values may nest arbitrarily. Anything
// missed here would reach the wire in the clear, which is what the tripwire
// below exists to catch.
function walk(value, column, vault, level) {
  if (Array.isArray(value)) return value.map(v => walk(v, column, vault, level));
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = walk(v, `${column}.${k}`, vault, level);
    return out;
  }
  return shouldTokenize(level, column, value) ? tokenFor(vault, column, value) : value;
}

function tokenizeRows(rows, { level = 'standard' } = {}) {
  const vault = createVault();
  const safeRows = (rows || []).map(row => {
    const out = {};
    for (const [col, val] of Object.entries(row)) out[col] = walk(val, col, vault, level);
    return out;
  });

  const legend = vault.byToken.size
    ? ['TOKEN LEGEND — these values are redacted. Reproduce each SPK_Vn token EXACTLY.',
       'The hint tells you only how to phrase the sentence, never what the value is.',
       ...[...vault.hints].map(([t, h]) => `${t} = ${h}`)].join('\n')
    : '';

  return { rows: safeRows, vault, legend, tokenCount: vault.byToken.size };
}

// All-or-nothing. A half-substituted sentence reads as a bug to the user and as
// a leak to an auditor, so a response referencing a token we never issued is a
// hard failure that falls through to the local template instead.
function detokenize(text, vault) {
  const unknown = [];
  let recovered = 0;
  let resolved = 0;

  const substituted = String(text || '').replace(LOOSE_TOKEN_RE, (match, n) => {
    const canonical = `SPK_V${n}`;
    if (!vault.byToken.has(canonical)) { unknown.push(match); return match; }
    if (match !== canonical) recovered++;
    resolved++;
    return vault.byToken.get(canonical);
  });

  const leftover = substituted.match(TOKEN_RE) || [];
  const ok = unknown.length === 0 && leftover.length === 0 && substituted.trim().length > 0;

  return { text: ok ? substituted : '', ok, resolved, recovered, unknown };
}

// The tripwire. Called inside the HTTP transport on the exact string handed to
// fetch — not on a reconstruction — so no future code path can route around it.
// Short values are skipped: a 1- or 2-char value like "1" or "NY" would collide
// with ordinary prose and make this fire constantly on nothing.
function assertNoRealValues(bodyString, vault) {
  if (!vault) return;
  for (const real of vault.byToken.values()) {
    const s = String(real);
    if (s.length < 4) continue;
    if (bodyString.includes(s)) {
      throw new Error('Privacy tripwire: a real data value was about to be sent to a remote API. Request aborted.');
    }
  }
}

module.exports = { createVault, tokenizeRows, detokenize, assertNoRealValues };
