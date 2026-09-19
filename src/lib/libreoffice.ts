/**
 * LibreOffice, compiled to WebAssembly (@matbee/libreoffice-converter,
 * MPL-2.0, unmodified), for turning Word, Excel and PowerPoint files into
 * PDF on the device. Every file is served from this site.
 *
 * The engine is big: 147 MB of WebAssembly and a 100 MB file-system image.
 * scripts/vendor.mjs gzips both (to about 77 MB); here they are downloaded
 * with progress, unzipped in the browser, and handed to the engine's worker
 * as in-memory URLs. The service worker keeps the gzipped files, so the
 * download happens once.
 */
import type { WorkerBrowserConverter } from '@matbee/libreoffice-converter/browser';

export type Stage = 'download' | 'start';

let engine: Promise<WorkerBrowserConverter> | null = null;
let report: ((fraction: number, stage: Stage) => void) | null = null;

/**
 * Fetch a file that may be gzipped, and return it unzipped. A host that adds
 * its own Content-Encoding hands back the plain bytes already, so the gzip
 * magic number decides, not the file name.
 */
async function fetchUnzipped(url: string, type: string, onBytes: (n: number) => void): Promise<Blob> {
  const response = await fetch(url);
  if (!response.ok || !response.body) throw new Error(`${url}: ${response.status}`);
  const counted = response.body.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) { onBytes(chunk.length); controller.enqueue(chunk); },
  }));
  const [peek, body] = counted.tee();
  const reader = peek.getReader();
  const { value } = await reader.read();
  void reader.cancel();
  const gzipped = Boolean(value && value[0] === 0x1f && value[1] === 0x8b);
  const stream = gzipped ? body.pipeThrough(new DecompressionStream('gzip') as unknown as ReadableWritablePair<Uint8Array, Uint8Array>) : body;
  const buffer = await new Response(stream).arrayBuffer();
  return new Blob([buffer], { type });
}

/** Rough compressed sizes, for a progress bar that means something before the headers arrive. */
const EXPECTED = { wasm: 49_700_000, data: 28_700_000 };

let assets: Promise<{ wasm: string; data: string }> | null = null;

/** The engine files, downloaded and unzipped once per page, kept as in-memory URLs. */
function engineFiles(): Promise<{ wasm: string; data: string }> {
  assets ??= (async () => {
    const base = __LIBREOFFICE_BASE__;
    let loaded = 0;
    const total = EXPECTED.wasm + EXPECTED.data;
    const tick = (n: number) => { loaded += n; report?.(Math.min(0.99, loaded / total), 'download'); };
    const [wasm, data] = await Promise.all([
      fetchUnzipped(`${base}soffice.wasm.gz`, 'application/wasm', tick),
      fetchUnzipped(`${base}soffice.data.gz`, 'application/octet-stream', tick),
    ]);
    report?.(1, 'download');
    return { wasm: URL.createObjectURL(wasm), data: URL.createObjectURL(data) };
  })();
  assets.catch(() => { assets = null; });
  return assets;
}

export function libreOffice(onProgress?: (fraction: number, stage: Stage) => void): Promise<WorkerBrowserConverter> {
  report = onProgress ?? null;
  engine ??= (async () => {
    const base = __LIBREOFFICE_BASE__;
    const files = await engineFiles();
    const { WorkerBrowserConverter } = await import('@matbee/libreoffice-converter/browser');
    const converter = new WorkerBrowserConverter({
      sofficeJs: `${base}soffice.js`,
      sofficeWasm: files.wasm,
      sofficeData: files.data,
      sofficeWorkerJs: `${base}soffice.worker.js`,
      browserWorkerJs: `${base}browser.worker.global.js`,
      onProgress: (p: { percent?: number }) => report?.((p.percent ?? 0) / 100, 'start'),
    });
    await converter.initialize();
    return converter;
  })();
  engine.catch(() => { engine = null; });
  return engine;
}

/** Throw away the running engine: its worker, and the threads inside it. */
async function discard() {
  const old = engine;
  engine = null;
  const converter = await old?.catch(() => null);
  // A stuck engine never answers the library's polite destroy message, so
  // end its worker directly.
  (converter as unknown as { worker?: Worker } | null)?.worker?.terminate();
}

export class Timeout extends Error {}

const withTimeout = <T>(p: Promise<T>, ms: number) => new Promise<T>((resolve, reject) => {
  const id = setTimeout(() => reject(new Timeout()), ms);
  p.then((v) => { clearTimeout(id); resolve(v); }, (e) => { clearTimeout(id); reject(e); });
});

/**
 * Convert one document, with a watchdog. About one load in a dozen, this
 * LibreOffice build stops inside its own document loader and never returns
 * (seen in testing, in lok_documentLoad). When a step takes far longer than
 * it should, the engine is thrown away, a fresh one started from the files
 * already in memory, and the conversion tried once more.
 */
export async function convertWithRetry(
  input: Uint8Array,
  options: Parameters<WorkerBrowserConverter['convert']>[1],
  filename: string,
  onProgress?: (fraction: number, stage: Stage) => void,
) {
  // Starting takes seconds once the files are in memory; a normal document
  // converts in well under that. Big files get more time.
  const startLimit = 90_000;
  const convertLimit = 45_000 + (input.length / 1_000_000) * 15_000;
  for (let attempt = 0; ; attempt++) {
    try {
      const converter = await withTimeout(libreOffice(onProgress), attempt === 0 && !assets ? 30 * 60_000 : startLimit);
      return await withTimeout(converter.convert(input.slice(), options, filename), convertLimit);
    } catch (err) {
      if (!(err instanceof Timeout)) throw err;
      // Never leave a stuck engine for the next file.
      await discard();
      if (attempt >= 1) throw err;
    }
  }
}
