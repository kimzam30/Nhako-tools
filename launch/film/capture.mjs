/**
 * Real screens for the widescreen launch film and the posters, taken from the
 * production build at laptop and tablet size. Nothing on a device screen in the
 * film is mocked up: each one is a capture from here, or (the teleprompter's
 * words) a layer cut from one so the film can scroll it.
 *
 *   laptop  1280 x 748 points, under the 52-point browser bar the film draws,
 *           so the whole screen is 1280 x 800 (16:10).
 *   tablet  1180 x 796 points, under the 24-point status bar the film draws,
 *           so the whole screen is 1180 x 820 (an 11-inch tablet, landscape).
 *
 * Both at 2x, so the posters can be rendered sharp at twice the film's size.
 *
 *   npm run build
 *   PORT=4400 npm run preview
 *   BASE=http://localhost:4400 node launch/film/capture.mjs
 */
/* global document, window */
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const BASE = process.env.BASE ?? 'http://localhost:4400';
const OUT = fileURLToPath(new URL('./shots/', import.meta.url));
mkdirSync(OUT, { recursive: true });

export const LAPTOP = { width: 1280, height: 748 };
export const TABLET = { width: 1180, height: 796 };

const browser = await chromium.launch();
const meta = { taps: {} };

async function device(size, { dark = false, touch = false, settings } = {}) {
  const context = await browser.newContext({
    viewport: size, deviceScaleFactor: 2, hasTouch: touch, serviceWorkers: 'block',
  });
  await context.addInitScript(([dark, settings]) => {
    try {
      if (sessionStorage.getItem('seeded')) return;
      sessionStorage.setItem('seeded', '1');
      localStorage.setItem('theme', dark ? 'dark' : 'light');
      localStorage.setItem('nhako:install-snooze', String(Date.now() + 864e5));
      if (settings) localStorage.setItem('nhako.teleprompter.settings', JSON.stringify(settings));
    } catch { /* ignore */ }
  }, [dark, settings]);
  const page = await context.newPage();
  return { context, page };
}

/** The site's butterflies land somewhere new on every load; the film flies its own. */
const still = (page) => page.addStyleTag({ content: `#sky { display: none !important; }
  *, *::before, *::after { caret-color: transparent !important; }
  html, * { scrollbar-width: none !important; } ::-webkit-scrollbar { display: none !important; }` });

async function shot(page, name, opts = {}) {
  await page.screenshot({ path: `${OUT}${name}.png`, ...opts });
  console.log(`  ${name}.png`);
}

/** Where the film's pointer lands: the centre of a real element, in points. */
async function tap(page, shotName, key, locator) {
  const b = await locator.first().boundingBox();
  if (!b) throw new Error(`no ${key} on ${shotName}`);
  (meta.taps[shotName] ??= {})[key] = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}

/** A box on a shot, for push-ins and for keeping the butterflies honest. */
async function box(page, shotName, key, locator) {
  const b = await locator.first().boundingBox();
  if (!b) throw new Error(`no ${key} on ${shotName}`);
  (meta.boxes ??= {});
  (meta.boxes[shotName] ??= {})[key] = b;
}

const go = async (page, path) => {
  await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' });
  await still(page);
  await page.waitForTimeout(250);
};

// ─── Laptop ───────────────────────────────────────────────────────────────────

// Home: the first screen, the whole page for the scroll, and the header alone.
{
  const { context, page } = await device(LAPTOP);
  await go(page, '/');
  await shot(page, 'laptop-home');
  await tap(page, 'laptop-home', 'search', page.getByRole('button', { name: /search/i }));
  await tap(page, 'laptop-home', 'malaysia', page.locator('header a[href="/malaysia"]'));
  await page.addStyleTag({ content: 'header.vt-nav { visibility: hidden !important; }' });
  await shot(page, 'laptop-home-full', { fullPage: true });
  meta.laptopHomeFull = await page.evaluate(() => document.documentElement.scrollHeight);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.addStyleTag({ content: `
    html, body { background: transparent !important; }
    body { visibility: hidden !important; }
    header.vt-nav, header.vt-nav * { visibility: visible !important; }` });
  await shot(page, 'laptop-bars', { omitBackground: true });
  await context.close();
}

