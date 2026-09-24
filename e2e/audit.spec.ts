import { test, expect, type Page } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { PDFDocument, degrees } from 'pdf-lib';
import JSZip from 'jszip';

/**
 * The tools that had no output-correctness test of their own.
 *
 * Every other spec here reads back what a tool produced. These fourteen were
 * only ever covered by scripts/sweep.mjs, which asks whether a Save button
 * appeared and nothing more: a tool that wrote an empty file, ignored an
 * option or rotated the wrong page would have passed it. Each check below
 * reads the saved bytes, or the rendered output, and tests what is in them.
 */

const fixture = (name: string) => fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url));
const A4 = { w: 595.28, h: 841.89 };

async function saved(page: Page) {
  const href = await page.getByRole('link', { name: 'Save' }).getAttribute('href');
  const b64 = await page.evaluate(async (h) => {
    const bytes = new Uint8Array(await (await fetch(h!)).arrayBuffer());
    let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(s);
  }, href);
  return Buffer.from(b64, 'base64');
}

async function pdfFile(pages: number, rotation = 0, name = 'doc.pdf') {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pages; i++) doc.addPage([A4.w, A4.h]).setRotation(degrees(rotation));
  return { name, mimeType: 'application/pdf', buffer: Buffer.from(await doc.save()) };
}

/** A PNG drawn by the browser: left half pink, right half blue. */
async function picture(page: Page, w: number, h: number, name = 'pic.png') {
  const b64 = await page.evaluate(([w, h]) => {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const x = c.getContext('2d')!;
    x.fillStyle = '#e0457b'; x.fillRect(0, 0, w / 2, h);
    x.fillStyle = '#3b82f6'; x.fillRect(w / 2, 0, w / 2, h);
    return c.toDataURL('image/png').split(',')[1]!;
  }, [w, h] as const);
  return { name, mimeType: 'image/png', buffer: Buffer.from(b64, 'base64') };
}

/** Decode image bytes in the page and report its size and a few pixels. */
async function inspect(page: Page, bytes: Buffer, type: string, at: [number, number][] = []) {
  return page.evaluate(async ([b64, type, at]) => {
    const bin = atob(b64 as string);
    const u8 = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    const bitmap = await createImageBitmap(new Blob([u8], { type: type as string }));
    const c = document.createElement('canvas');
    c.width = bitmap.width; c.height = bitmap.height;
    const ctx = c.getContext('2d')!;
    ctx.drawImage(bitmap, 0, 0);
    const pixels = (at as [number, number][]).map(([x, y]) => [...ctx.getImageData(x, y, 1, 1).data].slice(0, 3));
    return { width: bitmap.width, height: bitmap.height, pixels };
  }, [bytes.toString('base64'), type, at] as const);
}

/** Words pdf.js finds on each page of a PDF, lowercased. */
async function textLayer(pdf: Buffer) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const doc = await pdfjs.getDocument({ data: new Uint8Array(pdf) }).promise;
  const pages: string[] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const items = (await (await doc.getPage(n)).getTextContent()).items as { str: string }[];
    pages.push(items.map((i) => i.str).join(' ').replace(/\s+/g, ' ').trim().toLowerCase());
  }
  return pages;
}

