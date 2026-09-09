// Downloads the local fallback LLM (used when Groq is unavailable) into
// electron/models/. Not run automatically on `npm install` - it's a ~1GB
// download, so run it explicitly once before `npm run app` / `npm run dist`.
const fs = require('fs');
const path = require('path');
const https = require('https');

const MODEL_URL = 'https://huggingface.co/Qwen/Qwen2.5-Coder-1.5B-Instruct-GGUF/resolve/main/qwen2.5-coder-1.5b-instruct-q4_k_m.gguf';
const MODEL_DIR = path.join(__dirname, '..', 'electron', 'models');
const MODEL_PATH = path.join(MODEL_DIR, 'qwen2.5-coder-1.5b-instruct-q4_k_m.gguf');

function download(url, destPath) {
  return new Promise((resolve, reject) => {
    const tmpPath = destPath + '.download';
    const file = fs.createWriteStream(tmpPath);

    https.get(url, (response) => {
      if ([301, 302, 307, 308].includes(response.statusCode) && response.headers.location) {
        file.close();
        fs.unlinkSync(tmpPath);
        return resolve(download(response.headers.location, destPath));
      }
      if (response.statusCode !== 200) {
        file.close();
        fs.unlink(tmpPath, () => {});
        return reject(new Error(`Download failed: HTTP ${response.statusCode}`));
      }

      const totalBytes = parseInt(response.headers['content-length'] || '0', 10);
      let downloadedBytes = 0;
      let lastPrint = 0;

      response.on('data', (chunk) => {
        downloadedBytes += chunk.length;
        const now = Date.now();
        if (now - lastPrint > 1000) {
          lastPrint = now;
          const pct = totalBytes ? ((downloadedBytes / totalBytes) * 100).toFixed(1) : '?';
          process.stdout.write(`\r  Downloading... ${pct}% (${(downloadedBytes / 1024 / 1024).toFixed(0)} MB)`);
        }
      });

      response.pipe(file);
      file.on('finish', () => {
        file.close(() => {
          process.stdout.write('\n');
          fs.renameSync(tmpPath, destPath);
          resolve();
        });
      });
    }).on('error', (err) => {
      file.close();
      fs.unlink(tmpPath, () => {});
      reject(err);
    });
  });
}

async function main() {
  if (fs.existsSync(MODEL_PATH)) {
    console.log(`✅ Local fallback model already present: ${MODEL_PATH}`);
    return;
  }

  fs.mkdirSync(MODEL_DIR, { recursive: true });
  console.log('📥 Fetching local fallback model (Qwen2.5-Coder-1.5B-Instruct, Q4_K_M, ~1GB)...');
  console.log(`   ${MODEL_URL}`);
  await download(MODEL_URL, MODEL_PATH);
  console.log(`✅ Saved to ${MODEL_PATH}`);
}

main().catch((err) => {
  console.error('❌ Failed to fetch local fallback model:', err.message);
  process.exit(1);
});
