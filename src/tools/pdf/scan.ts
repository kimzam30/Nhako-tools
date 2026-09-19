/**
 * Scan to PDF: find the page in a photo, flatten it, and clean it up.
 * Pure pixel maths on ImageData-shaped arrays, no DOM, so it is unit-tested.
 *
 * Points are in the source image's pixels. A quad is [top-left, top-right,
 * bottom-right, bottom-left].
 */
export interface Point { x: number; y: number }
export type Quad = [Point, Point, Point, Point];
export interface Pixels { data: Uint8ClampedArray; width: number; height: number }

const luma = (d: Uint8ClampedArray, i: number) => 0.299 * d[i]! + 0.587 * d[i + 1]! + 0.114 * d[i + 2]!;

/** Otsu's threshold: the grey level that best splits a histogram in two. */
export function otsu(hist: number[] | Uint32Array, total: number): number {
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * hist[i]!;
  let sumB = 0;
  let wB = 0;
  let best = 0;
  let threshold = 127;
  for (let t = 0; t < 256; t++) {
    wB += hist[t]!;
    if (wB === 0) continue;
    const wF = total - wB;
    if (wF === 0) break;
    sumB += t * hist[t]!;
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) ** 2;
    if (between > best) { best = between; threshold = t; }
  }
  return threshold;
}

/**
 * Where the sheet of paper is. Paper is normally the largest bright region
 * against a darker desk: threshold the image, keep the biggest bright blob
 * that touches the centre area, and take its four extreme corners. When that
 * fails (a white page on a white table), the whole photo, slightly inset.
 */
export function detectPage(px: Pixels): Quad {
  const { data, width: w, height: h } = px;
  const full: Quad = [
    { x: w * 0.02, y: h * 0.02 }, { x: w * 0.98, y: h * 0.02 },
    { x: w * 0.98, y: h * 0.98 }, { x: w * 0.02, y: h * 0.98 },
  ];
  const grey = new Uint8Array(w * h);
  const hist = new Uint32Array(256);
  for (let i = 0, p = 0; i < w * h; i++, p += 4) {
    const v = Math.round(luma(data, p));
    grey[i] = v;
    hist[v]!++;
  }
  const t = otsu(hist, w * h);
  const bright = (i: number) => grey[i]! > t;

  // Label bright regions; keep the largest one.
  const label = new Int32Array(w * h).fill(-1);
  const stack: number[] = [];
  let bestSize = 0;
  let bestLabel = -1;
  let next = 0;
  for (let start = 0; start < w * h; start++) {
    if (label[start] !== -1 || !bright(start)) continue;
    let size = 0;
    stack.push(start);
    label[start] = next;
    while (stack.length) {
      const i = stack.pop()!;
      size++;
      const x = i % w;
      const y = (i - x) / w;
      const n = [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1];
      for (const j of n) {
        if (j >= 0 && label[j] === -1 && bright(j)) { label[j] = next; stack.push(j); }
      }
    }
    if (size > bestSize) { bestSize = size; bestLabel = next; }
    next++;
  }
  const share = bestSize / (w * h);
  if (bestLabel < 0 || share < 0.15 || share > 0.97) return full;

  let tl = { x: 0, y: 0, s: Infinity };
  let br = { x: 0, y: 0, s: -Infinity };
  let tr = { x: 0, y: 0, s: -Infinity };
  let bl = { x: 0, y: 0, s: Infinity };
  for (let i = 0; i < w * h; i++) {
    if (label[i] !== bestLabel) continue;
    const x = i % w;
    const y = (i - x) / w;
    if (x + y < tl.s) tl = { x, y, s: x + y };
    if (x + y > br.s) br = { x, y, s: x + y };
    if (x - y > tr.s) tr = { x, y, s: x - y };
    if (x - y < bl.s) bl = { x, y, s: x - y };
  }
  return [{ x: tl.x, y: tl.y }, { x: tr.x + 1, y: tr.y }, { x: br.x + 1, y: br.y + 1 }, { x: bl.x, y: bl.y + 1 }];
}

/** Solve A x = b by Gaussian elimination with partial pivoting. */
function solve(A: number[][], b: number[]): number[] {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]!]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r]![c]!) > Math.abs(M[p]![c]!)) p = r;
    [M[c], M[p]] = [M[p]!, M[c]!];
    const pivot = M[c]![c]!;
    if (Math.abs(pivot) < 1e-12) throw new Error('degenerate quad');
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = M[r]![c]! / pivot;
      for (let k = c; k <= n; k++) M[r]![k]! -= f * M[c]![k]!;
    }
  }
  return M.map((row, i) => row[n]! / row[i]!);
}

/** The 3×3 projective transform (row-major, h33 = 1) taking `from` onto `to`. */
export function homography(from: Quad, to: Quad): number[] {
  const A: number[][] = [];
  const b: number[] = [];
  for (let i = 0; i < 4; i++) {
    const { x, y } = from[i]!;
    const { x: u, y: v } = to[i]!;
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); b.push(v);
  }
  return [...solve(A, b), 1];
}

export function apply(H: number[], p: Point): Point {
  const d = H[6]! * p.x + H[7]! * p.y + H[8]!;
  return { x: (H[0]! * p.x + H[1]! * p.y + H[2]!) / d, y: (H[3]! * p.x + H[4]! * p.y + H[5]!) / d };
}

const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

