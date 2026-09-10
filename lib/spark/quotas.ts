/* Client-side mirror of lambda/shared/tiers.js's QUOTAS — mirrors
   TIERS.txt's "Limits" sections. Used for checks that must happen before
   an API round-trip is even possible (the CSV size cap, checked in
   FileUpload.tsx against the native file the user just picked, before
   any upload starts). Query-count limits are NOT enforced from here —
   those go through lib/api.ts's consumeQuery(), which hits the server
   (lambda/usage-consume) so the count can't be reset by clearing local
   state. null means unlimited (THUNDER). */

import type { Tier } from '../api';
import type { DataSourceType } from '../data-sources';

export interface Quota {
  csvSizeGb: number | null;
  /** TIERS.txt's "db sources" line — progressively unlocked per tier. */
  allowedSources: DataSourceType[];
  /** TIERS.txt's "DB connections saved" line. */
  savedConnections: number | null;
  /** TIERS.txt's "Voice (Deepgram)" line — FREE is text-only. */
  voice: boolean;
  /** TIERS.txt's "Offline support" line — local inference via node-llama-cpp. */
  offlineSupport: boolean;
  /** TIERS.txt's "API keys" line — everyone is BYOK except THUNDER, which
      gets SPARK-managed Groq + Deepgram keys since those seats pay enough
      to cover it. */
  managedKeys: boolean;
}

const QUOTAS: Record<Tier, Quota> = {
  FREE: {
    csvSizeGb: 25,
    allowedSources: ['csv', 'mysql'],
    savedConnections: 1,
    voice: false,
    offlineSupport: false,
    managedKeys: false,
  },
  IGNITE: {
    csvSizeGb: 100,
    allowedSources: ['csv', 'mysql', 'xlsx', 'json'],
    savedConnections: 3,
    voice: true,
    offlineSupport: false,
    managedKeys: false,
  },
  BLAZE: {
    csvSizeGb: 200,
    allowedSources: ['csv', 'mysql', 'xlsx', 'json', 'sqlite'],
    savedConnections: 6,
    voice: true,
    offlineSupport: true,
    managedKeys: false,
  },
  STORM: {
    csvSizeGb: 400,
    allowedSources: ['csv', 'mysql', 'xlsx', 'json', 'sqlite', 'postgresql'],
    savedConnections: 12,
    voice: true,
    offlineSupport: true,
    managedKeys: false,
  },
  THUNDER: {
    csvSizeGb: null,
    allowedSources: ['csv', 'mysql', 'xlsx', 'json', 'sqlite', 'postgresql', 'supabase'],
    savedConnections: null,
    voice: true,
    offlineSupport: true,
    managedKeys: true,
  },
};

export function quotaFor(tier: Tier | null): Quota {
  return QUOTAS[tier ?? 'FREE'] ?? QUOTAS.FREE;
}
