'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

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

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <motion.header
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="fixed top-0 left-0 right-0 z-50"
      style={{
        background: scrolled ? 'rgba(10,10,10,0.97)' : 'rgba(10,10,10,0.6)',
        borderBottom: `1px solid ${scrolled ? '#2A2A2A' : 'transparent'}`,
        backdropFilter: 'blur(12px)',
        transition: 'background 0.3s, border-color 0.3s',
      }}
    >
      <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
        <a href="/" className="flex items-center gap-2">
          <SparkMark size={16} />
          <span className="font-semibold text-sm tracking-tight" style={{ color: '#F5F5F5' }}>SPARK</span>
        </a>

        <nav className="hidden md:flex items-center gap-6">
          {[['Product', '#product'], ['Docs', '#docs'], ['GitHub', 'https://github.com']].map(([label, href]) => (
            <a key={label} href={href}
              target={href.startsWith('http') ? '_blank' : undefined}
              rel={href.startsWith('http') ? 'noopener noreferrer' : undefined}
              className="text-sm transition-colors duration-150"
              style={{ color: '#9A9A9A' }}
              onMouseEnter={e => ((e.currentTarget as HTMLAnchorElement).style.color = '#F5F5F5')}
              onMouseLeave={e => ((e.currentTarget as HTMLAnchorElement).style.color = '#9A9A9A')}
            >{label}</a>
          ))}
        </nav>

        <a href="#cta" className="hidden md:inline-flex text-sm px-4 py-1.5 rounded-md font-medium transition-colors duration-150"
          style={{ background: '#A9C08E', color: '#0A0A0A' }}
          onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = '#96AD7A')}
          onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = '#A9C08E')}
        >
          Get started
        </a>

        <button className="md:hidden" style={{ color: '#9A9A9A' }} onClick={() => setMobileOpen(!mobileOpen)} aria-label="Menu">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            {mobileOpen
              ? <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              : <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5M3.75 17.25h16.5" />}
          </svg>
        </button>
      </div>

      {mobileOpen && (
        <div className="md:hidden px-6 pb-5 flex flex-col gap-3" style={{ borderTop: '1px solid #2A2A2A' }}>
          {[['Product', '#product'], ['Docs', '#docs'], ['GitHub', 'https://github.com']].map(([label, href]) => (
            <a key={label} href={href} className="text-sm py-1" style={{ color: '#9A9A9A' }} onClick={() => setMobileOpen(false)}>{label}</a>
          ))}
          <a href="#cta" className="text-sm px-4 py-2 rounded-md font-medium text-center mt-1"
            style={{ background: '#A9C08E', color: '#0A0A0A' }} onClick={() => setMobileOpen(false)}>
            Get started
          </a>
        </div>
      )}
    </motion.header>
  );
}
