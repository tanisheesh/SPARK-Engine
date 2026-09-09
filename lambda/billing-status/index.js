const { client, TABLES, GetCommand } = require('../shared/dynamo');
const { userIdFrom, json } = require('../shared/auth');
const { isExpired } = require('../shared/billing');

/* GET /billing/status — what PricingScreen polls to know the current tier
   and to render the "Current plan" badge. Users with no subscription row
   yet (never purchased), or whose current_period_end has passed with no
   renewal, are FREE. Nothing else in this codebase flips status on its
   own — there's no renewal Lambda — so this expiry check on read is what
   actually stops a one-time payment from granting the tier forever. */
exports.handler = async (event) => {
  try {
    const userId = userIdFrom(event);
    const result = await client.send(
      new GetCommand({ TableName: TABLES.subscriptions, Key: { user_id: userId } })
    );
    const sub = result.Item;
    if (!sub || sub.status !== 'active' || isExpired(sub.current_period_end)) {
      return json(200, { tier: 'FREE', status: 'active', cycle: null, currentPeriodEnd: null });
    }
    return json(200, {
      tier: sub.tier,
      status: sub.status,
      cycle: sub.cycle,
      currentPeriodEnd: sub.current_period_end,
    });
  } catch (err) {
    return json(err.statusCode || 500, { error: err.message });
  }
};
