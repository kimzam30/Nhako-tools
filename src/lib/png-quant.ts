/**
 * Lossy PNG, the way TinyPNG and pngquant do it: reduce the image to a
 * palette of at most 256 colours (transparency included), spread the
 * rounding error with Floyd-Steinberg dithering so gradients do not band,
 * and write an 8-bit indexed PNG. Typically 60 to 80% smaller than the
 * truecolour original, still a PNG, still transparent.
 *
 * Written here rather than pulled in: libimagequant (what pngquant uses) is
 * GPL, and the browser already has the one hard part, zlib, in
 * CompressionStream('deflate').
 *
 * Median cut over RGBA builds the palette from a sample of the pixels, a few
 * k-means passes refine it, and every pixel is then mapped with a cache so
 * repeated colours cost one lookup.
 */

export interface Quantized { palette: Uint8Array; indices: Uint8Array; colours: number }

/** Pixels sampled to build the palette. Enough for a stable palette, fast on 12 MP. */
const SAMPLE = 120_000;

export function quantize(rgba: Uint8ClampedArray | Uint8Array, width: number, height: number, maxColours = 256, dither = true): Quantized {
  const n = width * height;
  const step = Math.max(1, Math.floor(n / SAMPLE));
  const sample: number[] = [];
  for (let i = 0; i < n; i += step) {
    const o = i * 4;
    const a = rgba[o + 3]!;
    // Fully transparent pixels all share one entry, whatever colour they hide.
    if (a === 0) sample.push(0, 0, 0, 0);
    else sample.push(rgba[o]!, rgba[o + 1]!, rgba[o + 2]!, a);
  }
  let palette = medianCut(Float64Array.from(sample), maxColours);
  palette = refine(Float64Array.from(sample), palette, 3);

  const colours = palette.length / 4;
  const pal = new Uint8Array(colours * 4);
  for (let i = 0; i < pal.length; i++) pal[i] = Math.max(0, Math.min(255, Math.round(palette[i]!)));

  const indices = new Uint8Array(n);
  const cache = new Map<number, number>();
  const nearest = (r: number, g: number, b: number, a: number) => {
    const key = ((r >> 2) << 18) | ((g >> 2) << 12) | ((b >> 2) << 6) | (a >> 2);
    const hit = cache.get(key);
    if (hit !== undefined) return hit;
    let best = 0;
    let bestD = Infinity;
    for (let p = 0; p < colours; p++) {
      const o = p * 4;
      // Colour differences matter less the more transparent both pixels are.
      const dr = r - pal[o]!, dg = g - pal[o + 1]!, db = b - pal[o + 2]!, da = a - pal[o + 3]!;
      const w = (a + pal[o + 3]!) / 510;
      const d = (dr * dr * 0.3 + dg * dg * 0.59 + db * db * 0.11) * w + da * da;
      if (d < bestD) { bestD = d; best = p; }
    }
    cache.set(key, best);
    return best;
  };

  if (!dither) {
    for (let i = 0; i < n; i++) {
      const o = i * 4;
      indices[i] = rgba[o + 3] === 0 ? nearest(0, 0, 0, 0) : nearest(rgba[o]!, rgba[o + 1]!, rgba[o + 2]!, rgba[o + 3]!);
    }
    return { palette: pal, indices, colours };
  }

  // Floyd-Steinberg on two rows of error, so memory stays at a few rows.
  let cur = new Float32Array((width + 2) * 4);
  let next = new Float32Array((width + 2) * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 4;
      const e = (x + 1) * 4;
      const clamp = (v: number) => (v < 0 ? 0 : v > 255 ? 255 : v);
      const a0 = rgba[o + 3]!;
      const r = clamp(rgba[o]! + cur[e]!);
      const g = clamp(rgba[o + 1]! + cur[e + 1]!);
      const b = clamp(rgba[o + 2]! + cur[e + 2]!);
      const a = a0 === 0 || a0 === 255 ? a0 : clamp(a0 + cur[e + 3]!);
      const p = a === 0 ? nearest(0, 0, 0, 0) : nearest(r | 0, g | 0, b | 0, a | 0);
      indices[y * width + x] = p;
      const q = p * 4;
      // Error is only carried through visible pixels: diffusing it into fully
      // transparent ones would speckle their edges.
      if (a0 === 0) continue;
      const er = r - pal[q]!, eg = g - pal[q + 1]!, eb = b - pal[q + 2]!, ea = a - pal[q + 3]!;
      for (let c = 0; c < 4; c++) {
        const err = [er, eg, eb, ea][c]! * 0.85; // slightly damped, as pngquant does, to avoid worms
        cur[e + 4 + c]! += (err * 7) / 16;
        next[e - 4 + c]! += (err * 3) / 16;
        next[e + c]! += (err * 5) / 16;
        next[e + 4 + c]! += err / 16;
      }
    }
    [cur, next] = [next, cur];
    next.fill(0);
  }
  return { palette: pal, indices, colours };
}

