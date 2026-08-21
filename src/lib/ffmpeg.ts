import type { FFmpeg } from '@ffmpeg/ffmpeg';
import { ToolError } from '../tools/types';

let instance: FFmpeg | null = null;
let progressHandler: ((fraction: number) => void) | null = null;

/**
 * Load ffmpeg.wasm from our own origin.
 *
 * The old build fetched the core from unpkg at runtime, so every media tool
 * broke if unpkg was unreachable. `npm run vendor` copies it into
 * public/vendor/ffmpeg at build time instead.
 */
export async function getFFmpeg(): Promise<FFmpeg> {
  if (instance) return instance;

  if (typeof SharedArrayBuffer === 'undefined') {
    throw new ToolError(
      'This browser is not cross-origin isolated, so the media tools cannot run. ' +
      'If you are self-hosting, the COOP/COEP headers in vercel.json are required.',
    );
  }

  const { FFmpeg: Ctor } = await import('@ffmpeg/ffmpeg');
  const ffmpeg = new Ctor();
  ffmpeg.on('progress', ({ progress }) => {
    if (progressHandler && progress >= 0 && progress <= 1) progressHandler(progress);
  });

  await ffmpeg.load({
    coreURL: '/vendor/ffmpeg/ffmpeg-core.js',
    wasmURL: '/vendor/ffmpeg/ffmpeg-core.wasm',
  });

  instance = ffmpeg;
  return ffmpeg;
}

export function onFFmpegProgress(fn: ((fraction: number) => void) | null) {
  progressHandler = fn;
}

/**
 * Run a job with guaranteed cleanup of the virtual filesystem.
 *
 * The old build never called deleteFile, so every file written during a session
 * stayed resident in the wasm heap and repeated operations grew memory until
 * the tab died.
 */
export async function withFiles<T>(
  files: Record<string, Uint8Array>,
  outputs: string[],
  job: (ffmpeg: FFmpeg) => Promise<T>,
): Promise<T> {
  const ffmpeg = await getFFmpeg();
  const written: string[] = [];
  try {
    for (const [name, data] of Object.entries(files)) {
      await ffmpeg.writeFile(name, data);
      written.push(name);
    }
    return await job(ffmpeg);
  } finally {
    for (const name of [...written, ...outputs]) {
      await ffmpeg.deleteFile(name).catch(() => {/* already gone */});
    }
    onFFmpegProgress(null);
  }
}

/** Read a video's duration without decoding it. */
export function probeDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const el = document.createElement('video');
    const url = URL.createObjectURL(file);
    const done = (fn: () => void) => { URL.revokeObjectURL(url); el.remove(); fn(); };
    el.preload = 'metadata';
    el.onloadedmetadata = () => done(() => resolve(el.duration));
    el.onerror = () => done(() => reject(new ToolError('Could not read that video. The container or codec may be unsupported.')));
    el.src = url;
  });
}
