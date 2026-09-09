/* Thin DynamoDB DocumentClient wrapper shared by every Lambda. Table names
   come from environment variables set by infra/aws/04-lambda-deploy.sh so
   the same code works across dev/prod stacks without edits. */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  DeleteCommand,
} = require('@aws-sdk/lib-dynamodb');

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const TABLES = {
  subscriptions: process.env.SUBSCRIPTIONS_TABLE || 'spark-subscriptions',
  payments: process.env.PAYMENTS_TABLE || 'spark-payments',
};

module.exports = {
  client,
  TABLES,
  GetCommand,
  PutCommand,
  QueryCommand,
  DeleteCommand,
};
