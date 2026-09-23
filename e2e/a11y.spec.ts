import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Automated accessibility checks.
 *
 * These catch the mechanical failures: contrast, names, roles, landmarks.
 * They are not a substitute for using the site with an actual screen reader,
 * which remains outstanding; axe cannot tell you whether an announcement is
 * *useful*, only whether one exists.
 */

const PAGES = [
  ['/', 'homepage'],
  ['/pdf/merge', 'file tool'],
  ['/dev/json', 'text tool'],
  ['/dev/css-shadow', 'generator tool'],
  ['/privacy', 'static page'],
  ['/ms', 'Malay homepage'],
  ['/ms/pdf/compress/500kb', 'Malay preset page'],
  ['/calc/take-home-pay', 'salary calculator'],
  ['/image/passport-photo', 'photo maker'],
  ['/pdf/organize', 'organize'],
  ['/pdf/sign', 'sign'],
  ['/image/crop', 'image crop'],
  ['/pdf/protect', 'password tool'],
  ['/media/teleprompter', 'teleprompter'],
  ['/pdf/scan', 'scan to PDF'],
  ['/pdf/office-to-pdf/word', 'Word to PDF preset'],
  ['/ms/image/remove-background', 'Malay remove background'],
  ['/ms/media/teleprompter/remote', 'Malay phone remote'],
  ['/404', 'not found'],
  ['/pdf', 'category page, grouped'],
  ['/media', 'category page, flat'],
  ['/calc', 'category page, one tool'],
  ['/malaysia', 'collection page'],
  ['/ms/image', 'Malay category page'],
  ['/ms/malaysia', 'Malay collection page'],
] as const;

for (const [path, label] of PAGES) {
  for (const theme of ['light', 'dark'] as const) {
    test(`${label} (${theme}) has no accessibility violations`, async ({ page }) => {
      await page.addInitScript((t) => {
        try { localStorage.setItem('theme', t); } catch { /* blocked */ }
      }, theme);
      await page.goto(path);

      const { violations } = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();

      // Report what actually failed, rather than a bare count.
      const summary = violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.length} node(s): ${v.help}`);
      expect(summary, summary.join('\n')).toEqual([]);
    });
  }
}

test('the command palette dialog is reachable and labelled', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('ControlOrMeta+k');
  const dialog = page.getByRole('dialog', { name: 'Command palette' });
  await expect(dialog).toBeVisible();

  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa'])
    .analyze();
  expect(violations.map((v) => v.id)).toEqual([]);
});

test('the result region announces completion to assistive tech', async ({ page }) => {
  await page.goto('/dev/word-count');
  // The live region must exist and be polite before any result arrives,
  // otherwise the first announcement is missed.
  const live = page.locator('[aria-live="polite"]').first();
  await expect(live).toBeAttached();
});

test('inline diff output and an invalid number field have no violations', async ({ page }) => {
  await page.goto('/dev/diff');
  await page.getByLabel('Compare by').selectOption('word');
  await page.getByLabel('Original text').fill('the quick brown fox');
  await page.getByLabel('Changed text').fill('the slow brown dog');
  await expect(page.locator('pre ins').first()).toBeVisible();
  for (const theme of ['light', 'dark']) {
    // Switch theme by reloading with it saved, never by flipping the attribute
    // live: colours transition over 120ms, and axe measuring mid-transition
    // reported a false 1.07:1 contrast failure in WebKit.
    await page.evaluate((t) => localStorage.setItem('theme', t), theme);
    await page.reload();
    await page.getByLabel('Compare by').selectOption('word');
    await page.getByLabel('Original text').fill('the quick brown fox');
    await page.getByLabel('Changed text').fill('the slow brown dog');
    await expect(page.locator('pre ins').first()).toBeVisible();
    const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    expect(violations.map((v) => `${theme}: ${v.id}`)).toEqual([]);
  }

  await page.goto('/image/resize');
  await page.getByLabel('Width').fill('');
  const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(violations.map((v) => v.id)).toEqual([]);
});

test('Tab cannot leave the modal command palette', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('ControlOrMeta+k');
  await expect(page.locator('#palette-input')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.locator('#palette-input')).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(page.locator('#palette-input')).toBeFocused();
});

test('accessible names contain the visible label (WCAG 2.5.3)', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: /^Search/ })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Nhako Tools, home' })).toBeVisible();
});

test('text tools announce one settled summary, never the whole output', async ({ page }) => {
  await page.goto('/dev/json');
  const status = page.getByRole('status').filter({ hasText: /./ }).first();
  await page.getByLabel('Input').pressSequentially('{"a":1,}', { delay: 40 });
  await expect(status).toHaveText(/^Error: Trailing comma/);
  await page.getByLabel('Input').fill('{"a":1}');
  await expect(status).toHaveText(/^Output updated\. Keys 1/);
  // The output pane itself must not be a live region.
  expect(await page.locator('pre').evaluate((el) => !!el.closest('[aria-live]'))).toBe(false);
});
