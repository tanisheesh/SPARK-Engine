'use client';

import { motion } from 'framer-motion';
import SparkCompass from './SparkCompass';

const LINES = [
  'Data has always had answers.',
  'The barrier was never intelligence — it was access.',
  'SQL is a language most people never learned.',
  'Dashboards are built by people who aren\'t asking the questions.',
  'Waiting for an analyst is waiting for a translation.',
  '',
  'SPARK removes the translation layer.',
  '',
  'Ask what you actually want to know.',
  'Get the answer. See the query. Understand the data.',
  '',
  'Four directions. Infinite possibilities. One spark.',
];

export default function Manifesto() {
  return (
    <section
      className="relative py-32 px-6 overflow-hidden"
      style={{ background: '#0A0A0A' }}
    >
      {/* Background compass — large, very muted */}
      <div
        className="absolute inset-0 flex items-center justify-center pointer-events-none"
        style={{ opacity: 0.06 }}
      >
        <SparkCompass size={700} animate={false} />
      </div>

      {/* Hairline top/bottom rules */}
      <div className="absolute top-0 left-0 right-0 h-px" style={{ background: '#2A2A2A' }} />
      <div className="absolute bottom-0 left-0 right-0 h-px" style={{ background: '#2A2A2A' }} />

      <div className="relative z-10 max-w-2xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="mb-12"
        >
          <p className="text-xs font-mono tracking-widest uppercase" style={{ color: '#A9C08E' }}>
            Manifesto
          </p>
        </motion.div>

        <div className="flex flex-col gap-3">
          {LINES.map((line, i) => (
            <motion.p
              key={i}
              initial={{ opacity: 0, y: 8 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.04 }}
              className="text-sm leading-relaxed"
              style={{
                color: line === '' ? 'transparent' : line.startsWith('Four') ? '#F5F5F5' : line.startsWith('SPARK') || line.startsWith('Ask') || line.startsWith('Get') ? '#F5F5F5' : '#6A6A6A',
                fontSize: line.startsWith('Four') ? '1.25rem' : undefined,
                fontWeight: line.startsWith('Four') ? 600 : undefined,
                letterSpacing: line.startsWith('Four') ? '-0.02em' : undefined,
                minHeight: line === '' ? '0.75rem' : undefined,
              }}
            >
              {line || '\u00A0'}
            </motion.p>
          ))}
        </div>
      </div>
    </section>
  );
}
