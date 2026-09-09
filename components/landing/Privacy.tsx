'use client';

import { motion } from 'framer-motion';

const NODES = [
  { label: 'Your Data', sub: 'CSV · MySQL · PostgreSQL · SQLite', top: true },
  { label: 'SPARK', sub: 'Local Electron app', accent: true },
  { label: 'Local DuckDB', sub: 'On your machine' },
  { label: 'Query Engine', sub: 'No network call for data' },
  { label: 'Answer', sub: 'Displayed & spoken back' },
];

const GUARANTEES = [
  { title: 'No centralized database', body: 'Connected data is never uploaded to a SPARK server.' },
  { title: 'No persistent customer data', body: 'Data is cleared when you disconnect a source.' },
  { title: 'User-managed API keys', body: 'Your Groq, Deepgram, and Inworld keys live locally.' },
];

export default function Privacy() {
  return (
    <section id="privacy" className="py-24 px-6">
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
            Your data stays yours.
          </h2>
          <p className="text-gray-400 max-w-xl mx-auto leading-relaxed">
            SPARK is designed around local-first analytics. Your connected data is imported into a
            local DuckDB instance and cleared when you disconnect. API keys are managed locally
            rather than centralized by SPARK.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
          {/* Architecture diagram */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="flex flex-col items-center gap-0"
          >
            {NODES.map((node, i) => (
              <div key={node.label} className="flex flex-col items-center w-full max-w-xs">
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="w-full px-5 py-3 rounded-xl text-center"
                  style={
                    node.accent
                      ? {
                          background: 'linear-gradient(135deg, rgba(217,119,6,0.15), rgba(124,58,237,0.15))',
                          border: '1px solid rgba(217,119,6,0.3)',
                        }
                      : {
                          background: 'rgba(26,18,33,0.8)',
                          border: '1px solid rgba(217,119,6,0.1)',
                        }
                  }
                >
                  <p
                    className="font-semibold text-sm"
                    style={{ color: node.accent ? '#D97706' : '#e2e8f0' }}
                  >
                    {node.label}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">{node.sub}</p>
                </motion.div>
                {i < NODES.length - 1 && (
                  <div className="flex flex-col items-center py-1">
                    <div className="w-px h-4" style={{ background: 'rgba(217,119,6,0.25)' }} />
                    <span className="text-orange-700 text-xs">↓</span>
                  </div>
                )}
              </div>
            ))}
          </motion.div>

          {/* Guarantee cards */}
          <div className="flex flex-col gap-5">
            {GUARANTEES.map((g, i) => (
              <motion.div
                key={g.title}
                initial={{ opacity: 0, x: 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="p-5 rounded-2xl"
                style={{
                  background: 'rgba(26,18,33,0.6)',
                  border: '1px solid rgba(217,119,6,0.12)',
                }}
              >
                <div className="flex items-start gap-3">
                  <span
                    className="mt-0.5 flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs"
                    style={{
                      background: 'rgba(34,197,94,0.15)',
                      color: '#4ade80',
                      border: '1px solid rgba(34,197,94,0.3)',
                    }}
                  >
                    ✓
                  </span>
                  <div>
                    <p className="text-white font-semibold text-sm mb-1">{g.title}</p>
                    <p className="text-gray-400 text-sm leading-relaxed">{g.body}</p>
                  </div>
                </div>
              </motion.div>
            ))}

            <motion.p
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.4 }}
              className="text-xs text-gray-600 px-1 leading-relaxed"
            >
              Note: AI inference (Groq) and voice services (Deepgram, Inworld) require network
              calls. Your query context is sent — not your raw dataset.
            </motion.p>
          </div>
        </div>
      </div>
    </section>
  );
}
