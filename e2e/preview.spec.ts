import { test, expect, type Page } from '@playwright/test';
import { fileURLToPath } from 'node:url';

/**
 * The shared file-tool shell: input preview, output preview, rename, status.
 *
 * These cover the pieces every `kind: 'file'` tool inherits from
 * FileToolRunner, so they are written against two or three representative
 * tools rather than all thirty-six. What is asserted is the contract those
 * tools share: that the preview decodes the real output, that a rename reaches
 * the Save link, and that the finished state is announced in words and not
 * only by a drawn mark.
 */

const fixture = (name: string) => fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url));

/** Drop files on a drop-zone tool and wait for the run to finish. */
async function run(page: Page, path: string, files: string[]) {
  await page.goto(path);
  await page.locator('input[type=file]').setInputFiles(files.map(fixture));
  await expect(page.getByRole('link', { name: 'Save' })).toBeVisible({ timeout: 30_000 });
}

/**
 * The same, for a staging tool: queue the files, then press its build button.
 * Merge, Split and JPG to PDF do not run on drop, which is the point of them.
 */
async function build(page: Page, path: string, files: string[], action: string | RegExp) {
  await page.goto(path);
  await page.locator('input[type=file]').setInputFiles(files.map(fixture));
  await page.getByRole('button', { name: action, exact: true }).click();
  await expect(page.getByRole('link', { name: 'Save' })).toBeVisible({ timeout: 30_000 });
}

test.describe('input preview', () => {
  test('lists the chosen file with its page count before the result', async ({ page }) => {
    await run(page, '/pdf/watermark', ['three-pages.pdf']);

    const panel = page.getByRole('region', { name: 'Selected files' });
    await expect(panel).toBeVisible();
    await expect(panel.getByText('three-pages.pdf')).toBeVisible();
    // Read off the PDF itself, not from the file name.
    await expect(panel.getByText('3 pages')).toBeVisible({ timeout: 15_000 });
  });

  test('a staging tool lists what is queued, in order', async ({ page }) => {
    await page.goto('/pdf/merge');
    await page.locator('input[type=file]').setInputFiles(
      ['two-pages.pdf', 'three-pages.pdf'].map(fixture));

    const cards = page.locator('[data-stage-card]');
    await expect(cards).toHaveCount(2);
    await expect(page.locator('[data-position]')).toHaveText(['1', '2']);
    await expect(cards.first()).toContainText('two-pages.pdf');
  });
});

test.describe('output preview', () => {
  test('decodes a PDF result and pages through it', async ({ page }) => {
    await run(page, '/pdf/watermark', ['three-pages.pdf']);

    const preview = page.locator('[data-result-preview="pdf"]');
    await expect(preview).toBeVisible({ timeout: 20_000 });
    await expect(preview.locator('img')).toBeVisible();
    await expect(page.locator('[data-page-indicator]')).toHaveText('1 / 3');

    await page.getByRole('button', { name: 'Next page' }).click();
    await expect(page.locator('[data-page-indicator]')).toHaveText('2 / 3');

    // The page really was redrawn, not just the counter incremented.
    const src = await preview.locator('img').getAttribute('src');
    expect(src).toMatch(/^blob:/);
  });

  test('the pager stops at both ends', async ({ page }) => {
    await run(page, '/pdf/watermark', ['three-pages.pdf']);
    await expect(page.locator('[data-result-preview="pdf"]')).toBeVisible({ timeout: 20_000 });

    await expect(page.getByRole('button', { name: 'Previous page' })).toBeDisabled();
    await page.getByRole('button', { name: 'Next page' }).click();
    await page.getByRole('button', { name: 'Next page' }).click();
    await expect(page.locator('[data-page-indicator]')).toHaveText('3 / 3');
    await expect(page.getByRole('button', { name: 'Next page' })).toBeDisabled();
  });

  test('lists what is inside a ZIP result instead of failing to draw it', async ({ page }) => {
    await build(page, '/pdf/split', ['three-pages.pdf'], 'Split');

    const preview = page.locator('[data-result-preview="zip"]');
    await expect(preview).toBeVisible({ timeout: 20_000 });
    await expect(preview.getByText('3 files inside')).toBeVisible();
    await expect(preview.getByText('three-pages-page-2.pdf')).toBeVisible();
  });

  test('follows an option change, because it decodes the new output', async ({ page }) => {
    // Rotate rather than Split: this is about the drop-zone runner re-running
    // on a setting change, which Split no longer does.
    await run(page, '/pdf/rotate', ['three-pages.pdf']);
    const preview = page.locator('[data-result-preview="pdf"]');
    await expect(preview).toBeVisible({ timeout: 20_000 });

    const before = await preview.locator('img').getAttribute('src');
    await page.getByLabel('Rotate by').selectOption('180');
    // A new object URL means the panel decoded a newly produced PDF, not the
    // one it was already showing.
    await expect(async () => {
      expect(await preview.locator('img').getAttribute('src')).not.toBe(before);
    }).toPass({ timeout: 20_000 });
  });

  test('a split preview lists the pages the ticks chose', async ({ page }) => {
    await page.goto('/pdf/split');
    await page.locator('input[type=file]').setInputFiles([fixture('three-pages.pdf')]);
    await page.getByRole('checkbox', { name: 'Page 1' }).uncheck();
    await page.getByRole('checkbox', { name: 'Page 3' }).uncheck();
    await page.getByRole('button', { name: 'Split', exact: true }).click();

    const preview = page.locator('[data-result-preview="zip"]');
    await expect(preview).toBeVisible({ timeout: 20_000 });
    await expect(preview.getByText('1 file inside')).toBeVisible();
    await expect(preview.getByText('three-pages-page-2.pdf')).toBeVisible();
  });

  test('the other split mode produces one PDF, previewed as a PDF', async ({ page }) => {
    await page.goto('/pdf/split');
    await page.locator('input[type=file]').setInputFiles([fixture('three-pages.pdf')]);
    await page.getByRole('radio', { name: 'All selected pages in one PDF' }).check();
    await page.getByRole('button', { name: 'Split', exact: true }).click();

    await expect(page.locator('[data-result-preview="pdf"]')).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('[data-page-indicator]')).toHaveText('1 / 3');
  });
});

