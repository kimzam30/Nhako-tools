/**
 * Write the favicon and every PNG icon from the pixel art in logo-art.mjs.
 *
 * The art is a grid, so nothing here resamples: each PNG is the grid at a whole
 * multiple, encoded directly with node:zlib. No browser and no image
 * dependency, and every edge stays a hard pixel edge.
 *
 * Three shapes, because the platforms mask icons differently:
 *   - `any` and the favicon: the art with stepped pixel corners. Desktop
 *     install dialogs and the Chrome app list show it unmasked.
 *   - apple-touch-icon: full bleed, no transparency. iOS draws its own rounded
 *     corners and fills any transparent pixel with BLACK, so the favicon's
 *     rounded rect came out as a pink tile with black corners on a home screen.
 *   - maskable: the art on a wider lawn. Android's adaptive mask shows only
 *     the middle 72/108 (a 33.3% radius), and on the emulator's launcher the
 *     old mark all but touched the edge at full size (checked 2026-09-25). At
 *     512 the art is drawn at 10x, 62% of the width, one cell below centre so
 *     the tool tips and the box's bottom corners sit equally far out; the
 *     farthest corner of any art pixel is 32.5% out (measured). 11x clips the
 *     screwdriver. 192 has no whole scale between 3x (50%) and 4x (67%, clips),
 *     so it stays at 3x.
 */
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { ICON, PALETTE, onLawn, rounded } from './logo-art.mjs';

const rgba = (k) => {
  if (k === '.') return [0, 0, 0, 0];
  const hex = PALETTE[k];
  if (!hex) throw new Error(`logo-art: no colour for "${k}"`);
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

// `crop` trims that many pixels of lawn off every side, for a size the grid
// does not divide: 52 cells at 10x is 520, trimmed to 512.
function png(rows, scale, crop = 0) {
  const size = rows.length * scale - 2 * crop;
  const at = (x, y) => rgba(rows[Math.floor((y + crop) / scale)][Math.floor((x + crop) / scale)]);
  return encode(size, at, rows.every((r) => !r.includes('.')));
}

// Half size, each pixel the alpha-weighted mean of a 2x2 block of cells. Only
// for the 16px entry in favicon.ico, the one size smaller than the art.
function half(rows) {
  const at = (x, y) => {
    const cells = [[0, 0], [1, 0], [0, 1], [1, 1]].map(([dx, dy]) => rgba(rows[y * 2 + dy][x * 2 + dx]));
    const a = cells.reduce((t, c) => t + c[3], 0);
    if (!a) return [0, 0, 0, 0];
    return [0, 1, 2].map((i) => Math.round(cells.reduce((t, c) => t + c[i] * c[3], 0) / a)).concat(Math.round(a / 4));
  };
  return encode(rows.length / 2, at, false);
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

// The lawn as one stepped shape, then one <path> per colour made of that
// colour's horizontal runs. A <rect> per run was 431 elements and 25 KB.
function svg(rows) {
  const n = rows.length;
  const base = rows[Math.floor(n / 2)][0];
  const runs = {};
  rows.forEach((row, y) => {
    for (let x = 0; x < n; ) {
      let end = x + 1;
      while (end < n && row[end] === row[x]) end++;
      if (row[x] !== '.' && row[x] !== base) (runs[row[x]] ??= []).push(`M${x} ${y}h${end - x}v1h${x - end}z`);
      x = end;
    }
  });
  // The painted extent of every row, so the lawn's corners step with rounded().
  const edge = rows.map((r) => [r.search(/[^.]/), r.length - r.split('').reverse().join('').search(/[^.]/)]);
  const right = edge.map(([, r], y) => `L${r} ${y}L${r} ${y + 1}`).join('');
  const left = edge.map(([l], y) => `L${l} ${y + 1}L${l} ${y}`).reverse().join('');
  const lawn = `M${edge[0][0]} 0${right}${left}z`;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n} ${n}" shape-rendering="crispEdges" role="img" aria-label="Nhako Tools">\n` +
    `<path fill="${PALETTE[base]}" d="${lawn}"/>\n` +
    Object.entries(runs).map(([k, d]) => `<path fill="${PALETTE[k]}" d="${d.join('')}"/>`).join('\n') +
    '\n</svg>\n'
  );
}

const favicon = rounded(ICON);
const apple = onLawn(36); // 36 x 5 = 180
const maskable192 = onLawn(64, { dy: 1 }); // 64 x 3 = 192
const maskable512 = onLawn(52, { dy: 1 }); // 52 x 10 = 520, less 4px a side

writeFileSync('public/favicon.svg', svg(favicon));
console.log('  public/favicon.svg');
writeFileSync('public/favicon.ico', ico([[16, half(favicon)], [32, png(favicon, 1)], [64, png(favicon, 2)]]));
console.log('  public/favicon.ico  16, 32, 64');
for (const [rows, scale, out, crop] of [
  [apple, 5, 'public/icons/apple-touch-icon.png'],
  [favicon, 6, 'public/icons/icon-192.png'],
  [favicon, 16, 'public/icons/icon-512.png'],
  [maskable192, 3, 'public/icons/maskable-192.png'],
  [maskable512, 10, 'public/icons/maskable-512.png', 4],
]) {
  writeFileSync(out, png(rows, scale, crop));
  const px = rows.length * scale - 2 * (crop ?? 0);
  console.log(`  ${out}  ${px}x${px}`);
}
