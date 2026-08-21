/**
 * Static preview server that mirrors production headers.
 *
 * Astro's built-in preview does not apply the COOP/COEP headers from
 * vercel.json, so SharedArrayBuffer is unavailable and every media tool fails
 * locally in a way it never would in production. Serving dist ourselves keeps
 * local verification honest.
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, normalize } from 'node:path';

const ROOT = new URL('../dist/', import.meta.url).pathname;
const PORT = Number(process.env.PORT ?? 4321);

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml',
  '.wasm': 'application/wasm', '.woff2': 'font/woff2', '.xml': 'application/xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.txt': 'text/plain; charset=utf-8',
};

async function resolve(pathname) {
  // Contain path traversal before touching the filesystem.
  const safe = normalize(decodeURIComponent(pathname)).replace(/^(\.\.[/\\])+/, '');
  for (const candidate of [join(ROOT, safe), join(ROOT, safe, 'index.html'), join(ROOT, `${safe}.html`)]) {
    if (!candidate.startsWith(ROOT)) continue;
    try {
      if ((await stat(candidate)).isFile()) return candidate;
    } catch { /* try the next shape */ }
  }
  return null;
}

createServer(async (req, res) => {
  const { pathname } = new URL(req.url ?? '/', `http://localhost:${PORT}`);
  const file = await resolve(pathname);

  const headers = {
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Embedder-Policy': 'require-corp',
    'X-Content-Type-Options': 'nosniff',
  };

  if (!file) {
    const notFound = await resolve('/404');
    res.writeHead(404, { ...headers, 'Content-Type': 'text/html; charset=utf-8' });
    res.end(notFound ? await readFile(notFound) : 'Not found');
    return;
  }

  res.writeHead(200, { ...headers, 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream' });
  res.end(await readFile(file));
}).listen(PORT, () => {
  console.log(`preview  http://localhost:${PORT}  (cross-origin isolated)`);
});
