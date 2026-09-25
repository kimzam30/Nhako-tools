/**
 * Real screens for the launch video and the README, taken from the production
 * build at iPhone size. Nothing in the video's phone is mocked up: every frame
 * inside it is one of these captures.
 *
 * The viewport is an iPhone 15 Pro (393 x 852 points) minus the 54-point
 * status bar, because the video draws its own status bar above the page, the
 * way the installed app looks. Captured at 2x, so a screen is 786 px wide and
 * sits in the video's 780 px phone at almost exactly 1:1.
 *
 *   npm run build
 *   PORT=4400 npm run preview
 *   BASE=http://localhost:4400 node launch/video/capture.mjs
 */
/* global document, window */
import { chromium, devices } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const BASE = process.env.BASE ?? 'http://localhost:4400';
const OUT = fileURLToPath(new URL('./shots/', import.meta.url));
const PDF = fileURLToPath(new URL('../../e2e/fixtures/three-pages.pdf', import.meta.url));
mkdirSync(OUT, { recursive: true });

const iphone = devices['iPhone 15 Pro'];
const browser = await chromium.launch();

/**
 * A fresh iPhone-shaped page. `dark` sets the saved theme before first paint,
 * the same way the nav toggle does, rather than flipping it afterwards.
 */
async function phone({ dark = false, installCard = false } = {}) {
  const context = await browser.newContext({
    ...iphone,
    viewport: { width: 393, height: 798 },
    deviceScaleFactor: 2,
    serviceWorkers: 'block',
  });
  await context.addInitScript(([dark, installCard]) => {
    try {
      localStorage.setItem('theme', dark ? 'dark' : 'light');
      if (installCard) localStorage.setItem('nhako:views', '1');
      else localStorage.setItem('nhako:install-snooze', String(Date.now() + 864e5));
    } catch { /* ignore */ }
  }, [dark, installCard]);
  const page = await context.newPage();
  return { context, page };
}

/** The butterflies land somewhere new on every load; the video flies its own. */
const still = (page) => page.addStyleTag({ content: '#sky { display: none !important; } *, *::before, *::after { caret-color: transparent !important; }' });

/**
 * Where the video's finger lands: the box of a real element on a real screen,
 * in CSS pixels of the 393-wide viewport, written to shots/taps.json.
 * `lowest` picks the match nearest the bottom, which for a tab is the tab bar.
 */
const taps = {};
async function tap(page, shotName, key, locator, { lowest = false } = {}) {
  const boxes = [];
  for (const el of await locator.all()) {
    const b = await el.boundingBox();
    if (b && b.width > 0 && b.y >= 0 && b.y + b.height <= 798) boxes.push(b);
  }
  if (!boxes.length) throw new Error(`no on-screen ${key} for ${shotName}`);
  const b = lowest ? boxes.sort((p, q) => q.y - p.y)[0] : boxes[0];
  (taps[shotName] ??= {})[key] = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}

async function shot(page, name, opts = {}) {
  await page.screenshot({ path: `${OUT}${name}.png`, ...opts });
  console.log(`  ${name}.png`);
}

/** Scroll so the finished card sits just under the header, as a person would. */
async function doneAtTop(page) {
  const save = page.getByRole('link', { name: 'Save' }).first();
  const top = await save.evaluate((el) => el.getBoundingClientRect().top);
  await page.evaluate((y) => window.scrollBy(0, y), top - 150);
  await page.waitForTimeout(300);
}

// 1. Home, the first screen and the whole page (the video scrolls through it).
{
  const { context, page } = await phone();
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  await still(page);
  await shot(page, 'home');
  await tap(page, 'home', 'search', page.getByRole('button', { name: /search/i }));
  await tap(page, 'home', 'pdf', page.locator('a[href="/pdf"]'), { lowest: true });
  await tap(page, 'home', 'image', page.locator('a[href="/image"]'), { lowest: true });
  // A full-page capture paints the fixed tab bar and the sticky header once,
  // mid-document. Hide both; the video lays the real ones from home.png over
  // the scrolling page instead.
  await page.addStyleTag({ content: 'header.vt-nav, #tabbar { visibility: hidden !important; }' });
  await shot(page, 'home-full', { fullPage: true });
  // ...and here they are, alone on a transparent screen.
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.addStyleTag({ content: `
    html, body { background: transparent !important; }
    body { visibility: hidden !important; }
    #tabbar, #tabbar *, header.vt-nav, header.vt-nav * { visibility: visible !important; }` });
  await shot(page, 'home-bars', { omitBackground: true });
  await context.close();
}

// 2. Home in dark mode.
{
  const { context, page } = await phone({ dark: true });
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  await still(page);
  await shot(page, 'home-dark');
  await context.close();
}

// 3. The PDF category, and the Bahasa Melayu home.
for (const [path, name] of [['/pdf', 'pdf'], ['/image', 'image'], ['/ms', 'home-ms'], ['/media/teleprompter', 'teleprompter'], ['/favourites', 'favourites']]) {
  const { context, page } = await phone();
  await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' });
  await still(page);
  await shot(page, name);
  if (name === 'image') await tap(page, 'image', '500kb', page.locator('a[href="/image/compress/500kb"]'));
  if (name === 'pdf') await tap(page, 'pdf', 'to-image', page.locator('a[href="/pdf/to-image"]'));
  await context.close();
}

