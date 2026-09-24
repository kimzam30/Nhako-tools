import { test, expect, type Page } from '@playwright/test';
import { PDFDocument } from 'pdf-lib';
import JSZip from 'jszip';

/**
 * The three tools that now stage their input before doing anything.
 *
 * Merge PDF, JPG to PDF and Split PDF all used to be a drop zone that ran on
 * contact. That made the two things people most wanted to control impossible:
 * the ORDER of a merge or a photo set, and WHICH pages a split keeps. What is
 * asserted here is that the arrangement on screen is the arrangement in the
 * file, proven by reading the output back rather than by trusting the UI.
 */

/** A PDF whose pages have distinct widths, so their order is readable later. */
async function pdf(widths: number[], name: string) {
  const doc = await PDFDocument.create();
  for (const w of widths) doc.addPage([w, 800]);
  return { name, mimeType: 'application/pdf', buffer: Buffer.from(await doc.save()) };
}

/** A solid PNG of a given size, so page orientation is readable later. */
async function png(page: Page, w: number, h: number, name: string) {
  const b64 = await page.evaluate(([w, h]) => {
    const c = document.createElement('canvas'); c.width = w!; c.height = h!;
    const x = c.getContext('2d')!; x.fillStyle = '#e0457b'; x.fillRect(0, 0, w!, h!);
    return c.toDataURL('image/png').split(',')[1]!;
  }, [w, h]);
  return { name, mimeType: 'image/png', buffer: Buffer.from(b64, 'base64') };
}

async function saved(page: Page) {
  const href = await page.getByRole('link', { name: 'Save' }).getAttribute('href');
  const b64 = await page.evaluate(async (h) => {
    const bytes = new Uint8Array(await (await fetch(h!)).arrayBuffer());
    let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(s);
  }, href);
  return Buffer.from(b64, 'base64');
}

const widths = async (page: Page) =>
  (await PDFDocument.load(await saved(page))).getPages().map((p) => Math.round(p.getWidth()));

