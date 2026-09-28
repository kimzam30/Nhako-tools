import type * as PdfLib from 'pdf-lib';
import type { PDFDocument, PDFRawStream as RawStream, PDFRef } from 'pdf-lib';

/**
 * Recompress the photos and scans INSIDE a PDF, leaving text, fonts and
 * vector drawings exactly as they were.
 *
 * This is what "Recommended" compression means at iLovePDF, Smallpdf and
 * Acrobat, and what Ghostscript's /ebook preset does: nearly all of a large
 * PDF's weight is embedded images, usually stored far sharper than any screen
 * or printer shows them. Downsampling those to about 150 dpi and re-encoding
 * them as JPEG gets most of the saving of flattening the whole page, while
 * the text stays selectable, searchable and sharp at any zoom.
 *
 * Deliberately conservative about what it touches. An image is only replaced
 * when it is 8 bits per channel, RGB or grey, carries no /Decode array, is not
 * a stencil mask, and the new copy is at least 10% smaller. CMYK, indexed
 * palettes, 16-bit and JPX images are left alone rather than risk a colour
 * shift nobody asked for. A soft mask (transparency) is its own object and
 * keeps its own resolution, which the PDF spec allows.
 */

export interface ShrinkOptions {
  /** JPEG quality, 0 to 1. */
  quality: number;
  /** Longest side in pixels. 1754 is an A4 page at 150 dpi. */
  maxSide: number;
  onImage?: (done: number, total: number) => void;
}

export interface ShrinkReport { images: number; replaced: number; before: number; after: number }

/** Raw image streams smaller than this are not worth a decode and re-encode. */
const MIN_BYTES = 24 * 1024;

export async function shrinkImages(doc: PDFDocument, opts: ShrinkOptions): Promise<ShrinkReport> {
  const lib = await import('pdf-lib');
  const { PDFName, PDFRawStream, PDFArray, PDFDict, decodePDFRawStream } = lib;
  const { name, num } = readers(lib);

  const candidates: Array<[PDFRef, RawStream]> = [];
  for (const [ref, obj] of doc.context.enumerateIndirectObjects()) {
    if (!(obj instanceof PDFRawStream)) continue;
    if (name(obj.dict.get(PDFName.of('Subtype'))) !== '/Image') continue;
    candidates.push([ref, obj]);
  }

  const report: ShrinkReport = { images: candidates.length, replaced: 0, before: 0, after: 0 };
  let done = 0;
  for (const [ref, stream] of candidates) {
    opts.onImage?.(done++, candidates.length);
    const d = stream.dict;
    const width = num(d.get(PDFName.of('Width')));
    const height = num(d.get(PDFName.of('Height')));
    if (!width || !height) continue;
    if (stream.contents.byteLength < MIN_BYTES) continue;
    if (d.get(PDFName.of('ImageMask')) || d.get(PDFName.of('Decode'))) continue;
    if (num(d.lookup(PDFName.of('BitsPerComponent'))) !== 8) continue;

    const channels = colourChannels(d.lookup(PDFName.of('ColorSpace')), lib, doc);
    if (channels !== 1 && channels !== 3) continue;

    let filter = d.lookup(PDFName.of('Filter'));
    if (filter instanceof PDFArray) filter = filter.size() === 1 ? filter.lookup(0) : undefined;
    const kind = name(filter);

    let bitmap: ImageBitmap | null = null;
    try {
      if (kind === '/DCTDecode') {
        bitmap = await createImageBitmap(new Blob([stream.contents as BlobPart], { type: 'image/jpeg' }));
      } else if (kind === '/FlateDecode') {
        let parms = d.lookup(PDFName.of('DecodeParms'));
        if (parms instanceof PDFArray) parms = parms.lookup(0);
        const predictor = parms instanceof PDFDict ? num(parms.get(PDFName.of('Predictor'))) ?? 1 : 1;
        if (predictor !== 1 && predictor < 10) continue; // TIFF predictor: rare, skipped
        let raw = decodePDFRawStream(stream).decode();
        if (predictor >= 10) raw = unpredictPng(raw, width * channels, channels);
        if (raw.byteLength < width * height * channels) continue;
        const rgba = new Uint8ClampedArray(width * height * 4);
        for (let i = 0, j = 0; i < width * height; i++, j += channels) {
          rgba[i * 4] = raw[j]!;
          rgba[i * 4 + 1] = raw[channels === 3 ? j + 1 : j]!;
          rgba[i * 4 + 2] = raw[channels === 3 ? j + 2 : j]!;
          rgba[i * 4 + 3] = 255;
        }
        bitmap = await createImageBitmap(new ImageData(rgba, width, height));
      } else {
        continue;
      }

      const k = Math.min(1, opts.maxSide / Math.max(width, height));
      const w = Math.max(1, Math.round(width * k));
      const h = Math.max(1, Math.round(height * k));
      const canvas = new OffscreenCanvas(w, h);
      const c = canvas.getContext('2d')!;
      c.imageSmoothingQuality = 'high';
      c.drawImage(bitmap, 0, 0, w, h);
      const jpeg = new Uint8Array(await (await canvas.convertToBlob({ type: 'image/jpeg', quality: opts.quality })).arrayBuffer());

      if (jpeg.byteLength > stream.contents.byteLength * 0.9) continue;
      report.before += stream.contents.byteLength;
      report.after += jpeg.byteLength;
      report.replaced++;

      const smask = d.get(PDFName.of('SMask'));
      const replacement = doc.context.stream(jpeg, {
        Type: 'XObject', Subtype: 'Image', Width: w, Height: h,
        // Canvas only writes RGB JPEGs, so a grey image comes back as RGB.
        // It still has to beat the original by 10% to be used at all.
        ColorSpace: 'DeviceRGB', BitsPerComponent: 8, Filter: 'DCTDecode',
      });
      if (smask) replacement.dict.set(PDFName.of('SMask'), smask);
      const intent = d.get(PDFName.of('Intent'));
      if (intent) replacement.dict.set(PDFName.of('Intent'), intent);
      doc.context.assign(ref, replacement);
    } catch {
      // An image the browser cannot decode stays exactly as it was.
    } finally {
      bitmap?.close();
    }
  }
  opts.onImage?.(candidates.length, candidates.length);
  return report;
}

