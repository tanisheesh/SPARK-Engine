'use client';

import { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import SparkCompass from './SparkCompass';
import AnimatedWords from './AnimatedWords';
import MagneticButton from './MagneticButton';

const FADE_UP = (delay: number) => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.55, delay, ease: [0.16, 1, 0.3, 1] as const },
});

export default function Hero() {
  const sectionRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ['start start', 'end start'] });

  // Dot grid moves at 40% of scroll speed — classic parallax depth
  const gridY = useTransform(scrollYProgress, [0, 1], ['0%', '-30%']);
  // Content moves slightly faster than grid = they separate as you scroll
  const contentY = useTransform(scrollYProgress, [0, 1], ['0%', '15%']);

  return (
    <section
      ref={sectionRef}
      className="relative min-h-screen flex flex-col items-center justify-center px-6 pt-20 pb-16 overflow-hidden"
      style={{ background: '#0A0A0A' }}
    >
      {/* Parallax dot grid — moves slower than content */}
      <motion.div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(circle, #2A2A2A 1px, transparent 1px)',
          backgroundSize: '32px 32px',
          opacity: 0.4,
          y: gridY,
        }}
      />

      {/* Radial vignette */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 70% 70% at 50% 50%, transparent 30%, #0A0A0A 100%)',
        }}
      />

      {/* Content — moves slightly with scroll for depth */}
      <motion.div
        style={{ y: contentY }}
        className="relative z-10 flex flex-col items-center text-center max-w-3xl mx-auto"
      >
        {/* Compass */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] as const }}
          className="mb-10"
        >
          <SparkCompass size={260} animate />
        </motion.div>

        {/* Tagline */}
        <motion.h1
          {...FADE_UP(1.8)}
          className="font-semibold leading-tight tracking-tight mb-4"
          style={{ fontSize: 'clamp(2.2rem, 5vw, 3.6rem)', color: '#F5F5F5', letterSpacing: '-0.02em' }}
        >
          <AnimatedWords text="Your data, but a brighter picture." />
        </motion.h1>

        {/* Subtext */}
        <motion.p
          {...FADE_UP(2.0)}
          className="text-base leading-relaxed mb-10 max-w-lg"
          style={{ color: '#9A9A9A' }}
        >
          <AnimatedWords text="Talk to your data in plain English. SPARK writes the SQL, runs it locally, and explains what it found — no dashboards to build, no engineers to wait for." />
        </motion.p>

        {/* CTAs — wrapped in MagneticButton */}
        <motion.div {...FADE_UP(2.2)} className="flex flex-col sm:flex-row items-center gap-3">
          <MagneticButton>
            <a
              href="#cta"
              className="px-6 py-2.5 rounded-md text-sm font-medium transition-colors duration-150 block"
              style={{ background: '#A9C08E', color: '#0A0A0A' }}
              onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = '#96AD7A')}
              onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = '#A9C08E')}
            >
              Get SPARK
            </a>
          </MagneticButton>

          <MagneticButton>
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="px-6 py-2.5 rounded-md text-sm font-medium flex items-center gap-2 transition-colors duration-150"
              style={{ border: '1px solid #2A2A2A', color: '#9A9A9A', background: 'transparent' }}
              onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = '#3A3A3A'; el.style.color = '#F5F5F5'; }}
              onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = '#2A2A2A'; el.style.color = '#9A9A9A'; }}
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
              </svg>
              View on GitHub
            </a>
          </MagneticButton>
        </motion.div>

        {/* Scroll hint */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2.8 }}
          className="mt-16 flex flex-col items-center gap-2"
        >
          <motion.div
            className="w-px h-8"
            style={{ background: 'linear-gradient(to bottom, #2A2A2A, transparent)' }}
            animate={{ scaleY: [1, 0.5, 1], opacity: [0.4, 0.8, 0.4] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
        </motion.div>
      </motion.div>
    </section>
  );
}
