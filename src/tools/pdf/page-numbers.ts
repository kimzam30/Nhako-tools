import { ToolError, type FileRun } from '../types';
import { bytesToBlob } from '../../lib/format';
import { normalizeRotation, uprightAnchor, visualSize, mmToPt } from '../../lib/pdf-geometry';
import { sayer } from '../say';
import { openPdf, stem } from './load';

/** The label for page `n` of `total` in the chosen style. */
export function pageLabel(style: string, n: number, total: number, ms: boolean): string {
  switch (style) {
    case 'n-of-total': return `${n} / ${total}`;
    case 'page-n': return ms ? `Halaman ${n}` : `Page ${n}`;
    case 'page-n-of-total': return ms ? `Halaman ${n} daripada ${total}` : `Page ${n} of ${total}`;
    default: return String(n);
  }
}

export const run: FileRun = async (files, opts, ctx) => {
  const say = sayer(opts);
  const file = files[0];
  if (!file) throw new ToolError(say('No file selected.', 'Tiada fail dipilih.'));
  const { StandardFonts, rgb, degrees } = await import('pdf-lib');
  const doc = await openPdf(file, say);
  const font = await doc.embedFont(StandardFonts.Helvetica);

  const position = String(opts.position ?? 'bottom-center');
  const style = String(opts.style ?? 'n');
  const size = Number(opts.size ?? 11);
  const first = Math.max(1, Math.round(Number(opts.start ?? 1)));
  const skipFirst = Boolean(opts.skipFirst);
  const margin = mmToPt(10);

  const pages = doc.getPages();
  // A skipped cover page is not counted, so page 2 reads "1" when the
  // numbering starts at 1: the convention for reports and theses.
  const numbered = skipFirst ? pages.slice(1) : pages;
  const total = numbered.length + first - 1;

  for (const [i, page] of numbered.entries()) {
    const label = pageLabel(style, first + i, total, opts.locale === 'ms');
    const box = page.getCropBox();
    const rotation = normalizeRotation(page.getRotation().angle);
    const { width: vw, height: vh } = visualSize(box, rotation);
    const textWidth = font.widthOfTextAtSize(label, size);

    // Place in the page as the reader sees it, then map into stored space,
    // so a page scanned sideways still gets its number upright at the bottom.
    const [vertical, horizontal] = position.split('-') as ['top' | 'bottom', 'left' | 'center' | 'right'];
    const left = horizontal === 'left' ? margin : horizontal === 'right' ? vw - margin - textWidth : (vw - textWidth) / 2;
    const baseline = vertical === 'top' ? margin + size : vh - margin;
    const at = uprightAnchor(left, baseline, box, rotation);

    page.drawText(label, { x: at.x, y: at.y, size, font, color: rgb(0.15, 0.15, 0.17), rotate: degrees(at.rotate) });
    ctx.onProgress((i + 1) / numbered.length);
  }

  return {
    blob: bytesToBlob(await doc.save(), 'application/pdf'),
    filename: `${stem(file)}-numbered.pdf`,
    summary: say(
      `${numbered.length} page${numbered.length === 1 ? '' : 's'} numbered ${first} to ${total}`,
      `${numbered.length} halaman dinomborkan ${first} hingga ${total}`,
    ),
  };
};
