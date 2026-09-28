import { describe, expect, it } from 'vitest';
import { unpredictPng } from './shrink-images';

/** Filter rows the way a PNG encoder does, so the decoder is tested against the spec, not itself. */
function predict(rows: number[][], bpp: number, types: number[]): Uint8Array {
  const out: number[] = [];
  rows.forEach((row, r) => {
    const t = types[r]!;
    out.push(t);
    row.forEach((x, i) => {
      const a = i >= bpp ? row[i - bpp]! : 0;
      const b = r > 0 ? rows[r - 1]![i]! : 0;
      const c = r > 0 && i >= bpp ? rows[r - 1]![i - bpp]! : 0;
      const p = a + b - c;
      const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
      const paeth = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      const pred = [0, a, b, (a + b) >> 1, paeth][t]!;
      out.push((x - pred) & 0xff);
    });
  });
  return new Uint8Array(out);
}

describe('unpredictPng', () => {
  const rows = [
    [10, 20, 30, 200, 210, 220],
    [15, 25, 35, 190, 5, 250],
    [0, 255, 128, 64, 32, 16],
    [99, 98, 97, 96, 95, 94],
    [1, 2, 3, 4, 5, 6],
  ];
  it('undoes every PNG filter type (None, Sub, Up, Average, Paeth) on RGB rows', () => {
    const filtered = predict(rows, 3, [0, 1, 2, 3, 4]);
    expect(Array.from(unpredictPng(filtered, 6, 3))).toEqual(rows.flat());
  });
  it('handles grey (1 byte per pixel) with Paeth on the first row', () => {
    const grey = [[5, 10, 250, 3], [7, 7, 7, 7]];
    const filtered = predict(grey, 1, [4, 3]);
    expect(Array.from(unpredictPng(filtered, 4, 1))).toEqual(grey.flat());
  });
});
