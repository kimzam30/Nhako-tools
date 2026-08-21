import { ToolError, type FileRun } from '../types';
import { decode, draw, toBlob, EXTENSION, replaceExtension, type Encodable } from '../../lib/canvas';

/** Work out the output size, preserving aspect ratio when one axis is 0. */
export function targetSize(
  natural: { width: number; height: number },
  want: { width: number; height: number },
  noUpscale: boolean,
): { width: number; height: number } {
  let { width, height } = want;
  if (width <= 0 && height <= 0) throw new ToolError('Set a width or a height.');
  if (width <= 0) width = Math.round((height / natural.height) * natural.width);
  if (height <= 0) height = Math.round((width / natural.width) * natural.height);
  if (noUpscale && width > natural.width && height > natural.height) {
    return { width: natural.width, height: natural.height };
  }
  return { width: Math.max(1, width), height: Math.max(1, height) };
}

export const run: FileRun = async (files, opts, ctx) => {
  if (files.length === 0) throw new ToolError('No file selected.');
  const want = { width: Number(opts.width ?? 0), height: Number(opts.height ?? 0) };
  const noUpscale = opts.noUpscale !== false;

  const out: { name: string; blob: Blob }[] = [];
  let lastSize = { width: 0, height: 0 };

  for (const [i, file] of files.entries()) {
    const bitmap = await decode(file);
    const size = targetSize(bitmap, want, noUpscale);
    lastSize = size;
    const mime: Encodable = file.type === 'image/png' ? 'image/png' : file.type === 'image/webp' ? 'image/webp' : 'image/jpeg';
    const blob = await toBlob(draw(bitmap, size.width, size.height), mime, 0.9);
    bitmap.close();
    out.push({ name: replaceExtension(file.name, EXTENSION[mime]), blob });
    ctx.onProgress((i + 1) / files.length);
  }

  const first = out[0]!;
  if (out.length === 1) {
    return { blob: first.blob, filename: first.name, summary: `${lastSize.width} × ${lastSize.height}` };
  }

  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();
  for (const o of out) zip.file(o.name, o.blob);
  return { blob: await zip.generateAsync({ type: 'blob' }), filename: 'resized-images.zip', summary: `${out.length} images resized` };
};
