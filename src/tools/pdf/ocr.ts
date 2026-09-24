import { ToolError, type FileRun } from '../types';
import { bytesToBlob } from '../../lib/format';
import { isOcrLanguage, recognize } from '../../lib/ocr';
import { loadDocument } from '../../lib/pdfjs';
import { normalizeRotation, uprightAnchor, visualSize } from '../../lib/pdf-geometry';
import { sayer } from '../say';
import { openPdf, stem } from './load';

/** Pages are read at about 300 dpi, Tesseract's sweet spot, within a pixel budget. */
const DPI = 300;
const MAX_SIDE = 4200;

/**
 * Make a scanned PDF searchable. Each page is drawn, read by Tesseract, and
 * the words are laid over the ORIGINAL page as invisible text, the way
 * scanners do it. The page itself is never re-encoded, so it looks and
 * weighs the same; you can now select, copy and search it.
 */
export const run: FileRun = async (files, opts, ctx) => {
  const say = sayer(opts);
  const file = files[0];
  if (!file) throw new ToolError(say('No file selected.', 'Tiada fail dipilih.'));
  const lang = isOcrLanguage(opts.language) ? opts.language : 'eng+msa';
  const skipText = opts.skipText !== false;

  const view = await loadDocument(file, say);
  const doc = await openPdf(file, say);
  const { degrees } = await import('pdf-lib');
  const pages = doc.getPages();

  const texts: string[] = [];
  let read = 0;
  let skipped = 0;
  let confidence = 0;
  let words = 0;
  for (let i = 0; i < pages.length; i++) {
    const tick = (f: number, label: string) => ctx.onProgress((i + f) / pages.length, label);
    const src = await view.getPage(i + 1);
    const existing = (await src.getTextContent()).items.map((it) => ('str' in it ? it.str : '')).join('').trim();
    if (skipText && existing.length > 20) {
      texts.push(`--- ${say('Page', 'Halaman')} ${i + 1} ---\n\n${say('(already had text, left as it was)', '(sudah ada teks, dibiarkan)')}`);
      skipped++;
      continue;
    }

    const base = src.getViewport({ scale: 1 });
    const scale = Math.min(DPI / 72, MAX_SIDE / Math.max(base.width, base.height));
    const viewport = src.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const c = canvas.getContext('2d')!;
    c.fillStyle = '#ffffff';
    c.fillRect(0, 0, canvas.width, canvas.height);
    await src.render({ canvas, canvasContext: c, viewport }).promise;
    src.cleanup();

    const result = await recognize(canvas, lang, {
      pdf: 'text',
      onProgress: (f, status) => tick(status.startsWith('recognizing') ? f : 0,
        status.startsWith('recognizing') ? say(`Reading page ${i + 1} of ${pages.length}`, `Membaca halaman ${i + 1} daripada ${pages.length}`) : say('Loading the OCR engine (once)', 'Memuatkan enjin OCR (sekali)')),
    });
    canvas.width = canvas.height = 0;
    texts.push(`--- ${say('Page', 'Halaman')} ${i + 1} ---\n\n${result.text}`);
    confidence += result.confidence * result.words;
    words += result.words;
    read++;
    if (!result.pdf || result.words === 0) continue;

    // Lay the invisible text over the page as the reader sees it, mapped into
    // the page's own space so sideways-stored scans line up too.
    const page = pages[i]!;
    const [layer] = await doc.embedPdf(result.pdf);
    const box = page.getCropBox();
    const rotation = normalizeRotation(page.getRotation().angle);
    const { width: vw, height: vh } = visualSize(box, rotation);
    const at = uprightAnchor(0, vh, box, rotation);
    page.drawPage(layer!, { x: at.x, y: at.y, xScale: vw / layer!.width, yScale: vh / layer!.height, rotate: degrees(at.rotate) });
  }

  if (read === 0) {
    throw new ToolError(say(
      'Every page already has text, so there was nothing to read. It is searchable as it is.',
      'Setiap halaman sudah ada teks, jadi tiada apa-apa untuk dibaca. Ia sudah boleh dicari.',
    ));
  }
  const accuracy = words ? Math.round(confidence / words) : 0;
  const summary = [
    say(`${read} page${read === 1 ? '' : 's'} read`, `${read} halaman dibaca`),
    skipped ? say(`${skipped} already had text`, `${skipped} sudah ada teks`) : '',
    say(`${words.toLocaleString()} words · ${accuracy}% confidence`, `${words.toLocaleString()} perkataan · keyakinan ${accuracy}%`),
  ].filter(Boolean).join(' · ');

  return {
    blob: bytesToBlob(await doc.save(), 'application/pdf'),
    filename: `${stem(file)}-searchable.pdf`,
    summary,
    text: texts.join('\n\n'),
  };
};
