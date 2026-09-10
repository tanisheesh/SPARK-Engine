/* A compact chart renderer for one measure.
 *
 * The desktop's components/charts/Chart.tsx is 622 lines and handles five
 * shapes, three series, hover, waypoints and export. None of that belongs on a
 * phone, so this is ~150 lines of react-native-svg covering the three shapes a
 * small screen can actually carry.
 *
 * Rules kept from the desktop: axis labels are real values, bars start at zero,
 * nothing is drawn that the rows do not support, and anything omitted is
 * stated rather than hidden.
 */

import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, Line, Path, Rect, Text as SvgText } from 'react-native-svg';

import { axisMax, type MobileChartSpec } from '../chart';
import { compactNumber } from '../format';
import { color, font, space } from '../theme';
import { Mono, Row, Txt } from './Primitives';

const HEIGHT = 148;
const AXIS_W = 38;
const PAD_T = 10;
const PAD_B = 22;

export function Chart({ spec, width }: { spec: MobileChartSpec; width: number }) {
  const plotW = Math.max(width - AXIS_W - space.sm, 40);
  const plotH = HEIGHT - PAD_T - PAD_B;
  const max = axisMax(spec.values);

  const y = (value: number) => PAD_T + plotH - (value / max) * plotH;

  return (
    <View>
      <Row style={{ justifyContent: 'space-between', marginBottom: space.sm }}>
        <Mono size="micro" weight="faint">
          {spec.valueKey}
        </Mono>
        <Mono size="micro" weight="faint">
          {spec.rationale}
        </Mono>
      </Row>

      {spec.kind === 'hbar' ? (
        <HorizontalBars spec={spec} width={width} max={max} />
      ) : (
        <Svg width={width} height={HEIGHT}>
          {/* Two gridlines only: zero and the axis maximum. More would be
              decoration on a screen this size. */}
          {[0, max].map((value) => (
            <React.Fragment key={value}>
              <Line
                x1={AXIS_W}
                y1={y(value)}
                x2={AXIS_W + plotW}
                y2={y(value)}
                stroke={color.lineSubtle}
                strokeWidth={1}
              />
              <SvgText
                x={AXIS_W - 6}
                y={y(value) + 3.5}
                fill={color.faint}
                fontSize={10}
                fontFamily={font.mono}
                textAnchor="end"
              >
                {compactNumber(value)}
              </SvgText>
            </React.Fragment>
          ))}

          {spec.kind === 'bar' ? (
            spec.values.map((value, i) => {
              const slot = plotW / spec.values.length;
              const barW = Math.max(Math.min(slot * 0.62, 26), 3);
              const x = AXIS_W + slot * i + (slot - barW) / 2;
              const top = y(value);
              return (
                <Rect
                  key={i}
                  x={x}
                  y={top}
                  width={barW}
                  height={Math.max(PAD_T + plotH - top, 1)}
                  fill={color.accent}
                  rx={2}
                />
              );
            })
          ) : (
            <>
              <Path
                d={linePath(spec.values, AXIS_W, plotW, y)}
                stroke={color.accent}
                strokeWidth={1.75}
                fill="none"
              />
              {/* Endpoint markers only: a dot per point turns a 60-point
                  series into noise. */}
              {[0, spec.values.length - 1].map((i) => (
                <Circle
                  key={i}
                  cx={pointX(i, spec.values.length, AXIS_W, plotW)}
                  cy={y(spec.values[i] ?? 0)}
                  r={2.5}
                  fill={color.accent}
                />
              ))}
            </>
          )}

          {/* First and last label. Everything between is unreadable at this
              width, and a crowded axis is worse than a sparse one. */}
          <SvgText
            x={AXIS_W}
            y={HEIGHT - 6}
            fill={color.faint}
            fontSize={10}
            fontFamily={font.mono}
          >
            {spec.labels[0]}
          </SvgText>
          {spec.labels.length > 1 ? (
            <SvgText
              x={AXIS_W + plotW}
              y={HEIGHT - 6}
              fill={color.faint}
              fontSize={10}
              fontFamily={font.mono}
              textAnchor="end"
            >
              {spec.labels[spec.labels.length - 1]}
            </SvgText>
          ) : null}
        </Svg>
      )}

      {spec.truncated > 0 ? (
        <Txt size="micro" weight="faint" style={{ marginTop: space.xs }}>
          {spec.truncated.toLocaleString('en-US')} more row
          {spec.truncated === 1 ? '' : 's'} not shown — open on desktop for the full result
        </Txt>
      ) : null}
    </View>
  );
}

function pointX(i: number, count: number, offset: number, plotW: number) {
  return count <= 1 ? offset : offset + (plotW / (count - 1)) * i;
}

function linePath(values: number[], offset: number, plotW: number, y: (v: number) => number) {
  return values
    .map((value, i) => `${i === 0 ? 'M' : 'L'}${pointX(i, values.length, offset, plotW)},${y(value)}`)
    .join(' ');
}

/* Horizontal bars get their own layout: the label sits on its own line above
   each bar, which is the only way a long category name stays readable at this
   width without truncation. */
function HorizontalBars({
  spec,
  width,
  max,
}: {
  spec: MobileChartSpec;
  width: number;
  max: number;
}) {
  const rows = spec.labels.slice(0, 8);
  const barTrack = width - 64;

  return (
    <View style={{ gap: space.sm }}>
      {rows.map((label, i) => {
        const value = spec.values[i] ?? 0;
        const w = Math.max((value / max) * barTrack, 2);
        return (
          <View key={`${label}-${i}`} style={{ gap: 3 }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Mono size="micro" weight="muted" numberOfLines={1} style={{ flex: 1 }}>
                {label}
              </Mono>
              <Mono size="micro" weight="faint">
                {compactNumber(value)}
              </Mono>
            </Row>
            <View
              style={{
                height: 6,
                borderRadius: 2,
                backgroundColor: color.surface3,
                overflow: 'hidden',
              }}
            >
              <View style={{ width: w, height: 6, backgroundColor: color.accent }} />
            </View>
          </View>
        );
      })}
      {spec.labels.length > rows.length ? (
        <Mono size="micro" weight="faint">
          + {spec.labels.length - rows.length} more
        </Mono>
      ) : null}
    </View>
  );
}