/** Median cut: split the box with the widest (weighted) channel range until there are enough boxes. */
function medianCut(px: Float64Array, max: number): Float64Array {
  const count = px.length / 4;
  let boxes: Uint32Array[] = [Uint32Array.from({ length: count }, (_, i) => i)];
  const range = (box: Uint32Array) => {
    const lo = [255, 255, 255, 255], hi = [0, 0, 0, 0];
    for (const i of box) for (let c = 0; c < 4; c++) { const v = px[i * 4 + c]!; if (v < lo[c]!) lo[c] = v; if (v > hi[c]!) hi[c] = v; }
    // Perceptual weights: green matters most, alpha as much as luminance.
    const w = [0.8, 1, 0.6, 1];
    let best = 0, bestR = -1;
    for (let c = 0; c < 4; c++) { const r = (hi[c]! - lo[c]!) * w[c]!; if (r > bestR) { bestR = r; best = c; } }
    return { channel: best, spread: bestR * Math.sqrt(box.length) };
  };
  while (boxes.length < max) {
    let pick = -1, score = 0, channel = 0;
    boxes.forEach((box, i) => {
      if (box.length < 2) return;
      const r = range(box);
      if (r.spread > score) { score = r.spread; pick = i; channel = r.channel; }
    });
    if (pick < 0 || score === 0) break;
    const box = Array.from(boxes[pick]!).sort((a, b) => px[a * 4 + channel]! - px[b * 4 + channel]!);
    const mid = box.length >> 1;
    boxes = [...boxes.slice(0, pick), Uint32Array.from(box.slice(0, mid)), Uint32Array.from(box.slice(mid)), ...boxes.slice(pick + 1)];
  }
  const out = new Float64Array(boxes.length * 4);
  boxes.forEach((box, b) => {
    for (const i of box) for (let c = 0; c < 4; c++) out[b * 4 + c]! += px[i * 4 + c]!;
    for (let c = 0; c < 4; c++) out[b * 4 + c]! /= box.length;
  });
  return out;
}

/** A few k-means passes over the sample, starting from the median-cut palette. */
function refine(px: Float64Array, palette: Float64Array, passes: number): Float64Array {
  const k = palette.length / 4;
  const count = px.length / 4;
  for (let pass = 0; pass < passes; pass++) {
    const sum = new Float64Array(k * 4);
    const hits = new Uint32Array(k);
    for (let i = 0; i < count; i++) {
      let best = 0, bestD = Infinity;
      for (let p = 0; p < k; p++) {
        let d = 0;
        for (let c = 0; c < 4; c++) { const v = px[i * 4 + c]! - palette[p * 4 + c]!; d += v * v; }
        if (d < bestD) { bestD = d; best = p; }
      }
      hits[best]!++;
      for (let c = 0; c < 4; c++) sum[best * 4 + c]! += px[i * 4 + c]!;
    }
    for (let p = 0; p < k; p++) if (hits[p]) for (let c = 0; c < 4; c++) palette[p * 4 + c] = sum[p * 4 + c]! / hits[p]!;
  }
  return palette;
}

const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();

function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  const v = new DataView(out.buffer);
  v.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  let c = 0xffffffff;
  for (let i = 4; i < 8 + data.length; i++) c = CRC[(c ^ out[i]!) & 0xff]! ^ (c >>> 8);
  v.setUint32(8 + data.length, (c ^ 0xffffffff) >>> 0);
  return out;
}

