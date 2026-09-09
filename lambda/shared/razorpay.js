/* Razorpay REST calls via plain https + crypto — no razorpay npm package,
   so the Lambda bundle stays a few files with zero install step. Both
   RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET are Lambda-only env vars (set by
   infra/aws/04-lambda-deploy.sh); the secret never reaches the client. */

const https = require('https');
const crypto = require('crypto');

function request(method, path, body) {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    throw new Error('RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET are not set on this Lambda');
  }
  const payload = body ? JSON.stringify(body) : undefined;

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: 'api.razorpay.com',
        path,
        method,
        auth: `${keyId}:${keySecret}`,
        headers: {
          'content-type': 'application/json',
          ...(payload ? { 'content-length': Buffer.byteLength(payload) } : {}),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          let parsed;
          try {
            parsed = data ? JSON.parse(data) : {};
          } catch {
            reject(new Error(`Razorpay returned non-JSON response: ${data.slice(0, 200)}`));
            return;
          }
          if (res.statusCode >= 200 && res.statusCode < 300) resolve(parsed);
          else reject(new Error(parsed?.error?.description || `Razorpay API error ${res.statusCode}`));
        });
      }
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

/** Creates a Razorpay order. `amount` is in the smallest currency unit (paise). */
function createOrder({ amount, currency, receipt, notes }) {
  return request('POST', '/v1/orders', { amount, currency, receipt, notes });
}

/** HMAC-SHA256(order_id + "|" + payment_id) signed with the key secret —
    Razorpay's documented checkout-verification scheme. */
function verifyPaymentSignature({ orderId, paymentId, signature }) {
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  const expected = crypto
    .createHmac('sha256', keySecret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');
  return timingSafeEqualHex(expected, signature);
}

/** Webhook payloads are signed over the raw request body with the
    separate webhook secret (configured in the Razorpay dashboard). */
function verifyWebhookSignature({ rawBody, signature }) {
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  const expected = crypto.createHmac('sha256', webhookSecret).update(rawBody).digest('hex');
  return timingSafeEqualHex(expected, signature);
}

function timingSafeEqualHex(a, b) {
  if (typeof b !== 'string' || a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'));
}

module.exports = { createOrder, verifyPaymentSignature, verifyWebhookSignature };
