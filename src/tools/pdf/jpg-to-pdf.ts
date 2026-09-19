import { ToolError, type FileRun } from '../types';
import { bytesToBlob } from '../../lib/format';
import { decode, surface, toBlob } from '../../lib/canvas';
import { mmToPt } from '../../lib/pdf-geometry';
import { readExif } from '../image/metadata';
import { sayer } from '../say';

/** Page sizes in points. */
const PAGES: Record<string, [number, number]> = { a4: [595.28, 841.89], letter: [612, 792] };

/** The EXIF orientation of a JPEG, or 1 when it has none. */
export function jpegOrientation(b: Uint8Array): number {
  let i = 2;
  while (i + 4 < b.length && b[i] === 0xff) {
    const marker = b[i + 1]!;
    if (marker === 0xda) break;
    const len = (b[i + 2]! << 8) | b[i + 3]!;
    if (marker === 0xe1 && String.fromCharCode(...b.subarray(i + 4, i + 10)) === 'Exif\0\0') {
      return readExif(b.subarray(i + 10, i + 2 + len)).orientation;
    }
    i += 2 + len;
  }
  return 1;
}

/**
 * JPG and PNG go in untouched: pdf-lib embeds the original bytes, so there is
 * no second round of compression. Two cases are redrawn first: formats a PDF
 * cannot hold (WebP, GIF, BMP...), and JPEGs whose EXIF says "rotate me",
 * because a PDF ignores EXIF and the photo would land sideways.
 */
async function embeddable(file: File): Promise<{ kind: 'jpg' | 'png'; bytes: Uint8Array; width: number; height: number }> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8;
  const isPng = bytes[0] === 0x89 && bytes[1] === 0x50;
  const bitmap = await decode(file); // applies EXIF orientation

  if ((isJpeg && jpegOrientation(bytes) === 1) || isPng) {
    const out = { kind: isPng ? 'png' as const : 'jpg' as const, bytes, width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return out;
  }
  const canvas = surface(bitmap.width, bitmap.height);
  const c = canvas.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
  c.fillStyle = '#ffffff';
  c.fillRect(0, 0, bitmap.width, bitmap.height);
  c.drawImage(bitmap, 0, 0);
  const jpeg = await toBlob(canvas, 'image/jpeg', 0.92);
  const out = { kind: 'jpg' as const, bytes: new Uint8Array(await jpeg.arrayBuffer()), width: bitmap.width, height: bitmap.height };
  bitmap.close();
  return out;
}

export const run: FileRun = async (files, opts, ctx) => {
  const say = sayer(opts);
  if (files.length === 0) throw new ToolError(say('No file selected.', 'Tiada fail dipilih.'));
  const { PDFDocument } = await import('pdf-lib');
  const doc = await PDFDocument.create();
  const size = String(opts.page ?? 'a4');
  const orientation = String(opts.orientation ?? 'auto');
  const margin = mmToPt(Number(opts.margin ?? 0));

  for (const [i, file] of files.entries()) {
    const img = await embeddable(file);
    const embedded = img.kind === 'png' ? await doc.embedPng(img.bytes) : await doc.embedJpg(img.bytes);

    let pageW: number;
    let pageH: number;
    if (size === 'fit') {
      // One pixel = one point (72 dpi): the page is the photo, plus any margin.
      pageW = img.width + margin * 2;
      pageH = img.height + margin * 2;
    } else {
      const [w, h] = PAGES[size] ?? PAGES.a4!;
      const landscape = orientation === 'landscape' || (orientation === 'auto' && img.width > img.height);
      [pageW, pageH] = landscape ? [h, w] : [w, h];
    }

    // Fit inside the margins, never enlarge past the image's own size in
    // points, and centre.
    const boxW = pageW - margin * 2;
    const boxH = pageH - margin * 2;
    const scale = Math.min(boxW / img.width, boxH / img.height, size === 'fit' ? 1 : Infinity);
    const w = img.width * scale;
    const h = img.height * scale;
    doc.addPage([pageW, pageH]).drawImage(embedded, { x: (pageW - w) / 2, y: (pageH - h) / 2, width: w, height: h });
    ctx.onProgress((i + 1) / files.length);
  }

  const name = files.length === 1 ? files[0]!.name.replace(/\.[^.]+$/, '') + '.pdf' : 'images.pdf';
  return {
    blob: bytesToBlob(await doc.save(), 'application/pdf'),
    filename: name,
    summary: say(`${files.length} image${files.length === 1 ? '' : 's'} → ${files.length} page${files.length === 1 ? '' : 's'}`, `${files.length} imej → ${files.length} halaman`),
  };
};
