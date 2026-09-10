'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const SIDEBAR_ITEMS = [
  {
    id: 'data',
    label: 'Data',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 5.625c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
      </svg>
    ),
  },
  {
    id: 'ask',
    label: 'Ask',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
      </svg>
    ),
  },
  {
    id: 'explore',
    label: 'Explore',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 15.803a7.5 7.5 0 0010.607 10.607z" />
      </svg>
    ),
  },
  {
    id: 'conversations',
    label: 'Conversations',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 01-.825-.242m9.345-8.334a2.126 2.126 0 00-.476-.095 48.64 48.64 0 00-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0011.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V20.25a.75.75 0 001.28.53l3.58-3.58A48.458 48.458 0 0011.25 17c2.115 0 4.198-.137 6.24-.402 1.608-.209 2.76-1.614 2.76-3.235V8.511z" />
      </svg>
    ),
  },
];

const MOCK_RESPONSES: Record<string, { sql: string; answer: string }> = {
  'What are my top 5 customers by revenue?': {
    sql: 'SELECT customer_name, SUM(revenue) AS total\nFROM orders\nGROUP BY customer_name\nORDER BY total DESC\nLIMIT 5;',
    answer: 'Your top 5 customers account for 38% of total revenue. Acme Corp leads at $142k, followed by Globex ($98k), Initech ($76k), Umbrella ($61k), and Hooli ($54k).',
  },
  'Show me monthly trends for the last year': {
    sql: 'SELECT DATE_TRUNC(\'month\', order_date) AS month,\n       SUM(revenue) AS monthly_revenue\nFROM orders\nWHERE order_date >= NOW() - INTERVAL \'1 year\'\nGROUP BY 1\nORDER BY 1;',
    answer: 'Revenue grew steadily through Q1–Q3, peaking in October at $284k. A dip in November recovered by December. Overall, year-over-year growth is up 22%.',
  },
  'Which products have declining sales?': {
    sql: 'SELECT product_name,\n       SUM(CASE WHEN period = \'current\' THEN revenue END) AS now,\n       SUM(CASE WHEN period = \'prior\' THEN revenue END) AS before\nFROM sales_periods\nGROUP BY 1\nHAVING now < before\nORDER BY (now - before);',
    answer: '3 products show declining sales: Widget Pro (−34%), Basic Bundle (−18%), and Legacy Kit (−9%). Widget Pro saw the steepest drop starting in August.',
  },
  'Compare this quarter vs last quarter': {
    sql: 'SELECT quarter, SUM(revenue), COUNT(orders)\nFROM quarterly_summary\nWHERE quarter IN (\'Q3 2024\', \'Q4 2024\')\nGROUP BY quarter;',
    answer: 'Q4 revenue is $1.2M vs Q3\'s $1.05M — a 14.3% increase. Order volume grew 8% but average order value rose 6%, suggesting both volume and upsell improvements.',
  },
};

const START_HERE_CHIPS = Object.keys(MOCK_RESPONSES);

interface DemoState {
  question: string;
  sql: string;
  answer: string;
  visibleAnswer: string;
  phase: 'idle' | 'thinking' | 'sql' | 'streaming' | 'done';
}

function CommandBar({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div
      className="flex items-center px-3 py-2 rounded-full gap-2"
      style={{ background: '#1A1A1A', border: '1px solid #2A2A2A' }}
    >
      <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="#6A6A6A" viewBox="0 0 24 24" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 15.803a7.5 7.5 0 0010.607 10.607z" />
      </svg>
      <input
        className="flex-1 bg-transparent text-xs outline-none"
        style={{ color: '#F5F5F5' }}
        placeholder="Search or run a command…"
        value={value}
        onChange={e => onChange(e.target.value)}
      />
      <span
        className="text-[10px] px-1.5 py-0.5 rounded font-mono flex-shrink-0"
        style={{ border: '1px solid #2A2A2A', color: '#6A6A6A' }}
      >⌘K</span>
    </div>
  );
}

function TypingText({ text }: { text: string }) {
  const [visible, setVisible] = useState('');
  const idx = useRef(0);

  useEffect(() => {
    setVisible('');
    idx.current = 0;
    if (!text) return;
    const interval = setInterval(() => {
      idx.current++;
      setVisible(text.slice(0, idx.current));
      if (idx.current >= text.length) clearInterval(interval);
    }, 18);
    return () => clearInterval(interval);
  }, [text]);

  return (
    <span>
      {visible}
      {visible.length < text.length && (
        <motion.span
          animate={{ opacity: [1, 0] }}
          transition={{ duration: 0.5, repeat: Infinity }}
          style={{ display: 'inline-block', width: 2, height: '1em', background: '#A9C08E', marginLeft: 2, verticalAlign: 'text-bottom' }}
        />
      )}
    </span>
  );
}

