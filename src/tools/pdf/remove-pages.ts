import { ToolError, type FileRun } from '../types';
import { bytesToBlob } from '../../lib/format';
import { parsePageRange } from '../../lib/range';
import { sayer } from '../say';
import { openPdf, stem } from './load';

/**
 * Delete the pages you list, keep everything else in order. Organize PDF does
 * this by clicking thumbnails; this is the version for a known list ("drop
 * the cover and pages 12-14") and for people who search for it by name.
 */
export const run: FileRun = async (files, opts, ctx) => {
  const say = sayer(opts);
  const file = files[0];
  if (!file) throw new ToolError(say('No file selected.', 'Tiada fail dipilih.'));
  const spec = String(opts.range ?? '').trim();
  if (!spec) throw new ToolError(say('Type the pages to remove, for example 1, 3-5.', 'Taip halaman yang hendak dibuang, contohnya 1, 3-5.'));

  const doc = await openPdf(file, say);
  const total = doc.getPageCount();
  const drop = new Set(parsePageRange(spec, total, say));
  if (drop.size >= total) {
    throw new ToolError(say(
      'That would remove every page. Leave at least one.',
      'Itu akan membuang setiap halaman. Tinggalkan sekurang-kurangnya satu.',
    ));
  }
  // Remove from the end so earlier indices stay valid as pages go.
  const order = [...drop].sort((a, b) => b - a);
  for (const [n, index] of order.entries()) {
    doc.removePage(index);
    ctx.onProgress((n + 1) / order.length);
  }

  const kept = total - drop.size;
  return {
    blob: bytesToBlob(await doc.save(), 'application/pdf'),
    filename: `${stem(file)}-pages-removed.pdf`,
    summary: say(
      `${drop.size} page${drop.size === 1 ? '' : 's'} removed, ${kept} kept`,
      `${drop.size} halaman dibuang, ${kept} disimpan`,
    ),
  };
};
