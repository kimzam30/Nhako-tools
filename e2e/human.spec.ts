/**
 * Every file tool, used the way a person uses it, on real files.
 *
 * Each test: start on the home page, type the tool's name into search, tap the
 * result, set the options a person would set, tap the drop zone and pick a
 * real file (camera JPEG, iPhone HEIC, Word/Excel/PowerPoint document, typeset
 * paper, phone scan, 1080p video, recorded speech), wait for the result,
 * press Save, and check the bytes that were saved.
 *
 * Needs `node scripts/fetch-real-fixtures.mjs` first. Runs on the desktop
 * projects and, through scripts/device-e2e.sh, on real phones and tablets.
 */
import { PDFDocument, degrees } from 'pdf-lib';
import type { Page } from '@playwright/test';
import { test, expect, real, fixture, openFromHome, chooseFiles, save, keep, imageInfo, magic, DEVICE } from './support/human';
import { existsSync } from 'node:fs';

test.skip(!existsSync(real('paper.pdf')), 'run node scripts/fetch-real-fixtures.mjs first');
test.describe.configure({ timeout: 240_000 });

const PAPER_PAGES = 15;

async function pdfText(bytes: Buffer, page = 1) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const doc = await pdfjs.getDocument({ data: new Uint8Array(bytes), verbosity: 0 }).promise;
  const content = await (await doc.getPage(page)).getTextContent();
  const text = content.items.map((i) => ('str' in i ? i.str : '')).join(' ');
  await doc.destroy();
  return text;
}
const pages = async (bytes: Buffer) => (await PDFDocument.load(bytes, { ignoreEncryption: true })).getPageCount();
const zip = async (bytes: Buffer) => (await import('jszip')).default.loadAsync(bytes);

/** Engines too big for a phone's tab are proven on desktop Chromium only. */
const desktopChromiumOnly = (name: string) => !DEVICE && name !== 'chromium';

