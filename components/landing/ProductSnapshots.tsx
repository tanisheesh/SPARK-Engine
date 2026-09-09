'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';

/* ── Sidebar icon ── */
function SidebarBtn({ active, icon, pulse }: { active?: boolean; icon: React.ReactNode; pulse?: boolean }) {
  return (
    <div
      className="relative w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
      style={{
        background: active ? 'rgba(217,119,6,0.2)' : 'rgba(15,10,26,0.5)',
        border: `1px solid ${active ? 'rgba(217,119,6,0.3)' : 'rgba(255,255,255,0.06)'}`,
        color: active ? '#D97706' : '#6b7280',
      }}
    >
      {icon}
      {pulse && (
        <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-green-500 border border-[#0f0a1a]" />
      )}
    </div>
  );
}

/* ── Waveform bars ── */
function Waveform({ active }: { active: boolean }) {
  const heights = [3, 6, 10, 7, 12, 5, 9, 4, 8, 6, 11, 4, 7, 9, 5];
  return (
    <div className="flex items-end gap-0.5 h-4">
      {heights.map((h, i) => (
        <motion.div
          key={i}
          className="w-0.5 rounded-full"
          style={{ background: '#D97706' }}
          animate={active ? { height: [h * 1.2, h * 0.4, h * 1.2] } : { height: 2 }}
          transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.06, ease: 'easeInOut' }}
        />
      ))}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   SCREEN 1: Main chat interface
══════════════════════════════════════════════════════════ */
function ChatScreen() {
  return (
    <div
      className="relative flex w-full overflow-hidden rounded-xl"
      style={{ background: '#0f0a1a', height: 400, border: '1px solid rgba(217,119,6,0.18)' }}
    >
      {/* Background grid */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: 'linear-gradient(to right,rgba(26,18,33,0.6) 1px,transparent 1px),linear-gradient(to bottom,rgba(26,18,33,0.6) 1px,transparent 1px)',
          backgroundSize: '3rem 3rem',
        }}
      />

      {/* Orange blob */}
      <div className="absolute top-12 left-20 w-48 h-48 rounded-full opacity-20 blur-3xl pointer-events-none" style={{ background: '#D97706' }} />
      {/* Purple blob */}
      <div className="absolute bottom-12 right-12 w-40 h-40 rounded-full opacity-15 blur-3xl pointer-events-none" style={{ background: '#8B5CF6' }} />

      {/* Sidebar */}
      <div
        className="relative z-10 flex-shrink-0 w-14 flex flex-col items-center py-4 gap-3 border-r"
        style={{ background: 'rgba(2,6,23,0.95)', borderColor: 'rgba(217,119,6,0.15)' }}
      >
        {/* Icon buttons matching actual app */}
        <SidebarBtn active pulse icon={
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        } />
        <SidebarBtn icon={
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          </svg>
        } />
        <SidebarBtn icon={
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
          </svg>
        } />
        {/* bottom avatar */}
        <div className="mt-auto">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm" style={{ background: 'rgba(217,119,6,0.15)', border: '1px solid #D97706', color: '#D97706' }}>
            A
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-8 py-6 gap-5">
        {/* Logo + title */}
        <div className="flex flex-col items-center gap-2">
          <div
            className="w-16 h-16 rounded-full overflow-hidden border-2 flex items-center justify-center"
            style={{ borderColor: 'rgba(217,119,6,0.5)', boxShadow: '0 0 20px rgba(217,119,6,0.35)' }}
          >
            <Image src="/icon.png" alt="SPARK" width={64} height={64} className="object-cover" />
          </div>
          <h2
            className="text-xl font-black font-mono"
            style={{ background: 'linear-gradient(90deg,#D97706,#F97316,#D97706)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
          >
            SPARK ENGINE
          </h2>
          <p className="text-xs font-mono" style={{ color: 'rgba(217,119,6,0.6)' }}>&gt; Your Data Intelligence Companion</p>
        </div>

        {/* Input bar */}
        <div
          className="relative w-full max-w-lg rounded-2xl flex items-center px-4 gap-2"
          style={{
            background: 'rgba(2,6,23,0.9)',
            border: '2px solid rgba(217,119,6,0.3)',
            height: 48,
          }}
        >
          <span className="text-sm flex-1 font-mono" style={{ color: 'rgba(255,255,255,0.5)' }}>◉ Type or speak your query...</span>
          {/* Voice button */}
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: 'linear-gradient(135deg,#D97706,#8B5CF6)' }}
          >
            <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
              <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
            </svg>
          </div>
          {/* Execute button */}
          <div
            className="px-3 h-8 rounded-xl flex items-center text-xs font-bold text-white flex-shrink-0"
            style={{ background: 'linear-gradient(135deg,#D97706,#8B5CF6)' }}
          >
            ▶ EXECUTE
          </div>
        </div>

        {/* Response panel */}
        <div
          className="relative w-full max-w-lg rounded-2xl p-4"
          style={{
            background: 'rgba(2,6,23,0.9)',
            border: '2px solid rgba(217,119,6,0.3)',
          }}
        >
          {/* Speaking indicator */}
          <div className="flex items-center gap-3 mb-3">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: 'linear-gradient(135deg,#D97706,#8B5CF6)', boxShadow: '0 0 12px rgba(217,119,6,0.5)' }}
            >
              <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
                <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
              </svg>
            </div>
            <Waveform active />
          </div>
          <p className="text-sm leading-relaxed" style={{ color: '#e2e8f0' }}>
            <span style={{ color: '#D97706' }} className="font-mono">&gt; </span>
            The top product <span style={{ color: '#D97706' }} className="font-semibold">Analytics Pro</span> generated ₹12.4M in revenue last quarter, leading by 36% over the next best performer.
          </p>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   SCREEN 2: ER Diagram view