export default function ProductPreview() {
  const [activeTab, setActiveTab] = useState('ask');
  const [demo, setDemo] = useState<DemoState>({
    question: '',
    sql: '',
    answer: '',
    visibleAnswer: '',
    phase: 'idle',
  });
  const [cmdValue, setCmdValue] = useState('');
  const answerStreamer = useRef<ReturnType<typeof setInterval> | null>(null);

  function runDemo(chip: string) {
    if (demo.phase !== 'idle' && demo.phase !== 'done') return;
    const resp = MOCK_RESPONSES[chip];
    if (!resp) return;

    if (answerStreamer.current) clearInterval(answerStreamer.current);

    setDemo({ question: chip, sql: '', answer: '', visibleAnswer: '', phase: 'thinking' });

    // thinking → sql after 600ms
    setTimeout(() => {
      setDemo(d => ({ ...d, sql: resp.sql, phase: 'sql' }));

      // sql → streaming answer after 800ms
      setTimeout(() => {
        setDemo(d => ({ ...d, answer: resp.answer, phase: 'streaming' }));

        // stream the answer character by character
        let i = 0;
        answerStreamer.current = setInterval(() => {
          i++;
          setDemo(d => ({ ...d, visibleAnswer: resp.answer.slice(0, i) }));
          if (i >= resp.answer.length) {
            clearInterval(answerStreamer.current!);
            setDemo(d => ({ ...d, phase: 'done' }));
          }
        }, 20);
      }, 800);
    }, 600);
  }

  function reset() {
    if (answerStreamer.current) clearInterval(answerStreamer.current);
    setDemo({ question: '', sql: '', answer: '', visibleAnswer: '', phase: 'idle' });
  }

  return (
    <section id="product" className="py-24 px-6" style={{ background: '#0A0A0A' }}>
      <div className="max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-10"
        >
          <p className="text-xs font-mono tracking-widest uppercase mb-3" style={{ color: '#A9C08E' }}>
            The product
          </p>
          <h2
            className="font-semibold tracking-tight mb-3"
            style={{ fontSize: 'clamp(1.5rem, 3vw, 2.2rem)', color: '#F5F5F5', letterSpacing: '-0.02em' }}
          >
            Talk to your data.
          </h2>
          <p className="text-sm max-w-md mx-auto" style={{ color: '#9A9A9A' }}>
            Click any question below to see SPARK in action.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="rounded-xl overflow-hidden"
          style={{ border: '1px solid #2A2A2A', background: '#141414' }}
        >
          {/* Window chrome */}
          <div
            className="flex items-center gap-2 px-4 py-3 border-b"
            style={{ borderColor: '#2A2A2A', background: '#0F0F0F' }}
          >
            <div className="w-3 h-3 rounded-full" style={{ background: '#3A3A3A' }} />
            <div className="w-3 h-3 rounded-full" style={{ background: '#3A3A3A' }} />
            <div className="w-3 h-3 rounded-full" style={{ background: '#3A3A3A' }} />
            <span className="ml-3 text-xs font-mono" style={{ color: '#6A6A6A' }}>SPARK — Ask</span>
            {demo.phase !== 'idle' && (
              <button
                onClick={reset}
                className="ml-auto text-[10px] font-mono px-2 py-0.5 rounded transition-colors"
                style={{ border: '1px solid #2A2A2A', color: '#6A6A6A' }}
                onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = '#F5F5F5')}
                onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = '#6A6A6A')}
              >
                reset
              </button>
            )}
          </div>

          {/* App body */}
          <div className="flex" style={{ minHeight: 460 }}>
            {/* Sidebar */}
            <div
              className="w-44 flex-shrink-0 flex flex-col py-3 border-r"
              style={{ borderColor: '#2A2A2A', background: '#0F0F0F' }}
            >
              <div className="px-4 pb-3 mb-2 border-b" style={{ borderColor: '#2A2A2A' }}>
                <div className="flex items-center gap-2">
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                    <line x1="8" y1="1" x2="8" y2="15" stroke="#A9C08E" strokeWidth="1.5" strokeLinecap="round" />
                    <line x1="1" y1="8" x2="15" y2="8" stroke="#A9C08E" strokeWidth="1.5" strokeLinecap="round" />
                    <line x1="2.8" y1="2.8" x2="13.2" y2="13.2" stroke="#A9C08E" strokeWidth="1" strokeLinecap="round" opacity="0.6" />
                    <line x1="13.2" y1="2.8" x2="2.8" y2="13.2" stroke="#A9C08E" strokeWidth="1" strokeLinecap="round" opacity="0.6" />
                  </svg>
                  <span className="text-xs font-semibold tracking-tight" style={{ color: '#F5F5F5' }}>
                    SPARK <span style={{ color: '#6A6A6A', fontWeight: 500 }}>Engine</span>
                  </span>
                </div>
              </div>

              {SIDEBAR_ITEMS.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className="relative flex items-center gap-2.5 px-4 py-2 text-xs w-full text-left transition-colors duration-100"
                  style={{
                    color: activeTab === item.id ? '#F5F5F5' : '#6A6A6A',
                    background: activeTab === item.id ? 'rgba(169,192,142,0.06)' : 'transparent',
                  }}
                >
                  {activeTab === item.id && (
                    <div
                      className="absolute left-0 top-1 bottom-1 w-0.5 rounded-full"
                      style={{ background: '#A9C08E' }}
                    />
                  )}
                  <span style={{ color: activeTab === item.id ? '#A9C08E' : '#6A6A6A' }}>
                    {item.icon}
                  </span>
                  {item.label}
                </button>
              ))}
            </div>

            {/* Main content */}
            <div className="flex-1 flex flex-col p-6 overflow-hidden">
              {activeTab === 'ask' && (
                <>
                  <AnimatePresence mode="wait">
                    {demo.phase === 'idle' ? (
                      <motion.div
                        key="idle"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex flex-col flex-1"
                      >
                        <h3
                          className="font-semibold tracking-tight mb-6"
                          style={{ fontSize: '1.5rem', color: '#F5F5F5', letterSpacing: '-0.02em' }}
                        >
                          Talk to your data.
                        </h3>

                        {/* Surprise me card */}
                        <div
                          className="rounded-lg p-4 mb-5 flex items-center gap-3 cursor-pointer transition-colors"
                          style={{ border: '1px solid #2A2A2A', background: '#1A1A1A' }}
                          onMouseEnter={e => ((e.currentTarget as HTMLElement).style.borderColor = 'rgba(169,192,142,0.3)')}
                          onMouseLeave={e => ((e.currentTarget as HTMLElement).style.borderColor = '#2A2A2A')}
                          onClick={() => runDemo(START_HERE_CHIPS[Math.floor(Math.random() * START_HERE_CHIPS.length)])}
                        >
                          <span style={{ color: '#A9C08E' }}>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                            </svg>
                          </span>
                          <div>
                            <p className="text-xs font-medium" style={{ color: '#F5F5F5' }}>Surprise me</p>
                            <p className="text-xs" style={{ color: '#6A6A6A' }}>Let SPARK pick an interesting question</p>
                          </div>
                        </div>

                        <p className="text-[10px] font-mono tracking-widest uppercase mb-3" style={{ color: '#6A6A6A' }}>
                          Start here
                        </p>
                        <div className="flex flex-col gap-2 flex-1">
                          {START_HERE_CHIPS.map((chip) => (
                            <button
                              key={chip}
                              onClick={() => runDemo(chip)}
                              className="text-left text-xs px-3 py-2 rounded-md transition-all duration-150"
                              style={{ border: '1px solid #2A2A2A', color: '#9A9A9A', background: 'transparent' }}
                              onMouseEnter={e => {
                                const el = e.currentTarget as HTMLElement;
                                el.style.borderColor = 'rgba(169,192,142,0.3)';
                                el.style.color = '#F5F5F5';
                                el.style.background = 'rgba(169,192,142,0.04)';
                              }}
                              onMouseLeave={e => {
                                const el = e.currentTarget as HTMLElement;
                                el.style.borderColor = '#2A2A2A';
                                el.style.color = '#9A9A9A';
                                el.style.background = 'transparent';
                              }}
                            >
                              {chip}
                            </button>
                          ))}
                        </div>
                      </motion.div>
                    ) : (
                      <motion.div
                        key="demo"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="flex flex-col flex-1 gap-4 overflow-auto"
                      >
                        {/* User question */}
                        <div className="flex justify-end">
                          <div
                            className="max-w-[75%] text-xs px-3 py-2 rounded-lg rounded-tr-sm"
                            style={{ background: 'rgba(169,192,142,0.12)', border: '1px solid rgba(169,192,142,0.2)', color: '#F5F5F5' }}
                          >
                            {demo.question}
                          </div>
                        </div>

                        {/* Thinking indicator */}
                        {demo.phase === 'thinking' && (
                          <div className="flex items-center gap-2">
                            <div className="flex gap-1">
                              {[0, 1, 2].map(i => (
                                <motion.div
                                  key={i}
                                  className="w-1.5 h-1.5 rounded-full"
                                  style={{ background: '#A9C08E' }}
                                  animate={{ opacity: [0.2, 1, 0.2] }}
                                  transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.2 }}
                                />
                              ))}
                            </div>
                            <span className="text-xs" style={{ color: '#6A6A6A' }}>Writing SQL…</span>
                          </div>
                        )}

                        {/* SQL block */}
                        {(demo.phase === 'sql' || demo.phase === 'streaming' || demo.phase === 'done') && demo.sql && (
                          <motion.div
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="rounded-md overflow-hidden"
                            style={{ border: '1px solid #2A2A2A' }}
                          >
                            <div
                              className="flex items-center gap-2 px-3 py-1.5"
                              style={{ background: '#0F0F0F', borderBottom: '1px solid #2A2A2A' }}
                            >
                              <svg className="w-3 h-3" fill="none" stroke="#A9C08E" viewBox="0 0 24 24" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
                              </svg>
                              <span className="text-[10px] font-mono" style={{ color: '#6A6A6A' }}>Generated SQL</span>
                            </div>
                            <pre
                              className="text-[11px] font-mono p-3 overflow-x-auto leading-relaxed"
                              style={{ background: '#1A1A1A', color: '#A9C08E', margin: 0 }}
                            >
                              {demo.sql}
                            </pre>
                          </motion.div>
                        )}

                        {/* Streaming answer */}
                        {(demo.phase === 'streaming' || demo.phase === 'done') && (
                          <motion.div
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="text-xs leading-relaxed rounded-lg px-3 py-2.5"
                            style={{ background: '#1A1A1A', border: '1px solid #2A2A2A', color: '#F5F5F5' }}
                          >
                            <TypingText text={demo.answer} />
                          </motion.div>
                        )}

                        {/* Ask another */}
                        {demo.phase === 'done' && (
                          <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="flex flex-wrap gap-2 mt-1"
                          >
                            {START_HERE_CHIPS.filter(c => c !== demo.question).map(chip => (
                              <button
                                key={chip}
                                onClick={() => runDemo(chip)}
                                className="text-[11px] px-2.5 py-1 rounded-md transition-colors"
                                style={{ border: '1px solid #2A2A2A', color: '#6A6A6A', background: 'transparent' }}
                                onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.color = '#F5F5F5'; el.style.borderColor = '#3A3A3A'; }}
                                onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.color = '#6A6A6A'; el.style.borderColor = '#2A2A2A'; }}
                              >
                                {chip}
                              </button>
                            ))}
                          </motion.div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Command bar */}
                  <div className="mt-5">
                    <CommandBar value={cmdValue} onChange={setCmdValue} />
                  </div>
                </>
              )}

              {activeTab === 'data' && (
                <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
                  <svg className="w-10 h-10" fill="none" stroke="#2A2A2A" viewBox="0 0 24 24" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 5.625c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
                  </svg>
                  <p className="font-medium text-sm" style={{ color: '#F5F5F5' }}>No data connected yet</p>
                  <p className="text-xs max-w-xs" style={{ color: '#6A6A6A' }}>Connect a CSV, database, or paste a query to get started.</p>
                  <button className="text-xs px-4 py-2 rounded-md font-medium" style={{ background: '#A9C08E', color: '#0A0A0A' }}>
                    Connect data
                  </button>
                </div>
              )}

              {(activeTab === 'explore' || activeTab === 'conversations') && (
                <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
                  <p className="font-medium text-sm" style={{ color: '#F5F5F5' }}>
                    {activeTab === 'explore' ? 'Nothing to explore yet' : 'No conversations yet'}
                  </p>
                  <p className="text-xs" style={{ color: '#6A6A6A' }}>
                    Ask a question first.
                  </p>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
