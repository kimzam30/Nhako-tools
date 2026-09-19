import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { gzipSync } from 'node:zlib';

/**
 * The watchdog around LibreOffice. A fake engine stands in for the real one:
 * the first `hangs` conversions never return, as the real build does about
 * one load in a dozen.
 */
const created: { worker: { terminate: ReturnType<typeof vi.fn> } }[] = [];
let hangs = 0;
let calls = 0;
/** Let the loader reach the n-th conversion before moving the clock on. */
const reached = (n: number) => vi.waitFor(() => { if (calls < n) throw new Error('not yet'); });

vi.mock('@matbee/libreoffice-converter/browser', () => ({
  WorkerBrowserConverter: class {
    worker = { terminate: vi.fn() };
    constructor() { created.push(this as never); }
    async initialize() {}
    convert() {
      calls++;
      if (hangs > 0) { hangs--; return new Promise(() => {}); }
      return Promise.resolve({ data: new Uint8Array([37, 80, 68, 70]), mimeType: 'application/pdf', filename: 'x.pdf' });
    }
  },
}));

beforeEach(() => {
  created.length = 0;
  hangs = 0;
  calls = 0;
  vi.resetModules();
  vi.useFakeTimers({ shouldAdvanceTime: true });
  // The engine files: tiny stand-ins, gzipped like the real ones.
  vi.stubGlobal('fetch', vi.fn(async () => new Response(gzipSync(Buffer.from('fake engine')))));
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('LibreOffice watchdog', () => {
  it('ends a stuck engine, starts a fresh one, and converts on the second try', async () => {
    hangs = 1;
    const { convertWithRetry } = await import('./libreoffice');
    const result = convertWithRetry(new Uint8Array(1000), { outputFormat: 'pdf' }, 'a.docx');
    await reached(1);
    await vi.advanceTimersByTimeAsync(46_000);
    expect((await result).data[0]).toBe(37);
    expect(created).toHaveLength(2);
    expect(created[0]!.worker.terminate).toHaveBeenCalledOnce();
    expect(created[1]!.worker.terminate).not.toHaveBeenCalled();
  });

  it('gives up after a second stuck attempt, and leaves no stuck engine behind', async () => {
    hangs = 2;
    const { convertWithRetry, Timeout } = await import('./libreoffice');
    const result = convertWithRetry(new Uint8Array(1000), { outputFormat: 'pdf' }, 'a.docx').catch((e: unknown) => e);
    await reached(1);
    await vi.advanceTimersByTimeAsync(46_000);
    await reached(2);
    await vi.advanceTimersByTimeAsync(46_000);
    expect(await result).toBeInstanceOf(Timeout);
    expect(created.map((c) => c.worker.terminate.mock.calls.length)).toEqual([1, 1]);
    // The next file starts a fresh engine and works.
    const next = await convertWithRetry(new Uint8Array(10), { outputFormat: 'pdf' }, 'b.docx');
    expect(next.data[0]).toBe(37);
    expect(created).toHaveLength(3);
  });

  it('does not wait on a normal conversion', async () => {
    const { convertWithRetry } = await import('./libreoffice');
    expect((await convertWithRetry(new Uint8Array(10), { outputFormat: 'pdf' }, 'a.docx')).data[0]).toBe(37);
    expect(created).toHaveLength(1);
  });

  it('accepts engine files the host already unzipped', async () => {
    const plain = vi.fn(async () => new Response('already plain'));
    vi.stubGlobal('fetch', plain);
    const { convertWithRetry } = await import('./libreoffice');
    expect((await convertWithRetry(new Uint8Array(10), { outputFormat: 'pdf' }, 'a.docx')).data[0]).toBe(37);
    expect(plain).toHaveBeenCalledTimes(2);
  });
});
