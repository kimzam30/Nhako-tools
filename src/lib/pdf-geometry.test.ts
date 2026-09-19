import { describe, it, expect } from 'vitest';
import { visualToUser, visualRectToUser, visualSize, normalizeRotation, type Rotation } from './pdf-geometry';

// An A4-ish crop box that does not start at the origin, to catch offset bugs.
const box = { x: 10, y: 20, width: 600, height: 800 };

describe('visual to user space', () => {
  // Where the displayed top-left corner lives in stored space, per PDF's
  // "rotate clockwise when displayed" rule, derived corner by corner.
  const topLeft: Record<Rotation, [number, number]> = {
    0: [10, 820], 90: [10, 20], 180: [610, 20], 270: [610, 820],
  };

  for (const r of [0, 90, 180, 270] as Rotation[]) {
    it(`rotation ${r}: corners land on the crop box corners`, () => {
      const { width: vw, height: vh } = visualSize(box, r);
      const tl = visualToUser(0, 0, box, r);
      expect([tl.x, tl.y]).toEqual(topLeft[r]);
      const corners = [[0, 0], [vw, 0], [0, vh], [vw, vh]].map(([x, y]) => visualToUser(x!, y!, box, r));
      const xs = corners.map((c) => c.x).sort((a, b) => a - b);
      const ys = corners.map((c) => c.y).sort((a, b) => a - b);
      expect([xs[0], xs[3], ys[0], ys[3]]).toEqual([10, 610, 20, 820]);
    });

    it(`rotation ${r}: the whole displayed page maps to the whole crop box`, () => {
      const { width, height } = visualSize(box, r);
      expect(visualRectToUser({ x: 0, y: 0, width, height }, box, r)).toEqual(box);
    });
  }

  it('swaps width and height for sideways pages', () => {
    expect(visualSize(box, 90)).toEqual({ width: 800, height: 600 });
    expect(visualSize(box, 180)).toEqual({ width: 600, height: 800 });
  });

  it('normalises any multiple of 90, including negatives', () => {
    expect(normalizeRotation(-90)).toBe(270);
    expect(normalizeRotation(450)).toBe(90);
  });
});
