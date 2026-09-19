import { test, expect, type Page } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import { PDFDocument } from 'pdf-lib';
import { TOOLS } from '../src/tools/registry';

const fixture = (name: string) => fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url));

/** A 400 x 300 PNG whose right half is fully transparent, drawn by the browser. */
async function transparentPng(page: Page) {
  const b64 = await page.evaluate(() => {
    const c = document.createElement('canvas');
    c.width = 400; c.height = 300;
    const x = c.getContext('2d')!;
    x.fillStyle = '#e0457b'; x.fillRect(0, 0, 200, 300);
    return c.toDataURL('image/png').split(',')[1]!;
  });
  return { name: 'half.png', mimeType: 'image/png', buffer: Buffer.from(b64, 'base64') };
}

/** Read one pixel of the current result, decoded by the browser. */
async function resultPixel(page: Page, x: number, y: number) {
  const href = await page.getByRole('link', { name: 'Save' }).getAttribute('href');
  return page.evaluate(async ({ href, x, y }) => {
    const bitmap = await createImageBitmap(await (await fetch(href!)).blob());
    const c = new OffscreenCanvas(bitmap.width, bitmap.height);
    const ctx = c.getContext('2d')!;
    ctx.drawImage(bitmap, 0, 0);
    return [...ctx.getImageData(x, y, 1, 1).data];
  }, { href, x, y });
}

test.describe('file tools', () => {
  test('merges two PDFs into one with the summed page count', async ({ page }) => {
    await page.goto('/pdf/merge');
    // No Run button: selecting the files is what starts the work.
    await page.locator('input[type=file]').setInputFiles([fixture('two-pages.pdf'), fixture('three-pages.pdf')]);

    const result = page.getByText('merged.pdf');
    await expect(result).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/2 files · 5 pages/)).toBeVisible();

    const download = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('link', { name: 'Save' }).click(),
    ]).then(([d]) => d);
    expect(download.suggestedFilename()).toBe('merged.pdf');
  });

  test('reports elapsed time: the positioning, proven in the UI', async ({ page }) => {
    await page.goto('/pdf/merge');
    await page.locator('input[type=file]').setInputFiles([fixture('two-pages.pdf'), fixture('three-pages.pdf')]);
    await expect(page.getByText(/\d+ms|\d+\.\d+s/)).toBeVisible({ timeout: 20_000 });
  });

  test('rejects a single file for merge with an actionable message', async ({ page }) => {
    await page.goto('/pdf/merge');
    await page.locator('input[type=file]').setInputFiles([fixture('two-pages.pdf')]);
    await expect(page.getByText(/at least two PDFs/)).toBeVisible({ timeout: 20_000 });
  });

  test('splits a PDF and honours a page range', async ({ page }) => {
    await page.goto('/pdf/split');
    await page.locator('input[type=file]').setInputFiles([fixture('three-pages.pdf')]);
    await expect(page.getByText(/3 pages extracted/)).toBeVisible({ timeout: 20_000 });

    // Changing an option re-runs automatically against the same file.
    await page.getByLabel('Pages').fill('1-2');
    await expect(page.getByText(/2 pages extracted/)).toBeVisible({ timeout: 20_000 });
  });

  test('explains an out-of-range page selection', async ({ page }) => {
    await page.goto('/pdf/split');
    await page.locator('input[type=file]').setInputFiles([fixture('two-pages.pdf')]);
    await page.getByLabel('Pages').fill('1-99');
    await expect(page.getByText(/has 2 pages/)).toBeVisible({ timeout: 20_000 });
  });
});

