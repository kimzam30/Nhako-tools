import { describe, it, expect } from 'vitest';
import { apply, applyFilter, detectPage, flatSize, homography, otsu, pageFor, placeImage, warp, type Pixels, type Quad } from './scan';

/** An image of `bg` grey with a filled quadrilateral of `fg` grey. */
function scene(w: number, h: number, quad: Quad, fg = 235, bg = 60): Pixels {
  const data = new Uint8ClampedArray(w * h * 4);
  // Point-in-convex-quad by the sign of each edge's cross product.
  const inside = (x: number, y: number) => quad.every((a, i) => {
    const b = quad[(i + 1) % 4]!;
    return (b.x - a.x) * (y - a.y) - (b.y - a.y) * (x - a.x) >= 0;
  });
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const v = inside(x + 0.5, y + 0.5) ? fg : bg;
    const p = (y * w + x) * 4;
    data[p] = data[p + 1] = data[p + 2] = v;
    data[p + 3] = 255;
  }
  return { data, width: w, height: h };
}

describe('scan to PDF', () => {
  it('finds a threshold between two populations', () => {
    const hist = new Array(256).fill(0);
    hist[40] = 500; hist[200] = 300;
    const t = otsu(hist, 800);
    expect(t).toBeGreaterThanOrEqual(40);
    expect(t).toBeLessThan(200);
  });

  it('finds the corners of a tilted page on a dark desk', () => {
    const q: Quad = [{ x: 60, y: 40 }, { x: 250, y: 60 }, { x: 230, y: 330 }, { x: 40, y: 300 }];
    const found = detectPage(scene(300, 380, q));
    found.forEach((p, i) => {
      expect(Math.abs(p.x - q[i]!.x), `corner ${i} x`).toBeLessThan(4);
      expect(Math.abs(p.y - q[i]!.y), `corner ${i} y`).toBeLessThan(4);
    });
  });

  it('falls back to the whole photo when no page stands out', () => {
    const flat = scene(100, 100, [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }], 200, 200);
    const q = detectPage(flat);
    expect(q[0]).toEqual({ x: 2, y: 2 });
    expect(q[2]).toEqual({ x: 98, y: 98 });
  });

  it('maps each corner exactly with the projective transform', () => {
    const from: Quad = [{ x: 10, y: 20 }, { x: 300, y: 5 }, { x: 280, y: 400 }, { x: 0, y: 380 }];
    const to: Quad = [{ x: 0, y: 0 }, { x: 210, y: 0 }, { x: 210, y: 297 }, { x: 0, y: 297 }];
    const H = homography(from, to);
    from.forEach((p, i) => {
      const r = apply(H, p);
      expect(r.x).toBeCloseTo(to[i]!.x, 6);
      expect(r.y).toBeCloseTo(to[i]!.y, 6);
    });
  });

  it('flattens a tilted page so its content fills the output', () => {
    const q: Quad = [{ x: 60, y: 40 }, { x: 250, y: 60 }, { x: 230, y: 330 }, { x: 40, y: 300 }];
    const src = scene(300, 380, q);
    const { width, height } = flatSize(q);
    expect(width).toBeGreaterThan(180);
    expect(height).toBeGreaterThan(250);
    const out = warp(src, q, width, height);
    // Away from the very edge, every pixel is page, none is desk.
    let desk = 0;
    for (let y = 4; y < height - 4; y++) for (let x = 4; x < width - 4; x++) if (out[(y * width + x) * 4]! < 150) desk++;
    expect(desk).toBe(0);
  });

  it('turns uneven light into a white page with black ink', () => {
    const w = 120; const h = 80;
    const data = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      // Paper fades from 230 to 130 across the page (a shadow); ink is 40% of it.
      const paper = 230 - x * (100 / w);
      const ink = y > 35 && y < 45 && x > 20 && x < 100;
      const v = ink ? paper * 0.4 : paper;
      const p = (y * w + x) * 4;
      data[p] = data[p + 1] = data[p + 2] = v; data[p + 3] = 255;
    }
    const px = { data, width: w, height: h };
    applyFilter(px, 'bw');
    const at = (x: number, y: number) => data[(y * w + x) * 4];
    expect(at(10, 10)).toBe(255);   // bright paper
    expect(at(110, 10)).toBe(255);  // shadowed paper, still white
    expect(at(30, 40)).toBe(0);     // ink in the light
    expect(at(90, 40)).toBe(0);     // ink in the shadow
  });

  it('sizes pages to the paper, turned to match the photo', () => {
    expect(pageFor(1000, 1400, 'a4')).toEqual({ width: 595.28, height: 841.89 });
    expect(pageFor(1400, 1000, 'a4')).toEqual({ width: 841.89, height: 595.28 });
    expect(pageFor(1500, 3000, 'fit')).toEqual({ width: 720, height: 1440 });
    const place = placeImage(1000, 1000, { width: 600, height: 800 }, 20);
    expect(place).toEqual({ x: 20, y: 120, width: 560, height: 560 });
  });
});
