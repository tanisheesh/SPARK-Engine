import type { Metadata } from 'next';
import LegalLayout from '../../components/legal/LegalLayout';
import { PrivacyBody } from '../../components/legal/PrivacyBody';

export const metadata: Metadata = {
  title: 'Privacy Policy — SPARK Engine',
  description: 'What SPARK Engine collects, what it sends to third-party AI providers, and what never leaves your machine.',
};

const LAST_UPDATED = 'September 10, 2026';

export default function PrivacyPage() {
  return (
    <LegalLayout title="Privacy Policy" lastUpdated={LAST_UPDATED}>
      <PrivacyBody />
    </LegalLayout>
  );
}