test.describe('PDF tools, by hand, on real PDFs', () => {
  test('compress a 40-page phone scan with the recommended mode', async ({ page, shot }, info) => {
    await openFromHome(page, 'Compress PDF');
    await shot('opened');
    await chooseFiles(page, [real('scanned-40.pdf')]);
    const out = await save(page);
    await shot('done');
    await keep(info, out);
    expect(out.name).toMatch(/\.pdf$/);
    expect(await pages(out.bytes)).toBe(40);
    expect(out.bytes.length).toBeLessThan(5_723_804);
  });

  test('compress a typeset paper losslessly: still the same document', async ({ page }, info) => {
    await openFromHome(page, 'Compress PDF');
    await page.getByLabel('Mode').selectOption('lossless');
    await chooseFiles(page, [real('paper.pdf')]);
    const out = await save(page);
    await keep(info, out);
    expect(await pages(out.bytes)).toBe(PAPER_PAGES);
    expect(await pdfText(out.bytes)).toContain('Attention Is All You Need');
  });

  test('a person landing from Google on "compress pdf 1mb" gets a file under 1 MB', async ({ page, shot }, info) => {
    await page.goto('/pdf/compress/1mb');
    await chooseFiles(page, [real('scanned-40.pdf')]);
    const out = await save(page);
    await shot('done');
    await keep(info, out);
    expect(out.bytes.length).toBeLessThanOrEqual(1_000_000);
    expect(await pages(out.bytes)).toBe(40);
  });

  for (const [file, pagesIn] of [['scanned-40.pdf', 40], ['paper.pdf', PAPER_PAGES]] as const) {
    test(`landing on "compress pdf 300kb" with ${file} gets a PDF under 300 KB`, async ({ page }, info) => {
      await page.goto('/pdf/compress/300kb');
      await chooseFiles(page, [real(file)]);
      const out = await save(page, /^Save/, 200_000);
      await keep(info, out);
      expect(out.bytes.length).toBeLessThanOrEqual(300_000);
      expect(await pages(out.bytes)).toBe(pagesIn);
    });
  }

  test('SPA MyRésumé: a 2-page A4 certificate becomes two JPGs under 1 MB', async ({ page }, info) => {
    await page.goto('/pdf/to-image/spa-myresume');
    await chooseFiles(page, [fixture('two-pages.pdf')]);
    const out = await save(page);
    await keep(info, out);
    const z = await zip(out.bytes);
    const jpgs = Object.keys(z.files).filter((n) => n.endsWith('.jpg')).sort();
    expect(jpgs).toHaveLength(2);
    for (const n of jpgs) {
      const b = await z.file(n)!.async('nodebuffer');
      expect(b.length).toBeLessThan(1_000_000);
      const img = await imageInfo(page, b, 'image/jpeg');
      // 144 dpi A4: 595 x 842 pt at 2x.
      expect(Math.abs(img.width - 1190)).toBeLessThanOrEqual(2);
      expect(Math.abs(img.height - 1684)).toBeLessThanOrEqual(2);
    }
  });

  // Rotate runs in the worker. A ToolError thrown there must reach the person
  // word for word, in the page's language, not as a generic or mapped error.
  for (const [path, message] of [
    ['/pdf/rotate', 'Could not read "damaged.pdf" as a PDF.'],
    ['/ms/pdf/rotate', '"damaged.pdf" tidak dapat dibaca sebagai PDF.'],
  ] as const) {
    test(`a damaged PDF in ${path} gets its own plain message from the worker`, async ({ page, shot }) => {
      await page.goto(path);
      await chooseFiles(page, [real('damaged.pdf')]);
      await expect(page.getByText(message, { exact: true })).toBeVisible({ timeout: 60_000 });
      await shot('worker-error');
    });
  }

  test('redact a payslip: the name, IC and salary are gone from the file, not just covered', async ({ page, shot }, info) => {
    await openFromHome(page, 'Redact PDF');
    await page.getByLabel('Words to black out').fill('Ali bin Abu, 4,321.00');
    await chooseFiles(page, [real('payslip.pdf')]);
    await expect(page.getByText(/^3 matches blacked out on 1 page/)).toBeVisible({ timeout: 60_000 });
    const out = await save(page);
    await shot('redacted');
    await keep(info, out);
    expect(await pages(out.bytes)).toBe(2);
    // Page 1 is now an image: no text layer at all. Page 2 is untouched.
    expect((await pdfText(out.bytes, 1)).trim()).toBe('');
    expect((await pdfText(out.bytes, 2)).trim()).toBe('Page two has nothing private on it.');
    // Nothing of the hidden data anywhere in the file, metadata included.
    const raw = out.bytes.toString('latin1');
    for (const secret of ['880101', 'Ali bin', '4,321', 'Slip gaji']) expect(raw).not.toContain(secret);
    expect((await PDFDocument.load(out.bytes)).getTitle()).toBeUndefined();
  });

  test('redact explains itself: nothing matched, and a scan with no text', async ({ page }) => {
    await page.goto('/pdf/redact');
    await page.getByLabel('Words to black out').fill('Siti binti Ahmad');
    await page.getByLabel('MyKad IC numbers').uncheck();
    await chooseFiles(page, [real('payslip.pdf')]);
    await expect(page.getByText(/^Nothing matched, so nothing was blacked out/)).toBeVisible({ timeout: 60_000 });
    await page.goto('/pdf/redact');
    await chooseFiles(page, [real('scanned-40.pdf')]);
    await expect(page.getByText(/^This PDF has no text to search/)).toBeVisible({ timeout: 60_000 });
  });

  test('rotate pages 1-3 of a paper by 180°', async ({ page }, info) => {
    await openFromHome(page, 'Rotate PDF');
    await page.getByLabel('Rotate by').selectOption('180');
    await page.getByLabel('Pages').fill('1-3');
    await chooseFiles(page, [real('paper.pdf')]);
    const out = await save(page);
    await keep(info, out);
    const doc = await PDFDocument.load(out.bytes);
    expect(doc.getPage(0).getRotation()).toEqual(degrees(180));
    expect(doc.getPage(2).getRotation()).toEqual(degrees(180));
    expect(doc.getPage(3).getRotation()).toEqual(degrees(0));
  });

  test('crop margins off every page', async ({ page }, info) => {
    await openFromHome(page, 'Crop PDF');
    await chooseFiles(page, [real('paper.pdf')]);
    const out = await save(page);
    await keep(info, out);
    const p = (await PDFDocument.load(out.bytes)).getPage(0);
    const media = p.getMediaBox(), crop = p.getCropBox();
    expect(crop.width).toBeLessThan(media.width);
    expect(crop.height).toBeLessThan(media.height);
  });

  test('remove pages 2-15 leaves only the title page', async ({ page }, info) => {
    await openFromHome(page, 'Remove pages');
    await page.getByLabel('Pages to remove').fill('2-15');
    await chooseFiles(page, [real('paper.pdf')]);
    const out = await save(page);
    await keep(info, out);
    expect(await pages(out.bytes)).toBe(1);
    expect(await pdfText(out.bytes)).toContain('Attention Is All You Need');
  });

  test('extract pages "3, 1" keeps the order the person typed', async ({ page }, info) => {
    await openFromHome(page, 'Extract pages');
    await page.getByLabel('Pages to extract').fill('3, 1');
    await chooseFiles(page, [real('paper.pdf')]);
    const out = await save(page);
    await keep(info, out);
    expect(await pages(out.bytes)).toBe(2);
    const original = await import('node:fs/promises').then((f) => f.readFile(real('paper.pdf')));
    expect(await pdfText(out.bytes, 1)).toBe(await pdfText(original, 3));
    expect(await pdfText(out.bytes, 2)).toBe(await pdfText(original, 1));
  });

  test('PDF to JPG, then JPG to PDF, then OCR: the round trip a student does', async ({ page, shot }, info) => {
    test.skip(desktopChromiumOnly(info.project.name), 'OCR engine: Chromium and devices');
    test.setTimeout(480_000);
    // 1. Pages to pictures, at screen resolution.
    await openFromHome(page, 'PDF to JPG');
    await page.getByLabel('Resolution').selectOption('2');
    await chooseFiles(page, [real('paper.pdf')]);
    const images = await save(page);
    await keep(info, images);
    let jpg: Buffer;
    if (images.name.endsWith('.zip')) {
      const z = await zip(images.bytes);
      const names = Object.keys(z.files).filter((n) => n.endsWith('.jpg')).sort();
      expect(names.length).toBe(PAPER_PAGES);
      jpg = await z.file(names[0]!)!.async('nodebuffer');
    } else jpg = images.bytes;
    expect([...magic(jpg).subarray(0, 3)]).toEqual([0xff, 0xd8, 0xff]);

    // 2. The picture back into a PDF: now it is a scan with no text in it.
    const { writeFile } = await import('node:fs/promises');
    const pagePath = `${info.outputDir}/page-1.jpg`;
    await import('node:fs/promises').then((f) => f.mkdir(info.outputDir, { recursive: true }));
    await writeFile(pagePath, jpg);
    await openFromHome(page, 'JPG to PDF');
    await chooseFiles(page, [pagePath]);
    await page.getByRole('button', { name: 'Make the PDF' }).click();
    const scanned = await save(page);
    expect(await pages(scanned.bytes)).toBe(1);
    expect((await pdfText(scanned.bytes)).trim()).toBe('');

    // 3. OCR makes the words findable again.
    const scanPath = `${info.outputDir}/scan.pdf`;
    await writeFile(scanPath, scanned.bytes);
    await openFromHome(page, 'OCR PDF');
    await page.getByLabel('Language').selectOption('eng');
    await chooseFiles(page, [scanPath]);
    const ocr = await save(page, /^Save/, 200_000);
    await shot('ocr-done');
    await keep(info, ocr);
    expect(await pdfText(ocr.bytes)).toMatch(/Attention/i);
  });

  test('PDF to Word keeps the words of the paper', async ({ page }, info) => {
    await openFromHome(page, 'PDF to Word');
    await chooseFiles(page, [real('paper.pdf')]);
    const out = await save(page);
    await keep(info, out);
    expect(out.name).toMatch(/\.docx$/);
    const xml = await (await zip(out.bytes)).file('word/document.xml')!.async('string');
    expect(xml).toContain('Attention');
  });

  test('PDF to PowerPoint makes one slide per page', async ({ page }, info) => {
    await openFromHome(page, 'PDF to PowerPoint');
    await chooseFiles(page, [real('paper.pdf')]);
    const out = await save(page, /^Save/, 180_000);
    await keep(info, out);
    const slides = Object.keys((await zip(out.bytes)).files).filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n));
    expect(slides.length).toBe(PAPER_PAGES);
  });

  test('PDF to text reads the title', async ({ page }, info) => {
    await openFromHome(page, 'PDF to text');
    await chooseFiles(page, [real('paper.pdf')]);
    const out = await save(page);
    await keep(info, out);
    expect(out.bytes.toString('utf8')).toContain('Attention Is All You Need');
  });

  test('watermark every page with CONFIDENTIAL', async ({ page }, info) => {
    await openFromHome(page, 'Watermark PDF');
    await page.getByLabel('Text').fill('CONFIDENTIAL');
    await chooseFiles(page, [real('paper.pdf')]);
    const out = await save(page);
    await keep(info, out);
    expect(await pdfText(out.bytes, 4)).toContain('CONFIDENTIAL');
  });

  test('page numbers "1 / 15" at the bottom', async ({ page }, info) => {
    await openFromHome(page, 'Add page numbers');
    await page.getByLabel('Style').selectOption('n-of-total');
    await chooseFiles(page, [real('paper.pdf')]);
    const out = await save(page);
    await keep(info, out);
    expect(await pdfText(out.bytes, 2)).toMatch(/2\s*\/\s*15/);
  });

  test('print handouts, 4 per sheet: 15 pages on 4 sheets', async ({ page }, info) => {
    await openFromHome(page, 'Print handouts');
    await chooseFiles(page, [real('paper.pdf')]);
    const out = await save(page);
    await keep(info, out);
    expect(await pages(out.bytes)).toBe(4);
  });

  test('grayscale a paper with colour figures', async ({ page }, info) => {
    await openFromHome(page, 'Grayscale PDF');
    await chooseFiles(page, [real('paper.pdf')]);
    const out = await save(page, /^Save/, 200_000);
    await keep(info, out);
    expect(await pages(out.bytes)).toBe(PAPER_PAGES);
  });

  test('protect with a password, then unlock it again', async ({ page, shot }, info) => {
    await openFromHome(page, 'Protect PDF');
    await page.getByLabel('Password').fill('Nhako#2026');
    await chooseFiles(page, [real('paper.pdf')]);
    const locked = await save(page);
    await keep(info, locked);
    await expect(PDFDocument.load(locked.bytes)).rejects.toThrow(/encrypt/i);

    const { writeFile, mkdir } = await import('node:fs/promises');
    await mkdir(info.outputDir, { recursive: true });
    const lockedPath = `${info.outputDir}/locked.pdf`;
    await writeFile(lockedPath, locked.bytes);

    await openFromHome(page, 'Unlock PDF');
    await page.getByLabel('Password').fill('wrong-password');
    await chooseFiles(page, [lockedPath]);
    await expect(page.getByText('That password is not correct for this file.')).toBeVisible({ timeout: 60_000 });
    await shot('wrong-password');
    // On a phone the keyboard covers "Run again": the Go key has to run it.
    await page.getByLabel('Password').fill('Nhako#2026');
    await page.getByLabel('Password').press('Enter');
    const open = await save(page);
    expect(await pages(open.bytes)).toBe(PAPER_PAGES);
  });

  test('repair a PDF whose cross-reference offset is wrong', async ({ page }, info) => {
    await openFromHome(page, 'Repair PDF');
    await chooseFiles(page, [real('bad-xref.pdf')]);
    const out = await save(page, /^Save/, 120_000);
    await keep(info, out);
    expect(await pages(out.bytes)).toBe(PAPER_PAGES);
    await expect(page.getByText(/Repaired, 15 pages recovered/)).toBeVisible();
  });

  test('a download cut off at 70% is refused in plain words, not with a crash', async ({ page, shot }) => {
    await openFromHome(page, 'Repair PDF');
    await chooseFiles(page, [real('damaged.pdf')]);
    await expect(page.getByText(/too badly damaged to recover. If it was downloaded, download it again/)).toBeVisible({ timeout: 120_000 });
    await shot('honest-refusal');
  });

  test('merge a paper and a phone scan, in the order chosen', async ({ page, shot }, info) => {
    await openFromHome(page, 'Merge PDF');
    await chooseFiles(page, [real('paper.pdf'), real('scanned-40.pdf')]);
    await shot('staged');
    await page.getByRole('button', { name: 'Combine into one PDF' }).click();
    const out = await save(page);
    await keep(info, out);
    expect(await pages(out.bytes)).toBe(PAPER_PAGES + 40);
  });

  test('split: odd pages into one PDF', async ({ page }, info) => {
    await openFromHome(page, 'Split PDF');
    await chooseFiles(page, [real('paper.pdf')]);
    await page.getByRole('button', { name: 'Odd pages' }).click();
    await page.getByText('All selected pages in one PDF').click();
    await page.getByRole('button', { name: 'Split', exact: true }).click();
    const out = await save(page);
    await keep(info, out);
    expect(await pages(out.bytes)).toBe(8);
  });

  test('JPG to PDF: two camera photos, two A4 pages', async ({ page }, info) => {
    await openFromHome(page, 'JPG to PDF');
    await chooseFiles(page, [real('big.jpg'), real('gps.jpg')]);
    await page.getByRole('button', { name: 'Make the PDF' }).click();
    const out = await save(page);
    await keep(info, out);
    const doc = await PDFDocument.load(out.bytes);
    expect(doc.getPageCount()).toBe(2);
    // A4, in whichever orientation suits each photo.
    const { width, height } = doc.getPage(0).getSize();
    expect([Math.round(Math.min(width, height)), Math.round(Math.max(width, height))]).toEqual([595, 842]);
  });

  for (const [label, file] of [['Word', 'sample.docx'], ['Excel', 'sample.xlsx'], ['PowerPoint', 'sample.pptx'], ['OpenDocument', 'sample.odt'], ['CSV', 'sample.csv']] as const) {
    test(`Office to PDF: a real ${label} file`, async ({ page }, info) => {
      test.skip(desktopChromiumOnly(info.project.name), 'LibreOffice engine: Chromium and devices');
      test.setTimeout(420_000);
      await openFromHome(page, 'Office to PDF');
      await chooseFiles(page, [real(file)]);
      const out = await save(page, /^Save/, 400_000);
      await keep(info, out);
      expect(out.name).toMatch(/\.pdf$/);
      expect(await pages(out.bytes)).toBeGreaterThan(0);
    });
  }
});

