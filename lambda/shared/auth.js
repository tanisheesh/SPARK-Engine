/* API Gateway's Cognito JWT authorizer verifies the token before the
   Lambda ever runs and hands the decoded claims through on the request
   context. This reads the user id from there — never from anything the
   client put in the request body — which is what gives these Lambdas the
   same per-user isolation Supabase Row Level Security used to provide. */

function userIdFrom(event) {
  const claims = event.requestContext?.authorizer?.jwt?.claims;
  const sub = claims?.sub;
  if (!sub) {
    const err = new Error('Missing or unverified auth token');
    err.statusCode = 401;
    throw err;
  }
  return sub;
}

function json(statusCode, body) {
  return {
    statusCode,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  };
}

/** API Gateway (HTTP API) base64-encodes the request body for some
    Content-Types and sets isBase64Encoded accordingly — plain
    `JSON.parse(event.body)` silently breaks (throws on the base64 text)
    whenever that happens. Every handler that reads a JSON body should
    parse it through here instead. */
function rawBody(event) {
  return event.isBase64Encoded
    ? Buffer.from(event.body || '', 'base64').toString('utf8')
    : event.body || '';
}

function parseJsonBody(event) {
  const text = rawBody(event);
  return text ? JSON.parse(text) : {};
}

module.exports = { userIdFrom, json, rawBody, parseJsonBody };
