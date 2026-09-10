/* The phone's end of the relay connection.
 *
 * Dials out to the relay, authenticates, and exposes a promise-based RPC call
 * plus an event stream. Deliberately small: no state library, no observables,
 * just a socket, a map of pending calls, and a listener list.
 *
 * Connection loss is the normal case on a phone, not an error - the screen
 * locks, the train enters a tunnel, Wi-Fi hands over to LTE. So reconnection
 * is automatic and silent, and in-flight calls are rejected with a code the UI
 * can explain rather than left hanging forever.
 */

import {
  ERR,
  METHOD,
  PROTOCOL_VERSION,
  ROLE,
  RPC_TIMEOUT_MS,
  T,
  type RpcError,
} from '../protocol';

export type RelayState = 'idle' | 'connecting' | 'online' | 'offline' | 'error';

export interface RelaySnapshot {
  state: RelayState;
  /** Whether the DESKTOP is connected. Distinct from `state`, which is about
      the phone's own link to the relay - the difference is exactly what the
      "desktop offline" screen needs to say something truthful. */
  engineOnline: boolean;
  engineName: string | null;
  error: string | null;
}

type Frame = Record<string, any>;
type Pending = {
  resolve: (value: any) => void;
  reject: (error: RpcError) => void;
  timer: ReturnType<typeof setTimeout>;
};

const RECONNECT_BASE_MS = 800;
const RECONNECT_MAX_MS = 20000;

export class RelayClient {
  private ws: WebSocket | null = null;
  private url = '';
  private token = '';
  private deviceName = 'Phone';

  private pending = new Map<string, Pending>();
  private eventListeners = new Map<string, Set<(data: any) => void>>();
  private stateListeners = new Set<(snapshot: RelaySnapshot) => void>();

  private rpcSeq = 0;
  private attempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private stopped = true;

  private snapshot: RelaySnapshot = {
    state: 'idle',
    engineOnline: false,
    engineName: null,
    error: null,
  };

  /* ---------- lifecycle ---------- */

  connect(url: string, token: string, deviceName: string) {
    this.disconnect({ silent: true });
    this.url = url;
    this.token = token;
    this.deviceName = deviceName;
    this.stopped = false;
    this.attempt = 0;
    this.open();
  }

  private open() {
    this.patch({ state: 'connecting', error: null });

    let socket: WebSocket;
    try {
      socket = new WebSocket(this.url);
    } catch (error: any) {
      return this.scheduleReconnect(error?.message ?? 'Could not open the connection');
    }
    this.ws = socket;

    socket.onopen = () => {
      this.sendFrame(T.AUTH, {
        v: PROTOCOL_VERSION,
        role: ROLE.CLIENT,
        token: this.token,
        deviceName: this.deviceName,
      });
    };

    socket.onmessage = (raw) => {
      let frame: Frame;
      try {
        frame = JSON.parse(String(raw.data));
      } catch {
        return;
      }
      this.handleFrame(frame);
    };

    socket.onerror = () => {
      // onclose always follows and is where the retry decision is made.
    };

    socket.onclose = (event) => {
      // Reject everything in flight: a phone that regained signal should get a
      // clear failure it can retry, not a spinner that never resolves.
      this.rejectAll({
        code: ERR.ENGINE_OFFLINE,
        message: 'The connection dropped before an answer arrived.',
      });
      if (this.stopped) return this.patch({ state: 'idle', engineOnline: false });

      const code = (event as any)?.code;
      // 4001/4002 are auth and version failures - they will fail identically
      // forever, so retrying only drains the battery.
      if (code === 4001 || code === 4002) {
        return this.patch({
          state: 'error',
          engineOnline: false,
          error: this.snapshot.error ?? 'The relay refused the connection.',
        });
      }
      this.scheduleReconnect('Reconnecting…');
    };
  }