test.describe('Image tools, by hand, on camera photos', () => {
  test('compress an 18 MP camera photo: same size, fewer bytes', async ({ page, shot }, info) => {
    await openFromHome(page, 'Compress image');
    await chooseFiles(page, [real('big.jpg')]);
    const out = await save(page);
    await shot('done');
    await keep(info, out);
    expect(out.bytes.length).toBeLessThan(5_554_547);
    const img = await imageInfo(page, out.bytes, out.name.endsWith('.webp') ? 'image/webp' : 'image/jpeg');
    expect([img.width, img.height]).toEqual([5184, 3456]);
  });

  for (const [slug, limit] of [['20kb', 20_000], ['50kb', 50_000], ['100kb', 100_000], ['200kb', 200_000], ['300kb', 300_000], ['500kb', 500_000], ['1mb', 1_000_000]] as const) {
    test(`landing on "compress image ${slug}" gets a photo under ${slug}`, async ({ page }, info) => {
      await page.goto(`/image/compress/${slug}`);
      await chooseFiles(page, [real('big.jpg')]);
      const out = await save(page);
      await keep(info, out);
      expect(out.bytes.length).toBeLessThanOrEqual(limit);
    });
  }

  test('the SPA / MyResume photo preset gives a JPG under its limit', async ({ page }, info) => {
    await page.goto('/image/compress/spa-myresume');
    await chooseFiles(page, [real('big.jpg')]);
    const out = await save(page);
    await keep(info, out);
    expect([...magic(out.bytes).subarray(0, 3)]).toEqual([0xff, 0xd8, 0xff]);
  });

  for (const [format, mime, head] of [['webp', 'image/webp', 'RIFF'], ['png', 'image/png', '\x89PNG'], ['avif', 'image/avif', 'ftyp'], ['jpeg', 'image/jpeg', '\xff\xd8\xff']] as const) {
    test(`convert a camera photo to ${format.toUpperCase()}`, async ({ page }, info) => {
      await openFromHome(page, 'Convert image');
      await page.getByLabel('Convert to').selectOption(format);
      await chooseFiles(page, [real('gps.jpg')]);
      if (format === 'avif') {
        // FINDING (2026-11-22): AVIF is offered everywhere, but Chrome's canvas
        // cannot encode it, so Chrome users only learn that after choosing a
        // file. Until there is a wasm encoder, at least the message must be
        // the friendly one, not a crash.
        const result = await Promise.race([
          page.getByRole('link', { name: /^Save/ }).waitFor({ timeout: 60_000 }).then(() => 'saved'),
          page.getByText('This browser cannot encode AVIF').waitFor({ timeout: 60_000 }).then(() => 'unsupported'),
        ]);
        test.info().annotations.push({ type: 'avif', description: result });
        if (result === 'unsupported') return;
      }
      const out = await save(page);
      await keep(info, out);
      expect(out.bytes.subarray(0, 12).toString('latin1')).toContain(head);
      const img = await imageInfo(page, out.bytes, mime).catch(() => null);
      // AVIF encoding exists in Chromium; decoding is checked where supported.
      if (img) expect([img.width, img.height]).toEqual([640, 480]);
    });
  }

  // Format-pair presets: a person lands from Google on "webp to jpg" etc.
  // WebP and transparent PNG inputs are made in the page from the real
  // camera photo, since nothing on the test machine can encode them.
  async function madeInPage(page: Page, kind: 'webp' | 'alpha-png', info: { outputDir: string }) {
    const src = (await import('node:fs/promises')).readFile(real('gps.jpg'));
    const b64 = await page.evaluate(async ({ b64, kind }) => {
      const bmp = await createImageBitmap(new Blob([Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))], { type: 'image/jpeg' }));
      const c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height;
      const x = c.getContext('2d')!;
      if (kind === 'alpha-png') x.drawImage(bmp, 0, 0, bmp.width / 2, bmp.height, 0, 0, bmp.width / 2, bmp.height); // right half stays transparent
      else x.drawImage(bmp, 0, 0);
      const blob = await new Promise<Blob>((r) => c.toBlob((b) => r(b!), kind === 'webp' ? 'image/webp' : 'image/png', 0.9));
      const buf = new Uint8Array(await blob.arrayBuffer()); let s = '';
      for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
      return btoa(s);
    }, { b64: (await src).toString('base64'), kind });
    const { mkdir, writeFile } = await import('node:fs/promises');
    await mkdir(info.outputDir, { recursive: true });
    const path = `${info.outputDir}/${kind === 'webp' ? 'photo.webp' : 'logo.png'}`;
    await writeFile(path, Buffer.from(b64, 'base64'));
    return path;
  }

  const PAIRS = [
    { slug: 'webp-to-jpg', input: 'webp', head: 'jpg', mime: 'image/jpeg', size: [640, 480] },
    { slug: 'png-to-jpg', input: 'alpha-png', head: 'jpg', mime: 'image/jpeg', size: [640, 480], white: true },
    { slug: 'jpg-to-png', input: 'gps.jpg', head: 'png', mime: 'image/png', size: [640, 480] },
    { slug: 'jpg-to-webp', input: 'big.jpg', head: 'webp', mime: 'image/webp', size: [5184, 3456], smaller: 5_554_547 },
    { slug: 'png-to-webp', input: 'alpha-png', head: 'webp', mime: 'image/webp', size: [640, 480], transparent: true },
    { slug: 'avif-to-jpg', input: 'fox.avif', head: 'jpg', mime: 'image/jpeg' },
  ] as const;
  for (const pair of PAIRS) {
    test(`landing on "${pair.slug.replace(/-/g, ' ')}" converts a real image`, async ({ page }, info) => {
      await page.goto(`/image/convert/${pair.slug}`);
      const input = pair.input === 'webp' || pair.input === 'alpha-png' ? await madeInPage(page, pair.input, info) : real(pair.input);
      await chooseFiles(page, [input]);
      const out = await save(page, /^Save/, 120_000);
      await keep(info, out);
      const sig = { jpg: [0xff, 0xd8, 0xff], png: [0x89, 0x50, 0x4e, 0x47] }[pair.head as 'jpg' | 'png'];
      if (sig) expect([...out.bytes.subarray(0, sig.length)]).toEqual(sig);
      else expect(out.bytes.subarray(8, 12).toString('latin1')).toBe('WEBP');
      const img = await imageInfo(page, out.bytes, pair.mime, [600, 240]);
      if ('size' in pair) expect([img.width, img.height]).toEqual(pair.size);
      if ('smaller' in pair) expect(out.bytes.length).toBeLessThan(pair.smaller);
      if ('white' in pair) expect(img.pixel.slice(0, 3).every((v) => v > 245)).toBe(true);
      if ('transparent' in pair) expect(img.pixel[3]).toBe(0);
    });
  }

  test('resize a camera photo to 1280 wide, keeping its shape', async ({ page }, info) => {
    await openFromHome(page, 'Resize image');
    await chooseFiles(page, [real('big.jpg')]);
    const out = await save(page);
    await keep(info, out);
    const img = await imageInfo(page, out.bytes, out.name.endsWith('.png') ? 'image/png' : 'image/jpeg');
    expect(img.width).toBe(1280);
    expect(img.height).toBe(853);
  });

  test('rotate a photo clockwise: width and height swap', async ({ page }, info) => {
    await openFromHome(page, 'Rotate image');
    await chooseFiles(page, [real('gps.jpg')]);
    const out = await save(page);
    await keep(info, out);
    const img = await imageInfo(page, out.bytes, 'image/jpeg');
    expect([img.width, img.height]).toEqual([480, 640]);
  });

  test('watermark a photo: the pixels change where the mark is', async ({ page }, info) => {
    await openFromHome(page, 'Watermark image');
    await chooseFiles(page, [real('gps.jpg')]);
    await page.getByLabel('Text').fill('NHAKO');
    await page.getByLabel('Position').selectOption('center');
    await page.getByLabel('Colour').selectOption('red');
    const out = await save(page);
    await keep(info, out);
    const before = await imageInfo(page, await import('node:fs/promises').then((f) => f.readFile(real('gps.jpg'))), 'image/jpeg', [320, 240]);
    const after = await imageInfo(page, out.bytes, out.name.endsWith('.png') ? 'image/png' : 'image/jpeg', [320, 240]);
    expect(after.pixel).not.toEqual(before.pixel);
  });

  test('HEIC from a phone becomes a JPG', async ({ page }, info) => {
    await openFromHome(page, 'HEIC to JPG');
    await chooseFiles(page, [real('iphone.heic')]);
    const out = await save(page, /^Save/, 120_000);
    await keep(info, out);
    expect([...magic(out.bytes).subarray(0, 3)]).toEqual([0xff, 0xd8, 0xff]);
  });

  test('remove photo metadata: the GPS location is gone', async ({ page }, info) => {
    await openFromHome(page, 'Remove photo metadata');
    await chooseFiles(page, [real('gps.jpg')]);
    const out = await save(page);
    await keep(info, out);
    const original = await import('node:fs/promises').then((f) => f.readFile(real('gps.jpg')));
    expect(original.includes(Buffer.from('Exif\0\0'))).toBe(true);
    expect(out.bytes.includes(Buffer.from('Exif\0\0'))).toBe(false);
  });

  test('passport photo from a camera picture', async ({ page, shot }, info) => {
    await openFromHome(page, 'Passport photo maker');
    await chooseFiles(page, [real('big.jpg')]);
    await shot('framed');
    const out = await save(page);
    await keep(info, out);
    const img = await imageInfo(page, out.bytes, 'image/jpeg');
    // 35 x 50 mm: portrait, about 1 : 1.43.
    expect(img.height / img.width).toBeCloseTo(50 / 35, 1);
  });

  test('crop a photo and save it', async ({ page }, info) => {
    await openFromHome(page, 'Crop image');
    await chooseFiles(page, [real('gps.jpg')]);
    const out = await save(page);
    await keep(info, out);
    const img = await imageInfo(page, out.bytes, out.name.endsWith('.png') ? 'image/png' : 'image/jpeg');
    expect(img.width).toBeGreaterThan(0);
    expect(img.width * img.height).toBeLessThanOrEqual(640 * 480);
  });

  test('remove the background of a photo: transparent PNG', async ({ page }, info) => {
    test.skip(desktopChromiumOnly(info.project.name), 'ONNX model: Chromium and devices');
    await openFromHome(page, 'Remove background');
    await chooseFiles(page, [real('gps.jpg')]);
    const out = await save(page, /^Save/, 200_000);
    await keep(info, out);
    expect(out.bytes.subarray(1, 4).toString()).toBe('PNG');
  });
});