/** Output size for a quad: its longer opposite sides, capped at `maxSide`. */
export function flatSize(q: Quad, maxSide = 2400): { width: number; height: number } {
  const w = Math.max(dist(q[0], q[1]), dist(q[3], q[2]));
  const h = Math.max(dist(q[0], q[3]), dist(q[1], q[2]));
  const k = Math.min(1, maxSide / Math.max(w, h));
  return { width: Math.max(1, Math.round(w * k)), height: Math.max(1, Math.round(h * k)) };
}

/** Flatten the quad of `src` into a `width × height` image (bilinear sampling). */
export function warp(src: Pixels, q: Quad, width: number, height: number): Uint8ClampedArray {
  const rect: Quad = [{ x: 0, y: 0 }, { x: width, y: 0 }, { x: width, y: height }, { x: 0, y: height }];
  const H = homography(rect, q); // output pixel -> source pixel
  const out = new Uint8ClampedArray(width * height * 4);
  const { data, width: sw, height: sh } = src;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const px = x + 0.5;
      const py = y + 0.5;
      const d = H[6]! * px + H[7]! * py + H[8]!;
      let sx = (H[0]! * px + H[1]! * py + H[2]!) / d - 0.5;
      let sy = (H[3]! * px + H[4]! * py + H[5]!) / d - 0.5;
      sx = Math.min(sw - 1, Math.max(0, sx));
      sy = Math.min(sh - 1, Math.max(0, sy));
      const x0 = Math.floor(sx);
      const y0 = Math.floor(sy);
      const x1 = Math.min(sw - 1, x0 + 1);
      const y1 = Math.min(sh - 1, y0 + 1);
      const fx = sx - x0;
      const fy = sy - y0;
      const o = (y * width + x) * 4;
      for (let c = 0; c < 3; c++) {
        const a = data[(y0 * sw + x0) * 4 + c]!;
        const b = data[(y0 * sw + x1) * 4 + c]!;
        const e = data[(y1 * sw + x0) * 4 + c]!;
        const f = data[(y1 * sw + x1) * 4 + c]!;
        out[o + c] = (a * (1 - fx) + b * fx) * (1 - fy) + (e * (1 - fx) + f * fx) * fy;
      }
      out[o + 3] = 255;
    }
  }
  return out;
}

export type Filter = 'original' | 'enhance' | 'bw';

/**
 * Clean-ups, in place:
 *   - enhance: greyscale with shadows lifted, by dividing each pixel by the
 *     local background brightness, so uneven light from a phone photo
 *     turns into a flat white page.
 *   - bw: the same, then a crisp black-and-white threshold.
 */
export function applyFilter(px: Pixels, filter: Filter): void {
  if (filter === 'original') return;
  const { data, width: w, height: h } = px;
  const n = w * h;
  const grey = new Float32Array(n);
  for (let i = 0, p = 0; i < n; i++, p += 4) grey[i] = luma(data, p);

  // Local background: a box average over a window about 1/12 of the page,
  // from an integral image so the window size costs nothing.
  const r = Math.max(4, Math.round(Math.max(w, h) / 24));
  const integral = new Float64Array((w + 1) * (h + 1));
  for (let y = 0; y < h; y++) {
    let row = 0;
    for (let x = 0; x < w; x++) {
      row += grey[y * w + x]!;
      integral[(y + 1) * (w + 1) + x + 1] = integral[y * (w + 1) + x + 1]! + row;
    }
  }
  const mean = (x: number, y: number) => {
    const x0 = Math.max(0, x - r);
    const y0 = Math.max(0, y - r);
    const x1 = Math.min(w, x + r + 1);
    const y1 = Math.min(h, y + r + 1);
    const s = integral[y1 * (w + 1) + x1]! - integral[y0 * (w + 1) + x1]! - integral[y1 * (w + 1) + x0]! + integral[y0 * (w + 1) + x0]!;
    return s / ((x1 - x0) * (y1 - y0));
  };

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const bg = Math.max(1, mean(x, y));
      // Ink is darker than its surroundings; paper is about equal to them.
      const ratio = grey[i]! / bg;
      let v: number;
      if (filter === 'bw') v = ratio < 0.8 ? 0 : 255;
      else v = Math.max(0, Math.min(255, (ratio - 0.35) / 0.6 * 255));
      const p = i * 4;
      data[p] = data[p + 1] = data[p + 2] = v;
    }
  }
}

/** Page sizes in points. `fit` makes the page the image's own shape. */
export const PAPER = { a4: { width: 595.28, height: 841.89 }, letter: { width: 612, height: 792 } } as const;

/** The page for an image: paper turned to match its orientation, or its own shape at 150 dpi. */
export function pageFor(imageW: number, imageH: number, paper: 'a4' | 'letter' | 'fit') {
  if (paper === 'fit') return { width: (imageW / 150) * 72, height: (imageH / 150) * 72 };
  const p = PAPER[paper];
  return imageW > imageH ? { width: p.height, height: p.width } : { width: p.width, height: p.height };
}

/** Where the image goes on the page: as large as fits, centred, with a small margin on paper. */
export function placeImage(imageW: number, imageH: number, page: { width: number; height: number }, margin: number) {
  const k = Math.min((page.width - 2 * margin) / imageW, (page.height - 2 * margin) / imageH);
  const width = imageW * k;
  const height = imageH * k;
  return { x: (page.width - width) / 2, y: (page.height - height) / 2, width, height };
}
