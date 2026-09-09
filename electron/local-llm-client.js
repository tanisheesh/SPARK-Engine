const path = require('path');
const fs = require('fs');

// Bundled inside the installer (electron-builder's "files": ["electron/**/*"]
// picks this up automatically) so the fallback works fully offline - no
// download needed at runtime, matching the app's "everything stays local" claim.
const MODEL_PATH = path.join(__dirname, 'models', 'qwen2.5-coder-1.5b-instruct-q4_k_m.gguf');

let sessionPromise = null;

function isModelAvailable() {
  return fs.existsSync(MODEL_PATH);
}

// node-llama-cpp is ESM-only; this project's electron/ code is CommonJS,
// so it has to be loaded via dynamic import() rather than require().
async function getSession() {
  if (!sessionPromise) {
    sessionPromise = (async () => {
      const { getLlama, LlamaChatSession } = await import('node-llama-cpp');
      const llama = await getLlama();
      const model = await llama.loadModel({ modelPath: MODEL_PATH });
      const context = await model.createContext();
      return new LlamaChatSession({ contextSequence: context.getSequence() });
    })();
  }
  return sessionPromise;
}

// Kicks off model loading in the background without blocking the caller, so
// the first real fallback request (Groq being down) doesn't pay the full
// cold-load cost (~seconds, for a 1.5B GGUF) on top of already being an outage.
function preload() {
  if (!isModelAvailable()) return;
  getSession().catch((err) => {
    console.warn('⚠️ Local fallback model preload failed:', err.message);
    sessionPromise = null; // allow a retry on the next real request
  });
}

// One-shot completion (stateless): resets chat history each call so unrelated
// fallback requests never leak context into each other.
async function complete(systemPrompt, userPrompt, { maxTokens = 400, temperature = 0.1 } = {}) {
  if (!isModelAvailable()) {
    throw new Error('Local fallback model not bundled (electron/models/*.gguf missing)');
  }
  const session = await getSession();
  session.resetChatHistory();
  const response = await session.prompt(`${systemPrompt}\n\n${userPrompt}`, { maxTokens, temperature });
  return response.trim();
}

module.exports = { complete, preload, isModelAvailable, MODEL_PATH };
