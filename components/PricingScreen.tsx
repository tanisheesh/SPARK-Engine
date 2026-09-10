'use client';

import { useCallback, useEffect, useState } from 'react';
import { Spinner, cx } from './ui/Primitives';
import { PlanCard } from './billing/PlanCard';
import { TIER_ORDER, TIERS_CONTENT } from '../lib/spark/tiers-content';
import {
  createOrder,
  fetchBillingStatus,
  verifyPayment,
  type BillingCycle,
  type BillingStatus,
  type Tier,
} from '../lib/api';
import type { SparkUser } from '../lib/auth';

const RAZORPAY_SCRIPT_SRC = 'https://checkout.razorpay.com/v1/checkout.js';

function loadRazorpayScript(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${RAZORPAY_SCRIPT_SRC}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('Failed to load Razorpay')));
      return;
    }
    const script = document.createElement('script');
    script.src = RAZORPAY_SCRIPT_SRC;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Razorpay'));
    document.body.appendChild(script);
  });
}

interface PricingScreenProps {
  open: boolean;
  user: SparkUser | null;
  toast: (text: string, tone?: 'success' | 'error') => void;
}

export function PricingScreen({ open, user, toast }: PricingScreenProps) {
  const [cycle, setCycle] = useState<BillingCycle>('monthly');
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [payingTier, setPayingTier] = useState<Tier | null>(null);

  const refreshStatus = useCallback(async () => {
    setLoadingStatus(true);
    try {
      setStatus(await fetchBillingStatus());
    } catch (err) {
      toast((err as Error).message || 'Could not load billing status.', 'error');
    } finally {
      setLoadingStatus(false);
    }
  }, [toast]);

  useEffect(() => {
    if (open) refreshStatus();
  }, [open, refreshStatus]);

  const handleUpgrade = useCallback(
    async (tier: Tier) => {
      setPayingTier(tier);
      try {
        await loadRazorpayScript();
        const order = await createOrder(tier, cycle);

        const razorpay = new window.Razorpay!({
          key: order.keyId,
          amount: order.amount,
          currency: order.currency,
          name: 'SPARK Engine',
          description: `${TIERS_CONTENT[tier].name} — ${cycle}`,
          order_id: order.orderId,
          prefill: { email: user?.email, name: user?.name },
          theme: { color: '#8FA17C' },
          handler: async (response) => {
            try {
              await verifyPayment(
                response.razorpay_order_id,
                response.razorpay_payment_id,
                response.razorpay_signature
              );
              toast(`You're on ${TIERS_CONTENT[tier].name} now.`, 'success');
              refreshStatus();
            } catch (err) {
              toast((err as Error).message || 'Payment verification failed.', 'error');
            } finally {
              setPayingTier(null);
            }
          },
          modal: { ondismiss: () => setPayingTier(null) },
        });
        razorpay.open();
      } catch (err) {
        toast((err as Error).message || 'Could not start checkout.', 'error');
        setPayingTier(null);
      }
    },
    [cycle, refreshStatus, toast, user]
  );

  if (!open) return null;

  return (
    <div className="flex min-h-0 flex-1 flex-col" role="region" aria-label="Pricing">
      <div className="flex items-center gap-3 border-b border-line-subtle px-6 py-3">
        <span className="flex-1" />
        <div className="flex items-center gap-1 rounded-md border border-line bg-surface2 p-0.5">
          {(['monthly', 'yearly'] as const).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCycle(c)}
              className={cx(
                'rounded-sm px-2.5 py-1 text-xs font-medium capitalize transition-colors duration-1',
                cycle === c ? 'bg-accent text-accent-ink' : 'text-muted hover:text-ink'
              )}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
        {loadingStatus && !status ? (
          <div className="flex h-full items-center justify-center">
            <Spinner size={16} className="text-muted" />
          </div>
        ) : (
          <div className="mx-auto grid w-full max-w-[1200px] grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {TIER_ORDER.map((tier) => (
              <PlanCard
                key={tier}
                content={TIERS_CONTENT[tier]}
                cycle={cycle}
                currentTier={status?.tier ?? 'FREE'}
                busy={payingTier === tier}
                onUpgrade={handleUpgrade}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
