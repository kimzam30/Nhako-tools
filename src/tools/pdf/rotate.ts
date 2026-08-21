import { ToolError, type FileRun } from '../types';
import { bytesToBlob } from '../../lib/format';
import { parsePageRange } from '../../lib/range';

export const run: FileRun = async (files, opts, ctx) => {
  const file = files[0];
  if (!file) throw new ToolError('No file selected.');
  const { PDFDocument, degrees } = await import('pdf-lib');

  let doc;
  try {
    doc = await PDFDocument.load(await file.arrayBuffer());
  } catch {
    throw new ToolError(`Could not read "${file.name}". If it is password-protected, unlock it first.`);
  }

  const angle = Number(opts.angle ?? 90);
  const indices = parsePageRange(String(opts.range ?? ''), doc.getPageCount());

  for (const [n, index] of indices.entries()) {
    const page = doc.getPage(index);
    // Add to the existing rotation rather than replacing it, so a page that is
    // already rotated ends up where the user expects.
    page.setRotation(degrees((page.getRotation().angle + angle) % 360));
    ctx.onProgress((n + 1) / indices.length);
  }

  return {
    blob: bytesToBlob(await doc.save(), 'application/pdf'),
    filename: file.name.replace(/\.pdf$/i, '') + '-rotated.pdf',
    summary: `${indices.length} page${indices.length === 1 ? '' : 's'} rotated ${angle}°`,
  };
};
