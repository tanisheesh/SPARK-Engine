// Encrypted-at-rest storage for API keys.
//
// The keys previously sat in plaintext in settings.json, readable by any
// process running as this user and swept up by OneDrive/backup tooling. This
// moves them into an OS-encrypted blob: DPAPI on Windows, Keychain on macOS,
// libsecret on Linux, via Electron's safeStorage.
//
// Be precise about what this does and does not buy, because the README will
// need to say it: it protects the file if it is copied off the machine, read by
// another user account, or picked up by a backup. It does NOT protect against
// malware already running as this user — that process can simply ask the OS to
// decrypt, exactly as we do. It is still a large improvement over plaintext.

const fs = require('fs');
const path = require('path');
const { safeStorage } = require('electron');

// Every credential-bearing field settings.json has ever held. inworldWorkspace
// is included deliberately: it looks like an identifier but is a base64 encoding
// of "key:secret", so leaving it in plaintext would defeat encrypting the other two.
const KEY_FIELDS = [
  'groqApiKey',
  'deepgramApiKey',
  'inworldApiKey',
  'inworldApiSecret',
  'inworldWorkspace',
];

let secretsFile = null;

function init(userDataPath) {
  secretsFile = path.join(userDataPath, 'secrets.json');
}

function isAvailable() {
  try {
    return safeStorage.isEncryptionAvailable();
  } catch (_) {
    return false;
  }
}

function readBlobs() {
  try {
    return JSON.parse(fs.readFileSync(secretsFile, 'utf8'));
  } catch (_) {
    return {};
  }
}

function writeBlobs(blobs) {
  fs.writeFileSync(secretsFile, JSON.stringify(blobs, null, 2), 'utf8');
}

function setSecret(name, plaintext) {
  const blobs = readBlobs();
  if (!plaintext) {
    delete blobs[name];
  } else if (isAvailable()) {
    blobs[name] = { enc: safeStorage.encryptString(plaintext).toString('base64') };
  } else {
    // No OS encryption available (some Linux desktops). Store as-is rather than
    // losing the user's key, but mark it so the state is never ambiguous.
    blobs[name] = { plain: plaintext };
  }
  writeBlobs(blobs);
}

function getSecret(name) {
  const entry = readBlobs()[name];
  if (!entry) return '';
  if (entry.plain) return entry.plain;
  try {
    return safeStorage.decryptString(Buffer.from(entry.enc, 'base64'));
  } catch (err) {
    console.warn(`Could not decrypt ${name}:`, err.message);
    return '';
  }
}

// Omits fields with no stored secret rather than returning empty strings: the
// caller spreads this over settings.json, and an empty string would clobber a
// real value there if migration had failed for any reason.
function getAllSecrets() {
  const out = {};
  for (const field of KEY_FIELDS) {
    const value = getSecret(field);
    if (value) out[field] = value;
  }
  return out;
}

// One-time move of any plaintext keys already sitting in settings.json.
// Returns the names moved so the caller can advise rotation — the plaintext was
// on disk and may already exist in a backup.
function migrateFromSettings(settingsFile) {
  let settings;
  try {
    settings = JSON.parse(fs.readFileSync(settingsFile, 'utf8'));
  } catch (_) {
    return [];
  }

  const moved = [];
  for (const field of KEY_FIELDS) {
    if (settings[field]) {
      setSecret(field, settings[field]);
      delete settings[field];
      moved.push(field);
    }
  }

  if (moved.length) {
    fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2), 'utf8');
  }
  return moved;
}

module.exports = { init, isAvailable, setSecret, getSecret, getAllSecrets, migrateFromSettings, KEY_FIELDS };
