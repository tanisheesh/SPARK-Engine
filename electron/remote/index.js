/* Wiring between Electron and the remote-session engine.
 *
 * This is the only file in electron/remote/ that knows about Electron, which
 * keeps engine.js, conversations.js and protocol.js testable without booting
 * an app window.
 *
 * Registers the IPC surface the renderer uses to turn remote access on and off,
 * and feeds the engine everything it needs to answer a phone: the active data
 * source, the API keys, and the real query pipeline from api-handler.js.
 */

const { ipcMain, app } = require('electron');
const fs = require('fs');
const path = require('path');

const engine = require('./engine');
const conversations = require('./conversations');
const sourceRegistry = require('../source-registry');
const secureStore = require('../secure-store');
const { processQuery } = require('../api-handler');

const settingsDir = app.getPath('userData');
const settingsFile = path.join(settingsDir, 'settings.json');

let mainWindow = null;

/* The dataset the desktop currently has connected. Published by the renderer,
   because "which source is active" is genuinely renderer state - it follows
   what the user picked in the UI. Main does not guess: with nothing published,
   a remote query is refused with NO_SOURCE rather than silently running
   against whatever happens to be left in DuckDB. */
let activeSource = null;

function setMainWindow(win) {
  mainWindow = win;
}

function pushToRenderer(channel, payload) {
  if (mainWindow && mainWindow.webContents && !mainWindow.webContents.isDestroyed()) {
    mainWindow.webContents.send(channel, payload);
  }
}

function readSettings() {
  let stored = {};
  try {
    if (fs.existsSync(settingsFile)) {
      stored = JSON.parse(fs.readFileSync(settingsFile, 'utf8'));
    }
  } catch (error) {
    console.error('remote: could not read settings.json:', error.message);
  }
  // Keys live encrypted in secrets.json; merge them in the same way the
  // get-settings IPC handler does so the pipeline sees its usual shape.
  return Object.assign({}, stored, secureStore.getAllSecrets());
}

function init() {
  conversations.init(settingsDir);

  engine.configure({
    onStatus: (status) => pushToRenderer('remote-status', status),
    handlers: {
      getActiveSource: () => activeSource,

      /* The phone's question runs through exactly the pipeline the desktop
         uses - same privacy policy, same tokenization, same SQL guard, same
         local-model fallback. Nothing here re-implements any of it.

         voiceAllowed is hard-false: TTS audio is base64 MP3 that can run to
         megabytes and the phone would only discard it. This also means a
         remote query never sends the detokenized answer to Deepgram. */
      runQuery: async ({ question, source, onProgress }) => {
        const csvFile = sourceRegistry.isFileSource(source.type) && source.path
          ? source.path
          : 'duckdb://direct';

        return processQuery({
          question,
          csvFile,
          settings: readSettings(),
          voiceAllowed: false,
          onProgress
        });
      }
    }
  });

  // A mobile turn landing in the store must show up in the open desktop window
  // without the user restarting anything - that is the visible half of "sync".
  conversations.onChange(({ reason, conversationId }) => {
    pushToRenderer('conversations-updated', {
      reason,
      conversationId,
      conversations: conversations.list()
    });
  });

  registerIpc();
}

function registerIpc() {
  ipcMain.handle('remote-status', () => engine.status());

  ipcMain.handle('remote-connect', (event, { relayUrl, token, deviceName }) => {
    if (!relayUrl || !token) {
      return { success: false, error: 'A relay URL and a token or pairing code are required' };
    }
    try {
      return { success: true, status: engine.connect({ relayUrl, token, deviceName }) };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('remote-disconnect', () => ({ success: true, status: engine.disconnect() }));

  /* The renderer tells main which dataset is live. Called on connect,
     disconnect and dataset switch. */
  ipcMain.handle('remote-set-source', (event, source) => {
    activeSource = source && source.type ? source : null;
    return { success: true };
  });

  /* The renderer's conversation store syncing into main's mirror. Returns the
     MERGED list, which the renderer adopts - that is what pulls mobile turns
     into the desktop UI and makes the two stores converge. */
  ipcMain.handle('remote-sync-conversations', (event, incoming) => {
    try {
      return { success: true, conversations: conversations.syncFromRenderer(incoming || []) };
    } catch (error) {
      console.error('remote: conversation sync failed:', error.message);
      return { success: false, error: error.message, conversations: conversations.list() };
    }
  });
}

function shutdown() {
  try {
    engine.disconnect();
  } catch (error) {
    console.error('remote: shutdown failed:', error.message);
  }
}

module.exports = { init, setMainWindow, shutdown };
