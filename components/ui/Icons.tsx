'use client';

import React from 'react';

/* ------------------------------------------------------------------
   One icon system. Lucide geometry (24px grid, round caps/joins),
   drawn inline so we add no dependency and every glyph shares a
   stroke weight. Never mix these with emoji or a second pack.
   ------------------------------------------------------------------ */

export interface IconProps extends React.SVGProps<SVGSVGElement> {
  size?: number;
  strokeWidth?: number;
}

function make(paths: React.ReactNode, displayName: string) {
  const C = ({ size = 15, strokeWidth = 1.5, ...rest }: IconProps) => (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {paths}
    </svg>
  );
  C.displayName = displayName;
  return C;
}

/* ---------- Navigation ---------- */
export const IconAsk = make(<><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></>, 'IconAsk');
export const IconExplore = make(<><circle cx="12" cy="12" r="9" /><path d="m15.5 8.5-2 5.5-5.5 2 2-5.5z" /></>, 'IconExplore');
export const IconData = make(<><ellipse cx="12" cy="5.5" rx="8" ry="3" /><path d="M4 5.5v6c0 1.66 3.58 3 8 3s8-1.34 8-3v-6" /><path d="M4 11.5v6c0 1.66 3.58 3 8 3s8-1.34 8-3v-6" /></>, 'IconData');
export const IconConversations = make(<><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /><path d="M12 7.5V12l3 1.8" /></>, 'IconConversations');
export const IconSettings = make(<><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></>, 'IconSettings');

/* ---------- Voice + composer ---------- */
export const IconMic = make(<><rect x="9" y="2" width="6" height="12" rx="3" /><path d="M19 10v1a7 7 0 0 1-14 0v-1" /><path d="M12 18v4" /><path d="M8 22h8" /></>, 'IconMic');
export const IconMicOff = make(<><path d="m2 2 20 20" /><path d="M9 9v2a3 3 0 0 0 4.6 2.5" /><path d="M15 10.5V5a3 3 0 0 0-5.7-1.3" /><path d="M19 10v1a7 7 0 0 1-.8 3.2" /><path d="M15.3 18.3A7 7 0 0 1 5 11v-1" /><path d="M12 18v4" /><path d="M8 22h8" /></>, 'IconMicOff');
export const IconSend = make(<><path d="M12 19V5" /><path d="m5 12 7-7 7 7" /></>, 'IconSend');
export const IconStop = make(<><rect x="6" y="6" width="12" height="12" rx="2" /></>, 'IconStop');
export const IconSpeaker = make(<><path d="M11 5 6 9H2v6h4l5 4z" /><path d="M15.5 8.5a5 5 0 0 1 0 7" /><path d="M18.5 5.5a9 9 0 0 1 0 13" /></>, 'IconSpeaker');
export const IconSpeakerOff = make(<><path d="M11 5 6 9H2v6h4l5 4z" /><path d="m22 9-6 6" /><path d="m16 9 6 6" /></>, 'IconSpeakerOff');

/* ---------- Studio: analyze ---------- */
export const IconChart = make(<><path d="M3 3v16a2 2 0 0 0 2 2h16" /><rect x="7" y="12" width="3" height="5" rx="1" /><rect x="12.5" y="8" width="3" height="9" rx="1" /><rect x="18" y="4.5" width="3" height="12.5" rx="1" /></>, 'IconChart');
export const IconInsights = make(<><path d="M9 18h6" /><path d="M10 21h4" /><path d="M12 3a6 6 0 0 0-3.6 10.8c.5.4.8.9.9 1.5h5.4c.1-.6.4-1.1.9-1.5A6 6 0 0 0 12 3" /></>, 'IconInsights');
export const IconDeepDive = make(<><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /><path d="M11 8v6" /><path d="M8 11h6" /></>, 'IconDeepDive');
export const IconAnomaly = make(<><path d="M3 17l4-5 3 3 4-7 3 4 4-6" /><circle cx="10" cy="8" r="2.2" /></>, 'IconAnomaly');