// Search, in Malay: "gaji" is salary.
{
  const { context, page } = await device(LAPTOP);
  await go(page, '/');
  await page.keyboard.press('ControlOrMeta+k');
  await page.locator('#palette-input').pressSequentially('gaji', { delay: 40 });
  await page.waitForTimeout(400);
  await shot(page, 'laptop-search');
  await tap(page, 'laptop-search', 'result', page.getByText('Salary calculator (Malaysia)'));
  await context.close();
}

// The Malaysia collection, in English and in Malay, and the dark home.
for (const [path, name, dark] of [['/malaysia', 'laptop-malaysia'], ['/ms/malaysia', 'laptop-malaysia-ms'], ['/ms', 'laptop-home-ms'], ['/', 'laptop-home-dark', true]]) {
  const { context, page } = await device(LAPTOP, { dark });
  await go(page, path);
  await shot(page, name);
  if (name === 'laptop-malaysia') {
    await tap(page, name, 'salary', page.locator('main a[href="/calc/take-home-pay"]'));
  }
  await context.close();
}

// The salary calculator on LHDN's own worked example: RM 5,500, spouse
// working, three children. e2e/malaysia.spec.ts asserts RM 4,706.00 for it.
{
  const { context, page } = await device(LAPTOP);
  await go(page, '/calc/take-home-pay');
  await page.getByLabel('Monthly salary').fill('5500');
  await page.getByLabel('Household').selectOption('spouse-working');
  await page.getByRole('spinbutton', { name: 'Children under 18' }).fill('3');
  await page.getByTestId('net-pay').waitFor();
  await page.evaluate(() => document.activeElement?.blur());
  await page.waitForTimeout(300);
  meta.salary = await page.getByTestId('net-pay').innerText();
  await shot(page, 'laptop-salary');
  await box(page, 'laptop-salary', 'net', page.getByTestId('net-pay'));
  await context.close();
}

// ─── Tablet ───────────────────────────────────────────────────────────────────

// A script a student would actually read: a final-year presentation.
const SCRIPT = `# Final year project
Good morning, Dr. Aminah, and members of the panel. [SMILE]

Today I am presenting my final year project: **an early warning system for flash floods**, built on rainfall data from the Malaysian Meteorological Department.

# The problem
Every monsoon season, flash floods reach homes before warnings do. [PAUSE]

Most alerts go out when the river is already rising. My question was simple: can we warn people thirty minutes earlier, using data we already have?

# What I built
I trained a small model on ten years of rainfall and river-level readings, and tested it on the 2025 season.

It flagged **eight of the nine** floods that season, on average forty minutes before the river crossed the danger line.

# What comes next
The next step is a pilot with two district offices, and a simple SMS alert that works on any phone.

Thank you. I am happy to take your questions.`;
const PROMPTER = { countdown: 0, wpm: 140, fontSize: 56, lineHeight: 1.45, margin: 8, guide: 22 };

// Home, dark home, and the CGPA calculator mid-semester.
for (const [path, name, dark] of [['/', 'tablet-home'], ['/', 'tablet-home-dark', true], ['/ms', 'tablet-home-ms'], ['/malaysia', 'tablet-malaysia']]) {
  const { context, page } = await device(TABLET, { dark, touch: true });
  await go(page, path);
  await shot(page, name);
  await context.close();
}

{
  const { context, page } = await device(TABLET, { touch: true });
  await go(page, '/calc/cgpa');
  await page.locator('#prev-cgpa').fill('3.42');
  await page.locator('#prev-credits').fill('64');
  const courses = [
    ['Data Structures', '4', 'A'], ['Engineering Maths III', '3', 'A-'], ['Digital Systems', '3', 'B+'], ['Technical Writing', '2', 'A'],
  ];
  for (const [i, [name, credits, grade]] of courses.entries()) {
    await page.getByRole('textbox', { name: `Course ${i + 1}`, exact: true }).fill(name);
    await page.locator('input[id^="course-"][id$="-credits"]').nth(i).fill(credits);
    await page.locator('select[id^="course-"][id$="-grade"]').nth(i).selectOption(grade);
  }
  await page.evaluate(() => document.activeElement?.blur());
  await page.waitForTimeout(300);
  meta.cgpa = {
    gpa: await page.getByTestId('gpa').innerText(),
    cgpa: await page.getByTestId('cgpa').innerText(),
    plan: await page.getByTestId('plan').innerText(),
  };
  await shot(page, 'tablet-cgpa');
  await box(page, 'tablet-cgpa', 'gpa', page.getByTestId('gpa'));
  await box(page, 'tablet-cgpa', 'plan', page.getByTestId('plan'));
  await context.close();
}

