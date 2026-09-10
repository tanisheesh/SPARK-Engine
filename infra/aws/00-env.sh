#!/usr/bin/env bash
# Shared config for every script in this folder. Copy this file to
# `00-env.local.sh` (gitignored) and fill in the blanks — every other
# script sources that file, falling back to this one's defaults.
#
# Nothing here is a secret except GOOGLE_CLIENT_SECRET, and even that one
# only lives in your shell / 00-env.local.sh, never committed.

export AWS_PROFILE="${AWS_PROFILE:-spark-engine}"
export AWS_REGION="${AWS_REGION:-ap-south-1}"
export PROJECT="${PROJECT:-spark-engine}"

# --- Cognito / Google federation -------------------------------------
# Reuse the SAME Google OAuth client that Supabase was registered under.
# You only need to add one redirect URI to it (see infra/aws/README.md).
export GOOGLE_CLIENT_ID="${GOOGLE_CLIENT_ID:-}"
export GOOGLE_CLIENT_SECRET="${GOOGLE_CLIENT_SECRET:-}"
# Must be globally unique across all of Cognito — pick something specific.
export COGNITO_DOMAIN_PREFIX="${COGNITO_DOMAIN_PREFIX:-spark-engine-auth-9855}"
export OAUTH_REDIRECT_URI="${OAUTH_REDIRECT_URI:-spark-engine://auth/callback}"

# --- Razorpay (Lambda-only secrets, never shipped to the client) -----
export RAZORPAY_KEY_ID="${RAZORPAY_KEY_ID:-}"
export RAZORPAY_KEY_SECRET="${RAZORPAY_KEY_SECRET:-}"
export RAZORPAY_WEBHOOK_SECRET="${RAZORPAY_WEBHOOK_SECRET:-}"

# --- Managed Groq/Deepgram keys (THUNDER only, lambda/managed-keys) ---
# SPARK's own keys, used automatically for THUNDER accounts so they never
# see a BYOK prompt. Lambda-only secret — never shipped to the client or
# the packaged app; a non-THUNDER caller gets 403 from the Lambda itself.
export MANAGED_GROQ_API_KEY="${MANAGED_GROQ_API_KEY:-}"
export MANAGED_DEEPGRAM_API_KEY="${MANAGED_DEEPGRAM_API_KEY:-}"

# --- Derived resource names (rarely need changing) --------------------
export USER_POOL_NAME="${PROJECT}-users"
export TABLE_SUBSCRIPTIONS="${PROJECT}-subscriptions"
export TABLE_PAYMENTS="${PROJECT}-payments"
export TABLE_USAGE="${PROJECT}-usage"
export LAMBDA_ROLE_NAME="${PROJECT}-lambda-exec"
export API_NAME="${PROJECT}-api"

if [ -f "$(dirname "${BASH_SOURCE[0]}")/00-env.local.sh" ]; then
  # shellcheck disable=SC1091
  source "$(dirname "${BASH_SOURCE[0]}")/00-env.local.sh"
fi
