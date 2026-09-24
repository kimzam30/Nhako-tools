import { ToolError, type FileRun } from '../types';
import { bytesToBlob } from '../../lib/format';
import { loadDocument, getPdfJs } from '../../lib/pdfjs';
import { surface, toBlob } from '../../lib/canvas';
import { buildPptx, type PptxRun, type PptxSlide, type PptxTextBox } from '../../lib/pptx';
import { familyOf, isBold, isItalic, lineRuns, toLines, type Line, type TextPiece } from './word-layout';
import { sayer } from '../say';

const PPTX = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
/** Pixels per point for the slide pictures: 144 dpi, sharp on a projector. */
const SCALE = 2;

/**
 * PDF to PowerPoint. One slide per page, the same size as the page.
 *
 * Editable (the default): the page is rendered once with its text and once
 * without. The text-free render becomes the slide's picture, so every shape,
 * photo and background survives exactly, and the text goes back on top as
 * real text boxes at its original position, size, font, weight and colour,
 * where it can be edited. The colour is read from the difference between the
 * two renders, which is exactly where the text was drawn.
 *
 * Picture: each slide is the page as a picture. Looks identical, edits nothing.
 */

type Canvas = ReturnType<typeof surface>;
type Ctx = CanvasRenderingContext2D;

/** Two renders' pixels, compared over a box, give the text's own colour. */
export function textColour(full: Uint8ClampedArray, bare: Uint8ClampedArray, width: number, box: { x0: number; y0: number; x1: number; y1: number }): string {
  let best = -1;
  let colour = '000000';
  const step = Math.max(1, Math.floor(Math.min(box.x1 - box.x0, box.y1 - box.y0) / 24));
  for (let y = box.y0; y < box.y1; y += step) {
    for (let x = box.x0; x < box.x1; x += step) {
      const i = (y * width + x) * 4;
      const d = Math.abs(full[i]! - bare[i]!) + Math.abs(full[i + 1]! - bare[i + 1]!) + Math.abs(full[i + 2]! - bare[i + 2]!);
      if (d > best) {
        best = d;
        colour = [full[i]!, full[i + 1]!, full[i + 2]!].map((v) => v.toString(16).padStart(2, '0')).join('');
      }
    }
  }
  return best < 24 ? '000000' : colour;
}

/**
 * Lines into text boxes: a new box starts when the left edge moves, the size
 * changes, or the gap to the next line is clearly larger than a line.
 */
export function toBoxes(lines: Line[]): Line[][] {
  const boxes: Line[][] = [];
  for (const line of lines) {
    const box = boxes.at(-1);
    const prev = box?.at(-1);
    const gap = prev ? line.y - prev.y : Infinity;
    const same = prev
      && Math.abs(line.left - box![0]!.left) < 0.8 * line.size
      && Math.abs(line.size - prev.size) < 0.6
      && gap > 0 && gap < 1.9 * line.size;
    if (same) box!.push(line);
    else boxes.push([line]);
  }
  return boxes;
}

async function render(page: Awaited<ReturnType<Awaited<ReturnType<typeof loadDocument>>['getPage']>>, withText: boolean) {
  const viewport = page.getViewport({ scale: SCALE });
  const canvas: Canvas = surface(Math.max(1, Math.ceil(viewport.width)), Math.max(1, Math.ceil(viewport.height)));
  const c2d = canvas.getContext('2d') as Ctx | null;
  if (!c2d) throw new ToolError('Could not get a drawing context.');
  c2d.fillStyle = '#fff';
  c2d.fillRect(0, 0, canvas.width, canvas.height);
  if (!withText) {
    // pdf.js draws text through fillText and strokeText. Silenced here, the
    // render keeps every shape and image and leaves the words out, which is
    // the picture the editable text goes back on top of.
    c2d.fillText = () => {};
    c2d.strokeText = () => {};
  }
  await page.render({ canvas: canvas as HTMLCanvasElement, canvasContext: c2d, viewport }).promise;
  return { canvas, c2d };
}

