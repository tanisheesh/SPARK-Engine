/*
 * Builds every platform icon from the single source of truth: public/logo.png.
 *
 * Everything downstream — the Windows .ico, the macOS .icns, the Linux/app
 * .png and the small mark the UI renders in the sidebar — is derived here,
 * so replacing the logo means replacing one file and running this script.
 *
 *   npm run generate-icons
 */
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const publicDir = path.join(__dirname, '../public');
const sourcePath = path.join(publicDir, 'logo.png');

/* Square RGBA pixels at a given size, transparency preserved. */
async function rgba(size) {
  return sharp(sourcePath)
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .ensureAlpha()
    .raw()
    .toBuffer();
}

async function png(size) {
  return sharp(sourcePath)
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9 })
    .toBuffer();
}

/* ------------------------------------------------------------------
   ICO. Small sizes go in as 32-bit BMP (what the NSIS installer and
   older Explorer paths expect); 256 goes in as PNG, which is the only
   legal encoding at that size.
   ------------------------------------------------------------------ */
function toBmpEntry(pixels, size) {
  const header = Buffer.alloc(40);
  header.writeUInt32LE(40, 0);        // biSize
  header.writeInt32LE(size, 4);       // biWidth
  header.writeInt32LE(size * 2, 8);   // biHeight — XOR mask plus AND mask
  header.writeUInt16LE(1, 12);        // biPlanes
  header.writeUInt16LE(32, 14);       // biBitCount
  header.writeUInt32LE(0, 16);        // BI_RGB

  const xor = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    const srcRow = size - 1 - y;      // BMP rows run bottom-up
    for (let x = 0; x < size; x++) {
      const s = (srcRow * size + x) * 4;
      const d = (y * size + x) * 4;
      xor[d] = pixels[s + 2];         // B
      xor[d + 1] = pixels[s + 1];     // G
      xor[d + 2] = pixels[s];         // R
      xor[d + 3] = pixels[s + 3];     // A
    }
  }

  // AND mask: unused when the alpha channel carries the shape, but the
  // format still requires the rows (each padded to 4 bytes).
  const and = Buffer.alloc(Math.ceil(size / 32) * 4 * size, 0);

  header.writeUInt32LE(xor.length + and.length, 20); // biSizeImage
  return Buffer.concat([header, xor, and]);
}

async function buildIco(sizes) {
  const images = [];
  for (const size of sizes) {
    images.push({
      size,
      data: size >= 256 ? await png(size) : toBmpEntry(await rgba(size), size),
      isPng: size >= 256,
    });
  }

  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);              // reserved
  header.writeUInt16LE(1, 2);              // type: icon
  header.writeUInt16LE(images.length, 4);

  const directory = Buffer.alloc(16 * images.length);
  let offset = header.length + directory.length;

  images.forEach((image, i) => {
    const at = i * 16;
    directory[at] = image.size >= 256 ? 0 : image.size;     // 0 means 256
    directory[at + 1] = image.size >= 256 ? 0 : image.size;
    directory[at + 2] = 0;                                   // palette size
    directory[at + 3] = 0;                                   // reserved
    directory.writeUInt16LE(1, at + 4);                      // colour planes
    directory.writeUInt16LE(32, at + 6);                     // bits per pixel
    directory.writeUInt32LE(image.data.length, at + 8);
    directory.writeUInt32LE(offset, at + 12);
    offset += image.data.length;
  });

  return Buffer.concat([header, directory, ...images.map((i) => i.data)]);
}

/* ------------------------------------------------------------------
   ICNS. A magic word, a total length, then one length-prefixed chunk
   per size. PNG payloads are accepted for every type used here, so this
   builds correctly off macOS — no iconutil needed.
   ------------------------------------------------------------------ */
async function buildIcns(types) {
  const chunks = [];
  for (const [type, size] of types) {
    const data = await png(size);
    const chunk = Buffer.alloc(8);
    chunk.write(type, 0, 4, 'ascii');
    chunk.writeUInt32BE(data.length + 8, 4);
    chunks.push(Buffer.concat([chunk, data]));
  }

  const body = Buffer.concat(chunks);
  const header = Buffer.alloc(8);
  header.write('icns', 0, 4, 'ascii');
  header.writeUInt32BE(body.length + 8, 4);
  return Buffer.concat([header, body]);
}

async function generateIcons() {
  if (!fs.existsSync(sourcePath)) {
    console.error('Error: public/logo.png not found.');
    console.log('Add the logo as public/logo.png first, then re-run this script.');
    process.exit(1);
  }

  const { width, height } = await sharp(sourcePath).metadata();
  console.log(`Source: public/logo.png (${width}x${height})`);

  // The mark the app renders in the sidebar. Small enough to ship, big
  // enough for a 2x display at the sizes we draw it.
  await sharp(sourcePath)
    .resize(128, 128, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9 })
    .toFile(path.join(publicDir, 'logo-mark.png'));
  console.log('  public/logo-mark.png   128x128  (in-app mark)');

  fs.writeFileSync(path.join(publicDir, 'icon.png'), await png(1024));
  console.log('  public/icon.png        1024x1024 (Linux, app window)');

  fs.writeFileSync(path.join(publicDir, 'icon-256.png'), await png(256));
  console.log('  public/icon-256.png    256x256');

  fs.writeFileSync(
    path.join(publicDir, 'icon.ico'),
    await buildIco([16, 24, 32, 48, 64, 128, 256])
  );
  console.log('  public/icon.ico        16-256    (Windows app + installer)');

  fs.writeFileSync(
    path.join(publicDir, 'icon.icns'),
    await buildIcns([
      ['icp4', 16],
      ['icp5', 32],
      ['ic11', 32],
      ['ic12', 64],
      ['ic07', 128],
      ['ic13', 256],
      ['ic08', 256],
      ['ic14', 512],
      ['ic09', 512],
      ['ic10', 1024],
    ])
  );
  console.log('  public/icon.icns       16-1024   (macOS)');

  console.log('\nDone. Run `npm run dist` to package with the new icons.');
}

generateIcons().catch((error) => {
  console.error('Error generating icons:', error.message);
  process.exit(1);
});