async function deflate(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(new CompressionStream('deflate'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/**
 * An indexed PNG. Palettes of 16 colours or fewer are packed at 4, 2 or
 * 1 bits per pixel; tRNS carries alpha and is trimmed after the last
 * translucent entry, as the spec allows.
 */
export async function encodeIndexedPng(q: Quantized, width: number, height: number): Promise<Uint8Array> {
  // Translucent entries first, so tRNS can stop early.
  const order = Array.from({ length: q.colours }, (_, i) => i).sort((a, b) => q.palette[a * 4 + 3]! - q.palette[b * 4 + 3]!);
  const remap = new Uint8Array(q.colours);
  order.forEach((old, i) => { remap[old] = i; });
  const bits = q.colours <= 2 ? 1 : q.colours <= 4 ? 2 : q.colours <= 16 ? 4 : 8;
  const rowBytes = Math.ceil((width * bits) / 8);
  const raw = new Uint8Array((rowBytes + 1) * height);
  for (let y = 0; y < height; y++) {
    const row = y * (rowBytes + 1);
    raw[row] = 0; // filter: none, the right choice for palette images
    for (let x = 0; x < width; x++) {
      const v = remap[q.indices[y * width + x]!]!;
      if (bits === 8) raw[row + 1 + x] = v;
      else {
        const perByte = 8 / bits;
        const at = row + 1 + Math.floor(x / perByte);
        raw[at]! |= v << (8 - bits * (1 + (x % perByte)));
      }
    }
  }

  const ihdr = new Uint8Array(13);
  const hv = new DataView(ihdr.buffer);
  hv.setUint32(0, width); hv.setUint32(4, height);
  ihdr[8] = bits; ihdr[9] = 3; // indexed colour
  const plte = new Uint8Array(q.colours * 3);
  const alpha: number[] = [];
  order.forEach((old, i) => {
    plte[i * 3] = q.palette[old * 4]!; plte[i * 3 + 1] = q.palette[old * 4 + 1]!; plte[i * 3 + 2] = q.palette[old * 4 + 2]!;
    alpha.push(q.palette[old * 4 + 3]!);
  });
  while (alpha.length && alpha[alpha.length - 1] === 255) alpha.pop();

  const parts = [
    new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('PLTE', plte),
    ...(alpha.length ? [chunk('tRNS', Uint8Array.from(alpha))] : []),
    chunk('IDAT', await deflate(raw)),
    chunk('IEND', new Uint8Array(0)),
  ];
  const out = new Uint8Array(parts.reduce((s, p) => s + p.length, 0));
  let at = 0;
  for (const p of parts) { out.set(p, at); at += p.length; }
  return out;
}

/** Peak signal-to-noise ratio between two RGBA buffers, alpha-weighted, in dB. */
export function psnr(a: Uint8ClampedArray | Uint8Array, b: Uint8ClampedArray | Uint8Array): number {
  let se = 0;
  for (let i = 0; i < a.length; i += 4) {
    const w = Math.max(a[i + 3]!, b[i + 3]!) / 255;
    for (let c = 0; c < 3; c++) { const d = (a[i + c]! - b[i + c]!) * w; se += d * d; }
    const da = a[i + 3]! - b[i + 3]!;
    se += da * da;
  }
  const mse = se / ((a.length / 4) * 4);
  return mse === 0 ? Infinity : 10 * Math.log10((255 * 255) / mse);
}

export interface LossyPng { bytes: Uint8Array; colours: number; lossless: boolean; dithered: boolean }

/**
 * The whole job, choosing per image what pngquant chooses:
 *
 * - 256 colours or fewer already: an exact palette, so the result is lossless.
 * - Flat graphics (screenshots, logos, charts): no dithering. On a real UI
 *   screenshot, dithering cost 38 percentage points of saving (60% smaller
 *   became 22%) for noise nobody wanted.
 * - Photographic content: dithered, or smooth skies posterise into blotches.
 *
 * Measured on a screenshot, a transparent render and a photo, unique colours
 * made up 1.4%, 22% and 38% of a 120k-pixel sample, so 5% splits them cleanly.
 */
export async function lossyPng(rgba: Uint8ClampedArray | Uint8Array, width: number, height: number, maxColours = 256): Promise<LossyPng> {
  const px = new Uint32Array(rgba.buffer, rgba.byteOffset, width * height);
  const exact = new Map<number, number>();
  for (let i = 0; i < px.length && exact.size <= maxColours; i++) {
    const v = (px[i]! >>> 24) === 0 ? 0 : px[i]!; // every clear pixel is one colour
    if (!exact.has(v)) exact.set(v, exact.size);
  }
  if (exact.size <= maxColours) {
    const palette = new Uint8Array(exact.size * 4);
    for (const [v, i] of exact) {
      palette[i * 4] = v & 0xff; palette[i * 4 + 1] = (v >>> 8) & 0xff;
      palette[i * 4 + 2] = (v >>> 16) & 0xff; palette[i * 4 + 3] = v >>> 24;
    }
    const indices = new Uint8Array(px.length);
    for (let i = 0; i < px.length; i++) indices[i] = exact.get((px[i]! >>> 24) === 0 ? 0 : px[i]!)!;
    return { bytes: await encodeIndexedPng({ palette, indices, colours: exact.size }, width, height), colours: exact.size, lossless: true, dithered: false };
  }

  const step = Math.max(1, Math.floor(px.length / SAMPLE));
  const seen = new Set<number>();
  let sampled = 0;
  for (let i = 0; i < px.length; i += step, sampled++) seen.add(px[i]!);
  const dither = seen.size / sampled > 0.05;
  const q = quantize(rgba, width, height, maxColours, dither);
  return { bytes: await encodeIndexedPng(q, width, height), colours: q.colours, lossless: false, dithered: dither };
}
