import { ToolError, type FileRun } from '../types';
import { bytesToBlob } from '../../lib/format';
import { loadDocument } from '../../lib/pdfjs';
import { surface, toBlob } from '../../lib/canvas';
import { parsePageRange } from '../../lib/range';
import { sayer } from '../say';

/**
 * Grayscale PDF, for printing at a shop that charges extra for colour or on a
 * printer running low on it.
 *
 * Every page is rendered, turned to luminance, and placed back at its original
 * size. Pages go one at a time and each canvas is dropped before the next, so
 * a 300-page lecture pack never holds more than one page of pixels at once.
 * Pages left out of the range are copied through untouched, still in colour.
 */

/** Rec. 709 luma, the weighting screens and printers expect. */
export function toGray(data: Uint8ClampedArray): void {
  for (let i = 0; i < data.length; i += 4) {
    const y = Math.round(0.2126 * data[i]! + 0.7152 * data[i + 1]! + 0.0722 * data[i + 2]!);
    data[i] = y; data[i + 1] = y; data[i + 2] = y;
  }
}

export const run: FileRun = async (files, opts, ctx) => {
  const say = sayer(opts);
  const file = files[0];
  if (!file) throw new ToolError(say('No file selected.', 'Tiada fail dipilih.'));
  const dpi = Number(opts.dpi ?? 150);
  const scale = dpi / 72;
  const { PDFDocument } = await import('pdf-lib');

  const source = await loadDocument(file, say);
  const chosen = new Set(parsePageRange(String(opts.range ?? ''), source.numPages, say));
  // The untouched pages come from the original bytes, so they stay vector.
  const original = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true }).catch(() => null);
  const out = await PDFDocument.create();

  for (let n = 1; n <= source.numPages; n++) {
    if (!chosen.has(n - 1) && original) {
      const [copy] = await out.copyPages(original, [n - 1]);
      out.addPage(copy!);
      continue;
    }
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
    const pixels = c2d.getImageData(0, 0, canvas.width, canvas.height);
    toGray(pixels.data);
    c2d.putImageData(pixels, 0, 0);
    const jpeg = await toBlob(canvas, 'image/jpeg', 0.85);
    const image = await out.embedJpg(await jpeg.arrayBuffer());
    out.addPage([natural.width, natural.height]).drawImage(image, { x: 0, y: 0, width: natural.width, height: natural.height });
    canvas.width = 0; canvas.height = 0;
    page.cleanup();
    ctx.onProgress(n / source.numPages, say(`Page ${n} of ${source.numPages}`, `Halaman ${n} daripada ${source.numPages}`));
  }

  return {
    blob: bytesToBlob(await out.save({ useObjectStreams: true }), 'application/pdf'),
    filename: file.name.replace(/\.pdf$/i, '') + '-grayscale.pdf',
    summary: say(
      `${chosen.size} page${chosen.size === 1 ? '' : 's'} in grayscale at ${dpi} dpi`,
      `${chosen.size} halaman dalam skala kelabu pada ${dpi} dpi`,
    ),
  };
};
