'use client';

import { Badge, Button, cx } from '../ui/Primitives';
import { IconCheck } from '../ui/Icons';
import type { TierContent } from '../../lib/spark/tiers-content';
import type { BillingCycle, Tier } from '../../lib/api';

interface PlanCardProps {
  content: TierContent;
  cycle: BillingCycle;
  currentTier: Tier;
  busy: boolean;
  onUpgrade: (tier: Tier) => void;
}

export function PlanCard({ content, cycle, currentTier, busy, onUpgrade }: PlanCardProps) {
  const { tier, name, tagline, price, limits, features, purchasable } = content;
  const isCurrent = tier === currentTier;
  const highlighted = tier === 'BLAZE'; // matches TIERS.txt's "for power users" middle tier

  const priceLine = price
    ? `₹${price[cycle].amountInr.toLocaleString('en-IN')}`
    : '₹0';
  const priceUnit = price ? (cycle === 'monthly' ? '/mo' : '/yr') : ' forever';

  return (
    <div
      className={cx(
        'flex w-full flex-col rounded-xl border p-4',
        highlighted ? 'border-accent-line bg-accent-soft/40' : 'border-line-subtle bg-surface'
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-base font-semibold text-ink">{name}</h3>
        {isCurrent && <Badge tone="accent">Current plan</Badge>}
        {!isCurrent && highlighted && <Badge tone="accent">Popular</Badge>}
      </div>
      <p className="mt-1 text-xs leading-snug text-muted">{tagline}</p>

      <div className="mt-4 flex items-baseline gap-1">
        <span className="text-2xl font-semibold tnum text-ink">{priceLine}</span>
        <span className="text-xs text-faint">{priceUnit}</span>
      </div>
      {price?.[cycle].note && <p className="mt-0.5 text-2xs text-accent">{price[cycle].note}</p>}

      <ul className="mt-4 space-y-1.5">
        {limits.map((l) => (
          <li key={l} className="text-xs leading-snug text-muted">
            {l}
          </li>
        ))}
      </ul>

      <div className="my-3 border-t border-line-subtle" />

      <ul className="flex-1 space-y-1.5">
        {features.map((f) => (
          <li
            key={f.label}
            className={cx(
              'flex items-start gap-1.5 text-xs leading-snug',
              f.included ? 'text-ink' : 'text-faint line-through'
            )}
          >
            <IconCheck
              size={12}
              className={cx('mt-0.5 shrink-0', f.included ? 'text-accent' : 'text-faint')}
            />
            {f.label}
          </li>
        ))}
      </ul>

      <div className="mt-4">
        {!purchasable ? (
          <Button className="w-full" disabled>
            {isCurrent ? 'Current plan' : 'Always free'}
          </Button>
        ) : isCurrent ? (
          <Button className="w-full" disabled>
            Current plan
          </Button>
        ) : (
          <Button
            variant={highlighted ? 'primary' : 'secondary'}
            className="w-full"
            loading={busy}
            onClick={() => onUpgrade(tier)}
          >
            Upgrade to {name}
          </Button>
        )}
      </div>
    </div>
  );
}
