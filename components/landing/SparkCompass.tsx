'use client';

import { motion } from 'framer-motion';

const CX = 200;
const CY = 200;

function pt(angleDeg: number, r: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180; // -90 so 0° = top (North)
  return { x: CX + Math.cos(rad) * r, y: CY + Math.sin(rad) * r };
}

function diamondPath(angleDeg: number, len: number, halfWidth: number) {
  const tip = pt(angleDeg, len);
  const left = pt(angleDeg - 90, halfWidth);
  const right = pt(angleDeg + 90, halfWidth);
  const base = pt(angleDeg, halfWidth * 0.4);
  return `M ${tip.x} ${tip.y} L ${left.x} ${left.y} L ${base.x} ${base.y} L ${right.x} ${right.y} Z`;
}

// Cardinal spokes: N, E, S, W
const CARDINAL = [0, 90, 180, 270];
// Diagonal spokes: NE, SE, SW, NW
const DIAGONAL = [45, 135, 225, 315];
// Minor spokes: halfway between diagonals
const MINOR = [22.5, 67.5, 112.5, 157.5, 202.5, 247.5, 292.5, 337.5];

export default function SparkCompass({ size = 420 }: { size?: number }) {
  return (
    <div className="relative" style={{ width: size, height: size }}>
      {/* Ambient glow behind the compass */}
      <motion.div
        className="absolute inset-0 rounded-full pointer-events-none"
        style={{
          background: 'radial-gradient(circle at 50% 50%, rgba(217,119,6,0.18) 0%, rgba(139,92,246,0.08) 40%, transparent 70%)',
          filter: 'blur(20px)',
        }}
        animate={{ opacity: [0.7, 1, 0.7] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
      />

      <motion.svg
        viewBox="0 0 400 400"
        width={size}
        height={size}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        animate={{ rotate: [0, 360] }}
        transition={{ duration: 120, repeat: Infinity, ease: 'linear' }}
        style={{ position: 'absolute', inset: 0 }}
      >
        {/* Concentric reference rings */}
        {[60, 100, 145, 178].map((r) => (
          <circle
            key={r}
            cx={CX} cy={CY} r={r}
            stroke="rgba(217,119,6,0.06)"
            strokeWidth="0.8"
            strokeDasharray="2 4"
          />
        ))}

        {/* Minor spokes — thin, short, muted purple */}
        {MINOR.map((a) => {
          const end = pt(a, 72);
          return (
            <line
              key={`minor-${a}`}
              x1={CX} y1={CY}
              x2={end.x} y2={end.y}
              stroke="rgba(139,92,246,0.22)"
              strokeWidth="0.9"
              strokeLinecap="round"
            />
          );
        })}

        {/* Diagonal spokes — medium, orange-tinted */}
        {DIAGONAL.map((a) => {
          const end = pt(a, 108);
          return (
            <g key={`diag-${a}`}>
              <line
                x1={CX} y1={CY}
                x2={end.x} y2={end.y}
                stroke="rgba(217,119,6,0.28)"
                strokeWidth="1.4"
                strokeLinecap="round"
              />
              {/* Small diamond tip on diagonal */}
              <path
                d={diamondPath(a, 110, 4)}
                fill="rgba(217,119,6,0.35)"
              />
            </g>
          );
        })}

        {/* Cardinal spokes — main, bright orange, with bold diamond tips */}
        {CARDINAL.map((a) => {
          const end = pt(a, 158);
          return (
            <g key={`card-${a}`}>
              {/* Glow layer */}
              <line
                x1={CX} y1={CY}
                x2={end.x} y2={end.y}
                stroke="rgba(217,119,6,0.12)"
                strokeWidth="10"
                strokeLinecap="round"
              />
              {/* Solid line */}
              <line
                x1={CX} y1={CY}
                x2={end.x} y2={end.y}
                stroke="rgba(217,119,6,0.75)"
                strokeWidth="2"
                strokeLinecap="round"
              />
              {/* Bold diamond tip */}
              <path
                d={diamondPath(a, 162, 9)}
                fill="#D97706"
                opacity="0.9"
              />
            </g>
          );
        })}
      </motion.svg>

      {/* Center spark — does NOT rotate */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        {/* Outer pulse rings */}
        {[1, 2, 3].map((i) => (
          <motion.div
            key={i}
            className="absolute rounded-full"
            style={{ border: '1px solid rgba(217,119,6,0.25)' }}
            animate={{ width: [24, 80], height: [24, 80], opacity: [0.6, 0] }}
            transition={{ duration: 2.5, repeat: Infinity, delay: i * 0.7, ease: 'easeOut' }}
          />
        ))}
        {/* Core glow */}
        <motion.div
          className="absolute rounded-full"
          style={{ width: 36, height: 36, background: 'radial-gradient(circle, rgba(217,119,6,0.6) 0%, rgba(139,92,246,0.2) 60%, transparent 100%)' }}
          animate={{ scale: [1, 1.25, 1] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        />
        {/* Bright center dot */}
        <div
          className="relative rounded-full"
          style={{ width: 10, height: 10, background: '#D97706', boxShadow: '0 0 12px 4px rgba(217,119,6,0.7)' }}
        />
      </div>
    </div>
  );
}
