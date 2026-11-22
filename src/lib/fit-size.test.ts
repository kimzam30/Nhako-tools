import { describe, it, expect } from 'vitest';
import { fitToSize, scalesFor } from './fit-size';

/** A fake encoder whose output grows with quality and with pixel count. */
const fake = (bytesAtFull: number) => async (quality: number, scale: number) =>
  new Blob([new Uint8Array(Math.round(bytesAtFull * quality * scale * scale))]);

describe('fitToSize', () => {
  it('keeps maximum quality when that already fits', async () => {
    const r = await fitToSize(fake(100_000), 200_000);
    expect(r).toMatchObject({ fits: true, quality: 0.92, scale: 1, attempts: 1 });
  });

  it('lowers quality before resolution', async () => {
    // At scale 1: 0.92 -> 92 KB (too big), 0.4 -> 40 KB (fits). Answer is in between.
    const r = await fitToSize(fake(100_000), 60_000);
    expect(r.fits).toBe(true);
    expect(r.scale).toBe(1);
    expect(r.blob.size).toBeLessThanOrEqual(60_000);
    expect(r.quality).toBeGreaterThan(0.5); // close to the 0.6 ceiling, not the floor
  });

  it('steps resolution down when the lowest quality is still too big', async () => {
    // 0.4 at scale 1 = 400 KB; needs roughly half the pixels.
    const r = await fitToSize(fake(1_000_000), 200_000);
    expect(r.fits).toBe(true);
    expect(r.scale).toBeLessThan(1);
    expect(r.blob.size).toBeLessThanOrEqual(200_000);
  });

  it('never returns a file over the target when it says it fits', async () => {
    for (const target of [5_000, 17_000, 50_000, 123_456, 480_000]) {
      const r = await fitToSize(fake(2_000_000), target);
      if (r.fits) expect(r.blob.size, String(target)).toBeLessThanOrEqual(target);
    }
  });

  it('reports failure with the smallest attempt when nothing fits', async () => {
    const r = await fitToSize(fake(100_000_000), 1_000);
    expect(r.fits).toBe(false);
    expect(r.quality).toBe(0.4);
    expect(r.scale).toBe(0.18);
  });
});

describe('scalesFor', () => {
  it('goes past 18% for a big camera photo, down to a 320 px long side', () => {
    const scales = scalesFor(5184, 3456);
    expect(scales[0]).toBe(1);
    expect(Math.min(...scales) * 5184).toBeCloseTo(320, 0);
    expect(scales.every((s, i) => i === 0 || s < scales[i - 1]!)).toBe(true);
  });
  it('never shrinks a small image below 320 px', () => {
    expect(scalesFor(640, 480).every((s) => s * 640 >= 320 - 1e-9)).toBe(true);
    expect(scalesFor(200, 100)).toEqual([1]);
  });
});
