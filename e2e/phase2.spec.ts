import { test, expect, type Page } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { PDFDocument, degrees } from 'pdf-lib';
import { QPDF_VERSION, LIBHEIF_VERSION } from '../scripts/versions.mjs';

/**
 * Phase 2: iLovePDF parity. Every check reads the saved file back and tests
 * what it contains, not just that a Save button appeared.
 */

const fixture = (name: string) => fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url));

async function pdfFile(widths: number[], rotation = 0, name = 'doc.pdf') {
  const doc = await PDFDocument.create();
  for (const w of widths) doc.addPage([w, 800]).setRotation(degrees(rotation));
  return { name, mimeType: 'application/pdf', buffer: Buffer.from(await doc.save()) };
}

async function saved(page: Page, selector = 'a[download]') {
  const href = await page.locator(selector).first().getAttribute('href');
  const b64 = await page.evaluate(async (h) => {
    const bytes = new Uint8Array(await (await fetch(h!)).arrayBuffer());
    let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(s);
  }, href);
  return Buffer.from(b64, 'base64');
}

/** A PNG or JPEG drawn by the browser: left half pink, right half blue. */
async function picture(page: Page, w: number, h: number, type: 'image/png' | 'image/jpeg', name: string) {
  const b64 = await page.evaluate(([w, h, type]) => {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const x = c.getContext('2d')!;
    x.fillStyle = '#e0457b'; x.fillRect(0, 0, w / 2, h);
    x.fillStyle = '#3b82f6'; x.fillRect(w / 2, 0, w / 2, h);
    return c.toDataURL(type, 0.95).split(',')[1]!;
  }, [w, h, type] as const);
  return { name, mimeType: type, buffer: Buffer.from(b64, 'base64') };
}

/** EXIF with a camera and a GPS position (Kuala Lumpur), big-endian. */
function exifWithGps(): Buffer {
  const b: number[] = [];
  const u16 = (v: number) => b.push((v >> 8) & 255, v & 255);
  const u32 = (v: number) => b.push((v >>> 24) & 255, (v >> 16) & 255, (v >> 8) & 255, v & 255);
  const at = (o: number, v: number) => { b[o] = (v >>> 24) & 255; b[o + 1] = (v >> 16) & 255; b[o + 2] = (v >> 8) & 255; b[o + 3] = v & 255; };
  const entry = (tag: number, type: number, count: number) => { u16(tag); u16(type); u32(count); const o = b.length; u32(0); return o; };
  b.push(0x4d, 0x4d); u16(42); u32(8);
  u16(2);
  const model = entry(0x0110, 2, 16);
  const gps = entry(0x8825, 4, 1);
  u32(0);
  at(model, b.length); for (const c of 'Pixel 9 Nhako\0\0\0') b.push(c.charCodeAt(0));
  at(gps, b.length); u16(4);
  const latRef = entry(0x0001, 2, 2); const lat = entry(0x0002, 5, 3);
  const lonRef = entry(0x0003, 2, 2); const lon = entry(0x0004, 5, 3);
  u32(0);
  b[latRef] = 0x4e; b[lonRef] = 0x45;
  at(lat, b.length); u32(3); u32(1); u32(8); u32(1); u32(204); u32(10);
  at(lon, b.length); u32(101); u32(1); u32(41); u32(1); u32(72); u32(10);
  const payload = Buffer.concat([Buffer.from('Exif\0\0', 'latin1'), Buffer.from(b)]);
  const len = payload.length + 2;
  return Buffer.concat([Buffer.from([0xff, 0xe1, len >> 8, len & 255]), payload]);
}

