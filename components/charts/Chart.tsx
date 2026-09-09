'use client';

import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { ChartKind, ChartSpec } from '../../lib/spark/types';
import { compactNumber, fullNumber, humanizeColumn } from '../../lib/spark/format';

/* ============================================================
   SPARK chart engine — plain SVG, no chart library.

   Colour policy
   -------------
   One series  : the sage accent. Nothing else is on the plot, so
                 there is no identity to confuse and the title names
                 the measure.
   2-4 series  : SERIES[], a muted analytical set derived in OKLCH at
                 a fixed L 0.62 / C 0.115 so no slot shouts louder
                 than another. Hue order puts steel between amber and
                 terracotta, which are otherwise too close to sit
                 adjacent. Validated on the #191A1A surface: lightness
                 band, chroma floor, normal-vision separation 16.3 and
                 3:1 contrast all pass; adjacent CVD lands at 6.8
                 (deutan), which the always-present legend, the 2px
                 bar gaps and the table view cover as secondary
                 encoding. Hues are fixed in order and never cycled.
   ============================================================ */

const ACCENT = '#8FA17C';
const SERIES = ['#439A67', '#B57631', '#4B8AC9', '#C26869'];

const GRID = 'var(--line-subtle)';
const AXIS_TEXT = 'var(--text-3)';

function colorFor(index: number, total: number) {
  return total === 1 ? ACCENT : SERIES[index] ?? SERIES[SERIES.length - 1];
}

/* ---------- scale helpers ---------- */

function niceCeil(v: number): number {
  if (v <= 0) return 1;
  const mag = Math.pow(10, Math.floor(Math.log10(v)));
  const norm = v / mag;
  const step = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10;
  return step * mag;
}

