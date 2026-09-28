import { ToolError, type FileRun } from '../types';
import { bytesToBlob } from '../../lib/format';
import { loadDocument } from '../../lib/pdfjs';
import { surface, toBlob } from '../../lib/canvas';
import { fitToSize, kbToBytes, exactBytes, targetLabel } from '../../lib/fit-size';
import { sayer, type Say } from '../say';
import { openPdf } from './load';
import { shrinkImages, type ShrinkReport } from './shrink-images';

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

/** 1754 px is the long side of an A4 page at 150 dpi: sharp on screen and on paper. */
const IMAGE_SIDE = 1754;

/**
 * Structural repack: pdf-lib's object streams, then qpdf's full recompression
 * (every Flate stream re-deflated at level 9, unused resources dropped).
 * pdf-lib alone made the IRS Publication 17 (142 pages) 9% LARGER, and the
 * old code handed that back as "already optimally packed". qpdf is only
 * fetched here, the first time a PDF is compressed.
 */
async function repack(bytes: Uint8Array): Promise<Uint8Array> {
  try {
    const { qpdf } = await import('../../lib/qpdf');
    const out = await qpdf(bytes, [
      '--object-streams=generate', '--compress-streams=y', '--recompress-flate',
      '--compression-level=9', '--remove-unreferenced-resources=yes',
      '/in.pdf', '/out.pdf',
    ]);
    if ((out.code === 0 || out.code === 3) && out.bytes && out.bytes.byteLength < bytes.byteLength) return out.bytes;
  } catch { /* qpdf unavailable: the pdf-lib save stands */ }
  return bytes;
}

/**
 * The smallest of the candidates, or the original file itself.
 *
 * iLovePDF, Smallpdf and Acrobat never hand back a file bigger than the one
 * given, and neither does this: when nothing helps, the original comes back
 * untouched with a plain note, rather than a "compressed" copy that weighs more.
 */
function smallest(file: File, candidates: Uint8Array[]): Uint8Array | null {
  const best = candidates.reduce<Uint8Array | null>((a, b) => (!a || b.byteLength < a.byteLength ? b : a), null);
  return best && best.byteLength < file.size ? best : null;
}

const pct = (from: number, to: number) => Math.max(1, Math.round((1 - to / from) * 100));

