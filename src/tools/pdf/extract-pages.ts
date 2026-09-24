import { ToolError, type FileRun } from '../types';
import { bytesToBlob } from '../../lib/format';
import { parsePageRange } from '../../lib/range';
import { sayer } from '../say';
import { openPdf, stem } from './load';

/**
 * Pull the pages you list out into one new PDF, in the order you typed them:
 * "5, 1-3" puts page 5 first. Split PDF does the same through a page grid;
 * this is the direct form, and the one people search for.
 */
export function orderedPages(spec: string, total: number, say: Parameters<typeof parsePageRange>[2]): number[] {
  // parsePageRange sorts and dedupes, which is right for "which pages" but
  // wrong here, where the order typed is the order wanted. Parse each part on
  // its own and keep the sequence, dropping repeats after their first use.
  const seen = new Set<number>();
  const out: number[] = [];
  for (const part of spec.split(',').map((p) => p.trim()).filter(Boolean)) {
    for (const i of parsePageRange(part, total, say)) {
      if (!seen.has(i)) { seen.add(i); out.push(i); }
    }
  }
  return out;
}

export const run: FileRun = async (files, opts, ctx) => {
  const say = sayer(opts);
  const file = files[0];
  if (!file) throw new ToolError(say('No file selected.', 'Tiada fail dipilih.'));
  const spec = String(opts.range ?? '').trim();
  if (!spec) throw new ToolError(say('Type the pages to extract, for example 2, 5-7.', 'Taip halaman yang hendak diekstrak, contohnya 2, 5-7.'));
  const { PDFDocument } = await import('pdf-lib');

  const src = await openPdf(file, say);
  const indices = orderedPages(spec, src.getPageCount(), say);
  const out = await PDFDocument.create();
  const copied = await out.copyPages(src, indices);
  for (const [n, page] of copied.entries()) {
    out.addPage(page);
    ctx.onProgress((n + 1) / copied.length);
  }

  return {
    blob: bytesToBlob(await out.save(), 'application/pdf'),
    filename: `${stem(file)}-extract.pdf`,
    summary: say(
      `${indices.length} page${indices.length === 1 ? '' : 's'} extracted`,
      `${indices.length} halaman diekstrak`,
    ),
  };
};
