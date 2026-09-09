'use client';

import { motion } from 'framer-motion';

const SOURCES = [
  {
    name: 'CSV',
    description: 'Drop in a file.',
    detail: 'Any size — processed through local DuckDB.',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  {
    name: 'MySQL',
    description: 'Connect directly.',
    detail: 'SPARK imports the schema and data into DuckDB.',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
      </svg>
    ),
  },
  {
    name: 'PostgreSQL',
    description: 'Connect directly.',
    detail: 'Full schema extraction with ER diagram support.',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
      </svg>
    ),
  },
  {
    name: 'SQLite',
    description: 'Open local databases.',
    detail: 'Open a .db file directly — no server required.',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
      </svg>
    ),
  },
];

export default function DataSources() {
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
            Bring your data.
          </h2>
          <p className="text-gray-400 max-w-xl mx-auto">
            SPARK normalizes connected sources into a local DuckDB query environment, giving the AI
            a consistent SQL surface regardless of your data origin.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {SOURCES.map((src, i) => (
            <motion.div
              key={src.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              className="p-5 rounded-2xl flex flex-col gap-3 group hover:border-orange-600/30 transition-colors duration-200"
              style={{
                background: 'rgba(26,18,33,0.7)',
                border: '1px solid rgba(217,119,6,0.12)',
              }}
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{
                  background: 'rgba(217,119,6,0.1)',
                  color: '#D97706',
                  border: '1px solid rgba(217,119,6,0.2)',
                }}
              >
                {src.icon}
              </div>
              <div>
                <h3 className="text-white font-bold mb-1">{src.name}</h3>
                <p className="text-orange-400 text-sm font-medium mb-2">{src.description}</p>
                <p className="text-gray-500 text-xs leading-relaxed">{src.detail}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