export const run: FileRun = async (files, opts, ctx) => {
  const ms = opts.locale === 'ms';
  const say = sayer(opts);
  const file = files[0];
  if (!file) throw new ToolError(ms ? 'Tiada fail dipilih.' : 'No file selected.');
  const original = file.size;
  const targetKb = Number(opts.target ?? 0);
  const mode = opts.mode === 'lossless' || opts.mode === 'strong' ? opts.mode : 'images';
  const quality = Math.min(0.95, Math.max(0.3, Number(opts.quality ?? 70) / 100));

  if (targetKb > 0) return toTarget(file, kbToBytes(targetKb), ms, say, ctx);

  if (mode !== 'strong') {
    ctx.onProgress(0.05, say('Reading the PDF', 'Membaca PDF'));
    const doc = await openPdf(file, say);
    let report: ShrinkReport | null = null;
    if (mode === 'images') {
      report = await shrinkImages(doc, {
        quality, maxSide: IMAGE_SIDE,
        onImage: (i, n) => ctx.onProgress(0.1 + (n ? (i / n) * 0.6 : 0.6), say(`Shrinking images (${i} of ${n})`, `Mengecilkan imej (${i} daripada ${n})`)),
      });
    }
    ctx.onProgress(0.75, say('Repacking', 'Memadatkan semula'));
    const saved = await doc.save({ useObjectStreams: true });
    const best = smallest(file, [saved, await repack(saved)]);
    ctx.onProgress(1);
    if (!best) {
      return {
        blob: file,
        filename: file.name,
        summary: mode === 'images' && report && report.images === 0
          ? say('No images to shrink and the structure is already tight, so the original is unchanged. Extreme mode flattens pages for a real saving', 'Tiada imej untuk dikecilkan dan strukturnya sudah padat, jadi fail asal tidak diubah. Mod Ekstrem meratakan halaman untuk penjimatan sebenar')
          : say('Already as small as it gets without losing quality, so the original is unchanged', 'Sudah sekecil mungkin tanpa kehilangan kualiti, jadi fail asal tidak diubah'),
      };
    }
    const shrunk = report?.replaced
      ? say(`, ${report.replaced} image${report.replaced === 1 ? '' : 's'} downsized`, `, ${report.replaced} imej dikecilkan`)
      : '';
    return {
      blob: bytesToBlob(best, 'application/pdf'),
      filename: baseName(file),
      summary: say(`${pct(original, best.byteLength)}% smaller${shrunk}, text still selectable`, `${pct(original, best.byteLength)}% lebih kecil${shrunk}, teks masih boleh dipilih`),
    };
  }

  // Extreme: render each page and re-encode it as a JPEG. Shrinks scans
  // and vector-heavy files hardest; the cost is that text stops being selectable.
  const source = await loadDocument(file, say);
  const pages = await renderPages(source, RENDER_SCALE, ms, (i) => ctx.onProgress((i / source.numPages) * 0.9));
  const bytes = await buildPdf(pages, quality);
  ctx.onProgress(1);
  if (bytes.byteLength >= original) {
    return {
      blob: file,
      filename: file.name,
      summary: say('Flattening would not make this PDF any smaller, so the original is unchanged', 'Meratakan tidak akan menjadikan PDF ini lebih kecil, jadi fail asal tidak diubah'),
    };
  }
  return {
    blob: bytesToBlob(bytes, 'application/pdf'),
    filename: baseName(file),
    summary: say(`${pct(original, bytes.byteLength)}% smaller, text is no longer selectable`, `${pct(original, bytes.byteLength)}% lebih kecil, teks tidak lagi boleh dipilih`),
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
  file: File, target: number, ms: boolean, say: Say, ctx: Parameters<FileRun>[2],
): ReturnType<FileRun> {
  const label = targetLabel(target / 1000);
  const underText = (size: number, extra = '') => (ms
    ? `Di bawah ${label}: ${exactBytes(size)}${extra}, teks masih boleh dipilih`
    : `Under ${label}: ${exactBytes(size)}${extra}, text still selectable`);

  if (file.size <= target) {
    ctx.onProgress(1);
    return { blob: file, filename: file.name, summary: underText(file.size) };
  }

  ctx.onProgress(0.05, say('Repacking', 'Memadatkan semula'));
  const lossless = await repack(await (await openPdf(file, say)).save({ useObjectStreams: true }));
  if (lossless.byteLength <= target) {
    ctx.onProgress(1);
    return { blob: bytesToBlob(lossless, 'application/pdf'), filename: baseName(file), summary: underText(lossless.byteLength) };
  }

  // Next, the images inside, stepping down quality then resolution. Text
  // and vector drawings are never touched on this path.
  const ladder: Array<[number, number]> = [[0.75, 1754], [0.6, 1754], [0.5, 1240], [0.4, 1000]];
  for (const [n, [q, side]] of ladder.entries()) {
    ctx.onProgress(0.1 + n * 0.08, say('Shrinking images to fit', 'Mengecilkan imej supaya muat'));
    const doc = await openPdf(file, say);
    const report = await shrinkImages(doc, { quality: q, maxSide: side });
    if (report.replaced === 0) break; // nothing left that images can give
    const bytes = await repack(await doc.save({ useObjectStreams: true }));
    if (bytes.byteLength <= target) {
      ctx.onProgress(1);
      const dpi = Math.round((side / 11.69));
      return {
        blob: bytesToBlob(bytes, 'application/pdf'),
        filename: baseName(file),
        summary: underText(bytes.byteLength, ms ? `, imej kira-kira ${dpi} dpi` : `, images at about ${dpi} dpi`),
      };
    }
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
        ? `Di bawah ${label}: ${exactBytes(fit.blob.size)}, halaman kini imej ${dpi} dpi, teks tidak boleh dipilih`
        : `Under ${label}: ${exactBytes(fit.blob.size)}, pages are now ${dpi} dpi images, text not selectable`)
      : (ms
        ? `Tidak dapat mencapai ${label} dan kekal boleh dibaca. Paling kecil: ${exactBytes(fit.blob.size)}. Cuba pisahkan PDF dahulu`
        : `Could not reach ${label} and stay readable. Smallest: ${exactBytes(fit.blob.size)}. Try splitting the PDF first`),
  };
}
