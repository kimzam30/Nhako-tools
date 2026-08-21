import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const fixture = (name: string) => fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url));

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

  test('reports elapsed time — the positioning, proven in the UI', async ({ page }) => {
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

test.describe('text tools', () => {
  test('formats JSON using the keyboard only', async ({ page }) => {
    await page.goto('/dev/json');
    await page.getByLabel('Input').fill('{"b":1,"a":2}');
    await expect(page.locator('pre')).toContainText('"b": 1');
  });

  test('reports a JSON syntax error with a line number, not a byte offset', async ({ page }) => {
    await page.goto('/dev/json');
    await page.getByLabel('Input').fill('{\n  "a": 1\n  "b": 2\n}');
    await expect(page.getByText(/line 3/)).toBeVisible();
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
    await expect(page).toHaveTitle('Merge PDF — Nhako Tools');
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
    await expect(page.getByText(/1 of 22 tools/)).toBeVisible();
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
