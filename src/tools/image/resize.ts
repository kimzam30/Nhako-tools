import { ToolError, type FileRun } from '../types';
import { decode, draw, toBlob, EXTENSION, replaceExtension, formatOf, type Encodable } from '../../lib/canvas';

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
  // Never enlarge EITHER axis. Checking only "both larger" let an explicit
  // 2000 x 100 on a 1000 x 1000 image stretch the width to 2000.
  const fit = Math.min(natural.width / width, natural.height / height);
  if (noUpscale && fit < 1) {
    width = Math.round(width * fit);
    height = Math.round(height * fit);
  }
  return { width: Math.max(1, width), height: Math.max(1, height) };
}

export const run: FileRun = async (files, opts, ctx) => {
  if (files.length === 0) throw new ToolError('No file selected.');
  const want = { width: Number(opts.width ?? 0), height: Number(opts.height ?? 0) };
  const noUpscale = opts.noUpscale !== false;

  const out: { name: string; blob: Blob }[] = [];
  let lastSize = { width: 0, height: 0 };
  let untouched = 0;

  for (const [i, file] of files.entries()) {
    const bitmap = await decode(file);
    const size = targetSize(bitmap, want, noUpscale);
    lastSize = size;

    // "Never enlarge" promises to leave small images untouched, so they are
    // passed through byte for byte rather than re-encoded (which is lossy).
    if (size.width === bitmap.width && size.height === bitmap.height) {
      bitmap.close();
      out.push({ name: file.name, blob: file });
      untouched++;
    } else {
      const own = formatOf(file);
      const mime: Encodable = own && own !== 'image/avif' ? own : 'image/jpeg';
      const blob = await toBlob(draw(bitmap, size.width, size.height, mime), mime, 0.9);
      bitmap.close();
      out.push({ name: replaceExtension(file.name, EXTENSION[mime]), blob });
    }
    ctx.onProgress((i + 1) / files.length);
  }

  const first = out[0]!;
  if (out.length === 1) {
    return { blob: first.blob, filename: first.name, summary: untouched ? `Already ${lastSize.width} × ${lastSize.height}, left untouched` : `${lastSize.width} × ${lastSize.height}` };
  }

  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();
  for (const o of out) zip.file(o.name, o.blob);
  return { blob: await zip.generateAsync({ type: 'blob' }), filename: 'resized-images.zip', summary: `${out.length - untouched} images resized${untouched ? ` · ${untouched} already small enough, left untouched` : ''}` };
};
