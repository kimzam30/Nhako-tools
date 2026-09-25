/**
 * The app screenshots in the web manifest.
 *
 * With them, Chrome on Android and on a desktop shows the richer install
 * sheet (screenshots under the name, like a store listing) instead of a
 * one-line "Install app?" dialog. `narrow` is what a phone shows, `wide` a
 * laptop. Taken from the real production build, so they cannot drift from
 * the site: run `npm run build`, start `npm run preview`, then this.
 *
 *   PORT=4400 node scripts/screenshots.mjs
 */
import { chromium } from '@playwright/test';

const BASE = `http://localhost:${process.env.PORT ?? 4321}`;
const shots = [
  { path: '/', out: 'public/screenshots/phone-home.png', viewport: { width: 393, height: 852 }, scale: 2, mobile: true },
  { path: '/pdf', out: 'public/screenshots/phone-pdf.png', viewport: { width: 393, height: 852 }, scale: 2, mobile: true },
  { path: '/', out: 'public/screenshots/wide-home.png', viewport: { width: 1280, height: 800 }, scale: 1, mobile: false },
];

const browser = await chromium.launch();
for (const s of shots) {
  const context = await browser.newContext({
    viewport: s.viewport, deviceScaleFactor: s.scale, isMobile: s.mobile, hasTouch: s.mobile, serviceWorkers: 'block',
  });
  const page = await context.newPage();
  // No install card over the picture of the app it installs.
  await page.addInitScript(() => {
    try { localStorage.setItem('nhako:install-snooze', String(Date.now() + 864e5)); } catch { /* ignore */ }
  });
  await page.goto(BASE + s.path, { waitUntil: 'networkidle' });
  // The butterflies land somewhere different on every load; a store listing
  // should not.
  await page.addStyleTag({ content: '#sky { display: none !important; }' });
  await page.screenshot({ path: s.out });
  await context.close();
  console.log(`  ${s.out}  ${s.viewport.width * s.scale}x${s.viewport.height * s.scale}`);
}
await browser.close();
