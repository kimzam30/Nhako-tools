import { ToolError, type FileRun } from '../types';
import { bytesToBlob } from '../../lib/format';
import { loadDocument } from '../../lib/pdfjs';
import { surface, toBlob } from '../../lib/canvas';
import { fitToSize, kbToBytes, exactBytes, targetLabel } from '../../lib/fit-size';
import { sayer, type Say } from '../say';
import { openPdf } from './load';

/**
 * Two genuinely different strategies, named honestly.
 *
 * The old build advertised "structural optimisation to shrink file size" but
 * only ever set `useObjectStreams: true`, which typically saves a few percent
 * and essentially nothing on image-heavy documents. That is kept as the
 * lossless mode, with realistic expectations stated in the registry, and a
 * mode that actually reduces size is offered alongside it.
 */
/** Pixels per PDF point when rasterising: 108 dpi, legible without bloating. */
const RENDER_SCALE = 1.5;

type PdfJsDocument = Awaited<ReturnType<typeof loadDocument>>;
type Canvas = ReturnType<typeof surface>;

/** Render every page at `scale` pixels per point. */
async function renderPages(source: PdfJsDocument, scale: number, ms: boolean, onPage?: (i: number) => void) {
  const pages: { canvas: Canvas; width: number; height: number }[] = [];
  for (let i = 1; i <= source.numPages; i++) {
    const page = await source.getPage(i);
    // Rendered at `scale` for legibility, but placed on a page of the ORIGINAL
    // size. Using the render size for the page too made every page 150% as
    // large as the source (A4 came out 892 x 1263 pt).
    const natural = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale });
    const canvas = surface(Math.max(1, Math.ceil(viewport.width)), Math.max(1, Math.ceil(viewport.height)));
    const ctx2d = canvas.getContext('2d');
    if (!ctx2d) throw new ToolError(ms ? 'Tidak dapat memperoleh konteks lukisan.' : 'Could not get a drawing context.');
    await page.render({
      canvas: canvas as HTMLCanvasElement,
      canvasContext: ctx2d as CanvasRenderingContext2D,
      viewport,
    }).promise;
    pages.push({ canvas, width: natural.width, height: natural.height });
    onPage?.(i);
  }
  return pages;
}

/** Re-encode rendered pages as JPEGs in a new PDF. */
async function buildPdf(pages: Awaited<ReturnType<typeof renderPages>>, quality: number): Promise<Uint8Array> {
  const { PDFDocument } = await import('pdf-lib');
  const out = await PDFDocument.create();
  for (const p of pages) {
    const jpeg = await toBlob(p.canvas, 'image/jpeg', quality);
    const embedded = await out.embedJpg(await jpeg.arrayBuffer());
    out.addPage([p.width, p.height]).drawImage(embedded, { x: 0, y: 0, width: p.width, height: p.height });
  }
  return out.save({ useObjectStreams: true });
}

const baseName = (file: File) => file.name.replace(/\.pdf$/i, '') + '-compressed.pdf';

