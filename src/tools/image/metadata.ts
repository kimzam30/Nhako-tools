/**
 * Read and remove photo metadata WITHOUT re-encoding the image.
 *
 * Re-drawing through a canvas would also strip metadata, but it recompresses
 * every pixel. Working on the file's own structure keeps the picture
 * byte-for-byte identical and removes only the labels around it.
 *
 * Kept on purpose: colour profiles (ICC, sRGB, gamma), JFIF, the Adobe marker
 * that CMYK JPEGs need to decode, and, for JPEG, the Orientation tag alone,
 * rewritten into a minimal EXIF block. Dropping orientation would make a
 * portrait phone photo suddenly display sideways.
 */

export interface Found {
  gps?: { lat: number; lon: number };
  camera?: string;
  taken?: string;
  software?: string;
  /** Number of metadata fields or blocks removed in total. */
  fields: number;
}

export interface Stripped {
  bytes: Uint8Array;
  format: 'jpeg' | 'png' | 'webp';
  found: Found;
  removedBytes: number;
}

export class UnsupportedFormat extends Error {}

export function stripMetadata(input: Uint8Array): Stripped {
  if (input[0] === 0xff && input[1] === 0xd8) return stripJpeg(input);
  if (input[0] === 0x89 && ascii(input, 1, 3) === 'PNG') return stripPng(input);
  if (ascii(input, 0, 4) === 'RIFF' && ascii(input, 8, 4) === 'WEBP') return stripWebp(input);
  throw new UnsupportedFormat('Only JPG, PNG and WebP are supported.');
}

const ascii = (b: Uint8Array, at: number, n: number) => String.fromCharCode(...b.subarray(at, at + n));

function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) { out.set(p, at); at += p.length; }
  return out;
}

// ─── JPEG ────────────────────────────────────────────────────────────────────

function stripJpeg(b: Uint8Array): Stripped {
  const keep: Uint8Array[] = [b.subarray(0, 2)];
  const found: Found = { fields: 0 };
  let orientation = 1;
  let i = 2;

  while (i + 4 <= b.length) {
    if (b[i] !== 0xff) break; // corrupt: stop and keep the rest as-is
    const marker = b[i + 1]!;
    // Start of scan: everything after is image data.
    if (marker === 0xda) { keep.push(b.subarray(i)); i = b.length; break; }
    const len = (b[i + 2]! << 8) | b[i + 3]!;
    const segment = b.subarray(i, i + 2 + len);
    const body = b.subarray(i + 4, i + 2 + len);

    const isApp = marker >= 0xe0 && marker <= 0xef;
    const isExif = marker === 0xe1 && ascii(body, 0, 6) === 'Exif\0\0';
    const keepIt =
      !isApp && marker !== 0xfe // not APPn, not a comment
      || marker === 0xe0 // JFIF
      || (marker === 0xe2 && ascii(body, 0, 12) === 'ICC_PROFILE\0') // colour profile
      || (marker === 0xee && ascii(body, 0, 5) === 'Adobe'); // CMYK decoding needs it

    if (isExif) {
      const read = readExif(body.subarray(6));
      orientation = read.orientation;
      Object.assign(found, { ...read.found, fields: found.fields + read.found.fields });
    } else if (!keepIt) {
      found.fields += 1;
    }
    if (keepIt) keep.push(segment);
    i += 2 + len;
  }

  // Put orientation back as the only EXIF field, right after SOI/JFIF.
  if (orientation !== 1) keep.splice(keep[1] && keep[1][1] === 0xe0 ? 2 : 1, 0, minimalExif(orientation));
  const bytes = concat(keep);
  return { bytes, format: 'jpeg', found, removedBytes: b.length - bytes.length };
}

/** An APP1 EXIF segment holding nothing but the Orientation tag. */
export function minimalExif(orientation: number): Uint8Array {
  const tiff = [
    0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00, // little-endian TIFF, IFD0 at 8
    0x01, 0x00, // one entry
    0x12, 0x01, 0x03, 0x00, 0x01, 0x00, 0x00, 0x00, orientation & 0xff, 0x00, 0x00, 0x00, // 0x0112 SHORT 1
    0x00, 0x00, 0x00, 0x00, // no next IFD
  ];
  const payload = [...'Exif\0\0'].map((c) => c.charCodeAt(0)).concat(tiff);
  const len = payload.length + 2;
  return new Uint8Array([0xff, 0xe1, len >> 8, len & 0xff, ...payload]);
}

