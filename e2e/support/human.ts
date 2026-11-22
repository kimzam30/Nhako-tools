/**
 * Helpers for the "real person" specs: open a tool the way somebody does
 * (search on the home page, tap the result), hand it a real file through the
 * real file chooser, wait for the result, press Save, and get the bytes that
 * were saved.
 *
 * The same specs run on a real phone or tablet. Set DEVICE_CDP to a Chrome
 * DevTools endpoint (adb forward tcp:9231 localabstract:chrome_devtools_remote)
 * and DEVICE_NAME to a label, and the `page` fixture attaches to Chrome on the
 * device instead of launching a browser. It opens one new tab per test and
 * closes only that tab, so the owner's own tabs are left alone.
 * See scripts/device-e2e.sh.
 */
import { test as base, expect, chromium, type Page, type Locator } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { basename } from 'node:path';

let warmed = false;

export const DEVICE = process.env.DEVICE_CDP ? (process.env.DEVICE_NAME ?? 'device') : null;

export const test = base.extend<{ shot: (label: string) => Promise<void> }>({
  page: async ({ page, baseURL }, provide, info) => {
    if (!process.env.DEVICE_CDP) return provide(page);
    const browser = await chromium.connectOverCDP(process.env.DEVICE_CDP);
    const context = browser.contexts()[0]!;
    const devicePage = await context.newPage();
    // Relative goto('/x') resolves against the project's baseURL on desktop;
    // a page borrowed from an existing context has none, so resolve here.
    const goto = devicePage.goto.bind(devicePage);
    devicePage.goto = (url, opts) => goto(url.startsWith('/') ? `${baseURL}${url}` : url, opts);
    devicePage.setDefaultTimeout(info.timeout ? Math.min(info.timeout, 60_000) : 30_000);
    // The first navigation of a run on the Tab S9 FE sometimes never reaches
    // "load" (seen 3 times, always the first test, never again in that run).
    // Warm up once per run, retrying once, so that stall cannot pass for a
    // tool failure; anything after the warm-up is reported as it happens.
    if (!warmed) {
      for (let attempt = 0; attempt < 2 && !warmed; attempt++) {
        warmed = await goto(`${baseURL}/offline`, { timeout: 30_000 }).then(() => true, () => false);
      }
    }
    try {
      await provide(devicePage);
    } finally {
      await devicePage.close().catch(() => {});
      await browser.close().catch(() => {});
    }
  },
  // A screenshot per step, filed by device, so a run leaves a visual record
  // of what a person on that screen actually saw.
  shot: async ({ page }, provide, info) => {
    let n = 0;
    await provide(async (label) => {
      const dir = `test-results/devices/${DEVICE ?? info.project.name}/${info.titlePath.slice(1).join(' - ').replace(/[^\w.-]+/g, '_').slice(0, 80)}`;
      await mkdir(dir, { recursive: true });
      await page.screenshot({ path: `${dir}/${String(++n).padStart(2, '0')}-${label}.png`, fullPage: false }).catch(() => {});
    });
  },
});
export { expect };

export const real = (name: string) => fileURLToPath(new URL(`../fixtures/real/${name}`, import.meta.url));
export const fixture = (name: string) => fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url));

const MIME: Record<string, string> = {
  pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp',
  heic: 'image/heic', mp4: 'video/mp4', flac: 'audio/flac', wav: 'audio/wav', mp3: 'audio/mpeg',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  odt: 'application/vnd.oasis.opendocument.text', csv: 'text/csv',
};

/** A file as the browser will see it. Buffers, not paths, so it also works on a remote device. */
export async function payload(path: string) {
  const name = basename(path);
  return { name, mimeType: MIME[name.split('.').pop()!.toLowerCase()] ?? 'application/octet-stream', buffer: await readFile(path) };
}

/** Home page, type into search like a person, tap the tool. */
export async function openFromHome(page: Page, toolName: string, query = toolName) {
  await page.goto('/');
  // The home page's own search box, not the command palette's (hidden) one.
  const search = page.locator('#tool-search');
  await search.click();
  await search.pressSequentially(query, { delay: 25 });
  // Close the keyboard first, as a person does before tapping a result. With
  // it open, a phone keeps adjusting the scroll, and the cards' scroll-driven
  // reveal (motion.css, animation-timeline: view()) keeps them moving.
  await search.blur();
  const hit = page.locator('main').getByRole('link', { name: new RegExp(`^${escape(toolName)}\\b`) }).first();
  await expect(hit).toBeVisible();
  await hit.click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText(toolName);
  // Wait for the island: a click before hydration would open the native
  // picker with nothing listening for its result.
  await page.waitForFunction(() => !document.querySelector('astro-island[ssr]'), undefined, { timeout: 30_000 });
}

/** Tap the drop zone and choose files in the file chooser that opens. */
export async function chooseFiles(page: Page, paths: string[], zone?: Locator) {
  const files = await Promise.all(paths.map(payload));
  const target = zone ?? page.getByRole('button', { name: /drop|choose|browse|tap|pilih/i }).first();
  const chooser = page.waitForEvent('filechooser', { timeout: 5_000 }).catch(() => null);
  await target.click();
  const fc = await chooser;
  if (fc) await fc.setFiles(files);
  else await page.locator('input[type=file]').first().setInputFiles(files);
}

/** Wait for the result, press Save, return what was saved. */
export async function save(page: Page, name: RegExp | string = /^Save/, timeout = 120_000) {
  const link = page.getByRole('link', { name }).first();
  await expect(link).toBeVisible({ timeout });
  if (!DEVICE) {
    const [download] = await Promise.all([page.waitForEvent('download'), link.click()]);
    const path = await download.path();
    return { name: download.suggestedFilename(), bytes: await readFile(path) };
  }
  // Android hands downloads to its own manager, out of the browser's reach.
  // Read the exact blob the Save link points at, after a real tap on it.
  const href = await link.getAttribute('href');
  const fileName = (await link.getAttribute('download')) ?? 'download';
  await link.tap().catch(() => link.click());
  const b64 = await page.evaluate(async (h) => {
    const buf = new Uint8Array(await (await fetch(h!)).arrayBuffer());
    let s = ''; for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    return btoa(s);
  }, href);
  return { name: fileName, bytes: Buffer.from(b64, 'base64') };
}

/** Keep a copy of every output, for a person to open and look at. */
export async function keep(info: { project: { name: string }; title: string }, out: { name: string; bytes: Buffer }) {
  const dir = `test-results/outputs/${DEVICE ?? info.project.name}`;
  await mkdir(dir, { recursive: true });
  await writeFile(`${dir}/${info.title.replace(/[^\w.-]+/g, '_').slice(0, 60)}--${out.name}`, out.bytes);
}

/** Decode an image in the page and report its size and one pixel. */
export async function imageInfo(page: Page, bytes: Buffer, mime: string, at: [number, number] = [0, 0]) {
  return page.evaluate(async ({ b64, mime, at }) => {
    const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const bmp = await createImageBitmap(new Blob([bin], { type: mime }));
    const c = new OffscreenCanvas(bmp.width, bmp.height);
    const x = c.getContext('2d')!;
    x.drawImage(bmp, 0, 0);
    return { width: bmp.width, height: bmp.height, pixel: [...x.getImageData(at[0], at[1], 1, 1).data] };
  }, { b64: bytes.toString('base64'), mime, at });
}

export const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export const magic = (b: Buffer) => b.subarray(0, 12);
