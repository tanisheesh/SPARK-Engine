#!/usr/bin/env bash
# Creates an HTTP API in front of the 4 billing Lambdas, with a Cognito JWT
# authorizer on every route except the public Razorpay webhook. Electron's
# renderer is a real browser context, so CORS applies even though this
# isn't a public website — every protected route still requires a valid
# Cognito ID token regardless of origin.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
source ./00-env.sh

if [ -z "${USER_POOL_ID:-}" ] || [ -z "${CLIENT_ID:-}" ]; then
  echo "USER_POOL_ID / CLIENT_ID are not set — run 01-cognito.sh first and add its output to 00-env.local.sh." >&2
  exit 1
fi

ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
ISSUER="https://cognito-idp.${AWS_REGION}.amazonaws.com/${USER_POOL_ID}"

echo "==> Creating HTTP API: $API_NAME"
API_ID=$(aws apigatewayv2 create-api \
  --name "$API_NAME" --protocol-type HTTP \
  --cors-configuration 'AllowOrigins=*,AllowMethods=GET,POST,OPTIONS,AllowHeaders=authorization,content-type' \
  --region "$AWS_REGION" \
  --query 'ApiId' --output text)
echo "    ApiId: $API_ID"

echo "==> Creating the Cognito JWT authorizer"
AUTHORIZER_ID=$(aws apigatewayv2 create-authorizer \
  --api-id "$API_ID" --region "$AWS_REGION" \
  --authorizer-type JWT \
  --identity-source '$request.header.Authorization' \
  --name "${PROJECT}-cognito-jwt" \
  --jwt-configuration "Audience=${CLIENT_ID},Issuer=${ISSUER}" \
  --query 'AuthorizerId' --output text)

add_route() {
  local method="$1" path="$2" fn="$3" authorized="$4"
  local full_name="${PROJECT}-${fn}"
  local fn_arn="arn:aws:lambda:${AWS_REGION}:${ACCOUNT_ID}:function:${full_name}"

  local integration_id
  integration_id=$(aws apigatewayv2 create-integration \
    --api-id "$API_ID" --region "$AWS_REGION" \
    --integration-type AWS_PROXY --integration-method POST \
    --payload-format-version '2.0' \
    --integration-uri "$fn_arn" \
    --query 'IntegrationId' --output text)

  if [ "$authorized" = "yes" ]; then
    aws apigatewayv2 create-route \
      --api-id "$API_ID" --region "$AWS_REGION" \
      --route-key "${method} ${path}" \
      --target "integrations/${integration_id}" \
      --authorization-type JWT --authorizer-id "$AUTHORIZER_ID" >/dev/null
  else
    aws apigatewayv2 create-route \
      --api-id "$API_ID" --region "$AWS_REGION" \
      --route-key "${method} ${path}" \
      --target "integrations/${integration_id}" >/dev/null
  fi

  aws lambda add-permission \
    --function-name "$full_name" --region "$AWS_REGION" \
    --statement-id "apigw-${fn}" \
    --action lambda:InvokeFunction \
    --principal apigateway.amazonaws.com \
    --source-arn "arn:aws:execute-api:${AWS_REGION}:${ACCOUNT_ID}:${API_ID}/*/*${path}" \
    >/dev/null 2>&1 || true # already granted on a re-run

  echo "    ${method} ${path} -> ${full_name} (auth: ${authorized})"
}

echo "==> Wiring routes"
add_route "GET"    "/billing/status"       "billing-status"         "yes"
add_route "POST"   "/billing/create-order" "billing-create-order"   "yes"
add_route "POST"   "/billing/verify-payment" "billing-verify-payment" "yes"
add_route "POST"   "/billing/webhook"      "billing-webhook"        "no"

echo "==> Deploying \$default auto-deploy stage"
aws apigatewayv2 create-stage \
  --api-id "$API_ID" --region "$AWS_REGION" \
  --stage-name '$default' --auto-deploy >/dev/null 2>&1 || true

API_URL="https://${API_ID}.execute-api.${AWS_REGION}.amazonaws.com"

cat <<EOF

API is live. Add to .env:

  NEXT_PUBLIC_API_BASE_URL=${API_URL}

Give this to Razorpay as the webhook URL (Dashboard → Settings → Webhooks):

  ${API_URL}/billing/webhook
EOF
