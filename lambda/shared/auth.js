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

module.exports = { userIdFrom, json };