export const run: FileRun = async (files, opts, ctx) => {
  const say = sayer(opts);
  const file = files[0];
  if (!file) throw new ToolError(say('No file selected.', 'Tiada fail dipilih.'));
  const editable = (opts.mode ?? 'editable') !== 'picture';
  const doc = await loadDocument(file, say);
  const { Util } = await getPdfJs();

  const slides: PptxSlide[] = [];
  let size: { width: number; height: number } | null = null;
  let textBoxes = 0;
  let pictureOnly = 0;

  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    const viewport = page.getViewport({ scale: 1 });
    // All slides share one size in a presentation: the first page's. Later
    // pages of another shape are scaled to fit it.
    size ??= { width: viewport.width, height: viewport.height };
    const fit = Math.min(size.width / viewport.width, size.height / viewport.height);
    const offX = (size.width - viewport.width * fit) / 2;
    const offY = (size.height - viewport.height * fit) / 2;

    const pieces: (TextPiece & { angle: number })[] = [];
    if (editable) {
      await page.getOperatorList();
      const content = await page.getTextContent();
      for (const item of content.items) {
        if (!('str' in item) || !item.str.trim()) continue;
        const t = Util.transform(viewport.transform, item.transform);
        const fontSize = Math.hypot(t[2]!, t[3]!);
        if (fontSize < 1) continue;
        let name = '';
        try { name = (page.commonObjs.get(item.fontName) as { name?: string } | undefined)?.name ?? ''; } catch { /* not loaded */ }
        const family = name ? familyOf(name) : content.styles[item.fontName]?.fontFamily === 'serif' ? 'Times New Roman' : 'Arial';
        pieces.push({
          str: item.str, x: t[4]!, y: t[5]!, width: item.width || item.str.length * fontSize * 0.5,
          size: fontSize, bold: isBold(name), italic: isItalic(name), font: family,
          angle: Math.atan2(t[1]!, t[0]!) * 180 / Math.PI,
        });
      }
    }

    const full = await render(page, true);
    let image = full.canvas;
    const boxes: PptxTextBox[] = [];

    if (editable && pieces.length > 0) {
      const bare = await render(page, false);
      const W = full.canvas.width;
      const H = full.canvas.height;
      const fullPx = full.c2d.getImageData(0, 0, W, H).data;
      const barePx = bare.c2d.getImageData(0, 0, W, H).data;
      const colourOf = (x: number, y: number, w: number, h: number) => textColour(fullPx, barePx, W, {
        x0: Math.max(0, Math.floor(x * SCALE)), y0: Math.max(0, Math.floor(y * SCALE)),
        x1: Math.min(W, Math.ceil((x + w) * SCALE)), y1: Math.min(H, Math.ceil((y + h) * SCALE)),
      });
      const place = (v: number, off: number) => off + v * fit;

      const upright = pieces.filter((p) => Math.abs(p.angle) < 1);
      for (const group of toBoxes(toLines(upright))) {
        const first = group[0]!;
        const left = Math.min(...group.map((l) => l.left));
        const right = Math.max(...group.map((l) => l.right));
        const gaps = group.slice(1).map((l, i) => l.y - group[i]!.y);
        const spacing = gaps.length ? gaps.reduce((a, b) => a + b, 0) / gaps.length : first.size * 1.2;
        const top = first.y - first.size * 0.92;
        const height = (group.length - 1) * spacing + first.size * 1.25;
        const colour = colourOf(left, top, right - left, height);
        boxes.push({
          x: place(left, offX), y: place(top, offY),
          width: (right - left) * fit * 1.06 + 2, height: height * fit,
          lineSpacing: spacing * fit,
          paragraphs: group.map((line) => ({
            runs: lineRuns(line).map((r): PptxRun => ({ ...r, size: r.size * fit, color: colour })),
          })),
        });
      }
      // Rotated text (a sideways axis label, a diagonal stamp) gets a box of
      // its own, turned to match. PowerPoint turns a box about its centre.
      for (const p of pieces.filter((q) => Math.abs(q.angle) >= 1)) {
        const rad = (p.angle * Math.PI) / 180;
        const h = p.size * 1.25;
        const cx = p.x + Math.cos(rad) * p.width / 2 + Math.sin(rad) * p.size * 0.35;
        const cy = p.y + Math.sin(rad) * p.width / 2 - Math.cos(rad) * p.size * 0.35;
        boxes.push({
          x: place(cx - p.width / 2, offX), y: place(cy - h / 2, offY),
          width: p.width * fit * 1.06 + 2, height: h * fit, rotation: p.angle,
          paragraphs: [{ runs: [{ text: p.str, size: p.size * fit, bold: p.bold, italic: p.italic, font: p.font, color: colourOf(p.x - p.size, p.y - p.size, p.width + 2 * p.size, 2 * p.size) }] }],
        });
      }
      image = bare.canvas;
      textBoxes += boxes.length;
    } else if (editable) {
      pictureOnly++;
    }

    const jpeg = await toBlob(image, 'image/jpeg', 0.9);
    slides.push({ image: { bytes: new Uint8Array(await jpeg.arrayBuffer()), type: 'jpeg' }, boxes, pictureFit: { x: offX, y: offY, width: viewport.width * fit, height: viewport.height * fit } });
    page.cleanup();
    ctx.onProgress(n / doc.numPages, say(`Page ${n} of ${doc.numPages}`, `Halaman ${n} daripada ${doc.numPages}`));
  }

  const bytes = await buildPptx(slides, { ...size!, title: file.name.replace(/\.pdf$/i, '') });
  const count = doc.numPages;
  const scanned = editable && pictureOnly > 0
    ? say(
      `, ${pictureOnly} page${pictureOnly === 1 ? ' has' : 's have'} no text (scanned?), kept as pictures; run OCR PDF first to make them editable`,
      `, ${pictureOnly} halaman tiada teks (imbasan?), dikekalkan sebagai gambar; jalankan OCR PDF dahulu untuk menjadikannya boleh disunting`,
    )
    : '';
  return {
    blob: bytesToBlob(bytes, PPTX),
    filename: file.name.replace(/\.pdf$/i, '') + '.pptx',
    summary: editable
      ? say(`${count} slide${count === 1 ? '' : 's'}, ${textBoxes} editable text box${textBoxes === 1 ? '' : 'es'}`, `${count} slaid, ${textBoxes} kotak teks boleh disunting`) + scanned
      : say(`${count} slide${count === 1 ? '' : 's'} as pictures`, `${count} slaid sebagai gambar`),
  };
};
