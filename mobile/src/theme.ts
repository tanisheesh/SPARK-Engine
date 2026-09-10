/* SPARK's visual language, transcribed for React Native.
 *
 * These are the same values as app/globals.css on the desktop. They are copied
 * rather than imported because /mobile is meant to be liftable into its own
 * repository - see README. If the desktop palette changes, change it here too;
 * there is no build-time link that would catch the drift.
 *
 * The rules the desktop follows, which apply here as well:
 *   - hierarchy comes from contrast, type and spacing, never from colour
 *   - three text weights exist; a fourth is a mistake
 *   - sage is the only accent, and covers roughly a tenth of the surface
 *   - no gradients, no glow, no glassmorphism, no pills except for status
 */

export const color = {
  bg: '#141515',
  surface: '#191A1A',
  surface2: '#1E1F1F',
  surface3: '#232424',

  line: '#303131',
  lineSubtle: '#272828',

  ink: '#E8E7E2',
  muted: '#A3A39D',
  faint: '#70716C',

  accent: '#8FA17C',
  accentHi: '#A0B18D',
  accentLo: '#7C8D6A',
  accentInk: '#141515',
  accentSoft: 'rgba(143, 161, 124, 0.11)',
  accentLine: 'rgba(143, 161, 124, 0.34)',

  positive: '#8FA17C',
  negative: '#B4776A',
  warning: '#B39A63',
  info: '#7189A3',
  idle: '#70716C',
} as const;

/* The 4/8 rhythm the desktop uses. Touch targets get their own scale below
   rather than being improvised out of these. */
export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  xxxl: 40,
} as const;

/* Restrained geometry: 6-10px. Pills are for status tags only. */
export const radius = {
  xs: 3,
  sm: 4,
  md: 6,
  lg: 7,
  xl: 8,
  xxl: 10,
  pill: 999,
} as const;

/* Mobile runs two points larger than the desktop across the board - a 13px
   body is right at arm's length on a monitor and wrong in a car park. The
   relative hierarchy is unchanged. */
export const type = {
  micro: { fontSize: 11, lineHeight: 15 },
  meta: { fontSize: 12, lineHeight: 16 },
  small: { fontSize: 13, lineHeight: 18 },
  body: { fontSize: 15, lineHeight: 22 },
  /* Answers are the reason the app exists; they get real size. */
  answer: { fontSize: 19, lineHeight: 28, letterSpacing: -0.2 },
  title: { fontSize: 17, lineHeight: 24, letterSpacing: -0.2 },
  display: { fontSize: 24, lineHeight: 30, letterSpacing: -0.4 },
} as const;

/* Instrument Sans and IBM Plex Mono are loaded at runtime by App.tsx. Until
   they resolve, and if the download fails, these platform stacks carry the
   same job: a neutral grotesque for human text, a real monospace for
   technical text. `fontFamily: undefined` means "the platform default",
   which is the correct fallback rather than naming a font that may not exist. */
export const font = {
  sans: 'InstrumentSans',
  sansMedium: 'InstrumentSans_Medium',
  mono: 'IBMPlexMono',
} as const;

/** Minimum comfortable touch target. Anything interactive clears this. */
export const TOUCH = 44;
