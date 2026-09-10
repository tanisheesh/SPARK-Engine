import { CrossLink, type LegalDoc } from './TermsBody';

export function RefundBody({ onCrossLink }: { onCrossLink?: (doc: LegalDoc) => void }) {
  return (
    <>
      <p>
        This policy explains how cancellations and refunds work for SPARK Engine subscriptions
        (IGNITE, BLAZE, STORM, and THUNDER). It should be read together with our{' '}
        <CrossLink doc="terms" onCrossLink={onCrossLink}>Terms of Service</CrossLink>.
      </p>

      <h2>1. Cancelling your subscription</h2>
      <p>
        You can cancel your subscription at any time from the Pricing screen inside the app, or by
        emailing <a href="mailto:hey@tanisheesh.in">hey@tanisheesh.in</a>. Cancellation stops the
        next auto-renewal charge. Your current paid period continues to run until its scheduled end
        date, and your plan remains active with full access until then — after which your account
        reverts to FREE.
      </p>

      <h2>2. Refunds</h2>
      <p>
        Subscription fees are generally <strong>non-refundable</strong> for the portion of a billing
        period you have already used, whether you cancel partway through a month or year, or
        downgrade to a lower tier. This is standard for subscription software where usage (queries,
        managed API access, storage) is available to you for the whole period regardless of how
        much of it you actually use.
      </p>
      <p>We will issue a full or partial refund in these specific cases:</p>
      <ul>
        <li>
          You were charged more than once for the same billing period (a duplicate or erroneous
          charge).
        </li>
        <li>
          You were charged after a cancellation that was submitted before the renewal date, due to
          an error on our side.
        </li>
        <li>
          A serious, sustained service outage prevented you from using a paid feature you were
          billed for, and you reported it within 7 days of the charge.
        </li>
      </ul>
      <p>
        To request a refund under one of these cases, email{' '}
        <a href="mailto:hey@tanisheesh.in">hey@tanisheesh.in</a> within <strong>7 days</strong> of
        the charge in question, including your account email and the payment date. Approved
        refunds are issued back to the original payment method via Razorpay and may take several
        business days to appear, depending on your bank or card issuer.
      </p>

      <h2>3. Failed or disputed payments</h2>
      <p>
        If a renewal payment fails, we will attempt to notify you and give you a short grace period
        to update your payment method before your plan reverts to FREE. If you dispute or charge
        back a payment through your bank or card issuer rather than contacting us first, we reserve
        the right to suspend the associated account while the dispute is resolved.
      </p>

      <h2>4. Plan changes</h2>
      <p>
        Upgrading takes effect immediately; you&apos;ll be charged a prorated amount for the
        remainder of the current billing period where applicable. Downgrading takes effect at the
        end of your current billing period — you keep your existing tier&apos;s features until then,
        and are not charged the higher tier&apos;s price again.
      </p>

      <h2>5. Contact</h2>
      <p>
        For any billing question not covered above, email{' '}
        <a href="mailto:hey@tanisheesh.in">hey@tanisheesh.in</a>.
      </p>
    </>
  );
}
