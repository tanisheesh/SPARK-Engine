// Append-only evidence log of everything sent to a third-party API.
//
// This is the ONE place hashing genuinely belongs. A SHA-256 digest is not a
// privacy control — it proves integrity and non-repudiation, nothing more:
// "here is a digest of what we sent; produce the payload and we can prove it
// matches". The prevHash chain makes silent deletion of an entry detectable,
// which is the property an auditor actually asks about.
//
// It is also the verification channel: written synchronously per call, so it
// can be read WHILE the app is running, unlike stdout which only flushes on exit.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

let auditDir = null;
let lastHash = 'genesis';

function init(userDataPath) {
  auditDir = path.join(userDataPath, 'audit');
  try {
    fs.mkdirSync(auditDir, { recursive: true });
    resumeChain();
  } catch (err) {
    console.warn('Audit log unavailable:', err.message);
    auditDir = null;
  }
}

// The chain must continue across restarts. Starting every session from
// 'genesis' would leave a legitimate discontinuity at each app launch, which an
// auditor cannot tell apart from a deleted block — defeating the point of
// chaining at all. So pick up the hash the last session ended on.
function resumeChain() {
  try {
    const lines = fs.readFileSync(currentFile(), 'utf8').trim().split('\n');
    for (let i = lines.length - 1; i >= 0; i--) {
      const entry = JSON.parse(lines[i]);
      if (entry.prevHash && entry.payloadSha256 && entry.ts) {
        lastHash = sha256(entry.prevHash + entry.payloadSha256 + entry.ts);
        return;
      }
    }
  } catch (_) {
    // No log for this month yet — 'genesis' is the correct starting point.
  }
}

function currentFile() {
  const month = new Date().toISOString().slice(0, 7);
  return path.join(auditDir, 'outbound-' + month + '.jsonl');
}

function sha256(s) {
  return crypto.createHash('sha256').update(s, 'utf8').digest('hex');
}

// `bodyString` must be the exact string handed to fetch. Hashing a
// reconstruction of the payload would prove nothing about what was sent.
//
// Payload retention is OPT-IN, and off by default even in strict mode.
//
// The reasoning changed on review: a retained payload contains the user's
// QUESTION verbatim, and questions routinely carry the very identifiers this
// feature exists to protect ("what is <person>'s balance"). Writing those to an
// unencrypted, append-only file forever — to prove we protect them — is a worse
// trade than keeping the digest, which still gives integrity and
// non-repudiation. Compliance deployments that want the stronger evidence can
// turn it on deliberately via privacy.auditRetainPayload.
function recordOutbound(entry) {
  if (!auditDir) return null;

  const id = crypto.randomUUID();
  const record = {
    ts: new Date().toISOString(),
    id: id,
    prevHash: lastHash,
    provider: entry.provider,
    endpoint: entry.endpoint,
    model: entry.model || null,
    callKind: entry.callKind,
    privacyLevel: entry.privacyLevel,
    payloadSha256: sha256(entry.bodyString),
    payloadBytes: Buffer.byteLength(entry.bodyString, 'utf8'),
    tokensRedacted: entry.tokensRedacted || 0,
    tripwire: 'pass',
    payload: entry.retainPayload ? entry.bodyString : undefined,
  };

  lastHash = sha256(record.prevHash + record.payloadSha256 + record.ts);

  try {
    fs.appendFileSync(currentFile(), JSON.stringify(record) + '\n', 'utf8');
  } catch (err) {
    console.warn('Audit append failed:', err.message);
  }
  return id;
}

// Records a request that the tripwire stopped before it reached the network.
// A blocked entry is the most important thing this log can contain.
function recordBlocked(entry) {
  if (!auditDir) return;
  try {
    fs.appendFileSync(currentFile(), JSON.stringify({
      ts: new Date().toISOString(),
      id: crypto.randomUUID(),
      prevHash: lastHash,
      provider: entry.provider,
      callKind: entry.callKind,
      privacyLevel: entry.privacyLevel,
      tripwire: 'BLOCKED',
      reason: entry.reason,
    }) + '\n', 'utf8');
  } catch (err) {
    console.warn('Audit append failed:', err.message);
  }
}

function recordOutcome(id, outcome) {
  if (!auditDir || !id) return;
  try {
    fs.appendFileSync(currentFile(), JSON.stringify({
      ts: new Date().toISOString(),
      ref: id,
      outcome: outcome.status,
      durationMs: outcome.durationMs,
      detokenized: outcome.detokenized,
    }) + '\n', 'utf8');
  } catch (err) {
    console.warn('Audit append failed:', err.message);
  }
}

function logPath() {
  return auditDir ? currentFile() : null;
}

module.exports = { init, recordOutbound, recordBlocked, recordOutcome, logPath, sha256 };
