'use client';

import { motion } from 'framer-motion';

const CATEGORIES = [
  {
    id: 'analyze',
    label: 'Analyze',
    items: [
      { label: 'Chart', soon: false },
      { label: 'Key Insights', soon: false },
      { label: 'Deep Dive', soon: false },
      { label: 'Find Anomalies', soon: false },
    ],
  },
  {
    id: 'explore',
    label: 'Explore',
    items: [
      { label: 'Breakdown', soon: false },
      { label: 'Compare', soon: false },
      { label: 'Forecast', soon: true },
      { label: 'Data Map', soon: true },
    ],
  },
  {
    id: 'create',
    label: 'Create',
    items: [
      { label: 'Dashboard', soon: true },
      { label: 'Report', soon: true },
      { label: 'Data Table', soon: false },
      { label: 'SQL', soon: false },
    ],
  },
];

export default function StudioGrid() {
  return (
    <section className="py-24 px-6" style={{ background: '#141414' }}>
      <div className="max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <p className="text-xs font-mono tracking-widest uppercase mb-3" style={{ color: '#A9C08E' }}>
            Studio
          </p>
          <h2
            className="font-semibold tracking-tight mb-3"
            style={{ fontSize: 'clamp(1.5rem, 3vw, 2.2rem)', color: '#F5F5F5', letterSpacing: '-0.02em' }}
          >
            Every type of analysis, built in.
          </h2>
          <p className="text-sm max-w-md mx-auto" style={{ color: '#9A9A9A' }}>
            Once SPARK answers your question, the Studio lets you go further — right from the same interface.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {CATEGORIES.map((cat, ci) => (
            <motion.div
              key={cat.id}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: ci * 0.1 }}
              className="rounded-xl p-6 flex flex-col gap-5"
              style={{ border: '1px solid #2A2A2A', background: '#0F0F0F' }}
            >
              <p className="text-xs font-mono tracking-widest uppercase" style={{ color: '#A9C08E' }}>
                {cat.label}
              </p>
              <div className="flex flex-col gap-2">
                {cat.items.map((item) => (
                  <div
                    key={item.label}
                    className="flex items-center justify-between px-3 py-2.5 rounded-md"
                    style={{ border: '1px solid #2A2A2A', background: '#1A1A1A' }}
                  >
                    <span className="text-xs" style={{ color: item.soon ? '#6A6A6A' : '#F5F5F5' }}>
                      {item.label}
                    </span>
                    {item.soon && (
                      <span
                        className="text-[9px] font-mono tracking-widest uppercase px-1.5 py-0.5 rounded"
                        style={{ border: '1px solid #2A2A2A', color: '#6A6A6A' }}
                      >
                        soon
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