function readers(lib: typeof PdfLib) {
  return {
    name: (v: unknown) => (v instanceof lib.PDFName ? v.asString() : undefined),
    num: (v: unknown) => (v instanceof lib.PDFNumber ? v.asNumber() : undefined),
  };
}

/** 1 for grey, 3 for RGB, anything else to say "leave this image alone". */
function colourChannels(cs: unknown, lib: typeof PdfLib, doc: PDFDocument): number {
  const { name, num } = readers(lib);
  const n = name(cs);
  if (n === '/DeviceRGB' || n === '/CalRGB') return 3;
  if (n === '/DeviceGray' || n === '/CalGray') return 1;
  if (cs instanceof lib.PDFArray && name(cs.lookup(0)) === '/ICCBased') {
    const profile = doc.context.lookup(cs.get(1));
    if (profile instanceof lib.PDFRawStream) {
      const channels = num(profile.dict.get(lib.PDFName.of('N')));
      if (channels === 1 || channels === 3) return channels;
    }
  }
  return 0;
}

/**
 * Undo PNG row filters (FlateDecode with /Predictor 10 to 15), which pdf-lib
 * does not do itself. Each row starts with a filter-type byte.
 */
export function unpredictPng(data: Uint8Array, rowBytes: number, bpp: number): Uint8Array {
  const rows = Math.floor(data.length / (rowBytes + 1));
  const out = new Uint8Array(rows * rowBytes);
  for (let r = 0; r < rows; r++) {
    const type = data[r * (rowBytes + 1)]!;
    const src = r * (rowBytes + 1) + 1;
    const dst = r * rowBytes;
    const up = dst - rowBytes;
    for (let i = 0; i < rowBytes; i++) {
      const x = data[src + i]!;
      const a = i >= bpp ? out[dst + i - bpp]! : 0;
      const b = r > 0 ? out[up + i]! : 0;
      const c = r > 0 && i >= bpp ? out[up + i - bpp]! : 0;
      let v: number;
      switch (type) {
        case 1: v = x + a; break;
        case 2: v = x + b; break;
        case 3: v = x + ((a + b) >> 1); break;
        case 4: {
          const p = a + b - c;
          const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
          v = x + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c);
          break;
        }
        default: v = x;
      }
      out[dst + i] = v & 0xff;
    }
  }
  return out;
}
