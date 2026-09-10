/* Thin fetch wrapper for the API Gateway billing backend (lambda/). Every
   call attaches the Cognito ID token; the Lambdas derive the user id from
   it, never from anything sent here. */

import { API_BASE_URL } from './aws-config';
import { getSession } from './auth';

async function authedFetch(path: string, init?: RequestInit) {
  const session = await getSession();
  if (!session) throw new Error('Not signed in');

  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      authorization: `Bearer ${session.idToken}`,
      ...(init?.body ? { 'content-type': 'application/json' } : {}),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  return res.status === 204 ? null : res.json();
}

/* ---------- Billing ---------- */

export type Tier = 'FREE' | 'IGNITE' | 'BLAZE' | 'STORM' | 'THUNDER';
export type BillingCycle = 'monthly' | 'yearly';

export interface BillingStatus {
  tier: Tier;
  status: 'active' | 'expired';
  cycle: BillingCycle | null;
  currentPeriodEnd: string | null;
}

export interface CreateOrderResult {
  orderId: string;
  amount: number;
  currency: string;
  keyId: string;
}

export function fetchBillingStatus(): Promise<BillingStatus> {
  return authedFetch('/billing/status');
}

export function createOrder(tier: Tier, cycle: BillingCycle): Promise<CreateOrderResult> {
  return authedFetch('/billing/create-order', {
    method: 'POST',
    body: JSON.stringify({ tier, cycle }),
  });
}

export function verifyPayment(
  orderId: string,
  paymentId: string,
  signature: string
): Promise<{ tier: Tier; status: string }> {
  return authedFetch('/billing/verify-payment', {
    method: 'POST',
    body: JSON.stringify({ orderId, paymentId, signature }),
  });
}

/* ---------- Usage (query limits from TIERS.txt) ---------- */

export interface UsageResult {
  allowed: boolean;
  reason?: 'monthly' | 'daily';
  tier: Tier;
  queriesMonth: number;
  queriesDay: number;
  limitMonth: number | null; // null = unlimited (THUNDER)
  limitDay: number | null;
}

/** Called right before a question is sent to Groq — this is the actual
    enforcement of TIERS.txt's "queries per month / per day" limits.
    Increments the counters server-side and returns whether this query is
    allowed under the caller's current tier. */
export function consumeQuery(): Promise<UsageResult> {
  return authedFetch('/usage/consume', { method: 'POST', body: '{}' });
}