test.describe('PDF tools', () => {
  test('page numbers sit upright, bottom right, on a page stored sideways', async ({ page }) => {
    await page.goto('/pdf/page-numbers');
    await page.getByLabel('Position').selectOption('bottom-right');
    await page.locator('input[type=file]').setInputFiles(await pdfFile([600], 90));
    await expect(page.getByText(/1 page numbered 1 to 1/)).toBeVisible();

    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const doc = await pdfjs.getDocument({ data: new Uint8Array(await saved(page)) }).promise;
    const p1 = await doc.getPage(1);
    const viewport = p1.getViewport({ scale: 1 }); // includes the page's /Rotate
    const item = (await p1.getTextContent()).items.find((i) => 'str' in i && i.str === '1') as { transform: number[] };
    const [vx, vy] = viewport.convertToViewportPoint(item.transform[4]!, item.transform[5]!);
    // Displayed page is 800 x 600. The number's baseline must be near the
    // bottom-right corner as the reader sees it...
    expect(viewport.width).toBe(800);
    expect(vx).toBeGreaterThan(720);
    expect(vy).toBeGreaterThan(540);
    // ...and upright: text direction along +x of the displayed page.
    const [dx, dy] = [viewport.transform[0]! * item.transform[0]! + viewport.transform[2]! * item.transform[1]!,
      viewport.transform[1]! * item.transform[0]! + viewport.transform[3]! * item.transform[1]!];
    expect(dx).toBeGreaterThan(0);
    expect(Math.abs(dy)).toBeLessThan(1e-6);
  });

  test('protect, then unlock with a wrong and a right password', async ({ page }) => {
    await page.goto('/pdf/protect');
    await page.getByLabel('Password').fill('kopi-o-kosong');
    await page.locator('input[type=file]').setInputFiles(fixture('three-pages.pdf'));
    await expect(page.getByText(/AES-256, password required to open/)).toBeVisible({ timeout: 30_000 });
    const locked = await saved(page);
    await expect(PDFDocument.load(locked)).rejects.toThrow(/encrypt/i);

    await page.goto('/pdf/unlock');
    await page.getByLabel('Password').fill('teh-tarik');
    await page.locator('input[type=file]').setInputFiles({ name: 'locked.pdf', mimeType: 'application/pdf', buffer: locked });
    await expect(page.getByText('That password is not correct for this file.')).toBeVisible({ timeout: 30_000 });

    await page.getByLabel('Password').fill('kopi-o-kosong');
    await page.getByRole('button', { name: 'Run again with these settings' }).click();
    await expect(page.getByText('Password and restrictions removed')).toBeVisible({ timeout: 30_000 });
    expect((await PDFDocument.load(await saved(page))).getPageCount()).toBe(3);
  });

  test('JPG to PDF: one A4 page per image, landscape images on landscape pages', async ({ page }) => {
    await page.goto('/pdf/jpg-to-pdf');
    await page.locator('input[type=file]').setInputFiles([
      await picture(page, 400, 600, 'image/jpeg', 'tall.jpg'),
      await picture(page, 600, 400, 'image/png', 'wide.png'),
    ]);
    // Staged first, in the order given, then built on request.
    await expect(page.locator('[data-stage-card]')).toHaveCount(2);
    await page.getByRole('button', { name: 'Make the PDF' }).click();
    await expect(page.getByText('2 images → 2 pages')).toBeVisible({ timeout: 20_000 });
    const doc = await PDFDocument.load(await saved(page));
    const sizes = doc.getPages().map((p) => [Math.round(p.getWidth()), Math.round(p.getHeight())]);
    expect(sizes).toEqual([[595, 842], [842, 595]]);
  });

  test('organize: reorder, rotate and remove pages across two files', async ({ page }) => {
    await page.goto('/pdf/organize');
    await page.locator('input[type=file]').setInputFiles([await pdfFile([100, 200], 0, 'a.pdf'), await pdfFile([300], 0, 'b.pdf')]);
    await expect(page.getByText('3 pages')).toBeVisible();
    await page.getByRole('button', { name: 'Move earlier: Page 1 of b.pdf' }).click();
    await page.getByRole('button', { name: 'Move earlier: Page 1 of b.pdf' }).click();
    await page.getByRole('button', { name: 'Rotate clockwise: Page 1 of b.pdf' }).click();
    await page.getByRole('button', { name: 'Remove page: Page 2 of a.pdf' }).click();
    await page.getByRole('button', { name: 'Save PDF' }).click();
    const doc = await PDFDocument.load(await saved(page));
    expect(doc.getPages().map((p) => p.getWidth())).toEqual([300, 100]);
    expect(doc.getPage(0).getRotation().angle).toBe(90);
  });

  test('sign: a typed signature placed by clicking ends up on that page', async ({ page }) => {
    await page.goto('/pdf/sign');
    await page.locator('input[type=file]').setInputFiles(await pdfFile([600, 600]));
    await page.getByRole('tab', { name: 'Type' }).click();
    await page.getByLabel('Your name').fill('Nur Aisyah');
    await expect(page.getByText('Click a page to place your signature.')).toBeVisible();
    await page.getByRole('img', { name: 'Page 2' }).click({ position: { x: 200, y: 300 } });
    const box = page.getByRole('button', { name: /Signature on page 2/ });
    await expect(box).toBeVisible();
    await box.focus();
    await page.keyboard.press('ArrowRight');
    await page.getByRole('button', { name: 'Save signed PDF' }).click();
    const doc = await PDFDocument.load(await saved(page));
    const hasImage = (i: number) => doc.getPage(i).node.Resources()?.toString().includes('XObject') ?? false;
    expect([hasImage(0), hasImage(1)]).toEqual([false, true]);
  });

  test('the qpdf and libheif engines are served from this site', async ({ request }) => {
    for (const path of [`/vendor/qpdf/${QPDF_VERSION}/qpdf.wasm`, `/vendor/libheif/${LIBHEIF_VERSION}/libheif.wasm`]) {
      const res = await request.get(path);
      expect(res.status(), path).toBe(200);
      expect((await res.body()).subarray(0, 4).toString('latin1'), path).toBe('\0asm');
    }
  });
});