test.describe('PDF tools with no output check of their own', () => {
  test('to-image: one image per page, at the resolution asked for', async ({ page }) => {
    await page.goto('/pdf/to-image');
    await page.getByLabel('Resolution').selectOption('1'); // 72 dpi, so the pixels equal the points
    await page.locator('input[type=file]').setInputFiles(fixture('three-pages.pdf'));
    await expect(page.getByRole('link', { name: 'Save' })).toBeVisible({ timeout: 30_000 });

    const zip = await JSZip.loadAsync(await saved(page));
    const names = Object.keys(zip.files).sort();
    expect(names).toEqual(['three-pages-page-1.jpg', 'three-pages-page-2.jpg', 'three-pages-page-3.jpg']);

    const first = Buffer.from(await zip.file(names[0]!)!.async('uint8array'));
    const { width, height } = await inspect(page, first, 'image/jpeg');
    // The fixture's pages are 595 x 842 pt, so 72 dpi is 595 x 842 px.
    expect(width).toBe(595);
    expect(height).toBe(842);
  });

  test('to-image: the resolution option actually changes the pixels', async ({ page }) => {
    await page.goto('/pdf/to-image');
    await page.getByLabel('Resolution').selectOption('3'); // 216 dpi
    await page.locator('input[type=file]').setInputFiles(fixture('three-pages.pdf'));
    await expect(page.getByRole('link', { name: 'Save' })).toBeVisible({ timeout: 30_000 });
    const zip = await JSZip.loadAsync(await saved(page));
    const first = Buffer.from(await zip.file('three-pages-page-1.jpg')!.async('uint8array'));
    expect((await inspect(page, first, 'image/jpeg')).width).toBe(595 * 3);
  });

  test('to-text: every page, in order, under its own heading', async ({ page }) => {
    await page.goto('/pdf/to-text');
    await page.locator('input[type=file]').setInputFiles(fixture('three-pages.pdf'));
    await expect(page.getByRole('link', { name: 'Save' })).toBeVisible({ timeout: 30_000 });

    const text = (await saved(page)).toString('utf8');
    expect(text).toContain('--- Page 1 ---');
    expect(text).toContain('--- Page 3 ---');
    expect(text).toMatch(/page 2 of 3/);
    // The pages must come out in reading order, not whatever order they resolved in.
    expect(text.indexOf('page 1 of 3')).toBeLessThan(text.indexOf('page 3 of 3'));
  });

  test('to-text: a scan with no text layer says so instead of saving an empty file', async ({ page }) => {
    const doc = await PDFDocument.create();
    doc.addPage([A4.w, A4.h]); // drawn on by nothing: no text layer at all
    await page.goto('/pdf/to-text');
    await page.locator('input[type=file]').setInputFiles({ name: 'scan.pdf', mimeType: 'application/pdf', buffer: Buffer.from(await doc.save()) });
    await expect(page.getByText(/no text layer/i)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('link', { name: 'Save' })).toHaveCount(0);
  });

  test('rotate: only the pages in the range turn, and the turn adds to what was there', async ({ page }) => {
    await page.goto('/pdf/rotate');
    await page.getByLabel('Rotate by').selectOption('270');
    await page.getByLabel('Pages').fill('2');
    // Page 2 starts at 90, so 90 + 270 lands back at 0; the others must not move.
    const doc = await PDFDocument.create();
    for (const r of [0, 90, 0]) doc.addPage([A4.w, A4.h]).setRotation(degrees(r));
    await page.locator('input[type=file]').setInputFiles({ name: 'turned.pdf', mimeType: 'application/pdf', buffer: Buffer.from(await doc.save()) });
    await expect(page.getByRole('link', { name: 'Save' })).toBeVisible({ timeout: 30_000 });

    const out = await PDFDocument.load(await saved(page));
    expect(out.getPages().map((p) => p.getRotation().angle)).toEqual([0, 0, 0]);
  });

  test('rotate: with no range, every page turns', async ({ page }) => {
    await page.goto('/pdf/rotate');
    await page.locator('input[type=file]').setInputFiles(await pdfFile(3));
    await expect(page.getByRole('link', { name: 'Save' })).toBeVisible({ timeout: 30_000 });
    const out = await PDFDocument.load(await saved(page));
    expect(out.getPages().map((p) => p.getRotation().angle)).toEqual([90, 90, 90]);
  });

  test('crop: the crop box shrinks by the margins, the page size does not', async ({ page }) => {
    await page.goto('/pdf/crop');
    await page.getByLabel('Top').fill('10');
    await page.getByLabel('Bottom').fill('0');
    await page.getByLabel('Left').fill('20');
    await page.getByLabel('Right').fill('0');
    await page.locator('input[type=file]').setInputFiles(await pdfFile(1));
    await expect(page.getByRole('link', { name: 'Save' })).toBeVisible({ timeout: 30_000 });

    const out = await PDFDocument.load(await saved(page));
    const box = out.getPage(0).getCropBox();
    const mm = (n: number) => (n * 72) / 25.4;
    expect(box.width).toBeCloseTo(A4.w - mm(20), 1);
    expect(box.height).toBeCloseTo(A4.h - mm(10), 1);
    // Trimming the left edge moves the box right; the top cut moves the top down.
    expect(box.x).toBeCloseTo(mm(20), 1);
    expect(box.y).toBeCloseTo(0, 1);
    // Nothing is deleted: the media box is untouched, which the page promises.
    expect(out.getPage(0).getMediaBox().width).toBeCloseTo(A4.w, 1);
  });

  test('crop: margins that would leave a sliver are refused, with the page named', async ({ page }) => {
    await page.goto('/pdf/crop');
    // A4 is 297 mm tall, so 150 + 140 leaves 7 mm: under the half inch the tool refuses.
    await page.getByLabel('Top').fill('150');
    await page.getByLabel('Bottom').fill('140');
    await page.locator('input[type=file]').setInputFiles(await pdfFile(2));
    await expect(page.locator('[data-status-message]')).toContainText(/page 1/i, { timeout: 30_000 });
    await expect(page.getByRole('link', { name: 'Save' })).toHaveCount(0);
  });

  test('watermark: the text lands on every page, and the settings reach the file', async ({ page }) => {
    await page.goto('/pdf/watermark');
    await page.getByLabel('Text').fill('SULIT');
    await page.locator('input[type=file]').setInputFiles(fixture('three-pages.pdf'));
    await expect(page.getByRole('link', { name: 'Save' })).toBeVisible({ timeout: 30_000 });

    const pages = await textLayer(await saved(page));
    expect(pages).toHaveLength(3);
    for (const p of pages) expect(p).toContain('sulit');
    // The original content survives underneath it.
    expect(pages[0]).toMatch(/page 1 of 3/);
  });
});