// 4. Search: the command palette, typed into.
{
  const { context, page } = await phone();
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  await still(page);
  await page.keyboard.press('ControlOrMeta+k');
  await page.locator('#palette-input').fill('comp');
  await page.waitForTimeout(300);
  await shot(page, 'search');
  await context.close();
}

// 5. Compress PDF: empty, then with a real file done.
{
  const { context, page } = await phone();
  await page.goto(`${BASE}/pdf/compress`, { waitUntil: 'networkidle' });
  await still(page);
  await shot(page, 'compress-empty');
  await page.locator('input[type=file]').setInputFiles(PDF);
  await page.getByRole('link', { name: 'Save' }).first().waitFor({ timeout: 60_000 });
  await page.waitForTimeout(900);
  await doneAtTop(page);
  await page.waitForTimeout(300);
  await shot(page, 'compress-done');
  await context.close();
}

// 6. PDF to JPG, with the rendered pages in the result preview.
{
  const { context, page } = await phone();
  await page.goto(`${BASE}/pdf/to-image`, { waitUntil: 'networkidle' });
  await still(page);
  await page.locator('input[type=file]').setInputFiles(PDF);
  await page.getByRole('link', { name: 'Save' }).first().waitFor({ timeout: 60_000 });
  await page.waitForTimeout(1200);
  await doneAtTop(page);
  await page.waitForTimeout(300);
  await shot(page, 'to-image-done');
  await context.close();
}

// 7. Compress image, on a 2400 x 1600 PNG drawn here: a sky, a sun and
//    three hills, with a little grain so it weighs what a real photo does.
{
  const { context, page } = await phone();
  await page.goto(`${BASE}/image/compress/500kb`, { waitUntil: 'networkidle' });
  await still(page);
  await shot(page, 'image-compress-empty');
  await tap(page, 'image-compress-empty', 'choose', page.getByRole('button', { name: /choose files/i }));
  const b64 = await page.evaluate(() => {
    const c = document.createElement('canvas');
    c.width = 2400; c.height = 1600;
    const x = c.getContext('2d');
    const sky = x.createLinearGradient(0, 0, 0, 1600);
    sky.addColorStop(0, '#e9eefb'); sky.addColorStop(0.5, '#efe6f8'); sky.addColorStop(1, '#fbe7f0');
    x.fillStyle = sky; x.fillRect(0, 0, 2400, 1600);
    x.fillStyle = '#ffd98a'; x.beginPath(); x.arc(1700, 480, 180, 0, Math.PI * 2); x.fill();
    for (const [y, col] of [[1050, '#b5e3be'], [1200, '#8fcf9e'], [1350, '#6bb784']]) {
      x.fillStyle = col; x.beginPath(); x.moveTo(0, 1600);
      for (let i = 0; i <= 2400; i += 40) x.lineTo(i, y + Math.sin(i / 260 + y) * 90);
      x.lineTo(2400, 1600); x.fill();
    }
    const img = x.getImageData(0, 0, 2400, 1600);
    let s = 11;
    for (let i = 0; i < img.data.length; i += 4) {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      const n = (s % 13) - 6;
      img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n;
    }
    x.putImageData(img, 0, 0);
    return c.toDataURL('image/png').split(',')[1];
  });
  await page.locator('input[type=file]').setInputFiles({ name: 'holiday.png', mimeType: 'image/png', buffer: Buffer.from(b64, 'base64') });
  await page.getByRole('link', { name: 'Save' }).first().waitFor({ timeout: 60_000 });
  await page.waitForTimeout(1200);
  await doneAtTop(page);
  await shot(page, 'image-compress-done');
  await context.close();
}

// 8. The salary calculator on LHDN's own worked example.
{
  const { context, page } = await phone();
  await page.goto(`${BASE}/calc/take-home-pay`, { waitUntil: 'networkidle' });
  await still(page);
  await page.getByLabel('Monthly salary').fill('5500');
  await page.getByLabel('Household').selectOption('spouse-working');
  await page.getByRole('spinbutton', { name: 'Children under 18' }).fill('3');
  await page.getByTestId('net-pay').waitFor();
  await page.evaluate(() => document.activeElement?.blur());
  await page.getByTestId('net-pay').scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollBy(0, 120));
  await page.waitForTimeout(300);
  await shot(page, 'salary');
  await context.close();
}

// 9. The install card, as an iPhone sees it on a second page view.
{
  const { context, page } = await phone({ installCard: true });
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  await still(page);
  await page.locator('#install-card').waitFor({ state: 'visible', timeout: 10_000 });
  await page.waitForTimeout(500);
  await shot(page, 'install');
  await context.close();
}

await browser.close();
writeFileSync(`${OUT}taps.json`, JSON.stringify(taps, null, 2));
console.log('  taps.json');
