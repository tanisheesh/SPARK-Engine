/* Env-driven config for the AWS backend (Cognito + API Gateway) that
   replaced Supabase. Same pattern lib/supabase.ts used: NEXT_PUBLIC_* vars
   are inlined at build time since this app is a static Next.js export with
   no server of its own. See infra/aws/README.md for where these values
   come from. */

export const COGNITO_DOMAIN = process.env.NEXT_PUBLIC_COGNITO_DOMAIN!;
export const COGNITO_CLIENT_ID = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID!;
export const COGNITO_REDIRECT_URI =
  process.env.NEXT_PUBLIC_COGNITO_REDIRECT_URI || 'spark-engine://auth/callback';
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL!;
