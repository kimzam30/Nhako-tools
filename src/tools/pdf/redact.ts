import { ToolError, type FileRun } from '../types';
import { bytesToBlob } from '../../lib/format';
import { loadDocument } from '../../lib/pdfjs';
import { surface, toBlob } from '../../lib/canvas';
import { sayer } from '../say';
import { openPdf } from './load';
import { EMAIL_PATTERN, IC_PATTERN, PHONE_PATTERN, findBoxes, termPatterns, type Box, type TextItem } from './redact-match';

/**
 * Redact PDF: black out words, IC numbers, phone numbers and emails so they
 * are gone, not just covered.
 *
 * A black rectangle drawn over text leaves the text underneath, selectable and
 * searchable, which is how most "redacted" PDFs leak. So every page with a
 * match is rendered to an image, the boxes are burned into the pixels, and the
 * page is replaced by that image. Pages without a match are copied across
 * unchanged. The result is a new document, so the original's metadata (title,
 * author, subject, keywords), which often repeats the very name being hidden,
 * is not carried over.
 */

type PdfJsDoc = Awaited<ReturnType<typeof loadDocument>>;

async function pageItems(doc: PdfJsDoc, n: number): Promise<TextItem[]> {
  const page = await doc.getPage(n);
  const content = await page.getTextContent();
  const items: TextItem[] = [];
  for (const raw of content.items) {
    if (!('str' in raw)) continue;
    const [, , c, d, e, f] = raw.transform as number[];
    items.push({ str: raw.str, x: e!, y: f!, width: raw.width, height: Math.hypot(c!, d!) || raw.height || 10, eol: raw.hasEOL });
  }
  page.cleanup();
  return items;
}

export const run: FileRun = async (files, opts, ctx) => {
  const say = sayer(opts);
  const file = files[0];
  if (!file) throw new ToolError(say('No file selected.', 'Tiada fail dipilih.'));

  const patterns = [
    ...termPatterns(String(opts.terms ?? '')),
    ...(opts.ic ? [IC_PATTERN] : []),
    ...(opts.phone ? [PHONE_PATTERN] : []),
    ...(opts.email ? [EMAIL_PATTERN] : []),
  ];
  if (!patterns.length) {
    throw new ToolError(say(
      'Type the words to black out, or tick IC numbers, phone numbers or emails.',
      'Taip perkataan untuk dihitamkan, atau tandakan nombor IC, nombor telefon atau e-mel.',
    ));
  }
  const dpi = Number(opts.dpi ?? 150);

  // Proportional widths for placing boxes inside a line of text (see Measure).
  const ruler = surface(1, 1).getContext('2d') as CanvasRenderingContext2D | null;
  if (ruler) ruler.font = '100px Helvetica, Arial, sans-serif';
  const measure = ruler ? (t: string) => ruler.measureText(t).width : undefined;

  const source = await loadDocument(file, say);
  const hits = new Map<number, Box[]>();
  let matches = 0;
  let anyText = false;
  for (let n = 1; n <= source.numPages; n++) {
    const items = await pageItems(source, n);
    if (items.some((it) => it.str.trim())) anyText = true;
    const found = findBoxes(items, patterns, measure);
    if (found.boxes.length) hits.set(n, found.boxes);
    matches += found.matches;
    ctx.onProgress((n / source.numPages) * 0.4, say(`Searching page ${n} of ${source.numPages}`, `Mencari halaman ${n} daripada ${source.numPages}`));
  }

  if (!anyText) {
    throw new ToolError(say(
      'This PDF has no text to search: it is probably a scan. Run OCR PDF on it first, then redact the result.',
      'PDF ini tiada teks untuk dicari: ia mungkin imbasan. Jalankan OCR PDF dahulu, kemudian hitamkan hasilnya.',
    ));
  }
  if (!hits.size) {
    throw new ToolError(say(
      'Nothing matched, so nothing was blacked out. Check the spelling, or try fewer words.',
      'Tiada padanan, jadi tiada apa yang dihitamkan. Semak ejaan, atau cuba kurangkan perkataan.',
    ));
  }

  // A fresh document, not the original with pages swapped: pdf-lib writes
  // every object it holds, so a removed page's text would still be in the
  // file. copyPages brings across only what the kept pages reference.
  const { PDFDocument } = await import('pdf-lib');
  const original = await openPdf(file, say);
  const out = await PDFDocument.create();
  const pages = [...hits.keys()];
  const flatPages = new Map<number, Uint8Array>();
  const sizes = new Map<number, [number, number]>();
  for (const [k, n] of pages.entries()) {
    const page = await source.getPage(n);
    const natural = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: dpi / 72 });
    const canvas = surface(Math.max(1, Math.ceil(viewport.width)), Math.max(1, Math.ceil(viewport.height)));
    const c2d = canvas.getContext('2d') as CanvasRenderingContext2D | null;
    if (!c2d) throw new ToolError(say('Could not get a drawing context.', 'Tidak dapat memperoleh konteks lukisan.'));
    c2d.fillStyle = '#fff';
    c2d.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvas: canvas as HTMLCanvasElement, canvasContext: c2d, viewport }).promise;
    c2d.fillStyle = '#000';
    for (const box of hits.get(n)!) {
      const [x0, y0, x1, y1] = viewport.convertToViewportRectangle(box);
      c2d.fillRect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0));
    }
    page.cleanup();
    const jpeg = await toBlob(canvas, 'image/jpeg', 0.9);
    flatPages.set(n, new Uint8Array(await jpeg.arrayBuffer()));
    sizes.set(n, [natural.width, natural.height]);
    canvas.width = 0; canvas.height = 0;
    ctx.onProgress(0.4 + ((k + 1) / pages.length) * 0.5, say(`Blacking out page ${n}`, `Menghitamkan halaman ${n}`));
  }
  void source.destroy();

  const kept = original.getPageIndices().filter((i) => !flatPages.has(i + 1));
  const copied = await out.copyPages(original, kept);
  let next = 0;
  for (let n = 1; n <= original.getPageCount(); n++) {
    const jpeg = flatPages.get(n);
    if (!jpeg) { out.addPage(copied[next++]!); continue; }
    const [w, h] = sizes.get(n)!;
    const image = await out.embedJpg(jpeg);
    out.addPage([w, h]).drawImage(image, { x: 0, y: 0, width: w, height: h });
  }

  out.setProducer('Nhako Tools'); out.setCreator('Nhako Tools');
  ctx.onProgress(1);

  return {
    blob: bytesToBlob(await out.save({ useObjectStreams: true }), 'application/pdf'),
    filename: file.name.replace(/\.pdf$/i, '') + '-redacted.pdf',
    summary: say(
      `${matches} match${matches === 1 ? '' : 'es'} blacked out on ${pages.length} page${pages.length === 1 ? '' : 's'}; those pages are now images, the rest are unchanged`,
      `${matches} padanan dihitamkan pada ${pages.length} halaman; halaman itu kini imej, selebihnya tidak berubah`,
    ),
  };
};
