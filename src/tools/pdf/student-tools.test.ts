import { describe, it, expect } from 'vitest';
import { PDFDocument, StandardFonts, degrees } from 'pdf-lib';
import { ToolError } from '../types';
import { run as nUp, layoutFor, placement } from './n-up';
import { run as removePages } from './remove-pages';
import { run as extractPages, orderedPages } from './extract-pages';
import { toGray } from './grayscale';
import { toBoxes, textColour } from './to-powerpoint';
import { toLines, type TextPiece } from './word-layout';
import { buildPptx } from '../../lib/pptx';

const ctx = { onProgress() {} };

/** A PDF whose page n says "Page n", optionally one page stored sideways. */
async function numbered(count: number, size: [number, number] = [595, 842], sideways?: number) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (let i = 1; i <= count; i++) {
    const p = doc.addPage(size);
    p.drawText(`Page ${i}`, { x: 40, y: size[1] - 60, size: 24, font });
    if (i === sideways) p.setRotation(degrees(90));
  }
  return new File([await doc.save() as Uint8Array<ArrayBuffer>], 'doc.pdf', { type: 'application/pdf' });
}

describe('Print handouts (n-up)', () => {
  it('stacks two wide slides on a portrait sheet, and four on a landscape one', () => {
    const slide = 960 / 540;
    expect(layoutFor(2, 'a4', 'auto', slide)).toMatchObject({ cols: 1, rows: 2, sheet: [595.28, 841.89] });
    expect(layoutFor(4, 'a4', 'auto', slide)).toMatchObject({ cols: 2, rows: 2, sheet: [841.89, 595.28] });
  });

  it('keeps a portrait page on a portrait sheet at 4 per sheet', () => {
    expect(layoutFor(4, 'a4', 'auto', 595 / 842)).toMatchObject({ cols: 2, rows: 2, sheet: [595.28, 841.89] });
  });

  it('honours an explicit orientation and paper size', () => {
    expect(layoutFor(6, 'letter', 'landscape', 1).sheet).toEqual([792, 612]);
    expect(layoutFor(6, 'letter', 'landscape', 1)).toMatchObject({ cols: 3, rows: 2 });
  });

  it('places a page stored sideways so it fills its box upright', () => {
    // /Rotate 90 turns content clockwise, so it is drawn at -90 from the top-left corner.
    expect(placement(90, 10, 20, 100, 50)).toEqual({ x: 10, y: 70, angle: -90 });
    expect(placement(180, 10, 20, 100, 50)).toEqual({ x: 110, y: 70, angle: -180 });
    expect(placement(270, 10, 20, 100, 50)).toEqual({ x: 110, y: 20, angle: -270 });
    expect(placement(0, 10, 20, 100, 50)).toEqual({ x: 10, y: 20, angle: 0 });
  });

  it('puts 7 pages on 2 sheets at 4 per sheet, sized as A4', async () => {
    const r = await nUp([await numbered(7, [960, 540], 3)], { perSheet: '4', paper: 'a4', orientation: 'auto', order: 'across', border: true }, ctx);
    const doc = await PDFDocument.load(await r.blob.arrayBuffer());
    expect(doc.getPageCount()).toBe(2);
    const { width, height } = doc.getPage(0).getSize();
    expect([Math.round(width), Math.round(height)]).toEqual([842, 595]);
    expect(r.summary).toBe('7 pages on 2 sheets, 4 per sheet');
  });

  it('takes only the pages asked for', async () => {
    const r = await nUp([await numbered(10)], { perSheet: '2', range: '1-3', paper: 'a4', orientation: 'auto', order: 'across', border: false }, ctx);
    expect(r.summary).toBe('3 pages on 2 sheets, 2 per sheet');
  });
});

describe('Remove pages', () => {
  it('drops the listed pages and keeps the rest in order', async () => {
    const r = await removePages([await numbered(6)], { range: '2, 4-5' }, ctx);
    const doc = await PDFDocument.load(await r.blob.arrayBuffer());
    expect(doc.getPageCount()).toBe(3);
    expect(r.summary).toBe('3 pages removed, 3 kept');
  });

  it('refuses to remove every page', async () => {
    await expect(removePages([await numbered(3)], { range: '1-3' }, ctx)).rejects.toThrow(/every page/);
  });

  it('asks for pages rather than silently returning the file unchanged', async () => {
    await expect(removePages([await numbered(3)], { range: '' }, ctx)).rejects.toBeInstanceOf(ToolError);
  });

  it('answers in Malay on the Malay page', async () => {
    const r = await removePages([await numbered(4)], { range: '1', locale: 'ms' }, ctx);
    expect(r.summary).toBe('1 halaman dibuang, 3 disimpan');
  });
});