/** Pull out what a person would care about, and count everything. */
export function readExif(tiff: Uint8Array): { orientation: number; found: Found } {
  const found: Found = { fields: 0 };
  let orientation = 1;
  if (tiff.length < 8) return { orientation, found };
  const le = tiff[0] === 0x49;
  const u16 = (o: number) => (le ? tiff[o]! | (tiff[o + 1]! << 8) : (tiff[o]! << 8) | tiff[o + 1]!);
  const u32 = (o: number) => (le
    ? (tiff[o]! | (tiff[o + 1]! << 8) | (tiff[o + 2]! << 16) | (tiff[o + 3]! << 24)) >>> 0
    : ((tiff[o]! << 24) | (tiff[o + 1]! << 16) | (tiff[o + 2]! << 8) | tiff[o + 3]!) >>> 0);
  const str = (entry: number) => {
    const count = u32(entry + 4);
    const at = count > 4 ? u32(entry + 8) : entry + 8;
    return ascii(tiff, at, Math.max(0, count - 1)).replace(/\0+$/, '').trim();
  };
  const rational3 = (entry: number) => {
    const at = u32(entry + 8);
    const r = (k: number) => u32(at + k * 8) / (u32(at + k * 8 + 4) || 1);
    return r(0) + r(1) / 60 + r(2) / 3600;
  };

  const tags = new Map<number, number>(); // tag -> entry offset, across IFDs
  const walk = (ifd: number, depth: number) => {
    if (ifd <= 0 || ifd + 2 > tiff.length || depth > 3) return;
    const count = u16(ifd);
    for (let k = 0; k < count; k++) {
      const entry = ifd + 2 + k * 12;
      if (entry + 12 > tiff.length) return;
      const tag = u16(entry);
      found.fields += 1;
      if (!tags.has(tag)) tags.set(tag, entry);
      if (tag === 0x8769 || tag === 0x8825) walk(u32(entry + 8), depth + 1); // Exif, GPS sub-IFDs
    }
  };

  try {
    walk(u32(4), 0);
    const e = (t: number) => tags.get(t);
    if (e(0x0112) !== undefined) orientation = u16(e(0x0112)! + 8);
    const make = e(0x010f) !== undefined ? str(e(0x010f)!) : '';
    const model = e(0x0110) !== undefined ? str(e(0x0110)!) : '';
    if (make || model) found.camera = model.startsWith(make) ? model : `${make} ${model}`.trim();
    const taken = e(0x9003) ?? e(0x0132);
    if (taken !== undefined) found.taken = str(taken);
    if (e(0x0131) !== undefined) found.software = str(e(0x0131)!);
    if (e(0x0002) !== undefined && e(0x0004) !== undefined) {
      const lat = rational3(e(0x0002)!) * (e(0x0001) !== undefined && str(e(0x0001)!) === 'S' ? -1 : 1);
      const lon = rational3(e(0x0004)!) * (e(0x0003) !== undefined && str(e(0x0003)!) === 'W' ? -1 : 1);
      if (Number.isFinite(lat) && Number.isFinite(lon)) found.gps = { lat, lon };
    }
  } catch {
    // Malformed EXIF: still removed, just not described.
  }
  return { orientation, found };
}

// ─── PNG ─────────────────────────────────────────────────────────────────────

const PNG_METADATA = new Set(['tEXt', 'zTXt', 'iTXt', 'eXIf', 'tIME']);

function stripPng(b: Uint8Array): Stripped {
  const keep: Uint8Array[] = [b.subarray(0, 8)];
  const found: Found = { fields: 0 };
  let i = 8;
  while (i + 12 <= b.length) {
    const len = ((b[i]! << 24) | (b[i + 1]! << 16) | (b[i + 2]! << 8) | b[i + 3]!) >>> 0;
    const type = ascii(b, i + 4, 4);
    const end = i + 12 + len;
    if (type === 'eXIf') {
      const read = readExif(b.subarray(i + 8, i + 8 + len));
      Object.assign(found, { ...read.found, fields: found.fields + read.found.fields });
    } else if (PNG_METADATA.has(type)) {
      found.fields += 1;
    }
    if (!PNG_METADATA.has(type)) keep.push(b.subarray(i, end));
    i = end;
    if (type === 'IEND') break;
  }
  const bytes = concat(keep);
  return { bytes, format: 'png', found, removedBytes: b.length - bytes.length };
}

// ─── WebP ────────────────────────────────────────────────────────────────────

function stripWebp(b: Uint8Array): Stripped {
  const keep: Uint8Array[] = [];
  const found: Found = { fields: 0 };
  let i = 12;
  let vp8x: Uint8Array | null = null;
  while (i + 8 <= b.length) {
    const type = ascii(b, i, 4);
    const len = (b[i + 4]! | (b[i + 5]! << 8) | (b[i + 6]! << 16) | (b[i + 7]! << 24)) >>> 0;
    const end = i + 8 + len + (len & 1); // chunks are padded to even length
    const chunk = b.slice(i, end);
    if (type === 'EXIF') {
      const read = readExif(b.subarray(i + 8, i + 8 + len));
      Object.assign(found, { ...read.found, fields: found.fields + read.found.fields });
    } else if (type === 'XMP ') {
      found.fields += 1;
    } else {
      if (type === 'VP8X') vp8x = chunk;
      keep.push(chunk);
    }
    i = end;
  }
  // Clear the "has EXIF" (0x08) and "has XMP" (0x04) flags.
  if (vp8x) vp8x[8] = vp8x[8]! & ~0x0c;
  const body = concat(keep);
  const size = body.length + 4;
  const header = new Uint8Array([
    0x52, 0x49, 0x46, 0x46, size & 0xff, (size >> 8) & 0xff, (size >> 16) & 0xff, (size >>> 24) & 0xff,
    0x57, 0x45, 0x42, 0x50,
  ]);
  const bytes = concat([header, body]);
  return { bytes, format: 'webp', found, removedBytes: b.length - bytes.length };
}