test.describe('where the preview sits', () => {
  test('beside the controls on a wide screen, not below them', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await run(page, '/pdf/watermark', ['three-pages.pdf']);
    const preview = page.locator('[data-result-preview="pdf"]');
    await expect(preview).toBeVisible({ timeout: 20_000 });

    // The whole point of the two-column shell: an opacity slider and its
    // effect have to be in one view, or adjusting means scroll, look, scroll
    // back. Stacked, the preview starts below the options every time.
    const options = page.getByLabel('Opacity');
    const [a, b] = [(await options.boundingBox())!, (await preview.boundingBox())!];
    expect(b.x).toBeGreaterThan(a.x + a.width);
    // And it is actually on screen next to them, not miles down the page.
    expect(b.y).toBeLessThan(a.y + a.height);
  });

  test('the column is reserved before there is a result, so nothing jumps', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/pdf/watermark');
    await expect(page.getByText('Your result appears here, and follows every setting you change.'))
      .toBeVisible();
  });

  test('it stacks under the controls on a phone, with no sideways scroll', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 900 });
    await run(page, '/pdf/watermark', ['three-pages.pdf']);
    const preview = page.locator('[data-result-preview="pdf"]');
    await expect(preview).toBeVisible({ timeout: 20_000 });

    const options = page.getByLabel('Opacity');
    const [a, b] = [(await options.boundingBox())!, (await preview.boundingBox())!];
    expect(b.y).toBeGreaterThan(a.y);
    expect(await page.evaluate(() =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  });
});

test.describe('renaming the output', () => {
  test('a typed name reaches the Save link and keeps the extension', async ({ page }) => {
    await run(page, '/pdf/watermark', ['three-pages.pdf']);

    const save = page.getByRole('link', { name: 'Save' });
    const field = page.getByLabel('File name');
    // The extension is shown beside the field, never inside it.
    await expect(field).not.toHaveValue(/\.pdf$/);

    await field.fill('contract-draft');
    await expect(save).toHaveAttribute('download', 'contract-draft.pdf');
  });

  test('the name survives a re-run, so a slider does not undo it', async ({ page }) => {
    await run(page, '/pdf/watermark', ['three-pages.pdf']);

    await page.getByLabel('File name').fill('for-signing');
    await expect(page.getByRole('link', { name: 'Save' }))
      .toHaveAttribute('download', 'for-signing.pdf');

    // Re-runs the tool and replaces the result object entirely.
    await page.getByLabel('Text').fill('FINAL');
    await expect(page.getByRole('link', { name: 'Save' }))
      .toHaveAttribute('download', 'for-signing.pdf', { timeout: 20_000 });
  });

  test('a name that would break the save is cleaned rather than refused', async ({ page }) => {
    await run(page, '/pdf/watermark', ['three-pages.pdf']);

    // A slash is flattened or ignored depending on the browser, so the file
    // would land under a name the user never typed.
    await page.getByLabel('File name').fill('a/b:c*d');
    await expect(page.getByRole('link', { name: 'Save' }))
      .toHaveAttribute('download', 'abcd.pdf');
  });

  test('an emptied field falls back to the tool\'s own name', async ({ page }) => {
    await build(page, '/pdf/merge', ['two-pages.pdf', 'three-pages.pdf'], 'Combine into one PDF');

    await page.getByLabel('File name').fill('');
    await expect(page.getByRole('link', { name: 'Save' }))
      .toHaveAttribute('download', 'merged.pdf');
  });
});

