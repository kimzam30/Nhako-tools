import { ToolError, type FileRun } from '../types';
import { decode, draw, toBlob, replaceExtension, EXTENSION, type Encodable } from '../../lib/canvas';

export const run: FileRun = async (files, opts, ctx) => {
  if (files.length === 0) throw new ToolError('No file selected.');
  const quality = Number(opts.quality ?? 75) / 100;
  const choice = String(opts.format ?? 'auto');

  const encoded: { name: string; blob: Blob; before: number }[] = [];
  for (const [i, file] of files.entries()) {
    const bitmap = await decode(file);
    const mime: Encodable =
      choice === 'auto'
        ? (file.type === 'image/png' ? 'image/png' : file.type === 'image/webp' ? 'image/webp' : 'image/jpeg')
        : (`image/${choice}` as Encodable);
    const blob = await toBlob(draw(bitmap, bitmap.width, bitmap.height), mime, quality);
    bitmap.close();
    encoded.push({ name: replaceExtension(file.name, EXTENSION[mime]), blob, before: file.size });
    ctx.onProgress((i + 1) / files.length);
  }

  const before = encoded.reduce((n, e) => n + e.before, 0);
  const after = encoded.reduce((n, e) => n + e.blob.size, 0);
  const summary = `${Math.max(0, Math.round((1 - after / before) * 100))}% smaller`;

  const first = encoded[0]!;
  if (encoded.length === 1) return { blob: first.blob, filename: first.name, summary };

  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();
  for (const e of encoded) zip.file(e.name, e.blob);
  return {
    blob: await zip.generateAsync({ type: 'blob' }),
    filename: 'compressed-images.zip',
    summary: `${encoded.length} images · ${summary}`,
  };
};
