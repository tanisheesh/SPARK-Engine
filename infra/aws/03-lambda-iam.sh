#!/usr/bin/env bash
# Creates one execution role shared by all Lambdas, scoped to exactly
# what they need: write CloudWatch Logs, and read/write the 2 tables from
# 02-dynamodb.sh. Nothing broader — no wildcard dynamodb:*, no other
# tables, no other AWS services.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
source ./00-env.sh

ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

TRUST_POLICY='{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": { "Service": "lambda.amazonaws.com" },
    "Action": "sts:AssumeRole"
  }]
}'

if aws iam get-role --role-name "$LAMBDA_ROLE_NAME" >/dev/null 2>&1; then
  echo "==> Role $LAMBDA_ROLE_NAME already exists, skipping creation"
else
  echo "==> Creating IAM role: $LAMBDA_ROLE_NAME"
  aws iam create-role \
    --role-name "$LAMBDA_ROLE_NAME" \
    --assume-role-policy-document "$TRUST_POLICY" >/dev/null
fi

aws iam attach-role-policy \
  --role-name "$LAMBDA_ROLE_NAME" \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole

DYNAMO_POLICY=$(cat <<EOF
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": ["dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:Query", "dynamodb:DeleteItem"],
    "Resource": [
      "arn:aws:dynamodb:${AWS_REGION}:${ACCOUNT_ID}:table/${TABLE_SUBSCRIPTIONS}",
      "arn:aws:dynamodb:${AWS_REGION}:${ACCOUNT_ID}:table/${TABLE_PAYMENTS}"
    ]
  }]
}
EOF
)

echo "==> Attaching table-scoped DynamoDB policy"
aws iam put-role-policy \
  --role-name "$LAMBDA_ROLE_NAME" \
  --policy-name "${PROJECT}-dynamo-access" \
  --policy-document "$DYNAMO_POLICY"

ROLE_ARN=$(aws iam get-role --role-name "$LAMBDA_ROLE_NAME" --query 'Role.Arn' --output text)
echo
echo "Role ready: $ROLE_ARN"
echo "IAM role propagation can take ~10s before 04-lambda-deploy.sh can use it."
