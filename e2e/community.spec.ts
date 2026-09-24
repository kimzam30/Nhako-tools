import { test, expect, type Page } from '@playwright/test';
import path from 'node:path';

/**
 * Kim's 2026-09-25 pass: light by default, the NeraOS sky and states, no dots
 * outside the top bar, and the community features (feedback and coffee).
 *
 * The feedback tests intercept the Supabase request, so running the suite
 * never writes a row to the real inbox.
 */

// The site's service worker sits between the page and the network, and
// WebKit does not let Playwright route requests a service worker makes. On
// 2026-09-25 that let three WebKit test messages through to the real inbox
// (deleted the same minute). Blocking the worker keeps every request routable.
test.use({ serviceWorkers: 'block' });

const FIXTURE = path.join(import.meta.dirname, 'fixtures', 'three-pages.pdf');
const FEEDBACK_API = /supabase\.co\/rest\/v1\/tools_feedback/;
const COFFEE = /^https:\/\/buymeacoffee\.com\//;

test.describe('theme', () => {
  test.use({ colorScheme: 'dark' });

  test('is light by default even when the system prefers dark, and dark stays a choice', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await page.locator('#theme-toggle').click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await page.goto('/pdf/merge');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  });
});

test.describe('the NeraOS sky', () => {
  test('seven butterflies fly behind the page and never catch a click', async ({ page }) => {
    await page.goto('/');
    const flies = page.locator('#sky .bfly');
    await expect(flies).toHaveCount(7);
    const sky = await page.locator('#sky').evaluate((el) => {
      const cs = getComputedStyle(el);
      return { z: cs.zIndex, pe: cs.pointerEvents, pos: cs.position, hidden: el.getAttribute('aria-hidden') };
    });
    expect(sky).toEqual({ z: '-1', pe: 'none', pos: 'fixed', hidden: 'true' });
    const before = await flies.first().evaluate((el) => el.style.transform);
    await page.waitForTimeout(400);
    const after = await flies.first().evaluate((el) => el.style.transform);
    expect(after).not.toBe(before);
  });

  test('is absent for anyone who asked for reduced motion', async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    await page.goto('/');
    await expect(page.locator('#sky')).toHaveCount(1);
    await expect(page.locator('#sky .bfly')).toHaveCount(0);
    await ctx.close();
  });
});

/** Every visible element that reads as a dot: small, and round or a middot. */
async function dots(page: Page) {
  return page.evaluate(() => {
    const found: string[] = [];
    for (const el of document.querySelectorAll<HTMLElement>('body *')) {
      if (el.closest('#sky')) continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0 || r.width > 12 || r.height > 12) continue;
      const cs = getComputedStyle(el);
      const round = parseFloat(cs.borderTopLeftRadius) >= Math.min(r.width, r.height) / 2;
      const filled = cs.backgroundColor !== 'rgba(0, 0, 0, 0)';
      if (round && filled) found.push(`${el.tagName}.${el.className}`);
    }
    if (/[·•]/.test(document.body.innerText)) found.push('middot in text');
    return found;
  });
}

test.describe('dots', () => {
  for (const url of ['/', '/pdf', '/pdf/compress', '/malaysia', '/about', '/feedback']) {
    test(`none on ${url}`, async ({ page }) => {
      await page.goto(url);
      expect(await dots(page)).toEqual([]);
    });
  }

  test('the top bar has no dot beside the name either (removed 2026-09-25)', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('header .runtime-dot')).toHaveCount(0);
    expect(await dots(page)).toEqual([]);
  });
});

test.describe('NeraOS states', () => {
  test('a finished job shows the butterfly, the petals, and the way to feedback and coffee', async ({ page }) => {
    await page.goto('/pdf/rotate');
    await page.locator('input[type=file]').setInputFiles(FIXTURE);
    const done = page.locator('[data-status="done"]');
    await expect(done).toBeVisible({ timeout: 20_000 });
    await expect(done.locator('.nera-pop svg.px')).toBeVisible();
    await expect(done.locator('.nera-petal').first()).toBeAttached();
    const feedback = done.locator('[data-after-done] a').first();
    const href = new URL(await feedback.getAttribute('href') ?? '', 'http://x');
    expect(href.pathname).toBe('/feedback');
    expect(Object.fromEntries(href.searchParams)).toEqual({ kind: 'review', from: '/pdf/rotate', tool: 'pdf/rotate' });
    await expect(done.locator('[data-after-done] a').nth(1)).toHaveAttribute('href', COFFEE);
  });

  test('a failed job shakes the butterfly and keeps the message readable', async ({ page }) => {
    await page.goto('/pdf/rotate');
    await page.locator('input[type=file]').setInputFiles({ name: 'bad.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 junk') });
    const error = page.locator('[data-status="error"]');
    await expect(error).toBeVisible({ timeout: 20_000 });
    await expect(error.locator('.nera-shake svg.px')).toBeVisible();
    await expect(error.locator('[data-status-message]')).toContainText('bad.pdf');
  });
});

