import { describe, expect, it } from 'vitest';
import { grayContent, type GrayReport } from './gray-vector';

const run = (src: string, spaces: Record<string, 'rgb' | 'cmyk' | 'gray'> = {}) => {
  const report: GrayReport = { streams: 0, changedOps: 0, untouched: 0, images: 0, imagesUntouched: 0 };
  const out = new TextDecoder('latin1').decode(grayContent(Uint8Array.from(src, (c) => c.charCodeAt(0)), (n) => (spaces[n] ? { kind: spaces[n]! } : null), report));
  return { out, report };
};

describe('grayContent', () => {
  it('turns rg/RG and k/K into g/G with Rec. 709 luma', () => {
    expect(run('1 0 0 rg 0 0 1 RG').out).toBe('0.2126 g 0.0722 G');
    expect(run('0 0 0 1 k 0 0 0 0 K').out).toBe('0 g 1 G');
  });
  it('rewrites a device or resource colour space and the components that follow', () => {
    expect(run('/DeviceRGB cs 0 1 0 sc').out).toBe('/DeviceGray cs 0.7152 sc');
    expect(run('/CS1 CS 1 1 1 SCN', { CS1: 'rgb' }).out).toBe('/DeviceGray CS 1 SCN');
  });
  it('leaves a space it cannot convert alone, and counts it', () => {
    const r = run('/Spot cs 0.5 scn');
    expect(r.out).toBe('/Spot cs 0.5 scn');
    expect(r.report.untouched).toBe(1);
  });
  it('is not fooled by operator names inside strings, arrays or inline image data', () => {
    const src = 'BT (1 0 0 rg) Tj [(k) 20 (K)] TJ ET BI /W 1 /H 1 /CS /RGB /BPC 8 ID ÿ\u0000rg\u0000 EI 1 0 0 rg';
    const { out } = run(src);
    expect(out.startsWith('BT (1 0 0 rg) Tj [(k) 20 (K)] TJ ET BI /W 1 /H 1 /CS /RGB /BPC 8 ID ÿ\u0000rg\u0000 EI')).toBe(true);
    expect(out.endsWith('0.2126 g')).toBe(true);
  });
  it('keeps nested parentheses and escapes in strings intact', () => {
    expect(run('(a \\) (b) c) Tj 0 1 0 rg').out).toBe('(a \\) (b) c) Tj 0.7152 g');
  });
});