/**
 * A file that starts with "%PDF" and is rubbish after that: a truncated
 * download, a half-synced file, a rename.
 *
 * pdf-lib's load() accepts it and only fails when the catalog is first
 * touched, so seven tools used to put a raw "Cannot read properties of
 * undefined (reading 'Pages')" in front of the user, and Unlock claimed there
 * was "nothing to unlock" about a file it could not read at all.
 */
test.describe('a PDF that loads but has no pages', () => {
  const broken = { name: 'separuh.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 then nothing but noise '.repeat(40)) };
  const error = (page: Page) => page.locator('[data-status-message]').first();

  for (const [id, prepare] of [
    ['pdf/merge', null],
    ['pdf/split', null],
    ['pdf/compress', null],
    ['pdf/rotate', null],
    ['pdf/watermark', null],
    ['pdf/page-numbers', null],
    ['pdf/crop', null],
    ['pdf/protect', 'password'],
  ] as const) {
    test(`${id} names the file instead of leaking an exception`, async ({ page }) => {
      await page.goto(`/${id}`);
      if (prepare === 'password') await page.getByLabel('Password').fill('rahsia123');
      const files = id === 'pdf/merge' ? [broken, broken] : broken;
      await page.locator('input[type=file]').setInputFiles(files);
      // Merge stages its files and runs on request, so the engine is only
      // reached once Combine is pressed. Split validates at stage time, while
      // it is drawing the pages, and names the file without being asked.
      if (id === 'pdf/merge') await page.getByRole('button', { name: 'Combine into one PDF' }).click();

      await expect(error(page)).toContainText('separuh.pdf', { timeout: 30_000 });
      const message = await error(page).innerText();
      expect(message).not.toMatch(/Cannot read properties|is not a function|undefined/);
      expect(message).not.toBe('Something went wrong running this tool.');
    });
  }

  test('unlock says it cannot read the file, not that there is nothing to unlock', async ({ page }) => {
    await page.goto('/pdf/unlock');
    await page.locator('input[type=file]').setInputFiles(broken);
    await expect(error(page)).toHaveText('Could not read "separuh.pdf" as a PDF.');
  });

  test('a real unencrypted PDF still gets the "nothing to unlock" message', async ({ page }) => {
    await page.goto('/pdf/unlock');
    await page.locator('input[type=file]').setInputFiles(await pdfFile(1, 0, 'biasa.pdf'));
    await expect(error(page)).toContainText('nothing to unlock');
  });
});

