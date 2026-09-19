import { describe, it, expect } from 'vitest';
import { stripMetadata, readExif, minimalExif } from './metadata';

/**
 * Build a real EXIF block by hand: big-endian TIFF with Make, Model,
 * Orientation, an Exif sub-IFD with DateTimeOriginal, and a GPS sub-IFD at
 * 3° 8' 20.4" N, 101° 41' 7.2" E (Kuala Lumpur).
 */
function exifTiff(orientation = 6): Uint8Array {
  const b: number[] = [];
  const u16 = (v: number) => b.push((v >> 8) & 255, v & 255);
  const u32 = (v: number) => b.push((v >>> 24) & 255, (v >> 16) & 255, (v >> 8) & 255, v & 255);
  const at = (o: number, v: number) => { b[o] = (v >>> 24) & 255; b[o + 1] = (v >> 16) & 255; b[o + 2] = (v >> 8) & 255; b[o + 3] = v & 255; };
  const text = (s: string) => { for (const c of s) b.push(c.charCodeAt(0)); b.push(0); };

  b.push(0x4d, 0x4d); u16(42); u32(8);
  // IFD0: Make, Model, Orientation, ExifIFD, GPSIFD
  u16(5);
  const entry = (tag: number, type: number, count: number) => { u16(tag); u16(type); u32(count); const o = b.length; u32(0); return o; };
  const make = entry(0x010f, 2, 6);
  const model = entry(0x0110, 2, 17);
  const orient = entry(0x0112, 3, 1);
  const exifPtr = entry(0x8769, 4, 1);
  const gpsPtr = entry(0x8825, 4, 1);
  u32(0);
  b[orient] = 0; b[orient + 1] = orientation;
  at(make, b.length); text('Apple');
  at(model, b.length); text('Apple iPhone 15');
  // Exif IFD
  at(exifPtr, b.length); u16(1);
  const dto = entry(0x9003, 2, 20); u32(0);
  at(dto, b.length); text('2026:09:01 10:22:11');
  // GPS IFD
  at(gpsPtr, b.length); u16(4);
  const latRef = entry(0x0001, 2, 2);
  const lat = entry(0x0002, 5, 3);
  const lonRef = entry(0x0003, 2, 2);
  const lon = entry(0x0004, 5, 3);
  u32(0);
  b[latRef] = 0x4e; // "N"
  b[lonRef] = 0x45; // "E"
  at(lat, b.length); u32(3); u32(1); u32(8); u32(1); u32(204); u32(10);
  at(lon, b.length); u32(101); u32(1); u32(41); u32(1); u32(72); u32(10);
  return new Uint8Array(b);
}

function segment(marker: number, payload: Uint8Array) {
  const len = payload.length + 2;
  return new Uint8Array([0xff, marker, len >> 8, len & 255, ...payload]);
}

const enc = (s: string) => new Uint8Array([...s].map((c) => c.charCodeAt(0)));
const cat = (...parts: Uint8Array[]) => new Uint8Array(parts.flatMap((p) => [...p]));

/** SOI, JFIF, EXIF, ICC, a comment, DQT, SOS + "pixels", EOI. */
function jpeg(orientation = 6) {
  return cat(
    new Uint8Array([0xff, 0xd8]),
    segment(0xe0, enc('JFIF\0\x01\x01\0\0\x01\0\x01\0\0')),
    segment(0xe1, cat(enc('Exif\0\0'), exifTiff(orientation))),
    segment(0xe2, cat(enc('ICC_PROFILE\0'), new Uint8Array([1, 1, 9, 9]))),
    segment(0xfe, enc('made by some app')),
    segment(0xdb, new Uint8Array(65)),
    new Uint8Array([0xff, 0xda, 0, 2, 0x11, 0x22, 0x33, 0xff, 0xd9]),
  );
}

describe('EXIF reading', () => {
  it('finds GPS, camera and date', () => {
    const { orientation, found } = readExif(exifTiff());
    expect(orientation).toBe(6);
    expect(found.camera).toBe('Apple iPhone 15');
    expect(found.taken).toBe('2026:09:01 10:22:11');
    expect(found.gps!.lat).toBeCloseTo(3.139, 3);
    expect(found.gps!.lon).toBeCloseTo(101.6853, 3);
  });
});

