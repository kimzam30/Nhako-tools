/**
 * Optical character recognition with Tesseract (tesseract.js, Apache-2.0),
 * entirely on the device. The worker, the WebAssembly core and the English
 * and Malay models are all served from this site (scripts/vendor.mjs):
 * tesseract.js would otherwise fetch every one of them from jsDelivr.
 */
import type { Worker as TesseractWorker, LoggerMessage } from 'tesseract.js';

export type OcrLanguage = 'eng' | 'msa' | 'eng+msa';
export const OCR_LANGUAGES: readonly OcrLanguage[] = ['eng+msa', 'eng', 'msa'];

export const isOcrLanguage = (v: unknown): v is OcrLanguage => OCR_LANGUAGES.includes(v as OcrLanguage);

let current: { lang: OcrLanguage; worker: Promise<TesseractWorker> } | null = null;
let report: ((fraction: number, status: string) => void) | null = null;

/**
 * One worker, kept between runs so a second image skips the start-up. A run
 * in another language swaps its models rather than starting a new worker.
 */
export async function ocrWorker(lang: OcrLanguage, onProgress?: (fraction: number, status: string) => void): Promise<TesseractWorker> {
  report = onProgress ?? null;
  if (current?.lang === lang) return current.worker;
  if (current) {
    const worker = await current.worker.catch(() => null);
    if (worker) {
      const next = worker.reinitialize(lang, 1).then(() => worker);
      current = { lang, worker: next };
      return next;
    }
  }
  const { createWorker, OEM } = await import('tesseract.js');
  const worker = createWorker(lang, OEM.LSTM_ONLY, {
    workerPath: `${__TESSERACT_BASE__}worker.min.js`,
    corePath: __TESSERACT_BASE__,
    langPath: __TESSDATA_BASE__.replace(/\/$/, ''),
    gzip: true,
    // The service worker already caches /vendor/ files; a second copy in
    // IndexedDB would only double the storage.
    cacheMethod: 'none',
    workerBlobURL: false,
    logger: (m: LoggerMessage) => report?.(m.progress, m.status),
  });
  current = { lang, worker };
  worker.catch(() => { if (current?.worker === worker) current = null; });
  return worker;
}

export interface OcrPage {
  text: string;
  /** Mean word confidence, 0 to 100. */
  confidence: number;
  words: number;
  /**
   * Words read with over 80% confidence that look like words (three or more
   * letters). Noise read from a sideways page scores 0 to 9 on this; the same
   * page upright scores in the hundreds, so it tells the turns apart far more
   * sharply than mean confidence does.
   */
  strong: number;
  /**
   * A one-page PDF, if asked for: the image with an invisible text layer
   * ('image'), or the invisible text alone to lay over another page ('text').
   */
  pdf?: Uint8Array;
}

/** Recognise one image (anything tesseract.js accepts: a canvas, a Blob). */
export async function recognize(
  image: HTMLCanvasElement | OffscreenCanvas | Blob,
  lang: OcrLanguage,
  opts: { pdf?: 'image' | 'text'; onProgress?: (fraction: number, status: string) => void } = {},
): Promise<OcrPage> {
  const worker = await ocrWorker(lang, opts.onProgress);
  const input = image instanceof OffscreenCanvas ? await image.convertToBlob({ type: 'image/png' }) : image;
  const { data } = await worker.recognize(input as HTMLCanvasElement | Blob, { pdfTitle: 'OCR', pdfTextOnly: opts.pdf === 'text' }, { text: true, blocks: true, pdf: Boolean(opts.pdf) });
  const words = (data.blocks ?? []).flatMap((b) => b.paragraphs.flatMap((p) => p.lines.flatMap((l) => l.words)));
  const confidence = words.length ? words.reduce((a, w) => a + w.confidence, 0) / words.length : 0;
  return {
    text: tidy(data.text ?? ''),
    confidence,
    words: words.length,
    strong: words.filter((w) => w.confidence > 80 && /\p{L}{3,}/u.test(w.text)).length,
    pdf: data.pdf ? new Uint8Array(data.pdf) : undefined,
  };
}

export type Turn = 0 | 90 | 180 | 270;

/**
 * Below this mean confidence a page is checked for lying sideways. A sheet
 * fed into a scanner the wrong way round reads as noise at 20 to 50%, and
 * upright print reads at 80 or more, so the gap is wide.
 */
const UPRIGHT_CONFIDENCE = 65;
/** The most the orientation probe reads across: enough for print, a few times faster. */
const PROBE_SIDE = 1000;

/** A copy of `src` turned clockwise by `turn` degrees. */
export function turnCanvas(src: HTMLCanvasElement, turn: Turn): HTMLCanvasElement {
  if (turn === 0) return src;
  const out = document.createElement('canvas');
  const sideways = turn !== 180;
  out.width = sideways ? src.height : src.width;
  out.height = sideways ? src.width : src.height;
  const c = out.getContext('2d')!;
  c.translate(out.width / 2, out.height / 2);
  c.rotate((turn * Math.PI) / 180);
  c.drawImage(src, -src.width / 2, -src.height / 2);
  return out;
}

function shrink(src: HTMLCanvasElement, side: number): HTMLCanvasElement {
  const k = Math.min(1, side / Math.max(src.width, src.height));
  if (k === 1) return src;
  const out = document.createElement('canvas');
  out.width = Math.round(src.width * k);
  out.height = Math.round(src.height * k);
  const c = out.getContext('2d')!;
  c.imageSmoothingQuality = 'high';
  c.drawImage(src, 0, 0, out.width, out.height);
  return out;
}

