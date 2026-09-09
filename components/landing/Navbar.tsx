'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import Image from 'next/image';

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const links = ['Product', 'How it Works', 'Features', 'Privacy'];

  return (
    <motion.nav
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="fixed top-0 left-0 right-0 z-50 flex justify-center px-4 pt-4"
    >
      <div
        className="w-full max-w-5xl flex items-center justify-between px-5 py-3 rounded-2xl transition-all duration-300"
        style={{
          background: scrolled
            ? 'rgba(15,10,26,0.95)'
            : 'rgba(15,10,26,0.7)',
          border: '1px solid rgba(217,119,6,0.15)',
          backdropFilter: 'blur(20px)',
          boxShadow: scrolled ? '0 8px 32px rgba(0,0,0,0.5)' : 'none',
        }}
      >
        {/* Logo */}
        <Link href="/landing" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 rounded-lg overflow-hidden border border-orange-600/30 flex-shrink-0">
            <Image src="/icon.png" alt="SPARK" width={32} height={32} className="object-cover" />
          </div>
          <span className="font-black text-lg tracking-tight text-white">SPARK</span>
        </Link>

        {/* Desktop nav links */}
        <div className="hidden md:flex items-center gap-6">
          {links.map((l) => (
            <a
              key={l}
              href={`#${l.toLowerCase().replace(/\s+/g, '-')}`}
              className="text-sm text-gray-400 hover:text-orange-400 transition-colors duration-200"
            >
              {l}
            </a>
          ))}
        </div>

        {/* Right CTAs */}
        <div className="hidden md:flex items-center gap-3">
          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-gray-400 hover:text-white transition-colors flex items-center gap-1.5"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
            </svg>
            GitHub
          </a>
          <a
            href="/app"
            className="text-sm px-4 py-2 rounded-xl font-semibold text-white transition-all duration-200"
            style={{
              background: 'linear-gradient(135deg, #D97706, #7C3AED)',
              boxShadow: '0 0 20px rgba(217,119,6,0.25)',
            }}
          >
            Try SPARK
          </a>
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden text-gray-400 hover:text-orange-400 transition-colors"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle menu"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {mobileOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute top-full mt-2 left-4 right-4 rounded-2xl p-4 flex flex-col gap-3"
          style={{
            background: 'rgba(15,10,26,0.98)',
            border: '1px solid rgba(217,119,6,0.2)',
            backdropFilter: 'blur(20px)',
          }}
        >
          {links.map((l) => (
            <a
              key={l}
              href={`#${l.toLowerCase().replace(/\s+/g, '-')}`}
              className="text-sm text-gray-400 hover:text-orange-400 py-2 transition-colors"
              onClick={() => setMobileOpen(false)}
            >
              {l}
            </a>
          ))}
          <a
            href="/app"
            className="text-sm px-4 py-2.5 rounded-xl font-semibold text-white text-center mt-1"
            style={{ background: 'linear-gradient(135deg, #D97706, #7C3AED)' }}
            onClick={() => setMobileOpen(false)}
          >
            Try SPARK
          </a>
        </motion.div>
      )}
    </motion.nav>
  );
}
