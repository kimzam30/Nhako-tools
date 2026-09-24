/**
 * From positioned text on a PDF page to the paragraphs of an editable
 * document. A PDF stores words at coordinates, not paragraphs: this rebuilds
 * lines from shared baselines, paragraphs from spacing and indentation, and
 * headings from size, the way a person reading the page would.
 *
 * Pure geometry, no pdf.js, so it is unit-tested directly.
 */

/** A piece of text as drawn, in points, y DOWN from the top of the page. */
export interface TextPiece {
  str: string;
  x: number;
  /** Baseline. */
  y: number;
  width: number;
  size: number;
  bold: boolean;
  italic: boolean;
  font: string;
}

export interface Run { text: string; bold: boolean; italic: boolean; size: number; font: string }

export interface Block {
  kind: 'heading' | 'para';
  /** 1 or 2 for headings. */
  level: number;
  align: 'left' | 'center';
  /** Left indent from the text column's edge, in points. */
  indent: number;
  runs: Run[];
}

export interface Line { pieces: TextPiece[]; y: number; left: number; right: number; size: number }

/** Group pieces sharing a baseline into lines, left to right. */
export function toLines(pieces: TextPiece[]): Line[] {
  const sorted = pieces.filter((p) => p.str.length > 0).sort((a, b) => a.y - b.y || a.x - b.x);
  const lines: Line[] = [];
  for (const p of sorted) {
    const line = lines.find((l) => Math.abs(l.y - p.y) < Math.max(2, 0.45 * Math.min(l.size, p.size)));
    if (line) {
      line.pieces.push(p);
      line.left = Math.min(line.left, p.x);
      line.right = Math.max(line.right, p.x + p.width);
      line.size = Math.max(line.size, p.size);
    } else {
      lines.push({ pieces: [p], y: p.y, left: p.x, right: p.x + p.width, size: p.size });
    }
  }
  for (const l of lines) l.pieces.sort((a, b) => a.x - b.x);
  return lines.sort((a, b) => a.y - b.y);
}

/** A line's text as runs, with spaces put back where the gaps are. */
export function lineRuns(line: Line): Run[] {
  const runs: Run[] = [];
  let prevEnd = -Infinity;
  for (const p of line.pieces) {
    const gap = p.x - prevEnd;
    const last = runs.at(-1);
    const needsSpace = last && gap > 0.18 * p.size && !/\s$/.test(last.text) && !/^\s/.test(p.str);
    const text = (needsSpace ? ' ' : '') + p.str;
    if (last && last.bold === p.bold && last.italic === p.italic && Math.abs(last.size - p.size) < 0.5 && last.font === p.font) last.text += text;
    else runs.push({ text, bold: p.bold, italic: p.italic, size: p.size, font: p.font });
    prevEnd = p.x + p.width;
  }
  return runs;
}

const textOf = (runs: Run[]) => runs.map((r) => r.text).join('');

/** The body text size: the size most characters are set in. */
export function bodySize(lines: Line[]): number {
  const counts = new Map<number, number>();
  for (const l of lines) for (const p of l.pieces) {
    const s = Math.round(p.size * 2) / 2;
    counts.set(s, (counts.get(s) ?? 0) + p.str.length);
  }
  let best = 12;
  let most = -1;
  for (const [s, n] of counts) if (n > most) { most = n; best = s; }
  return best;
}

const BULLET = /^\s*([•●◦▪▫■□‣⁃\-–*]|\d{1,3}[.)]|[a-z][.)])\s/i;

/**
 * Lines to blocks. A new paragraph starts when the gap above is clearly more
 * than the line spacing, the size changes, the line starts a list item, or
 * the line before ended well short of the column (the end of a paragraph).
 */