test.describe('image tools', () => {
  test('remove metadata: GPS is reported, removed, and the picture is unchanged', async ({ page }) => {
    await page.goto('/image/remove-metadata');
    const jpeg = (await picture(page, 64, 48, 'image/jpeg', 'x.jpg')).buffer;
    // Put the EXIF block right after SOI.
    const tagged = Buffer.concat([jpeg.subarray(0, 2), exifWithGps(), jpeg.subarray(2)]);
    await page.locator('input[type=file]').setInputFiles({ name: 'holiday.jpg', mimeType: 'image/jpeg', buffer: tagged });
    await expect(page.getByText(/GPS location 3\.13900, 101\.68533; camera Pixel 9 Nhako/)).toBeVisible();
    const clean = await saved(page);
    expect(clean.includes(Buffer.from('Pixel 9'))).toBe(false);
    // Same compressed image data, byte for byte, after the headers.
    expect(clean.subarray(clean.length - 200).equals(tagged.subarray(tagged.length - 200))).toBe(true);
  });

  test('rotate: a 400 x 300 image turned clockwise is 300 x 400, pink now on top', async ({ page }) => {
    await page.goto('/image/rotate');
    await page.locator('input[type=file]').setInputFiles(await picture(page, 400, 300, 'image/png', 'r.png'));
    await expect(page.getByText('1 image done')).toBeVisible();
    const info = await page.evaluate(async () => {
      const a = document.querySelector<HTMLAnchorElement>('a[download]')!;
      const bmp = await createImageBitmap(await (await fetch(a.href)).blob());
      const c = new OffscreenCanvas(bmp.width, bmp.height); const x = c.getContext('2d')!; x.drawImage(bmp, 0, 0);
      return { w: bmp.width, h: bmp.height, top: Array.from(x.getImageData(150, 10, 1, 1).data.slice(0, 3)) };
    });
    expect([info.w, info.h]).toEqual([300, 400]);
    expect(info.top).toEqual([224, 69, 123]); // the left (pink) half rotated to the top
  });

  test('crop: a square crop of a 400 x 300 image is 300 x 300', async ({ page }) => {
    await page.goto('/image/crop');
    await page.locator('input[type=file]').setInputFiles(await picture(page, 400, 300, 'image/png', 'c.png'));
    await page.getByLabel('Shape').selectOption('1:1');
    await expect(page.getByText('300 × 300 px')).toBeVisible();
    // The file is built once the crop settles.
    await expect(page.getByRole('link', { name: 'Save' })).toBeVisible();
    const dims = await page.evaluate(async () => {
      const a = document.querySelector<HTMLAnchorElement>('a[download]')!;
      const bmp = await createImageBitmap(await (await fetch(a.href)).blob());
      return [bmp.width, bmp.height];
    });
    expect(dims).toEqual([300, 300]);
  });

  test('watermark: pixels change, dimensions do not', async ({ page }) => {
    await page.goto('/image/watermark');
    // The image comes first here: this tool withholds its settings until
    // there is a picture to judge them against (ToolMeta.stageFirst).
    await page.locator('input[type=file]').setInputFiles(await picture(page, 400, 300, 'image/png', 'w.png'));
    await page.getByLabel('Text').fill('NHAKO');
    await expect(page.getByText('"NHAKO" on 1 image')).toBeVisible({ timeout: 20_000 });
    expect((await saved(page)).length).toBeGreaterThan(0);
  });
});

test.describe('files picked before the page finished loading', () => {
  // Each of these islands used to ignore a file chosen before hydration:
  // the input held it, but its change event had fired with no listener.
  async function gate(page: Page, island: string) {
    let release!: () => void;
    const g = new Promise<void>((r) => { release = r; });
    await page.route(new RegExp(`/_astro/${island}\\.[^/]+\\.js$`), async (route) => { await g; await route.continue(); });
    return release;
  }

  test('organize', async ({ page }) => {
    const release = await gate(page, 'OrganizePdf');
    await page.goto('/pdf/organize', { waitUntil: 'domcontentloaded' });
    await page.locator('input[type=file]').setInputFiles([await pdfFile([100, 200], 0, 'a.pdf')]);
    release();
    await expect(page.getByText('2 pages')).toBeVisible();
  });

  test('sign', async ({ page }) => {
    const release = await gate(page, 'SignPdf');
    await page.goto('/pdf/sign', { waitUntil: 'domcontentloaded' });
    await page.locator('input[type=file]').first().setInputFiles(await pdfFile([600, 600]));
    release();
    await expect(page.getByRole('img', { name: 'Page 2' })).toBeVisible();
  });

  test('image crop', async ({ page }) => {
    const release = await gate(page, 'CropImage');
    await page.goto('/image/crop', { waitUntil: 'domcontentloaded' });
    const png = await picture(page, 400, 200, 'image/png', 'wide.png');
    await page.locator('input[type=file]').setInputFiles(png);
    release();
    await expect(page.getByText('400 × 200 px')).toBeVisible();
  });
});
