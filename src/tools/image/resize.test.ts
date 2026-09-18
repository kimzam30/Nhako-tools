import { describe, it, expect } from 'vitest';
import { targetSize } from './resize';

describe('resize target size', () => {
  it('derives the missing axis from the aspect ratio', () => {
    expect(targetSize({ width: 2000, height: 1000 }, { width: 1000, height: 0 }, true)).toEqual({ width: 1000, height: 500 });
  });

  it('leaves an image already smaller than the target at its own size', () => {
    expect(targetSize({ width: 800, height: 600 }, { width: 1280, height: 0 }, true)).toEqual({ width: 800, height: 600 });
  });

  it('never enlarges either axis when both are set', () => {
    // Used to return 2000 x 100: the width was stretched because only
    // "both axes larger" was checked.
    const size = targetSize({ width: 1000, height: 1000 }, { width: 2000, height: 100 }, true);
    expect(size.width).toBeLessThanOrEqual(1000);
    expect(size.height).toBeLessThanOrEqual(1000);
    expect(size).toEqual({ width: 1000, height: 50 });
  });

  it('enlarges when allowed', () => {
    expect(targetSize({ width: 100, height: 50 }, { width: 400, height: 0 }, false)).toEqual({ width: 400, height: 200 });
  });
});
