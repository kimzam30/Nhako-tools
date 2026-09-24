/**
 * The teleprompter's phone remote: a message relay, nothing more.
 *
 * Phone and tablet join the same Supabase Realtime Broadcast channel, named
 * after a random room code, and pass small control messages ("play",
 * "faster") through it. Broadcast messages are relayed in memory and never
 * written to a database. Scripts, video and audio never go through here.
 *
 * This speaks Realtime's Phoenix channel protocol directly over a WebSocket
 * rather than pulling in supabase-js for one feature. The key is Supabase's
 * publishable key, which is meant to be public; ./supabase.ts says what else
 * it can and cannot reach.
 */

import { SUPABASE_HOST, SUPABASE_KEY as KEY } from './supabase';

export const RELAY_HOST = SUPABASE_HOST;
const URL_ = `wss://${RELAY_HOST}/realtime/v1/websocket?apikey=${KEY}&vsn=1.0.0`;

export type RelayStatus = 'connecting' | 'open' | 'offline';

export interface Room {
  send(payload: unknown): void;
  close(): void;
}

interface Frame { topic: string; event: string; payload: Record<string, unknown>; ref: string | null }

const HEARTBEAT_MS = 25_000;

/**
 * Join room `code` and stay joined: rejoin after a dropped connection (a
 * tablet going to sleep, a phone changing networks) with a growing delay.
 */
export function openRoom(
  code: string,
  onMessage: (payload: unknown) => void,
  onStatus: (s: RelayStatus) => void,
  socketFactory: (url: string) => WebSocket = (url) => new WebSocket(url),
): Room {
  const topic = `realtime:nhako-tp-${code}`;
  let ws: WebSocket | null = null;
  let ref = 0;
  let joinRef = '';
  let joined = false;
  let closed = false;
  let attempt = 0;
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  let retry: ReturnType<typeof setTimeout> | undefined;
  const queue: unknown[] = [];

  const raw = (event: string, payload: Record<string, unknown>, t = topic) => {
    if (ws?.readyState !== WebSocket.OPEN) return '';
    const r = String(++ref);
    ws.send(JSON.stringify({ topic: t, event, payload, ref: r }));
    return r;
  };
  const join = () => {
    joinRef = raw('phx_join', { config: { broadcast: { self: false, ack: false }, presence: { key: '' }, private: false } });
  };
  const broadcast = (payload: unknown) => raw('broadcast', { type: 'broadcast', event: 'm', payload });

  const schedule = (ms: number) => {
    clearTimeout(retry);
    retry = setTimeout(connect, ms);
  };

  function connect() {
    if (closed) return;
    onStatus('connecting');
    try {
      ws = socketFactory(URL_);
    } catch {
      onStatus('offline');
      schedule(Math.min(30_000, 1000 * 2 ** attempt++));
      return;
    }
    ws.onopen = () => {
      join();
      clearInterval(heartbeat);
      heartbeat = setInterval(() => raw('heartbeat', {}, 'phoenix'), HEARTBEAT_MS);
    };
    ws.onmessage = (e) => {
      let f: Frame;
      try { f = JSON.parse(String(e.data)) as Frame; } catch { return; }
      if (f.topic !== topic) return;
      if (f.event === 'phx_reply' && f.ref === joinRef) {
        if (f.payload.status === 'ok') {
          joined = true;
          attempt = 0;
          onStatus('open');
          while (queue.length) broadcast(queue.shift());
        } else {
          // A project waking from a pause answers "initializing" for a while.
          setTimeout(() => { if (!closed && !joined) join(); }, 2000);
        }
        return;
      }
      if (f.event === 'broadcast' && f.payload.event === 'm') onMessage(f.payload.payload);
      if (f.event === 'phx_close' || f.event === 'phx_error') { joined = false; join(); }
    };
    ws.onclose = () => {
      joined = false;
      clearInterval(heartbeat);
      if (closed) return;
      onStatus('offline');
      schedule(Math.min(30_000, 1000 * 2 ** attempt++));
    };
  }

  connect();

  return {
    send(payload) {
      if (joined) broadcast(payload);
      // Keep only the latest few while offline: old commands are stale.
      else { queue.push(payload); if (queue.length > 3) queue.shift(); }
    },
    close() {
      closed = true;
      clearTimeout(retry);
      clearInterval(heartbeat);
      if (joined) raw('phx_leave', {});
      ws?.close();
    },
  };
}
