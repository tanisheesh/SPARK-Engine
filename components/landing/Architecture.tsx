'use client';

import { motion } from 'framer-motion';

const PIPELINE = [
  { label: 'Voice', color: '#D97706' },
  { label: 'Deepgram', color: '#9ca3af' },
  { label: 'Groq / GPT-OSS 120B', color: '#a78bfa' },
  { label: 'SQL Validation', color: '#F59E0B' },
  { label: 'DuckDB', color: '#34d399' },
  { label: 'Results', color: '#D97706' },
  { label: 'AI Response', color: '#a78bfa' },
  { label: 'Inworld AI', color: '#9ca3af' },
  { label: 'Voice', color: '#D97706' },
];

const STACK = [
  'Electron',
  'Next.js',
  'TypeScript',
  'DuckDB',
  'ReactFlow',
  'Supabase',
  'Groq',
  'Deepgram',
  'Inworld AI',
];

export default function Architecture() {
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
            See what&apos;s happening under the hood.
          </h2>
          <p className="text-gray-400 max-w-lg mx-auto">
            SPARK doesn&apos;t hide the architecture. Here&apos;s exactly how your voice becomes
            an answer.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-start">
          {/* Pipeline */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="flex flex-col items-center gap-0"
          >
            {PIPELINE.map((node, i) => (
              <div key={`${node.label}-${i}`} className="flex flex-col items-center w-full max-w-xs">
                <motion.div
                  initial={{ opacity: 0, x: -12 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.07 }}
                  className="w-full px-4 py-2.5 rounded-xl text-center text-sm font-mono font-medium"
                  style={{
                    background: 'rgba(26,18,33,0.8)',
                    border: `1px solid ${node.color}22`,
                    color: node.color,
                  }}
                >
                  {node.label}
                </motion.div>
                {i < PIPELINE.length - 1 && (
                  <div className="flex flex-col items-center py-0.5">
                    <div className="w-px h-3" style={{ background: 'rgba(217,119,6,0.2)' }} />
                    <span className="text-[10px] text-gray-700">↓</span>
                  </div>
                )}
              </div>
            ))}
          </motion.div>

          {/* Stack */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="flex flex-col gap-4"
          >
            <p className="text-xs font-mono text-gray-500 uppercase tracking-widest mb-2">
              Technology Stack
            </p>
            <div className="flex flex-wrap gap-2.5">
              {STACK.map((tech, i) => (
                <motion.span
                  key={tech}
                  initial={{ opacity: 0, scale: 0.9 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.05 }}
                  className="px-3 py-1.5 rounded-lg text-xs font-mono font-medium"
                  style={{
                    background: 'rgba(26,18,33,0.9)',
                    border: '1px solid rgba(217,119,6,0.15)',
                    color: '#D97706',
                  }}
                >
                  {tech}
                </motion.span>
              ))}
            </div>

            <div
              className="mt-4 p-5 rounded-2xl"
              style={{
                background: 'rgba(217,119,6,0.05)',
                border: '1px solid rgba(217,119,6,0.15)',
              }}
            >
              <p className="text-gray-300 text-sm leading-relaxed mb-3">
                SPARK is built with technologies you know. The stack is open, inspectable, and
                entirely within your control — because trust requires transparency.
              </p>
              <a
                href="https://github.com"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm font-semibold hover:text-white transition-colors"
                style={{ color: '#D97706' }}
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
                </svg>
                Explore the repository
              </a>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
