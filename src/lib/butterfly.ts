/**
 * The NeraOS pixel sprites, shared by the background flight, the loading
 * readout and the finished state.
 *
 * Copied cell for cell from NeraOS (github.com/kimzam30/NeraOS, js/sprites.js)
 * so the butterflies here are the same butterflies. Each row is one pixel row;
 * "." is transparent and every other letter is a key into PALETTE. A colour
 * set from BUTTERFLY_COLORS overrides wing keys only, which is how one drawing
 * becomes four butterflies.
 *
 * The background layer in BaseLayout reads this same data through
 * `define:vars`, so there is exactly one copy of every sprite in the codebase.
 */

export const PALETTE: Record<string, string> = {
  O: '#4a3a5c', // outline
  W: '#ffffff',
  L: '#fbe3ef', // light pink
  P: '#f49ac1', // pink
  D: '#2d2433', // dark
  S: '#ead3e6', // shade
  V: '#dccdf8', // lavender
  K: '#b49be0', // mid lavender
  A: '#f7a1c4', // upper wing
  B: '#c3a6f0', // lower wing
  Y: '#ffd98a', // flower centre
  G: '#8fcf9e', // green
  M: '#9a93a6', // metal
};

export const SPRITES = {
  butterfly: [
    '...O.......O...',
    '....O.....O....',
    '.OO..O...O..OO.',
    'OAAO..ODO..OAAO',
    'OAWAAOODOOAAWAO',
    'OAAAAAODOAAAAAO',
    '.OAAAAODOAAAAO.',
    '..OOBBODOBBOO..',
    '.OBBBBODOBBBBO.',
    '.OBWBBODOBBWBO.',
    '..OBBO.O.OBBO..',
    '...OO.....OO...',
  ],
  heart: [
    '.OO...OO.',
    'OPPO.OPPO',
    'OPWPOPPPO',
    'OPPPPPPPO',
    '.OPPPPPO.',
    '..OPPPO..',
    '...OPO...',
    '....O....',
  ],
  flower: [
    '...OO.OO...',
    '..OPPOPPO..',
    '.OPPPOPPPO.',
    'OPPPYYYPPPO',
    'OPPYYWYYPPO',
    '.OPPYYYPPO.',
    '..OPPOPPO..',
    '...OOGOO...',
    '.....G.....',
    '..GG.G.GG..',
    '...GGGGG...',
    '.....G.....',
  ],
} as const;

export type SpriteName = keyof typeof SPRITES;
export type Overrides = Partial<Record<string, string>>;

export const BUTTERFLY_COLORS: Overrides[] = [
  {},
  { A: '#c3a6f0', B: '#f7a1c4' },
  { A: '#e7b6f5', B: '#f9c6dc' },
  { A: '#f49ac1', B: '#b49be0' },
];

/**
 * One sprite as horizontal runs of same-coloured cells, ready for SVG.
 *
 * Runs rather than one rect per pixel: the butterfly is 118 lit cells but only
 * about 60 runs, and the finished state draws several of them at once.
 */
export function spriteRuns(name: SpriteName, overrides: Overrides = {}) {
  const runs: { x: number; y: number; w: number; fill: string }[] = [];
  SPRITES[name].forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const ch = row[x]!;
      let end = x + 1;
      while (end < row.length && row[end] === ch) end++;
      if (ch !== '.') runs.push({ x, y, w: end - x, fill: overrides[ch] ?? PALETTE[ch]! });
      x = end;
    }
  });
  return { width: SPRITES[name][0].length, height: SPRITES[name].length, runs };
}
