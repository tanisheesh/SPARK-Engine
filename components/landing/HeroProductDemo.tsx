'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const DEMO_STEPS = [
  { id: 'voice', label: 'Listening...' },
  { id: 'question', label: 'Question received' },
  { id: 'sql', label: 'Generating SQL' },
  { id: 'execute', label: 'Executing locally' },
  { id: 'result', label: 'Answer ready' },
];

const SQL_LINES = [
  'SELECT',
  '  product_name,',
  '  SUM(revenue) AS total_revenue',
  'FROM sales',
  "WHERE sale_date >= '2026-01-01'",
  'GROUP BY product_name',
  'ORDER BY total_revenue DESC',
  'LIMIT 5;',
];

const RESULTS = [
  { name: 'Analytics Pro', revenue: '₹12.4M' },
  { name: 'Data Suite', revenue: '₹9.1M' },
  { name: 'Insight Core', revenue: '₹7.8M' },
];

const CYCLE_DURATION = 10000;

export default function HeroProductDemo() {
  const [step, setStep] = useState(0);
  const [sqlLine, setSqlLine] = useState(0);
  const [waveActive, setWaveActive] = useState(true);

  useEffect(() => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;

    // Step timings (ms from start of cycle)
    const timings = [
      { step: 1, delay: 1200 },
      { step: 2, delay: 2800 },
      { step: 3, delay: 5200 },
      { step: 4, delay: 7000 },
    ];

    const timers: ReturnType<typeof setTimeout>[] = [];

    const runCycle = () => {
      setStep(0);
      setSqlLine(0);
      setWaveActive(true);

      timings.forEach(({ step: s, delay }) => {
        timers.push(setTimeout(() => setStep(s), delay));
      });

      // Animate SQL lines
      for (let i = 0; i < SQL_LINES.length; i++) {
        timers.push(setTimeout(() => setSqlLine(i + 1), 2800 + i * 220));
      }

      timers.push(setTimeout(() => setWaveActive(false), 1000));
    };

    runCycle();
    const interval = setInterval(runCycle, CYCLE_DURATION);

    return () => {
      timers.forEach(clearTimeout);
      clearInterval(interval);
    };
  }, []);

  return (
    <div
      className="relative rounded-2xl overflow-hidden"
      style={{
        background: 'rgba(15,10,26,0.9)',
        border: '1px solid rgba(217,119,6,0.2)',
        boxShadow: '0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(217,119,6,0.08)',
      }}
    >
      {/* Window chrome */}
      <div
        className="flex items-center gap-2 px-4 py-3 border-b"
        style={{ borderColor: 'rgba(217,119,6,0.12)', background: 'rgba(26,18,33,0.8)' }}
      >
        <div className="w-3 h-3 rounded-full bg-red-500/70" />
        <div className="w-3 h-3 rounded-full bg-yellow-500/70" />
        <div className="w-3 h-3 rounded-full bg-green-500/70" />
        <span className="ml-3 text-xs font-mono text-gray-500">SPARK Engine — Voice Analytics</span>
      </div>

      <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6 min-h-[320px]">
        {/* Left: Voice → Question → Response */}
        <div className="flex flex-col gap-4">
          {/* Voice waveform */}
          <div
            className="p-4 rounded-xl"
            style={{
              background: 'rgba(217,119,6,0.06)',
              border: '1px solid rgba(217,119,6,0.15)',
            }}
          >
            <div className="flex items-center gap-3 mb-3">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                style={{
                  background: waveActive
                    ? 'linear-gradient(135deg, #D97706, #7C3AED)'
                    : 'rgba(217,119,6,0.2)',
                  transition: 'background 0.5s',
                }}
              >
                <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                  <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
                </svg>
              </div>
              <div className="flex items-end gap-0.5 h-5">
                {[3, 6, 10, 7, 12, 5, 9, 4, 8, 6, 11, 4].map((h, i) => (
                  <motion.div
                    key={i}
                    className="w-0.5 rounded-full"
                    style={{ background: '#D97706' }}
                    animate={
                      waveActive
                        ? { height: [h * 1.2, h * 0.5, h * 1.2] }
                        : { height: 2 }
                    }
                    transition={{
                      duration: 0.8,
                      repeat: waveActive ? Infinity : 0,
                      delay: i * 0.06,
                      ease: 'easeInOut',
                    }}
                  />
                ))}
              </div>
            </div>

            <AnimatePresence mode="wait">
              {step >= 1 && (
                <motion.p
                  key="question"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-sm text-gray-200 font-medium leading-relaxed"
                >
                  &ldquo;Which products generated the most revenue last quarter?&rdquo;
                </motion.p>
              )}
              {step < 1 && (
                <motion.p
                  key="waiting"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-xs text-gray-500 font-mono"
                >
                  Listening for voice input...
                </motion.p>
              )}
            </AnimatePresence>
          </div>

          {/* Pipeline steps */}
          <div className="flex flex-col gap-2">
            {DEMO_STEPS.slice(1).map((s, i) => (
              <motion.div
                key={s.id}
                className="flex items-center gap-2.5 text-xs font-mono"
                animate={{
                  opacity: step >= i + 1 ? 1 : 0.3,
                  x: step === i + 1 ? [0, 2, 0] : 0,
                }}
                transition={{ duration: 0.3 }}
              >
                <span
                  className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold"
                  style={{
                    background:
                      step > i + 1
                        ? 'rgba(34,197,94,0.2)'
                        : step === i + 1
                        ? 'rgba(217,119,6,0.2)'
                        : 'rgba(255,255,255,0.05)',
                    border:
                      step > i + 1
                        ? '1px solid rgba(34,197,94,0.4)'
                        : step === i + 1
                        ? '1px solid rgba(217,119,6,0.4)'
                        : '1px solid rgba(255,255,255,0.08)',
                    color: step > i + 1 ? '#4ade80' : step === i + 1 ? '#D97706' : '#6b7280',
                  }}
                >
                  {step > i + 1 ? '✓' : i + 1}
                </span>
                <span
                  style={{
                    color:
                      step > i + 1 ? '#4ade80' : step === i + 1 ? '#D97706' : '#4b5563',
                  }}
                >
                  {s.label}
                </span>
                {step === i + 1 && (
                  <motion.span
                    animate={{ opacity: [1, 0] }}
                    transition={{ duration: 0.5, repeat: Infinity }}
                    className="w-1 h-3 inline-block rounded-sm"
                    style={{ background: '#D97706' }}
                  />
                )}
              </motion.div>
            ))}
          </div>

          {/* AI response */}
          <AnimatePresence>
            {step >= 4 && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="p-3 rounded-xl text-sm"
                style={{
                  background: 'rgba(124,58,237,0.08)',
                  border: '1px solid rgba(124,58,237,0.2)',
                }}
              >
                <span className="text-purple-400 font-mono text-xs">&gt; </span>
                <span className="text-gray-200">
                  The top product generated{' '}
                  <span className="text-orange-400 font-semibold">₹12.4M</span> in revenue last
                  quarter, leading by 36%.
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Right: SQL + Results */}
        <div className="flex flex-col gap-4">
          {/* SQL panel */}
          <div
            className="rounded-xl overflow-hidden flex-1"
            style={{
              background: 'rgba(0,0,0,0.4)',
              border: '1px solid rgba(217,119,6,0.1)',
            }}
          >
            <div
              className="flex items-center gap-2 px-3 py-2 border-b text-xs font-mono"
              style={{ borderColor: 'rgba(217,119,6,0.1)', color: '#6b7280' }}
            >
              <span className="w-2 h-2 rounded-full bg-orange-500/60" />
              generated.sql
            </div>
            <div className="p-3 font-mono text-xs leading-relaxed">
              {SQL_LINES.map((line, i) => (
                <AnimatePresence key={i}>
                  {sqlLine > i && (
                    <motion.div
                      initial={{ opacity: 0, x: -4 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.15 }}
                    >
                      <span
                        style={{
                          color: line.trimStart().startsWith('SELECT') ||
                            line.trimStart().startsWith('FROM') ||
                            line.trimStart().startsWith('WHERE') ||
                            line.trimStart().startsWith('GROUP') ||
                            line.trimStart().startsWith('ORDER') ||
                            line.trimStart().startsWith('LIMIT')
                            ? '#D97706'
                            : line.includes('SUM') || line.includes('AS')
                            ? '#8B5CF6'
                            : '#e2e8f0',
                        }}
                      >
                        {line}
                      </span>
                      <br />
                    </motion.div>
                  )}
                </AnimatePresence>
              ))}
            </div>
          </div>

          {/* Results */}
          <AnimatePresence>
            {step >= 4 && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="rounded-xl overflow-hidden"
                style={{ border: '1px solid rgba(217,119,6,0.15)' }}
              >
                <div
                  className="flex items-center justify-between px-3 py-2 text-xs font-mono border-b"
                  style={{
                    borderColor: 'rgba(217,119,6,0.15)',
                    background: 'rgba(217,119,6,0.06)',
                    color: '#D97706',
                  }}
                >
                  <span>results</span>
                  <span className="text-gray-500">{RESULTS.length} rows</span>
                </div>
                {RESULTS.map((r, i) => (
                  <motion.div
                    key={r.name}
                    initial={{ opacity: 0, x: 8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className="flex items-center justify-between px-3 py-2 text-xs border-b last:border-0"
                    style={{
                      borderColor: 'rgba(255,255,255,0.04)',
                      background: i === 0 ? 'rgba(217,119,6,0.05)' : 'transparent',
                    }}
                  >
                    <span className="text-gray-300 font-mono">{r.name}</span>
                    <span className="text-orange-400 font-semibold font-mono">{r.revenue}</span>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
