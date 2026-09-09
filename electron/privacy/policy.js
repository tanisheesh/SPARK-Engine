// Resolves the active privacy level and what it permits.
//
// The level is read from settings.json on disk IN THE MAIN PROCESS on every
// query. It is deliberately NOT accepted from the renderer: if it arrived in
// the IPC argument, a buggy or compromised renderer could silently downgrade
// Strict to Standard, and the audit log would faithfully record the downgraded
// level — worse than having no audit log at all.

const fs = require('fs');

const LEVELS = { STANDARD: 'standard', STRICT: 'strict', LOCAL: 'local' };

const CAPABILITIES = {
  // Schema + synthetic rows + gated enum values go to Groq. Real PII values
  // are tokenized; ordinary non-PII values (counts, aggregates) pass through.
  standard: {
    cloudSqlGen: true, cloudFormat: true, cloudTts: true,
    revealEnums: true, tokenizeAll: false, retainPayload: false,
  },
  // No enum reveal, every result value tokenized, no cloud TTS (the TTS call
  // would otherwise ship the fully detokenized answer to a second vendor).
  strict: {
    cloudSqlGen: true, cloudFormat: true, cloudTts: false,
    revealEnums: false, tokenizeAll: true, retainPayload: true,
  },
  // Nothing leaves the machine. The only level that honestly backs "data never
  // leaves your machine", because it is the only one where the user's QUESTION
  // does not leave either.
  local: {
    cloudSqlGen: false, cloudFormat: false, cloudTts: false,
    revealEnums: false, tokenizeAll: true, retainPayload: true,
  },
};

const DEFAULTS = { level: LEVELS.STANDARD, syntheticRows: 3, auditLog: true };

let cache = { mtimeMs: 0, value: null };

function normalize(raw) {
  const p = (raw && raw.privacy) || {};
  const level = Object.values(LEVELS).includes(p.level) ? p.level : DEFAULTS.level;
  return Object.freeze({
    level: level,
    syntheticRows: Number.isInteger(p.syntheticRows) ? p.syntheticRows : DEFAULTS.syntheticRows,
    auditLog: p.auditLog !== false,
    // Off unless explicitly enabled: a retained payload contains the user's
    // question verbatim. See the note in audit.js recordOutbound().
    auditRetainPayload: p.auditRetainPayload === true,
  });
}

function loadPolicy(settingsFile) {
  try {
    const stat = fs.statSync(settingsFile);
    if (cache.value && cache.mtimeMs === stat.mtimeMs) return cache.value;
    const raw = JSON.parse(fs.readFileSync(settingsFile, 'utf8'));
    cache = { mtimeMs: stat.mtimeMs, value: normalize(raw) };
    return cache.value;
  } catch (err) {
    return normalize(null);
  }
}

// Every enforcement site asks this a question rather than comparing level
// strings, so there is exactly one definition of what "strict" means.
function capabilities(level) {
  return CAPABILITIES[level] || CAPABILITIES.standard;
}

// Belt and braces for local mode: throws before any fetch is attempted.
function assertNetworkAllowed(level, provider) {
  if (level === LEVELS.LOCAL) {
    throw new Error('Privacy mode is Local-only: no request may be sent to ' + provider + '.');
  }
}

module.exports = { LEVELS, loadPolicy, capabilities, assertNetworkAllowed, DEFAULTS };
