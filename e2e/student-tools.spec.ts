import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { PDFDocument, PDFName, PDFDict, type PDFRawStream } from 'pdf-lib';
import JSZip from 'jszip';

/**
 * The seven tools added on 2026-09-25: Print handouts, Remove pages, Extract
 * pages, Grayscale PDF, Repair PDF, PDF to PowerPoint and the CGPA calculator.
 * Every test reads the OUTPUT back and checks what is in it, not just that a
 * Save button appeared.
 */

const FIXTURE = path.join(import.meta.dirname, 'fixtures', 'three-pages.pdf');
const threePages = () => ({ name: 'three-pages.pdf', mimeType: 'application/pdf', buffer: readFileSync(FIXTURE) });

async function saved(page: Page): Promise<Buffer> {
  const href = await page.locator('[data-status="done"] a[download]').first().getAttribute('href');
  const b64 = await page.evaluate(async (h) => {
    const bytes = new Uint8Array(await (await fetch(h!)).arrayBuffer());
    let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(s);
  }, href);
  return Buffer.from(b64, 'base64');
}

async function done(page: Page, timeout = 30_000) {
  const status = page.locator('[data-status="done"]');
  await expect(status).toBeVisible({ timeout });
  return status;
}

test.describe('Print handouts', () => {
  test('puts three pages two to a sheet, on A4', async ({ page }) => {
    await page.goto('/pdf/n-up');
    await page.getByLabel('Pages per sheet').selectOption('2');
    await page.locator('input[type=file]').setInputFiles(threePages());
    await expect(await done(page)).toContainText('3 pages on 2 sheets, 2 per sheet');
    const doc = await PDFDocument.load(await saved(page));
    expect(doc.getPageCount()).toBe(2);
    const { width, height } = doc.getPage(0).getSize();
    expect(Math.round(Math.min(width, height))).toBe(595);
    expect(Math.round(Math.max(width, height))).toBe(842);
  });
});

test.describe('Remove pages', () => {
  test('drops page 2 and keeps 1 and 3', async ({ page }) => {
    await page.goto('/pdf/remove-pages');
    await page.getByLabel('Pages to remove').fill('2');
    await page.locator('input[type=file]').setInputFiles(threePages());
    await expect(await done(page)).toContainText('1 page removed, 2 kept');
    expect((await PDFDocument.load(await saved(page))).getPageCount()).toBe(2);
  });

  test('says so when asked to remove every page', async ({ page }) => {
    await page.goto('/pdf/remove-pages');
    await page.getByLabel('Pages to remove').fill('1-3');
    await page.locator('input[type=file]').setInputFiles(threePages());
    await expect(page.locator('[data-status-message]')).toContainText('every page', { timeout: 20_000 });
  });
});

test.describe('Extract pages', () => {
  test('pulls pages 3 and 1 out, in that order', async ({ page }) => {
    await page.goto('/pdf/extract-pages');
    await page.getByLabel('Pages to extract').fill('3, 1');
    await page.locator('input[type=file]').setInputFiles(threePages());
    await expect(await done(page)).toContainText('2 pages extracted');
    expect((await PDFDocument.load(await saved(page))).getPageCount()).toBe(2);
  });
});

test.describe('Grayscale PDF', () => {
  test('every pixel of the converted page is grey', async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto('/pdf/grayscale');
    await page.locator('input[type=file]').setInputFiles(threePages());
    await expect(await done(page, 60_000)).toContainText('3 pages in grayscale at 150 dpi');
    const doc = await PDFDocument.load(await saved(page));
    expect(doc.getPageCount()).toBe(3);
    // The page picture is the one JPEG in page 1's resources.
    const xobjects = doc.getPage(0).node.Resources()!.lookup(PDFName.of('XObject'), PDFDict);
    const image = xobjects.lookup(xobjects.keys()[0]!) as PDFRawStream;
    const jpeg = Buffer.from(image.getContents()).toString('base64');
    const worst = await page.evaluate(async (b64) => {
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const bmp = await createImageBitmap(new Blob([bytes], { type: 'image/jpeg' }));
      const c = new OffscreenCanvas(bmp.width, bmp.height);
      const x = c.getContext('2d')!; x.drawImage(bmp, 0, 0);
      const d = x.getImageData(0, 0, bmp.width, bmp.height).data;
      let max = 0;
      for (let i = 0; i < d.length; i += 4) max = Math.max(max, Math.abs(d[i]! - d[i + 1]!), Math.abs(d[i + 1]! - d[i + 2]!));
      return max;
    }, jpeg);
    // JPEG chroma rounding allows a hair of difference; colour would be far more.
    expect(worst).toBeLessThanOrEqual(3);
  });
});

