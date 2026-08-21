import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Automated accessibility checks.
 *
 * These catch the mechanical failures — contrast, names, roles, landmarks.
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
  ['/404', 'not found'],
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
      const summary = violations.map((v) => `${v.id} (${v.impact}) — ${v.nodes.length} node(s): ${v.help}`);
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
