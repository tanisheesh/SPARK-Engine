const { client, TABLES, PutCommand } = require('../shared/dynamo');
const { userIdFrom, json } = require('../shared/auth');
const { priceFor } = require('../shared/tiers');
const { createOrder } = require('../shared/razorpay');

const VALID_TIERS = ['IGNITE', 'BLAZE', 'STORM', 'THUNDER'];
const VALID_CYCLES = ['monthly', 'yearly'];

/* POST /billing/create-order  { tier, cycle }
   The client only ever chooses WHICH tier/cycle — the price itself comes
   from lambda/shared/tiers.js on the server. Never trust a client-supplied
   amount for a payment. */
exports.handler = async (event) => {
  try {
    const userId = userIdFrom(event);
    const body = JSON.parse(event.body || '{}');
    const tier = String(body.tier || '').toUpperCase();
    const cycle = String(body.cycle || '').toLowerCase();

    if (!VALID_TIERS.includes(tier)) {
      return json(400, { error: `tier must be one of ${VALID_TIERS.join(', ')}` });
    }
    if (!VALID_CYCLES.includes(cycle)) {
      return json(400, { error: `cycle must be one of ${VALID_CYCLES.join(', ')}` });
    }

    const price = priceFor(tier, cycle);
    const receipt = `spark_${tier}_${cycle}_${Date.now()}`;

    const order = await createOrder({
      amount: price.amount,
      currency: price.currency,
      receipt,
      notes: { user_id: userId, tier, cycle },
    });

    await client.send(
      new PutCommand({
        TableName: TABLES.payments,
        Item: {
          user_id: userId,
          razorpay_order_id: order.id,
          tier,
          cycle,
          amount: price.amount,
          currency: price.currency,
          status: 'created',
          created_at: new Date().toISOString(),
        },
      })
    );

    return json(200, {
      orderId: order.id,
      amount: price.amount,
      currency: price.currency,
      keyId: process.env.RAZORPAY_KEY_ID,
    });
  } catch (err) {
    return json(err.statusCode || 500, { error: err.message });
  }
};
