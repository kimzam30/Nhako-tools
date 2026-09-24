import { ToolError, type FileRun } from '../types';
import { bytesToBlob } from '../../lib/format';
import { parsePageRange } from '../../lib/range';
import { sayer } from '../say';
import { openPdf } from './load';

export const run: FileRun = async (files, opts, ctx) => {
  const say = sayer(opts);
  const file = files[0];
  if (!file) throw new ToolError(say('No file selected.', 'Tiada fail dipilih.'));
  const { degrees } = await import('pdf-lib');

  const doc = await openPdf(file, say);

  const angle = Number(opts.angle ?? 90);
  const indices = parsePageRange(String(opts.range ?? ''), doc.getPageCount(), say);

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
    summary: say(`${indices.length} page${indices.length === 1 ? '' : 's'} rotated ${angle}°`, `${indices.length} halaman diputar ${angle}°`),
  };
};
