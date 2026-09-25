/**
 * Render the widescreen launch film and the posters.
 *
 *   node launch/film/render.mjs              the film -> launch/nhako-tools-film.mp4
 *   node launch/film/render.mjs --stills     check frames -> launch/film/out/
 *   node launch/film/render.mjs --stills 19.5,31
 *   node launch/film/render.mjs --serve      serve the scene; open the URL with ?play or ?t=19.5
 *   node launch/film/render.mjs --posters    every poster -> launch/posters/
 *   node launch/film/render.mjs --banner     the README banner -> docs/brand/banner.png
 *
 * Time never runs on its own: each frame calls renderFrame(t) with an exact t
 * and screenshots the result. Needs capture.mjs's shots and the soundtrack
 * (node launch/video/audio.mjs launch/film/timeline.mjs) first.
 */
/* global window */
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SPRITES, PALETTE, BUTTERFLY_COLORS } from '../../src/lib/butterfly.ts';
import { W, H, FPS, DURATION } from './timeline.mjs';
import { POSTERS } from './posters.config.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const HERE = fileURLToPath(new URL('./', import.meta.url));
const OUT = join(HERE, 'out');
const FINAL = join(ROOT, 'launch', 'nhako-tools-film.mp4');
const mode = process.argv[2] ?? '--video';

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json',
  '.png': 'image/png', '.woff2': 'font/woff2', '.wav': 'audio/wav', '.css': 'text/css' };
/** The butterflies as a module the page can import: the site's own sprites, not a copy. */
const DATA = `export const SPRITES = ${JSON.stringify(SPRITES)};
export const PALETTE = ${JSON.stringify(PALETTE)};
export const BUTTERFLY_COLORS = ${JSON.stringify(BUTTERFLY_COLORS)};
`;

const server = createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (path === '/launch/video/data.js') {
    res.writeHead(200, { 'content-type': 'text/javascript' });
    return res.end(DATA);
  }
  const file = normalize(join(ROOT, path));
  if (!file.startsWith(ROOT) || !existsSync(file)) {
    res.writeHead(404);
    return res.end();
  }
  res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
  res.end(await readFile(file));
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}/launch/film/`;

async function open(browser, url, viewport, scale = 1) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: scale });
  page.on('pageerror', (e) => console.error('page error:', e.message));
  page.on('console', (m) => { if (m.type() === 'warning' || m.type() === 'error') console.error(`  ${m.type()}: ${m.text()}`); });
  await page.goto(url);
  await page.waitForFunction(() => window.sceneReady === true, null, { timeout: 60_000 });
  return page;
}

if (mode === '--serve') {
  console.log(`${BASE}scene.html?play  (Ctrl+C to stop)`);
  console.log(`${BASE}posters.html?p=hero`);
} else if (mode === '--posters' || mode === '--banner') {
  const browser = await chromium.launch();
  const dir = join(ROOT, 'launch', 'posters');
  await mkdir(dir, { recursive: true });
  const wanted = mode === '--banner' ? ['banner'] : (process.argv[3]?.split(',') ?? Object.keys(POSTERS).filter((k) => k !== 'banner'));
  for (const name of wanted) {
    const p = POSTERS[name];
    const page = await open(browser, `${BASE}posters.html?p=${name}`, { width: p.w, height: p.h }, p.scale ?? 2);
    const guard = await page.evaluate(() => window.__guard);
    if (guard.length) console.error(`  FAIL ${name}: a butterfly touches a screen: ${JSON.stringify(guard)}`);
    const target = name === 'banner' ? join(ROOT, 'docs', 'brand', 'banner.png') : join(dir, `${name}.png`);
    await page.screenshot({ path: target });
    console.log(`  ${target.replace(ROOT, '')}`);
    await page.close();
  }
  await browser.close();
} else {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch();
  const page = await open(browser, `${BASE}scene.html`, { width: W, height: H });
  const cdp = await page.context().newCDPSession(page);
  const grab = async (t) => {
    await page.evaluate((t) => window.renderFrame(t), t);
    const { data } = await cdp.send('Page.captureScreenshot', { format: 'png', optimizeForSpeed: true });
    return Buffer.from(data, 'base64');
  };
  if (mode === '--stills') {
    const times = (process.argv[3] ?? '1.5,4.6,6,10.5,14.8,16.8,19.8,23,26.5,28.2,29.2,32,37,38.5,41.5,44.5,48,52,56').split(',').map(Number);
    for (const t of times) {
      await writeFile(join(OUT, `still-${t.toFixed(1)}.png`), await grab(t));
      console.log(`  out/still-${t.toFixed(1)}.png`);
    }
  } else {
    const wav = join(OUT, 'soundtrack.wav');
    if (!existsSync(wav)) throw new Error('No soundtrack yet: run node launch/video/audio.mjs launch/film/timeline.mjs first.');
    const ff = spawn('ffmpeg', [
      '-y', '-hide_banner', '-loglevel', 'error',
      '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'png', '-i', '-',
      '-i', wav,
      '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', '-profile:v', 'high',
      '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709',
      '-c:a', 'aac', '-b:a', '192k', '-ar', '48000',
      '-movflags', '+faststart', '-shortest', FINAL,
    ], { stdio: ['pipe', 'inherit', 'inherit'] });
    const done = new Promise((r, j) => ff.on('close', (c) => (c === 0 ? r() : j(new Error(`ffmpeg exited ${c}`)))));
    const frames = Math.round(DURATION * FPS);
    const started = Date.now();
    for (let f = 0; f < frames; f++) {
      const png = await grab(f / FPS);
      if (!ff.stdin.write(png)) await new Promise((r) => ff.stdin.once('drain', r));
      if (f % 150 === 0) console.log(`  frame ${f}/${frames}  ${((Date.now() - started) / 1000).toFixed(0)}s`);
    }
    ff.stdin.end();
    await done;
    const guard = await page.evaluate(() => window.__guard);
    if (guard.length) console.error(`  WARNING: the guard hid a butterfly ${guard.length} times; run check.mjs`);
    console.log(`  ${FINAL}`);
  }
  await browser.close();
}
if (mode !== '--serve') server.close();
