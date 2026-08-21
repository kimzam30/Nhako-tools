import { ToolError, type FileRun } from '../types';
import { bytesToBlob } from '../../lib/format';
import { loadDocument } from '../../lib/pdfjs';
import { surface, toBlob } from '../../lib/canvas';

/**
 * Two genuinely different strategies, named honestly.
 *
 * The old build advertised "structural optimisation to shrink file size" but
 * only ever set `useObjectStreams: true`, which typically saves a few percent
 * and essentially nothing on image-heavy documents. That is kept as the
 * lossless mode, with realistic expectations stated in the registry, and a
 * mode that actually reduces size is offered alongside it.
 */
export const run: FileRun = async (files, opts, ctx) => {
  const file = files[0];
  if (!file) throw new ToolError('No file selected.');
  const { PDFDocument } = await import('pdf-lib');
  const original = file.size;

  if (opts.mode !== 'strong') {
    ctx.onProgress(0.3);
    let doc;
    try {
      doc = await PDFDocument.load(await file.arrayBuffer());
    } catch {
      throw new ToolError(`Could not read "${file.name}". If it is password-protected, unlock it first.`);
    }
    ctx.onProgress(0.7);
    const bytes = await doc.save({ useObjectStreams: true });
    ctx.onProgress(1);

    const saved = original - bytes.byteLength;
    return {
      blob: bytesToBlob(bytes, 'application/pdf'),
      filename: file.name.replace(/\.pdf$/i, '') + '-compressed.pdf',
      summary: saved > 0
        ? `${Math.round((saved / original) * 100)}% smaller, text still selectable`
        : 'Already optimally packed — try Strong mode for a real reduction',
    };
  }

  // Strong: render each page and re-encode it as a JPEG. Shrinks scans
  // dramatically; the cost is that text stops being selectable.
  const source = await loadDocument(file);
  const out = await PDFDocument.create();
  const quality = Number(opts.quality ?? 70) / 100;

  for (let i = 1; i <= source.numPages; i++) {
    const page = await source.getPage(i);
    const viewport = page.getViewport({ scale: 1.5 });
    const canvas = surface(Math.ceil(viewport.width), Math.ceil(viewport.height));
    const ctx2d = canvas.getContext('2d');
    if (!ctx2d) throw new ToolError('Could not get a drawing context.');

    await page.render({
      canvas: canvas as HTMLCanvasElement,
      canvasContext: ctx2d as CanvasRenderingContext2D,
      viewport,
    }).promise;

    const jpeg = await toBlob(canvas, 'image/jpeg', quality);
    const embedded = await out.embedJpg(await jpeg.arrayBuffer());
    const target = out.addPage([viewport.width, viewport.height]);
    target.drawImage(embedded, { x: 0, y: 0, width: viewport.width, height: viewport.height });
    ctx.onProgress(i / source.numPages);
  }

  const bytes = await out.save({ useObjectStreams: true });
  const saved = original - bytes.byteLength;

  return {
    blob: bytesToBlob(bytes, 'application/pdf'),
    filename: file.name.replace(/\.pdf$/i, '') + '-compressed.pdf',
    summary: saved > 0
      ? `${Math.round((saved / original) * 100)}% smaller · text is no longer selectable`
      : `No smaller than the original — this PDF was already efficient. Text is no longer selectable.`,
  };
};