test.describe('Media tools, by hand, on a real clip and real speech', () => {
  test('compress a 1080p clip to about 2 MB', async ({ page, shot }, info) => {
    test.skip(desktopChromiumOnly(info.project.name), 'video engines: Chromium and devices');
    await openFromHome(page, 'Compress video');
    await page.getByLabel('Target size').fill('2');
    await chooseFiles(page, [real('bbb1080.mp4')]);
    await shot('working');
    const out = await save(page, /^Save/, 220_000);
    await keep(info, out);
    expect(out.bytes.subarray(4, 8).toString()).toBe('ftyp');
    expect(out.bytes.length).toBeLessThan(2.4 * 1024 * 1024);
  });

  test('extract the soundtrack of a clip as MP3', async ({ page }, info) => {
    test.skip(desktopChromiumOnly(info.project.name), 'ffmpeg: Chromium and devices');
    await openFromHome(page, 'Extract audio');
    await chooseFiles(page, [real('clip-with-sound.mp4')]);
    const out = await save(page, /^Save/, 200_000);
    await keep(info, out);
    expect(out.name).toMatch(/\.mp3$/);
    expect(out.bytes.length).toBeGreaterThan(50_000);
  });

  test('a clip with no soundtrack is explained, not failed silently', async ({ page }, info) => {
    test.skip(desktopChromiumOnly(info.project.name), 'ffmpeg: Chromium and devices');
    await openFromHome(page, 'Extract audio');
    await chooseFiles(page, [real('bbb1080.mp4')]);
    await expect(page.getByText(/may have no audio track/)).toBeVisible({ timeout: 200_000 });
  });

  test('transcribe a real recording: "ask not what your country can do for you"', async ({ page, shot }, info) => {
    test.skip(desktopChromiumOnly(info.project.name), 'Whisper: Chromium and devices');
    await openFromHome(page, 'Audio to text');
    await chooseFiles(page, [real('jfk.flac')]);
    const out = await save(page, /^Save/, 220_000);
    await shot('done');
    await keep(info, out);
    expect(out.bytes.toString('utf8').toLowerCase()).toMatch(/ask not what your country can do for you/);
  });

  test('transcribe a Malay speaker in Malay mode', async ({ page }, info) => {
    test.skip(desktopChromiumOnly(info.project.name), 'Whisper: Chromium and devices');
    await openFromHome(page, 'Audio to text');
    await page.getByLabel('Language').selectOption('ms');
    await chooseFiles(page, [real('ms-word.wav')]);
    const out = await save(page, /^Save/, 220_000);
    await keep(info, out);
    expect(out.bytes.toString('utf8').trim().length).toBeGreaterThan(0);
  });
});

