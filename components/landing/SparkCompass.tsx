'use client';

import { useEffect, useRef } from 'react';
import { motion, useAnimation, useReducedMotion } from 'framer-motion';

const CX = 200;
const CY = 200;

function pt(angleDeg: number, r: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: CX + Math.cos(rad) * r, y: CY + Math.sin(rad) * r };
}

function spokePath(angleDeg: number, length: number) {
  const end = pt(angleDeg, length);
  return `M ${CX} ${CY} L ${end.x} ${end.y}`;
}

const CARDINAL  = [0, 90, 180, 270];
const DIAGONAL  = [45, 135, 225, 315];
const MINOR     = [22.5, 67.5, 112.5, 157.5, 202.5, 247.5, 292.5, 337.5];

interface Props {
  size?: number;
  /** If true, plays the draw-in reveal sequence. Default false = just idle. */
  animate?: boolean;
}

export default function SparkCompass({ size = 400, animate: doAnimate = true }: Props) {
  const prefersReduced = useReducedMotion();

  const cardinalCtrl = useAnimation();
  const diagCtrl     = useAnimation();
  const minorCtrl    = useAnimation();
  const centerCtrl   = useAnimation();
  const breathCtrl   = useAnimation();

  useEffect(() => {
    if (prefersReduced || !doAnimate) {
      // Static state
      cardinalCtrl.set({ pathLength: 1, opacity: 0.9 });
      diagCtrl.set({ pathLength: 1, opacity: 0.45 });
      minorCtrl.set({ pathLength: 1, opacity: 0.2 });
      centerCtrl.set({ scale: 1, opacity: 1 });
      return;
    }

    async function sequence() {
      // 1. Cardinal spokes draw in
      await cardinalCtrl.start({
        pathLength: 1,
        opacity: 0.9,
        transition: { duration: 1.2, ease: [0.16, 1, 0.3, 1] },
      });
      // 2. Diagonal spokes
      diagCtrl.start({
        pathLength: 1,
        opacity: 0.45,
        transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] },
      });
      // 3. Minor spokes
      minorCtrl.start({
        pathLength: 1,
        opacity: 0.18,
        transition: { duration: 0.6, ease: 'easeOut' },
      });
      // 4. Center spark
      centerCtrl.start({
        scale: 1,
        opacity: 1,
        transition: { duration: 0.4, ease: 'easeOut' },
      });

      // 5. Idle breathing loop
      await new Promise(r => setTimeout(r, 400));
      breathCtrl.start({
        opacity: [0.85, 1, 0.85],
        transition: { duration: 4, ease: 'easeInOut', repeat: Infinity },
      });
    }

    sequence();
  }, [prefersReduced, doAnimate, cardinalCtrl, diagCtrl, minorCtrl, centerCtrl, breathCtrl]);

  const GLOW = 'rgba(169,192,142,0.55)';

  return (
    <div style={{ width: size, height: size, position: 'relative' }}>
      {/* Radial bloom */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          background: 'radial-gradient(circle at 50% 50%, rgba(169,192,142,0.09) 0%, transparent 65%)',
          filter: 'blur(24px)',
          pointerEvents: 'none',
        }}
      />

      <motion.svg
        viewBox="0 0 400 400"
        width={size}
        height={size}
        fill="none"
        style={{ position: 'absolute', inset: 0 }}
        animate={breathCtrl}
      >
        {/* Concentric reference rings */}
        {[60, 105, 155, 185].map((r) => (
          <circle
            key={r}
            cx={CX} cy={CY} r={r}
            stroke="rgba(169,192,142,0.06)"
            strokeWidth="0.6"
            strokeDasharray="3 5"
          />
        ))}

        {/* Minor spokes — thin, very muted */}
        {MINOR.map((a) => (
          <motion.path
            key={`m${a}`}
            d={spokePath(a, 68)}
            stroke={GLOW}
            strokeWidth="0.8"
            strokeLinecap="round"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={minorCtrl}
          />
        ))}

        {/* Diagonal spokes — medium */}
        {DIAGONAL.map((a) => (
          <motion.path
            key={`d${a}`}
            d={spokePath(a, 110)}
            stroke="#A9C08E"
            strokeWidth="1.2"
            strokeLinecap="round"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={diagCtrl}
          />
        ))}

        {/* Cardinal spokes — main, bright, with glow layer */}
        {CARDINAL.map((a) => (
          <g key={`c${a}`}>
            {/* glow */}
            <motion.path
              d={spokePath(a, 165)}
              stroke="rgba(169,192,142,0.18)"
              strokeWidth="8"
              strokeLinecap="round"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={cardinalCtrl}
            />
            {/* solid */}
            <motion.path
              d={spokePath(a, 165)}
              stroke="#A9C08E"
              strokeWidth="1.6"
              strokeLinecap="round"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={cardinalCtrl}
            />
            {/* tip diamond */}
            <motion.path
              d={(() => {
                const tip  = pt(a, 170);
                const l    = pt(a - 90, 6);
                const r2   = pt(a + 90, 6);
                const base = pt(a, 152);
                return `M ${tip.x} ${tip.y} L ${l.x} ${l.y} L ${base.x} ${base.y} L ${r2.x} ${r2.y} Z`;
              })()}
              fill="#A9C08E"
              initial={{ opacity: 0 }}
              animate={cardinalCtrl}
            />
          </g>
        ))}
      </motion.svg>

      {/* Center spark — static, doesn't rotate */}
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
        {[1, 2, 3].map((i) => (
          <motion.div
            key={i}
            style={{
              position: 'absolute',
              borderRadius: '50%',
              border: '1px solid rgba(169,192,142,0.3)',
            }}
            animate={doAnimate && !prefersReduced ? { width: [20, 64], height: [20, 64], opacity: [0.5, 0] } : { width: 20, height: 20, opacity: 0.15 }}
            transition={{ duration: 2.5, repeat: Infinity, delay: i * 0.75, ease: 'easeOut' }}
          />
        ))}
        <motion.div
          style={{
            position: 'absolute',
            width: 32, height: 32,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(169,192,142,0.5) 0%, transparent 70%)',
          }}
          animate={doAnimate && !prefersReduced ? { scale: [1, 1.3, 1] } : { scale: 1 }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          initial={{ scale: 0, opacity: 0 }}
        />
        <motion.div
          style={{
            position: 'relative',
            width: 7, height: 7,
            borderRadius: '50%',
            background: '#A9C08E',
            boxShadow: '0 0 10px 3px rgba(169,192,142,0.6)',
          }}
          initial={{ scale: 0, opacity: 0 }}
          animate={centerCtrl}
        />
      </div>
    </div>
  );
}