/**
 * Recognise a page the way it reads, not the way it was scanned.
 *
 * Tesseract reads only upright text, and its own orientation detector needs
 * the 10 MB legacy model, so a sideways or upside-down scan used to come back
 * as confident-looking garbage. This reads the page as given first; only if
 * that reads badly does it try the three other quarter turns on a small crop,
 * and it re-reads at full size only when a turn is clearly better. Upright
 * pages, the vast majority, cost nothing extra: reading small first was tried
 * and measured, and it made a 5-page upright scan 70% slower (37 s to 63 s).
 *
 * `turned` is how far the image was turned clockwise to read it, so a caller
 * can turn the page the same way (Acrobat and OCRmyPDF both straighten the
 * page itself, not just the text).
 */
export async function recognizeUpright(
  canvas: HTMLCanvasElement,
  lang: OcrLanguage,
  opts: { pdf?: 'image' | 'text'; onProgress?: (fraction: number, status: string) => void; onProbe?: () => void } = {},
): Promise<OcrPage & { turned: Turn; canvas: HTMLCanvasElement }> {
  const first = await recognize(canvas, lang, opts);
  if (first.confidence >= UPRIGHT_CONFIDENCE && first.words > 0) return { ...first, turned: 0, canvas };

  // The probe reads a square from the middle of the page, at most PROBE_SIDE
  // across: square so every turn sees the same text, central because that is
  // where body text almost always is. All four turns read the SAME crop, so
  // they are compared like for like. Measured on OCRmyPDF's rotated-scan
  // sample, whole-page probes cost 7 to 16 s per turn, because Tesseract
  // grinds on noise; a crop costs about 2.
  opts.onProbe?.();
  const probe = shrink(centreSquare(canvas, 0.6), PROBE_SIDE);
  const reads: Array<{ turn: Turn; strong: number; confidence: number }> = [];
  for (const turn of [0, 90, 180, 270] as const) {
    const read = await recognize(turnCanvas(probe, turn), lang);
    reads.push({ turn, strong: read.strong, confidence: read.confidence });
    if (turn !== 0 && read.strong >= 20) break; // unmistakably upright: stop here
  }
  // Judged on confidently read words, not mean confidence. On a sideways
  // receipt the right turn read 62% against 49% as it lay, too close to call,
  // but 4 real words against 0; on sideways scans, 177 against 0.
  const asIs = reads[0]!;
  const best = reads.reduce((a, b) => (b.strong > a.strong ? b : a));
  if (best.turn === 0 || best.strong < 3 || best.strong < asIs.strong * 2 + 2 || best.confidence <= asIs.confidence) {
    return { ...first, turned: 0, canvas };
  }

  const upright = turnCanvas(canvas, best.turn);
  const again = await recognize(upright, lang, opts);
  return again.confidence > first.confidence
    ? { ...again, turned: best.turn, canvas: upright }
    : { ...first, turned: 0, canvas };
}

/** The centred square covering `fraction` of the shorter side. */
function centreSquare(src: HTMLCanvasElement, fraction: number): HTMLCanvasElement {
  const side = Math.round(Math.min(src.width, src.height) * fraction);
  const out = document.createElement('canvas');
  out.width = out.height = side;
  out.getContext('2d')!.drawImage(src, (src.width - side) / 2, (src.height - side) / 2, side, side, 0, 0, side, side);
  return out;
}

/** Tesseract ends lines with trailing spaces and pads with blank lines. */
export function tidy(text: string): string {
  return text.replace(/[ \t]+$/gm, '').replace(/\n{3,}/g, '\n\n').trim();
}

/** Photos are read at most this long on their longest side. */
const PHOTO_SIDE = 1800;

/**
 * An image as Tesseract reads it best, measured on a real receipt photo
 * (Wikimedia "ReceiptSwiss", 2448 x 3264, on a wooden table):
 *
 * - Turned the way the camera held it: Tesseract ignores EXIF orientation.
 * - Grey. Fed in colour, the wood grain was read as 322 "words" at 31%
 *   confidence and 4 of 7 key terms were found, in 7.1 s. Grey and capped at
 *   1600 to 1800 px, 6 or 7 were found in about a second; larger caps lost
 *   terms again (2400 px: 4), because big print gets too big for Tesseract.
 * - No longer side than PHOTO_SIDE. A dense 300 dpi paper page kept the same
 *   98.4% word recall at 1800 px as at full size, 28% faster.
 * - Enlarged when small, since text under about 20 px tall is read badly.
 */
export async function prepareImage(file: Blob): Promise<HTMLCanvasElement> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const long = Math.max(bitmap.width, bitmap.height);
  const scale = long < 1600 ? 2 : Math.min(1, PHOTO_SIDE / long);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const c = canvas.getContext('2d', { willReadFrequently: true })!;
  c.fillStyle = '#ffffff';
  c.fillRect(0, 0, canvas.width, canvas.height);
  c.imageSmoothingQuality = 'high';
  c.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  // Luma by hand rather than ctx.filter, which older Safari ignores.
  const img = c.getImageData(0, 0, canvas.width, canvas.height);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const y = (d[i]! * 2126 + d[i + 1]! * 7152 + d[i + 2]! * 722) / 10000;
    d[i] = d[i + 1] = d[i + 2] = y;
  }
  c.putImageData(img, 0, 0);
  return canvas;
}
