// Decides, per column, whether a value may be shown to a remote model.
//
// Two independent signals are used, and either one is enough to redact:
//   - the column NAME (cheap, catches `patient_ssn` even when every sampled
//     value happens to look innocuous)
//   - the value SHAPE (catches an email column someone named `col_7`)

// Substring matched case-insensitively against the column name.
const PII_NAME_PARTS = [
  'name', 'first', 'last', 'surname', 'email', 'mail', 'phone', 'mobile', 'tel',
  'fax', 'ssn', 'sin', 'nin', 'aadhaar', 'pan', 'tax', 'dob', 'birth', 'age',
  'gender', 'sex', 'race', 'ethnic', 'addr', 'street', 'zip', 'postal', 'city',
  'lat', 'lon', 'geo', 'ip', 'passport', 'licen', 'iban', 'swift', 'account',
  'acct', 'card', 'cvv', 'salary', 'wage', 'bonus', 'password', 'passwd',
  'secret', 'token', 'apikey', 'mrn', 'patient', 'diagnosis', 'icd', 'npi',
  'insur', 'note', 'comment', 'remark', 'memo', 'feedback', 'review',
];

function isPiiColumnName(name) {
  const n = String(name || '').toLowerCase();
  return PII_NAME_PARTS.some(p => n.includes(p));
}

const SHAPES = [
  ['email', /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i],
  ['url', /^https?:\/\/\S+$/i],
  ['uuid', /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i],
  ['ssn', /^\d{3}-\d{2}-\d{4}$/],
  // iso-date must be tested before phone: the phone pattern also matches
  // '2024-03-17', which would make date columns synthesize as phone numbers.
  ['iso-date', /^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2})?/],
  ['ipv4', /^\d{1,3}(?:\.\d{1,3}){3}$/],
  ['card', /^(?:\d[ -]?){13,19}$/],
  ['phone', /^\+?[\d][\d\s().-]{7,17}$/],
  ['bool', /^(?:true|false|yes|no|y|n|t|f)$/i],
  ['code', /^[A-Za-z0-9_.-]{1,32}$/],
];

// Common hex-digest lengths: MD5 (32), SHA-1 (40), SHA-224 (56), SHA-256 (64),
// SHA-384 (96), SHA-512 (128). A source column that's already encrypted or
// hashed before it ever reached this app has no recognizable name or shape
// of its own — the "value SHAPE" signal above only works for plaintext PII,
// so a hash sitting in a column named `field_7` would otherwise match
// nothing and fall through as a harmless-looking short 'code'.
const HASH_HEX_LENGTHS = new Set([32, 40, 56, 64, 96, 128]);

function looksLikeHashOrCiphertext(s) {
  if (HASH_HEX_LENGTHS.has(s.length) && /^[0-9a-f]+$/i.test(s)) return true;
  // Base64 ciphertext/digest: mixed case + digits (a real short business
  // code is rarely both case-mixed AND this long), optional '=' padding.
  if (s.length >= 20 && /^[A-Za-z0-9+/_-]+={0,2}$/.test(s) &&
      /[A-Z]/.test(s) && /[a-z]/.test(s) && /[0-9]/.test(s)) return true;
  return false;
}

// Returns a shape label, or 'freetext' when nothing matches (long prose, which
// is the most dangerous kind of value: it can contain anything).
function detectValueShape(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'boolean') return 'bool';
  if (typeof value === 'number' || typeof value === 'bigint') return 'number';
  if (value instanceof Date) return 'iso-date';
  const s = String(value).trim();
  if (!s) return null;
  // Checked before the plain-number shortcut: a 13-19 digit run is a payment
  // card far more often than it is a quantity, and erring toward redaction is
  // the right bias for a column whose name gives nothing away (`col_7`).
  if (/^\d{13,19}$/.test(s)) return 'card';
  if (/^-?\d+(?:\.\d+)?$/.test(s)) return 'number';
  if (looksLikeHashOrCiphertext(s)) return 'hash';
  for (const [label, re] of SHAPES) {
    if (re.test(s)) return label;
  }
  return 'freetext';
}

// Shapes that must never be shown verbatim, whatever the column is called.
const SENSITIVE_SHAPES = new Set(['email', 'ssn', 'card', 'phone', 'ipv4', 'uuid', 'url', 'freetext', 'hash']);

function isSensitiveShape(shape) {
  return SENSITIVE_SHAPES.has(shape);
}

// Character-class mask used to generate a synthetic value of the same shape:
// 'AB-4471' -> 'AA-9999'. Punctuation is preserved literally.
function maskOf(value) {
  return String(value)
    .slice(0, 64)
    .replace(/[A-Z]/g, 'A')
    .replace(/[a-z]/g, 'a')
    .replace(/[0-9]/g, '9');
}

// Order of magnitude only — never a real min/max, which are themselves real
// values and are often the most sensitive rows in the table.
function magnitudeOf(n) {
  const v = Math.abs(Number(n));
  if (!isFinite(v) || v === 0) return 0;
  return Math.floor(Math.log10(v));
}

module.exports = {
  isPiiColumnName, detectValueShape, isSensitiveShape, maskOf, magnitudeOf,
  PII_NAME_PARTS,
};
