/**
 * The offline promise, tested with the network actually off.
 *
 * README and the install prompt both say "tools you have used keep working
 * offline". Until now nothing checked it: community.spec blocks service
 * workers, and no spec ever went offline.
 */
import { test, expect, type Page } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { PDFDocument } from 'pdf-lib';

const fixture = (name: string) => fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url));

test.skip(({ browserName }) => browserName !== 'chromium', 'service worker offline mode: Chromium');
test.use({ serviceWorkers: 'allow' });

/** Load, wait for the worker to take control, so later requests pass through it. */
async function controlled(page: Page, path: string) {
  await page.goto(path);
  await page.evaluate(() => navigator.serviceWorker.ready);
  if (!(await page.evaluate(() => Boolean(navigator.serviceWorker.controller)))) await page.reload();
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
}

async function merge(page: Page) {
  await page.locator('input[type=file]').setInputFiles([fixture('two-pages.pdf'), fixture('three-pages.pdf')]);
  await page.getByRole('button', { name: 'Combine into one PDF' }).click();
  const href = await page.getByRole('link', { name: /^Save/ }).getAttribute('href', { timeout: 30_000 });
  const b64 = await page.evaluate(async (h) => {
    const buf = new Uint8Array(await (await fetch(h!)).arrayBuffer());
    let s = ''; for (const b of buf) s += String.fromCharCode(b);
    return btoa(s);
  }, href);
  return PDFDocument.load(Buffer.from(b64, 'base64'));
}

test('installs a service worker that precaches the shell and the offline page', async ({ page }) => {
  await controlled(page, '/');
  const cached = await page.evaluate(async () => {
    const keys = await caches.keys();
    const shell = await caches.open(keys.find((k) => k.startsWith('nhako-shell-'))!);
    return (await shell.keys()).map((r) => new URL(r.url).pathname);
  });
  expect(cached).toEqual(expect.arrayContaining(['/', '/offline', '/ms/offline', '/about', '/privacy']));
});

test('a tool used once online keeps working with the network off', async ({ page, context }) => {
  await controlled(page, '/pdf/merge');
  await page.reload(); // the page itself, and its chunks, now go through the worker
  expect((await merge(page)).getPageCount()).toBe(5); // pulls pdf-lib into the cache

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Merge PDF');
  expect((await merge(page)).getPageCount()).toBe(5);
  await context.setOffline(false);
});

test('a page never opened here explains itself offline, instead of showing the home page', async ({ page, context }) => {
  await controlled(page, '/');
  await context.setOffline(true);
  await page.goto('/image/resize').catch(() => {});
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('You are offline');
  await expect(page.getByText('not saved for offline use yet')).toBeVisible();

  await page.goto('/ms/image/resize').catch(() => {});
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Anda di luar talian');
  await context.setOffline(false);
});

test('the offline page is kept out of search: noindex, and not in the sitemap', async ({ page, request }) => {
  await page.goto('/offline');
  await expect(page.locator('meta[name=robots]')).toHaveAttribute('content', 'noindex');
  const sitemap = await (await request.get('/sitemap-0.xml')).text();
  expect(sitemap).not.toContain('/offline');
});