test.describe('Merge PDF', () => {
  test('nothing runs until Combine is pressed', async ({ page }) => {
    await page.goto('/pdf/merge');
    await page.locator('input[type=file]').setInputFiles([await pdf([100], 'a.pdf'), await pdf([200], 'b.pdf')]);

    // Staged and visible, but no result and no Save: this is the whole
    // difference from the old drop zone, which had already produced a file.
    await expect(page.locator('[data-stage-card]')).toHaveCount(2);
    await expect(page.getByRole('link', { name: 'Save' })).toHaveCount(0);

    await page.getByRole('button', { name: 'Combine into one PDF' }).click();
    await expect(page.getByRole('link', { name: 'Save' })).toBeVisible({ timeout: 20_000 });
  });

  test('the order on screen is the order in the PDF', async ({ page }) => {
    await page.goto('/pdf/merge');
    await page.locator('input[type=file]').setInputFiles([
      await pdf([100], 'a.pdf'), await pdf([200], 'b.pdf'), await pdf([300], 'c.pdf'),
    ]);
    await page.getByRole('button', { name: 'Combine into one PDF' }).click();
    expect(await widths(page)).toEqual([100, 200, 300]);

    // Send the first file to the end and rebuild.
    await page.getByRole('button', { name: 'Move later: a.pdf' }).click();
    await page.getByRole('button', { name: 'Move later: a.pdf' }).click();
    await expect(page.locator('[data-stage-card]').last()).toContainText('a.pdf');
    await page.getByRole('button', { name: 'Combine into one PDF' }).click();
    expect(await widths(page)).toEqual([200, 300, 100]);
  });

  test('dragging a file reorders it, and the drop gap is shown first', async ({ page }) => {
    await page.goto('/pdf/merge');
    await page.locator('input[type=file]').setInputFiles([
      await pdf([100], 'a.pdf'), await pdf([200], 'b.pdf'), await pdf([300], 'c.pdf'),
    ]);

    const first = page.locator('[data-stage-card]').nth(0);
    const third = page.locator('[data-stage-card]').nth(2);
    const box = (await third.boundingBox())!;

    await first.hover();
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.85, box.y + box.height / 2);
    await page.mouse.move(box.x + box.width * 0.85, box.y + box.height / 2);
    await expect(third).toHaveAttribute('data-drop-edge', 'after');
    await page.mouse.up();

    await page.getByRole('button', { name: 'Combine into one PDF' }).click();
    expect(await widths(page)).toEqual([200, 300, 100]);
  });

  test('a file can be taken back out of the queue', async ({ page }) => {
    await page.goto('/pdf/merge');
    await page.locator('input[type=file]').setInputFiles([
      await pdf([100], 'a.pdf'), await pdf([200], 'b.pdf'), await pdf([300], 'c.pdf'),
    ]);
    await page.getByRole('button', { name: 'Remove: b.pdf' }).click();
    await expect(page.locator('[data-stage-card]')).toHaveCount(2);
    await page.getByRole('button', { name: 'Combine into one PDF' }).click();
    expect(await widths(page)).toEqual([100, 300]);
  });

  test('more files join the queue instead of replacing it', async ({ page }) => {
    await page.goto('/pdf/merge');
    await page.locator('input[type=file]').setInputFiles([await pdf([100], 'a.pdf')]);
    await expect(page.locator('[data-stage-card]')).toHaveCount(1);
    await page.locator('input[type=file]').setInputFiles([await pdf([200], 'b.pdf')]);
    await expect(page.locator('[data-stage-card]')).toHaveCount(2);
  });

  test('something that is not a PDF is named, not silently dropped', async ({ page }) => {
    await page.goto('/pdf/merge');
    await page.locator('input[type=file]').setInputFiles([
      await pdf([100], 'a.pdf'),
      { name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('hello') },
    ]);
    await expect(page.locator('[data-status-message]')).toContainText('notes.txt');
    await expect(page.locator('[data-stage-card]')).toHaveCount(1);
  });

  test('a non-PDF picked before the page hydrates is still named', async ({ page }) => {
    // Hold every island script until the files are in, so the pre-hydration
    // path runs every time instead of only when the machine is busy. That
    // path used to filter the .txt out without a word (found 2026-09-25).
    let release!: () => void;
    const gate = new Promise<void>((r) => { release = r; });
    await page.route('**/_astro/*.js', async (route) => { await gate; await route.continue(); });
    await page.goto('/pdf/merge', { waitUntil: 'domcontentloaded' });
    await page.locator('input[type=file]').setInputFiles([
      await pdf([100], 'a.pdf'),
      { name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('hello') },
    ]);
    release();
    await expect(page.locator('[data-status-message]')).toContainText('notes.txt');
    await expect(page.locator('[data-stage-card]')).toHaveCount(1);
  });

  test('editing the queue invalidates the result it no longer matches', async ({ page }) => {
    await page.goto('/pdf/merge');
    await page.locator('input[type=file]').setInputFiles([await pdf([100], 'a.pdf'), await pdf([200], 'b.pdf')]);
    await page.getByRole('button', { name: 'Combine into one PDF' }).click();
    await expect(page.getByRole('link', { name: 'Save' })).toBeVisible({ timeout: 20_000 });

    // A Save link left on screen after a reorder would hand over the old file.
    await page.getByRole('button', { name: 'Remove: b.pdf' }).click();
    await expect(page.getByRole('link', { name: 'Save' })).toHaveCount(0);
  });
});

test.describe('JPG to PDF', () => {
  test('the order of the photos is the order of the pages', async ({ page }) => {
    await page.goto('/pdf/jpg-to-pdf');
    await page.locator('input[type=file]').setInputFiles([
      await png(page, 400, 600, 'tall.png'),
      await png(page, 600, 400, 'wide.png'),
    ]);
    await expect(page.locator('[data-position]')).toHaveText(['1', '2']);

    await page.getByRole('button', { name: 'Move earlier: wide.png' }).click();
    await page.getByRole('button', { name: 'Make the PDF' }).click();

    const doc = await PDFDocument.load(await saved(page));
    const shapes = doc.getPages().map((p) => (p.getWidth() > p.getHeight() ? 'landscape' : 'portrait'));
    // Wide first now, so the landscape page comes first.
    expect(shapes).toEqual(['landscape', 'portrait']);
  });

  test('a page setting invalidates the PDF built before it', async ({ page }) => {
    await page.goto('/pdf/jpg-to-pdf');
    await page.locator('input[type=file]').setInputFiles([await png(page, 400, 600, 'tall.png')]);
    await page.getByRole('button', { name: 'Make the PDF' }).click();
    await expect(page.getByRole('link', { name: 'Save' })).toBeVisible({ timeout: 20_000 });

    await page.getByLabel('Page size').selectOption('letter');
    await expect(page.getByRole('link', { name: 'Save' })).toHaveCount(0);

    await page.getByRole('button', { name: 'Make the PDF' }).click();
    const doc = await PDFDocument.load(await saved(page));
    // US Letter is 612 x 792pt, not A4's 595 x 842.
    expect(Math.round(doc.getPage(0).getWidth())).toBe(612);
  });

  test('a file that is not an image is named, not silently dropped', async ({ page }) => {
    await page.goto('/pdf/jpg-to-pdf');
    await page.locator('input[type=file]').setInputFiles([
      await png(page, 100, 100, 'ok.png'),
      { name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('hello') },
    ]);
    await expect(page.locator('[data-status-message]')).toContainText('notes.txt');
    await expect(page.locator('[data-stage-card]')).toHaveCount(1);
  });
});