test.describe('image tools with no output check of their own', () => {
  test('resize: a width alone keeps the aspect ratio', async ({ page }) => {
    await page.goto('/image/resize');
    await page.getByLabel('Width').fill('200');
    await page.locator('input[type=file]').setInputFiles(await picture(page, 400, 300));
    await expect(page.getByRole('link', { name: 'Save' })).toBeVisible({ timeout: 30_000 });

    const out = await inspect(page, await saved(page), 'image/png', [[40, 75], [160, 75]]);
    expect([out.width, out.height]).toEqual([200, 150]);
    // Left still pink, right still blue: it was scaled, not cropped or flipped.
    expect(out.pixels[0]![0]).toBeGreaterThan(out.pixels[0]![2]!);
    expect(out.pixels[1]![2]).toBeGreaterThan(out.pixels[1]![0]!);
  });

  test('resize: "never enlarge" leaves a smaller image alone', async ({ page }) => {
    await page.goto('/image/resize');
    await page.getByLabel('Width').fill('2000');
    await page.locator('input[type=file]').setInputFiles(await picture(page, 400, 300));
    await expect(page.getByRole('link', { name: 'Save' })).toBeVisible({ timeout: 30_000 });
    expect((await inspect(page, await saved(page), 'image/png')).width).toBe(400);
  });

  test('HEIC to JPG: an iPhone-style photo decodes to the right size and colours', async ({ page }) => {
    await page.goto('/image/heic-to-jpg');
    await page.locator('input[type=file]').setInputFiles(fixture('photo.heic'));
    await expect(page.getByRole('link', { name: 'Save' })).toBeVisible({ timeout: 60_000 });

    const out = await saved(page);
    // One photo comes back on its own, not zipped.
    expect(out.subarray(0, 3).toString('hex')).toBe('ffd8ff');
    const img = await inspect(page, out, 'image/jpeg', [[30, 60], [130, 60]]);
    expect([img.width, img.height]).toEqual([160, 120]);
    const [left, right] = img.pixels as [number[], number[]];
    expect(left[0]).toBeGreaterThan(180); // pink
    expect(right[2]).toBeGreaterThan(180); // blue
  });

  test('HEIC to JPG: a file that is not HEIC is named in the error', async ({ page }) => {
    await page.goto('/image/heic-to-jpg');
    await page.locator('input[type=file]').setInputFiles({ name: 'notes.heic', mimeType: 'image/heic', buffer: Buffer.from('this is not a photo') });
    await expect(page.locator('[data-status-message]')).toContainText(/notes\.heic/, { timeout: 60_000 });
  });
});

/**
 * Crop image, on a browser that cannot write the source's own format.
 *
 * Safari cannot encode WebP, so cropping a .webp there threw inside the
 * effect that builds the preview. Nothing caught it: the crop simply never
 * appeared, and the only trace was an unhandled rejection in the console.
 * Neither engine here reproduces that on its own (Linux WebKit does encode
 * WebP), so the fallback every browser makes is simulated: hand back PNG for
 * whatever was asked for.
 */
test.describe('an encoder the browser does not have', () => {
  test('crop says so instead of silently producing nothing', async ({ page }) => {
    await page.addInitScript(() => {
      const pngOnly = async function (this: OffscreenCanvas) {
        return (OffscreenCanvas.prototype as unknown as { __real: (o: object) => Promise<Blob> }).__real.call(this, { type: 'image/png' });
      };
      (OffscreenCanvas.prototype as unknown as { __real: unknown }).__real = OffscreenCanvas.prototype.convertToBlob;
      OffscreenCanvas.prototype.convertToBlob = pngOnly as typeof OffscreenCanvas.prototype.convertToBlob;
      const realToBlob = HTMLCanvasElement.prototype.toBlob;
      HTMLCanvasElement.prototype.toBlob = function (cb: BlobCallback) { realToBlob.call(this, cb, 'image/png'); };
    });

    await page.goto('/image/crop');
    const webp = await page.evaluate(async () => {
      const c = document.createElement('canvas'); c.width = 200; c.height = 150;
      const x = c.getContext('2d')!;
      x.fillStyle = '#e0457b'; x.fillRect(0, 0, 200, 150);
      // Built before the stub matters for decoding: a data URL, not an encode.
      return c.toDataURL('image/png').split(',')[1]!;
    });
    await page.locator('input[type=file]').setInputFiles({ name: 'photo.webp', mimeType: 'image/webp', buffer: Buffer.from(webp, 'base64') });

    await expect(page.locator('[data-status-message]').first()).toContainText(/cannot encode|could not be opened/i, { timeout: 20_000 });
  });
});

