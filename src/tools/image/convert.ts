import { ToolError, type FileRun } from '../types';
import { decode, draw, toBlob, replaceExtension, EXTENSION, type Encodable } from '../../lib/canvas';

export const run: FileRun = async (files, opts, ctx) => {
  if (files.length === 0) throw new ToolError('No file selected.');
  const mime = `image/${String(opts.format ?? 'webp')}` as Encodable;
  const quality = mime === 'image/png' ? undefined : Number(opts.quality ?? 85) / 100;

  const converted: { name: string; blob: Blob }[] = [];
  for (const [i, file] of files.entries()) {
    const bitmap = await decode(file);
    const blob = await toBlob(draw(bitmap, bitmap.width, bitmap.height), mime, quality);
    bitmap.close();
    converted.push({ name: replaceExtension(file.name, EXTENSION[mime]), blob });
    ctx.onProgress((i + 1) / files.length);
  }

  const first = converted[0]!;
  if (converted.length === 1) {
    return { blob: first.blob, filename: first.name, summary: `Converted to ${EXTENSION[mime].toUpperCase()}` };
  }

  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();
  for (const c of converted) zip.file(c.name, c.blob);
  return {
    blob: await zip.generateAsync({ type: 'blob' }),
    filename: `converted-${EXTENSION[mime]}.zip`,
    summary: `${converted.length} images converted to ${EXTENSION[mime].toUpperCase()}`,
  };
};
