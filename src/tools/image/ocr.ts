import { ToolError, type FileRun } from '../types';
import { bytesToBlob } from '../../lib/format';
import { isOcrLanguage, prepareImage, recognize } from '../../lib/ocr';
import { sayer } from '../say';

/**
 * Image to text. Each image is read by Tesseract on the device; the result
 * is plain text, or a searchable PDF with the picture and an invisible text
 * layer you can select and search.
 */
export const run: FileRun = async (files, opts, ctx) => {
  const say = sayer(opts);
  if (files.length === 0) throw new ToolError(say('No file selected.', 'Tiada fail dipilih.'));
  const lang = isOcrLanguage(opts.language) ? opts.language : 'eng+msa';
  const asPdf = opts.output === 'pdf';

  const texts: string[] = [];
  const pages: Uint8Array[] = [];
  let confidence = 0;
  let words = 0;
  for (const [i, file] of files.entries()) {
    let canvas: HTMLCanvasElement;
    try {
      canvas = await prepareImage(file);
    } catch {
      throw new ToolError(say(`"${file.name}" could not be opened as an image.`, `"${file.name}" tidak dapat dibuka sebagai imej.`));
    }
    const page = await recognize(canvas, lang, {
      pdf: asPdf ? 'image' : undefined,
      onProgress: (f, status) => ctx.onProgress(
        (i + (status.startsWith('recognizing') ? f : 0)) / files.length,
        status.startsWith('recognizing') ? say('Reading text', 'Membaca teks') : say('Loading the OCR engine (once)', 'Memuatkan enjin OCR (sekali)'),
      ),
    });
    texts.push(files.length > 1 ? `--- ${file.name} ---\n\n${page.text}` : page.text);
    if (page.pdf) pages.push(page.pdf);
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
  const summary = say(`${words.toLocaleString()} words · ${accuracy}% confidence`, `${words.toLocaleString()} perkataan · keyakinan ${accuracy}%`);
  const base = files.length === 1 ? files[0]!.name.replace(/\.[^.]+$/, '') : 'ocr';

  if (asPdf) {
    const { PDFDocument } = await import('pdf-lib');
    const out = await PDFDocument.create();
    for (const bytes of pages) {
      const src = await PDFDocument.load(bytes);
      for (const p of await out.copyPages(src, src.getPageIndices())) out.addPage(p);
    }
    return { blob: bytesToBlob(await out.save(), 'application/pdf'), filename: `${base}-searchable.pdf`, summary, text };
  }
  return { blob: new Blob([text], { type: 'text/plain;charset=utf-8' }), filename: `${base}.txt`, summary, text };
};
