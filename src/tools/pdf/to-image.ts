import { ToolError, type FileRun } from '../types';
import { loadDocument } from '../../lib/pdfjs';
import { surface, toBlob, type Encodable } from '../../lib/canvas';

export const run: FileRun = async (files, opts, ctx) => {
  const file = files[0];
  if (!file) throw new ToolError('No file selected.');
  const JSZip = (await import('jszip')).default;

  const doc = await loadDocument(file);
  const scale = Number(opts.scale ?? 2);
  const format = String(opts.format ?? 'jpg');
  const mime: Encodable = format === 'png' ? 'image/png' : 'image/jpeg';
  const base = file.name.replace(/\.pdf$/i, '');
  const zip = new JSZip();

  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const viewport = page.getViewport({ scale });
    const canvas = surface(Math.ceil(viewport.width), Math.ceil(viewport.height));
    const ctx2d = canvas.getContext('2d');
    if (!ctx2d) throw new ToolError('Could not get a drawing context.');

    await page.render({
      canvas: canvas as HTMLCanvasElement,
      canvasContext: ctx2d as CanvasRenderingContext2D,
      viewport,
    }).promise;

    zip.file(`${base}-page-${i}.${format}`, await toBlob(canvas, mime, 0.92));
    ctx.onProgress(i / doc.numPages);
  }

  return {
    blob: await zip.generateAsync({ type: 'blob' }),
    filename: `${base}-${format}.zip`,
    summary: `${doc.numPages} page${doc.numPages === 1 ? '' : 's'} at ${scale * 72} dpi`,
  };
};