test.describe('Split PDF', () => {
  test('every page is drawn with a tick box, all ticked to begin with', async ({ page }) => {
    await page.goto('/pdf/split');
    await page.locator('input[type=file]').setInputFiles(await pdf([100, 200, 300, 400], 'doc.pdf'));
    await expect(page.locator('[data-page-card]')).toHaveCount(4);
    await expect(page.getByText('4 of 4 pages selected')).toBeVisible();
    await expect(page.getByRole('checkbox', { name: 'Page 3' })).toBeChecked();
  });

  test('only the ticked pages come out', async ({ page }) => {
    await page.goto('/pdf/split');
    await page.locator('input[type=file]').setInputFiles(await pdf([100, 200, 300, 400], 'doc.pdf'));

    await page.getByRole('button', { name: 'Select none' }).click();
    await expect(page.getByText('0 of 4 pages selected')).toBeVisible();
    await page.getByRole('checkbox', { name: 'Page 2' }).check();
    await page.getByRole('checkbox', { name: 'Page 4' }).check();
    await page.getByRole('button', { name: 'Split', exact: true }).click();

    const zip = await JSZip.loadAsync(await saved(page));
    expect(Object.keys(zip.files).sort()).toEqual(['doc-page-2.pdf', 'doc-page-4.pdf']);
  });

  test('the other mode keeps the selection together as one PDF', async ({ page }) => {
    await page.goto('/pdf/split');
    await page.locator('input[type=file]').setInputFiles(await pdf([100, 200, 300, 400], 'doc.pdf'));

    await page.getByRole('button', { name: 'Select none' }).click();
    await page.getByRole('checkbox', { name: 'Page 1' }).check();
    await page.getByRole('checkbox', { name: 'Page 3' }).check();
    await page.getByRole('radio', { name: 'All selected pages in one PDF' }).check();
    await page.getByRole('button', { name: 'Split', exact: true }).click();

    // One PDF, in page order, not a ZIP of two.
    expect(await widths(page)).toEqual([100, 300]);
    await expect(page.getByLabel('File name')).toHaveValue('doc-extract');
  });

  test('the bulk selectors do what they say', async ({ page }) => {
    await page.goto('/pdf/split');
    await page.locator('input[type=file]').setInputFiles(await pdf([100, 200, 300, 400, 500], 'doc.pdf'));

    await page.getByRole('button', { name: 'Odd pages' }).click();
    await expect(page.getByText('3 of 5 pages selected')).toBeVisible();

    await page.getByRole('button', { name: 'Invert' }).click();
    await expect(page.getByText('2 of 5 pages selected')).toBeVisible();
    await expect(page.getByRole('checkbox', { name: 'Page 2' })).toBeChecked();
    await expect(page.getByRole('checkbox', { name: 'Page 1' })).not.toBeChecked();

    await page.getByRole('button', { name: 'Select all' }).click();
    await expect(page.getByText('5 of 5 pages selected')).toBeVisible();
  });

  test('splitting nothing is not offered', async ({ page }) => {
    await page.goto('/pdf/split');
    await page.locator('input[type=file]').setInputFiles(await pdf([100, 200], 'doc.pdf'));
    await page.getByRole('button', { name: 'Select none' }).click();
    await expect(page.getByRole('button', { name: 'Split', exact: true })).toBeDisabled();
  });

  test('changing the selection invalidates the result it no longer matches', async ({ page }) => {
    await page.goto('/pdf/split');
    await page.locator('input[type=file]').setInputFiles(await pdf([100, 200], 'doc.pdf'));
    await page.getByRole('button', { name: 'Split', exact: true }).click();
    await expect(page.getByRole('link', { name: 'Save' })).toBeVisible({ timeout: 20_000 });

    await page.getByRole('checkbox', { name: 'Page 1' }).uncheck();
    await expect(page.getByRole('link', { name: 'Save' })).toHaveCount(0);
  });

  test('a file that cannot be read is named while the pages are being drawn', async ({ page }) => {
    await page.goto('/pdf/split');
    await page.locator('input[type=file]').setInputFiles({
      name: 'separuh.pdf', mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4 then nothing but noise '.repeat(40)),
    });
    await expect(page.locator('[data-status-message]')).toContainText('separuh.pdf', { timeout: 20_000 });
  });
});