  private scheduleReconnect(message: string) {
    if (this.stopped) return;
    this.attempt += 1;
    const base = Math.min(RECONNECT_BASE_MS * 2 ** (this.attempt - 1), RECONNECT_MAX_MS);
    // Jitter so a relay restart is not met by every phone reconnecting at once.
    const delay = Math.round(base * (0.7 + Math.random() * 0.6));
    this.patch({ state: 'offline', engineOnline: false, error: message });
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => this.open(), delay);
  }

  disconnect(options?: { silent?: boolean }) {
    this.stopped = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    if (this.ws) {
      try {
        this.ws.close();
      } catch {
        /* already gone */
      }
      this.ws = null;
    }
    this.rejectAll({ code: ERR.ENGINE_OFFLINE, message: 'Disconnected.' });
    if (!options?.silent) this.patch({ state: 'idle', engineOnline: false, engineName: null });
  }

  /** Called when the app returns to the foreground. A socket the OS quietly
      killed while backgrounded still reads as OPEN, so this reconnects rather
      than trusting readyState. */
  refresh() {
    if (this.stopped) return;
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.sendFrame(T.PING, { id: 'refresh' });
      return;
    }
    this.attempt = 0;
    this.open();
  }

  /* ---------- frames ---------- */

  private sendFrame(t: string, payload: Frame) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return false;
    try {
      this.ws.send(JSON.stringify({ t, ...payload }));
      return true;
    } catch {
      return false;
    }
  }

  private handleFrame(frame: Frame) {
    switch (frame.t) {
      case T.AUTH_OK:
        this.attempt = 0;
        return this.patch({
          state: 'online',
          engineOnline: Boolean(frame.engineOnline),
          engineName: frame.engineName ?? null,
          error: null,
        });

      case T.AUTH_ERR:
        // Recorded so onclose can report it; the relay closes right after.
        return this.patch({ error: frame.message ?? 'Authentication failed' });

      case T.PRESENCE:
        return this.patch({
          engineOnline: Boolean(frame.engineOnline),
          engineName: frame.engineName ?? this.snapshot.engineName,
        });

      case T.RPC_RESULT: {
        const entry = this.take(frame.id);
        return entry?.resolve(frame.result ?? {});
      }

      case T.RPC_ERROR: {
        const entry = this.take(frame.id);
        return entry?.reject(
          frame.error ?? { code: ERR.QUERY_FAILED, message: 'The request failed.' }
        );
      }

      case T.EVENT: {
        const listeners = this.eventListeners.get(frame.event);
        if (!listeners) return;
        for (const listener of listeners) {
          try {
            listener(frame.data);
          } catch (error) {
            console.warn('relay event listener threw', error);
          }
        }
        return;
      }

      default:
        return;
    }
  }

  private take(id: string): Pending | undefined {
    const entry = this.pending.get(id);
    if (entry) {
      clearTimeout(entry.timer);
      this.pending.delete(id);
    }
    return entry;
  }

  private rejectAll(error: RpcError) {
    for (const [, entry] of this.pending) {
      clearTimeout(entry.timer);
      entry.reject(error);
    }
    this.pending.clear();
  }

  /* ---------- rpc ---------- */

  rpc<TResult = any>(method: string, params: Record<string, unknown> = {}): Promise<TResult> {
    return new Promise<TResult>((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        return reject({ code: ERR.ENGINE_OFFLINE, message: 'Not connected to SPARK.' } as RpcError);
      }
      const id = `c${++this.rpcSeq}`;
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject({ code: ERR.TIMEOUT, message: 'The desktop did not answer in time.' } as RpcError);
      }, RPC_TIMEOUT_MS);

      this.pending.set(id, { resolve, reject, timer });
      if (!this.sendFrame(T.RPC, { id, method, params })) {
        this.take(id);
        reject({ code: ERR.ENGINE_OFFLINE, message: 'Not connected to SPARK.' } as RpcError);
      }
    });
  }

  /* ---------- subscriptions ---------- */

  onEvent(event: string, listener: (data: any) => void): () => void {
    let set = this.eventListeners.get(event);
    if (!set) {
      set = new Set();
      this.eventListeners.set(event, set);
    }
    set.add(listener);
    return () => set!.delete(listener);
  }

  onStateChange(listener: (snapshot: RelaySnapshot) => void): () => void {
    this.stateListeners.add(listener);
    listener(this.snapshot);
    return () => this.stateListeners.delete(listener);
  }

  getSnapshot(): RelaySnapshot {
    return this.snapshot;
  }

  private patch(next: Partial<RelaySnapshot>) {
    this.snapshot = { ...this.snapshot, ...next };
    for (const listener of this.stateListeners) {
      try {
        listener(this.snapshot);
      } catch (error) {
        console.warn('relay state listener threw', error);
      }
    }
  }
}

export const METHODS = METHOD;