test.describe('options while a file is loaded', () => {
  test('typing a page range keeps focus and uses the whole value', async ({ page }) => {
    await page.goto('/pdf/split');
    await page.locator('input[type=file]').setInputFiles([fixture('three-pages.pdf')]);
    await expect(page.getByText(/3 pages extracted/)).toBeVisible({ timeout: 20_000 });

    // Real keystrokes, not fill(): a run started by the first key used to
    // disable the field and drop every key after it.
    const pages = page.getByLabel('Pages');
    await pages.click();
    await page.keyboard.type('1-2', { delay: 120 });
    await expect(pages).toHaveValue('1-2');
    await expect(pages).toBeFocused();
    await expect(page.getByText(/2 pages extracted/)).toBeVisible({ timeout: 20_000 });
  });

  test('typing a width is not run digit by digit', async ({ page }) => {
    await page.goto('/image/resize');
    await page.locator('input[type=file]').setInputFiles([await transparentPng(page)]);
    await expect(page.getByRole('link', { name: 'Save' })).toBeVisible({ timeout: 20_000 });

    const width = page.getByLabel('Width');
    await width.click();
    await width.press('ControlOrMeta+a');
    await page.keyboard.type('200', { delay: 120 });
    await expect(width).toHaveValue('200');
    await expect(page.getByText(/200 × 150/)).toBeVisible({ timeout: 20_000 });
  });

  test('clearing a number field does not snap it to the minimum', async ({ page }) => {
    await page.goto('/media/compress-video');
    const target = page.getByLabel('Target size');
    await target.fill('');
    await expect(target).toHaveValue('');
    await expect(page.getByText('1 to 2000')).toBeVisible();
    await target.blur();
    await expect(target).toHaveValue('15'); // restored, not 1
  });

  test('a drop on the zone during a run never falls through to the browser', async ({ page }) => {
    await page.goto('/pdf/merge');
    const zone = page.locator('button:has-text("Drop files here")');
    const prevented = await zone.evaluate((zone) => {
      const event = new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: new DataTransfer() });
      zone.dispatchEvent(event);
      return event.defaultPrevented;
    });
    expect(prevented).toBe(true);
    expect(await zone.isDisabled()).toBe(false);
  });
});

test.describe('input given before the page is interactive', () => {
  /** Hold back an island's code so the test acts on the server-rendered HTML. */
  async function delayIsland(page: Page, name: string) {
    let release!: () => void;
    const gate = new Promise<void>((r) => { release = r; });
    await page.route(new RegExp(`/_astro/${name}\\.[^/]+\\.js$`), async (route) => { await gate; await route.continue(); });
    return release;
  }

  test('text typed before hydration is processed', async ({ page }) => {
    const release = await delayIsland(page, 'TextToolPane');
    await page.goto('/dev/json', { waitUntil: 'domcontentloaded' });
    await page.getByLabel('Input').fill('{"early":true}');
    release();
    await expect(page.locator('pre')).toContainText('"early": true');
  });

  test('an option chosen before hydration is the one used', async ({ page }) => {
    const release = await delayIsland(page, 'TextToolPane');
    await page.goto('/dev/diff', { waitUntil: 'domcontentloaded' });
    await page.getByLabel('Compare by').selectOption('word');
    release();
    await page.getByLabel('Original text').fill('the quick brown fox');
    await page.getByLabel('Changed text').fill('the slow brown dog');
    await expect(page.locator('pre ins').first()).toBeVisible();
  });

  test('a file picked before hydration is processed', async ({ page }) => {
    const release = await delayIsland(page, 'FileToolRunner');
    await page.goto('/pdf/merge', { waitUntil: 'domcontentloaded' });
    await page.locator('input[type=file]').setInputFiles([fixture('two-pages.pdf'), fixture('three-pages.pdf')]);
    release();
    await expect(page.getByText(/2 files · 5 pages/)).toBeVisible({ timeout: 20_000 });
  });
});

test.describe('output correctness', () => {
  test('strong PDF compression keeps the original page size', async ({ page }) => {
    await page.goto('/pdf/compress');
    await page.getByLabel('Mode').selectOption('strong');
    await page.locator('input[type=file]').setInputFiles([fixture('three-pages.pdf')]);
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('link', { name: 'Save' }).click({ timeout: 30_000 }),
    ]);
    const doc = await PDFDocument.load(await readFile(await download.path()));
    for (const p of doc.getPages()) expect(p.getSize()).toEqual({ width: 595, height: 842 });
  });

  test('compressing a PNG never hands back a bigger file', async ({ page }) => {
    await page.goto('/image/compress');
    const png = await transparentPng(page);
    await page.locator('input[type=file]').setInputFiles([png]);
    await expect(page.getByRole('link', { name: 'Save' })).toBeVisible({ timeout: 20_000 });
    const size = await page.evaluate(async () => {
      const href = document.querySelector<HTMLAnchorElement>('a[download]')!.href;
      return (await (await fetch(href)).blob()).size;
    });
    expect(size).toBeLessThanOrEqual(png.buffer.length);
    await expect(page.getByText(/% larger/)).toHaveCount(0);
  });

  test('transparent areas become white, not black, in JPG output', async ({ page }) => {
    await page.goto('/image/convert');
    await page.getByLabel('Convert to').selectOption('jpeg');
    await page.locator('input[type=file]').setInputFiles([await transparentPng(page)]);
    await expect(page.getByRole('link', { name: 'Save' })).toBeVisible({ timeout: 20_000 });
    const [r, g, b] = await resultPixel(page, 350, 150);
    expect(Math.min(r!, g!, b!)).toBeGreaterThan(245);
  });

  test('a non-Latin watermark explains itself', async ({ page }) => {
    await page.goto('/pdf/watermark');
    await page.getByLabel('Text').fill('ЧЕРНОВИК');
    await page.locator('input[type=file]').setInputFiles([fixture('two-pages.pdf')]);
    await expect(page.getByText(/Latin characters only/)).toBeVisible({ timeout: 20_000 });
  });
});

