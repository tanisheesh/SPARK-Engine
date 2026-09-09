'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  motion,
  useAnimation,
  useReducedMotion,
  useMotionValue,
  useSpring,
  useTransform,
  AnimatePresence,
} from 'framer-motion';

// ── SVG helpers ───────────────────────────────────────────────────────────────
const CX = 200;
const CY = 200;

function pt(angleDeg: number, r: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: CX + Math.cos(rad) * r, y: CY + Math.sin(rad) * r };
}
function spokePath(a: number, len: number) {
  const end = pt(a, len);
  return `M ${CX} ${CY} L ${end.x} ${end.y}`;
}
function diamondPath(a: number, tipLen: number, baseLen: number, halfW: number) {
  const tip = pt(a, tipLen), l = pt(a - 90, halfW), r2 = pt(a + 90, halfW), base = pt(a, baseLen);
  return `M ${tip.x} ${tip.y} L ${l.x} ${l.y} L ${base.x} ${base.y} L ${r2.x} ${r2.y} Z`;
}

const CARDINAL  = [0, 90, 180, 270];
const DIAGONAL  = [45, 135, 225, 315];
const MINOR     = [22.5, 67.5, 112.5, 157.5, 202.5, 247.5, 292.5, 337.5];
const ALL_ANGLES = [...CARDINAL, ...DIAGONAL, ...MINOR];

function nearestAngle(cursor: number) {
  let best = ALL_ANGLES[0], bestDist = 360;
  for (const a of ALL_ANGLES) {
    const d = Math.min(Math.abs(cursor - a), 360 - Math.abs(cursor - a));
    if (d < bestDist) { bestDist = d; best = a; }
  }
  return { angle: best, dist: bestDist };
}

// ── Deterministic particles (no Math.random to avoid hydration mismatch) ─────
const PARTICLES = Array.from({ length: 14 }, (_, i) => {
  const angle = (i / 14) * 360;
  const dist  = 55 + (i % 5) * 16;
  const rad   = ((angle - 90) * Math.PI) / 180;
  return {
    tx:    Math.round(Math.cos(rad) * dist * 100) / 100,
    ty:    Math.round(Math.sin(rad) * dist * 100) / 100,
    delay: i * 0.32,
    dur:   2.6 + (i % 4) * 0.65,
    size:  i % 3 === 0 ? 3 : 2,
  };
});

// ── Gyroscope ring ────────────────────────────────────────────────────────────
function GeoRing({
  containerSize, sizeFrac, rotX = 0, rotY = 0,
  spinDur, spinDir = 1, opacity, zOffset = 0,
}: {
  containerSize: number; sizeFrac: number; rotX?: number; rotY?: number;
  spinDur: number; spinDir?: 1 | -1; opacity: number; zOffset?: number;
}) {
  const ringPx = containerSize * sizeFrac;
  const off    = (containerSize - ringPx) / 2;
  return (
    <motion.div
      style={{
        position: 'absolute', width: ringPx, height: ringPx, left: off, top: off,
        borderRadius: '50%',
        border: `1px solid rgba(169,192,142,${opacity})`,
        rotateX: rotX, rotateY: rotY, translateZ: zOffset,
        pointerEvents: 'none',
      }}
      animate={{ rotateZ: spinDir > 0 ? 360 : -360 }}
      transition={{ duration: spinDur, repeat: Infinity, ease: 'linear' }}
    />
  );
}

// ── Ambient particle ──────────────────────────────────────────────────────────
function Particle({ tx, ty, delay, dur, sz, scale }: {
  tx: number; ty: number; delay: number; dur: number; sz: number; scale: number;
}) {
  return (
    <motion.div
      style={{
        position: 'absolute', left: '50%', top: '50%',
        width: sz, height: sz, marginLeft: -sz / 2, marginTop: -sz / 2,
        borderRadius: '50%', background: '#A9C08E',
        boxShadow: '0 0 4px 2px rgba(169,192,142,0.5)',
        pointerEvents: 'none',
      }}
      animate={{
        x: [0, tx * scale], y: [0, ty * scale],
        opacity: [0, 0.85, 0],
        scale: [0, 1.3, 0],
      }}
      transition={{ duration: dur, repeat: Infinity, delay, ease: [0.2, 0, 0.8, 1] }}
    />
  );
}

// ── Main component ────────────────────────────────────────────────────────────
interface ClickPulse { id: number; x: number; y: number }

interface Props {
  size?: number;
  animate?: boolean;
  interactive?: boolean;
}

