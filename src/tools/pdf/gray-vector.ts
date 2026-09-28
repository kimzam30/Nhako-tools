import type * as PdfLib from 'pdf-lib';
import type { PDFDocument, PDFPage } from 'pdf-lib';
import { unpredictPng } from './shrink-images';

/**
 * Grayscale that keeps a PDF a PDF: colour operators in the page's content
 * streams are rewritten to grey, and embedded images are turned grey, so
 * text stays text (selectable, searchable, sharp at any zoom) and drawings
 * stay vector. What Sejda and Acrobat's "Convert Colors" do; the old tool
 * flattened every page to a 150 dpi JPEG.
 *
 * Only what can be converted exactly is touched: DeviceRGB, DeviceCMYK,
 * CalRGB/CalGray and ICC-based RGB/CMYK colours; RGB and grey JPEG and Flate
 * images; indexed (palette) images over RGB. Anything else (spot colours,
 * gradients, CMYK or JPX images) is left alone, and grayscale.ts renders the
 * finished page and checks it for colour. A page that still has any is
 * flattened the old way, so the promise "it prints grey" always holds.
 */

type Lib = typeof PdfLib;

/** Rec. 709 luma: what the old raster path and printers use. */
const luma = (r: number, g: number, b: number) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
const cmykGray = (c: number, m: number, y: number, k: number) => luma((1 - c) * (1 - k), (1 - m) * (1 - k), (1 - y) * (1 - k));
const num = (n: number) => String(Math.round(n * 10000) / 10000);

// ── Content stream tokenising ────────────────────────────────────────────
const WS = new Set([0, 9, 10, 12, 13, 32]);
const DELIM = new Set([40, 41, 60, 62, 91, 93, 123, 125, 47, 37]);

interface Tok { start: number; end: number; kind: 'num' | 'name' | 'op' | 'other'; text: string }

/**
 * Split a content stream into tokens, enough to find colour operators and
 * their operands: numbers, names and operators are read; strings, arrays,
 * dictionaries and inline image data are stepped over whole.
 */
function* tokens(b: Uint8Array): Generator<Tok> {
  let i = 0;
  const n = b.length;
  while (i < n) {
    const c = b[i]!;
    if (WS.has(c)) { i++; continue; }
    if (c === 37) { while (i < n && b[i] !== 10 && b[i] !== 13) i++; continue; } // % comment
    const start = i;
    if (c === 40) { // ( literal string )
      let depth = 0;
      for (; i < n; i++) {
        if (b[i] === 92) { i++; continue; }
        if (b[i] === 40) depth++;
        else if (b[i] === 41 && --depth === 0) { i++; break; }
      }
      yield { start, end: i, kind: 'other', text: '' };
      continue;
    }
    if (c === 60 && b[i + 1] === 60) { i += 2; yield { start, end: i, kind: 'other', text: '<<' }; continue; }
    if (c === 62 && b[i + 1] === 62) { i += 2; yield { start, end: i, kind: 'other', text: '>>' }; continue; }
    if (c === 60) { while (i < n && b[i] !== 62) i++; i++; yield { start, end: i, kind: 'other', text: '' }; continue; }
    if (c === 91 || c === 93 || c === 123 || c === 125 || c === 62) { i++; yield { start, end: i, kind: 'other', text: String.fromCharCode(c) }; continue; }
    if (c === 47) { // /Name
      i++;
      while (i < n && !WS.has(b[i]!) && !DELIM.has(b[i]!)) i++;
      yield { start, end: i, kind: 'name', text: String.fromCharCode(...b.subarray(start + 1, i)) };
      continue;
    }
    while (i < n && !WS.has(b[i]!) && !DELIM.has(b[i]!)) i++;
    if (i === start) { i++; continue; }
    const text = String.fromCharCode(...b.subarray(start, i));
    if (/^[+-]?(\d+\.?\d*|\.\d+)$/.test(text)) { yield { start, end: i, kind: 'num', text }; continue; }
    yield { start, end: i, kind: 'op', text };
    if (text === 'ID') {
      // Inline image data runs to "EI" standing alone; it is binary, so skip it.
      i++;
      while (i < n - 2 && !(WS.has(b[i]!) && b[i + 1] === 69 && b[i + 2] === 73 && (i + 3 >= n || WS.has(b[i + 3]!)))) i++;
    }
  }
}

