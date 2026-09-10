/* next.config.ts uses `assetPrefix: './'` so pages reference their JS/CSS
   (and any public/ asset loaded with a relative <img src="./...">, like
   components/ui/Icons.tsx's logo-mark.png) relative to their own file —
   required for Electron's file:// loading, since there's no web server.
   Next.js hardcodes that literal './' prefix on every exported page
   regardless of nesting depth, so a page one level deep
   (out/app/index.html) still asks for './_next/...' and './logo-mark.png'
   — resolving to out/app/_next and out/app/logo-mark.png, which next
   export never creates; those only exist at the top of out/. Electron's
   file:// loader then can't find them: blank window, missing logo.

   Run after every build: copy every top-level file/dir in out/ (except
   other route directories) next to every nested index.html, so the
   relative paths actually resolve however deep future routes go. */

const fs = require('fs');
const path = require('path');

const OUT_DIR = path.join(__dirname, '..', 'out');

function findNestedHtmlDirs(dir) {
  const dirs = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const full = path.join(dir, entry.name);
    if (fs.existsSync(path.join(full, 'index.html'))) dirs.push(full);
    dirs.push(...findNestedHtmlDirs(full));
  }
  return dirs;
}

if (!fs.existsSync(OUT_DIR)) {
  console.error('fix-export-assets: out/ not found — did the build run?');
  process.exit(1);
}

const nestedDirs = findNestedHtmlDirs(OUT_DIR);
const topLevelEntries = fs
  .readdirSync(OUT_DIR, { withFileTypes: true })
  .filter((e) => !nestedDirs.some((d) => d === path.join(OUT_DIR, e.name)));

for (const dir of nestedDirs) {
  for (const entry of topLevelEntries) {
    const src = path.join(OUT_DIR, entry.name);
    const dest = path.join(dir, entry.name);
    if (fs.existsSync(dest)) continue;
    fs.cpSync(src, dest, { recursive: true });
  }
  console.log(`fix-export-assets: mirrored top-level assets -> ${path.relative(OUT_DIR, dir)}`);
}
