#!/usr/bin/env bash
# Adds a SECOND Cognito app client to the existing user pool, for SPARK Mobile.
#
# Why a second client rather than reusing the desktop's: an app client is
# pinned to its callback URLs. The desktop registers spark-engine://auth/callback
# (an Electron deep link); the phone needs sparkmobile://auth/callback. Adding
# the phone's URL to the desktop client would let a token minted for one be
# redirected to the other, so they stay separate.
#
# Both clients are PUBLIC clients with no secret — neither an Electron app nor
# an APK can keep one, which is exactly why both use Authorization Code + PKCE.
#
# Safe to re-run: it looks for an existing client by name first.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
source ./00-env.sh

if [ -z "${USER_POOL_ID:-}" ]; then
  echo "USER_POOL_ID is not set — run 01-cognito.sh first and add its output to 00-env.local.sh." >&2
  exit 1
fi

MOBILE_CLIENT_NAME="${PROJECT}-mobile"

# Expo Go serves the dev client over an exp:// proxy URL, which Cognito must
# also accept or sign-in fails before a login form is ever shown. Keep the
# standalone scheme first — that is the one a shipped APK uses.
MOBILE_CALLBACKS="sparkmobile://auth/callback"
if [ -n "${EXPO_DEV_REDIRECT:-}" ]; then
  MOBILE_CALLBACKS="${MOBILE_CALLBACKS},${EXPO_DEV_REDIRECT}"
  echo "==> Including Expo dev redirect: ${EXPO_DEV_REDIRECT}"
fi

echo "==> Looking for an existing ${MOBILE_CLIENT_NAME} client"
EXISTING=$(aws cognito-idp list-user-pool-clients \
  --user-pool-id "$USER_POOL_ID" --region "$AWS_REGION" --max-results 60 \
  --query "UserPoolClients[?ClientName=='${MOBILE_CLIENT_NAME}'].ClientId | [0]" \
  --output text 2>/dev/null || echo "None")

if [ "$EXISTING" != "None" ] && [ -n "$EXISTING" ]; then
  echo "    Already exists: $EXISTING — updating its callback URLs"
  aws cognito-idp update-user-pool-client \
    --user-pool-id "$USER_POOL_ID" --client-id "$EXISTING" --region "$AWS_REGION" \
    --client-name "$MOBILE_CLIENT_NAME" \
    --supported-identity-providers COGNITO Google \
    --callback-urls "$MOBILE_CALLBACKS" \
    --logout-urls "$MOBILE_CALLBACKS" \
    --allowed-o-auth-flows code \
    --allowed-o-auth-scopes openid email profile \
    --allowed-o-auth-flows-user-pool-client \
    --explicit-auth-flows ALLOW_REFRESH_TOKEN_AUTH \
    >/dev/null
  MOBILE_CLIENT_ID="$EXISTING"
else
  echo "==> Creating app client: $MOBILE_CLIENT_NAME"
  MOBILE_CLIENT_ID=$(aws cognito-idp create-user-pool-client \
    --user-pool-id "$USER_POOL_ID" --region "$AWS_REGION" \
    --client-name "$MOBILE_CLIENT_NAME" \
    --no-generate-secret \
    --supported-identity-providers COGNITO Google \
    --callback-urls "$MOBILE_CALLBACKS" \
    --logout-urls "$MOBILE_CALLBACKS" \
    --allowed-o-auth-flows code \
    --allowed-o-auth-scopes openid email profile \
    --allowed-o-auth-flows-user-pool-client \
    --explicit-auth-flows ALLOW_REFRESH_TOKEN_AUTH \
    --refresh-token-validity 30 \
    --query 'UserPoolClient.ClientId' --output text)
fi

COGNITO_DOMAIN_URL="https://${COGNITO_DOMAIN_PREFIX}.auth.${AWS_REGION}.amazoncognito.com"

cat <<EOF

Mobile app client ready.

  ClientId: ${MOBILE_CLIENT_ID}
  Callbacks: ${MOBILE_CALLBACKS}

Add to mobile/.env:

  EXPO_PUBLIC_COGNITO_DOMAIN=${COGNITO_DOMAIN_URL}
  EXPO_PUBLIC_COGNITO_CLIENT_ID=${MOBILE_CLIENT_ID}

Add to the relay's environment so it accepts tokens from BOTH clients
(a token minted for one app client is rejected for the other):

  SPARK_RELAY_MODE=cognito
  COGNITO_REGION=${AWS_REGION}
  COGNITO_USER_POOL_ID=${USER_POOL_ID}
  COGNITO_CLIENT_ID_DESKTOP=${CLIENT_ID:-<desktop client id>}
  COGNITO_CLIENT_ID_MOBILE=${MOBILE_CLIENT_ID}

Developing with Expo Go? Run this again with the proxy URL that
\`npx expo start\` prints, so Cognito will redirect back to it:

  EXPO_DEV_REDIRECT='exp://192.168.1.20:8081/--/auth/callback' ./06-cognito-mobile.sh
EOF
