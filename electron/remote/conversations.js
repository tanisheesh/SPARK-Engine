/* Main-process mirror of the renderer's conversation store.
 *
 * Why this exists
 * ---------------
 * Conversations have always lived in the renderer's localStorage
 * (`spark.conversations.v1`, see app/app/page.tsx). That is fine for a single
 * machine but a question asked from a phone arrives in the MAIN process, and
 * main cannot write to localStorage. Rather than move the whole store - which
 * would be a large, risky change to a working desktop app - main keeps a
 * mirror on disk and the two sides merge.
 *
 * Who wins
 * --------
 * Neither, and that is deliberate. Merging is by id and additive:
 *   - conversations are unioned by `id`
 *   - turns within a conversation are unioned by `id`, ordered by createdAt
 *   - for a turn present on both sides, the more COMPLETE one wins (a finished
 *     turn beats an in-flight one), then the more recently updated
 *
 * A last-writer-wins design would lose data here for real: the renderer saves
 * its whole array on every keystroke-ish state change, so a mobile turn landing
 * between a renderer read and its next write would vanish. Union-by-id makes
 * that race harmless, which matters because it is the common case, not an edge.
 */

const fs = require('fs');
const path = require('path');

const FILE_VERSION = 1;
// Matches the renderer's own cap in app/app/page.tsx so the two stores do not
// disagree about how much history exists.
const MAX_CONVERSATIONS = 40;

let storeFile = null;
let cache = null; // Conversation[]
let listeners = [];

function init(userDataDir) {
  storeFile = path.join(userDataDir, 'conversations.json');
  cache = read();
  return cache;
}

function read() {
  if (!storeFile || !fs.existsSync(storeFile)) return [];
  try {
    const parsed = JSON.parse(fs.readFileSync(storeFile, 'utf8'));
    const list = Array.isArray(parsed) ? parsed : parsed.conversations;
    return Array.isArray(list) ? list.filter(isConversation) : [];
  } catch (error) {
    // A corrupt mirror must not take the app down or wipe the renderer's copy -
    // the renderer's next sync will repopulate it.
    console.error('conversations.json unreadable, starting empty:', error.message);
    return [];
  }
}

function isConversation(c) {
  return c && typeof c.id === 'string' && Array.isArray(c.turns);
}

function persist() {
  if (!storeFile) return;
  try {
    const payload = { v: FILE_VERSION, conversations: cache.slice(0, MAX_CONVERSATIONS) };
    fs.writeFileSync(storeFile, JSON.stringify(payload), { mode: 0o600 });
  } catch (error) {
    console.error('Failed to write conversations.json:', error.message);
  }
}

function emit(reason, conversationId) {
  for (const listener of listeners) {
    try {
      listener({ reason, conversationId });
    } catch (error) {
      console.error('conversation listener threw:', error.message);
    }
  }
}

function onChange(listener) {
  listeners.push(listener);
  return () => { listeners = listeners.filter(l => l !== listener); };
}

/* ---------- merging ---------- */

// A turn that carries an answer or an error has finished; one that does not is
// still running. Completeness beats recency so a stale "thinking" record from
// one side can never overwrite the finished answer held by the other.
function completeness(turn) {
  if (!turn) return -1;
  if (turn.status === 'done' || turn.status === 'error' || turn.status === 'cancelled') return 2;
  if (turn.answer || turn.sql) return 1;
  return 0;
}

function pickTurn(a, b) {
  const ca = completeness(a);
  const cb = completeness(b);
  if (ca !== cb) return ca > cb ? a : b;
  const ta = a.completedAt || a.createdAt || 0;
  const tb = b.completedAt || b.createdAt || 0;
  return tb > ta ? b : a;
}

function mergeTurns(mine, theirs) {
  const byId = new Map();
  for (const turn of [...(mine || []), ...(theirs || [])]) {
    if (!turn || typeof turn.id !== 'string') continue;
    const existing = byId.get(turn.id);
    byId.set(turn.id, existing ? pickTurn(existing, turn) : turn);
  }
  return [...byId.values()].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
}

function mergeConversations(mine, theirs) {
  const byId = new Map();
  for (const convo of [...(mine || []), ...(theirs || [])]) {
    if (!isConversation(convo)) continue;
    const existing = byId.get(convo.id);
    if (!existing) {
      byId.set(convo.id, Object.assign({}, convo));
      continue;
    }
    byId.set(convo.id, Object.assign({}, existing, convo, {
      turns: mergeTurns(existing.turns, convo.turns),
      // The title the user actually set should survive; both sides default it
      // from the first question, so preferring the longer-lived one is wrong.
      title: convo.title || existing.title,
      updatedAt: Math.max(existing.updatedAt || 0, convo.updatedAt || 0),
      pinned: existing.pinned || convo.pinned || false
    }));
  }
  return [...byId.values()]
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
    .slice(0, MAX_CONVERSATIONS);
}

/* ---------- public API ---------- */

/** Called when the renderer saves. Merges rather than replaces so mobile turns
    written since the renderer last read are not dropped. Returns the merged
    list, which the renderer adopts - that is what makes the merge converge. */
function syncFromRenderer(incoming) {
  cache = mergeConversations(cache, incoming);
  persist();
  return cache;
}

function list() {
  return cache || [];
}

function get(conversationId) {
  return (cache || []).find(c => c.id === conversationId) || null;
}

/** Compact rows for the phone's conversation list: enough to choose one, and
    nothing else. No rows, no SQL, no trace - those cost bandwidth on mobile
    data to render a list the user is about to scroll past. */
function summaries() {
  return (cache || []).map((c) => {
    const turns = c.turns || [];
    const last = turns[turns.length - 1] || null;
    return {
      id: c.id,
      title: c.title,
      source: c.source || null,
      lastQuestion: last ? last.question : null,
      lastAnswer: last && last.answer ? last.answer : null,
      lastStatus: last ? last.status : null,
      updatedAt: c.updatedAt || c.createdAt || 0,
      turnCount: turns.length,
      pinned: Boolean(c.pinned)
    };
  }).sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || b.updatedAt - a.updatedAt);
}

function createConversation({ id, title, source }) {
  const now = Date.now();
  const convo = {
    id,
    title: title || 'New conversation',
    source: source || null,
    turns: [],
    createdAt: now,
    updatedAt: now
  };
  cache = [convo, ...(cache || [])].slice(0, MAX_CONVERSATIONS);
  persist();
  emit('created', id);
  return convo;
}

/** Inserts or updates one turn. Used for both the optimistic "asked" record and
    the completed answer, so the phone's question is durable even if the
    pipeline later fails or the desktop is closed mid-query. */
function upsertTurn(conversationId, turn) {
  const convo = get(conversationId);
  if (!convo) return null;

  const turns = convo.turns || [];
  const index = turns.findIndex(t => t.id === turn.id);
  if (index === -1) turns.push(turn);
  else turns[index] = pickTurn(turns[index], turn) === turn ? turn : turns[index];

  convo.turns = turns.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  convo.updatedAt = Date.now();

  // Keep the touched conversation at the head, matching the renderer's ordering.
  cache = [convo, ...cache.filter(c => c.id !== conversationId)];
  persist();
  emit('turn', conversationId);
  return convo;
}

module.exports = {
  init,
  list,
  get,
  summaries,
  createConversation,
  upsertTurn,
  syncFromRenderer,
  onChange,
  // exported for tests
  mergeConversations
};
