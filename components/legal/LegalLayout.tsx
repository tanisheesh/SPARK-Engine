import type { ReactNode } from 'react';

function SparkMark({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <line x1="8" y1="1" x2="8" y2="15" stroke="#A9C08E" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="1" y1="8" x2="15" y2="8" stroke="#A9C08E" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="2.8" y1="2.8" x2="13.2" y2="13.2" stroke="#A9C08E" strokeWidth="1" strokeLinecap="round" opacity="0.6" />
      <line x1="13.2" y1="2.8" x2="2.8" y2="13.2" stroke="#A9C08E" strokeWidth="1" strokeLinecap="round" opacity="0.6" />
    </svg>
  );
}

const PAGES = [
  { label: 'Terms of Service', href: '../terms/' },
  { label: 'Privacy Policy', href: '../privacy/' },
  { label: 'Refund & Cancellation', href: '../refund/' },
];

export default function LegalLayout({
  title,
  lastUpdated,
  children,
}: {
  title: string;
  lastUpdated: string;
  children: ReactNode;
}) {
  return (
    <div style={{ background: '#0A0A0A', color: '#F5F5F5', minHeight: '100vh' }}>
      <header className="px-6 py-5" style={{ borderBottom: '1px solid #2A2A2A' }}>
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <a href="../" className="flex items-center gap-2">
            <SparkMark size={16} />
            <span className="font-semibold text-sm tracking-tight" style={{ color: '#F5F5F5' }}>
              SPARK <span style={{ color: '#9A9A9A', fontWeight: 500 }}>Engine</span>
            </span>
          </a>
          <a
            href="../"
            className="text-xs transition-colors"
            style={{ color: '#9A9A9A' }}
          >
            ← Back to home
          </a>
        </div>
      </header>

      <main className="px-6 py-16">
        <div className="max-w-2xl mx-auto">
          <p className="text-[10px] font-mono tracking-widest uppercase mb-3" style={{ color: '#A9C08E' }}>
            Legal
          </p>
          <h1 className="font-semibold tracking-tight mb-2" style={{ fontSize: 'clamp(1.6rem, 4vw, 2.2rem)', color: '#F5F5F5' }}>
            {title}
          </h1>
          <p className="text-xs font-mono mb-12" style={{ color: '#6A6A6A' }}>
            Last updated {lastUpdated}
          </p>

          <div className="legal-prose">{children}</div>

          <nav className="mt-16 pt-8 flex flex-wrap gap-x-6 gap-y-2" style={{ borderTop: '1px solid #2A2A2A' }}>
            {PAGES.map((p) => (
              <a
                key={p.href}
                href={p.href}
                className="text-xs transition-colors"
                style={{ color: '#9A9A9A' }}
              >
                {p.label}
              </a>
            ))}
          </nav>
        </div>
      </main>

      <footer className="px-6 py-8" style={{ borderTop: '1px solid #2A2A2A' }}>
        <p className="max-w-2xl mx-auto text-xs font-mono" style={{ color: '#6A6A6A' }}>
          &copy; {new Date().getFullYear()} SPARK Engine. Made by Team Binary Beast.
        </p>
      </footer>

      <style
        dangerouslySetInnerHTML={{
          __html: `
        .legal-prose h2 {
          font-size: 1.05rem;
          font-weight: 600;
          color: #F5F5F5;
          margin-top: 2.25rem;
          margin-bottom: 0.75rem;
          letter-spacing: -0.01em;
        }
        .legal-prose h3 {
          font-size: 0.9rem;
          font-weight: 600;
          color: #E5E5E5;
          margin-top: 1.5rem;
          margin-bottom: 0.5rem;
        }
        .legal-prose p, .legal-prose li {
          font-size: 0.875rem;
          line-height: 1.7;
          color: #9A9A9A;
        }
        .legal-prose p { margin-bottom: 0.9rem; }
        .legal-prose ul, .legal-prose ol {
          margin: 0.75rem 0 1.1rem 1.25rem;
          display: flex;
          flex-direction: column;
          gap: 0.45rem;
        }
        .legal-prose ul { list-style: disc; }
        .legal-prose ol { list-style: decimal; }
        .legal-prose strong { color: #E5E5E5; font-weight: 600; }
        .legal-prose a { color: #A9C08E; text-decoration: underline; text-underline-offset: 2px; }
        .legal-prose code {
          font-family: var(--font-mono, monospace);
          font-size: 0.8em;
          background: #1A1A1A;
          border: 1px solid #2A2A2A;
          border-radius: 3px;
          padding: 0.1em 0.4em;
          color: #E5E5E5;
        }
      `,
        }}
      />
    </div>
  );
}
