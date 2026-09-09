const { client, TABLES, PutCommand, GetCommand } = require('../shared/dynamo');
const { userIdFrom, json } = require('../shared/auth');
const { verifyPaymentSignature } = require('../shared/razorpay');
const { addCycle } = require('../shared/billing');

/* POST /billing/verify-payment  { orderId, paymentId, signature }
   Called by the client right after Razorpay Checkout's success handler
   fires. The signature is recomputed here with RAZORPAY_KEY_SECRET — a
   client claiming success means nothing until this check passes. The
   webhook Lambda (billing-webhook) is the belt-and-braces backup for the
   case where the client never gets to call this at all. */
exports.handler = async (event) => {
  try {
    const userId = userIdFrom(event);
    const body = JSON.parse(event.body || '{}');
    const { orderId, paymentId, signature } = body;
    if (!orderId || !paymentId || !signature) {
      return json(400, { error: 'orderId, paymentId and signature are required' });
    }

    const paymentRow = await client.send(
      new GetCommand({
        TableName: TABLES.payments,
        Key: { user_id: userId, razorpay_order_id: orderId },
      })
    );
    if (!paymentRow.Item) {
      return json(404, { error: 'No matching order for this user' });
    }

    const valid = verifyPaymentSignature({ orderId, paymentId, signature });
    if (!valid) {
      return json(400, { error: 'Signature verification failed' });
    }

    const now = new Date().toISOString();
    const { tier, cycle } = paymentRow.Item;

    await Promise.all([
      client.send(
        new PutCommand({
          TableName: TABLES.payments,
          Item: {
            ...paymentRow.Item,
            razorpay_payment_id: paymentId,
            razorpay_signature: signature,
            status: 'verified',
            verified_at: now,
          },
        })
      ),
      client.send(
        new PutCommand({
          TableName: TABLES.subscriptions,
          Item: {
            user_id: userId,
            tier,
            cycle,
            status: 'active',
            razorpay_order_id: orderId,
            razorpay_payment_id: paymentId,
            current_period_end: addCycle(now, cycle),
            updated_at: now,
          },
        })
      ),
    ]);

    return json(200, { tier, status: 'active' });
  } catch (err) {
    return json(err.statusCode || 500, { error: err.message });
  }
};