function ticks(max: number, min: number, count = 4): number[] {
  const out: number[] = [];
  for (let i = 0; i <= count; i++) out.push(min + ((max - min) * i) / count);
  return out;
}

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useLayoutEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    const update = () => setW(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

/* ---------- tooltip ---------- */

interface Hover {
  x: number;
  y: number;
  label: string;
  entries: { key: string; value: number; color: string }[];
}

function Tip({ hover, width }: { hover: Hover; width: number }) {
  // Flip before the tooltip can leave the plot.
  const flip = hover.x > width - 150;
  return (
    <div
      className="pointer-events-none absolute z-20 min-w-[124px] rounded-lg border border-line bg-surface3 px-2.5 py-2 shadow-overlay"
      style={{
        left: flip ? undefined : hover.x + 12,
        right: flip ? width - hover.x + 12 : undefined,
        top: Math.max(4, hover.y - 12),
      }}
      role="tooltip"
    >
      <div className="mb-1.5 text-2xs text-faint">
        {hover.label}
      </div>
      {hover.entries.map((e) => (
        <div key={e.key} className="flex items-center justify-between gap-3 py-0.5">
          <span className="flex items-center gap-1.5">
            <span
              className="inline-block h-1.5 w-1.5 shrink-0 rounded-xs"
              style={{ background: e.color }}
            />
            <span className="text-xs text-muted">{humanizeColumn(e.key)}</span>
          </span>
          <span className="tnum text-xs font-medium text-ink">{fullNumber(e.value)}</span>
        </div>
      ))}
    </div>
  );
}

/* ---------- legend ---------- */

function Legend({ spec }: { spec: ChartSpec }) {
  if (spec.series.length < 2) return null;
  return (
    <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1 px-1 pt-2.5">
      {spec.series.map((s, i) => (
        <span key={s.key} className="flex items-center gap-1.5">
          <span
            className="inline-block h-1.5 w-1.5 rounded-xs"
            style={{ background: colorFor(i, spec.series.length) }}
          />
          <span className="text-xs text-muted">{humanizeColumn(s.key)}</span>
        </span>
      ))}
    </div>
  );
}

/* ============================================================
   Chart
   ============================================================ */

export function Chart({
  spec,
  kind,
  height = 200,
}: {
  spec: ChartSpec;
  kind?: ChartKind;
  height?: number;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<Hover | null>(null);
  const k = kind ?? spec.kind;

  const bounds = useMemo(() => {
    const all = spec.series.flatMap((s) => s.values);
    const max = Math.max(0, ...all);
    const min = Math.min(0, ...all);
    return { max: niceCeil(max || 1), min: min < 0 ? -niceCeil(-min) : 0 };
  }, [spec]);

  const body =
    width === 0 ? null : k === 'donut' ? (
      <Donut spec={spec} width={width} height={height} onHover={setHover} />
    ) : k === 'hbar' ? (
      <HBars spec={spec} width={width} height={height} bounds={bounds} onHover={setHover} />
    ) : k === 'bar' ? (
      <VBars spec={spec} width={width} height={height} bounds={bounds} onHover={setHover} />
    ) : (
      <LineArea
        spec={spec}
        width={width}
        height={height}
        bounds={bounds}
        filled={k === 'area'}
        onHover={setHover}
      />
    );

  return (
    <div className="w-full">
      <div
        ref={ref}
        className="relative w-full"
        style={{ height }}
        onMouseLeave={() => setHover(null)}
      >
        {body}
        {hover && <Tip hover={hover} width={width} />}
      </div>
      <Legend spec={spec} />
    </div>
  );
}

/* ---------- vertical bars ---------- */

function VBars({
  spec,
  width,
  height,
  bounds,
  onHover,
}: {
  spec: ChartSpec;
  width: number;
  height: number;
  bounds: { max: number; min: number };
  onHover: (h: Hover | null) => void;
}) {
  const PAD = { t: 10, r: 8, b: 26, l: 44 };
  const pw = Math.max(10, width - PAD.l - PAD.r);
  const ph = Math.max(10, height - PAD.t - PAD.b);
  const n = spec.labels.length;
  const sc = spec.series.length;

  const slot = pw / n;
  const groupW = Math.min(slot * 0.7, 56);
  // 2px of surface between adjacent bars keeps groups legible.
  const barW = Math.max(2, (groupW - (sc - 1) * 2) / sc);

  const y = (v: number) => PAD.t + ph - ((v - bounds.min) / (bounds.max - bounds.min)) * ph;
  const zeroY = y(0);
  const step = Math.max(1, Math.ceil(n / Math.floor(pw / 54)));

  return (
    <svg width={width} height={height} role="img" aria-label={`Bar chart of ${spec.labelKey}`}>
      {ticks(bounds.max, bounds.min).map((t, i) => (
        <g key={i}>
          <line x1={PAD.l} x2={width - PAD.r} y1={y(t)} y2={y(t)} stroke={GRID} strokeWidth={1} />
          <text x={PAD.l - 8} y={y(t) + 3.5} textAnchor="end" fontSize={10} fill={AXIS_TEXT} className="tnum">
            {compactNumber(t)}
          </text>
        </g>
      ))}

      {spec.labels.map((label, i) => {
        const gx = PAD.l + slot * i + (slot - groupW) / 2;
        return (
          <g key={i}>
            {spec.series.map((s, si) => {
              const v = s.values[i] ?? 0;
              const top = Math.min(y(v), zeroY);
              const h = Math.abs(zeroY - y(v));
              const x = gx + si * (barW + 2);
              const r = Math.min(4, barW / 2, h);
              return (
                <path
                  key={s.key}
                  // Rounded data-end only; the baseline end stays square.
                  d={
                    v >= 0
                      ? `M${x},${top + h} L${x},${top + r} Q${x},${top} ${x + r},${top} L${x + barW - r},${top} Q${x + barW},${top} ${x + barW},${top + r} L${x + barW},${top + h} Z`
                      : `M${x},${top} L${x},${top + h - r} Q${x},${top + h} ${x + r},${top + h} L${x + barW - r},${top + h} Q${x + barW},${top + h} ${x + barW},${top + h - r} L${x + barW},${top} Z`
                  }
                  fill={colorFor(si, sc)}
                />
              );
            })}
            <rect
              x={PAD.l + slot * i}
              y={PAD.t}
              width={slot}
              height={ph}
              fill="transparent"
              onMouseEnter={() =>
                onHover({
                  x: PAD.l + slot * i + slot / 2,
                  y: PAD.t + 8,
                  label,
                  entries: spec.series.map((s, si) => ({
                    key: s.key,
                    value: s.values[i] ?? 0,
                    color: colorFor(si, sc),
                  })),
                })
              }
            />
            {i % step === 0 && (
              <text
                x={PAD.l + slot * i + slot / 2}
                y={height - 8}
                textAnchor="middle"
                fontSize={10}
                fill={AXIS_TEXT}
              >
                {truncate(label, Math.max(4, Math.floor(slot / 6)))}
              </text>
            )}
          </g>
        );
      })}
      <line x1={PAD.l} x2={width - PAD.r} y1={zeroY} y2={zeroY} stroke="var(--line)" strokeWidth={1} />
    </svg>
  );
}

/* ---------- horizontal bars ---------- */

function HBars({
  spec,
  width,
  height,
  bounds,
  onHover,
}: {
  spec: ChartSpec;
  width: number;
  height: number;
  bounds: { max: number; min: number };
  onHover: (h: Hover | null) => void;
}) {
  const labelW = Math.min(140, Math.max(64, longest(spec.labels) * 6.2));
  const PAD = { t: 6, r: 40, b: 20, l: labelW + 10 };
  const pw = Math.max(10, width - PAD.l - PAD.r);
  const n = spec.labels.length;
  const sc = spec.series.length;

  const slot = (height - PAD.t - PAD.b) / n;
  const groupH = Math.min(slot * 0.68, 26);
  const barH = Math.max(2, (groupH - (sc - 1) * 2) / sc);

  const x = (v: number) => PAD.l + ((v - bounds.min) / (bounds.max - bounds.min)) * pw;
  const zeroX = x(0);

  return (
    <svg width={width} height={height} role="img" aria-label={`Ranked bar chart of ${spec.labelKey}`}>
      {ticks(bounds.max, bounds.min, 3).map((t, i) => (
        <line key={i} x1={x(t)} x2={x(t)} y1={PAD.t} y2={height - PAD.b} stroke={GRID} strokeWidth={1} />
      ))}

      {spec.labels.map((label, i) => {
        const gy = PAD.t + slot * i + (slot - groupH) / 2;
        return (
          <g key={i}>
            <text
              x={PAD.l - 10}
              y={PAD.t + slot * i + slot / 2 + 3.5}
              textAnchor="end"
              fontSize={11}
              fill="var(--text-muted)"
            >
              {truncate(label, Math.floor(labelW / 6.2))}
            </text>

            {spec.series.map((s, si) => {
              const v = s.values[i] ?? 0;
              const left = Math.min(zeroX, x(v));
              const w = Math.abs(x(v) - zeroX);
              const yy = gy + si * (barH + 2);
              const r = Math.min(4, barH / 2, w);
              return (
                <path
                  key={s.key}
                  d={
                    v >= 0
                      ? `M${left},${yy} L${left + w - r},${yy} Q${left + w},${yy} ${left + w},${yy + r} L${left + w},${yy + barH - r} Q${left + w},${yy + barH} ${left + w - r},${yy + barH} L${left},${yy + barH} Z`
                      : `M${left + w},${yy} L${left + r},${yy} Q${left},${yy} ${left},${yy + r} L${left},${yy + barH - r} Q${left},${yy + barH} ${left + r},${yy + barH} L${left + w},${yy + barH} Z`
                  }
                  fill={colorFor(si, sc)}
                />
              );
            })}

            {/* Direct label on the single-series case — no legend needed. */}
            {sc === 1 && (
              <text
                x={x(spec.series[0].values[i] ?? 0) + 6}
                y={PAD.t + slot * i + slot / 2 + 3.5}
                fontSize={10}
                fill={AXIS_TEXT}
                className="tnum"
              >
                {compactNumber(spec.series[0].values[i] ?? 0)}
              </text>
            )}

            <rect
              x={PAD.l}
              y={PAD.t + slot * i}
              width={pw}
              height={slot}
              fill="transparent"
              onMouseEnter={() =>
                onHover({
                  x: PAD.l + pw / 2,
                  y: PAD.t + slot * i,
                  label,
                  entries: spec.series.map((s, si) => ({
                    key: s.key,
                    value: s.values[i] ?? 0,
                    color: colorFor(si, sc),
                  })),
                })
              }
            />
          </g>
        );
      })}
      <line x1={zeroX} x2={zeroX} y1={PAD.t} y2={height - PAD.b} stroke="var(--line)" strokeWidth={1} />
    </svg>
  );
}

/* ---------- line / area ---------- */

function LineArea({
  spec,
  width,
  height,
  bounds,
  filled,
  onHover,
}: {
  spec: ChartSpec;
  width: number;
  height: number;
  bounds: { max: number; min: number };
  filled: boolean;
  onHover: (h: Hover | null) => void;
}) {
  const [active, setActive] = useState<number | null>(null);
  const PAD = { t: 10, r: 10, b: 26, l: 44 };
  const pw = Math.max(10, width - PAD.l - PAD.r);
  const ph = Math.max(10, height - PAD.t - PAD.b);
  const n = spec.labels.length;
  const sc = spec.series.length;

  const px = (i: number) => PAD.l + (n === 1 ? pw / 2 : (pw * i) / (n - 1));
  const py = (v: number) => PAD.t + ph - ((v - bounds.min) / (bounds.max - bounds.min)) * ph;
  const step = Math.max(1, Math.ceil(n / Math.floor(pw / 58)));


  return (
    <svg
      width={width}
      height={height}
      role="img"
      aria-label={`Line chart over ${spec.labelKey}`}
      onMouseMove={(e) => {
        const box = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
        const rel = e.clientX - box.left - PAD.l;
        const i = Math.max(0, Math.min(n - 1, Math.round((rel / pw) * (n - 1))));
        setActive(i);
        onHover({
          x: px(i),
          y: PAD.t,
          label: spec.labels[i],
          entries: spec.series.map((s, si) => ({
            key: s.key,
            value: s.values[i] ?? 0,
            color: colorFor(si, sc),
          })),
        });
      }}
      onMouseLeave={() => {
        setActive(null);
        onHover(null);
      }}
    >
      {ticks(bounds.max, bounds.min).map((t, i) => (
        <g key={i}>
          <line x1={PAD.l} x2={width - PAD.r} y1={py(t)} y2={py(t)} stroke={GRID} strokeWidth={1} />
          <text x={PAD.l - 8} y={py(t) + 3.5} textAnchor="end" fontSize={10} fill={AXIS_TEXT} className="tnum">
            {compactNumber(t)}
          </text>
        </g>
      ))}

      {active !== null && (
        <line
          x1={px(active)}
          x2={px(active)}
          y1={PAD.t}
          y2={PAD.t + ph}
          stroke="var(--line)"
          strokeWidth={1}
        />
      )}

      {spec.series.map((s, si) => {
        const line = s.values.map((v, i) => `${i === 0 ? 'M' : 'L'}${px(i)},${py(v)}`).join(' ');
        const area = `${line} L${px(n - 1)},${py(bounds.min)} L${px(0)},${py(bounds.min)} Z`;
        return (
          <g key={s.key}>
            {/* A flat wash, not a fade. The fill restates the series;
                a gradient would just be decoration under the line. */}
            {filled && <path d={area} fill={colorFor(si, sc)} fillOpacity={0.1} />}
            <path
              d={line}
              fill="none"
              stroke={colorFor(si, sc)}
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {active !== null && (
              <circle
                cx={px(active)}
                cy={py(s.values[active] ?? 0)}
                r={4.5}
                fill={colorFor(si, sc)}
                stroke="var(--surface)"
                strokeWidth={2}
              />
            )}
          </g>
        );
      })}

      {spec.labels.map((label, i) =>
        i % step === 0 ? (
          <text key={i} x={px(i)} y={height - 8} textAnchor="middle" fontSize={10} fill={AXIS_TEXT}>
            {truncate(label, 10)}
          </text>
        ) : null
      )}
    </svg>
  );
}

/* ---------- donut ---------- */

function Donut({
  spec,
  width,
  height,
  onHover,
}: {
  spec: ChartSpec;
  width: number;
  height: number;
  onHover: (h: Hover | null) => void;
}) {
  const s = spec.series[0];
  const total = s.values.reduce((a, b) => a + b, 0);
  const cx = width / 2;
  const cy = height / 2;
  const R = Math.min(width, height) / 2 - 8;
  const r = R * 0.62;

  // Running total via reduce rather than a mutated cursor, so the arc list
  // is a pure function of the values.
  const arcs = s.values.reduce<{ i: number; v: number; frac: number; a0: number; a1: number }[]>(
    (acc, v, i) => {
      const frac = total ? v / total : 0;
      const a0 = acc.length ? acc[acc.length - 1].a1 : -Math.PI / 2;
      acc.push({ i, v, frac, a0, a1: a0 + frac * Math.PI * 2 });
      return acc;
    },
    []
  );

  return (
    <svg width={width} height={height} role="img" aria-label={`Composition of ${spec.labelKey}`}>
      {arcs.map((a) => (
        <path
          key={a.i}
          d={arcPath(cx, cy, R, r, a.a0, a.a1)}
          fill={SERIES[a.i % SERIES.length]}
          // 2px surface ring keeps neighbouring wedges from merging.
          stroke="var(--surface)"
          strokeWidth={2}
          onMouseEnter={() =>
            onHover({
              x: cx,
              y: 8,
              label: spec.labels[a.i],
              entries: [{ key: s.key, value: a.v, color: SERIES[a.i % SERIES.length] }],
            })
          }
        />
      ))}
      <text x={cx} y={cy - 2} textAnchor="middle" fontSize={16} fontWeight={600} fill="var(--text)" className="tnum">
        {compactNumber(total)}
      </text>
      <text x={cx} y={cy + 14} textAnchor="middle" fontSize={10} fill={AXIS_TEXT}>
        total
      </text>
    </svg>
  );
}

function arcPath(cx: number, cy: number, R: number, r: number, a0: number, a1: number) {
  const large = a1 - a0 > Math.PI ? 1 : 0;
  const p = (rad: number, a: number) => [cx + rad * Math.cos(a), cy + rad * Math.sin(a)];
  const [x0, y0] = p(R, a0);
  const [x1, y1] = p(R, a1);
  const [x2, y2] = p(r, a1);
  const [x3, y3] = p(r, a0);
  return `M${x0},${y0} A${R},${R} 0 ${large} 1 ${x1},${y1} L${x2},${y2} A${r},${r} 0 ${large} 0 ${x3},${y3} Z`;
}

/* ---------- utils ---------- */

function truncate(s: string, max: number) {
  return s.length > max ? s.slice(0, Math.max(1, max - 1)) + '…' : s;
}

function longest(xs: string[]) {
  return xs.reduce((m, x) => Math.max(m, x.length), 0);
}

/** Sparkline for compact contexts (artifact cards, recents). */
export function Sparkline({
  values,
  width = 72,
  height = 20,
  color = ACCENT,
}: {
  values: number[];
  width?: number;
  height?: number;
  color?: string;
}) {
  if (values.length < 2) return null;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min || 1;
  const d = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * (width - 2) + 1;
      const y = height - 1 - ((v - min) / span) * (height - 2);
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  return (
    <svg width={width} height={height} aria-hidden="true">
      <path d={d} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
