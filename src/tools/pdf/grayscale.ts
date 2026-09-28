import { ToolError, type FileRun } from '../types';
import { bytesToBlob } from '../../lib/format';
import { loadDocument } from '../../lib/pdfjs';
import { surface, toBlob } from '../../lib/canvas';
import { parsePageRange } from '../../lib/range';
import { sayer, type Say } from '../say';
import { openPdf } from './load';
import { grayPages } from './gray-vector';

/**
 * Grayscale PDF, for printing at a shop that charges extra for colour or on a
 * printer running low on it.
 *
 * Colours are converted in the PDF itself (gray-vector.ts), so text stays
 * selectable and drawings stay sharp. Each converted page is then rendered
 * and checked; only a page still showing colour is flattened the old way,
 * rendered and turned to luminance one page at a time. Pages left out of the
 * range are untouched, still in colour.
 */

/** Rec. 709 luma, the weighting screens and printers expect. */
export function toGray(data: Uint8ClampedArray): void {
  for (let i = 0; i < data.length; i += 4) {
    const y = Math.round(0.2126 * data[i]! + 0.7152 * data[i + 1]! + 0.0722 * data[i + 2]!);
    data[i] = y; data[i + 1] = y; data[i + 2] = y;
  }
}

/** Share of a page's pixels allowed to show colour before it counts as not grey. */
const COLOUR_TOLERANCE = 0.0005;

/**
 * Pixels whose channels differ by more than a hair: what "still in colour"
 * means for a rendered page. Anti-aliasing of pure grey never gets near 24.
 */
export function colourShare(data: Uint8ClampedArray): number {
  let coloured = 0;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]!, g = data[i + 1]!, b = data[i + 2]!;
    if (Math.max(r, g, b) - Math.min(r, g, b) > 24) coloured++;
  }
  return coloured / (data.length / 4);
}

type PdfJsDoc = Awaited<ReturnType<typeof loadDocument>>;

/** Render a page of `source` at `scale` onto a white canvas. */
async function draw(source: PdfJsDoc, n: number, scale: number, say: Say) {
  const page = await source.getPage(n);
  const natural = page.getViewport({ scale: 1 });
  const viewport = page.getViewport({ scale });
  const canvas = surface(Math.max(1, Math.ceil(viewport.width)), Math.max(1, Math.ceil(viewport.height)));
  const c2d = canvas.getContext('2d') as CanvasRenderingContext2D | null;
  if (!c2d) throw new ToolError(say('Could not get a drawing context.', 'Tidak dapat memperoleh konteks lukisan.'));
  // White first: a PDF page with no background would otherwise encode its
  // transparent areas as black in a JPEG.
  c2d.fillStyle = '#fff';
  c2d.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvas: canvas as HTMLCanvasElement, canvasContext: c2d, viewport }).promise;
  page.cleanup();
  return { canvas, c2d, natural };
}

export const run: FileRun = async (files, opts, ctx) => {
  const say = sayer(opts);
  const file = files[0];
  if (!file) throw new ToolError(say('No file selected.', 'Tiada fail dipilih.'));
  const dpi = Number(opts.dpi ?? 150);
  const { PDFDocument } = await import('pdf-lib');

  const source = await loadDocument(file, say);
  const chosen = new Set(parsePageRange(String(opts.range ?? ''), source.numPages, say));

  // 1. Vector: rewrite the colours themselves, so text stays text.
  ctx.onProgress(0.05, say('Converting colours', 'Menukar warna'));
  const doc = await openPdf(file, say);
  const pages = doc.getPages();
  await grayPages(doc, pages.filter((_, i) => chosen.has(i)));
  const vector = await doc.save({ useObjectStreams: true });

  // 2. Check every converted page by looking at it. A page still showing
  //    colour (a spot colour, a gradient, a CMYK photo) is flattened the old
  //    way from the original, so the result always prints grey.
  const check = await loadDocument(new File([vector as BlobPart], file.name, { type: 'application/pdf' }), say);
  const flatten: number[] = [];
  for (let n = 1; n <= source.numPages; n++) {
    if (!chosen.has(n - 1)) continue;
    const { canvas, c2d } = await draw(check, n, 0.6, say);
    if (colourShare(c2d.getImageData(0, 0, canvas.width, canvas.height).data) > COLOUR_TOLERANCE) flatten.push(n);
    canvas.width = 0; canvas.height = 0;
    ctx.onProgress(0.1 + (n / source.numPages) * 0.5, say(`Checking page ${n} of ${source.numPages}`, `Menyemak halaman ${n} daripada ${source.numPages}`));
  }
  void check.destroy();

  let out = doc;
  if (flatten.length) {
    out = await PDFDocument.load(vector);
    for (const [k, n] of flatten.entries()) {
      const { canvas, c2d, natural } = await draw(source, n, dpi / 72, say);
      const pixels = c2d.getImageData(0, 0, canvas.width, canvas.height);
      toGray(pixels.data);
      c2d.putImageData(pixels, 0, 0);
      const jpeg = await toBlob(canvas, 'image/jpeg', 0.85);
      const image = await out.embedJpg(await jpeg.arrayBuffer());
      const flat = out.insertPage(n - 1, [natural.width, natural.height]);
      flat.drawImage(image, { x: 0, y: 0, width: natural.width, height: natural.height });
      out.removePage(n);
      canvas.width = 0; canvas.height = 0;
      ctx.onProgress(0.6 + ((k + 1) / flatten.length) * 0.4, say(`Flattening page ${n}`, `Meratakan halaman ${n}`));
    }
  }
  ctx.onProgress(1);

  const kept = chosen.size - flatten.length;
  const parts = [
    say(`${chosen.size} page${chosen.size === 1 ? '' : 's'} in grayscale`, `${chosen.size} halaman dalam skala kelabu`),
    kept ? say(`${kept === chosen.size ? 'text' : `${kept} with text`} still selectable`, `${kept === chosen.size ? 'teks' : `${kept} dengan teks`} masih boleh dipilih`) : '',
    flatten.length ? say(`${flatten.length} flattened at ${dpi} dpi (colours only an image could remove)`, `${flatten.length} diratakan pada ${dpi} dpi (warna yang hanya imej boleh buang)`) : '',
  ].filter(Boolean);
  return {
    blob: bytesToBlob(await out.save({ useObjectStreams: true }), 'application/pdf'),
    filename: file.name.replace(/\.pdf$/i, '') + '-grayscale.pdf',
    summary: parts.join(', '),
  };
};
