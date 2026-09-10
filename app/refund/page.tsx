import type { Metadata } from 'next';
import LegalLayout from '../../components/legal/LegalLayout';
import { RefundBody } from '../../components/legal/RefundBody';

export const metadata: Metadata = {
  title: 'Refund & Cancellation Policy — SPARK Engine',
  description: 'How subscription cancellations and refunds work for SPARK Engine.',
};

const LAST_UPDATED = 'September 10, 2026';

export default function RefundPage() {
  return (
    <LegalLayout title="Refund & Cancellation Policy" lastUpdated={LAST_UPDATED}>
      <RefundBody />
    </LegalLayout>
  );
}
