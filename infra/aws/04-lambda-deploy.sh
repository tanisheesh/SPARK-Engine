#!/usr/bin/env bash
# Zips the whole lambda/ folder ONCE (so every function's `require('../shared/...')`
# resolves without any path rewriting) and deploys all 5 functions from
# that one zip, each pointed at its own `<dir>/index.handler`. No npm
# install and no node_modules — @aws-sdk/client-dynamodb and
# @aws-sdk/lib-dynamodb ship built into the Node.js 20 Lambda runtime already.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
source ./00-env.sh

if [ -z "${USER_POOL_ID:-}" ]; then
  echo "USER_POOL_ID is not set — run 01-cognito.sh first and add its output to 00-env.local.sh." >&2
  exit 1
fi

ROLE_ARN=$(aws iam get-role --role-name "$LAMBDA_ROLE_NAME" --query 'Role.Arn' --output text)

LAMBDA_DIR="../../lambda"
ZIP_PATH="/tmp/${PROJECT}-lambda.zip"

if command -v zip >/dev/null 2>&1; then
  rm -f "$ZIP_PATH"
  (cd "$LAMBDA_DIR" && zip -qr "$ZIP_PATH" . -x '*.git*')
  echo "==> Packaged $LAMBDA_DIR into $ZIP_PATH"
elif [ -f "$ZIP_PATH" ]; then
  echo "==> Using existing $ZIP_PATH (no 'zip' on this box — rebuild it first if lambda/ changed)"
else
  cat >&2 <<EOF
No 'zip' command on this system, and no pre-built archive at $ZIP_PATH.
On Windows, build it with PowerShell first:

  \$src = "$(cd "$LAMBDA_DIR" && pwd | sed 's#^/\([a-z]\)#\U\1:#')"
  Compress-Archive -Path "\$src\*" -DestinationPath "$ZIP_PATH" -Force

Then re-run this script.
EOF
  exit 1
fi

# The AWS CLI's own Python process doesn't understand Git Bash's /tmp ->
# C:\Users\...\Temp mapping (only bash itself does), so `--zip-file
# fileb://...` needs a real Windows path here when cygpath is available.
AWS_ZIP_PATH="$ZIP_PATH"
if command -v cygpath >/dev/null 2>&1; then
  AWS_ZIP_PATH=$(cygpath -w "$ZIP_PATH")
fi

# JSON, not the --environment Variables={} shorthand — the shorthand parser
# chokes on empty values (RAZORPAY_KEY_ID etc. are blank until real keys are added).
ENV_DIR=$(mktemp -d)
cat > "$ENV_DIR/billing.json" <<EOF
{"Variables":{"SUBSCRIPTIONS_TABLE":"${TABLE_SUBSCRIPTIONS}","PAYMENTS_TABLE":"${TABLE_PAYMENTS}","USAGE_TABLE":"${TABLE_USAGE}","RAZORPAY_KEY_ID":"${RAZORPAY_KEY_ID}","RAZORPAY_KEY_SECRET":"${RAZORPAY_KEY_SECRET}","RAZORPAY_WEBHOOK_SECRET":"${RAZORPAY_WEBHOOK_SECRET}"}}
EOF
cat > "$ENV_DIR/usage.json" <<EOF
{"Variables":{"SUBSCRIPTIONS_TABLE":"${TABLE_SUBSCRIPTIONS}","USAGE_TABLE":"${TABLE_USAGE}"}}
EOF
cat > "$ENV_DIR/managed-keys.json" <<EOF
{"Variables":{"SUBSCRIPTIONS_TABLE":"${TABLE_SUBSCRIPTIONS}","MANAGED_GROQ_API_KEY":"${MANAGED_GROQ_API_KEY}","MANAGED_DEEPGRAM_API_KEY":"${MANAGED_DEEPGRAM_API_KEY}"}}
EOF
# Same Windows-path issue as the zip — the AWS CLI's Python process needs a
# real path, not Git Bash's /tmp/... view of it.
if command -v cygpath >/dev/null 2>&1; then
  ENV_DIR=$(cygpath -w "$ENV_DIR")
  # cygpath gives backslashes; both json files still resolve fine since
  # aws-cli/Windows accepts `file://C:\...\common.json` verbatim below.
fi

deploy_function() {
  local name="$1" handler="$2" env_file="$3"
  local full_name="${PROJECT}-${name}"
  if aws lambda get-function --function-name "$full_name" --region "$AWS_REGION" >/dev/null 2>&1; then
    echo "==> Updating $full_name"
    aws lambda update-function-code \
      --function-name "$full_name" --region "$AWS_REGION" \
      --zip-file "fileb://${AWS_ZIP_PATH}" >/dev/null
    aws lambda wait function-updated --function-name "$full_name" --region "$AWS_REGION"
    aws lambda update-function-configuration \
      --function-name "$full_name" --region "$AWS_REGION" \
      --environment "file://${env_file}" >/dev/null
  else
    echo "==> Creating $full_name"
    aws lambda create-function \
      --function-name "$full_name" --region "$AWS_REGION" \
      --runtime nodejs20.x \
      --handler "$handler" \
      --role "$ROLE_ARN" \
      --timeout 10 \
      --zip-file "fileb://${AWS_ZIP_PATH}" \
      --environment "file://${env_file}" >/dev/null
  fi
}

deploy_function "billing-status"       "billing-status/index.handler"       "$ENV_DIR/billing.json"
deploy_function "billing-create-order" "billing-create-order/index.handler" "$ENV_DIR/billing.json"
deploy_function "billing-verify-payment" "billing-verify-payment/index.handler" "$ENV_DIR/billing.json"
deploy_function "billing-webhook"      "billing-webhook/index.handler"      "$ENV_DIR/billing.json"
deploy_function "usage-consume"        "usage-consume/index.handler"        "$ENV_DIR/usage.json"
deploy_function "managed-keys"         "managed-keys/index.handler"         "$ENV_DIR/managed-keys.json"

rm -rf "$ENV_DIR"

echo
echo "All 6 Lambdas deployed. Next: 05-api-gateway.sh"
