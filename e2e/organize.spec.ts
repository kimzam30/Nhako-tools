import { test, expect, type Page } from '@playwright/test';
import { PDFDocument } from 'pdf-lib';

/**
 * Organize PDF: the position badge, the drag feedback and the two retreats.
 *
 * All three exist because the page was usable but unreadable: the number that
 * changes when you reorder was the quietest thing on the card, a drag gave no
 * sign it had registered until the grid had already reflowed, and undoing an
 * edit threw the document away with it.
 */

/** A PDF whose pages have distinct widths, so their order is readable later. */
async function pdfFile(widths: number[], name = 'doc.pdf') {
  const doc = await PDFDocument.create();
  for (const w of widths) doc.addPage([w, 800]);
  return { name, mimeType: 'application/pdf', buffer: Buffer.from(await doc.save()) };
}

async function load(page: Page, widths: number[], name = 'doc.pdf') {
  await page.goto('/pdf/organize');
  await page.locator('input[type=file]').setInputFiles(await pdfFile(widths, name));
  await expect(page.getByText(`${widths.length} pages`)).toBeVisible({ timeout: 20_000 });
}

/** The position chips, in grid order. */
const positions = (page: Page) => page.locator('[data-position]');

async function savedWidths(page: Page) {
  await page.getByRole('button', { name: 'Save PDF' }).click();
  const href = await page.getByRole('link', { name: 'Save' }).getAttribute('href');
  const b64 = await page.evaluate(async (h) => {
    const bytes = new Uint8Array(await (await fetch(h!)).arrayBuffer());
    let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(s);
  }, href);
  const doc = await PDFDocument.load(Buffer.from(b64, 'base64'));
  return doc.getPages().map((p) => Math.round(p.getWidth()));
}

test.describe('the position is legible', () => {
  test('every page carries its position as its own chip', async ({ page }) => {
    await load(page, [100, 200, 300]);
    await expect(positions(page)).toHaveText(['1', '2', '3']);
  });

  test('the chip is the loudest thing on the card, not muted body text', async ({ page }) => {
    await load(page, [100, 200]);
    const style = await positions(page).first().evaluate((el) => {
      const s = getComputedStyle(el);
      return { weight: Number(s.fontWeight), bg: s.backgroundColor };
    });
    expect(style.weight).toBeGreaterThanOrEqual(700);
    // A filled chip, not a transparent run of text.
    expect(style.bg).not.toBe('rgba(0, 0, 0, 0)');
  });

  test('the numbers renumber when a page moves', async ({ page }) => {
    await load(page, [100, 200, 300]);
    await page.getByRole('button', { name: 'Move later: Page 1 of doc.pdf' }).click();
    await expect(positions(page)).toHaveText(['1', '2', '3']);
    // Position 2 is now the page that was first: proven by what saves out.
    expect(await savedWidths(page)).toEqual([200, 100, 300]);
  });
});

test.describe('dragging says what it is doing', () => {
  test('a drag shows the gap the page will land in', async ({ page }) => {
    await load(page, [100, 200, 300]);

    const first = page.locator('[data-card]').nth(0);
    const third = page.locator('[data-card]').nth(2);

    // Held part-way, before release: the target must already be marked.
    await first.hover();
    await page.mouse.down();
    await third.hover();
    await third.hover();
    await expect(page.locator('[data-drop-edge]')).toHaveCount(1);
    await expect(first).toHaveAttribute('data-dragging', 'true');
    await page.mouse.up();
  });

  test('dropping past the middle of a card lands after it, not before', async ({ page }) => {
    await load(page, [100, 200, 300]);

    const first = page.locator('[data-card]').nth(0);
    const third = page.locator('[data-card]').nth(2);
    const box = await third.boundingBox();

    await first.hover();
    await page.mouse.down();
    // Right of centre means "after this one".
    await page.mouse.move(box!.x + box!.width * 0.85, box!.y + box!.height / 2);
    await page.mouse.move(box!.x + box!.width * 0.85, box!.y + box!.height / 2);
    await expect(third).toHaveAttribute('data-drop-edge', 'after');
    await page.mouse.up();

    expect(await savedWidths(page)).toEqual([200, 300, 100]);
  });

  test('the move is announced, so it is not only a visual change', async ({ page }) => {
    await load(page, [100, 200, 300]);
    await page.getByRole('button', { name: 'Move later: Page 1 of doc.pdf' }).click();
    await expect(page.getByText('Page moved to position 2 of 3')).toBeAttached();
  });
});

test.describe('two different retreats', () => {
  test('Reset order puts the pages back without asking for the file again', async ({ page }) => {
    await load(page, [100, 200, 300]);

    await page.getByRole('button', { name: 'Move later: Page 1 of doc.pdf' }).click();
    await page.getByRole('button', { name: 'Rotate clockwise: Page 3 of doc.pdf' }).click();
    await page.getByRole('button', { name: 'Remove page: Page 2 of doc.pdf' }).click();
    await expect(positions(page)).toHaveCount(2);

    await page.getByRole('button', { name: 'Reset order' }).click();

    // The drop zone must NOT be back: the document is still loaded.
    await expect(page.getByText('Drop PDFs here, or browse')).toHaveCount(0);
    await expect(page.getByText('3 pages')).toBeVisible();
    await expect(positions(page)).toHaveText(['1', '2', '3']);
    // The removed page returned and the rotation was cleared.
    expect(await savedWidths(page)).toEqual([100, 200, 300]);
  });

  test('Start over does ask for the file again', async ({ page }) => {
    await load(page, [100, 200]);
    await page.getByRole('button', { name: 'Start over' }).click();
    await expect(page.getByText('Drop PDFs here, or browse')).toBeVisible();
  });

  test('Reset order is offered only once there is something to undo', async ({ page }) => {
    await load(page, [100, 200, 300]);
    const button = page.getByRole('button', { name: 'Reset order' });
    await expect(button).toBeDisabled();

    await page.getByRole('button', { name: 'Move later: Page 1 of doc.pdf' }).click();
    await expect(button).toBeEnabled();

    await button.click();
    await expect(button).toBeDisabled();
  });
});
