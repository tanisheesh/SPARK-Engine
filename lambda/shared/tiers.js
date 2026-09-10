/* Server-side source of truth for tier pricing. Mirrors TIERS.txt at the
   repo root — if TIERS.txt changes, update this file too (no automatic
   sync between the two). The client must never be trusted to say what a
   tier costs; billing-create-order always looks the price up from here. */

const TIERS = {
  IGNITE: {
    label: 'Ignite',
    monthly: { amount: 49900, currency: 'INR' }, // paise
    yearly: { amount: 500000, currency: 'INR' },
  },
  BLAZE: {
    label: 'Blaze',
    monthly: { amount: 99900, currency: 'INR' },
    yearly: { amount: 1000000, currency: 'INR' },
  },
  STORM: {
    label: 'Storm',
    monthly: { amount: 199900, currency: 'INR' },
    yearly: { amount: 2000000, currency: 'INR' },
  },
  THUNDER: {
    label: 'Thunder',
    // Starting per-seat price. Anything beyond the starting price is a
    // custom quote handled outside this checkout flow.
    monthly: { amount: 399900, currency: 'INR' },
    yearly: { amount: 4798800, currency: 'INR' },
  },
};

function priceFor(tier, cycle) {
  const t = TIERS[tier];
  if (!t) throw new Error(`Unknown tier: ${tier}`);
  const p = t[cycle];
  if (!p) throw new Error(`Unknown billing cycle: ${cycle}`);
  return p;
}

/* Usage quotas — mirrors the "Limits" sections of TIERS.txt. Enforced by
   lambda/usage-consume (queries), lambda/managed-keys (managedKeys — only
   THUNDER gets SPARK's own Groq/Deepgram keys) and checked client-side
   before an upload (CSV size, in FileUpload.tsx). null means unlimited
   (THUNDER). */
const QUOTAS = {
  FREE: { queriesPerMonth: 300, queriesPerDay: 10, csvSizeGb: 25, managedKeys: false },
  IGNITE: { queriesPerMonth: 600, queriesPerDay: 20, csvSizeGb: 100, managedKeys: false },
  BLAZE: { queriesPerMonth: 1200, queriesPerDay: 40, csvSizeGb: 200, managedKeys: false },
  STORM: { queriesPerMonth: 2400, queriesPerDay: 80, csvSizeGb: 400, managedKeys: false },
  THUNDER: { queriesPerMonth: null, queriesPerDay: null, csvSizeGb: null, managedKeys: true },
};

function quotaFor(tier) {
  return QUOTAS[tier] || QUOTAS.FREE;
}

module.exports = { TIERS, priceFor, QUOTAS, quotaFor };