/** How a named or device colour space converts, or null to leave it alone. */
type Space = { kind: 'rgb' | 'cmyk' | 'gray' } | null;

export interface GrayReport { streams: number; changedOps: number; untouched: number; images: number; imagesUntouched: number }

/**
 * Rewrite one content stream's bytes. `spaces` resolves a /Name used with
 * cs/CS to what it is (from the page or form's /ColorSpace resources).
 */
export function grayContent(src: Uint8Array, spaces: (name: string) => Space, report: GrayReport): Uint8Array {
  const edits: Array<{ start: number; end: number; text: string }> = [];
  const ops: Tok[] = [];
  const fill = { space: { kind: 'gray' } as Space };
  const stroke = { space: { kind: 'gray' } as Space };
  for (const t of tokens(src)) {
    if (t.kind !== 'op') { ops.push(t); continue; }
    const args = ops;
    const nums = () => args.filter((a) => a.kind === 'num').map((a) => Number(a.text));
    const replace = (text: string) => { edits.push({ start: args[0]?.start ?? t.start, end: t.end, text }); report.changedOps++; };
    const op = t.text;
    if ((op === 'rg' || op === 'RG') && args.length === 3) {
      const [r, g, b] = nums() as [number, number, number];
      replace(`${num(luma(r, g, b))} ${op === 'rg' ? 'g' : 'G'}`);
    } else if ((op === 'k' || op === 'K') && args.length === 4) {
      const [c, m, y, k] = nums() as [number, number, number, number];
      replace(`${num(cmykGray(c, m, y, k))} ${op === 'k' ? 'g' : 'G'}`);
    } else if ((op === 'cs' || op === 'CS') && args.length === 1 && args[0]!.kind === 'name') {
      const name = args[0]!.text;
      const space: Space = name === 'DeviceRGB' ? { kind: 'rgb' } : name === 'DeviceCMYK' ? { kind: 'cmyk' } : name === 'DeviceGray' ? { kind: 'gray' } : spaces(name);
      (op === 'cs' ? fill : stroke).space = space;
      if (space && space.kind !== 'gray') replace(`/DeviceGray ${op}`);
      else if (!space) report.untouched++;
    } else if (op === 'sc' || op === 'scn' || op === 'SC' || op === 'SCN') {
      const state = op === 'sc' || op === 'scn' ? fill : stroke;
      const v = nums();
      if (state.space?.kind === 'rgb' && v.length === 3 && args.length === 3) replace(`${num(luma(v[0]!, v[1]!, v[2]!))} ${op}`);
      else if (state.space?.kind === 'cmyk' && v.length === 4 && args.length === 4) replace(`${num(cmykGray(v[0]!, v[1]!, v[2]!, v[3]!))} ${op}`);
    } else if (op === 'g' || op === 'G') {
      (op === 'g' ? fill : stroke).space = { kind: 'gray' };
    }
    ops.length = 0;
  }
  report.streams++;
  if (edits.length === 0) return src;
  const enc = new TextEncoder();
  const parts: Uint8Array[] = [];
  let at = 0;
  for (const e of edits) { parts.push(src.subarray(at, e.start), enc.encode(e.text)); at = e.end; }
  parts.push(src.subarray(at));
  const out = new Uint8Array(parts.reduce((s, p) => s + p.length, 0));
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

/** Convert the chosen pages in place. Pages the caller must still check. */
export async function grayPages(doc: PDFDocument, pages: PDFPage[]): Promise<GrayReport> {
  const lib = await import('pdf-lib');
  const report: GrayReport = { streams: 0, changedOps: 0, untouched: 0, images: 0, imagesUntouched: 0 };
  const seen = new Set<string>();
  const { PDFName, PDFDict, PDFArray, PDFRawStream, PDFRef } = lib;

  const channelsOf = (cs: unknown): Space => {
    const v = cs instanceof PDFRef ? doc.context.lookup(cs) : cs;
    if (v instanceof PDFName) {
      const s = v.asString();
      return s === '/DeviceRGB' || s === '/CalRGB' ? { kind: 'rgb' } : s === '/DeviceCMYK' ? { kind: 'cmyk' } : s === '/DeviceGray' || s === '/CalGray' ? { kind: 'gray' } : null;
    }
    if (v instanceof PDFArray) {
      const head = v.lookup(0);
      const name = head instanceof PDFName ? head.asString() : '';
      if (name === '/CalRGB') return { kind: 'rgb' };
      if (name === '/CalGray') return { kind: 'gray' };
      if (name === '/ICCBased') {
        const profile = doc.context.lookup(v.get(1));
        const n = profile instanceof PDFRawStream ? profile.dict.get(PDFName.of('N')) : undefined;
        const count = n instanceof lib.PDFNumber ? n.asNumber() : 0;
        return count === 3 ? { kind: 'rgb' } : count === 4 ? { kind: 'cmyk' } : count === 1 ? { kind: 'gray' } : null;
      }
    }
    return null;
  };

  const rewriteStream = (ref: unknown, resources: PdfLib.PDFDict | undefined) => {
    if (!(ref instanceof PDFRef)) return;
    const key = ref.toString();
    if (seen.has(key)) return;
    seen.add(key);
    const stream = doc.context.lookup(ref);
    if (!(stream instanceof PDFRawStream)) return;
    let raw: Uint8Array;
    try { raw = lib.decodePDFRawStream(stream).decode(); } catch { report.untouched++; return; }
    const spacesDict = resources?.lookup(PDFName.of('ColorSpace'));
    const spaces = (name: string): Space => (spacesDict instanceof PDFDict ? channelsOf(spacesDict.get(PDFName.of(name))) : null);
    const out = grayContent(raw, spaces, report);
    if (out !== raw) {
      const dict = stream.dict.clone(doc.context);
      dict.delete(PDFName.of('Filter'));
      dict.delete(PDFName.of('DecodeParms'));
      dict.delete(PDFName.of('Length'));
      doc.context.assign(ref, doc.context.flateStream(out, Object.fromEntries([...dict.entries()].map(([k, v]) => [k.asString().slice(1), v]))));
    }
    walkResources(resources);
  };

  const walkResources = (resources: PdfLib.PDFDict | undefined) => {
    const xobjects = resources?.lookup(PDFName.of('XObject'));
    if (!(xobjects instanceof PDFDict)) return;
    for (const [, ref] of xobjects.entries()) {
      const x = ref instanceof PDFRef ? doc.context.lookup(ref) : null;
      if (!(x instanceof PDFRawStream)) continue;
      const sub = x.dict.get(PDFName.of('Subtype'));
      if (sub instanceof PDFName && sub.asString() === '/Form') {
        const own = x.dict.lookup(PDFName.of('Resources'));
        rewriteStream(ref, own instanceof PDFDict ? own : resources);
      } else if (sub instanceof PDFName && sub.asString() === '/Image') {
        pendingImages.push(ref as PdfLib.PDFRef);
      }
    }
  };

  const pendingImages: PdfLib.PDFRef[] = [];
  for (const page of pages) {
    const resources = page.node.Resources();
    const contents = page.node.get(PDFName.of('Contents'));
    const list = contents instanceof PDFArray ? contents.asArray() : [contents];
    for (const c of list) rewriteStream(c, resources);
    walkResources(resources);
    // Form fields and highlights draw from their own appearance streams.
    const annots = page.node.lookup(PDFName.of('Annots'));
    if (annots instanceof PDFArray) {
      for (const a of annots.asArray()) {
        const annot = doc.context.lookup(a);
        if (!(annot instanceof PDFDict)) continue;
        // The colours an annotation carries itself: a link's border (the
        // red and green boxes LaTeX's hyperref draws round citations), a
        // note's fill, a form field's border and background.
        grayColourArrays(annot, ['C', 'IC'], lib);
        const mk = annot.lookup(PDFName.of('MK'));
        if (mk instanceof PDFDict) grayColourArrays(mk, ['BC', 'BG'], lib);
        const ap = annot.lookup(PDFName.of('AP'));
        if (!(ap instanceof PDFDict)) continue;
        for (const [, face] of ap.entries()) {
          const f = face instanceof PDFRef ? doc.context.lookup(face) : face;
          const faces = f instanceof PDFDict && !(f instanceof PDFRawStream) ? [...f.entries()].map(([, v]) => v) : [face];
          for (const s of faces) {
            const st = s instanceof PDFRef ? doc.context.lookup(s) : null;
            const own = st instanceof PDFRawStream ? st.dict.lookup(PDFName.of('Resources')) : undefined;
            rewriteStream(s, own instanceof PDFDict ? own : resources);
          }
        }
      }
    }
  }
  for (const ref of pendingImages) {
    const key = 'img' + ref.toString();
    if (seen.has(key)) continue;
    seen.add(key);
    if (await grayImage(doc, ref, lib, channelsOf)) report.images++;
    else report.imagesUntouched++;
  }
  return report;
}

/** Replace RGB (3) or CMYK (4) colour arrays under `keys` with one grey component. */
function grayColourArrays(dict: PdfLib.PDFDict, keys: string[], lib: Lib): void {
  for (const key of keys) {
    const v = dict.lookup(lib.PDFName.of(key));
    if (!(v instanceof lib.PDFArray)) continue;
    const c = v.asArray().map((x) => (x instanceof lib.PDFNumber ? x.asNumber() : NaN));
    if (c.some(Number.isNaN)) continue;
    const y = c.length === 3 ? luma(c[0]!, c[1]!, c[2]!) : c.length === 4 ? cmykGray(c[0]!, c[1]!, c[2]!, c[3]!) : null;
    if (y === null) continue;
    const grey = lib.PDFArray.withContext(dict.context);
    grey.push(lib.PDFNumber.of(Math.round(y * 1000) / 1000));
    dict.set(lib.PDFName.of(key), grey);
  }
}

/** Turn one image XObject grey. False if it is a kind this leaves alone. */
async function grayImage(doc: PDFDocument, ref: PdfLib.PDFRef, lib: Lib, channelsOf: (cs: unknown) => Space): Promise<boolean> {
  const { PDFName, PDFRawStream, PDFArray, PDFNumber, PDFDict, PDFString, PDFHexString } = lib;
  const img = doc.context.lookup(ref);
  if (!(img instanceof PDFRawStream)) return false;
  const d = img.dict;
  if (d.get(PDFName.of('ImageMask'))) return true; // a stencil takes the (already grey) fill colour
  const w = (d.get(PDFName.of('Width')) as PdfLib.PDFNumber | undefined)?.asNumber() ?? 0;
  const h = (d.get(PDFName.of('Height')) as PdfLib.PDFNumber | undefined)?.asNumber() ?? 0;
  const bpc = d.lookup(PDFName.of('BitsPerComponent'));
  const cs = d.get(PDFName.of('ColorSpace'));
  let filter = d.lookup(PDFName.of('Filter'));
  if (filter instanceof PDFArray) filter = filter.size() === 1 ? filter.lookup(0) : undefined;
  const kind = filter instanceof PDFName ? filter.asString() : filter === undefined ? 'none' : '?';
  const space = channelsOf(cs);
  if (space?.kind === 'gray') return true;

  // Palette images: grey the palette, not the pixels.
  const csv = cs instanceof lib.PDFRef ? doc.context.lookup(cs) : cs;
  if (csv instanceof PDFArray && (csv.lookup(0) as PdfLib.PDFName | undefined)?.asString?.() === '/Indexed') {
    const base = channelsOf(csv.get(1));
    const table = csv.lookup(3);
    let bytes: Uint8Array | null = null;
    if (table instanceof PDFString) bytes = table.asBytes();
    else if (table instanceof PDFHexString) bytes = table.asBytes();
    else if (table instanceof PDFRawStream) bytes = lib.decodePDFRawStream(table).decode();
    if (!bytes || base?.kind !== 'rgb') return false;
    const gray = new Uint8Array(bytes.length);
    for (let i = 0; i + 2 < bytes.length; i += 3) { const y = Math.round(luma(bytes[i]!, bytes[i + 1]!, bytes[i + 2]!)); gray[i] = y; gray[i + 1] = y; gray[i + 2] = y; }
    const next = PDFArray.withContext(doc.context);
    next.push(PDFName.of('Indexed')); next.push(PDFName.of('DeviceRGB')); next.push(csv.get(2)); next.push(PDFHexString.of([...gray].map((x) => x.toString(16).padStart(2, '0')).join('')));
    d.set(PDFName.of('ColorSpace'), next);
    return true;
  }

  if (!(bpc instanceof PDFNumber) || bpc.asNumber() !== 8 || !space || d.get(PDFName.of('Decode')) || !w || !h) return false;
  const channels = space.kind === 'rgb' ? 3 : 4;
  let pixels: Uint8ClampedArray<ArrayBuffer>;
  try {
    if (kind === '/DCTDecode' && channels === 3) {
      const bmp = await createImageBitmap(new Blob([img.contents as BlobPart], { type: 'image/jpeg' }));
      const c = new OffscreenCanvas(w, h).getContext('2d', { willReadFrequently: true })!;
      c.drawImage(bmp, 0, 0, w, h);
      bmp.close();
      pixels = c.getImageData(0, 0, w, h).data;
    } else if (kind === '/FlateDecode' || kind === 'none') {
      let raw = kind === 'none' ? img.contents : lib.decodePDFRawStream(img).decode();
      let parms = d.lookup(PDFName.of('DecodeParms'));
      if (parms instanceof PDFArray) parms = parms.lookup(0);
      const pred = parms instanceof PDFDict ? (parms.get(PDFName.of('Predictor')) as PdfLib.PDFNumber | undefined)?.asNumber() ?? 1 : 1;
      if (pred >= 10) raw = unpredictPng(raw, w * channels, channels);
      else if (pred !== 1) return false;
      if (raw.length < w * h * channels) return false;
      pixels = new Uint8ClampedArray(w * h * 4);
      for (let i = 0, j = 0; i < w * h; i++, j += channels) {
        const y = channels === 3 ? luma(raw[j]!, raw[j + 1]!, raw[j + 2]!) : 255 * cmykGray(raw[j]! / 255, raw[j + 1]! / 255, raw[j + 2]! / 255, raw[j + 3]! / 255);
        pixels[i * 4] = pixels[i * 4 + 1] = pixels[i * 4 + 2] = y;
      }
    } else {
      return false;
    }
  } catch {
    return false;
  }
  let stream: PdfLib.PDFRawStream | PdfLib.PDFContentStream;
  if (kind === '/DCTDecode') {
    // A photo stays a JPEG: re-stored losslessly it would weigh several times
    // more. Canvas writes RGB JPEGs only, so the grey is carried in RGB.
    for (let i = 0; i < w * h; i++) {
      const y = luma(pixels[i * 4]!, pixels[i * 4 + 1]!, pixels[i * 4 + 2]!);
      pixels[i * 4] = pixels[i * 4 + 1] = pixels[i * 4 + 2] = y;
      pixels[i * 4 + 3] = 255;
    }
    const canvas = new OffscreenCanvas(w, h);
    canvas.getContext('2d')!.putImageData(new ImageData(pixels, w, h), 0, 0);
    const jpeg = new Uint8Array(await (await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.9 })).arrayBuffer());
    stream = doc.context.stream(jpeg, { Type: 'XObject', Subtype: 'Image', Width: w, Height: h, ColorSpace: 'DeviceRGB', BitsPerComponent: 8, Filter: 'DCTDecode' });
  } else {
    // One grey byte per pixel, deflated: a third of the RGB original.
    const gray = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) gray[i] = Math.round(pixels[i * 4]!);
    stream = doc.context.flateStream(gray, { Type: 'XObject', Subtype: 'Image', Width: w, Height: h, ColorSpace: 'DeviceGray', BitsPerComponent: 8 });
  }
  for (const keep of ['SMask', 'Mask', 'Intent', 'Interpolate']) {
    const v = d.get(PDFName.of(keep));
    if (v) stream.dict.set(PDFName.of(keep), v);
  }
  doc.context.assign(ref, stream);
  return true;
}
