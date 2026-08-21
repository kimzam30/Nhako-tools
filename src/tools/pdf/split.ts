import { ToolError, type FileRun } from '../types';
import { parsePageRange } from '../../lib/range';

export const run: FileRun = async (files, opts, ctx) => {
  const file = files[0];
  if (!file) throw new ToolError('No file selected.');
  const { PDFDocument } = await import('pdf-lib');
  const JSZip = (await import('jszip')).default;

  let source;
  try {
    source = await PDFDocument.load(await file.arrayBuffer());
  } catch {
    throw new ToolError(`Could not read "${file.name}". If it is password-protected, unlock it first.`);
  }

  const indices = parsePageRange(String(opts.range ?? ''), source.getPageCount());
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
    summary: `${indices.length} page${indices.length === 1 ? '' : 's'} extracted`,
  };
};
