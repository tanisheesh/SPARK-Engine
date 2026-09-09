/* next.config.ts uses `assetPrefix: './'` so pages reference their JS/CSS
   relative to their own file (required for Electron's file:// loading —
   there's no web server, see docs/DECISIONS.md "DuckDB via CLI subprocess"
   sibling decisions on why this app avoids a server). Next.js hardcodes
   that literal './' prefix on every exported page regardless of nesting
   depth, so a page one level deep (out/app/index.html) still asks for
   './_next/...' — resolving to out/app/_next, which next export never
   creates; only out/_next exists. Electron's file:// loader then can't
   find any asset and the window comes up blank.

   Run after every build: copy out/_next next to every nested index.html
   so the relative path actually resolves, however deep future routes go. */

const fs = require('fs');
const path = require('path');

const OUT_DIR = path.join(__dirname, '..', 'out');
const NEXT_DIR = path.join(OUT_DIR, '_next');

function findNestedHtmlDirs(dir, depth = 0) {
  const dirs = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name === '_next') continue;
    const full = path.join(dir, entry.name);
    if (fs.existsSync(path.join(full, 'index.html'))) dirs.push(full);
    dirs.push(...findNestedHtmlDirs(full, depth + 1));
  }
  return dirs;
}

if (!fs.existsSync(NEXT_DIR)) {
  console.error('fix-export-assets: out/_next not found — did the build run?');
  process.exit(1);
}

for (const dir of findNestedHtmlDirs(OUT_DIR)) {
  const dest = path.join(dir, '_next');
  if (fs.existsSync(dest)) continue;
  fs.cpSync(NEXT_DIR, dest, { recursive: true });
  console.log(`fix-export-assets: copied _next -> ${path.relative(OUT_DIR, dest)}`);
}