/* ---------- Studio: explore ---------- */
export const IconBreakdown = make(<><rect x="3" y="4" width="7" height="7" rx="1.5" /><rect x="14" y="4" width="7" height="4" rx="1.5" /><rect x="3" y="15" width="7" height="5" rx="1.5" /><rect x="14" y="11" width="7" height="9" rx="1.5" /></>, 'IconBreakdown');
export const IconCompare = make(<><path d="M5 3v18" /><path d="M19 3v18" /><path d="M5 8h6" /><path d="M13 16h6" /><path d="m9 6-2 2 2 2" /><path d="m15 14 2 2-2 2" /></>, 'IconCompare');
export const IconForecast = make(<><path d="M3 3v16a2 2 0 0 0 2 2h16" /><path d="m7 15 3.5-4 3 2.5L17 8" /><path d="M17 8h3.5" strokeDasharray="2 2" /><path d="M20.5 8v3.5" strokeDasharray="2 2" /></>, 'IconForecast');
export const IconMap = make(<><path d="m9 4-6 2.5v13L9 17l6 2.5 6-2.5v-13L15 6.5z" /><path d="M9 4v13" /><path d="M15 6.5v13" /></>, 'IconMap');

/* ---------- Studio: create ---------- */
export const IconDashboard = make(<><rect x="3" y="3" width="7.5" height="8.5" rx="1.5" /><rect x="13.5" y="3" width="7.5" height="5" rx="1.5" /><rect x="3" y="14.5" width="7.5" height="6.5" rx="1.5" /><rect x="13.5" y="11" width="7.5" height="10" rx="1.5" /></>, 'IconDashboard');
export const IconReport = make(<><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5" /><path d="M9 13h6" /><path d="M9 17h4" /></>, 'IconReport');
export const IconTable = make(<><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 9.5h18" /><path d="M9 9.5V20" /></>, 'IconTable');
export const IconSQL = make(<><path d="m8 8-4 4 4 4" /><path d="m16 8 4 4-4 4" /><path d="m14 5-4 14" /></>, 'IconSQL');

/* ---------- Studio: understand + discover ---------- */
export const IconExplain = make(<><circle cx="12" cy="12" r="9" /><path d="M9.5 9.2a2.6 2.6 0 0 1 5 .8c0 1.7-2.5 2.2-2.5 3.8" /><path d="M12 17.2h.01" /></>, 'IconExplain');
export const IconSchema = make(<><rect x="8.5" y="2.5" width="7" height="5" rx="1.5" /><rect x="1.5" y="16.5" width="7" height="5" rx="1.5" /><rect x="15.5" y="16.5" width="7" height="5" rx="1.5" /><path d="M12 7.5v4" /><path d="M5 16.5v-2a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v2" /></>, 'IconSchema');
/* Discovery reads as a constellation — points that turn out to be
   related — rather than a sparkle. Nothing in this product twinkles. */
export const IconSurprise = make(<><path d="m5 17 4.5-8L15 12l4-7" /><circle cx="5" cy="17" r="1.6" /><circle cx="9.5" cy="9" r="1.6" /><circle cx="15" cy="12" r="1.6" /><circle cx="19" cy="5" r="1.6" /></>, 'IconSurprise');

/* ---------- Utility ---------- */
export const IconChevronDown = make(<><path d="m6 9 6 6 6-6" /></>, 'IconChevronDown');
export const IconChevronRight = make(<><path d="m9 6 6 6-6 6" /></>, 'IconChevronRight');
export const IconChevronUp = make(<><path d="m6 15 6-6 6 6" /></>, 'IconChevronUp');
export const IconClose = make(<><path d="M18 6 6 18" /><path d="m6 6 12 12" /></>, 'IconClose');
export const IconCheck = make(<><path d="M20 6 9 17l-5-5" /></>, 'IconCheck');
export const IconCopy = make(<><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></>, 'IconCopy');
export const IconDownload = make(<><path d="M12 3v12" /><path d="m7 11 5 5 5-5" /><path d="M4 20h16" /></>, 'IconDownload');
export const IconRefresh = make(<><path d="M3 12a9 9 0 0 1 15.3-6.4L21 8" /><path d="M21 3v5h-5" /><path d="M21 12a9 9 0 0 1-15.3 6.4L3 16" /><path d="M3 21v-5h5" /></>, 'IconRefresh');
export const IconExpand = make(<><path d="M15 3h6v6" /><path d="M9 21H3v-6" /><path d="M21 3l-7 7" /><path d="M3 21l7-7" /></>, 'IconExpand');
export const IconMore = make(<><circle cx="5" cy="12" r="1.4" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" /><circle cx="19" cy="12" r="1.4" fill="currentColor" stroke="none" /></>, 'IconMore');
export const IconPlus = make(<><path d="M12 5v14" /><path d="M5 12h14" /></>, 'IconPlus');
export const IconArrowUp = make(<><path d="M12 19V5" /><path d="m6 11 6-6 6 6" /></>, 'IconArrowUp');
export const IconArrowDown = make(<><path d="M12 5v14" /><path d="m18 13-6 6-6-6" /></>, 'IconArrowDown');
export const IconArrowRight = make(<><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></>, 'IconArrowRight');
export const IconTrash = make(<><path d="M4 7h16" /><path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" /><path d="M18 7v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V7" /><path d="M10 11v6" /><path d="M14 11v6" /></>, 'IconTrash');
export const IconBookmark = make(<><path d="M5 4a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v17l-7-4-7 4z" /></>, 'IconBookmark');
export const IconLogout = make(<><path d="M9 21H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3" /><path d="M15 17l5-5-5-5" /><path d="M20 12H9" /></>, 'IconLogout');
export const IconClock = make(<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.5 2" /></>, 'IconClock');
export const IconWarning = make(<><path d="M12 3.5 22 20H2z" /><path d="M12 10v4.5" /><path d="M12 17.5h.01" /></>, 'IconWarning');
export const IconInfo = make(<><circle cx="12" cy="12" r="9" /><path d="M12 11v5" /><path d="M12 8h.01" /></>, 'IconInfo');
export const IconSearch = make(<><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>, 'IconSearch');
export const IconEdit = make(<><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></>, 'IconEdit');
export const IconPin = make(<><path d="M12 17v5" /><path d="M9 3h6l-1 6 3 3v2H7v-2l3-3z" /></>, 'IconPin');
export const IconPlug = make(<><path d="M9 2v6" /><path d="M15 2v6" /><path d="M6 8h12v3a6 6 0 0 1-12 0z" /><path d="M12 17v5" /></>, 'IconPlug');
export const IconFile = make(<><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5" /></>, 'IconFile');
export const IconLayers = make(<><path d="m12 3 9 5-9 5-9-5z" /><path d="m3 13 9 5 9-5" /></>, 'IconLayers');
export const IconZap = make(<><path d="M13 2 4 14h7l-1 8 9-12h-7z" /></>, 'IconZap');
export const IconKeyboard = make(<><rect x="2" y="6" width="20" height="12" rx="2" /><path d="M6 10h.01" /><path d="M10 10h.01" /><path d="M14 10h.01" /><path d="M18 10h.01" /><path d="M8 14h8" /></>, 'IconKeyboard');
export const IconUser = make(<><circle cx="12" cy="8" r="4" /><path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1" /></>, 'IconUser');

/* ------------------------------------------------------------------
   The SPARK mark.

   The logo ships as a raster (public/logo.png) and every size the app
   draws is served from public/logo-mark.png, a 128px derivative — small
   enough to load instantly, dense enough for a 2x display at the sizes
   we use. Both are regenerated by scripts/generate-icons.js.

   The path is relative because the app is loaded from file:// inside
   Electron, matching the relative assetPrefix in next.config.ts.
   ------------------------------------------------------------------ */
export function SparkMark({ size = 20, className = '' }: { size?: number; className?: string }) {
  return (
    // next/image buys nothing here: images are unoptimized for the static
    // export, and a plain tag keeps the path relative for file:// loading.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="./logo-mark.png"
      width={size}
      height={size}
      alt=""
      aria-hidden="true"
      draggable={false}
      className={className}
      style={{ width: size, height: size, objectFit: 'contain' }}
    />
  );
}

/* Wordmark lockup. Tracking is modest — this is a product name in a
   toolbar, not a title card. */
export function SparkLogo({ size = 18, showWord = true }: { size?: number; showWord?: boolean }) {
  return (
    <span className="inline-flex select-none items-center gap-[7px]">
      <SparkMark size={size} />
      {showWord && (
        <span
          className="font-semibold tracking-[0.02em] text-ink"
          style={{ fontSize: size * 0.78 }}
        >
          SPARK
        </span>
      )}
    </span>
  );
}
