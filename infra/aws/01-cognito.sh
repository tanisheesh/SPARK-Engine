#!/usr/bin/env bash
# Creates the Cognito User Pool that replaces Supabase Auth: a Google
# federated identity provider, a public (no-secret) app client using
# Authorization Code + PKCE, and a Hosted UI domain. Prints the values that
# go into the app's .env as NEXT_PUBLIC_COGNITO_*.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
source ./00-env.sh

if [ -z "$GOOGLE_CLIENT_ID" ] || [ -z "$GOOGLE_CLIENT_SECRET" ]; then
  echo "Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in 00-env.local.sh first." >&2
  echo "(Same Google Cloud OAuth client already used for Supabase — see README.md.)" >&2
  exit 1
fi

echo "==> Creating Cognito User Pool: $USER_POOL_NAME"
USER_POOL_ID=$(aws cognito-idp create-user-pool \
  --pool-name "$USER_POOL_NAME" \
  --region "$AWS_REGION" \
  --auto-verified-attributes email \
  --username-attributes email \
  --query 'UserPool.Id' --output text)
echo "    UserPoolId: $USER_POOL_ID"

echo "==> Registering Google as a federated identity provider"
aws cognito-idp create-identity-provider \
  --user-pool-id "$USER_POOL_ID" \
  --region "$AWS_REGION" \
  --provider-name Google \
  --provider-type Google \
  --provider-details "client_id=${GOOGLE_CLIENT_ID},client_secret=${GOOGLE_CLIENT_SECRET},authorize_scopes=openid email profile" \
  --attribute-mapping "email=email,name=name,picture=picture,username=sub" \
  >/dev/null

echo "==> Creating the app client (public client, Authorization Code + PKCE)"
CLIENT_ID=$(aws cognito-idp create-user-pool-client \
  --user-pool-id "$USER_POOL_ID" \
  --region "$AWS_REGION" \
  --client-name "${PROJECT}-electron" \
  --no-generate-secret \
  --supported-identity-providers Google \
  --allowed-o-auth-flows code \
  --allowed-o-auth-scopes openid email profile \
  --allowed-o-auth-flows-user-pool-client \
  --callback-urls "$OAUTH_REDIRECT_URI" \
  --logout-urls "$OAUTH_REDIRECT_URI" \
  --query 'UserPoolClient.ClientId' --output text)
echo "    ClientId: $CLIENT_ID"

echo "==> Creating the Hosted UI domain: $COGNITO_DOMAIN_PREFIX"
aws cognito-idp create-user-pool-domain \
  --domain "$COGNITO_DOMAIN_PREFIX" \
  --user-pool-id "$USER_POOL_ID" \
  --region "$AWS_REGION" >/dev/null

COGNITO_DOMAIN="${COGNITO_DOMAIN_PREFIX}.auth.${AWS_REGION}.amazoncognito.com"

cat <<EOF

Cognito is set up. Add these to .env:

  NEXT_PUBLIC_COGNITO_DOMAIN=https://${COGNITO_DOMAIN}
  NEXT_PUBLIC_COGNITO_CLIENT_ID=${CLIENT_ID}
  NEXT_PUBLIC_COGNITO_REDIRECT_URI=${OAUTH_REDIRECT_URI}

Save these too — later scripts need them:
  echo "export USER_POOL_ID=${USER_POOL_ID}" >> ./00-env.local.sh
  echo "export CLIENT_ID=${CLIENT_ID}" >> ./00-env.local.sh

Remaining manual step (Google Cloud Console → APIs & Services → Credentials
→ your OAuth client → Authorized redirect URIs): add
  https://${COGNITO_DOMAIN}/oauth2/idpresponse
EOF
