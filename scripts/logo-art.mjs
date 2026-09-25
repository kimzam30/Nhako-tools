/**
 * The Nhako Tools icon, drawn in the NeraOS pixel language: a red toolbox on a
 * lawn, a wrench and a screwdriver poking out, a butterfly sticker and a heart
 * sticker slapped on at opposite tilts.
 *
 * Same format as NeraOS's own sprites (github.com/kimzam30/NeraOS, js/sprites.js)
 * and src/lib/butterfly.ts: one string per pixel row, one letter per pixel,
 * every letter a key into PALETTE. Edit the art here, then `npm run icons`.
 *
 * NeraOS rules it keeps: a 1px plum outline (#4a3a5c, never black), flat fills,
 * one white glint, a shade row along the bottom. The pink, lavender, dark,
 * yellow, green and metal are NeraOS's palette verbatim; the reds and the lawn
 * shades are additions pitched to sit beside them.
 *
 * 32x32 so the favicon is pixel for pixel at 32px and every PNG size is a whole
 * multiple (6x for 192, 16x for 512). The stickers are hand-placed pixels, not
 * a rotation: rotating a 7px sprite by resampling turns it into a blob.
 */

export const PALETTE = {
  O: '#4a3a5c', // outline
  W: '#ffffff',
  P: '#f49ac1', // pink
  D: '#2d2433', // dark
  K: '#b49be0', // mid lavender, the screwdriver grip
  A: '#f7a1c4', // wing pink
  B: '#c3a6f0', // wing lavender
  Y: '#ffd98a', // flower centre, the latch
  G: '#8fcf9e', // green, the lawn
  M: '#9a93a6', // metal
  m: '#c9c4d2', // metal, lit
  R: '#e8505b', // toolbox red
  H: '#ff8f98', // red, lit
  Q: '#b83a4b', // red, shade
  g: '#6bb784', // grass blade
  h: '#b5e3be', // grass, lit
  s: '#76b98c', // the toolbox's shadow on the lawn
  e: '#b893ea', // lilac petals
  f: '#f7b8d4', // blush petals
};

export const ICON = [
  'GGGGGGGGGGGGGGGGGGGGGGOGhGGGGGGG',
  'GGGGGGGOgGgOGGGgGgGGGOmOGhGGGGGG',
  'GGGGGGGOMOmOGgGGgGGGGOMOGGGGhGGG',
  'GGGGGGGOMMmOgGGGGGGGGOMOGGGGeGGG',
  'GGGGPGGGOMOGgOOOOOOGGOMOGGGeYeGG',
  'GGGPYPgGOmOgOMmMMMMOGOKOGGGGeGgG',
  'GGGGPgGGOmOGOMOOOOMOgOKOgGgGghGG',
  'gGgGGGGGOmOGOMOGGOMOGOKOGgGgGGGG',
  'GgGGGOOOOOOOOOOOOOOOOOOOOOOGGGGG',
  'GGGGOHWWHHHHHHHHHHHHHHHHHHHOGGGG',
  'GGGGORWRRRRRRRRRRRRRRRRRRRROGGGG',
  'GGGGORRRRRRRRROOOORRRRRRRRROGGGG',
  'GgGgOOOOOOOOOOOWYOOOOOOOOOOOGGGG',
  'GGgGORRRRWWWRROYYORRRRRRRRROGGGG',
  'GGGGORWWWWOWWWOOOORRRRRRRRROGGGG',
  'GGhGORWOWOWOOWWRRRRRRRRRRRROGGGG',
  'GGGGOWWOODOBBOWWRRRWWWWWWWROGGgG',
  'GGGGOWOBWBDBWBOWRRWWOOWOOWWOGGGg',
  'GGGGOWWOBBDBBOWWRRWOPWOPPOWOGGGG',
  'GGGGORWWOAADAAOWRRWOPPPPPOWOGGGG',
  'gGgGORRWOAADAOWWRRWWOPPPPOWOGGGG',
  'GgGGORRWWOOOOWWRRRRWWOPPOWWOGGGG',
  'GGGGORRRWWWWWWRRRRRRWWOPOWROGhGG',
  'GGGGORRRRRRRRRRRRRRRRWWOWWROGGGG',
  'GGGGORRRRRRRRRRRRRRRRRWWWRROGGGG',
  'GGGGOQQQQQQQQQQQQQQQQQQQQQQOGgGg',
  'GGGGGOOOOOOOOOOOOOOOOOOOOOOGGhgG',
  'GghgGssssssssssssssssssssssGGGGG',
  'GGgfGGGGGGgGgGGGGGGGgGgGgGGPGGGG',
  'GGfYfgGGGGGgGGGGGGGGGGGgGGPYPGGG',
  'GGGfgGGGGGGGGGGGGGGhGGGGGGGPGGGG',
  'GghgGGGGGGGGgggggGgGgGgGGGGGGGGG',
];

/**
 * ICON centred on a bigger lawn, for the platforms that crop. The extra grass
 * is scattered from a fixed seed with the same tufts, glints and flowers as the
 * drawn lawn, so every build writes the same pixels. `dy` moves the art down
 * that many cells from centre.
 */
export function onLawn(size, { dy = 0, seed = 7 } = {}) {
  const off = (size - ICON.length) / 2;
  if (!Number.isInteger(off)) throw new Error(`onLawn: ${size} does not centre a ${ICON.length}px icon`);
  const grid = Array.from({ length: size }, () => Array(size).fill('G'));
  let s = seed;
  const rand = () => {
    // mulberry32
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const inIcon = (x, y) => x >= off && x < off + ICON.length && y >= off + dy && y < off + dy + ICON.length;
  const put = (x, y, k) => {
    if (x >= 0 && y >= 0 && x < size && y < size && !inIcon(x, y)) grid[y][x] = k;
  };
  const cells = size * size - ICON.length ** 2;
  for (let i = 0; i < cells * 0.04; i++) {
    const x = Math.floor(rand() * size), y = Math.floor(rand() * size);
    put(x, y, 'g'); put(x + 2, y, 'g'); put(x + 1, y + 1, 'g'); // a V tuft
  }
  for (let i = 0; i < cells * 0.028; i++) put(Math.floor(rand() * size), Math.floor(rand() * size), 'h');
  for (let i = 0; i < cells * 0.004; i++) {
    const x = Math.floor(rand() * (size - 2)), y = Math.floor(rand() * (size - 2));
    const petal = ['P', 'e', 'f'][Math.floor(rand() * 3)];
    put(x + 1, y, petal); put(x, y + 1, petal); put(x + 1, y + 1, 'Y'); put(x + 2, y + 1, petal); put(x + 1, y + 2, petal);
  }
  ICON.forEach((row, y) => [...row].forEach((k, x) => (grid[y + off + dy][x + off] = k)));
  return grid.map((r) => r.join(''));
}

/** Stepped rounded corners, the pixel-art way: two cells off the edge, then one. */
export function rounded(rows) {
  const n = rows.length;
  const cut = new Set(['0,0', '1,0', '0,1']);
  return rows.map((row, y) =>
    [...row]
      .map((k, x) => {
        const cx = x < n / 2 ? x : n - 1 - x;
        const cy = y < n / 2 ? y : n - 1 - y;
        return cut.has(`${cx},${cy}`) ? '.' : k;
      })
      .join(''),
  );
}
