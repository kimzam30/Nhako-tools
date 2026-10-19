/**
 * The Nhako Tools mascot: the hammer from the Nhako family of pixel mascots
 * (Nhako-home/scripts/mascots.py draws all seven on one 48px grid). These rows
 * are copied from there; `npm run icons` turns them into the favicon and every
 * PNG icon (scripts/icons.mjs).
 *
 * One string per pixel row, one letter per pixel, every letter a key into
 * PALETTE. "_" is the mascot's own ground, so the art is full bleed; "." stays
 * transparent, for the stepped corners rounded() cuts.
 *
 * The previous icon still lives in scripts/logo-art.mjs, which the launch
 * media renders from.
 */

export const LABEL = "Nhako Tools hammer";

export const PALETTE = {
  "_": "#ffd34d",
  "A": "#ff4b5c",
  "a": "#d92f45",
  "z": "#b81f38",
  "h": "#ff8a94",
  "B": "#c98a52",
  "b": "#a96d3c",
  "c": "#a96d3c",
  "G": "#7b5cff",
  "g": "#5d3fd9",
  "y": "#5d3fd9",
  "S": "#dfe4f2",
  "s": "#aab3cc",
  "W": "#ffffff",
  "O": "#3a1846",
  "K": "#ff9eb0"
};

export const ICON = [
  "________________________________________________",
  "________________________________________________",
  "________________________________________________",
  "________________________________________________",
  "________________________________________________",
  "____OOOOO_______________________________________",
  "___OhhhhhO______________________________________",
  "__OhAAAAAhO_____________________________________",
  "__OAAWAAAAOOOOOOOOOOOOOOOOOOOOO_________________",
  "__OAAWAAAAOhhhhhhhhhhhhhhhhhhhhO________________",
  "__OAAAAAAAOAAAAAAAAAAAAAAAAAAAAhOOOOOO__________",
  "__OAAAAAWAOWWAAAAAAAAAAAAAAAAAAAhOhhhhOO________",
  "__OAAAAAAAOAAAAAAAAAAAAAAAAAAAAAAOAAAAhhO_______",
  "__OAAAAAAAOAAAOOAAAAAAAAOOAAAAAAAOAAAAAAhOO_____",
  "__OAAAAAAAOAAOWOOAAAAAAOWOOAAAAAAOAAAAAAAhhO____",
  "__OAAAAAAAOAAOOOOAAAAAAOOOOAAAAAAOAAAAAAAAAhO___",
  "__OAAAAAAAOAAOOOOAAAAAAOOOOAAAAAAOAAAAAAAAAAO___",
  "__OAAAAAAAOAAAOOAAAAAAAAOOAAAAAAAOAAAAAAAAAAhO__",
  "__OAAAAAAAOKKKAAAAAAAAAAAAKKKAAAAOAAAAAAAAAAAO__",
  "__OAAAAAAAOAAAAAAAAAAAAAAAAAAAAAAOaaaaaAAAAAAhO_",
  "__OAAAAAAAOAAAAAAAOAAOAAAAAAAAAAAOzzzzzaAAAAAAO_",
  "__OAAAAAAAOAAAAAAAAOOAAAAAAAAAAAAOOOOOOzaAAAAAO_",
  "__OAAAAAAAOAAaaaaaaaaaaaaaAAAAAAaO_____OzaAAAAO_",
  "__OAAAAAAAOAazzzzzzzzzzzzzaAAAAazO______OzaAAAO_",
  "__OAAAAAAAOazOOOOOOOOOOOOOzaaaazO________OzaaaO_",
  "__OAAAAAAAOzOWWWWWWWWWWWWWOzzzzO__________OzzzO_",
  "__OaAAAAAaOOOSSSSSSSSSSSSSOOOOO____________OOO__",
  "__OzaaaaazO_OSSSSSSSSSSSSSO_____________________",
  "___OzzzzzO__OsSSSSSSSSSSSsO_____________________",
  "____OOOOO____OsssssssssssO______________________",
  "______________OOOOOOOOOOO_______________________",
  "______________OBBBbBBBBcO_______________________",
  "______________OBBBbBBBBcO_______________________",
  "______________OBBBbBBBBcO_______________________",
  "______________OBBBBBBbBcO_______________________",
  "______________OBBBBBBbBcO_______________________",
  "______________OBBBBBBbBcO_______________________",
  "______________OBBBBBBbBcO_______________________",
  "______________OBBBBBBBBcO_______________________",
  "______________OcOOOOOOOcO_______________________",
  "______________OOGGGGGGyOO_______________________",
  "______________OGGGGGGGGyO_______________________",
  "______________OgggggggggO_______________________",
  "______________OGGGGGGGGyO_______________________",
  "______________OGGGGGGGGyO_______________________",
  "______________OgggggggggO_______________________",
  "______________OGGGGGGGGyO_______________________",
  "______________OGGGGGGGGyO_______________________",
];

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