export default function SparkCompass({
  size = 400,
  animate: doAnimate = true,
  interactive = true,
}: Props) {
  const prefersReduced = useReducedMotion();

  // Draw-in controllers (unchanged from original)
  const cardinalCtrl = useAnimation();
  const diagCtrl     = useAnimation();
  const minorCtrl    = useAnimation();
  const centerCtrl   = useAnimation();
  const breathCtrl   = useAnimation();

  // 3D tilt — stronger at ±20°
  const containerRef = useRef<HTMLDivElement>(null);
  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);
  const rotateY = useSpring(useTransform(rawX, [-0.5, 0.5], [-20, 20]), { stiffness: 90, damping: 20 });
  const rotateX = useSpring(useTransform(rawY, [-0.5, 0.5], [20, -20]), { stiffness: 90, damping: 20 });

  // Cursor light inside compass (useMotionValue = no re-render on move)
  const localX = useMotionValue(size / 2);
  const localY = useMotionValue(size / 2);

  // Hover / spoke highlight
  const [hovered, setHovered]             = useState(false);
  const [highlightAngle, setHighlightAngle] = useState<number | null>(null);

  // Click pulses
  const [pulses, setPulses] = useState<ClickPulse[]>([]);
  const pulseId = useRef(0);

  // ── Draw-in sequence ────────────────────────────────────────────────────────
  useEffect(() => {
    if (prefersReduced || !doAnimate) {
      cardinalCtrl.set({ pathLength: 1, opacity: 0.9 });
      diagCtrl.set({ pathLength: 1, opacity: 0.45 });
      minorCtrl.set({ pathLength: 1, opacity: 0.18 });
      centerCtrl.set({ scale: 1, opacity: 1 });
      return;
    }
    async function sequence() {
      await cardinalCtrl.start({ pathLength: 1, opacity: 0.9, transition: { duration: 1.2, ease: [0.16, 1, 0.3, 1] } });
      diagCtrl.start({ pathLength: 1, opacity: 0.45, transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] } });
      minorCtrl.start({ pathLength: 1, opacity: 0.18, transition: { duration: 0.6, ease: 'easeOut' } });
      centerCtrl.start({ scale: 1, opacity: 1, transition: { duration: 0.4, ease: 'easeOut' } });
      await new Promise(r => setTimeout(r, 400));
      breathCtrl.start({ opacity: [0.85, 1, 0.85], transition: { duration: 4, ease: 'easeInOut', repeat: Infinity } });
    }
    sequence();
  }, [prefersReduced, doAnimate, cardinalCtrl, diagCtrl, minorCtrl, centerCtrl, breathCtrl]);

  // ── Mouse handlers ──────────────────────────────────────────────────────────
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const cx   = rect.left + rect.width / 2;
    const cy   = rect.top  + rect.height / 2;

    rawX.set((e.clientX - cx) / rect.width);
    rawY.set((e.clientY - cy) / rect.height);

    // Cursor light — direct MotionValue update, zero re-renders
    localX.set(e.clientX - rect.left);
    localY.set(e.clientY - rect.top);

    // Spoke highlight
    const dx = e.clientX - cx, dy = e.clientY - cy;
    const angle = ((Math.atan2(dx, -dy) * 180) / Math.PI + 360) % 360;
    const { angle: near, dist } = nearestAngle(angle);
    setHighlightAngle(dist < 22 ? near : null);
  }, [rawX, rawY, localX, localY]);

  const handleMouseLeave = useCallback(() => {
    rawX.set(0); rawY.set(0);
    setHovered(false); setHighlightAngle(null);
  }, [rawX, rawY]);

  const handleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const id   = pulseId.current++;
    setPulses(prev => [...prev, { id, x: e.clientX - rect.left, y: e.clientY - rect.top }]);
    setTimeout(() => setPulses(prev => prev.filter(p => p.id !== id)), 1400);
  }, []);

  const isActive     = interactive && !prefersReduced;
  const showParticles = doAnimate && interactive && !prefersReduced;
  const GLOW         = 'rgba(169,192,142,0.55)';

  const hlIsCardinal = highlightAngle !== null && CARDINAL.includes(highlightAngle);
  const hlIsDiagonal = highlightAngle !== null && DIAGONAL.includes(highlightAngle);
  const hlIsMinor    = highlightAngle !== null && MINOR.includes(highlightAngle);

  // Scale for particles relative to compass size
  const pScale = size / 400;

  return (
    <div
      ref={containerRef}
      style={{
        width: size, height: size, position: 'relative',
        cursor: isActive ? 'crosshair' : 'default',
        // CSS perspective gives 3D depth to ALL children
        perspective: 900,
      }}
      onMouseMove={isActive ? handleMouseMove : undefined}
      onMouseEnter={isActive ? () => setHovered(true) : undefined}
      onMouseLeave={isActive ? handleMouseLeave : undefined}
      onClick={isActive ? handleClick : undefined}
    >
      {/* ── 3D tilt wrapper — everything inside tilts with cursor ─────────── */}
      <motion.div
        style={{
          width: '100%', height: '100%', position: 'relative',
          rotateX: isActive ? rotateX : 0,
          rotateY: isActive ? rotateY : 0,
          // preserve-3d makes children render in the same 3D scene
          transformStyle: 'preserve-3d',
        }}
      >
        {/* Outer ambient bloom */}
        <div
          style={{
            position: 'absolute', inset: 0, borderRadius: '50%',
            background: 'radial-gradient(circle at 50% 50%, rgba(169,192,142,0.11) 0%, transparent 65%)',
            filter: `blur(${hovered ? 32 : 22}px)`,
            opacity: hovered ? 1 : 0.85,
            pointerEvents: 'none',
            transition: 'filter 0.4s, opacity 0.4s',
          }}
        />

        {/* ── Armillary / gyroscope rings ──────────────────────────────────── */}
        {/* Equatorial — barely visible flat ring */}
        <GeoRing containerSize={size} sizeFrac={0.92} rotX={0}  spinDur={32} spinDir={1}  opacity={0.07} zOffset={-8} />
        {/* Polar A — tilted 72° on X, appears as narrow vertical ellipse */}
        <GeoRing containerSize={size} sizeFrac={0.80} rotX={72} spinDur={16} spinDir={1}  opacity={0.20} zOffset={6} />
        {/* Polar B — tilted 72° on Y, appears as narrow horizontal ellipse */}
        <GeoRing containerSize={size} sizeFrac={0.86} rotY={72} spinDur={22} spinDir={-1} opacity={0.15} zOffset={-4} />
        {/* Inner accent ring — tilted 45° diagonal */}
        <GeoRing containerSize={size} sizeFrac={0.60} rotX={55} rotY={30} spinDur={28} spinDir={1} opacity={0.10} zOffset={10} />

        {/* ── Cursor light orb — follows mouse inside compass ───────────────── */}
        <motion.div
          style={{
            position: 'absolute',
            left: localX,
            top: localY,
            translateX: '-50%',
            translateY: '-50%',
            width: 90,
            height: 90,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(169,192,142,0.55) 0%, transparent 70%)',
            filter: 'blur(14px)',
            pointerEvents: 'none',
            opacity: hovered ? 0.85 : 0,
            transition: 'opacity 0.3s ease',
          }}
        />

        {/* ── Main SVG compass ─────────────────────────────────────────────── */}
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
            <circle key={r} cx={CX} cy={CY} r={r}
              stroke="rgba(169,192,142,0.06)" strokeWidth="0.6" strokeDasharray="3 5" />
          ))}

          {/* Minor spokes */}
          {MINOR.map((a) => (
            <motion.path key={`m${a}`} d={spokePath(a, 68)}
              stroke={GLOW} strokeWidth="0.8" strokeLinecap="round"
              initial={{ pathLength: 0, opacity: 0 }} animate={minorCtrl} />
          ))}

          {/* Diagonal spokes */}
          {DIAGONAL.map((a) => (
            <motion.path key={`d${a}`} d={spokePath(a, 110)}
              stroke="#A9C08E" strokeWidth="1.2" strokeLinecap="round"
              initial={{ pathLength: 0, opacity: 0 }} animate={diagCtrl} />
          ))}

          {/* Cardinal spokes */}
          {CARDINAL.map((a) => (
            <g key={`c${a}`}>
              <motion.path d={spokePath(a, 165)} stroke="rgba(169,192,142,0.18)"
                strokeWidth="8" strokeLinecap="round"
                initial={{ pathLength: 0, opacity: 0 }} animate={cardinalCtrl} />
              <motion.path d={spokePath(a, 165)} stroke="#A9C08E"
                strokeWidth="1.6" strokeLinecap="round"
                initial={{ pathLength: 0, opacity: 0 }} animate={cardinalCtrl} />
              <motion.path d={diamondPath(a, 170, 152, 6)} fill="#A9C08E"
                initial={{ opacity: 0 }} animate={cardinalCtrl} />
            </g>
          ))}

          {/* Highlight overlays — independent of draw-in controllers */}
          <AnimatePresence>
            {hlIsMinor && highlightAngle !== null && (
              <motion.path key={`mh${highlightAngle}`} d={spokePath(highlightAngle, 92)}
                stroke="#A9C08E" strokeWidth="1.8" strokeLinecap="round"
                initial={{ opacity: 0 }} animate={{ opacity: 0.75 }} exit={{ opacity: 0 }}
                transition={{ duration: 0.1 }} />
            )}
            {hlIsDiagonal && highlightAngle !== null && (
              <motion.path key={`dh${highlightAngle}`} d={spokePath(highlightAngle, 138)}
                stroke="#A9C08E" strokeWidth="2.6" strokeLinecap="round"
                initial={{ opacity: 0 }} animate={{ opacity: 0.95 }} exit={{ opacity: 0 }}
                transition={{ duration: 0.1 }} />
            )}
            {hlIsCardinal && highlightAngle !== null && (
              <g key={`ch${highlightAngle}`}>
                <motion.path d={spokePath(highlightAngle, 188)}
                  stroke="rgba(169,192,142,0.4)" strokeWidth="20" strokeLinecap="round"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  transition={{ duration: 0.1 }} />
                <motion.path d={spokePath(highlightAngle, 188)}
                  stroke="#A9C08E" strokeWidth="2.6" strokeLinecap="round"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  transition={{ duration: 0.1 }} />
                <motion.path d={diamondPath(highlightAngle, 195, 174, 10)} fill="#A9C08E"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  transition={{ duration: 0.1 }} />
              </g>
            )}
          </AnimatePresence>
        </motion.svg>

        {/* ── Ambient particles ─────────────────────────────────────────────── */}
        {showParticles && PARTICLES.map((p, i) => (
          <Particle key={i} tx={p.tx} ty={p.ty} delay={p.delay} dur={p.dur} sz={p.size} scale={pScale} />
        ))}

        {/* ── Center spark ──────────────────────────────────────────────────── */}
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
          {[1, 2, 3].map((i) => (
            <motion.div key={i}
              style={{ position: 'absolute', borderRadius: '50%', border: '1px solid rgba(169,192,142,0.3)' }}
              animate={doAnimate && !prefersReduced
                ? { width: [20, 68], height: [20, 68], opacity: [0.6, 0] }
                : { width: 20, height: 20, opacity: 0.15 }}
              transition={{ duration: 2.5, repeat: Infinity, delay: i * 0.75, ease: 'easeOut' }}
            />
          ))}
          <motion.div
            style={{ position: 'absolute', width: 40, height: 40, borderRadius: '50%', background: 'radial-gradient(circle, rgba(169,192,142,0.55) 0%, transparent 70%)' }}
            animate={doAnimate && !prefersReduced ? { scale: [1, 1.4, 1] } : { scale: 1 }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            initial={{ scale: 0, opacity: 0 }}
          />
          <motion.div
            style={{
              position: 'relative', borderRadius: '50%',
              width: hovered ? 11 : 7, height: hovered ? 11 : 7,
              background: '#A9C08E',
              boxShadow: hovered ? '0 0 24px 10px rgba(169,192,142,0.9)' : '0 0 12px 4px rgba(169,192,142,0.65)',
              transition: 'all 0.2s ease',
            }}
            initial={{ scale: 0, opacity: 0 }}
            animate={centerCtrl}
          />
        </div>
      </motion.div>

      {/* ── Click burst pulses — outside tilt so they stay in screen plane ─── */}
      {pulses.map(pulse => (
        <div key={pulse.id} style={{ position: 'absolute', top: pulse.y, left: pulse.x, pointerEvents: 'none' }}>
          {[0, 1, 2, 3].map(i => (
            <motion.div key={i}
              style={{
                position: 'absolute', borderRadius: '50%',
                border: `1px solid rgba(169,192,142,${0.7 - i * 0.1})`,
                transform: 'translate(-50%, -50%)',
              }}
              initial={{ width: 0, height: 0, opacity: 0.9 }}
              animate={{ width: 100 + i * 55, height: 100 + i * 55, opacity: 0 }}
              transition={{ duration: 1.0, delay: i * 0.1, ease: [0.2, 0, 0.6, 1] }}
            />
          ))}
          {/* Flash at click point */}
          <motion.div
            style={{
              position: 'absolute', borderRadius: '50%',
              background: 'rgba(169,192,142,0.6)',
              transform: 'translate(-50%, -50%)',
            }}
            initial={{ width: 0, height: 0, opacity: 1 }}
            animate={{ width: 24, height: 24, opacity: 0 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
          />
        </div>
      ))}
    </div>
  );
}
