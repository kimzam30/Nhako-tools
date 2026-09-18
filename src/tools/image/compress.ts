import { ToolError, type FileRun } from '../types';
import { decode, draw, toBlob, replaceExtension, formatOf, EXTENSION, type Encodable } from '../../lib/canvas';

/**
 * Output format for "Keep original format".
 *
 * PNG stays PNG: it is lossless, so the browser's encoder ignores the quality
 * setting and usually writes a LARGER file than a PNG that was optimised
 * elsewhere. Formats a canvas cannot write (GIF, BMP, HEIC...) become JPG.
 */
function outputFormat(file: File, choice: string): Encodable {
  if (choice !== 'auto') return `image/${choice}` as Encodable;
  const own = formatOf(file);
  return own && own !== 'image/avif' ? own : 'image/jpeg';
}

export const run: FileRun = async (files, opts, ctx) => {
  if (files.length === 0) throw new ToolError('No file selected.');
  const quality = Number(opts.quality ?? 75) / 100;
  const choice = String(opts.format ?? 'auto');

  const encoded: { name: string; blob: Blob; before: number; kept: boolean }[] = [];
  for (const [i, file] of files.entries()) {
    const bitmap = await decode(file);
    const mime = outputFormat(file, choice);
    const blob = await toBlob(draw(bitmap, bitmap.width, bitmap.height, mime), mime, quality);
    bitmap.close();

    // A "compressed" file must never be bigger than what went in. When the
    // re-encode loses and the format is unchanged, hand back the original.
    const kept = formatOf(file) === mime && blob.size >= file.size;
    encoded.push({
      name: kept ? file.name : replaceExtension(file.name, EXTENSION[mime]),
      blob: kept ? file : blob,
      before: file.size,
      kept,
    });
    ctx.onProgress((i + 1) / files.length);
  }

  const before = encoded.reduce((n, e) => n + e.before, 0);
  const after = encoded.reduce((n, e) => n + e.blob.size, 0);
  const change = before ? Math.round((1 - after / before) * 100) : 0;
  const keptCount = encoded.filter((e) => e.kept).length;
  const pngKept = encoded.some((e) => e.kept && e.name.toLowerCase().endsWith('.png'));

  const parts = [
    change > 0 ? `${change}% smaller` : change < 0 ? `${-change}% larger` : 'Same size',
    ...(keptCount > 0
      ? [`${keptCount === encoded.length ? (encoded.length === 1 ? 'original' : 'originals') : `${keptCount} original${keptCount === 1 ? '' : 's'}`} kept, re-encoding was not smaller`]
      : []),
    ...(pngKept ? ['choose WebP to shrink PNGs'] : []),
  ];
  const summary = parts.join(' · ');

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
