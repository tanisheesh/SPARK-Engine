'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';

function Word({ word }: { word: string }) {
  const [active, setActive] = useState(false);

  return (
    <motion.span
      style={{ display: 'inline-block', position: 'relative', cursor: 'default' }}
      animate={{
        y: active ? -2 : 0,
        filter: active ? 'brightness(1.4)' : 'brightness(1)',
      }}
      transition={{ duration: 0.12, ease: 'easeOut' }}
      onMouseEnter={() => setActive(true)}
      onMouseLeave={() => setActive(false)}
    >
      {/* Selection / illumination glow behind the word */}
      <motion.span
        aria-hidden
        style={{
          position: 'absolute',
          inset: '-2px -5px',
          borderRadius: 5,
          background: 'rgba(169,192,142,0.14)',
          boxShadow: '0 0 14px 4px rgba(169,192,142,0.10)',
          zIndex: -1,
          pointerEvents: 'none',
        }}
        initial={{ opacity: 0, scale: 0.85 }}
        animate={{ opacity: active ? 1 : 0, scale: active ? 1 : 0.85 }}
        transition={{ duration: 0.12 }}
      />
      {word}
    </motion.span>
  );
}

interface Props {
  text: string;
}

/**
 * Drop-in replacement for inline text — splits into words that
 * each light up individually as the cursor passes through them.
 *
 * Usage (preserves parent tag + styles):
 *   <h2 className="..."><AnimatedWords text="Hello world" /></h2>
 */
export default function AnimatedWords({ text }: Props) {
  const words = text.split(' ');
  return (
    <>
      {words.map((word, i) => (
        <span key={i} style={{ display: 'inline' }}>
          <Word word={word} />
          {i < words.length - 1 && ' '}
        </span>
      ))}
    </>
  );
}
