import type { FileToolResult, OptionValues } from './types';
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

export interface RunHandle {
  result: Promise<FileToolResult>;
  cancel(): void;
}

let worker: Worker | null = null;
let nextTicket = 1;

function getWorker(): Worker {
  worker ??= new Worker(new URL('../workers/tool.worker.ts', import.meta.url), { type: 'module' });
  return worker;
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
  if (!WORKER_SAFE.has(id) || typeof Worker === 'undefined') {
    return { result: runInline(id, files, options, onProgress), cancel: () => {} };
  }

  try {
    const w = getWorker();
    const ticket = nextTicket++;
    let settled = false;

    const result = new Promise<FileToolResult>((resolve, reject) => {
      const onMessage = (event: MessageEvent) => {
        const msg = event.data as { ticket: number; kind: string; [k: string]: unknown };
        if (msg.ticket !== ticket) return;

        if (msg.kind === 'progress') {
          onProgress(msg.progress as number, msg.label as string | undefined);
          return;
        }

        settled = true;
        w.removeEventListener('message', onMessage);
        if (msg.kind === 'done') resolve(msg.result as FileToolResult);
        else reject(new Error(msg.message as string));
      };

      w.addEventListener('message', onMessage);
      w.addEventListener('error', () => {
        if (settled) return;
        settled = true;
        w.removeEventListener('message', onMessage);
        // The worker died — redo the work inline rather than failing the user.
        runInline(id, files, options, onProgress).then(resolve, reject);
      }, { once: true });

      w.postMessage({ ticket, id, files, options });
    });

    return { result, cancel: () => { settled = true; } };
  } catch {
    return { result: runInline(id, files, options, onProgress), cancel: () => {} };
  }
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
