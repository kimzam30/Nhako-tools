import { describe, it, expect, vi, afterEach } from 'vitest';
import { openRoom, type RelayStatus } from './relay';

/** Just enough of a WebSocket to play the server's part. */
class FakeSocket {
  static OPEN = 1;
  readyState = 0;
  sent: { topic: string; event: string; payload: Record<string, unknown>; ref: string }[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  constructor(public url: string) {}
  send(s: string) { this.sent.push(JSON.parse(s)); }
  close() { this.readyState = 3; this.onclose?.(); }
  open() { this.readyState = 1; this.onopen?.(); }
  reply(frame: object) { this.onmessage?.({ data: JSON.stringify(frame) }); }
  last(event: string) { return [...this.sent].reverse().find((f) => f.event === event)!; }
}

afterEach(() => { vi.useRealTimers(); });

function setup() {
  vi.useFakeTimers();
  const sockets: FakeSocket[] = [];
  const got: unknown[] = [];
  const statuses: RelayStatus[] = [];
  const room = openRoom('ABCDE23456', (p) => got.push(p), (s) => statuses.push(s), (url) => {
    const s = new FakeSocket(url);
    sockets.push(s);
    return s as unknown as WebSocket;
  });
  return { room, sockets, got, statuses };
}

const TOPIC = 'realtime:nhako-tp-ABCDE23456';

describe('relay', () => {
  it('joins a public broadcast channel named after the room, with the publishable key', () => {
    const { sockets } = setup();
    const s = sockets[0]!;
    expect(s.url).toMatch(/^wss:\/\/iznnnsiojfcbncrdqzyh\.supabase\.co\/realtime\/v1\/websocket\?apikey=sb_publishable_/);
    s.open();
    const join = s.last('phx_join');
    expect(join.topic).toBe(TOPIC);
    expect(join.payload).toMatchObject({ config: { broadcast: { self: false }, private: false } });
  });

  it('queues messages until joined, then sends only the latest few', () => {
    const { room, sockets, statuses } = setup();
    const s = sockets[0]!;
    s.open();
    for (let i = 0; i < 5; i++) room.send({ n: i });
    expect(s.sent.filter((f) => f.event === 'broadcast')).toHaveLength(0);
    s.reply({ topic: TOPIC, event: 'phx_reply', payload: { status: 'ok' }, ref: s.last('phx_join').ref });
    expect(statuses.at(-1)).toBe('open');
    expect(s.sent.filter((f) => f.event === 'broadcast').map((f) => (f.payload.payload as { n: number }).n)).toEqual([2, 3, 4]);
  });

  it('retries the join while the project is still waking up', () => {
    const { sockets } = setup();
    const s = sockets[0]!;
    s.open();
    s.reply({ topic: TOPIC, event: 'phx_reply', payload: { status: 'error', response: { reason: 'InitializingProjectConnection' } }, ref: s.last('phx_join').ref });
    expect(s.sent.filter((f) => f.event === 'phx_join')).toHaveLength(1);
    vi.advanceTimersByTime(2000);
    expect(s.sent.filter((f) => f.event === 'phx_join')).toHaveLength(2);
  });

  it('hands on broadcasts for this room only', () => {
    const { sockets, got } = setup();
    const s = sockets[0]!;
    s.open();
    s.reply({ topic: TOPIC, event: 'broadcast', payload: { type: 'broadcast', event: 'm', payload: { t: 'hello' } }, ref: null });
    s.reply({ topic: 'realtime:other', event: 'broadcast', payload: { type: 'broadcast', event: 'm', payload: { t: 'x' } }, ref: null });
    s.reply({ topic: TOPIC, event: 'broadcast', payload: { type: 'broadcast', event: 'other', payload: { t: 'y' } }, ref: null });
    expect(got).toEqual([{ t: 'hello' }]);
  });

  it('reconnects after the connection drops, and stops when closed', () => {
    const { room, sockets, statuses } = setup();
    sockets[0]!.open();
    sockets[0]!.close();
    expect(statuses.at(-1)).toBe('offline');
    vi.advanceTimersByTime(1000);
    expect(sockets).toHaveLength(2);
    room.close();
    vi.advanceTimersByTime(60_000);
    expect(sockets).toHaveLength(2);
  });

  it('sends a heartbeat so the server keeps the socket', () => {
    const { sockets } = setup();
    sockets[0]!.open();
    vi.advanceTimersByTime(25_000);
    expect(sockets[0]!.last('heartbeat').topic).toBe('phoenix');
  });
});
