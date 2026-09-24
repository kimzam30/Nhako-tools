import { test, expect } from '@playwright/test';

/**
 * Favourites: a star on every tool card and tool page, a list kept in this
 * browser, and a page that shows it and lets you pick more.
 */

test.describe('favourites', () => {
  test('starring a card on the homepage puts it on the favourites page and counts it in the nav', async ({ page }) => {
    await page.goto('/');
    const star = page.locator('[data-tool-card] [data-fav="pdf/merge"]');
    await expect(star).toBeVisible();
    await expect(star).toHaveAttribute('aria-pressed', 'false');
    await star.click();
    await expect(star).toHaveAttribute('aria-pressed', 'true');
    // Starring must not follow the card's link.
    await expect(page).toHaveURL('/');
    await expect(page.locator('header [data-fav-count]')).toHaveText('1');

    await page.locator('header nav').getByRole('link', { name: /Favourites/ }).click();
    await expect(page).toHaveURL('/favourites');
    const grid = page.locator('[data-fav-grid]');
    await expect(grid.locator('[data-fav-slot]:visible')).toHaveCount(1);
    await expect(grid.getByRole('link', { name: /Merge PDF/ })).toBeVisible();
    await expect(page.locator('[data-fav-empty]')).toBeHidden();
  });

  test('the picker adds and removes, keeps the order tools were added in, and clear empties it', async ({ page }) => {
    await page.goto('/favourites');
    await expect(page.locator('[data-fav-empty]')).toBeVisible();

    const pick = (id: string) => page.locator(`[data-pick] [data-fav="${id}"]`);
    await pick('calc/cgpa').click();
    await pick('image/crop').click();
    await expect(pick('calc/cgpa')).toHaveAttribute('aria-pressed', 'true');
    const order = await page.locator('[data-fav-slot]:visible').evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.favSlot));
    expect(order).toEqual(['calc/cgpa', 'image/crop']);
    await expect(page.locator('[data-fav-total]')).toHaveText('2 tools');

    // Unstar from the card itself.
    await page.locator('[data-fav-grid] [data-fav="calc/cgpa"]').click();
    await expect(page.locator('[data-fav-slot]:visible')).toHaveCount(1);
    await expect(pick('calc/cgpa')).toHaveAttribute('aria-pressed', 'false');

    await page.locator('[data-fav-clear]').click();
    await expect(page.locator('[data-fav-empty]')).toBeVisible();
    await expect(page.locator('header [data-fav-count]')).toBeHidden();
  });

  test('the picker filter narrows the list', async ({ page }) => {
    await page.goto('/favourites');
    await page.locator('#fav-filter').fill('cgpa');
    await expect(page.locator('[data-pick]:visible')).toHaveCount(1);
    await page.locator('#fav-filter').fill('');
    expect(await page.locator('[data-pick]:visible').count()).toBeGreaterThan(40);
  });

  test('a tool page has a labelled favourite button, and the list survives a reload', async ({ page }) => {
    await page.goto('/pdf/compress');
    const button = page.locator('[data-fav="pdf/compress"]:has([data-fav-off])');
    await expect(button).toHaveText(/Add to favourites/);
    await button.click();
    await expect(button).toHaveText(/In favourites/);
    await page.reload();
    await expect(button).toHaveAttribute('aria-pressed', 'true');
    await page.goto('/ms/favourites');
    await expect(page.locator('[data-fav-slot]:visible')).toHaveCount(1);
  });
});
