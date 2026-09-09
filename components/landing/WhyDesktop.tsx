'use client';

import { motion } from 'framer-motion';

const ROWS = [
  { web: 'Browser sandbox', spark: 'Native filesystem access' },
  { web: 'Remote-first', spark: 'Local-first' },
  { web: 'Upload data to process', spark: 'Work with local data in-place' },
  { web: 'Generic SQL environment', spark: 'Unified DuckDB query surface' },
];

export default function WhyDesktop() {
  return (
    <section className="py-24 px-6">
      <div className="max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2
            className="font-black text-white mb-4"
            style={{ fontSize: 'clamp(1.8rem, 4vw, 3rem)' }}
          >
            Why not just another web app?
          </h2>
          <p className="text-gray-400 max-w-xl mx-auto leading-relaxed">
            SPARK needs native filesystem access for local DuckDB databases and very large CSV
            files. A desktop architecture lets SPARK maintain a true local-first data workflow that
            a browser sandbox cannot provide.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="overflow-hidden rounded-2xl"
          style={{ border: '1px solid rgba(217,119,6,0.15)' }}
        >
          {/* Header */}
          <div
            className="grid grid-cols-2 text-xs font-mono font-semibold tracking-widest uppercase"
            style={{ background: 'rgba(26,18,33,0.9)' }}
          >
            <div className="px-6 py-3 border-r" style={{ borderColor: 'rgba(255,255,255,0.06)', color: '#6b7280' }}>
              Web App
            </div>
            <div className="px-6 py-3" style={{ color: '#D97706' }}>
              SPARK (Desktop)
            </div>
          </div>

          {ROWS.map((row, i) => (
            <motion.div
              key={row.web}
              initial={{ opacity: 0, x: -12 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.07 }}
              className="grid grid-cols-2 border-t text-sm"
              style={{ borderColor: 'rgba(255,255,255,0.05)' }}
            >
              <div
                className="px-6 py-4 border-r flex items-center gap-2"
                style={{
                  borderColor: 'rgba(255,255,255,0.05)',
                  background: 'rgba(0,0,0,0.2)',
                  color: '#6b7280',
                }}
              >
                <span className="text-red-500/60 flex-shrink-0">✕</span>
                {row.web}
              </div>
              <div
                className="px-6 py-4 flex items-center gap-2"
                style={{ color: '#e2e8f0', background: 'rgba(217,119,6,0.03)' }}
              >
                <span className="text-green-400/80 flex-shrink-0">✓</span>
                {row.spark}
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