describe('Extract pages', () => {
  it('keeps the order typed, not page order', () => {
    expect(orderedPages('5, 1-3', 6, undefined)).toEqual([4, 0, 1, 2]);
  });

  it('keeps a page listed twice once, where it first appears', () => {
    expect(orderedPages('3, 1-4', 6, undefined)).toEqual([2, 0, 1, 3]);
  });

  it('writes a PDF of exactly those pages', async () => {
    const src = await numbered(6, [300, 400]);
    const r = await extractPages([src], { range: '6, 2' }, ctx);
    const doc = await PDFDocument.load(await r.blob.arrayBuffer());
    expect(doc.getPageCount()).toBe(2);
    expect(doc.getPage(0).getSize()).toEqual({ width: 300, height: 400 });
    expect(r.summary).toBe('2 pages extracted');
  });

  it('rejects a page beyond the end, in words', async () => {
    await expect(extractPages([await numbered(3)], { range: '7' }, ctx)).rejects.toBeInstanceOf(ToolError);
  });
});

describe('Grayscale', () => {
  it('uses Rec. 709 luma and leaves alpha alone', () => {
    const px = new Uint8ClampedArray([255, 0, 0, 200, 0, 255, 0, 255, 0, 0, 255, 255, 12, 12, 12, 255]);
    toGray(px);
    expect([...px]).toEqual([54, 54, 54, 200, 182, 182, 182, 255, 18, 18, 18, 255, 12, 12, 12, 255]);
  });
});

describe('PDF to PowerPoint layout', () => {
  const piece = (str: string, x: number, y: number, size = 20): TextPiece => ({ str, x, y, width: str.length * size * 0.5, size, bold: false, italic: false, font: 'Arial' });

  it('keeps a title apart from the bullets under it, and the bullets together', () => {
    const lines = toLines([
      piece('Week 3: Cell biology', 60, 80, 36),
      piece('Membranes', 80, 160), piece('Transport', 80, 188), piece('Signalling', 80, 216),
    ]);
    expect(toBoxes(lines).map((b) => b.length)).toEqual([1, 3]);
  });

  it('starts a new box where the left edge moves', () => {
    const lines = toLines([piece('Left column', 40, 100), piece('Right column', 400, 128)]);
    expect(toBoxes(lines)).toHaveLength(2);
  });

  it('reads the text colour from where the two renders differ', () => {
    // 2 x 1 pixels: the left pixel is background in both, the right is red text.
    const bare = new Uint8ClampedArray([255, 255, 255, 255, 255, 255, 255, 255]);
    const full = new Uint8ClampedArray([255, 255, 255, 255, 200, 16, 32, 255]);
    expect(textColour(full, bare, 2, { x0: 0, y0: 0, x1: 2, y1: 1 })).toBe('c81020');
  });

  it('falls back to black where nothing differs', () => {
    const same = new Uint8ClampedArray([255, 255, 255, 255]);
    expect(textColour(same, same, 1, { x0: 0, y0: 0, x1: 1, y1: 1 })).toBe('000000');
  });
});

describe('PowerPoint writer', () => {
  it('writes every part a presentation needs, one slide per page', async () => {
    const JSZip = (await import('jszip')).default;
    const bytes = await buildPptx([
      { image: { bytes: new Uint8Array([0xff, 0xd8, 0xff, 0xd9]), type: 'jpeg' }, boxes: [{ x: 10, y: 20, width: 200, height: 30, paragraphs: [{ runs: [{ text: 'Tom & "Jerry" <3', size: 24, bold: true, italic: false, font: 'Arial', color: 'c81020' }] }] }] },
      { boxes: [] },
    ], { width: 960, height: 540, title: 'Lecture 3' });
    const zip = await JSZip.loadAsync(bytes);
    for (const part of ['[Content_Types].xml', '_rels/.rels', 'ppt/presentation.xml', 'ppt/_rels/presentation.xml.rels',
      'ppt/slideMasters/slideMaster1.xml', 'ppt/slideLayouts/slideLayout1.xml', 'ppt/theme/theme1.xml',
      'ppt/slides/slide1.xml', 'ppt/slides/slide2.xml', 'ppt/media/image1.jpeg', 'docProps/core.xml']) {
      expect(zip.file(part), part).not.toBeNull();
    }
    const presentation = await zip.file('ppt/presentation.xml')!.async('string');
    // 960 x 540 points in EMU.
    expect(presentation).toContain('<p:sldSz cx="12192000" cy="6858000"/>');
    const slide = await zip.file('ppt/slides/slide1.xml')!.async('string');
    expect(slide).toContain('Tom &amp; &quot;Jerry&quot; &lt;3');
    expect(slide).toContain('sz="2400" b="1"');
    expect(slide).toContain('<a:srgbClr val="C81020"/>');
    expect(await zip.file('ppt/slides/_rels/slide2.xml.rels')!.async('string')).not.toContain('image');
  });
});

