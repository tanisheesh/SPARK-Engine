'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';

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

const START_HERE_CHIPS = [
  'What are my top 5 customers by revenue?',
  'Show me monthly trends for the last year',
  'Which products have declining sales?',
  'Compare this quarter vs last quarter',
];

function CommandBar() {
  return (
    <div
      className="flex items-center px-3 py-2 rounded-full gap-2"
      style={{ background: '#1A1A1A', border: '1px solid #2A2A2A' }}
    >
      <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="#6A6A6A" viewBox="0 0 24 24" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 15.803a7.5 7.5 0 0010.607 10.607z" />
      </svg>
      <span className="flex-1 text-xs" style={{ color: '#6A6A6A' }}>Search or run a command…</span>
      <span
        className="text-[10px] px-1.5 py-0.5 rounded font-mono flex-shrink-0"
        style={{ border: '1px solid #2A2A2A', color: '#6A6A6A' }}
      >⌘K</span>
    </div>
  );
}

export default function ProductPreview() {
  const [activeTab, setActiveTab] = useState('ask');

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
            The actual interface — no mockups, no placeholders.
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
          </div>

          {/* App body */}
          <div className="flex" style={{ minHeight: 420 }}>
            {/* Sidebar */}
            <div
              className="w-44 flex-shrink-0 flex flex-col py-3 border-r"
              style={{ borderColor: '#2A2A2A', background: '#0F0F0F' }}
            >
              {/* Top: logo mark */}
              <div className="px-4 pb-3 mb-2 border-b" style={{ borderColor: '#2A2A2A' }}>
                <div className="flex items-center gap-2">
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                    <line x1="8" y1="1" x2="8" y2="15" stroke="#A9C08E" strokeWidth="1.5" strokeLinecap="round" />
                    <line x1="1" y1="8" x2="15" y2="8" stroke="#A9C08E" strokeWidth="1.5" strokeLinecap="round" />
                    <line x1="2.8" y1="2.8" x2="13.2" y2="13.2" stroke="#A9C08E" strokeWidth="1" strokeLinecap="round" opacity="0.6" />
                    <line x1="13.2" y1="2.8" x2="2.8" y2="13.2" stroke="#A9C08E" strokeWidth="1" strokeLinecap="round" opacity="0.6" />
                  </svg>
                  <span className="text-xs font-semibold tracking-tight" style={{ color: '#F5F5F5' }}>SPARK</span>
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
                  {/* Thin left accent bar for active */}
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
            <div className="flex-1 flex flex-col p-6">
              {activeTab === 'ask' && (
                <>
                  {/* Heading */}
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

                  {/* START HERE */}
                  <p className="text-[10px] font-mono tracking-widest uppercase mb-3" style={{ color: '#6A6A6A' }}>
                    Start here
                  </p>
                  <div className="flex flex-col gap-2 flex-1">
                    {START_HERE_CHIPS.map((chip) => (
                      <button
                        key={chip}
                        className="text-left text-xs px-3 py-2 rounded-md transition-colors"
                        style={{ border: '1px solid #2A2A2A', color: '#9A9A9A', background: 'transparent' }}
                        onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = '#3A3A3A'; el.style.color = '#F5F5F5'; el.style.background = '#1A1A1A'; }}
                        onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = '#2A2A2A'; el.style.color = '#9A9A9A'; el.style.background = 'transparent'; }}
                      >
                        {chip}
                      </button>
                    ))}
                  </div>

                  {/* Command bar */}
                  <div className="mt-5">
                    <CommandBar />
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
