import { ToolError, type FileRun } from '../types';
import { decode, draw, toBlob, replaceExtension, formatOf, EXTENSION, type Encodable } from '../../lib/canvas';
import { fitToSize, kbToBytes, exactBytes, targetLabel } from '../../lib/fit-size';

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

/**
 * With a size target, PNG cannot help: it is lossless, so there is no quality
 * to trade. Anything that is not already JPG or WebP becomes JPG.
 */
function targetFormat(file: File, choice: string): Encodable {
  if (choice !== 'auto') return `image/${choice}` as Encodable;
  const own = formatOf(file);
  return own === 'image/webp' ? own : 'image/jpeg';
}

export const run: FileRun = async (files, opts, ctx) => {
  if (files.length === 0) throw new ToolError(opts.locale === 'ms' ? 'Tiada fail dipilih.' : 'No file selected.');
  const targetKb = Number(opts.target ?? 0);
  if (targetKb > 0) return toTarget(files, kbToBytes(targetKb), String(opts.format ?? 'auto'), opts.locale === 'ms', ctx);

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

/** Compress every file to land under `target` bytes. */
async function toTarget(
  files: File[], target: number, choice: string, ms: boolean,
  ctx: Parameters<FileRun>[2],
): ReturnType<FileRun> {
  const label = targetLabel(target / 1000);
  const out: { name: string; blob: Blob; line: string; fits: boolean }[] = [];

  for (const [i, file] of files.entries()) {
    const mime = targetFormat(file, choice);

    // Already small enough and already the right format: do not touch it.
    if (file.size <= target && formatOf(file) === mime) {
      out.push({
        name: file.name, blob: file, fits: true,
        line: ms ? `Sudah di bawah ${label}: ${exactBytes(file.size)}, asal dikekalkan` : `Already under ${label}: ${exactBytes(file.size)}, original kept`,
      });
      ctx.onProgress((i + 1) / files.length);
      continue;
    }

    const bitmap = await decode(file);
    const fit = await fitToSize(async (quality, scale) => {
      const w = Math.max(1, Math.round(bitmap.width * scale));
      const h = Math.max(1, Math.round(bitmap.height * scale));
      return toBlob(draw(bitmap, w, h, mime), mime, quality);
    }, target, {
      onAttempt: (_a, n) => ctx.onProgress((i + Math.min(0.95, n / 12)) / files.length, ms ? 'Mencari saiz terbaik' : 'Finding the best fit'),
    });
    const w = Math.round(bitmap.width * fit.scale);
    const h = Math.round(bitmap.height * fit.scale);
    const resized = fit.scale < 1 ? (ms ? `, dikecilkan ke ${w}×${h}` : `, resized to ${w}×${h}`) : '';
    bitmap.close();

    out.push({
      name: replaceExtension(file.name, EXTENSION[mime]),
      blob: fit.blob,
      fits: fit.fits,
      line: fit.fits
        ? (ms ? `Di bawah ${label}: ${exactBytes(fit.blob.size)}${resized}` : `Under ${label}: ${exactBytes(fit.blob.size)}${resized}`)
        : (ms ? `Tidak dapat mencapai ${label}. Paling kecil: ${exactBytes(fit.blob.size)}` : `Could not reach ${label}. Smallest possible: ${exactBytes(fit.blob.size)}`),
    });
    ctx.onProgress((i + 1) / files.length);
  }

  const first = out[0]!;
  if (out.length === 1) return { blob: first.blob, filename: first.name, summary: first.line };

  const missed = out.filter((o) => !o.fits).length;
  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();
  for (const o of out) zip.file(o.name, o.blob);
  return {
    blob: await zip.generateAsync({ type: 'blob' }),
    filename: 'compressed-images.zip',
    summary: missed === 0
      ? (ms ? `${out.length} imej, semuanya di bawah ${label}` : `${out.length} images, all under ${label}`)
      : (ms ? `${out.length} imej, ${missed} tidak dapat mencapai ${label}` : `${out.length} images, ${missed} could not reach ${label}`),
  };
}