test.describe('Repair PDF', () => {
  test('rebuilds a classic cross-reference table with every offset wrong', async ({ page }) => {
    test.setTimeout(60_000);
    // A PDF 1.4-style file with a plain xref table, whose offsets are then
    // shifted by inserting junk ahead of the objects: every entry now points
    // into the middle of something else. qpdf's scan recovers this.
    const src = await PDFDocument.load(readFileSync(FIXTURE));
    const classic = Buffer.from(await src.save({ useObjectStreams: false })).toString('latin1');
    const shifted = classic.replace(/\n1 0 obj/, '\n% ' + 'x'.repeat(400) + '\n1 0 obj');
    await page.goto('/pdf/repair');
    await page.locator('input[type=file]').setInputFiles({ name: 'shifted.pdf', mimeType: 'application/pdf', buffer: Buffer.from(shifted, 'latin1') });
    await expect(await done(page, 45_000)).toContainText('Repaired, 3 pages recovered');
    expect((await PDFDocument.load(await saved(page))).getPageCount()).toBe(3);
  });

  test('rebuilds a modern file whose cross-reference stream is lost', async ({ page }) => {
    test.setTimeout(60_000);
    // The xref here is a compressed stream and objects are packed in object
    // streams. With its offset broken qpdf gives up; the second rescuer
    // reads the file object by object and gets all three pages back.
    const broken = readFileSync(FIXTURE).toString('latin1')
      .replace(/startxref\s+\d+/, 'startxref\n999999')
      .replace(/\nxref\n/, '\nxrfe\n');
    await page.goto('/pdf/repair');
    await page.locator('input[type=file]').setInputFiles({ name: 'broken.pdf', mimeType: 'application/pdf', buffer: Buffer.from(broken, 'latin1') });
    await expect(await done(page, 45_000)).toContainText('Repaired, 3 pages recovered');
    expect((await PDFDocument.load(await saved(page))).getPageCount()).toBe(3);
  });

  test('says a healthy file had nothing wrong', async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto('/pdf/repair');
    await page.locator('input[type=file]').setInputFiles(threePages());
    await expect(await done(page, 45_000)).toContainText('No damage found');
  });

  test('says plainly when a file is past saving', async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto('/pdf/repair');
    const stub = readFileSync(FIXTURE).subarray(0, 120);
    await page.locator('input[type=file]').setInputFiles({ name: 'cut.pdf', mimeType: 'application/pdf', buffer: stub });
    await expect(page.locator('[data-status-message]')).toContainText('too badly damaged', { timeout: 45_000 });
  });

  test('refuses something that is not a PDF at all', async ({ page }) => {
    await page.goto('/pdf/repair');
    await page.locator('input[type=file]').setInputFiles({ name: 'notes.pdf', mimeType: 'application/pdf', buffer: Buffer.from('just some text') });
    await expect(page.locator('[data-status-message]')).toContainText('not a PDF', { timeout: 20_000 });
  });
});

