'use client';

import { motion } from 'framer-motion';

const SOURCES = ['CSV', 'MySQL', 'PostgreSQL', 'SQLite', 'DuckDB'];

export default function TrustStrip() {
  return (
    <section className="py-12 border-y" style={{ borderColor: 'rgba(217,119,6,0.1)' }}>
      <div className="max-w-5xl mx-auto px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="flex flex-wrap items-center justify-center gap-4 md:gap-8 mb-6"
        >
          {SOURCES.map((src, i) => (
            <motion.span
              key={src}
              initial={{ opacity: 0, y: 8 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              className="text-sm font-mono font-semibold tracking-wider px-4 py-2 rounded-lg"
              style={{
                color: '#D97706',
                background: 'rgba(217,119,6,0.07)',
                border: '1px solid rgba(217,119,6,0.15)',
              }}
            >
              {src}
            </motion.span>
          ))}
        </motion.div>
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.4 }}
          className="text-gray-500 text-sm"
        >
          Built for analysts, product managers, engineers, and data-driven teams.
        </motion.p>
      </div>
    </section>
  );
}
