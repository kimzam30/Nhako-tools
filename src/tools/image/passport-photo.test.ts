import { describe, it, expect } from 'vitest';
import { PRESETS, clampView, mmToPx, setJpegDpi, sheetLayout } from './passport-photo';

describe('passport photo geometry', () => {
  it('converts 35 x 50 mm to pixels at 600 and 300 dpi', () => {
    expect([mmToPx(35, 600), mmToPx(50, 600)]).toEqual([827, 1181]);
    expect([mmToPx(35, 300), mmToPx(50, 300)]).toEqual([413, 591]);
  });

  it('fits four 35 x 50 mm photos on a 4R sheet with margins a borderless print will not trim', () => {
    // Two rows need 100 mm + gutter on a 101.6 mm sheet: an 8-up layout
    // leaves under 1 mm, and the shop's borderless trim would cut the photos
    // below 50 mm. Four copies with real margins is the honest layout.
    const l = sheetLayout({ widthMm: 35, heightMm: 50 });
    expect([l.width, l.height]).toEqual([1800, 1200]);
    expect(l.slots).toHaveLength(4);
    const margin = mmToPx(3, 300);
    for (const s of l.slots) {
      expect(s.x).toBeGreaterThanOrEqual(margin);
      expect(s.y).toBeGreaterThanOrEqual(margin);
      expect(s.x + l.photoW).toBeLessThanOrEqual(l.width - margin);
      expect(s.y + l.photoH).toBeLessThanOrEqual(l.height - margin);
    }
  });

  it('keeps the frame inside the image however far it is dragged', () => {
    // 1000 x 1000 source, 35:50 frame: at zoom 1 the frame is 700 x 1000.
    const v = clampView({ zoom: 1, cx: -500, cy: 5000 }, 1000, 1000, 35, 50);
    expect(v.cx).toBeCloseTo(350, 5);
    expect(v.cy).toBeCloseTo(500, 5);
    expect(clampView({ zoom: 0.2, cx: 500, cy: 500 }, 1000, 1000, 35, 50).zoom).toBe(1);
  });

  it('only ships presets that cite a checked source, plus Custom', () => {
    for (const p of PRESETS) {
      if (p.id === 'custom') continue;
      expect(p.source?.url, p.id).toMatch(/^https:\/\/[^/]*\.gov\.my\//);
      expect(p.source?.checked, p.id).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
});

describe('setJpegDpi', () => {
  // A minimal JFIF APP0 header: SOI, APP0, length 16, "JFIF\0", v1.01, units 0, 1 x 1.
  const header = () => new Uint8Array([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01,
    0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00,
  ]);

  it('writes dots-per-inch units and density', () => {
    const out = setJpegDpi(header(), 600);
    expect(out[13]).toBe(1);
    expect((out[14]! << 8) | out[15]!).toBe(600);
    expect((out[16]! << 8) | out[17]!).toBe(600);
  });

  it('leaves anything that is not JFIF untouched', () => {
    const exif = header();
    exif[3] = 0xe1; // APP1 (Exif) instead of APP0
    expect(setJpegDpi(exif, 300)).toBe(exif);
  });
});
