const { client, TABLES, PutCommand } = require('../shared/dynamo');
const { json, rawBody: getRawBody } = require('../shared/auth');
const { verifyWebhookSignature } = require('../shared/razorpay');
const { addCycle } = require('../shared/billing');

/* POST /billing/webhook — public route (no Cognito authorizer; Razorpay
   isn't a signed-in user). Trust comes entirely from the signature over
   the raw body, checked against RAZORPAY_WEBHOOK_SECRET (set separately
   from RAZORPAY_KEY_SECRET in the Razorpay dashboard's webhook config).

   This exists as the backup path for billing-verify-payment: if the app
   is closed the instant Checkout succeeds, the client never calls verify,
   but Razorpay still fires this webhook, so the subscription is written
   either way. */
exports.handler = async (event) => {
  try {
    const signature = event.headers?.['x-razorpay-signature'] || event.headers?.['X-Razorpay-Signature'];
    const rawBody = getRawBody(event);
    if (!signature || !verifyWebhookSignature({ rawBody, signature })) {
      return json(400, { error: 'Invalid webhook signature' });
    }

    const payload = JSON.parse(rawBody);
    if (payload.event !== 'payment.captured' && payload.event !== 'order.paid') {
      return json(200, { ignored: payload.event });
    }

    const payment = payload.payload?.payment?.entity;
    const notes = payment?.notes || payload.payload?.order?.entity?.notes;
    const userId = notes?.user_id;
    const tier = notes?.tier;
    const cycle = notes?.cycle;
    if (!userId || !tier || !cycle) {
      // Nothing to attribute this to — log and accept so Razorpay doesn't retry forever.
      return json(200, { ignored: 'missing notes.user_id/tier/cycle' });
    }

    const now = new Date().toISOString();
    await client.send(
      new PutCommand({
        TableName: TABLES.subscriptions,
        Item: {
          user_id: userId,
          tier,
          cycle,
          status: 'active',
          razorpay_order_id: payment?.order_id,
          razorpay_payment_id: payment?.id,
          current_period_end: addCycle(now, cycle),
          updated_at: now,
          source: 'webhook',
        },
      })
    );

    return json(200, { ok: true });
  } catch (err) {
    return json(err.statusCode || 500, { error: err.message });
  }
};
