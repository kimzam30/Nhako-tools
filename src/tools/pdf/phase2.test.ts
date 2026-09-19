import { describe, it, expect } from 'vitest';
import { PDFDocument, degrees } from 'pdf-lib';
import { assemble } from './organize';
import { stamp } from './sign';
import { run as crop } from './crop';
import { run as pageNumbers, pageLabel } from './page-numbers';
import { jpegOrientation } from './jpg-to-pdf';
import { minimalExif } from '../image/metadata';
import { clampRect, initialRect } from '../image/crop';

const ctx = { onProgress() {} };

/** A PDF whose pages are labelled by size, so order survives a round trip. */
async function pdf(widths: number[], rotation = 0) {
  const doc = await PDFDocument.create();
  for (const w of widths) doc.addPage([w, 800]).setRotation(degrees(rotation));
  return new Uint8Array(await doc.save());
}
const asFile = (b: Uint8Array, name = 'a.pdf') => new File([b as Uint8Array<ArrayBuffer>], name, { type: 'application/pdf' });

// A 1x1 transparent PNG.
const PNG = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='), (c) => c.charCodeAt(0));

describe('organize: assemble', () => {
  it('takes pages from several files, in any order, with extra rotation', async () => {
    const a = await pdf([100, 200]);
    const b = await pdf([300, 400, 500]);
    const out = await PDFDocument.load(await assemble([a, b], [
      { source: 1, index: 2, turn: 0 },
      { source: 0, index: 0, turn: 90 },
      { source: 1, index: 0, turn: 270 },
    ]));
    expect(out.getPages().map((p) => p.getWidth())).toEqual([500, 100, 300]);
    expect(out.getPages().map((p) => p.getRotation().angle)).toEqual([0, 90, 270]);
  });

  it('adds to a page\'s own rotation rather than replacing it', async () => {
    const out = await PDFDocument.load(await assemble([await pdf([100], 90)], [{ source: 0, index: 0, turn: 180 }]));
    expect(out.getPage(0).getRotation().angle).toBe(270);
  });
});

describe('sign: stamp', () => {
  it('draws an image onto the chosen page only', async () => {
    const out = await PDFDocument.load(await stamp(await pdf([600, 600]), [
      { page: 1, rect: { x: 50, y: 50, width: 120, height: 40 }, png: PNG },
    ]));
    const xobjects = (i: number) => {
      const res = out.getPage(i).node.Resources();
      return res?.toString().includes('XObject') ?? false;
    };
    expect(xobjects(0)).toBe(false);
    expect(xobjects(1)).toBe(true);
  });
});

describe('crop', () => {
  it('trims the crop box by the margins, in points', async () => {
    const r = await crop([asFile(await pdf([600]))], { top: 10, bottom: 0, left: 0, right: 20, range: '' }, ctx);
    const out = await PDFDocument.load(await r.blob.arrayBuffer());
    const box = out.getPage(0).getCropBox();
    const mm = 72 / 25.4;
    expect(box.x).toBeCloseTo(0, 3);
    expect(box.width).toBeCloseTo(600 - 20 * mm, 3);
    expect(box.y).toBeCloseTo(0, 3);
    expect(box.height).toBeCloseTo(800 - 10 * mm, 3);
  });

  it('measures margins on the page as displayed when it is stored sideways', async () => {
    // Rotate 90: the displayed top is the stored left edge (x = 0 side).
    const r = await crop([asFile(await pdf([600], 90))], { top: 10, bottom: 0, left: 0, right: 0, range: '' }, ctx);
    const box = (await PDFDocument.load(await r.blob.arrayBuffer())).getPage(0).getCropBox();
    expect(box.x).toBeCloseTo(10 * (72 / 25.4), 3);
    expect(box.width).toBeCloseTo(600 - 10 * (72 / 25.4), 3);
    expect(box.height).toBeCloseTo(800, 3);
  });

  it('refuses margins that leave almost nothing', async () => {
    await expect(crop([asFile(await pdf([100]))], { top: 0, bottom: 0, left: 20, right: 20, range: '' }, ctx)).rejects.toThrow(/half an inch/);
  });
});

describe('page numbers', () => {
  it('words labels in either language', () => {
    expect(pageLabel('n', 3, 9, false)).toBe('3');
    expect(pageLabel('n-of-total', 3, 9, false)).toBe('3 / 9');
    expect(pageLabel('page-n-of-total', 3, 9, false)).toBe('Page 3 of 9');
    expect(pageLabel('page-n-of-total', 3, 9, true)).toBe('Halaman 3 daripada 9');
  });

  it('skips the cover and keeps the page count', async () => {
    const r = await pageNumbers([asFile(await pdf([600, 600, 600]))], { position: 'bottom-center', style: 'n', start: 1, size: 11, skipFirst: true }, ctx);
    expect(r.summary).toBe('2 pages numbered 1 to 2');
    expect((await PDFDocument.load(await r.blob.arrayBuffer())).getPageCount()).toBe(3);
  });
});

describe('JPG to PDF: EXIF orientation', () => {
  it('reads the orientation that decides whether a photo is redrawn', () => {
    const jpeg = new Uint8Array([0xff, 0xd8, ...minimalExif(6), 0xff, 0xda, 0, 2, 0xff, 0xd9]);
    expect(jpegOrientation(jpeg)).toBe(6);
    expect(jpegOrientation(new Uint8Array([0xff, 0xd8, 0xff, 0xda, 0, 2]))).toBe(1);
  });
});

describe('image crop geometry', () => {
  it('starts from the largest centred rectangle at the ratio', () => {
    expect(initialRect(1000, 500, 1)).toEqual({ x: 250, y: 0, w: 500, h: 500 });
    expect(initialRect(1000, 500, null)).toEqual({ x: 0, y: 0, w: 1000, h: 500 });
  });

  it('keeps the rectangle inside the image and on the ratio', () => {
    expect(clampRect({ x: 900, y: -20, w: 400, h: 100 }, 1000, 500, 16 / 9)).toEqual({ x: 822, y: 0, w: 178, h: 100 });
    const r = clampRect({ x: 0, y: 0, w: 5000, h: 5000 }, 1000, 500, 1);
    expect(r).toEqual({ x: 0, y: 0, w: 500, h: 500 });
  });
});