export const run: FileRun = async (files, opts, ctx) => {
  const ms = opts.locale === 'ms';
  const say = sayer(opts);
  const file = files[0];
  if (!file) throw new ToolError(ms ? 'Tiada fail dipilih.' : 'No file selected.');
  const original = file.size;
  const targetKb = Number(opts.target ?? 0);

  if (targetKb > 0 || opts.mode !== 'strong') {
    ctx.onProgress(0.1);
    const doc = await openPdf(file, say);
    ctx.onProgress(0.2);
    const bytes = await doc.save({ useObjectStreams: true });

    if (targetKb > 0) return toTarget(file, bytes, kbToBytes(targetKb), ms, say, ctx);

    ctx.onProgress(1);
    const saved = original - bytes.byteLength;
    return {
      blob: bytesToBlob(bytes, 'application/pdf'),
      filename: baseName(file),
      summary: saved > 0
        ? (ms ? `${Math.round((saved / original) * 100)}% lebih kecil, teks masih boleh dipilih` : `${Math.round((saved / original) * 100)}% smaller, text still selectable`)
        : (ms ? 'Sudah dipadatkan sebaiknya. Cuba mod Kuat untuk pengurangan sebenar' : 'Already optimally packed. Try Strong mode for a real reduction'),
    };
  }

  // Strong: render each page and re-encode it as a JPEG. Shrinks scans
  // dramatically; the cost is that text stops being selectable.
  const source = await loadDocument(file, say);
  const pages = await renderPages(source, RENDER_SCALE, ms, (i) => ctx.onProgress((i / source.numPages) * 0.9));
  const bytes = await buildPdf(pages, Number(opts.quality ?? 70) / 100);
  ctx.onProgress(1);
  const saved = original - bytes.byteLength;

  return {
    blob: bytesToBlob(bytes, 'application/pdf'),
    filename: baseName(file),
    summary: saved > 0
      ? (ms ? `${Math.round((saved / original) * 100)}% lebih kecil · teks tidak lagi boleh dipilih` : `${Math.round((saved / original) * 100)}% smaller · text is no longer selectable`)
      : (ms ? 'Tidak lebih kecil daripada asal kerana PDF ini sudah cekap. Teks tidak lagi boleh dipilih.' : `No smaller than the original, because this PDF was already efficient. Text is no longer selectable.`),
  };
};

/**
 * Get under `target` bytes, keeping the text layer whenever possible.
 *
 * Lossless repacking is tried first, so a file that only needed tidying keeps
 * selectable text. Only when that is not enough are pages rasterised, at the
 * highest quality and resolution that still fits.
 */
async function toTarget(
  file: File, lossless: Uint8Array, target: number, ms: boolean, say: Say, ctx: Parameters<FileRun>[2],
): ReturnType<FileRun> {
  const label = targetLabel(target / 1000);

  if (Math.min(file.size, lossless.byteLength) <= target) {
    const useOriginal = file.size <= lossless.byteLength;
    const size = useOriginal ? file.size : lossless.byteLength;
    ctx.onProgress(1);
    return {
      blob: useOriginal ? file : bytesToBlob(lossless, 'application/pdf'),
      filename: useOriginal ? file.name : baseName(file),
      summary: ms
        ? `Di bawah ${label}: ${exactBytes(size)}, teks masih boleh dipilih`
        : `Under ${label}: ${exactBytes(size)}, text still selectable`,
    };
  }

  const source = await loadDocument(file, say);
  // Render once per resolution step, not once per quality guess.
  let cached: { scale: number; pages: Awaited<ReturnType<typeof renderPages>> } | null = null;
  const fit = await fitToSize(async (quality, scale) => {
    if (cached?.scale !== scale) {
      cached = null; // release the previous step's canvases first
      cached = { scale, pages: await renderPages(source, RENDER_SCALE * scale, ms) };
    }
    return bytesToBlob(await buildPdf(cached.pages, quality), 'application/pdf');
  }, target, {
    minQuality: 0.3,
    // Below about 45 dpi body text stops being readable. Better to say the
    // target cannot be met than to hand back a file nobody can read.
    scales: [1, 0.85, 0.7, 0.55, 0.42],
    onAttempt: (_a, n) => ctx.onProgress(Math.min(0.95, 0.2 + n * 0.07), ms ? 'Mencari saiz terbaik' : 'Finding the best fit'),
  });
  ctx.onProgress(1);

  const dpi = Math.round(72 * RENDER_SCALE * fit.scale);
  return {
    blob: fit.blob,
    filename: baseName(file),
    summary: fit.fits
      ? (ms
        ? `Di bawah ${label}: ${exactBytes(fit.blob.size)} · halaman kini imej ${dpi} dpi, teks tidak boleh dipilih`
        : `Under ${label}: ${exactBytes(fit.blob.size)} · pages are now ${dpi} dpi images, text not selectable`)
      : (ms
        ? `Tidak dapat mencapai ${label} dan kekal boleh dibaca. Paling kecil: ${exactBytes(fit.blob.size)}. Cuba pisahkan PDF dahulu`
        : `Could not reach ${label} and stay readable. Smallest: ${exactBytes(fit.blob.size)}. Try splitting the PDF first`),
  };
}
