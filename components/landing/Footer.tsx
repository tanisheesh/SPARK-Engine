'use client';

import Image from 'next/image';

const LINKS = [
  { label: 'Product', href: '#product' },
  { label: 'Features', href: '#features' },
  { label: 'Privacy', href: '#privacy' },
  { label: 'GitHub', href: 'https://github.com', external: true },
  { label: 'Download', href: '#download' },
];

const STACK = ['Electron', 'Next.js', 'DuckDB', 'Groq', 'Deepgram', 'Inworld AI'];

export default function Footer() {
  return (
    <footer
      className="border-t px-6 py-12"
      style={{ borderColor: 'rgba(217,119,6,0.1)' }}
    >
      <div className="max-w-5xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10 mb-10">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-7 h-7 rounded-lg overflow-hidden border border-orange-600/30 flex-shrink-0">
                <Image src="/icon.png" alt="SPARK" width={28} height={28} className="object-cover" />
              </div>
              <span className="font-black text-white">SPARK</span>
            </div>
            <p className="text-gray-500 text-xs leading-relaxed max-w-xs">
              Speech Powered Analytics Relational Kit.
              <br />
              A voice-first desktop data analytics application.
            </p>
          </div>

          {/* Links */}
          <div>
            <p className="text-xs font-mono text-gray-600 uppercase tracking-widest mb-4">
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
                    className="text-sm text-gray-400 hover:text-orange-400 transition-colors"
                  >
                    {l.label}
                  </a>
                ) : (
                  <a
                    key={l.label}
                    href={l.href}
                    className="text-sm text-gray-400 hover:text-orange-400 transition-colors"
                  >
                    {l.label}
                  </a>
                )
              )}
            </div>
          </div>

          {/* Stack */}
          <div>
            <p className="text-xs font-mono text-gray-600 uppercase tracking-widest mb-4">
              Built with
            </p>
            <div className="flex flex-wrap gap-2">
              {STACK.map((t) => (
                <span
                  key={t}
                  className="text-xs px-2.5 py-1 rounded-md font-mono"
                  style={{
                    background: 'rgba(217,119,6,0.07)',
                    border: '1px solid rgba(217,119,6,0.12)',
                    color: '#9ca3af',
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
          className="flex flex-col sm:flex-row items-center justify-between pt-6 gap-4"
          style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}
        >
          <p className="text-xs text-gray-600 font-mono">
            © {new Date().getFullYear()} SPARK Engine. All rights reserved.
          </p>
          <p className="text-xs text-gray-700 font-mono">
            Made with ♥ by Team Binary Beast
          </p>
        </div>
      </div>
    </footer>
  );
}
