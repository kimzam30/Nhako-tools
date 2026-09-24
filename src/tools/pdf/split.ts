import { ToolError, type FileRun } from '../types';
import { parsePageRange } from '../../lib/range';
import { sayer } from '../say';
import { openPdf } from './load';

export const run: FileRun = async (files, opts, ctx) => {
  const say = sayer(opts);
  const file = files[0];
  if (!file) throw new ToolError(say('No file selected.', 'Tiada fail dipilih.'));
  const { PDFDocument } = await import('pdf-lib');
  const JSZip = (await import('jszip')).default;

  const source = await openPdf(file, say);

  const indices = parsePageRange(String(opts.range ?? ''), source.getPageCount(), say);
  const base = file.name.replace(/\.pdf$/i, '');
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
