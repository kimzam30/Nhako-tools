import { describe, it, expect } from 'vitest';
import { bytes, duration, pct } from './format';
import { parsePageRange } from './range';
import { ToolError } from '../tools/types';

describe('byte formatting', () => {
  it('formats across unit boundaries', () => {
    expect(bytes(0)).toBe('0 B');
    expect(bytes(999)).toBe('999 B');
    expect(bytes(1024)).toBe('1.0 KB');
    expect(bytes(1536)).toBe('1.5 KB');
    expect(bytes(1024 * 1024)).toBe('1.0 MB');
    expect(bytes(1024 * 1024 * 1024)).toBe('1.0 GB');
  });

  it('drops the decimal once the number is large enough not to need it', () => {
    expect(bytes(15 * 1024)).toBe('15 KB');
  });

  it('does not render NaN or negatives as a size', () => {
    expect(bytes(Number.NaN)).toBe('n/a');
    expect(bytes(-1)).toBe('n/a');
  });
});

describe('duration formatting', () => {
  it('uses milliseconds under a second — the common case', () => {
    expect(duration(412)).toBe('412ms');
  });
  it('switches to seconds and minutes as needed', () => {
    expect(duration(1500)).toBe('1.5s');
    expect(duration(125_000)).toBe('2m 5s');
  });
  it('handles nonsense input', () => {
    expect(duration(Number.NaN)).toBe('n/a');
  });
});

describe('percentage saved', () => {
  it('reports the reduction', () => {
    expect(pct(50, 100)).toBe('50%');
  });
  it('does not divide by zero', () => {
    expect(pct(10, 0)).toBe('n/a');
  });
});

describe('page range parsing', () => {
  it('treats empty as every page', () => {
    expect(parsePageRange('', 3)).toEqual([0, 1, 2]);
    expect(parsePageRange('   ', 3)).toEqual([0, 1, 2]);
  });

  it('parses single pages, ranges and mixtures, zero-indexed', () => {
    expect(parsePageRange('1', 5)).toEqual([0]);
    expect(parsePageRange('2-4', 5)).toEqual([1, 2, 3]);
    expect(parsePageRange('1, 3-4', 5)).toEqual([0, 2, 3]);
  });

  it('tolerates loose spacing', () => {
    expect(parsePageRange(' 1 - 2 ,3 ', 5)).toEqual([0, 1, 2]);
  });

  it('de-duplicates and sorts overlapping input', () => {
    expect(parsePageRange('3,1-2,2', 5)).toEqual([0, 1, 2]);
  });

  it('rejects a range beyond the document with a message naming the real length', () => {
    expect(() => parsePageRange('1-99', 5)).toThrow(/has 5 pages/);
  });

  it('rejects page zero, since documents start at 1', () => {
    expect(() => parsePageRange('0', 5)).toThrow(/numbered from 1/);
  });

  it('suggests the fix for a backwards range', () => {
    expect(() => parsePageRange('4-2', 5)).toThrow(/Write it as 2-4/);
  });

  it('rejects unparseable input rather than silently ignoring it', () => {
    for (const bad of ['abc', '1..3', '1;2', '-']) {
      expect(() => parsePageRange(bad, 5), bad).toThrow(ToolError);
    }
  });

  it('uses the singular for a one-page document', () => {
    expect(() => parsePageRange('2', 1)).toThrow(/has 1 page,/);
  });
});
