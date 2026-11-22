import type { FileToolResult, OptionValues } from './types';
import { ToolError } from './types';
import { trackEvent } from '../lib/events';
import { loadTool } from './loaders';
import { WORKER_TOOLS } from '../workers/worker-tools';

/**
 * Tools whose work is pure computation over ArrayBuffers, with no DOM
 * dependency. These are the ones that visibly froze the tab on large inputs,
 * so they move to a worker.
 *
 * Everything else stays on the main thread for a concrete reason:
 *   - pdf/to-image, pdf/compress   pdf.js page rendering wants a real canvas
 *   - image/*                      createImageBitmap + canvas encoding
 *   - media/compress-video, extract-audio   ffmpeg.wasm runs its own worker
 *   - media/transcribe             needs AudioContext, and transformers.js
 *                                  already threads its inference
 */
const WORKER_SAFE = new Set(Object.keys(WORKER_TOOLS));
const FFMPEG_TOOLS = new Set(['media/compress-video', 'media/extract-audio']);

export interface RunHandle {
  result: Promise<FileToolResult>;
  /** Stop the work. The result promise never settles after this. */
  cancel(): void;
}

let worker: Worker | null = null;
let nextTicket = 1;

function getWorker(): Worker {
  worker ??= new Worker(new URL('../workers/tool.worker.ts', import.meta.url), { type: 'module' });
  return worker;
}

/** Throw the current worker away so the next run starts a fresh one. */
function discardWorker(w: Worker) {
  w.terminate();
  if (worker === w) worker = null;
}

/**
 * Run a file tool, off the main thread where that is safe.
 *
 * Falls back to running inline if the worker cannot start at all (older
 * browsers, blocked module workers), so a worker problem degrades to a busy
 * tab rather than a broken tool.
 */
export function runFileTool(
  id: string,
  files: File[],
  options: OptionValues,
  onProgress: (progress: number, label?: string) => void,
): RunHandle {
  return tracked(id, files, startFileTool(id, files, options, onProgress));
}

/**
 * Anonymous task events around a run (src/lib/events.ts): start, then exactly
 * one of ok, error or cancel. Observes the handle only; the run itself is
 * unchanged, and a run whose result is never awaited still reports.
 */
function tracked(id: string, files: File[], handle: RunHandle): RunHandle {
  const t0 = performance.now();
  const bytes = files.reduce((n, f) => n + f.size, 0);
  let done = false;
  trackEvent(id, 'run_start', { files: files.length, bytes });
  handle.result.then(
    () => { if (!done) { done = true; trackEvent(id, 'run_ok', { files: files.length, bytes, ms: performance.now() - t0 }); } },
    (e: unknown) => {
      if (done) return;
      done = true;
      // Errors from the worker arrive as plain Errors, so only an inline
      // ToolError can be told apart; anything else is left unclassified.
      trackEvent(id, 'run_error', { files: files.length, bytes, ms: performance.now() - t0, ...(e instanceof ToolError ? { error: 'tool' as const } : {}) });
    },
  );
  return {
    result: handle.result,
    cancel: () => {
      if (!done) { done = true; trackEvent(id, 'run_cancel', { files: files.length, bytes, ms: performance.now() - t0 }); }
      handle.cancel();
    },
  };
}

function startFileTool(
  id: string,
  files: File[],
  options: OptionValues,
  onProgress: (progress: number, label?: string) => void,
): RunHandle {
  if (!WORKER_SAFE.has(id) || typeof Worker === 'undefined') {
    return inlineHandle(id, files, options, onProgress);
  }

  try {
    const w = getWorker();
    const ticket = nextTicket++;
    let settled = false;
    let cleanup = () => {};

    const result = new Promise<FileToolResult>((resolve, reject) => {
      const onMessage = (event: MessageEvent) => {
        const msg = event.data as { ticket: number; kind: string; [k: string]: unknown };
        if (msg.ticket !== ticket || settled) return;

        if (msg.kind === 'progress') {
          onProgress(msg.progress as number, msg.label as string | undefined);
          return;
        }

        settled = true;
        cleanup();
        if (msg.kind === 'done') resolve(msg.result as FileToolResult);
        else reject(new Error(msg.message as string));
      };

      const onError = () => {
        if (settled) return;
        settled = true;
        cleanup();
        // A worker that failed once is not reused: it may never answer again,
        // which would leave every later run waiting forever.
        discardWorker(w);
        // Redo the work inline rather than failing the user.
        runInline(id, files, options, onProgress).then(resolve, reject);
      };

      cleanup = () => {
        w.removeEventListener('message', onMessage);
        w.removeEventListener('error', onError);
        w.removeEventListener('messageerror', onError);
      };

      w.addEventListener('message', onMessage);
      w.addEventListener('error', onError);
      // A result that cannot be deserialized fires messageerror, not message:
      // without this the run would wait forever. Same recovery as a crash.
      w.addEventListener('messageerror', onError);
      w.postMessage({ ticket, id, files, options });
    });

    return {
      result,
      cancel: () => {
        if (settled) return;
        settled = true;
        cleanup();
        // The worker is single-threaded and busy with this job; terminating
        // it is the only way to actually stop the work.
        discardWorker(w);
      },
    };
  } catch {
    return inlineHandle(id, files, options, onProgress);
  }
}

/** Inline work is stopped where the engine allows it, and ignored otherwise. */
function inlineHandle(
  id: string,
  files: File[],
  options: OptionValues,
  onProgress: (progress: number, label?: string) => void,
): RunHandle {
  let cancelled = false;
  const result = new Promise<FileToolResult>((resolve, reject) => {
    runInline(id, files, options, (p, l) => { if (!cancelled) onProgress(p, l); })
      .then((r) => { if (!cancelled) resolve(r); }, (e) => { if (!cancelled) reject(e); });
  });
  return {
    result,
    cancel: () => {
      cancelled = true;
      // The ffmpeg tools can genuinely be stopped: terminate its worker.
      if (FFMPEG_TOOLS.has(id)) void import('../lib/ffmpeg').then((m) => m.abortFFmpeg());
    },
  };
}

async function runInline(
  id: string,
  files: File[],
  options: OptionValues,
  onProgress: (progress: number, label?: string) => void,
): Promise<FileToolResult> {
  const mod = await loadTool(id);
  const run = mod.run as (
    f: File[],
    o: OptionValues,
    c: { onProgress(p: number, l?: string): void },
  ) => Promise<FileToolResult>;
  return run(files, options, { onProgress });
}
