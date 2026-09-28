import { ToolError, type FileRun } from '../types';
import { bytesToBlob } from '../../lib/format';
import { isOcrLanguage, prepareImage, recognizeUpright, turnCanvas, type Turn } from '../../lib/ocr';
import { sayer } from '../say';

/**
 * Image to text. Each image is read by Tesseract on the device; the result
 * is plain text, or a searchable PDF with the picture and an invisible text
 * layer you can select and search.
 */
/** The long side of an A4 page, in points. */
const A4_LONG = 841.89;
/** The photo kept in a searchable PDF: sharp at full-page zoom, not 12 MP. */
const PDF_PHOTO_SIDE = 3000;

export const run: FileRun = async (files, opts, ctx) => {
  const say = sayer(opts);
  if (files.length === 0) throw new ToolError(say('No file selected.', 'Tiada fail dipilih.'));
  const lang = isOcrLanguage(opts.language) ? opts.language : 'eng+msa';
  const asPdf = opts.output === 'pdf';

  const texts: string[] = [];
  const pages: Array<{ layer: Uint8Array; file: File; turned: Turn }> = [];
  let confidence = 0;
  let words = 0;
  for (const [i, file] of files.entries()) {
    let canvas: HTMLCanvasElement;
    try {
      canvas = await prepareImage(file);
    } catch {
      throw new ToolError(say(`"${file.name}" could not be opened as an image.`, `"${file.name}" tidak dapat dibuka sebagai imej.`));
    }
    // A photo taken sideways, or a scan fed in upside down, is read the way
    // it reads; with 'Save as PDF' the picture is turned upright too.
    const page = await recognizeUpright(canvas, lang, {
      pdf: asPdf ? 'text' : undefined,
      onProgress: (f, status) => ctx.onProgress(
        (i + (status.startsWith('recognizing') ? f : 0)) / files.length,
        status.startsWith('recognizing') ? say('Reading text', 'Membaca teks') : say('Loading the OCR engine (once)', 'Memuatkan enjin OCR (sekali)'),
      ),
    });
    texts.push(files.length > 1 ? `--- ${file.name} ---\n\n${page.text}` : page.text);
    if (page.pdf && page.words) pages.push({ layer: page.pdf, file, turned: page.turned });
    confidence += page.confidence * page.words;
    words += page.words;
  }

  const text = texts.join('\n\n');
  if (!words) {
    throw new ToolError(say(
      'No text was found. Check the language, and try a sharper, straighter photo with the text filling more of the frame.',
      'Tiada teks ditemui. Semak bahasa, dan cuba gambar yang lebih jelas dan lurus dengan teks memenuhi lebih banyak bingkai.',
    ));
  }
  const accuracy = Math.round(confidence / words);
  const summary = say(`${words.toLocaleString()} words, ${accuracy}% confidence`, `${words.toLocaleString()} perkataan, keyakinan ${accuracy}%`);
  const base = files.length === 1 ? files[0]!.name.replace(/\.[^.]+$/, '') : 'ocr';

  if (asPdf) {
    // The picture on each page is the ORIGINAL photo, in colour and at full
    // size, not the grey copy Tesseract read; the invisible text layer is
    // stretched over it. Turned the same way the reading was, so a sideways
    // photo comes out upright and its text lines up.
    const { PDFDocument } = await import('pdf-lib');
    const out = await PDFDocument.create();
    for (const { layer, file, turned } of pages) {
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
      const k = Math.min(1, PDF_PHOTO_SIDE / Math.max(bitmap.width, bitmap.height));
      const flat = document.createElement('canvas');
      flat.width = Math.round(bitmap.width * k);
      flat.height = Math.round(bitmap.height * k);
      const c = flat.getContext('2d')!;
      c.fillStyle = '#ffffff';
      c.fillRect(0, 0, flat.width, flat.height);
      c.drawImage(bitmap, 0, 0, flat.width, flat.height);
      bitmap.close();
      const upright = turnCanvas(flat, turned);
      const jpeg = await new Promise<Blob | null>((r) => upright.toBlob(r, 'image/jpeg', 0.9));
      if (!jpeg) continue;
      const image = await out.embedJpg(await jpeg.arrayBuffer());
      // The long side becomes an A4 long side, so a phone photo of a page
      // prints and zooms like a page.
      const pt = A4_LONG / Math.max(upright.width, upright.height);
      const w = upright.width * pt;
      const h = upright.height * pt;
      const sheet = out.addPage([w, h]);
      sheet.drawImage(image, { x: 0, y: 0, width: w, height: h });
      const [text] = await out.embedPdf(layer);
      sheet.drawPage(text!, { x: 0, y: 0, xScale: w / text!.width, yScale: h / text!.height });
    }
    return { blob: bytesToBlob(await out.save(), 'application/pdf'), filename: `${base}-searchable.pdf`, summary, text };
  }
  return { blob: new Blob([text], { type: 'text/plain;charset=utf-8' }), filename: `${base}.txt`, summary, text };
};
