/**
 * Download a model file once and keep it in the browser's Cache Storage, so
 * later visits start instantly and work offline. The URL must be immutable
 * (pinned to a revision): a cached copy is never checked for updates.
 *
 * The site's service worker does not cache these: they are cross-origin and
 * large, and it only handles this site's own files.
 */
const CACHE = 'nhako-models-v1';

export async function cachedDownload(url: string, onProgress: (fraction: number) => void): Promise<Uint8Array> {
  let cache: Cache | null = null;
  try {
    cache = await caches.open(CACHE);
    const hit = await cache.match(url);
    if (hit) {
      onProgress(1);
      return new Uint8Array(await hit.arrayBuffer());
    }
  } catch { /* no Cache Storage (private window): just download */ }

  const response = await fetch(url, { mode: 'cors', credentials: 'omit' });
  if (!response.ok || !response.body) throw new Error(`download failed: ${response.status}`);
  const total = Number(response.headers.get('content-length')) || 0;
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let loaded = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loaded += value.length;
    if (total) onProgress(Math.min(1, loaded / total));
  }
  const bytes = new Uint8Array(loaded);
  let at = 0;
  for (const c of chunks) { bytes.set(c, at); at += c.length; }
  onProgress(1);
  try {
    await cache?.put(url, new Response(bytes, { headers: { 'content-type': 'application/octet-stream' } }));
  } catch { /* quota: still usable this time */ }
  return bytes;
}
