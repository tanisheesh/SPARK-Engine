'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const CASES = [
  {
    role: 'For Analysts',
    question: '"Which regions declined month over month?"',
    sql: 'SELECT region, SUM(revenue) FROM sales\nGROUP BY region, month\nORDER BY month DESC;',
    context: 'Stop writing repetitive SQL. Ask the question instead of the query.',
  },
  {
    role: 'For Product Managers',
    question: '"Which feature has the highest adoption?"',
    sql: 'SELECT feature_name, COUNT(DISTINCT user_id) AS users\nFROM feature_events\nGROUP BY feature_name\nORDER BY users DESC;',
    context: 'Turn business questions into data answers through conversation.',
  },
  {
    role: 'For Executives',
    question: '"How did revenue perform this quarter?"',
    sql: "SELECT SUM(revenue) AS q_revenue\nFROM sales\nWHERE quarter = 'Q1-2026';",
    context: 'Speak to your data in plain English. No SQL required.',
  },
  {
    role: 'For Engineers',
    question: '"Show me the relationships between these tables."',
    sql: '-- SPARK auto-generates ER diagrams\n-- from your schema on connection',
    context: 'Let stakeholders self-serve while the data architecture stays sound.',
  },
  {
    role: 'For Teams',
    question: '"Compare this month\'s performance with last month."',
    sql: "SELECT month, SUM(revenue)\nFROM sales\nWHERE month IN ('2026-08', '2026-09')\nGROUP BY month;",
    context: 'One shared interface. Everyone gets answers without the bottleneck.',
  },
];

export default function UseCases() {
  const [active, setActive] = useState(0);

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
            One interface. Different questions.
          </h2>
          <p className="text-gray-400 max-w-lg mx-auto">
            SPARK adapts to how you think — not how your database is structured.
          </p>
        </motion.div>

        {/* Tab row */}
        <div className="flex flex-wrap justify-center gap-2 mb-8">
          {CASES.map((c, i) => (
            <button
              key={c.role}
              onClick={() => setActive(i)}
              className="px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200"
              style={
                active === i
                  ? {
                      background: 'linear-gradient(135deg, rgba(217,119,6,0.2), rgba(124,58,237,0.15))',
                      border: '1px solid rgba(217,119,6,0.35)',
                      color: '#F59E0B',
                    }
                  : {
                      background: 'rgba(26,18,33,0.6)',
                      border: '1px solid rgba(255,255,255,0.06)',
                      color: '#6b7280',
                    }
              }
            >
              {c.role}
            </button>
          ))}
        </div>

        {/* Active case */}
        <AnimatePresence mode="wait">
          <motion.div
            key={active}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.25 }}
            className="grid grid-cols-1 md:grid-cols-2 gap-6"
          >
            {/* Question + context */}
            <div
              className="p-6 rounded-2xl flex flex-col justify-between"
              style={{
                background: 'rgba(217,119,6,0.06)',
                border: '1px solid rgba(217,119,6,0.2)',
              }}
            >
              <div>
                <p className="text-xs font-mono text-orange-400 uppercase tracking-widest mb-4">
                  {CASES[active].role}
                </p>
                <div className="flex items-start gap-3 mb-6">
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{ background: 'rgba(217,119,6,0.15)', border: '1px solid rgba(217,119,6,0.3)' }}
                  >
                    <svg className="w-3.5 h-3.5 text-orange-400" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                      <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
                    </svg>
                  </div>
                  <p className="text-white text-lg font-medium leading-snug">
                    {CASES[active].question}
                  </p>
                </div>
              </div>
              <p className="text-gray-400 text-sm leading-relaxed border-t pt-4" style={{ borderColor: 'rgba(217,119,6,0.12)' }}>
                {CASES[active].context}
              </p>
            </div>

            {/* SQL output */}
            <div
              className="rounded-2xl overflow-hidden"
              style={{
                background: 'rgba(0,0,0,0.5)',
                border: '1px solid rgba(217,119,6,0.1)',
              }}
            >
              <div
                className="flex items-center gap-2 px-4 py-2.5 text-xs font-mono border-b"
                style={{ borderColor: 'rgba(217,119,6,0.1)', color: '#6b7280' }}
              >
                <span className="w-2 h-2 rounded-full bg-orange-500/60" />
                generated.sql
              </div>
              <pre
                className="p-5 text-xs font-mono leading-relaxed overflow-x-auto"
                style={{ color: '#a3e635' }}
              >
                {CASES[active].sql}
              </pre>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
}
