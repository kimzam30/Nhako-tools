import { ToolError, type FileRun } from '../types';
import { bytesToBlob } from '../../lib/format';
import { parsePageRange } from '../../lib/range';
import { sayer } from '../say';
import { openPdf } from './load';

/**
 * Two things people mean by "split".
 *
 * 'each' cuts the chosen pages into one file per page and zips them, which is
 * what this tool has always done. 'one' keeps the chosen pages together as a
 * single new PDF, which is what someone extracting chapter three actually
 * wants and previously had to do by splitting into twelve files and merging
 * eleven of them back together.
 *
 * Both honour the same `range`, so the page selection and the question of what
 * to do with it stay independent.
 */
export const run: FileRun = async (files, opts, ctx) => {
  const say = sayer(opts);
  const file = files[0];
  if (!file) throw new ToolError(say('No file selected.', 'Tiada fail dipilih.'));
  const { PDFDocument } = await import('pdf-lib');

  const source = await openPdf(file, say);
  const indices = parsePageRange(String(opts.range ?? ''), source.getPageCount(), say);
  const base = file.name.replace(/\.pdf$/i, '');

  if (String(opts.mode ?? 'each') === 'one') {
    const single = await PDFDocument.create();
    const pages = await single.copyPages(source, indices);
    for (const [n, page] of pages.entries()) {
      single.addPage(page);
      ctx.onProgress((n + 1) / pages.length);
    }
    return {
      blob: bytesToBlob(await single.save(), 'application/pdf'),
      filename: `${base}-extract.pdf`,
      summary: say(
        `${indices.length} page${indices.length === 1 ? '' : 's'} in one PDF`,
        `${indices.length} halaman dalam satu PDF`,
      ),
    };
  }

  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();

  for (const [n, index] of indices.entries()) {
    const single = await PDFDocument.create();
    const [page] = await single.copyPages(source, [index]);
    if (page) single.addPage(page);
    zip.file(`${base}-page-${index + 1}.pdf`, await single.save());
    ctx.onProgress((n + 1) / indices.length);
  }

  return {
    blob: await zip.generateAsync({ type: 'blob' }),
    filename: `${base}-split.zip`,
    summary: say(`${indices.length} page${indices.length === 1 ? '' : 's'} extracted`, `${indices.length} halaman dikeluarkan`),
  };
};