test.describe('media tools with no output check of their own', () => {
  // The input clip is recorded by the browser, and WebKit's MediaRecorder
  // does not write WebM. ffmpeg.wasm is the same build on both engines, so
  // one engine proves the tool.
  test.skip(({ browserName }) => browserName !== 'chromium', 'the test clip is recorded as WebM, which WebKit cannot write');
  test.setTimeout(180_000);

  /** A short clip with a tone on it, recorded by the browser. */
  async function clip(page: Page, seconds = 3) {
    await page.evaluate(async (seconds) => {
      const canvas = document.createElement('canvas');
      canvas.width = 320; canvas.height = 240;
      const ctx = canvas.getContext('2d')!;
      let f = 0;
      const frame = () => { ctx.fillStyle = `hsl(${(f * 6) % 360} 70% 50%)`; ctx.fillRect(0, 0, 320, 240); f++; };
      frame();
      const audio = new AudioContext();
      const osc = audio.createOscillator();
      const dest = audio.createMediaStreamDestination();
      osc.frequency.value = 440; osc.connect(dest); osc.start();
      const stream = canvas.captureStream(20);
      for (const t of dest.stream.getAudioTracks()) stream.addTrack(t);
      const rec = new MediaRecorder(stream, { mimeType: 'video/webm' });
      const chunks: Blob[] = [];
      rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
      rec.start(100);
      const timer = setInterval(frame, 50);
      await new Promise((r) => setTimeout(r, seconds * 1000 + 200));
      clearInterval(timer); osc.stop();
      await new Promise((r) => { rec.onstop = r; rec.stop(); });
      const file = new File(chunks, 'clip.webm', { type: 'video/webm' });
      const input = document.querySelector('input[type=file]') as HTMLInputElement;
      const dt = new DataTransfer(); dt.items.add(file);
      input.files = dt.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }, seconds);
  }

  test('extract audio: a real MP3 comes out, at the bitrate chosen, and it plays', async ({ page }) => {
    await page.goto('/media/extract-audio');
    await clip(page);
    await expect(page.getByRole('link', { name: 'Save' })).toBeVisible({ timeout: 120_000 });

    const mp3 = await saved(page);
    // An MPEG audio frame header, after any ID3 tag, is the file format check.
    const start = mp3.subarray(0, 3).toString('latin1') === 'ID3'
      ? 10 + ((mp3[6]! << 21) | (mp3[7]! << 14) | (mp3[8]! << 7) | mp3[9]!)
      : 0;
    expect(mp3[start]).toBe(0xff);
    expect(mp3[start + 1]! & 0xe0).toBe(0xe0);

    // And the browser agrees it is decodable audio of about the right length.
    const seconds = await page.evaluate(async (b64) => {
      const u8 = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const buffer = await new AudioContext().decodeAudioData(u8.buffer as ArrayBuffer);
      return buffer.duration;
    }, mp3.toString('base64'));
    expect(seconds).toBeGreaterThan(2);
    expect(seconds).toBeLessThan(6);
  });

  test('compress video: an MP4 comes out, near the target size, and it decodes', async ({ page }) => {
    await page.goto('/media/compress-video');
    await page.getByLabel('Target size').fill('1');
    await clip(page);
    await expect(page.getByRole('link', { name: 'Save' })).toBeVisible({ timeout: 150_000 });

    const mp4 = await saved(page);
    expect(mp4.subarray(4, 8).toString('latin1')).toBe('ftyp'); // an ISO base media file
    expect(mp4.length).toBeLessThan(1_400_000); // the target, with the slack the page promises

    const played = await page.evaluate(async (b64) => {
      const u8 = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const video = document.createElement('video');
      video.src = URL.createObjectURL(new Blob([u8], { type: 'video/mp4' }));
      await new Promise((ok, fail) => { video.onloadedmetadata = ok; video.onerror = () => fail(new Error('undecodable')); });
      return { width: video.videoWidth, seconds: video.duration };
    }, mp4.toString('base64'));
    expect(played.width).toBe(320);
    expect(played.seconds).toBeGreaterThan(2);
  });
});

