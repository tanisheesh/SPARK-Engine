#!/usr/bin/env bash
# Creates the 2 DynamoDB tables that replace Supabase Postgres. Both are
# on-demand billing (no capacity planning) since usage is one desktop
# app's worth of traffic, not a public API.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
source ./00-env.sh

create_table() {
  local name="$1"; shift
  if aws dynamodb describe-table --table-name "$name" --region "$AWS_REGION" >/dev/null 2>&1; then
    echo "==> $name already exists, skipping"
    return
  fi
  echo "==> Creating table: $name"
  aws dynamodb create-table --table-name "$name" --region "$AWS_REGION" --billing-mode PAY_PER_REQUEST "$@" >/dev/null
}

# user_id (PK only) — one active subscription row per user.
create_table "$TABLE_SUBSCRIPTIONS" \
  --attribute-definitions AttributeName=user_id,AttributeType=S \
  --key-schema AttributeName=user_id,KeyType=HASH

# user_id (PK) + razorpay_order_id (SK) — audit trail of payment attempts.
create_table "$TABLE_PAYMENTS" \
  --attribute-definitions AttributeName=user_id,AttributeType=S AttributeName=razorpay_order_id,AttributeType=S \
  --key-schema AttributeName=user_id,KeyType=HASH AttributeName=razorpay_order_id,KeyType=RANGE

echo
echo "Tables ready: $TABLE_SUBSCRIPTIONS, $TABLE_PAYMENTS"
