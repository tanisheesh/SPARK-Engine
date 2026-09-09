'use client';

import { motion } from 'framer-motion';

const RETRY_STEPS = ['Query failed', 'Analyze error', 'Regenerate', 'Execute again'];

const SAVED = ['Monthly Revenue', 'Top Customers', 'Churn Analysis', 'Sales by Region'];

const DEBUG_ITEMS = ['Generated SQL', 'Raw Results', 'Processing Pipeline', 'AI Response'];

export default function FeatureBento() {
  return (
    <section id="features" className="py-24 px-6">
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
            More than voice-to-SQL.
          </h2>
          <p className="text-gray-400 max-w-lg mx-auto">
            A complete analytics environment — designed to be inspectable, reliable, and fast.
          </p>
        </motion.div>

        {/* Bento grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Feature 1: Voice-to-SQL — large */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="md:col-span-2 p-6 rounded-2xl"
            style={{
              background: 'rgba(26,18,33,0.8)',
              border: '1px solid rgba(217,119,6,0.15)',
            }}
          >
            <span className="text-xs font-mono text-orange-400 tracking-widest uppercase">01</span>
            <h3 className="text-white font-bold text-lg mt-2 mb-3">Voice-to-SQL</h3>
            <p className="text-gray-400 text-sm mb-5 leading-relaxed">
              Speak naturally. SPARK interprets intent, generates precise SQL, and executes it
              without you touching a keyboard.
            </p>
            <div
              className="rounded-xl p-4 font-mono text-sm"
              style={{
                background: 'rgba(0,0,0,0.4)',
                border: '1px solid rgba(217,119,6,0.1)',
              }}
            >
              <span className="text-gray-500">&gt; </span>
              <span className="text-gray-200">
                &ldquo;Compare monthly revenue for the last 12 months.&rdquo;
              </span>
              <br />
              <br />
              <span className="text-orange-400">SELECT</span>
              <span className="text-gray-300">
                {' '}DATE_TRUNC(&apos;month&apos;, sale_date) AS month,
              </span>
              <br />
              <span className="text-gray-600 pl-4">{'       '}</span>
              <span className="text-purple-400">SUM</span>
              <span className="text-gray-300">(revenue) AS total</span>
              <br />
              <span className="text-orange-400">FROM</span>
              <span className="text-gray-300"> sales</span>
              <br />
              <span className="text-orange-400">GROUP BY</span>
              <span className="text-gray-300"> 1 </span>
              <span className="text-orange-400">ORDER BY</span>
              <span className="text-gray-300"> 1;</span>
            </div>
          </motion.div>

          {/* Feature 2: Self-healing */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.05 }}
            className="p-6 rounded-2xl"
            style={{
              background: 'rgba(26,18,33,0.8)',
              border: '1px solid rgba(217,119,6,0.12)',
            }}
          >
            <span className="text-xs font-mono text-orange-400 tracking-widest uppercase">02</span>
            <h3 className="text-white font-bold text-lg mt-2 mb-3">Self-healing SQL</h3>
            <p className="text-gray-400 text-sm mb-4 leading-relaxed">
              Failed queries are retried automatically using the error context. Up to 3 attempts.
            </p>
            <div className="flex flex-col gap-2">
              {RETRY_STEPS.map((s, i) => (
                <div key={s} className="flex items-center gap-2.5">
                  <div
                    className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0"
                    style={{
                      background: i === 0 ? 'rgba(239,68,68,0.15)' : 'rgba(217,119,6,0.12)',
                      border: `1px solid ${i === 0 ? 'rgba(239,68,68,0.3)' : 'rgba(217,119,6,0.25)'}`,
                      color: i === 0 ? '#ef4444' : '#D97706',
                    }}
                  >
                    {i === 0 ? '!' : '→'}
                  </div>
                  <span className="text-xs text-gray-400 font-mono">{s}</span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Feature 3: ER Diagrams */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="p-6 rounded-2xl"
            style={{
              background: 'rgba(26,18,33,0.8)',
              border: '1px solid rgba(217,119,6,0.12)',
            }}
          >
            <span className="text-xs font-mono text-orange-400 tracking-widest uppercase">03</span>
            <h3 className="text-white font-bold text-lg mt-2 mb-3">Instant ER Diagrams</h3>
            <p className="text-gray-400 text-sm mb-4 leading-relaxed">
              Connect a database and SPARK maps relationships automatically. Chen and Crow&apos;s Foot
              notation supported.
            </p>
            <div
              className="rounded-lg p-3 font-mono text-xs leading-relaxed"
              style={{
                background: 'rgba(0,0,0,0.3)',
                border: '1px solid rgba(217,119,6,0.08)',
              }}
            >
              <span className="text-orange-400">CUSTOMERS</span>
              <br />
              <span className="text-gray-500 ml-2">id · name · email</span>
              <br />
              <span className="text-gray-600 ml-4">│ (1:N)</span>
              <br />
              <span className="text-purple-400">ORDERS</span>
              <br />
              <span className="text-gray-500 ml-2">id · customer_id · total</span>
              <br />
              <span className="text-gray-600 ml-4">│ (1:N)</span>
              <br />
              <span className="text-blue-400">ORDER_ITEMS</span>
              <br />
              <span className="text-gray-500 ml-2">id · order_id · qty</span>
            </div>
            <div className="flex gap-2 mt-3">
              {['Chen', "Crow's Foot"].map((n) => (
                <span
                  key={n}
                  className="text-xs px-2.5 py-1 rounded-full font-mono"
                  style={{
                    background: 'rgba(217,119,6,0.1)',
                    border: '1px solid rgba(217,119,6,0.2)',
                    color: '#F59E0B',
                  }}
                >
                  {n}
                </span>
              ))}
            </div>
          </motion.div>

          {/* Feature 4: Developer Debug */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.15 }}
            className="p-6 rounded-2xl"
            style={{
              background: 'rgba(26,18,33,0.8)',
              border: '1px solid rgba(217,119,6,0.12)',
            }}
          >
            <span className="text-xs font-mono text-orange-400 tracking-widest uppercase">04</span>
            <h3 className="text-white font-bold text-lg mt-2 mb-3">Developer Debug Mode</h3>
            <p className="text-gray-400 text-sm mb-4 leading-relaxed">
              See exactly how SPARK reached the answer. Toggle debug mode to inspect every step.
            </p>
            <div className="flex flex-col gap-2">
              {DEBUG_ITEMS.map((item) => (
                <div
                  key={item}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-mono"
                  style={{
                    background: 'rgba(0,0,0,0.3)',
                    border: '1px solid rgba(217,119,6,0.08)',
                    color: '#9ca3af',
                  }}
                >
                  <span className="text-green-500">✓</span>
                  {item}
                </div>
              ))}
            </div>
          </motion.div>

          {/* Feature 5: Saved Prompts */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="p-6 rounded-2xl"
            style={{
              background: 'rgba(26,18,33,0.8)',
              border: '1px solid rgba(217,119,6,0.12)',
            }}
          >
            <span className="text-xs font-mono text-orange-400 tracking-widest uppercase">05</span>
            <h3 className="text-white font-bold text-lg mt-2 mb-3">Saved Prompts</h3>
            <p className="text-gray-400 text-sm mb-4 leading-relaxed">
              Bookmark your most-used questions and replay them instantly.
            </p>
            <div className="flex flex-col gap-2">
              {SAVED.map((s) => (
                <div
                  key={s}
                  className="px-3 py-2 rounded-lg text-xs font-mono flex items-center gap-2"
                  style={{
                    background: 'rgba(217,119,6,0.06)',
                    border: '1px solid rgba(217,119,6,0.12)',
                    color: '#F59E0B',
                  }}
                >
                  <span>📌</span>
                  {s}
                </div>
              ))}
            </div>
          </motion.div>

          {/* Feature 6: Large Data */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.25 }}
            className="md:col-span-2 p-6 rounded-2xl flex items-center gap-8"
            style={{
              background: 'linear-gradient(135deg, rgba(217,119,6,0.06), rgba(124,58,237,0.06))',
              border: '1px solid rgba(217,119,6,0.15)',
            }}
          >
            <div className="flex-1">
              <span className="text-xs font-mono text-orange-400 tracking-widest uppercase">06</span>
              <h3 className="text-white font-bold text-lg mt-2 mb-3">Built for Large Data</h3>
              <p className="text-gray-400 text-sm leading-relaxed">
                Large CSV files are processed through DuckDB&apos;s columnar engine — efficient,
                fast, and entirely local. No upload. No cloud.
              </p>
            </div>
            <div className="flex-shrink-0 text-center">
              <div
                className="text-3xl font-black font-mono"
                style={{ color: '#F59E0B' }}
              >
                100 GB+
              </div>
              <div className="text-xs text-gray-500 mt-1 font-mono">CSV supported</div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
