/**
 * Proves the butterflies never cross a screen: renders every frame of the film
 * (and every poster), reads each visible butterfly's box and each visible
 * screen's box from the page, and fails on any overlap. It also fails if the
 * scene's own guard ever had to hide a fly, because a hidden fly would be a
 * butterfly blinking out mid-air: the flight plan itself must stay clear.
 *
 *   node launch/film/check.mjs            every frame of the film, then the posters
 *   node launch/film/check.mjs --step 3   every third frame
 */
/* global window */
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { FPS, DURATION } from './timeline.mjs';
import { POSTERS } from './posters.config.mjs';

const step = process.argv.includes('--step') ? Number(process.argv[process.argv.indexOf('--step') + 1]) : 1;
const srv = spawn('node', [new URL('./render.mjs', import.meta.url).pathname, '--serve']);
const url = await new Promise((r) => srv.stdout.on('data', (d) => r(String(d).split(/\s/)[0].replace('?play', ''))));
const browser = await chromium.launch();
const hits = (a, b) => a.l < b.r && a.r > b.l && a.t < b.b && a.b > b.t;
let failures = 0;

{
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await page.goto(url);
  await page.waitForFunction(() => window.sceneReady === true);
  const frames = Math.round(DURATION * FPS);
  let closest = Infinity;
  let checked = 0;
  for (let f = 0; f < frames; f += step) {
    const t = f / FPS;
    const { flies, screens } = await page.evaluate((t) => { window.renderFrame(t); return window.boxes(); }, t);
    for (const fl of flies) for (const s of screens) {
      if (hits(fl, s)) { failures++; console.log(`  OVERLAP at ${t.toFixed(3)} s: fly ${JSON.stringify(fl)} screen ${JSON.stringify(s)}`); }
      const gap = Math.max(s.l - fl.r, fl.l - s.r, s.t - fl.b, fl.t - s.b);
      closest = Math.min(closest, gap);
    }
    checked++;
  }
  const guard = await page.evaluate(() => window.__guard);
  if (guard.length) { failures += guard.length; console.log(`  GUARD fired ${guard.length} times, first: ${JSON.stringify(guard.slice(0, 5))}`); }
  console.log(`film: ${checked} frames, ${failures} problems, closest a butterfly came to a screen: ${closest.toFixed(1)} px`);
  await page.close();
}

for (const [name, p] of Object.entries(POSTERS)) {
  const page = await browser.newPage({ viewport: { width: p.w, height: p.h } });
  await page.goto(url.replace('scene.html', `posters.html?p=${name}`));
  const ok = await page.waitForFunction(() => window.sceneReady === true, null, { timeout: 30_000 }).then(() => true, () => false);
  if (!ok) { console.log(`poster ${name}: did not load`); failures++; await page.close(); continue; }
  const { flies, screens } = await page.evaluate(() => window.boxes());
  const guard = await page.evaluate(() => window.__guard);
  let bad = guard.length;
  let closest = Infinity;
  for (const fl of flies) for (const s of screens) {
    if (hits(fl, s)) bad++;
    closest = Math.min(closest, Math.max(s.l - fl.r, fl.l - s.r, s.t - fl.b, fl.t - s.b));
  }
  failures += bad;
  console.log(`poster ${name}: ${flies.length} butterflies, ${screens.length} screens, ${bad} problems, closest ${closest.toFixed(1)} px`);
  await page.close();
}

await browser.close();
srv.kill();
if (failures) { console.log(`FAIL: ${failures}`); process.exit(1); }
console.log('PASS: no butterfly touches a screen');
