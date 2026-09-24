import { ToolError, type FileRun } from '../types';
import { bytesToBlob } from '../../lib/format';
import { parsePageRange } from '../../lib/range';
import { normalizeRotation, type Rotation } from '../../lib/pdf-geometry';
import { sayer } from '../say';
import { openPdf, stem } from './load';

/**
 * Print handouts: several pages on each sheet, the way lecture slides are
 * printed to study from. Each page keeps its proportions and is placed as it
 * DISPLAYS, so a page stored sideways with /Rotate 90 lands upright.
 *
 * Pages are embedded as form XObjects, not rendered, so text stays sharp and
 * selectable at any zoom and the file stays small.
 */

const PAPER: Record<string, [number, number]> = {
  a4: [595.28, 841.89],
  letter: [612, 792],
};

/** Columns and rows on a PORTRAIT sheet. A landscape sheet swaps them. */
export const GRID: Record<number, [number, number]> = {
  2: [1, 2],
  4: [2, 2],
  6: [2, 3],
  8: [2, 4],
  9: [3, 3],
  16: [4, 4],
};

const MARGIN = 24;
const GAP = 12;

export interface Layout {
  sheet: [number, number];
  cols: number;
  rows: number;
  cell: [number, number];
}

/**
 * The sheet orientation and grid for `per` pages of a given displayed aspect.
 * 'auto' picks whichever orientation draws the pages larger: slides (wide)
 * come out two stacked on a portrait sheet, or four on a landscape one.
 */
export function layoutFor(per: number, paper: string, orientation: string, pageAspect: number): Layout {
  const [pw, ph] = PAPER[paper] ?? PAPER.a4!;
  const [c, r] = GRID[per] ?? GRID[4]!;
  const option = (landscape: boolean): Layout => {
    const sheet: [number, number] = landscape ? [ph, pw] : [pw, ph];
    const cols = landscape ? r : c;
    const rows = landscape ? c : r;
    const cell: [number, number] = [
      (sheet[0] - 2 * MARGIN - (cols - 1) * GAP) / cols,
      (sheet[1] - 2 * MARGIN - (rows - 1) * GAP) / rows,
    ];
    return { sheet, cols, rows, cell };
  };
  if (orientation === 'portrait') return option(false);
  if (orientation === 'landscape') return option(true);
  const scaleOf = (l: Layout) => Math.min(l.cell[0] / pageAspect, l.cell[1]);
  const p = option(false);
  const l = option(true);
  return scaleOf(l) > scaleOf(p) ? l : p;
}

/**
 * Where to put the drawing origin and which angle to give pdf-lib, so an
 * embedded page with /Rotate `rotation` fills the displayed rectangle
 * [x0, x0 + w] x [y0, y0 + h] upright. pdf-lib rotates anticlockwise about the
 * origin; /Rotate turns clockwise, hence the negative angle.
 */
export function placement(rotation: Rotation, x0: number, y0: number, w: number, h: number) {
  switch (rotation) {
    case 90: return { x: x0, y: y0 + h, angle: -90 };
    case 180: return { x: x0 + w, y: y0 + h, angle: -180 };
    case 270: return { x: x0 + w, y: y0, angle: -270 };
    default: return { x: x0, y: y0, angle: 0 };
  }
}

export const run: FileRun = async (files, opts, ctx) => {
  const say = sayer(opts);
  const file = files[0];
  if (!file) throw new ToolError(say('No file selected.', 'Tiada fail dipilih.'));
  const { PDFDocument, degrees, rgb } = await import('pdf-lib');

  const src = await openPdf(file, say);
  const indices = parsePageRange(String(opts.range ?? ''), src.getPageCount(), say);
  const per = Number(opts.perSheet ?? 4);
  if (!GRID[per]) throw new ToolError(say('Choose how many pages go on each sheet.', 'Pilih berapa halaman pada setiap helaian.'));
  const acrossFirst = (opts.order ?? 'across') !== 'down';
  const border = opts.border !== false;

  const pages = indices.map((i) => src.getPage(i));
  const shapes = pages.map((p) => {
    const box = p.getCropBox();
    const rotation = normalizeRotation(p.getRotation().angle);
    const sideways = rotation === 90 || rotation === 270;
    return { box, rotation, vw: sideways ? box.height : box.width, vh: sideways ? box.width : box.height };
  });
  // One layout for the whole document, from its first page, so every sheet
  // matches. Mixed orientations still fit: each page is scaled into its cell.
  const first = shapes[0]!;
  const layout = layoutFor(per, String(opts.paper ?? 'a4'), String(opts.orientation ?? 'auto'), first.vw / first.vh);

  const out = await PDFDocument.create();
  out.setTitle(`${stem(file)} (${per} per sheet)`);
  const embedded = await out.embedPages(pages, shapes.map(({ box }) => ({
    left: box.x, bottom: box.y, right: box.x + box.width, top: box.y + box.height,
  })));

  const [cw, ch] = layout.cell;
  let sheet = out.addPage(layout.sheet);
  for (const [n, page] of embedded.entries()) {
    const slot = n % per;
    if (n > 0 && slot === 0) sheet = out.addPage(layout.sheet);
    const col = acrossFirst ? slot % layout.cols : Math.floor(slot / layout.rows);
    const row = acrossFirst ? Math.floor(slot / layout.cols) : slot % layout.rows;
    const { rotation, vw, vh } = shapes[n]!;
    const scale = Math.min(cw / vw, ch / vh);
    const w = vw * scale;
    const h = vh * scale;
    // Cells are laid out from the top-left, as the eye reads a sheet.
    const cellX = MARGIN + col * (cw + GAP);
    const cellTop = layout.sheet[1] - MARGIN - row * (ch + GAP);
    const x0 = cellX + (cw - w) / 2;
    const y0 = cellTop - ch + (ch - h) / 2;
    const at = placement(rotation, x0, y0, w, h);
    sheet.drawPage(page, { x: at.x, y: at.y, xScale: scale, yScale: scale, rotate: degrees(at.angle) });
    if (border) {
      sheet.drawRectangle({ x: x0, y: y0, width: w, height: h, borderColor: rgb(0.62, 0.62, 0.66), borderWidth: 0.6 });
    }
    ctx.onProgress((n + 1) / embedded.length);
  }

  const sheets = out.getPageCount();
  return {
    blob: bytesToBlob(await out.save(), 'application/pdf'),
    filename: `${stem(file)}-${per}-per-sheet.pdf`,
    summary: say(
      `${indices.length} page${indices.length === 1 ? '' : 's'} on ${sheets} sheet${sheets === 1 ? '' : 's'}, ${per} per sheet`,
      `${indices.length} halaman pada ${sheets} helaian, ${per} setiap helaian`,
    ),
  };
};
