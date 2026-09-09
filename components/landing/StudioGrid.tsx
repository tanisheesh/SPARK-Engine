'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import ScrambleText from './ScrambleText';

const CATEGORIES = [
  {
    id: 'analyze',
    label: 'Analyze',
    items: [
      { label: 'Chart', soon: false },
      { label: 'Key Insights', soon: false },
      { label: 'Deep Dive', soon: false },
      { label: 'Find Anomalies', soon: false },
    ],
  },
  {
    id: 'explore',
    label: 'Explore',
    items: [
      { label: 'Breakdown', soon: false },
      { label: 'Compare', soon: false },
      { label: 'Forecast', soon: true },
      { label: 'Data Map', soon: true },
    ],
  },
  {
    id: 'create',
    label: 'Create',
    items: [
      { label: 'Dashboard', soon: true },
      { label: 'Report', soon: true },
      { label: 'Data Table', soon: false },
      { label: 'SQL', soon: false },
    ],
  },
];

function StudioItem({ label, soon }: { label: string; soon: boolean }) {
  const [hovered, setHovered] = useState(false);
  return (
    <motion.div
      className="flex items-center justify-between px-3 py-2.5 rounded-md relative overflow-hidden cursor-default"
      style={{
        border: `1px solid ${hovered ? 'rgba(169,192,142,0.25)' : '#2A2A2A'}`,
        background: hovered ? 'rgba(169,192,142,0.05)' : '#1A1A1A',
        transition: 'border-color 0.15s, background 0.15s',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Left indicator bar */}
      <motion.div
        style={{
          position: 'absolute', left: 0, top: '20%', bottom: '20%',
          width: 2, borderRadius: 2,
          background: '#A9C08E',
        }}
        initial={{ scaleY: 0, opacity: 0 }}
        animate={{ scaleY: hovered ? 1 : 0, opacity: hovered ? 1 : 0 }}
        transition={{ duration: 0.15 }}
      />
      <motion.span
        className="text-xs pl-1"
        animate={{ color: hovered ? '#F5F5F5' : soon ? '#6A6A6A' : '#C8C8C8' }}
        transition={{ duration: 0.15 }}
      >
        {label}
      </motion.span>
      {soon && (
        <span
          className="text-[9px] font-mono tracking-widest uppercase px-1.5 py-0.5 rounded"
          style={{ border: '1px solid #2A2A2A', color: '#6A6A6A' }}
        >
          soon
        </span>
      )}
    </motion.div>
  );
}

function StudioCard({ cat, index }: { cat: typeof CATEGORIES[number]; index: number }) {
  const [hovered, setHovered] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4, delay: index * 0.1 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        borderRadius: 12,
        padding: 24,
        display: 'flex',
        flexDirection: 'column',
        gap: 20,
        border: `1px solid ${hovered ? 'rgba(169,192,142,0.25)' : '#2A2A2A'}`,
        background: hovered ? 'rgba(169,192,142,0.025)' : '#0F0F0F',
        boxShadow: hovered ? '0 0 40px -10px rgba(169,192,142,0.15)' : 'none',
        transition: 'border-color 0.25s, background 0.25s, box-shadow 0.25s',
      }}
    >
      <motion.p
        className="text-xs font-mono tracking-widest uppercase"
        animate={{ color: hovered ? '#C8DEB0' : '#A9C08E' }}
        transition={{ duration: 0.2 }}
      >
        {cat.label}
      </motion.p>
      <div className="flex flex-col gap-2">
        {cat.items.map((item) => (
          <StudioItem key={item.label} label={item.label} soon={item.soon} />
        ))}
      </div>
    </motion.div>
  );
}

export default function StudioGrid() {
  return (
    <section className="py-24 px-6" style={{ background: '#141414' }}>
      <div className="max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <p className="text-xs font-mono tracking-widest uppercase mb-3" style={{ color: '#A9C08E' }}>
            Studio
          </p>
          <h2
            className="font-semibold tracking-tight mb-3"
            style={{ fontSize: 'clamp(1.5rem, 3vw, 2.2rem)', color: '#F5F5F5', letterSpacing: '-0.02em' }}
          >
            <ScrambleText text="Every type of analysis, built in." delay={0.2} />
          </h2>
          <p className="text-sm max-w-md mx-auto" style={{ color: '#9A9A9A' }}>
            Once SPARK answers your question, the Studio lets you go further — right from the same interface.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {CATEGORIES.map((cat, ci) => (
            <StudioCard key={cat.id} cat={cat} index={ci} />
          ))}
        </div>
      </div>
    </section>
  );
}
