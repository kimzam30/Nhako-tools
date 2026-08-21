/** Human-readable byte size. Always 1024-based, matching what an OS reports. */
export function bytes(n: number): string {
  if (!Number.isFinite(n) || n < 0) return 'n/a';
  if (n < 1024) return `${n} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let v = n / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v < 10 ? v.toFixed(1) : Math.round(v)} ${units[i]}`;
}

/** Elapsed time, tuned so the common case reads as obviously fast. */
export function duration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return 'n/a';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const m = Math.floor(ms / 60_000);
  return `${m}m ${Math.round((ms % 60_000) / 1000)}s`;
}

export function pct(a: number, b: number): string {
  if (!b) return 'n/a';
  return `${Math.round((1 - a / b) * 100)}%`;
}

/**
 * Wrap raw bytes in a Blob.
 *
 * pdf-lib returns `Uint8Array<ArrayBufferLike>`, which TypeScript will not
 * accept as a BlobPart because the buffer could in principle be a
 * SharedArrayBuffer. Copying into a fresh view settles it, and the copy is
 * negligible next to the work that produced the bytes.
 */
export function bytesToBlob(bytes: Uint8Array, type: string): Blob {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return new Blob([copy], { type });
}
