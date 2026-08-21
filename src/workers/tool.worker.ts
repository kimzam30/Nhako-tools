/**
 * Runs a tool's pure `run()` off the main thread.
 *
 * Only tools that are CPU-bound and DOM-free are routed here (see
 * WORKER_SAFE in run-tool.ts). Anything needing DOM APIs — pdf.js canvas
 * rendering, ffmpeg's own worker, the AudioContext in transcribe — stays on
 * the main thread, where it already has what it needs.
 */
import { WORKER_TOOLS } from './worker-tools';
import type { FileToolResult, OptionValues } from '../tools/types';

export interface WorkerRequest {
  ticket: number;
  id: string;
  files: File[];
  options: OptionValues;
}

export type WorkerResponse =
  | { ticket: number; kind: 'progress'; progress: number; label?: string }
  | { ticket: number; kind: 'done'; result: FileToolResult }
  | { ticket: number; kind: 'error'; message: string };

self.addEventListener('message', async (event: MessageEvent<WorkerRequest>) => {
  const { ticket, id, files, options } = event.data;
  const post = (msg: WorkerResponse) => self.postMessage(msg);

  try {
    const loader = WORKER_TOOLS[id];
    if (!loader) throw new Error(`${id} is not available in the worker`);
    const mod = await loader();
    const run = mod.run as (
      f: File[],
      o: OptionValues,
      c: { onProgress(p: number, l?: string): void },
    ) => Promise<FileToolResult>;

    const result = await run(files, options, {
      onProgress: (progress, label) => post({ ticket, kind: 'progress', progress, label }),
    });

    post({ ticket, kind: 'done', result });
  } catch (err) {
    post({
      ticket,
      kind: 'error',
      message: err instanceof Error ? err.message : 'Something went wrong running this tool.',
    });
  }
});
