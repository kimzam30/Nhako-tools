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
    pdf: data.pdf ? new Uint8Array(data.pdf) : undefined,
  };
}

/** Tesseract ends lines with trailing spaces and pads with blank lines. */
export function tidy(text: string): string {
  return text.replace(/[ \t]+$/gm, '').replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * An image as Tesseract reads it best: turned the way the camera held it
 * (Tesseract itself ignores the EXIF orientation of phone photos), and
 * enlarged when small, since text under about 20 px tall is read badly.
 */
export async function prepareImage(file: Blob): Promise<HTMLCanvasElement> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const scale = Math.max(bitmap.width, bitmap.height) < 1600 ? 2 : 1;
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width * scale;
  canvas.height = bitmap.height * scale;
  const c = canvas.getContext('2d')!;
  c.fillStyle = '#ffffff';
  c.fillRect(0, 0, canvas.width, canvas.height);
  c.imageSmoothingQuality = 'high';
  c.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas;
}
