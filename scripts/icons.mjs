/**
 * Write the favicon and every PNG icon from the mascot in mascot-art.mjs.
 * Run: npm run icons
 *
 * Each PNG is encoded directly with node:zlib: no browser, no image dependency. The mascot is a 48px grid,
 * so sizes that are a whole multiple of 48 stay hard pixel edges; other sizes
 * step each output pixel to its nearest cell when growing, and average the
 * cells under it when shrinking (16 and 32, where nearest would drop rows).
 *
 * Shapes, because platforms mask icons differently:
 *   - `any` icons and the favicon: the mascot with stepped pixel corners.
 *   - apple-touch-icon: full bleed, no transparency. iOS rounds the corners
 *     itself and fills transparent pixels with black.
 *   - maskable: full bleed too. The mascot is drawn coming in from a corner
 *     and cropped by the edge, and its face sits inside Android's safe circle,
 *     so the crop only takes ground and the edges that were cropped anyway.
 */
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { ICON, LABEL, PALETTE, rounded } from './mascot-art.mjs';

const rgba = (k) => {
  if (k === '.') return [0, 0, 0, 0];
  const hex = PALETTE[k];
  if (!hex) throw new Error(`mascot-art: no colour for "${k}"`);
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).concat(255);
};

const CRC = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
};

function encode(size, pixel, opaque) {
  const bpp = opaque ? 3 : 4;
  const raw = Buffer.alloc(size * (1 + size * bpp));
  for (let y = 0; y < size; y++) {
    const line = y * (1 + size * bpp); // filter byte 0 = none
    for (let x = 0; x < size; x++) {
      const px = pixel(x, y);
      for (let i = 0; i < bpp; i++) raw[line + 1 + x * bpp + i] = px[i];
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = opaque ? 2 : 6; // truecolour, or truecolour with alpha
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// The grid at any size: nearest cell when growing, the alpha-weighted mean of
// the cells under each pixel when shrinking.
function png(rows, size) {
  const n = rows.length;
  const opaque = rows.every((r) => !r.includes('.'));
  if (size >= n) {
    return encode(size, (x, y) => rgba(rows[Math.floor((y * n) / size)][Math.floor((x * n) / size)]), opaque);
  }
  const step = n / size;
  const at = (x, y) => {
    let a = 0;
    const sum = [0, 0, 0];
    let count = 0;
    for (let cy = Math.floor(y * step); cy < Math.ceil((y + 1) * step); cy++) {
      for (let cx = Math.floor(x * step); cx < Math.ceil((x + 1) * step); cx++) {
        const c = rgba(rows[cy][cx]);
        a += c[3];
        for (let i = 0; i < 3; i++) sum[i] += c[i] * c[3];
        count++;
      }
    }
    if (!a) return [0, 0, 0, 0];
    return sum.map((s) => Math.round(s / a)).concat(Math.round(a / count));
  };
  return encode(size, at, opaque);
}

// favicon.ico for whatever asks for it by name: older browsers, Windows
// shortcuts, crawlers and RSS readers. PNG entries, which every ICO reader
// since Windows Vista accepts.
function ico(entries) {
  const head = Buffer.alloc(6 + 16 * entries.length);
  head.writeUInt16LE(1, 2); // type: icon
  head.writeUInt16LE(entries.length, 4);
  let offset = head.length;
  entries.forEach(([size, data], i) => {
    const e = 6 + 16 * i;
    head[e] = size % 256; // 0 means 256
    head[e + 1] = size % 256;
    head.writeUInt16LE(1, e + 4); // colour planes
    head.writeUInt16LE(32, e + 6); // bits per pixel
    head.writeUInt32LE(data.length, e + 8);
    head.writeUInt32LE(offset, e + 12);
    offset += data.length;
  });
  return Buffer.concat([head, ...entries.map(([, data]) => data)]);
}

// One <path> per colour made of that colour's horizontal runs.
function svg(rows) {
  const n = rows.length;
  const runs = {};
  rows.forEach((row, y) => {
    for (let x = 0; x < n; ) {
      let end = x + 1;
      while (end < n && row[end] === row[x]) end++;
      if (row[x] !== '.') (runs[row[x]] ??= []).push(`M${x} ${y}h${end - x}v1h${x - end}z`);
      x = end;
    }
  });
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n} ${n}" shape-rendering="crispEdges" role="img" aria-label="${LABEL}">\n` +
    Object.entries(runs).map(([k, d]) => `<path fill="${PALETTE[k]}" d="${d.join('')}"/>`).join('\n') +
    '\n</svg>\n'
  );
}

const favicon = rounded(ICON);

writeFileSync('public/favicon.svg', svg(favicon));
console.log('  public/favicon.svg');
writeFileSync('public/favicon.ico', ico([16, 32, 48, 64].map((s) => [s, png(favicon, s)])));
console.log('  public/favicon.ico  16, 32, 48, 64');
for (const [rows, size, out] of [
  [ICON, 180, 'public/icons/apple-touch-icon.png'],
  [favicon, 192, 'public/icons/icon-192.png'],
  [favicon, 512, 'public/icons/icon-512.png'],
  [ICON, 192, 'public/icons/maskable-192.png'],
  [ICON, 512, 'public/icons/maskable-512.png'],
]) {
  writeFileSync(out, png(rows, size));
  console.log(`  ${out}  ${size}x${size}`);
}