test.describe('PDF to PowerPoint', () => {
  test('makes one slide per page, with the page text in editable boxes over a picture', async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto('/pdf/to-powerpoint');
    await page.locator('input[type=file]').setInputFiles(threePages());
    await expect(await done(page, 60_000)).toContainText(/3 slides, \d+ editable text box/);
    const zip = await JSZip.loadAsync(await saved(page));
    const slides = Object.keys(zip.files).filter((f) => /^ppt\/slides\/slide\d+\.xml$/.test(f));
    expect(slides).toHaveLength(3);
    const first = await zip.file('ppt/slides/slide1.xml')!.async('string');
    expect(first).toContain('<a:t>');
    expect(first).toMatch(/page 1 of 3/);
    expect(first).toContain('<p:pic>');
    expect(zip.file('ppt/media/image1.jpeg')).not.toBeNull();
  });

  test('picture mode keeps the look and writes no text boxes', async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto('/pdf/to-powerpoint');
    await page.getByLabel('Slides').selectOption('picture');
    await page.locator('input[type=file]').setInputFiles(threePages());
    await expect(await done(page, 60_000)).toContainText('3 slides as pictures');
    const zip = await JSZip.loadAsync(await saved(page));
    expect(await zip.file('ppt/slides/slide1.xml')!.async('string')).not.toContain('<a:t>');
  });
});

test.describe('CGPA calculator', () => {
  test('reproduces the worked example: GPA 3.11, CGPA 3.18, 3.61 needed', async ({ page }) => {
    await page.goto('/calc/cgpa');
    await page.getByLabel('Current CGPA').fill('3.21');
    await page.getByLabel('Credits completed').fill('36');
    const grades = ['A', 'B+', 'C', 'A-'];
    const credits = ['3', '3', '4', '2'];
    for (let i = 0; i < 4; i++) {
      await page.locator(`#course-${i}-credits`).fill(credits[i]!);
      await page.locator(`#course-${i}-grade`).selectOption(grades[i]!);
    }
    await expect(page.getByTestId('gpa')).toHaveText('3.11');
    await expect(page.getByTestId('cgpa')).toHaveText('3.18');
    await page.getByLabel('Target CGPA').fill('3.30');
    await page.getByLabel('Credits next semester').fill('18');
    await expect(page.getByTestId('plan')).toHaveText('You need a GPA of 3.61 next semester.');
  });

  test('a changed grade point is used straight away', async ({ page }) => {
    await page.goto('/calc/cgpa');
    await page.locator('#course-0-grade').selectOption('D+');
    await expect(page.getByTestId('gpa')).toHaveText('1.30');
    await page.locator('summary', { hasText: 'Grade points' }).click();
    await page.getByLabel('Grade points D+').fill('1.33');
    await expect(page.getByTestId('gpa')).toHaveText('1.33');
  });

  test('adds and removes courses', async ({ page }) => {
    await page.goto('/calc/cgpa');
    await expect(page.locator('[data-course-row]')).toHaveCount(4);
    await page.getByRole('button', { name: /Add a course/ }).click();
    await expect(page.locator('[data-course-row]')).toHaveCount(5);
    await page.getByRole('button', { name: 'Remove Course 1' }).click();
    await expect(page.locator('[data-course-row]')).toHaveCount(4);
  });

  test('speaks Malay on the Malay page', async ({ page }) => {
    await page.goto('/ms/calc/cgpa');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Kalkulator PNGK');
    await expect(page.getByTestId('cgpa')).toBeVisible();
    await expect(page.locator('p', { hasText: /^PNGK baharu$/ })).toBeVisible();
  });
});

test.describe('homepage layout', () => {
  test('has no typed readout, and the popular shortcuts lead somewhere real', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('[data-readout]')).toHaveCount(0);
    const links = page.locator('[data-popular] a');
    expect(await links.count()).toBeGreaterThanOrEqual(5);
    await links.first().click();
    await expect(page).toHaveURL(/\/pdf\/compress\/500kb$/);
  });

  test('has no category jump bar, and the popular cards carry a mark and a way to every tool', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('[data-jump]')).toHaveCount(0);
    const cards = page.locator('[data-popular] li');
    await expect(cards).toHaveCount(8);
    await expect(page.locator('[data-popular] a svg').first()).toBeVisible();
    await page.locator('[data-popular] a[href="#pdf"]').click();
    await expect(page.locator('#pdf')).toBeInViewport();
  });

  test('hides the popular cards while a search is live', async ({ page }) => {
    await page.goto('/');
    await page.locator('#tool-search').fill('merge');
    await expect(page.locator('[data-popular]')).toBeHidden();
    await page.locator('#tool-search').fill('');
    await expect(page.locator('[data-popular]')).toBeVisible();
  });
});
