'use client';

import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';

/**
 * Blur-to-sharp focus reveal on scroll entry.
 * Drops in from slightly below, blurred → crisp.
 * Same interface as before — just swap the implementation.
 */
export default function ScrambleText({ text, delay = 0 }: { text: string; delay?: number }) {
  const ref    = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: '-8% 0px' });

  return (
    <motion.span
      ref={ref}
      style={{ display: 'inline-block' }}
      initial={{ opacity: 0, y: 14, filter: 'blur(10px)' }}
      animate={inView
        ? { opacity: 1, y: 0, filter: 'blur(0px)' }
        : { opacity: 0, y: 14, filter: 'blur(10px)' }
      }
      transition={{ duration: 0.75, delay, ease: [0.16, 1, 0.3, 1] as const }}
    >
      {text}
    </motion.span>
  );
}