export function toBlocks(pieces: TextPiece[], pageWidth: number): Block[] {
  const lines = toLines(pieces);
  if (lines.length === 0) return [];
  const body = bodySize(lines);
  const colLeft = Math.min(...lines.map((l) => l.left));
  const colRight = Math.max(...lines.map((l) => l.right));
  const colWidth = Math.max(1, colRight - colLeft);

  // Typical distance between baselines of body lines.
  const gaps: number[] = [];
  for (let i = 1; i < lines.length; i++) {
    const g = lines[i]!.y - lines[i - 1]!.y;
    if (Math.abs(lines[i]!.size - body) < 1 && g > 0) gaps.push(g);
  }
  gaps.sort((a, b) => a - b);
  const leading = gaps.length ? gaps[Math.floor(gaps.length / 2)]! : body * 1.2;

  const blocks: Block[] = [];
  let current: { block: Block; last: Line } | null = null;

  for (const line of lines) {
    const runs = lineRuns(line);
    const text = textOf(runs).trim();
    if (!text) continue;
    const ratio = line.size / body;
    const heading = ratio >= 1.18 && text.length < 160;
    const level = ratio >= 1.6 ? 1 : 2;
    const centred = Math.abs((line.left + line.right) / 2 - pageWidth / 2) < 0.04 * pageWidth
      && line.left - colLeft > 0.12 * colWidth && colRight - line.right > 0.12 * colWidth;
    const align: Block['align'] = centred ? 'center' : 'left';

    if (current) {
      const prev = current.last;
      const gap = line.y - prev.y;
      const sameSize = Math.abs(line.size - prev.size) < 0.6;
      const prevShort = prev.right < colRight - 0.15 * colWidth;
      const prevEndsSentence = /[.!?:;"”)]\s*$/.test(textOf(lineRuns(prev)));
      const continues = current.block.kind === (heading ? 'heading' : 'para')
        && sameSize
        && gap < leading * 1.45
        && !BULLET.test(text)
        && !(prevShort && prevEndsSentence && !heading)
        && current.block.align === align;
      if (continues) {
        const lastRun = current.block.runs.at(-1)!;
        // Rejoin a word hyphenated across the line break; otherwise a space.
        if (/[a-z]-$/i.test(lastRun.text) && /^[a-z]/.test(text)) lastRun.text = lastRun.text.slice(0, -1);
        else lastRun.text = lastRun.text.replace(/\s*$/, ' ');
        const [first, ...rest] = runs;
        if (first) first.text = first.text.replace(/^\s+/, '');
        for (const r of [first, ...rest]) {
          if (!r) continue;
          const tail = current.block.runs.at(-1)!;
          if (tail.bold === r.bold && tail.italic === r.italic && Math.abs(tail.size - r.size) < 0.5 && tail.font === r.font) tail.text += r.text;
          else current.block.runs.push(r);
        }
        current.last = line;
        continue;
      }
    }

    runs[0]!.text = runs[0]!.text.replace(/^\s+/, '');
    const block: Block = {
      kind: heading ? 'heading' : 'para',
      level: heading ? level : 0,
      align,
      indent: align === 'left' ? Math.max(0, Math.round(line.left - colLeft)) : 0,
      runs,
    };
    blocks.push(block);
    current = { block, last: line };
  }
  for (const b of blocks) {
    const last = b.runs.at(-1);
    if (last) last.text = last.text.replace(/\s+$/, '');
  }
  return blocks;
}

/**
 * A PDF font name to the family a word processor knows: subset prefix and
 * style suffix removed, PostScript names spelled out.
 */
export function familyOf(name: string): string {
  const base = name.replace(/^[A-Z]{6}\+/, '').replace(/[-,](Bold|Italic|Oblique|Regular|Roman|Book|Medium|Semibold|SemiBold|Black|Light|BoldItalic|BoldOblique|MT|PS|PSMT)+.*$/i, '').replace(/(PSMT|MT|PS)$/, '');
  const known: Record<string, string> = {
    TimesNewRoman: 'Times New Roman', Times: 'Times New Roman', 'Times-Roman': 'Times New Roman',
    ArialMT: 'Arial', Arial: 'Arial', Helvetica: 'Arial', CourierNew: 'Courier New', Courier: 'Courier New',
    Calibri: 'Calibri', Cambria: 'Cambria', Georgia: 'Georgia', Verdana: 'Verdana', Tahoma: 'Tahoma',
    TrebuchetMS: 'Trebuchet MS', ComicSansMS: 'Comic Sans MS', Garamond: 'Garamond', BookAntiqua: 'Book Antiqua',
  };
  if (known[base]) return known[base]!;
  const spaced = base.replace(/([a-z])([A-Z])/g, '$1 $2').trim();
  return spaced || 'Calibri';
}

export const isBold = (name: string) => /bold|black|heavy|semibold|demi/i.test(name);
export const isItalic = (name: string) => /italic|oblique/i.test(name);