test.describe('status', () => {
  test('says it finished in words, not only with a mark', async ({ page }) => {
    await run(page, '/pdf/watermark', ['three-pages.pdf']);
    await expect(page.locator('[data-status="done"]')).toBeVisible();
    await expect(page.locator('[data-status="done"]').getByText('Done')).toBeVisible();
  });

  test('a failure is announced the same way, and offers a way out', async ({ page }) => {
    await page.goto('/pdf/rotate');
    await page.locator('input[type=file]').setInputFiles([fixture('two-pages.pdf')]);
    // A page range past the end of the document: a real, reachable error.
    await page.getByLabel('Pages').fill('1-99');

    const status = page.locator('[data-status="error"]');
    await expect(status).toBeVisible({ timeout: 20_000 });
    await expect(status.getByText('Could not finish')).toBeVisible();
    await expect(status.getByText(/has 2 pages/)).toBeVisible();
    await expect(status.getByRole('button', { name: 'Clear' })).toBeVisible();
  });

  test('an error clears the stale preview rather than leaving it beside itself', async ({ page }) => {
    await run(page, '/pdf/rotate', ['three-pages.pdf']);
    await expect(page.locator('[data-result-preview="pdf"]')).toBeVisible({ timeout: 20_000 });

    // Out of range for a 3 page document.
    await page.getByLabel('Pages').fill('99');
    await expect(page.locator('[data-status="error"]')).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('[data-result-preview]')).toHaveCount(0);
  });
});

test.describe('settings that need the file first', () => {
  test('Watermark image offers no settings until an image is in', async ({ page }) => {
    await page.goto('/image/watermark');
    // Text, size, opacity, colour and position are all adjustments to a
    // picture. With no picture they are five blind choices.
    await expect(page.getByLabel('Text')).toHaveCount(0);
    await expect(page.getByLabel('Opacity')).toHaveCount(0);

    const b64 = await page.evaluate(() => {
      const c = document.createElement('canvas'); c.width = 300; c.height = 200;
      const x = c.getContext('2d')!; x.fillStyle = '#e0457b'; x.fillRect(0, 0, 300, 200);
      return c.toDataURL('image/png').split(',')[1]!;
    });
    await page.locator('input[type=file]').setInputFiles({ name: 'photo.png', mimeType: 'image/png', buffer: Buffer.from(b64, 'base64') });

    await expect(page.getByLabel('Text')).toBeVisible({ timeout: 20_000 });

    // The tool asks for the one thing it cannot guess rather than stamping a
    // default onto someone's photo, so this is the state in between.
    await expect(page.locator('[data-status-message]')).toHaveText('Type the watermark text.');

    await page.getByLabel('Text').fill('© Nhako');
    // Now the result is previewed, so the adjustment can be judged.
    await expect(page.locator('[data-result-preview="image"]')).toBeVisible({ timeout: 20_000 });
  });

  test('an ordinary file tool still shows its settings up front', async ({ page }) => {
    // The preset pages depend on this: /pdf/compress/500kb sets a target
    // before any file exists, and the choice has to be on screen to be seen.
    await page.goto('/pdf/compress/500kb');
    await expect(page.getByLabel('Target size')).toBeVisible();
  });
});

test.describe('batch support is stated', () => {
  test('a multi-file tool says so', async ({ page }) => {
    await page.goto('/image/compress');
    await expect(page.getByText('Takes several files at once.')).toBeVisible();
  });

  test('a single-file tool says so too', async ({ page }) => {
    await page.goto('/pdf/watermark');
    await expect(page.getByText('One file at a time.')).toBeVisible();
  });
});
