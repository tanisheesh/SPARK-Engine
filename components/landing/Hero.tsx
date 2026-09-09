'use client';

import { motion } from 'framer-motion';
import SparkCompass from './SparkCompass';

export default function Hero() {
  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center pt-28 pb-20 px-6 overflow-hidden">
      {/* Background grid */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(to right, rgba(26,18,33,0.55) 1px, transparent 1px), linear-gradient(to bottom, rgba(26,18,33,0.55) 1px, transparent 1px)',
          backgroundSize: '4rem 4rem',
        }}
      />

      {/* Ambient glows — matching desktop app orange + purple */}
      <motion.div
        className="absolute top-1/4 left-1/4 w-[520px] h-[520px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(217,119,6,0.14) 0%, transparent 70%)', filter: 'blur(40px)' }}
        animate={{ scale: [1, 1.12, 1] }}
        transition={{ duration: 9, repeat: Infinity }}
      />
      <motion.div
        className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.1) 0%, transparent 70%)', filter: 'blur(40px)' }}
        animate={{ scale: [1.1, 1, 1.1] }}
        transition={{ duration: 11, repeat: Infinity }}
      />

      {/* Main layout — two-column on desktop */}
      <div className="relative z-10 w-full max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">

        {/* Left: copy */}
        <div className="flex flex-col items-start">
          {/* Eyebrow */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-8 text-xs font-mono font-semibold tracking-widest uppercase"
            style={{
              background: 'rgba(217,119,6,0.1)',
              border: '1px solid rgba(217,119,6,0.25)',
              color: '#D97706',
            }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
            Voice-First Data Analytics
          </motion.div>

          {/* Main headline */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.1 }}
            className="font-black leading-[1.05] tracking-tight mb-6"
            style={{ fontSize: 'clamp(2.4rem, 5vw, 4.2rem)' }}
          >
            <span className="text-white">Four directions.</span>
            <br />
            <span
              className="text-transparent bg-clip-text"
              style={{ backgroundImage: 'linear-gradient(135deg, #F97316 0%, #D97706 50%, #B45309 100%)' }}
            >
              Infinite possibilities.
            </span>
            <br />
            <span className="text-white">One spark.</span>
          </motion.h1>

          {/* Narrative copy */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.2 }}
            className="mb-5 space-y-3"
            style={{ maxWidth: '480px' }}
          >
            <p className="text-gray-400 text-base leading-relaxed">
              The four cardinal points represent the four core strengths at the heart of SPARK. They give the product its foundation and direction.
            </p>
            <p className="text-gray-500 text-sm leading-relaxed">
              The smaller spokes extend beyond those established directions — representing our commitment to unconventional thinking. Exploring unexpected paths, perspectives, and ideas to uncover what others might miss.
            </p>
            <p className="text-gray-400 text-sm leading-relaxed">
              At the center, all these directions converge into a spark: the moment raw data becomes meaningful insight.
            </p>
          </motion.div>

          {/* Tagline */}
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="text-base font-semibold mb-8"
            style={{ color: '#8B5CF6' }}
          >
            Your data, but a brighter picture.
          </motion.p>

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.38 }}
            className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-8"
          >
            <a
              href="/app"
              className="px-7 py-3.5 rounded-xl font-bold text-white text-sm transition-all duration-200 hover:scale-105 active:scale-95 whitespace-nowrap"
              style={{
                background: 'linear-gradient(135deg, #D97706, #7C3AED)',
                boxShadow: '0 0 28px rgba(217,119,6,0.3)',
              }}
            >
              Try SPARK
            </a>
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="px-7 py-3.5 rounded-xl font-semibold text-sm text-gray-400 hover:text-white transition-all duration-200 flex items-center gap-2 whitespace-nowrap"
              style={{
                border: '1px solid rgba(255,255,255,0.08)',
                background: 'rgba(255,255,255,0.03)',
              }}
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
              </svg>
              View on GitHub
            </a>
          </motion.div>

          {/* Data source pill row */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.5 }}
            className="flex flex-wrap items-center gap-2 text-xs font-mono"
          >
            {['CSV', 'MySQL', 'PostgreSQL', 'SQLite', 'DuckDB'].map((src) => (
              <span
                key={src}
                className="px-2.5 py-1 rounded-md"
                style={{
                  background: 'rgba(217,119,6,0.08)',
                  border: '1px solid rgba(217,119,6,0.18)',
                  color: '#D97706',
                }}
              >
                {src}
              </span>
            ))}
          </motion.div>
        </div>

        {/* Right: Compass visual */}
        <motion.div
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.25 }}
          className="flex items-center justify-center"
        >
          <div className="relative">
            {/* "SPARK is built on strong foundations..." tag */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.9 }}
              className="absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap text-xs font-mono text-center"
              style={{ color: '#6b7280' }}
            >
              Built on strong foundations. Designed to think beyond them.
            </motion.div>
            <SparkCompass size={400} />
          </div>
        </motion.div>
      </div>

      {/* Bottom scroll indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1"
      >
        <span className="text-xs font-mono text-gray-600">scroll</span>
        <motion.div
          className="w-px h-6"
          style={{ background: 'linear-gradient(to bottom, rgba(217,119,6,0.5), transparent)' }}
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
      </motion.div>
    </section>
  );
}
