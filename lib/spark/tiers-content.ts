/* Display copy for the Pricing screen. Mirrors TIERS.txt at the repo root
   — that file is the design source of truth; this is its UI-ready form.
   Prices must stay in sync with lambda/shared/tiers.js, which is what
   actually gets charged (this file is copy only, never trusted for
   billing amounts). Only features that actually exist in the app are
   listed here — no enterprise-checklist items (SSO, RBAC, audit log,
   HIPAA, SOC 2, ...) that nothing in this codebase implements. */

import type { Tier, BillingCycle } from '../api';

export interface TierContent {
  tier: Tier;
  name: string;
  tagline: string;
  price: Record<BillingCycle, { amountInr: number; note?: string }> | null; // null = FREE
  limits: string[];
  features: { label: string; included: boolean }[];
  purchasable: boolean;
}

export const TIER_ORDER: Tier[] = ['FREE', 'IGNITE', 'BLAZE', 'STORM', 'THUNDER'];

export const TIERS_CONTENT: Record<Tier, TierContent> = {
  FREE: {
    tier: 'FREE',
    name: 'Free',
    tagline: 'BYOK — Bring Your Own Keys',
    price: null,
    limits: [
      '300 queries/mo · 10/day',
      '25 GB CSV files',
      '1 lakh MySQL rows',
      '1 saved DB connection',
      'CSV + MySQL sources only',
      'No query history',
    ],
    features: [
      { label: 'Voice (Deepgram)', included: false },
      { label: 'Managed API keys', included: false },
      { label: 'Offline support (node-llama-cpp)', included: false },
    ],
    purchasable: false,
  },
  IGNITE: {
    tier: 'IGNITE',
    name: 'Ignite',
    tagline: 'For individuals who mean business',
    price: {
      monthly: { amountInr: 499 },
      yearly: { amountInr: 5000, note: 'save ₹1,598' },
    },
    limits: [
      '600 queries/mo · 20/day',
      '100 GB CSV files',
      '3 lakh MySQL rows',
      '3 saved DB connections',
      '+ Excel & JSON sources',
      '7-day query history',
      '2-person collaboration chat',
    ],
    features: [
      { label: 'Voice (Deepgram)', included: true },
      { label: 'Managed API keys', included: false },
      { label: 'Offline support (node-llama-cpp)', included: false },
    ],
    purchasable: true,
  },
  BLAZE: {
    tier: 'BLAZE',
    name: 'Blaze',
    tagline: 'For power users and growing teams',
    price: {
      monthly: { amountInr: 999 },
      yearly: { amountInr: 10000, note: 'save ₹1,988' },
    },
    limits: [
      '1,200 queries/mo · 40/day',
      '200 GB CSV files',
      '6 lakh MySQL rows',
      '6 saved DB connections',
      '+ SQLite sources',
      '14-day query history',
      '4-person collaboration chat',
    ],
    features: [
      { label: 'Voice (Deepgram)', included: true },
      { label: 'Managed API keys', included: false },
      { label: 'Offline support (node-llama-cpp)', included: true },
    ],
    purchasable: true,
  },
  STORM: {
    tier: 'STORM',
    name: 'Storm',
    tagline: 'For teams that move fast together',
    price: {
      monthly: { amountInr: 1999 },
      yearly: { amountInr: 20000, note: 'save ₹3,988' },
    },
    limits: [
      '2,400 queries/mo · 80/day',
      '400 GB CSV files',
      '12 lakh MySQL rows',
      '12 saved DB connections',
      '+ PostgreSQL sources',
      '28-day query history',
      '8-person collaboration chat',
    ],
    features: [
      { label: 'Voice (Deepgram)', included: true },
      { label: 'Managed API keys', included: false },
      { label: 'Offline support (node-llama-cpp)', included: true },
    ],
    purchasable: true,
  },
  THUNDER: {
    tier: 'THUNDER',
    name: 'Thunder',
    tagline: 'Enterprise-grade. Zero compromises.',
    price: {
      monthly: { amountInr: 3999, note: 'per seat, starting price' },
      yearly: { amountInr: 47988, note: 'per seat, starting price' },
    },
    limits: [
      'Unlimited queries',
      'Unlimited CSV size',
      'Unlimited MySQL rows',
      'Unlimited saved DB connections',
      'All sources, incl. Supabase',
      'Unlimited query history',
      'Unlimited collaboration chat',
    ],
    features: [
      { label: 'Voice (Deepgram)', included: true },
      { label: 'Managed API keys', included: true },
      { label: 'Offline support (node-llama-cpp)', included: true },
    ],
    purchasable: true,
  },
};
