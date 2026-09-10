'use client';

import { TermsBody, type LegalDoc } from './legal/TermsBody';
import { PrivacyBody } from './legal/PrivacyBody';
import { RefundBody } from './legal/RefundBody';
import { Button } from './ui/Primitives';

const TITLES: Record<LegalDoc, string> = {
  terms: 'Terms of Service',
  privacy: 'Privacy Policy',
  refund: 'Refund & Cancellation Policy',
};

const DOCS: LegalDoc[] = ['terms', 'privacy', 'refund'];
const LAST_UPDATED = 'September 10, 2026';

interface LegalViewProps {
  doc: LegalDoc;
  onOpenDoc: (doc: LegalDoc) => void;
}

export function LegalView({ doc, onOpenDoc }: LegalViewProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col" role="region" aria-label={TITLES[doc]}>
      <div className="mx-auto min-h-0 w-full max-w-[640px] flex-1 overflow-y-auto px-6 py-6">
        <div className="mb-6 flex flex-wrap gap-1 border-b border-line-subtle pb-4">
          {DOCS.map((d) => (
            <Button key={d} size="sm" variant={d === doc ? 'primary' : 'secondary'} onClick={() => onOpenDoc(d)}>
              {TITLES[d]}
            </Button>
          ))}
        </div>

        <p className="mb-6 font-mono text-xs text-faint">Last updated {LAST_UPDATED}</p>

        <div className="app-legal-prose">
          {doc === 'terms' ? (
            <TermsBody onCrossLink={onOpenDoc} />
          ) : doc === 'privacy' ? (
            <PrivacyBody onCrossLink={onOpenDoc} />
          ) : (
            <RefundBody onCrossLink={onOpenDoc} />
          )}
        </div>
      </div>

      <style
        dangerouslySetInnerHTML={{
          __html: `
        .app-legal-prose h2 {
          font-size: 1rem;
          font-weight: 600;
          color: var(--text);
          margin-top: 1.75rem;
          margin-bottom: 0.6rem;
        }
        .app-legal-prose h3 {
          font-size: 0.9rem;
          font-weight: 600;
          color: var(--text);
          margin-top: 1.25rem;
          margin-bottom: 0.4rem;
        }
        .app-legal-prose p, .app-legal-prose li {
          font-size: 0.8125rem;
          line-height: 1.65;
          color: var(--text-2);
        }
        .app-legal-prose p { margin-bottom: 0.75rem; }
        .app-legal-prose ul, .app-legal-prose ol {
          margin: 0.6rem 0 0.9rem 1.15rem;
          display: flex;
          flex-direction: column;
          gap: 0.4rem;
        }
        .app-legal-prose ul { list-style: disc; }
        .app-legal-prose ol { list-style: decimal; }
        .app-legal-prose strong { color: var(--text); font-weight: 600; }
        .app-legal-prose a, .app-legal-prose button {
          color: var(--accent);
          text-decoration: underline;
          text-underline-offset: 2px;
        }
        .app-legal-prose code {
          font-family: var(--font-mono, monospace);
          font-size: 0.8em;
          background: var(--surface-2);
          border: 1px solid var(--line-subtle);
          border-radius: var(--r-xs);
          padding: 0.1em 0.4em;
          color: var(--text);
        }
      `,
        }}
      />
    </div>
  );
}
