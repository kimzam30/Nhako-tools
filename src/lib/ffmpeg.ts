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

/**
 * Read a video's duration without decoding the whole file.
 *
 * Three separate ways this used to fail, all of which left the promise pending
 * forever and the UI spinning with no error at all:
 *
 *  1. A detached <video> may never start loading, so neither `loadedmetadata`
 *    nor `error` fires and readyState stays 0. It is now in the document
 *    (visually hidden) and `load()` is called explicitly.
 *  2. Files written by MediaRecorder carry no duration in the header, so the
 *    browser reports Infinity. Seeking past the end forces it to resolve.
 *  3. Nothing bounded the wait. There is now a timeout that reports a real
 *    error instead of hanging.
 */
function durationFromBrowser(file: File, budgetMs: number): Promise<number> {
  return new Promise((resolve, reject) => {
    const el = document.createElement('video');
    const url = URL.createObjectURL(file);
    let settled = false;

    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      URL.revokeObjectURL(url);
      el.remove();
      fn();
    };

    const ok = (seconds: number) => finish(() => resolve(seconds));
    const fail = (message: string) => finish(() => reject(new ToolError(message)));

    const timer = setTimeout(() => fail('browser could not read the duration in time'), budgetMs);

    el.preload = 'metadata';
    el.muted = true;
    el.playsInline = true;
    el.style.cssText = 'position:fixed;left:-9999px;top:0;width:1px;height:1px;opacity:0;pointer-events:none';

    el.onloadedmetadata = () => {
      if (Number.isFinite(el.duration) && el.duration > 0) {
        ok(el.duration);
        return;
      }
      // Duration unknown: force the browser to work it out by seeking beyond
      // the end, then reading it back.
      el.ontimeupdate = () => {
        el.ontimeupdate = null;
        if (Number.isFinite(el.duration) && el.duration > 0) ok(el.duration);
        else fail('duration unavailable after seek');
      };
      el.currentTime = 1e101;
    };

    el.onerror = () => fail('browser could not decode this container');

    document.body.appendChild(el);
    el.src = url;
    el.load();
  });
}

/**
 * Ask ffmpeg how long the file is.
 *
 * Running with an input and no output makes ffmpeg print the stream summary and
 * exit; that is enough to read `Duration:` out of the log, and it does not
 * decode the file. Slower to reach than the browser path because it needs the
 * wasm core, but it understands every container ffmpeg can process, which is
 * the whole point of the fallback.
 */
async function durationFromFFmpeg(file: File, onProgress?: (label: string) => void): Promise<number> {
  const { fetchFile } = await import('@ffmpeg/util');
  const input = 'probe.bin';

  return withFiles({ [input]: await fetchFile(file) }, [], async (ffmpeg) => {
    const run = async (args: string[]) => {
      let log = '';
      const collect = ({ message }: { message: string }) => { log += message + '\n'; };
      ffmpeg.on('log', collect);
      try {
        await ffmpeg.exec(args);
      } catch {
        // The log is what matters here, not the exit code.
      } finally {
        ffmpeg.off('log', collect);
      }
      return log;
    };

    const toSeconds = (h: string, m: string, sec: string) =>
      Number(h) * 3600 + Number(m) * 60 + Number(sec);

    // Cheap: ffmpeg prints the stream summary and exits without decoding.
    const header = await run(['-i', input]);
    const stated = header.match(/Duration:\s*(\d+):(\d\d):(\d\d(?:\.\d+)?)/);
    if (stated) return toSeconds(stated[1]!, stated[2]!, stated[3]!);

    // Files written by MediaRecorder (screen recordings, most obviously) have
    // no duration in the header at all, so ffmpeg reports N/A. Decoding to null
    // makes it count the frames and report how far it got. Slower, and the only
    // way to get an answer for these files.
    onProgress?.('Measuring length');
    const decoded = await run(['-i', input, '-f', 'null', '-']);
    const times = [...decoded.matchAll(/time=\s*(\d+):(\d\d):(\d\d(?:\.\d+)?)/g)];
    const last = times.at(-1);
    if (last) return toSeconds(last[1]!, last[2]!, last[3]!);

    throw new ToolError(
      `Could not work out how long "${file.name}" is. The file may be corrupt or use an unsupported codec.`,
    );
  });
}

/**
 * Duration of a video, by whichever route works.
 *
 * The browser is tried first because it answers in milliseconds without
 * touching the 30 MB wasm core. It is also unreliable: a detached element may
 * never fire an event, and files written by MediaRecorder carry no duration in
 * the header. So it gets a short budget, and ffmpeg settles it otherwise.
 */
export async function probeDuration(file: File, onProgress?: (label: string) => void): Promise<number> {
  try {
    return await durationFromBrowser(file, 6_000);
  } catch {
    return durationFromFFmpeg(file, onProgress);
  }
}
