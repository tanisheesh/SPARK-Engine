'use client';

const LINKS = [
  { label: 'Product', href: '#product' },
  { label: 'How it works', href: '#how' },
  { label: 'Studio', href: '#studio' },
  { label: 'GitHub', href: 'https://github.com', external: true },
  { label: 'Get SPARK', href: '#cta' },
];

const LEGAL_LINKS = [
  { label: 'Terms of Service', href: './terms/' },
  { label: 'Privacy Policy', href: './privacy/' },
  { label: 'Refund & Cancellation', href: './refund/' },
];

const STACK = ['Electron', 'Next.js', 'DuckDB', 'Groq', 'Deepgram'];

export default function Footer() {
  return (
    <footer
      className="px-6 py-12"
      style={{ borderTop: '1px solid #2A2A2A', background: '#0A0A0A' }}
    >
      <div className="max-w-5xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10 mb-10">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                <line x1="8" y1="1" x2="8" y2="15" stroke="#A9C08E" strokeWidth="1.5" strokeLinecap="round" />
                <line x1="1" y1="8" x2="15" y2="8" stroke="#A9C08E" strokeWidth="1.5" strokeLinecap="round" />
                <line x1="2.8" y1="2.8" x2="13.2" y2="13.2" stroke="#A9C08E" strokeWidth="1" strokeLinecap="round" opacity="0.6" />
                <line x1="13.2" y1="2.8" x2="2.8" y2="13.2" stroke="#A9C08E" strokeWidth="1" strokeLinecap="round" opacity="0.6" />
              </svg>
              <span className="text-xs font-semibold tracking-tight" style={{ color: '#F5F5F5' }}>
                SPARK <span style={{ color: '#6A6A6A', fontWeight: 500 }}>Engine</span>
              </span>
            </div>
            <p className="text-xs leading-relaxed" style={{ color: '#6A6A6A' }}>
              Talk to your data in plain English.
              <br />
              Runs locally. No cloud required.
            </p>
          </div>

          {/* Links */}
          <div>
            <p className="text-[10px] font-mono tracking-widest uppercase mb-4" style={{ color: '#6A6A6A' }}>
              Navigation
            </p>
            <div className="flex flex-col gap-2.5">
              {LINKS.map((l) =>
                l.external ? (
                  <a
                    key={l.label}
                    href={l.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs transition-colors"
                    style={{ color: '#9A9A9A' }}
                    onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = '#F5F5F5')}
                    onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = '#9A9A9A')}
                  >
                    {l.label}
                  </a>
                ) : (
                  <a
                    key={l.label}
                    href={l.href}
                    className="text-xs transition-colors"
                    style={{ color: '#9A9A9A' }}
                    onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = '#F5F5F5')}
                    onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = '#9A9A9A')}
                  >
                    {l.label}
                  </a>
                )
              )}
            </div>
          </div>

          {/* Stack */}
          <div>
            <p className="text-[10px] font-mono tracking-widest uppercase mb-4" style={{ color: '#6A6A6A' }}>
              Built with
            </p>
            <div className="flex flex-wrap gap-2">
              {STACK.map((t) => (
                <span
                  key={t}
                  className="text-xs px-2.5 py-1 rounded font-mono"
                  style={{
                    border: '1px solid #2A2A2A',
                    color: '#6A6A6A',
                    background: '#141414',
                  }}
                >
                  {t}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div
          className="flex flex-col gap-4 pt-6"
          style={{ borderTop: '1px solid #2A2A2A' }}
        >
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs font-mono" style={{ color: '#6A6A6A' }}>
              &copy; {new Date().getFullYear()} SPARK Engine. All rights reserved.
            </p>
            <p className="text-xs font-mono" style={{ color: '#6A6A6A' }}>
              Made by Team Stack Don't Overflow
            </p>
          </div>
          <div className="flex flex-wrap justify-center sm:justify-start gap-x-5 gap-y-1.5">
            {LEGAL_LINKS.map((l) => (
              <a
                key={l.label}
                href={l.href}
                className="text-xs transition-colors"
                style={{ color: '#6A6A6A' }}
                onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = '#9A9A9A')}
                onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = '#6A6A6A')}
              >
                {l.label}
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
