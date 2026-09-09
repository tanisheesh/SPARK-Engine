# AWS infrastructure — replaces Supabase, adds Razorpay billing

These scripts provision everything SPARK Engine's backend needs: Cognito
(auth), DynamoDB (data), Lambda + API Gateway (the API — this app has no
server of its own, it's a static Next.js export running inside Electron).

They are **not run automatically**. Run them yourself, in order, once you
have real Google OAuth and Razorpay credentials to hand.

## Prerequisites

- AWS CLI v2, authenticated (`aws sts get-caller-identity` should work).
- `zip` on your PATH (used by `04-lambda-deploy.sh`).
- The Google OAuth Client ID/Secret already used for Supabase's Google
  sign-in (Google Cloud Console → APIs & Services → Credentials).
- A Razorpay account. Test-mode keys are enough to go through this whole
  flow end to end before switching to live keys.

## Setup

```bash
cd infra/aws
cp 00-env.sh 00-env.local.sh   # or just create 00-env.local.sh with overrides
```

Edit `00-env.local.sh` and fill in:

```bash
export GOOGLE_CLIENT_ID=...
export GOOGLE_CLIENT_SECRET=...
export RAZORPAY_KEY_ID=...
export RAZORPAY_KEY_SECRET=...
export RAZORPAY_WEBHOOK_SECRET=...          # from Razorpay's webhook config, see step 5
export COGNITO_DOMAIN_PREFIX=your-unique-prefix   # must be globally unique
```

## Run order

```bash
./01-cognito.sh        # Cognito User Pool + Google IdP + Hosted UI
./02-dynamodb.sh        # 3 DynamoDB tables
./03-lambda-iam.sh      # execution role, table-scoped policy
./04-lambda-deploy.sh   # zips lambda/ and deploys all 7 functions
./05-api-gateway.sh     # HTTP API + JWT authorizer + routes
```

Each script prints the values it created. **`01-cognito.sh` and
`05-api-gateway.sh` also tell you to append `USER_POOL_ID` / `CLIENT_ID` to
`00-env.local.sh`** — the later scripts need them, so don't skip that.

## One manual step

Google Cloud Console → APIs & Services → Credentials → your OAuth client →
Authorized redirect URIs → add:

```
https://<COGNITO_DOMAIN_PREFIX>.auth.<region>.amazoncognito.com/oauth2/idpresponse
```

(`01-cognito.sh` prints the exact URL to paste.)

## Razorpay webhook

After `05-api-gateway.sh` prints the webhook URL, add it in the Razorpay
Dashboard under Settings → Webhooks, subscribed to at least `payment.captured`
and `order.paid`. Razorpay gives you a webhook secret at that point — put it
in `00-env.local.sh` as `RAZORPAY_WEBHOOK_SECRET` and re-run
`04-lambda-deploy.sh` so `billing-webhook` picks it up.

## Copy these into the app's `.env`

```bash
NEXT_PUBLIC_COGNITO_DOMAIN=...          # from 01-cognito.sh
NEXT_PUBLIC_COGNITO_CLIENT_ID=...       # from 01-cognito.sh
NEXT_PUBLIC_COGNITO_REDIRECT_URI=spark-engine://auth/callback
NEXT_PUBLIC_API_BASE_URL=...            # from 05-api-gateway.sh
```

Remove the old `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`
lines — nothing reads them anymore.

## Go-live checklist

- [ ] Ran all 5 scripts in order, no errors.
- [ ] Google Cloud redirect URI added.
- [ ] Razorpay webhook URL configured, secret saved, Lambdas redeployed.
- [ ] `.env` updated with the 4 `NEXT_PUBLIC_*` values above.
- [ ] `npm run build && npm run app` — sign in with Google end to end.
- [ ] Open Pricing, buy one tier with a Razorpay **test-mode** card, confirm
      `/billing/status` reflects the new tier.
- [ ] Switch `RAZORPAY_KEY_ID`/`RAZORPAY_KEY_SECRET` to live keys and
      re-run `04-lambda-deploy.sh` when ready to accept real payments.

## Updating a Lambda after editing its code

Just re-run `./04-lambda-deploy.sh` — it re-zips `lambda/` and updates all
7 functions in place (`update-function-code` if they already exist).

## Tearing it down

Not scripted on purpose — these are real resources with real data
(subscriptions, saved prompts). Delete them by hand in the console, or ask
for a `99-teardown.sh` if you actually want one.
