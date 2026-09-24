import { TOOLS } from '../src/tools/registry';
import { test, expect, type Page } from '@playwright/test';
import { CATEGORIES } from '../src/tools/types';
import { groupsIn } from '../src/tools/groups';

/**
 * Counts read from the taxonomy rather than typed in.
 *
 * These were hardcoded, so re-cutting the PDF groups failed three tests that
 * had no opinion about the cut: they only ever meant "as many headings as the
 * taxonomy declares". Derived, they keep testing the rendering and stop
 * testing the number.
 */
const PDF_GROUPS = groupsIn('pdf').length;
const ALL_GROUPS = CATEGORIES.reduce((n, c) => n + groupsIn(c).length, 0);

/**
 * The browse layer: category pages, job groups, preset chips, the mobile nav
 * and the palette's knowledge of presets.
 *
 * Each of these covers something that was broken before the restructure: /pdf
 * was a 404, the nav vanished below 768px, nothing linked to a preset page,
 * and the palette could not resolve "500kb".
 */

test.describe('category pages', () => {
  test('/pdf exists and groups its 18 tools under job headings', async ({ page }) => {
    await page.goto('/pdf');
    await expect(page.getByRole('heading', { level: 1, name: 'PDF' })).toBeVisible();

    const groups = page.locator('main section > h2');
    await expect(groups).toHaveCount(PDF_GROUPS);
    await expect(groups.first()).toHaveText('Organise pages');

    // PDF's own tools. Its cross-listings point outwards, into Image, so
    // nothing arrives here: the count is exactly the category's own tools.
    await expect(page.locator('main [data-tool-card]')).toHaveCount(TOOLS.filter((t) => t.category === 'pdf').length);
  });

  test('a flat category renders no job headings', async ({ page }) => {
    await page.goto('/media');
    await expect(page.locator('main section > h2')).toHaveCount(0);
    await expect(page.locator('main [data-tool-card]')).toHaveCount(4);
  });

  test('the smallest category still has a real page', async ({ page }) => {
    await page.goto('/calc');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.locator('main [data-tool-card]')).toHaveCount(TOOLS.filter((t) => t.category === 'calc').length);
  });

  test('a cross-listed tool appears in the other category, and only once', async ({ page }) => {
    await page.goto('/image');
    const qr = page.locator('main [data-tool-card]').filter({ hasText: 'QR code generator' });
    await expect(qr).toHaveCount(1);
    await expect(qr.getByRole('link').first()).toHaveAttribute('href', '/dev/qr');
  });

  test('a category count reports the category, not the rows on the page', async ({ page }) => {
    // /image shows 14 rows because three are cross-listed in, but Image owns
    // 11 tools. Counting rows here printed 14 against the homepage's 11, and
    // made the five category pages sum to 46 against a catalogue of 43.
    await page.goto('/image');
    await expect(page.locator('main [data-tool-card]')).toHaveCount(14);
    await expect(page.locator('main header [data-numeric]')).toHaveText('11');

    await page.goto('/');
    const section = page.locator('[data-category-section="image"]');
    await expect(section.locator('[data-numeric]')).toHaveText('11');
  });

  test('the homepage lists every tool exactly once', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('main [data-tool-card]')).toHaveCount(TOOLS.length);
  });
});

test.describe('preset chips', () => {
  test('a chip navigates to the preset with its option already set', async ({ page }) => {
    await page.goto('/pdf');
    await page.getByRole('link', { name: 'Compress PDF to 500 KB' }).click();
    await expect(page).toHaveURL('/pdf/compress/500kb');
  });

  test('a chip names the parent tool for a screen reader', async ({ page }) => {
    await page.goto('/pdf');
    const chip = page.getByRole('link', { name: 'Compress PDF to 200 KB' });
    await expect(chip).toBeVisible();
    await expect(chip).toHaveText('200 KB');
  });

  test('every preset chip points at a page that exists', async ({ page }) => {
    for (const path of ['/pdf', '/image']) {
      await page.goto(path);
      const hrefs = await page.locator('[data-tool-card] ul a').evaluateAll((els) =>
        els.map((e) => (e as HTMLAnchorElement).getAttribute('href') ?? ''));
      expect(hrefs.length).toBeGreaterThan(0);
      for (const href of hrefs) {
        const res = await page.request.get(href);
        expect(res.status(), href).toBe(200);
      }
    }
  });
});

test.describe('navigation', () => {
  test('category links go to real pages, not homepage anchors', async ({ page }) => {
    await page.goto('/');
    await page.locator('header nav').getByRole('link', { name: 'Image', exact: true }).click();
    await expect(page).toHaveURL('/image');
  });

  test('the active category is marked', async ({ page }) => {
    await page.goto('/pdf/merge');
    const current = page.locator('header [aria-current="page"]');
    await expect(current).toHaveText('PDF');
  });

  test('the nav is reachable on a phone', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    const list = page.locator('header nav ul').first();
    await expect(list).toBeVisible();
    // Present and scrollable, rather than hidden as it was before.
    const { scrollable, count } = await list.evaluate((el) => ({
      scrollable: el.scrollWidth > el.clientWidth,
      count: el.querySelectorAll('a').length,
    }));
    expect(count).toBe(5);
    expect(scrollable).toBe(true);
    // And the page itself must not scroll sideways because of it.
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(overflow).toBe(false);
  });

  test('a tool page breadcrumb leads to its category page', async ({ page }) => {
    await page.goto('/pdf/sign');
    await page.getByRole('navigation', { name: 'Breadcrumb' }).getByRole('link', { name: 'PDF' }).click();
    await expect(page).toHaveURL('/pdf');
  });
});

test.describe('homepage filter', () => {
  const visibleGroups = (page: Page) =>
    page.locator('[data-group]:not([hidden])').count();

  test('hides a group heading once every tool under it is filtered out', async ({ page }) => {
    await page.goto('/');
    const before = await visibleGroups(page);
    expect(before).toBe(ALL_GROUPS);

    // 'jwt' names exactly one tool, so exactly one group and one category
    // should survive. 'merge' would leave two: Text diff carries it as a
    // keyword, which is the search working, not a bug.
    await page.fill('#tool-search', 'jwt');
    expect(await visibleGroups(page)).toBe(1);
    await expect(page.locator('[data-category-section]:not([hidden])')).toHaveCount(1);
  });

  test('shows the empty state and restores everything when cleared', async ({ page }) => {
    await page.goto('/');
    await page.fill('#tool-search', 'zzzznotatool');
    await expect(page.locator('[data-search-empty]')).toBeVisible();
    expect(await visibleGroups(page)).toBe(0);

    await page.fill('#tool-search', '');
    await expect(page.locator('[data-search-empty]')).toBeHidden();
    expect(await visibleGroups(page)).toBe(ALL_GROUPS);
  });

  test('honours a ?q= deep link on load', async ({ page }) => {
    await page.goto('/?q=watermark');
    await expect(page.locator('[data-tool-card]:not([hidden])')).toHaveCount(2);
    await expect(page.locator('#search-status')).toContainText('2');
  });
});

test.describe('command palette', () => {
  test('resolves a preset size that used to match nothing', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /search/i }).click();
    await page.getByRole('combobox').fill('500kb');
    const options = page.getByRole('option');
    await expect(options.first()).toContainText('500 KB');
    await options.first().click();
    await expect(page).toHaveURL(/\/compress\/500kb$/);
  });

  test('still finds a tool by a synonym', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /search/i }).click();
    await page.getByRole('combobox').fill('transcribe');
    await expect(page.getByRole('option').first()).toContainText('Audio to text');
  });
});