describe('stripMetadata, JPEG', () => {
  const out = stripMetadata(jpeg());
  const bytes = out.bytes;
  const has = (needle: string) => new TextDecoder('latin1').decode(bytes).includes(needle);

  it('removes EXIF content and comments', () => {
    expect(has('iPhone')).toBe(false);
    expect(has('made by some app')).toBe(false);
    expect(out.found.gps).toBeDefined();
  });

  it('keeps the colour profile, JFIF and the image data untouched', () => {
    expect(has('ICC_PROFILE')).toBe(true);
    expect(has('JFIF')).toBe(true);
    const tail = jpeg().slice(-9);
    expect([...bytes.slice(-9)]).toEqual([...tail]);
  });

  it('keeps orientation alone, so a portrait photo does not turn sideways', () => {
    const again = stripMetadata(bytes);
    expect(again.found.fields).toBe(1); // just Orientation
    const exifAt = [...bytes].findIndex((v, i) => v === 0xff && bytes[i + 1] === 0xe1);
    const { orientation } = readExif(bytes.subarray(exifAt + 10));
    expect(orientation).toBe(6);
  });

  it('adds no EXIF at all when orientation is normal', () => {
    const plain = stripMetadata(jpeg(1)).bytes;
    expect(new TextDecoder('latin1').decode(plain).includes('Exif')).toBe(false);
  });

  it('writes a minimal EXIF block that reads back', () => {
    const seg = minimalExif(8);
    expect(readExif(seg.subarray(10)).orientation).toBe(8);
  });
});

describe('stripMetadata, PNG', () => {
  const crc = new Uint8Array(4);
  const chunk = (type: string, data: Uint8Array) => {
    const len = data.length;
    return cat(new Uint8Array([len >>> 24, (len >> 16) & 255, (len >> 8) & 255, len & 255]), enc(type), data, crc);
  };
  const png = cat(
    new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', new Uint8Array(13)),
    chunk('tEXt', enc('Author\0Someone')),
    chunk('iCCP', enc('icc\0\0xx')),
    chunk('IDAT', new Uint8Array([1, 2, 3])),
    chunk('IEND', new Uint8Array(0)),
  );

  it('drops text chunks and keeps IHDR, iCCP, IDAT and IEND in order', () => {
    const out = stripMetadata(png);
    const text = new TextDecoder('latin1').decode(out.bytes);
    expect(text.includes('Someone')).toBe(false);
    expect(['IHDR', 'iCCP', 'IDAT', 'IEND'].map((t) => text.indexOf(t))).toEqual(
      [...['IHDR', 'iCCP', 'IDAT', 'IEND'].map((t) => text.indexOf(t))].sort((a, b) => a - b),
    );
    expect(out.found.fields).toBe(1);
  });
});

describe('stripMetadata, WebP', () => {
  const chunk = (type: string, data: Uint8Array) => {
    const len = data.length;
    return cat(enc(type), new Uint8Array([len & 255, (len >> 8) & 255, (len >> 16) & 255, len >>> 24]), data, len & 1 ? new Uint8Array(1) : new Uint8Array(0));
  };
  const vp8x = new Uint8Array(10); vp8x[0] = 0x08 | 0x04; // has EXIF + XMP
  const body = cat(enc('WEBP'), chunk('VP8X', vp8x), chunk('VP8 ', new Uint8Array(11)), chunk('EXIF', exifTiff()), chunk('XMP ', enc('<x/>')));
  const size = body.length;
  const webp = cat(enc('RIFF'), new Uint8Array([size & 255, (size >> 8) & 255, (size >> 16) & 255, size >>> 24]), body);

  it('removes EXIF and XMP, clears their flags and fixes the RIFF size', () => {
    const out = stripMetadata(webp);
    const b = out.bytes;
    const riff = b[4]! | (b[5]! << 8) | (b[6]! << 16) | (b[7]! << 24);
    expect(riff).toBe(b.length - 8);
    const text = new TextDecoder('latin1').decode(b);
    expect(text.includes('EXIF')).toBe(false);
    expect(text.includes('XMP ')).toBe(false);
    expect(b[20]! & 0x0c).toBe(0); // VP8X flags byte: chunk header 12 + 8
    expect(out.found.camera).toBe('Apple iPhone 15');
  });
});

describe('stripMetadata, other formats', () => {
  it('refuses GIF', () => {
    expect(() => stripMetadata(enc('GIF89a....'))).toThrow(/JPG, PNG and WebP/);
  });
});
