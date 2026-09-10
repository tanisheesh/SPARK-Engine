import type { Metadata } from 'next';
import LegalLayout from '../../components/legal/LegalLayout';
import { TermsBody } from '../../components/legal/TermsBody';

export const metadata: Metadata = {
  title: 'Terms of Service — SPARK Engine',
  description: 'The terms that govern use of the SPARK Engine desktop application and website.',
};

const LAST_UPDATED = 'September 10, 2026';

export default function TermsPage() {
  return (
    <LegalLayout title="Terms of Service" lastUpdated={LAST_UPDATED}>
      <TermsBody />
    </LegalLayout>
  );
}
