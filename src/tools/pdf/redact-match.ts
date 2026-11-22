/**
 * Finding what to black out on a PDF page, from pdf.js text items.
 *
 * Pure and DOM-free so it can be tested on its own. Items are joined in reading
 * order with nothing between them (pdf.js already puts the spaces it saw into
 * the strings) and a newline where a line ends, so a match can run across
 * items, as an IC number split into "880101-" and "14-5678" often does. Each
 * match becomes one box per item it touches, in PDF user space.
 */

export interface TextItem {
  str: string;
  /** Baseline start, PDF user space. */
  x: number;
  y: number;
  /** Advance width of the whole string, PDF user space. */
  width: number;
  /** Font height, PDF user space. */
  height: number;
  /** pdf.js hasEOL: a line break follows this item. */
  eol?: boolean;
}

/** x0, y0 (bottom), x1, y1 (top), PDF user space. */
export type Box = [number, number, number, number];

/** Malaysian MyKad number: YYMMDD-PB-###G, with or without dashes. */
export const IC_PATTERN = /(?<!\d)\d{6}-?\d{2}-?\d{4}(?!\d)/g;
/** Malaysian mobile and landline numbers: 012-345 6789, +6012-3456789, 03-1234 5678. */
export const PHONE_PATTERN = /(?<![\d+])(?:\+?60|0)(?:1\d-?\s?\d{3,4}|[3-9]-?\s?\d{4})\s?-?\d{4}(?!\d)/g;
export const EMAIL_PATTERN = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Words or phrases typed by the person, separated by a comma and a space, a
 * semicolon or a new line. A comma with no space after it stays part of the
 * term, so an amount like 4,321.00 is one term, not "4" and "321.00".
 */
export function termPatterns(input: string): RegExp[] {
  return input
    .split(/\n|;|,\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2)
    // Whitespace inside a phrase matches any run of whitespace in the PDF.
    .map((t) => new RegExp(escapeRegExp(t).replace(/\s+/g, '\\s*'), 'gi'));
}

/**
 * Width of a string in any unit, for placing a match inside its item. Only
 * ratios are used: the item's real width is known, so measuring with a similar
 * proportional font puts the box close to the glyphs. The default treats
 * every character as equally wide, which is only good enough for tests.
 */
export type Measure = (s: string) => number;
const uniform: Measure = (s) => s.length;

/** Boxes covering every match of every pattern on one page. */
export function findBoxes(
  items: readonly TextItem[],
  patterns: readonly RegExp[],
  measure: Measure = uniform,
): { boxes: Box[]; matches: number } {
  let text = '';
  const owner: { item: number; offset: number }[] = [];
  items.forEach((it, i) => {
    for (let k = 0; k < it.str.length; k++) {
      text += it.str[k];
      owner.push({ item: i, offset: k });
    }
    if (it.eol) {
      text += '\n';
      owner.push({ item: -1, offset: 0 });
    }
  });

  const boxes: Box[] = [];
  let matches = 0;
  for (const source of patterns) {
    const re = new RegExp(source.source, source.flags.includes('g') ? source.flags : source.flags + 'g');
    for (const m of text.matchAll(re)) {
      if (!m[0].trim()) continue;
      matches++;
      // Characters of this match, grouped by the item they belong to.
      const spans = new Map<number, [number, number]>();
      for (let c = m.index!; c < m.index! + m[0].length; c++) {
        const o = owner[c]!;
        if (o.item < 0) continue;
        const s = spans.get(o.item);
        spans.set(o.item, s ? [Math.min(s[0], o.offset), Math.max(s[1], o.offset + 1)] : [o.offset, o.offset + 1]);
      }
      for (const [i, [s, e]] of spans) {
        const it = items[i]!;
        const total = measure(it.str) || 1;
        const at = (k: number) => it.x + (it.width * measure(it.str.slice(0, k))) / total;
        // Generous at the sides: measured widths only approximate the PDF's
        // own font, and a box a little too wide is safe where one too narrow
        // leaves the first or last character readable.
        const side = Math.max(1, it.height * 0.35);
        const pad = Math.max(0.5, it.height * 0.08);
        boxes.push([at(s) - side, it.y - it.height * 0.25 - pad, at(e) + side, it.y + it.height * 0.9 + pad]);
      }
    }
  }
  return { boxes, matches };
}