test.describe('Calculators, by hand', () => {
  // UKM (Undergraduate Studies) Regulations 2024, Table 3 and its worked
  // example: 13 credits, GPA 2.69. Typed the way a student would.
  for (const [path, reset] of [
    ['/calc/cgpa/ukm', 'Reset to Universiti Kebangsaan Malaysia'],
    ['/ms/calc/cgpa/ukm', 'Set semula kepada Universiti Kebangsaan Malaysia'],
  ] as const) {
    test(`UKM CGPA preset at ${path} reproduces the regulations' worked example`, async ({ page, shot }) => {
      await page.goto(path);
      await page.waitForFunction(() => !document.querySelector('astro-island[ssr]'), undefined, { timeout: 30_000 });
      const grades = await page.locator('#course-0-grade option').evaluateAll((os) => os.map((o) => (o as HTMLOptionElement).value).filter(Boolean));
      expect(grades).toEqual(['A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D+', 'D', 'E']);
      await page.getByRole('button', { name: /Add a course|Tambah kursus/ }).click();
      await expect(page.locator('[data-course-row]')).toHaveCount(5);
      const rows = [['3', 'A'], ['3', 'B+'], ['3', 'A-'], ['2', 'E'], ['2', 'D']];
      for (const [i, [credits, grade]] of rows.entries()) {
        await page.locator(`#course-${i}-credits`).fill(credits!);
        await page.locator(`#course-${i}-grade`).selectOption(grade!);
      }
      await expect(page.getByTestId('gpa')).toHaveText('2.69');
      await expect(page.getByTestId('cgpa')).toHaveText('2.69');
      // Close the keyboard and let the scroll-driven reveal settle before the
      // tap, as a person does: mid-scroll, the panel above slides over it.
      await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
      const scale = page.locator('summary').filter({ hasText: /Grade points|Mata gred/ });
      await scale.evaluate((el) => el.scrollIntoView({ block: 'center' }));
      await page.waitForTimeout(600);
      await scale.click();
      await expect(page.getByRole('button', { name: reset })).toBeVisible();
      await shot('ukm-worked-example');
    });
  }

  test('the default CGPA page still uses Universiti Malaya, with A+ and F', async ({ page }) => {
    await page.goto('/calc/cgpa');
    await page.waitForFunction(() => !document.querySelector('astro-island[ssr]'), undefined, { timeout: 30_000 });
    const grades = await page.locator('#course-0-grade option').evaluateAll((os) => os.map((o) => (o as HTMLOptionElement).value));
    expect(grades).toContain('A+');
    expect(grades).toContain('F');
    expect(grades).not.toContain('E');
  });
});
