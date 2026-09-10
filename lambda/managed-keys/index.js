const { client, TABLES, GetCommand } = require('../shared/dynamo');
const { userIdFrom, json } = require('../shared/auth');
const { getActiveTier } = require('../shared/billing');
const { quotaFor } = require('../shared/tiers');

/* GET /managed-keys — the actual backend for THUNDER's "Managed API keys"
   promise. Settings.tsx hides the Groq/Deepgram inputs for a managed-keys
   tier and shows "SPARK's own key is used automatically" — until this
   endpoint existed, that was true only in the UI copy: nothing ever
   supplied a real key, so a THUNDER account with no BYOK key left over
   from a lower tier had no way to ask a question or use voice at all.

   The keys themselves live only as this Lambda's own environment
   variables (MANAGED_GROQ_API_KEY / MANAGED_DEEPGRAM_API_KEY) — never in
   the app bundle, which anyone could extract from a packaged installer.
   A non-THUNDER caller gets nothing back, even if they somehow call this
   directly; the tier check happens here, not just client-side. */
exports.handler = async (event) => {
  try {
    const userId = userIdFrom(event);
    const tier = await getActiveTier(client, TABLES, GetCommand, userId);
    const quota = quotaFor(tier);

    if (!quota.managedKeys) {
      return json(403, { error: 'Managed API keys are only available on THUNDER.' });
    }

    return json(200, {
      groqApiKey: process.env.MANAGED_GROQ_API_KEY || null,
      deepgramApiKey: process.env.MANAGED_DEEPGRAM_API_KEY || null,
    });
  } catch (err) {
    return json(err.statusCode || 500, { error: err.message });
  }
};