══════════════════════════════════════════════════════════ */
function ERScreen() {
  const tables = [
    { id: 'customers', x: 60, y: 60, cols: ['id', 'name', 'email', 'region'] },
    { id: 'orders', x: 260, y: 40, cols: ['id', 'customer_id', 'total', 'date'] },
    { id: 'order_items', x: 260, y: 210, cols: ['id', 'order_id', 'product_id', 'qty'] },
    { id: 'products', x: 460, y: 130, cols: ['id', 'name', 'price', 'category'] },
  ];

  return (
    <div
      className="relative w-full overflow-hidden rounded-xl"
      style={{ background: '#0f0a1a', height: 400, border: '1px solid rgba(217,119,6,0.18)' }}
    >
      {/* Grid background */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: 'linear-gradient(to right,rgba(26,18,33,0.5) 1px,transparent 1px),linear-gradient(to bottom,rgba(26,18,33,0.5) 1px,transparent 1px)',
          backgroundSize: '2rem 2rem',
        }}
      />

      {/* Purple blob */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full opacity-10 blur-3xl pointer-events-none" style={{ background: '#8B5CF6' }} />

      {/* Toolbar */}
      <div
        className="absolute top-0 left-0 right-0 flex items-center gap-3 px-4 py-2.5 border-b z-20"
        style={{ background: 'rgba(2,6,23,0.95)', borderColor: 'rgba(217,119,6,0.12)' }}
      >
        <span className="text-xs font-mono" style={{ color: '#8B5CF6' }}>ER Diagrams</span>
        <div className="flex gap-2 ml-auto">
          {['Chen', "Crow's Foot"].map((n) => (
            <span
              key={n}
              className="text-[10px] px-2 py-0.5 rounded-full font-mono"
              style={{ background: n === 'Chen' ? 'rgba(217,119,6,0.15)' : 'rgba(139,92,246,0.1)', border: `1px solid ${n === 'Chen' ? 'rgba(217,119,6,0.3)' : 'rgba(139,92,246,0.25)'}`, color: n === 'Chen' ? '#D97706' : '#8B5CF6' }}
            >
              {n}
            </span>
          ))}
        </div>
      </div>

      {/* SVG connections */}
      <svg className="absolute inset-0 z-10 pointer-events-none" style={{ top: 40 }}>
        {/* customers → orders */}
        <line x1="176" y1="95" x2="260" y2="90" stroke="rgba(217,119,6,0.35)" strokeWidth="1.5" strokeDasharray="4 3" />
        {/* orders → order_items */}
        <line x1="340" y1="130" x2="340" y2="210" stroke="rgba(217,119,6,0.35)" strokeWidth="1.5" strokeDasharray="4 3" />
        {/* order_items → products */}
        <line x1="430" y1="240" x2="460" y2="180" stroke="rgba(139,92,246,0.35)" strokeWidth="1.5" strokeDasharray="4 3" />
        {/* Crow's foot markers */}
        <text x="240" y="85" className="text-[8px]" fill="rgba(217,119,6,0.5)" fontSize="9">1:N</text>
        <text x="348" y="175" className="text-[8px]" fill="rgba(217,119,6,0.5)" fontSize="9">1:N</text>
        <text x="445" y="215" className="text-[8px]" fill="rgba(139,92,246,0.5)" fontSize="9">N:1</text>
      </svg>

      {/* Table nodes */}
      {tables.map((t, ti) => (
        <div
          key={t.id}
          className="absolute z-10 rounded-lg overflow-hidden"
          style={{
            left: t.x, top: t.y + 40,
            width: 160,
            border: `1px solid ${ti === 0 ? 'rgba(217,119,6,0.4)' : ti === 3 ? 'rgba(139,92,246,0.4)' : 'rgba(217,119,6,0.2)'}`,
            background: 'rgba(26,18,33,0.96)',
            boxShadow: ti === 0 ? '0 0 12px rgba(217,119,6,0.15)' : 'none',
          }}
        >
          <div
            className="px-2.5 py-1.5 text-[11px] font-mono font-bold uppercase tracking-widest border-b"
            style={{
              borderColor: 'rgba(255,255,255,0.06)',
              color: ti === 0 ? '#D97706' : ti === 3 ? '#8B5CF6' : '#D97706',
              background: ti === 0 ? 'rgba(217,119,6,0.08)' : ti === 3 ? 'rgba(139,92,246,0.08)' : 'transparent',
            }}
          >
            {t.id}
          </div>
          {t.cols.map((c, ci) => (
            <div
              key={c}
              className="px-2.5 py-0.5 text-[10px] font-mono flex items-center gap-1.5 border-b last:border-0"
              style={{ borderColor: 'rgba(255,255,255,0.04)', color: ci === 0 ? '#f59e0b' : '#9ca3af' }}
            >
              {ci === 0 && <span style={{ color: '#D97706' }}>🔑</span>}
              {(c.endsWith('_id') && ci !== 0) && <span style={{ color: '#8B5CF6', fontSize: 8 }}>FK</span>}
              {c}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   SCREEN 3: Developer debug panel
══════════════════════════════════════════════════════════ */
function DebugScreen() {
  const SQL = `SELECT
  product_name,
  SUM(revenue) AS total_revenue
FROM sales
WHERE sale_date >= '2026-01-01'
GROUP BY product_name
ORDER BY total_revenue DESC
LIMIT 5;`;

  const steps = [
    '1. Voice/Text input received',
    '2. Groq AI generated SQL query',
    '3. DuckDB executed query',
    '4. Groq AI formatted response',
    '5. TTS audio generated',
  ];

  const results = [
    { product: 'Analytics Pro', revenue: 12400000 },
    { product: 'Data Suite', revenue: 9100000 },
    { product: 'Insight Core', revenue: 7800000 },
  ];

  return (
    <div
      className="relative w-full overflow-hidden rounded-xl"
      style={{ background: '#0f0a1a', height: 400, border: '1px solid rgba(217,119,6,0.18)' }}
    >
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ backgroundImage: 'linear-gradient(to right,rgba(26,18,33,0.5) 1px,transparent 1px),linear-gradient(to bottom,rgba(26,18,33,0.5) 1px,transparent 1px)', backgroundSize: '3rem 3rem' }}
      />

      <div className="relative z-10 p-4 overflow-hidden h-full">
        {/* Header */}
        <div className="flex items-center gap-2 mb-4">
          <span className="text-base">🔧</span>
          <span className="font-mono font-bold text-sm" style={{ color: '#D97706' }}>DEVELOPER DEBUG PANEL</span>
          <span
            className="ml-auto text-[10px] px-2 py-0.5 rounded-full font-mono"
            style={{ background: 'rgba(217,119,6,0.15)', border: '1px solid rgba(217,119,6,0.3)', color: '#D97706' }}
          >
            MODE: ON
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3 h-[calc(100%-52px)] overflow-hidden">
          {/* Left: steps + SQL */}
          <div className="flex flex-col gap-3 overflow-hidden">
            {/* Pipeline steps */}
            <div
              className="rounded-lg p-3"
              style={{ background: 'rgba(2,6,23,0.8)', border: '1px solid rgba(217,119,6,0.12)' }}
            >
              <p className="text-[10px] font-mono font-bold mb-2" style={{ color: '#D97706' }}>📋 PROCESSING PIPELINE:</p>
              {steps.map((s) => (
                <div key={s} className="flex items-center gap-1.5 text-[10px] font-mono mb-1">
                  <span style={{ color: '#4ade80' }}>✓</span>
                  <span style={{ color: '#d1d5db' }}>{s}</span>
                </div>
              ))}
            </div>

            {/* Generated SQL */}
            <div
              className="rounded-lg p-3 flex-1 overflow-hidden"
              style={{ background: 'rgba(2,6,23,0.8)', border: '1px solid rgba(217,119,6,0.12)' }}
            >
              <p className="text-[10px] font-mono font-bold mb-2" style={{ color: '#D97706' }}>🔍 GENERATED SQL:</p>
              <pre className="text-[10px] font-mono overflow-hidden" style={{ color: '#4ade80' }}>{SQL}</pre>
            </div>
          </div>

          {/* Right: stats + results */}
          <div className="flex flex-col gap-3 overflow-hidden">
            {/* Stats */}
            <div
              className="rounded-lg p-3"
              style={{ background: 'rgba(2,6,23,0.8)', border: '1px solid rgba(217,119,6,0.12)' }}
            >
              <p className="text-[10px] font-mono font-bold mb-2" style={{ color: '#D97706' }}>📊 QUERY STATS:</p>
              {[['Total Rows', '5'], ['Results Shown', '3'], ['Query Type', 'SELECT']].map(([k, v]) => (
                <div key={k} className="flex justify-between text-[10px] font-mono mb-1">
                  <span style={{ color: '#6b7280' }}>{k}:</span>
                  <span style={{ color: '#fff' }}>{v}</span>
                </div>
              ))}
            </div>

            {/* AI Response */}
            <div
              className="rounded-lg p-3"
              style={{ background: 'rgba(2,6,23,0.8)', border: '1px solid rgba(217,119,6,0.12)' }}
            >
              <p className="text-[10px] font-mono font-bold mb-2" style={{ color: '#D97706' }}>🤖 AI RESPONSE:</p>
              <p className="text-[10px] font-mono leading-relaxed" style={{ color: '#8B5CF6' }}>
                Analytics Pro generated ₹12.4M — leading by 36% over Data Suite.
              </p>
            </div>

            {/* Raw results */}
            <div
              className="rounded-lg p-3 flex-1"
              style={{ background: 'rgba(2,6,23,0.8)', border: '1px solid rgba(217,119,6,0.12)' }}
            >
              <p className="text-[10px] font-mono font-bold mb-2" style={{ color: '#D97706' }}>📋 RAW SQL OUTPUT:</p>
              {results.map((r) => (
                <div key={r.product} className="flex justify-between text-[10px] font-mono mb-1">
                  <span style={{ color: '#d1d5db' }}>{r.product}</span>
                  <span style={{ color: '#facc15' }}>{r.revenue.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   Main export: tabbed product showcase
══════════════════════════════════════════════════════════ */
const TABS = [
  { id: 'chat', label: 'Chat Interface', screen: <ChatScreen /> },
  { id: 'er', label: 'ER Diagrams', screen: <ERScreen /> },
  { id: 'debug', label: 'Debug Mode', screen: <DebugScreen /> },
];

export default function ProductSnapshots() {
  const [active, setActive] = useState(0);

  return (
    <section className="py-24 px-6">
      <div className="max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-10"
        >
          <p
            className="text-xs font-mono tracking-widest uppercase mb-3"
            style={{ color: 'rgba(217,119,6,0.6)' }}
          >
            The actual product
          </p>
          <h2
            className="font-black text-white mb-3"
            style={{ fontSize: 'clamp(1.6rem, 3.5vw, 2.6rem)' }}
          >
            What you&apos;ll actually use.
          </h2>
          <p className="text-gray-500 text-sm max-w-md mx-auto">
            Faithful recreations of the real desktop interface — built on Electron, Next.js, and DuckDB.
          </p>
        </motion.div>

        {/* Tab switcher */}
        <div className="flex justify-center gap-2 mb-6 flex-wrap">
          {TABS.map((t, i) => (
            <button
              key={t.id}
              onClick={() => setActive(i)}
              className="px-4 py-2 rounded-xl text-sm font-mono font-medium transition-all duration-200"
              style={
                active === i
                  ? { background: 'rgba(217,119,6,0.15)', border: '1px solid rgba(217,119,6,0.35)', color: '#D97706' }
                  : { background: 'rgba(26,18,33,0.5)', border: '1px solid rgba(255,255,255,0.06)', color: '#6b7280' }
              }
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Screen */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="relative"
        >
          {/* Window chrome */}
          <div
            className="rounded-t-2xl px-4 py-2.5 flex items-center gap-2 border-b"
            style={{ background: 'rgba(26,18,33,0.97)', borderColor: 'rgba(217,119,6,0.12)', border: '1px solid rgba(217,119,6,0.15)', borderBottom: 'none', borderRadius: '1rem 1rem 0 0' }}
          >
            <div className="w-3 h-3 rounded-full bg-red-500/70" />
            <div className="w-3 h-3 rounded-full bg-yellow-500/70" />
            <div className="w-3 h-3 rounded-full bg-green-500/70" />
            <span className="ml-3 text-xs font-mono" style={{ color: '#6b7280' }}>
              SPARK Engine — {TABS[active].label}
            </span>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={active}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="rounded-b-2xl overflow-hidden"
              style={{ border: '1px solid rgba(217,119,6,0.15)', borderTop: 'none' }}
            >
              {TABS[active].screen}
            </motion.div>
          </AnimatePresence>
        </motion.div>

        {/* Caption */}
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3 }}
          className="text-center text-xs font-mono mt-4"
          style={{ color: '#4b5563' }}
        >
          Electron · Next.js · DuckDB · Groq · Deepgram · Inworld AI
        </motion.p>
      </div>
    </section>
  );
}