// The teleprompter: the setup page with the script in, then the stage.
{
  const { context, page } = await device(TABLET, { touch: true, settings: PROMPTER });
  await go(page, '/media/teleprompter');
  await page.locator('astro-island[ssr]').waitFor({ state: 'detached' }).catch(() => {});
  await page.getByLabel('Title').fill('Final year presentation');
  await page.getByTestId('script').fill(SCRIPT);
  await page.evaluate(() => { document.activeElement?.blur(); window.scrollTo(0, 0); });
  await page.waitForTimeout(700);
  meta.prompterStats = await page.getByTestId('stats').innerText();
  await shot(page, 'tablet-teleprompter');
  await tap(page, 'tablet-teleprompter', 'start', page.getByTestId('start'));
  await page.getByTestId('start').scrollIntoViewIfNeeded();
  meta.startScroll = await page.evaluate(() => window.scrollY);
  await shot(page, 'tablet-teleprompter-start');
  await tap(page, 'tablet-teleprompter-start', 'start', page.getByTestId('start'));

  // The stage, idle, as it opens: the words at the reading line, "ready" hint.
  await page.getByTestId('start').click();
  await page.getByTestId('ready-hint').waitFor();
  await page.waitForTimeout(500);
  await shot(page, 'tablet-stage-idle');
  // Where the first line sits when the stage opens: the film scrolls from here.
  meta.firstLine = await page.getByTestId('prompter-text').evaluate((el) => el.firstElementChild.getBoundingClientRect().top);
  await tap(page, 'tablet-stage-idle', 'play', page.getByTestId('play'));

  // Playing: the bar dims. Take the stage with the words hidden...
  await page.getByTestId('play').click();
  await page.waitForTimeout(900);
  await page.getByTestId('play').click(); // pause, so nothing moves while we cut layers
  await page.waitForTimeout(100);
  await page.evaluate(() => {
    const bar = document.querySelector('[data-testid="play"]');
    bar.textContent = 'Pause'; // as it reads while playing; the film shows it playing
    bar.closest('.border-t').style.opacity = '0.4';
    document.querySelector('[data-testid="ready-hint"]')?.remove();
  });
  const view = await page.getByTestId('prompter-view').boundingBox();
  meta.stage = { view };
  await page.evaluate(() => { document.querySelector('[data-testid="prompter-text"]').style.visibility = 'hidden'; });
  await page.waitForTimeout(150);
  await shot(page, 'tablet-stage-chrome');

  // ...then the words alone, full length, on a transparent ground.
  const text = page.getByTestId('prompter-text');
  const geo = await text.evaluate((el) => {
    el.style.visibility = 'visible';
    el.style.transform = 'none';
    return { height: el.scrollHeight, words: el.innerText.replace(/\[(PAUSE|SMILE)\]/g, '').split(/\s+/).filter(Boolean).length };
  });
  meta.stage.text = geo;
  // The stage asks for full screen; the window cannot be resized in it.
  await page.evaluate(() => document.fullscreenElement && document.exitFullscreen());
  await page.waitForTimeout(300);
  await page.setViewportSize({ width: TABLET.width, height: Math.ceil(geo.height + 1600) });
  await page.evaluate(() => {
    const t = document.querySelector('[data-testid="prompter-text"]');
    t.style.transform = 'none';
    // Only the words stay visible: everything else, the page under the stage included, is hidden.
    document.body.style.visibility = 'hidden';
    t.style.visibility = 'visible';
    for (let el = t.parentElement; el && el !== document.documentElement; el = el.parentElement) el.style.background = 'transparent';
    document.documentElement.style.background = 'transparent';
  });
  // Clip from 20 points above the first line to the end of the last.
  const clip = await text.evaluate((el) => {
    const first = el.firstElementChild.getBoundingClientRect();
    const last = el.lastElementChild.getBoundingClientRect();
    return { top: first.top - 20, bottom: last.bottom + 20 };
  });
  meta.stage.layerTop = meta.firstLine - 20; // the layer's top on the stage before any scroll
  meta.stage.layerHeight = clip.bottom - clip.top;
  await shot(page, 'tablet-stage-text', { omitBackground: true, clip: { x: 0, y: clip.top, width: TABLET.width, height: clip.bottom - clip.top } });
  await context.close();
}

await browser.close();
writeFileSync(`${OUT}meta.json`, JSON.stringify(meta, null, 2));
console.log('  meta.json');