test.describe('feedback', () => {
  test('arrives with the context from the link, and sends exactly what was typed', async ({ page }) => {
    let posted: Record<string, unknown> | null = null;
    await page.route(FEEDBACK_API, async (route) => {
      posted = route.request().postDataJSON();
      await route.fulfill({ status: 201, body: '' });
    });
    await page.goto('/feedback?kind=bug&tool=pdf/merge&from=/pdf/merge');
    await expect(page.getByRole('radio', { name: 'Something broke' })).toBeChecked();
    await expect(page.getByLabel('Which tool?')).toHaveValue('pdf/merge');

    // Click the heart itself, as a person would; the radio is visually hidden.
    await page.locator('label', { has: page.getByRole('radio', { name: '4 out of 5' }) }).click();
    await expect(page.getByRole('radio', { name: '4 out of 5' })).toBeChecked();
    await page.getByLabel('Your message').fill('Merging two scans gave me the pages in the wrong order.');
    await page.getByRole('radio', { name: 'A student' }).check();
    await page.getByRole('button', { name: 'Send feedback' }).click();

    await expect(page.locator('[data-status="done"]')).toContainText('Sent, thank you');
    expect(posted).toEqual({
      kind: 'bug', message: 'Merging two scans gave me the pages in the wrong order.', locale: 'en',
      tool: 'pdf/merge', rating: 4, role: 'student', page: '/pdf/merge',
    });
  });

  test('says so when it cannot send, and keeps the message', async ({ page }) => {
    await page.route(FEEDBACK_API, (route) => route.abort('internetdisconnected'));
    await page.goto('/feedback');
    await page.getByLabel('Your message').fill('Please add a PDF to PowerPoint tool for my slides.');
    await page.getByRole('button', { name: 'Send feedback' }).click();
    await expect(page.locator('[data-status="error"] [data-status-message]')).toContainText('Could not send');
    await expect(page.getByLabel('Your message')).toHaveValue('Please add a PDF to PowerPoint tool for my slides.');
  });

  test('keeps a message typed before the page finished loading', async ({ page }) => {
    // Hold the island's scripts until the text is in, so this runs the
    // pre-hydration path every time. WebKit found it: the text stayed on
    // screen but state started empty, and Send said to write more.
    let posted: Record<string, unknown> | null = null;
    await page.route(FEEDBACK_API, async (route) => { posted = route.request().postDataJSON(); await route.fulfill({ status: 201 }); });
    let release!: () => void;
    const gate = new Promise<void>((r) => { release = r; });
    await page.route('**/_astro/*.js', async (route) => { await gate; await route.continue(); });
    await page.goto('/feedback', { waitUntil: 'domcontentloaded' });
    await page.locator('#fb-message').fill('Typed while the page was still loading.');
    release();
    await page.getByRole('button', { name: 'Send feedback' }).click();
    await expect(page.locator('[data-status="done"]')).toBeVisible();
    expect(posted).toMatchObject({ message: 'Typed while the page was still loading.' });
  });

  test('refuses an empty message without sending anything', async ({ page }) => {
    let calls = 0;
    await page.route(FEEDBACK_API, (route) => { calls++; return route.fulfill({ status: 201 }); });
    await page.goto('/feedback');
    await page.getByRole('button', { name: 'Send feedback' }).click();
    await expect(page.locator('[data-status-message]')).toContainText('Write a little more');
    expect(calls).toBe(0);
  });

  test('the Malay page is in Malay', async ({ page }) => {
    await page.goto('/ms/feedback');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Beritahu kami');
    await expect(page.getByRole('button', { name: 'Hantar maklum balas' })).toBeVisible();
  });

  test('is reachable from the footer on every page', async ({ page }) => {
    await page.goto('/dev/json');
    await page.locator('footer').getByRole('link', { name: 'Feedback' }).click();
    await expect(page).toHaveURL(/\/feedback$/);
  });
});

test.describe('coffee', () => {
  test('the nav, footer, about and feedback pages all link to the same page, in a new tab', async ({ page }) => {
    for (const url of ['/', '/about', '/feedback']) {
      await page.goto(url);
      const links = page.locator('a[data-coffee]');
      expect(await links.count()).toBeGreaterThanOrEqual(url === '/' ? 2 : 3);
      for (const link of await links.all()) {
        await expect(link).toHaveAttribute('href', COFFEE);
        await expect(link).toHaveAttribute('target', '_blank');
        await expect(link).toHaveAttribute('rel', /noopener/);
      }
    }
  });
});
