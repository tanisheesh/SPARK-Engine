'use client';

import { useRef, useCallback } from 'react';
import { motion, useSpring } from 'framer-motion';

interface Props {
  children: React.ReactNode;
  strength?: number; // how far it moves (0–1), default 0.38
}

/**
 * Wraps any button/link. When the cursor is over it, the element
 * smoothly follows the cursor like a magnet. Snaps back on leave.
 *
 * Usage:
 *   <MagneticButton>
 *     <a href="#cta" className="...">Get SPARK</a>
 *   </MagneticButton>
 */
export default function MagneticButton({ children, strength = 0.38 }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const x = useSpring(0, { stiffness: 280, damping: 22 });
  const y = useSpring(0, { stiffness: 280, damping: 22 });

  const onMove = useCallback((e: React.MouseEvent) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    x.set((e.clientX - rect.left - rect.width  / 2) * strength);
    y.set((e.clientY - rect.top  - rect.height / 2) * strength);
  }, [x, y, strength]);

  const onLeave = useCallback(() => {
    x.set(0);
    y.set(0);
  }, [x, y]);

  return (
    <motion.div
      ref={ref}
      style={{ x, y, display: 'inline-block' }}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
    >
      {children}
    </motion.div>
  );
}
