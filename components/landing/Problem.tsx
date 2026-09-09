'use client';

import { motion } from 'framer-motion';

const TRADITIONAL = [
  'Business question',
  'Find an analyst',
  'Open database client',
  'Write SQL',
  'Debug query',
  'Run query',
  'Interpret result',
  'Explain answer',
];

const SPARK = ['Ask', 'SPARK', 'Answer'];

export default function Problem() {
  return (
    <section id="product" className="py-24 px-6">
      <div className="max-w-5xl mx-auto">
        {/* Heading */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2
            className="font-black text-white mb-4"
            style={{ fontSize: 'clamp(2rem, 5vw, 3.5rem)' }}
          >
            Data shouldn&apos;t require a translator.
          </h2>
          <p className="text-gray-400 text-lg max-w-xl mx-auto">
            Your question is usually simple. Getting the answer isn&apos;t.
          </p>
        </motion.div>

        {/* Contrast */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
          {/* Traditional */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="rounded-2xl p-6"
            style={{
              background: 'rgba(26,18,33,0.6)',
              border: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            <p className="text-xs font-mono tracking-widest text-gray-500 uppercase mb-6">
              Traditional workflow
            </p>
            <div className="flex flex-col items-center gap-0">
              {TRADITIONAL.map((step, i) => (
                <div key={step} className="flex flex-col items-center">
                  <div
                    className="px-4 py-2 rounded-lg text-sm text-gray-300 text-center w-full max-w-xs"
                    style={{ background: 'rgba(255,255,255,0.04)' }}
                  >
                    {step}
                  </div>
                  {i < TRADITIONAL.length - 1 && (
                    <div className="w-px h-4 my-0.5" style={{ background: 'rgba(255,255,255,0.1)' }} />
                  )}
                </div>
              ))}
            </div>
            <div
              className="mt-4 text-xs font-mono text-center pt-4"
              style={{ color: '#6b7280', borderTop: '1px solid rgba(255,255,255,0.06)' }}
            >
              Average: 30–120 minutes
            </div>
          </motion.div>

          {/* SPARK */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.15 }}
            className="rounded-2xl p-6 flex flex-col"
            style={{
              background: 'rgba(217,119,6,0.06)',
              border: '1px solid rgba(217,119,6,0.2)',
            }}
          >
            <div className="flex items-center gap-2 mb-6">
              <span className="text-xs font-mono tracking-widest text-orange-400 uppercase">
                With SPARK
              </span>
              <span
                className="text-xs px-2 py-0.5 rounded-full font-mono"
                style={{ background: 'rgba(217,119,6,0.15)', color: '#F59E0B' }}
              >
                voice-first
              </span>
            </div>
            <div className="flex flex-col items-center gap-0 flex-1 justify-center py-8">
              {SPARK.map((step, i) => (
                <div key={step} className="flex flex-col items-center">
                  <motion.div
                    initial={{ scale: 0.8 }}
                    whileInView={{ scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.15 }}
                    className="px-8 py-3 rounded-xl text-sm font-semibold text-center"
                    style={
                      step === 'SPARK'
                        ? {
                            background: 'linear-gradient(135deg, #D97706, #7C3AED)',
                            color: '#fff',
                            boxShadow: '0 0 24px rgba(217,119,6,0.3)',
                          }
                        : {
                            background: 'rgba(255,255,255,0.06)',
                            color: '#e2e8f0',
                          }
                    }
                  >
                    {step}
                  </motion.div>
                  {i < SPARK.length - 1 && (
                    <div
                      className="w-px h-6 my-1"
                      style={{ background: 'rgba(217,119,6,0.3)' }}
                    />
                  )}
                </div>
              ))}
            </div>
            <div
              className="mt-4 text-xs font-mono text-center pt-4"
              style={{ color: '#D97706', borderTop: '1px solid rgba(217,119,6,0.15)' }}
            >
              Average: under 10 seconds
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