test.describe('text tools', () => {
  test('word diff is marked inline', async ({ page }) => {
    await page.goto('/dev/diff');
    await page.getByLabel('Compare by').selectOption('word');
    await page.getByLabel('Original text').fill('the quick brown fox');
    await page.getByLabel('Changed text').fill('the slow brown dog');
    await expect(page.locator('pre del').first()).toHaveText(/quick/);
    await expect(page.locator('pre ins').first()).toHaveText(/slow/);
  });

  test('JSON keeps big numbers exactly', async ({ page }) => {
    await page.goto('/dev/json');
    await page.getByLabel('Input').fill('{"id": 12345678901234567890}');
    await expect(page.locator('pre')).toContainText('12345678901234567890');
  });

  test('formats JSON using the keyboard only', async ({ page }) => {
    await page.goto('/dev/json');
    await page.getByLabel('Input').fill('{"b":1,"a":2}');
    await expect(page.locator('pre')).toContainText('"b": 1');
  });

  test('reports a JSON syntax error with a line number, not a byte offset', async ({ page }) => {
    await page.goto('/dev/json');
    await page.getByLabel('Input').fill('{\n  "a": 1\n  "b": 2\n}');
    await expect(page.getByText(/at line 3, column 3/)).toBeVisible();
  });

  test('decodes a JWT and states the signature is unverified', async ({ page }) => {
    await page.goto('/dev/jwt');
    const token =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIn0.sig';
    await page.getByLabel('Input').fill(token);
    await expect(page.locator('pre')).toContainText('John Doe');
    await expect(page.getByText('not verified', { exact: true })).toBeVisible();
  });

  test('generates UUIDs with no input at all', async ({ page }) => {
    await page.goto('/dev/uuid');
    await expect(page.locator('pre')).toContainText(/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}/);
  });

  test('counts words live as you type', async ({ page }) => {
    await page.goto('/dev/word-count');
    await page.getByLabel('Input').fill('one two three four five');
    await expect(page.getByText('Words').first()).toBeVisible();
    await expect(page.locator('pre')).toContainText('5');
  });
});

test.describe('navigation and chrome', () => {
  test('every tool page returns 200 and carries its own title', async ({ page, request }) => {
    for (const path of ['/pdf/merge', '/dev/json', '/image/resize', '/media/transcribe']) {
      const response = await request.get(path);
      expect(response.status(), path).toBe(200);
    }
    await page.goto('/pdf/merge');
    await expect(page).toHaveTitle('Merge PDF online, free, no upload | Nhako Tools');
  });

  test('an unknown URL 404s instead of rendering a working-looking page', async ({ request }) => {
    // The old build rendered a real tool page for /tool/<anything>.
    expect((await request.get('/pdf/not-a-real-tool')).status()).toBe(404);
    expect((await request.get('/nonsense')).status()).toBe(404);
  });

  test('theme persists across a full page navigation', async ({ page }) => {
    await page.goto('/');
    const initial = await page.locator('html').getAttribute('data-theme');
    await page.getByRole('button', { name: /Switch to/ }).click();
    const toggled = await page.locator('html').getAttribute('data-theme');
    expect(toggled).not.toBe(initial);

    // The old build resolved theme only on the homepage, so a tool page loaded
    // directly ignored the saved preference entirely.
    await page.goto('/dev/json');
    expect(await page.locator('html').getAttribute('data-theme')).toBe(toggled);
  });

  test('search finds a tool by what it does, not just its name', async ({ page }) => {
    await page.goto('/');
    await page.locator('#tool-search').fill('transcribe');
    await expect(page.getByRole('link', { name: /Audio to text/ })).toBeVisible();
    await expect(page.getByText(`1 of ${TOOLS.length} tools`)).toBeVisible();
  });

  test('the command palette opens with the keyboard and navigates', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('ControlOrMeta+k');
    await page.locator('#palette-input').fill('merge');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/pdf\/merge$/);
  });

  test('the homepage grid works with JavaScript disabled', async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto('/');
    await expect(page.getByRole('link', { name: /Merge PDF/ })).toBeVisible();
    await context.close();
  });
});