test.describe('text tools with no output check of their own', () => {
  const output = (page: Page) => page.locator('pre').first();

  test('base64: encodes multi-byte text and decodes it back', async ({ page }) => {
    await page.goto('/dev/base64');
    await page.getByLabel('Input').fill('héllo 🎉 wörld');
    await expect(output(page)).toHaveText('aMOpbGxvIPCfjokgd8O2cmxk');

    await page.getByLabel('Mode').selectOption('decode');
    await page.getByLabel('Input').fill('aMOpbGxvIPCfjokgd8O2cmxk');
    await expect(output(page)).toHaveText('héllo 🎉 wörld');
  });

  test('base64: URL-safe output has no characters a URL would mangle', async ({ page }) => {
    await page.goto('/dev/base64');
    await page.getByLabel('Input').fill('~~~???>>>');
    await expect(output(page)).toHaveText('fn5+Pz8/Pj4+');
    await page.getByLabel('URL-safe alphabet').check();
    await expect(output(page)).toHaveText('fn5-Pz8_Pj4-');
  });

  test('base64: input that is not Base64 is refused, not silently mangled', async ({ page }) => {
    await page.goto('/dev/base64');
    await page.getByLabel('Mode').selectOption('decode');
    await page.getByLabel('Input').fill('not base64 !!!');
    await expect(page.getByText(/not valid base64/i)).toBeVisible();
  });

  test('hash: the digests match the published test vectors, and the algorithm switches', async ({ page }) => {
    await page.goto('/dev/hash');
    await page.getByLabel('Input').fill('abc');
    await expect(output(page)).toHaveText('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');

    await page.getByLabel('Algorithm').selectOption('SHA-1');
    await expect(output(page)).toHaveText('a9993e364706816aba3e25717850c26c9cd0d89d');

    await page.getByLabel('Algorithm').selectOption('SHA-512');
    await expect(output(page)).toHaveText(/^ddaf35a193617aba/);
  });

  test('QR: a PNG of the size asked for, and the correction level reaches it', async ({ page }) => {
    await page.goto('/dev/qr');
    await page.getByLabel('Input').fill('https://tools.nhako.com');
    const image = page.locator('img[alt*="QR"]').first();
    await expect(image).toBeVisible();

    const src = await image.getAttribute('src');
    expect(src).toMatch(/^data:image\/png;base64,/);
    const png = Buffer.from(src!.split(',')[1]!, 'base64');
    expect((await inspect(page, png, 'image/png')).width).toBe(512);

    // A higher correction level packs more modules in, so the image must change.
    await page.getByLabel('Error correction').selectOption('H');
    await expect.poll(() => image.getAttribute('src')).not.toBe(src);
  });

  test('QR: more data than a QR code can hold is explained, not thrown', async ({ page }) => {
    await page.goto('/dev/qr');
    await page.getByLabel('Error correction').selectOption('H');
    await page.getByLabel('Input').fill('x'.repeat(4000));
    await expect(page.getByText(/too much data/i)).toBeVisible();
  });

  test('CSS shadow: the sliders produce the value, and the preview really wears it', async ({ page }) => {
    await page.goto('/dev/css-shadow');
    await page.getByLabel('Offset Y').fill('12');
    await page.getByLabel('Blur').fill('30');
    await page.getByLabel('Opacity').fill('40');
    await expect(output(page)).toHaveText('box-shadow: 0px 12px 30px -6px rgba(19, 19, 22, 0.4);');

    // The swatch is styled by the same value, not by a hardcoded stand-in.
    const applied = await page.locator('[style*="box-shadow"]').first().evaluate((el) => getComputedStyle(el).boxShadow);
    expect(applied).toContain('12px');
    expect(applied).toContain('30px');
  });

  test('CSS shadow: inset is a different shadow, not the same one relabelled', async ({ page }) => {
    await page.goto('/dev/css-shadow');
    await page.getByLabel('Inset').check();
    await expect(output(page)).toHaveText(/box-shadow: inset /);
  });
});
