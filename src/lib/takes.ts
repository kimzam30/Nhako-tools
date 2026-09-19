/**
 * Teleprompter recordings ("takes"), kept on this device.
 *
 * Each take is streamed to the browser's private file storage (the Origin
 * Private File System) a second at a time while it records, so a long take on
 * a tablet does not have to fit in memory, and takes survive a reload. Where
 * a browser cannot write files that way, the take is held in memory instead
 * and lasts until the page is closed; the list says which.
 */

export interface Take {
  name: string;
  size: number;
  created: number;
  type: string;
  /** False when the take lives in memory only and goes when the page closes. */
  saved: boolean;
}

const DIR = 'teleprompter-takes';
const memory = new Map<string, File>();

async function dir(): Promise<FileSystemDirectoryHandle | null> {
  try {
    const root = await navigator.storage.getDirectory();
    return await root.getDirectoryHandle(DIR, { create: true });
  } catch {
    return null;
  }
}

/** The best format this browser can record: MP4 where it can, else WebM. */
export function recordingType(): string {
  if (typeof MediaRecorder === 'undefined') return '';
  const candidates = [
    'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
    'video/mp4;codecs=avc1,mp4a.40.2',
    'video/mp4',
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
  ];
  return candidates.find((t) => MediaRecorder.isTypeSupported(t)) ?? '';
}

const extension = (type: string) => (type.startsWith('video/mp4') ? 'mp4' : 'webm');

function stampName(now: Date, type: string): string {
  const p = (n: number) => String(n).padStart(2, '0');
  const d = `${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}-${p(now.getHours())}${p(now.getMinutes())}${p(now.getSeconds())}`;
  return `take-${d}.${extension(type)}`;
}

export async function listTakes(): Promise<Take[]> {
  const out: Take[] = [...memory.values()].map((f) => ({ name: f.name, size: f.size, created: f.lastModified, type: f.type, saved: false }));
  const d = await dir();
  if (d) {
    for await (const handle of (d as unknown as { values(): AsyncIterable<FileSystemHandle> }).values()) {
      if (handle.kind !== 'file' || memory.has(handle.name)) continue;
      try {
        const f = await (handle as FileSystemFileHandle).getFile();
        if (f.size === 0) continue;
        out.push({ name: f.name, size: f.size, created: f.lastModified, type: typeOf(f.name), saved: true });
      } catch { /* a take still being written by another tab */ }
    }
  }
  return out.sort((a, b) => b.created - a.created);
}

const typeOf = (name: string) => (name.endsWith('.mp4') ? 'video/mp4' : 'video/webm');

export async function takeFile(name: string): Promise<File | null> {
  const m = memory.get(name);
  if (m) return m;
  try {
    const f = await (await (await dir())!.getFileHandle(name)).getFile();
    // OPFS files carry no type; give the player and the download one.
    return new File([f], name, { type: typeOf(name), lastModified: f.lastModified });
  } catch {
    return null;
  }
}

export async function deleteTake(name: string): Promise<void> {
  if (memory.delete(name)) return;
  try { await (await dir())?.removeEntry(name); } catch { /* already gone */ }
}

export interface Recording {
  readonly name: string;
  /** Stop and finish writing. Resolves once the take is complete. */
  stop(): Promise<Take>;
}

/**
 * Record `stream` to a new take. Throws if the browser cannot record at all.
 * `onError` hears about failures that happen after recording started, such
 * as the device running out of space.
 */
export async function startRecording(stream: MediaStream, onError: (e: unknown) => void, now = new Date()): Promise<Recording> {
  const type = recordingType();
  if (!type) throw new Error('recording-unsupported');
  const name = stampName(now, type);

  // Ask the browser not to clear takes under storage pressure. It may say no;
  // the takes are still stored, just evictable.
  void navigator.storage?.persist?.().catch(() => false);

  let writable: FileSystemWritableFileStream | null = null;
  let fileHandle: FileSystemFileHandle | null = null;
  const d = await dir();
  if (d) {
    try {
      fileHandle = await d.getFileHandle(name, { create: true });
      writable = await fileHandle.createWritable();
    } catch {
      // Safari has private file storage but, in some versions, no way to
      // stream into it from the page. Fall back to memory.
      writable = null;
      if (fileHandle) await d.removeEntry(name).catch(() => undefined);
    }
  }

  const chunks: Blob[] = [];
  let writing: Promise<unknown> = Promise.resolve();
  let failed = false;
  const recorder = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: 6_000_000, audioBitsPerSecond: 128_000 });
  recorder.ondataavailable = (e) => {
    if (!e.data.size) return;
    if (writable && !failed) {
      const w = writable;
      writing = writing.then(() => w.write(e.data)).catch((err) => { failed = true; onError(err); });
    } else {
      chunks.push(e.data);
    }
  };
  const stopped = new Promise<void>((resolve) => { recorder.onstop = () => resolve(); });
  recorder.onerror = (e) => onError(e);
  recorder.start(1000);

  return {
    name,
    async stop() {
      if (recorder.state !== 'inactive') recorder.stop();
      await stopped;
      if (writable) {
        await writing;
        await writable.close().catch(() => undefined);
        const f = await fileHandle!.getFile();
        return { name, size: f.size, created: now.getTime(), type: typeOf(name), saved: true };
      }
      const file = new File(chunks, name, { type: type.split(';')[0], lastModified: now.getTime() });
      memory.set(name, file);
      return { name, size: file.size, created: now.getTime(), type: file.type, saved: false };
    },
  };
}
