import type { ToolModule } from '../tools/types';

/**
 * The tools the worker can run, and nothing else.
 *
 * This deliberately does NOT reuse src/tools/loaders.ts. Vite compiles workers
 * as a separate Rollup build, so importing the full loader map dragged every
 * tool's dependency graph (ffmpeg, transformers.js, pdf.js) into that build too
 * and re-emitted all of it: 82 chunks where 42 were needed.
 *
 * Kept in sync with WORKER_SAFE in run-tool.ts by worker-tools.test.ts.
 */
export const WORKER_TOOLS: Record<string, () => Promise<ToolModule>> = {
  'pdf/merge': () => import('../tools/pdf/merge'),
  'pdf/split': () => import('../tools/pdf/split'),
  'pdf/rotate': () => import('../tools/pdf/rotate'),
  'pdf/watermark': () => import('../tools/pdf/watermark'),
  'pdf/to-text': () => import('../tools/pdf/to-text'),
};
