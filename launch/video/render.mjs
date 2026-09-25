/**
 * Render the launch video: scene.html, one frame at a time, into ffmpeg, with
 * the soundtrack from audio.mjs muxed in.
 *
 *   node launch/video/render.mjs              the whole video -> launch/nhako-tools-launch.mp4
 *   node launch/video/render.mjs --stills     a few frames as PNGs in launch/video/out/, to check
 *   node launch/video/render.mjs --serve      serve the scene; open the printed URL with ?play
 *   node launch/video/render.mjs --banner     the README banner (banner.html) -> docs/brand/banner.png
 *   node launch/video/render.mjs --poster     one frame of the end card -> launch/poster.png
 *
 * Time never runs on its own here: every frame calls renderFrame(t) with an
 * exact t and screenshots the result, so the output does not depend on how
 * fast this machine is. Needs the captures from capture.mjs first.
 */
/* global window */
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SPRITES, PALETTE, BUTTERFLY_COLORS } from '../../src/lib/butterfly.ts';
import { ICON, PALETTE as ICON_PALETTE, rounded } from '../../scripts/logo-art.mjs';
import { W, H, FPS, DURATION } from './timeline.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const HERE = fileURLToPath(new URL('./', import.meta.url));
const OUT = join(HERE, 'out');
const FINAL = join(ROOT, 'launch', 'nhako-tools-launch.mp4');
const mode = process.argv[2] ?? '--video';

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json',
  '.png': 'image/png', '.woff2': 'font/woff2', '.wav': 'audio/wav', '.css': 'text/css' };

/** The sprites as a module the page can import: the site's own data, not a copy. */
const DATA = `export const SPRITES = ${JSON.stringify(SPRITES)};
export const PALETTE = ${JSON.stringify(PALETTE)};
export const BUTTERFLY_COLORS = ${JSON.stringify(BUTTERFLY_COLORS)};
export const ICON = ${JSON.stringify(rounded(ICON))};
export const ICON_PALETTE = ${JSON.stringify(ICON_PALETTE)};
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
const URL_ = `http://127.0.0.1:${server.address().port}/launch/video/scene.html`;

if (mode === '--serve') {
  console.log(`${URL_}?play  (Ctrl+C to stop)`);
} else if (mode === '--banner') {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 560 }, deviceScaleFactor: 2 });
  await page.goto(URL_.replace('scene.html', 'banner.html'));
  await page.waitForFunction(() => window.sceneReady === true);
  await mkdir(join(ROOT, 'docs', 'brand'), { recursive: true });
  await page.screenshot({ path: join(ROOT, 'docs', 'brand', 'banner.png') });
  console.log('  docs/brand/banner.png');
  await browser.close();
  server.close();
} else {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => console.error('page error:', e.message));
  await page.goto(URL_);
  await page.waitForFunction(() => window.sceneReady === true, null, { timeout: 30_000 });
  const cdp = await page.context().newCDPSession(page);
  const grab = async (t) => {
    await page.evaluate((t) => window.renderFrame(t), t);
    const { data } = await cdp.send('Page.captureScreenshot', { format: 'png', optimizeForSpeed: true });
    return Buffer.from(data, 'base64');
  };

  if (mode === '--poster') {
    const { writeFile } = await import('node:fs/promises');
    await writeFile(join(ROOT, 'launch', 'poster.png'), await grab(56));
    console.log('  launch/poster.png');
  } else if (mode === '--stills') {
    const times = (process.argv[3] ?? '1.2,2.6,4.9,10.5,15.5,19.7,20.4,22.6,27.0,29.0,32.5,37.5,41.2,43.8,46.8,49.0,51.4,52.4,56').split(',').map(Number);
    const { writeFile } = await import('node:fs/promises');
    for (const t of times) {
      await writeFile(join(OUT, `still-${t.toFixed(1)}.png`), await grab(t));
      console.log(`  out/still-${t.toFixed(1)}.png`);
    }
  } else {
    const wav = join(OUT, 'soundtrack.wav');
    if (!existsSync(wav)) throw new Error('No soundtrack yet: run node launch/video/audio.mjs first.');
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
    console.log(`  ${FINAL}`);
  }
  await browser.close();
  server.close();
}
