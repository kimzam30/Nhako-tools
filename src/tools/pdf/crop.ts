import { ToolError, type FileRun } from '../types';
import { bytesToBlob } from '../../lib/format';
import { parsePageRange } from '../../lib/range';
import { normalizeRotation, visualRectToUser, visualSize, mmToPt } from '../../lib/pdf-geometry';
import { sayer } from '../say';
import { openPdf, stem } from './load';

/**
 * Crop by trimming margins off each page.
 *
 * Only the crop box changes, so nothing is re-rendered and the cropped-away
 * content is still in the file: this hides it from view, it does not delete
 * it. The page says so, because "cropped" is easy to mistake for "removed".
 */
export const run: FileRun = async (files, opts, ctx) => {
  const say = sayer(opts);
  const file = files[0];
  if (!file) throw new ToolError(say('No file selected.', 'Tiada fail dipilih.'));
  const doc = await openPdf(file, say);

  const cut = {
    top: mmToPt(Number(opts.top ?? 0)),
    right: mmToPt(Number(opts.right ?? 0)),
    bottom: mmToPt(Number(opts.bottom ?? 0)),
    left: mmToPt(Number(opts.left ?? 0)),
  };
  if (cut.top + cut.right + cut.bottom + cut.left === 0) {
    throw new ToolError(say('Set at least one margin to crop.', 'Tetapkan sekurang-kurangnya satu jidar untuk dipotong.'));
  }

  const indices = parsePageRange(String(opts.range ?? ''), doc.getPageCount(), say);
  for (const [n, index] of indices.entries()) {
    const page = doc.getPage(index);
    const box = page.getCropBox();
    const rotation = normalizeRotation(page.getRotation().angle);
    const { width: vw, height: vh } = visualSize(box, rotation);
    const w = vw - cut.left - cut.right;
    const h = vh - cut.top - cut.bottom;
    if (w < 36 || h < 36) {
      throw new ToolError(say(
        `Those margins leave less than half an inch of page ${index + 1}. Use smaller margins.`,
        `Jidar itu meninggalkan kurang daripada setengah inci pada halaman ${index + 1}. Gunakan jidar yang lebih kecil.`,
      ));
    }
    const r = visualRectToUser({ x: cut.left, y: cut.top, width: w, height: h }, box, rotation);
    page.setCropBox(r.x, r.y, r.width, r.height);
    ctx.onProgress((n + 1) / indices.length);
  }

  return {
    blob: bytesToBlob(await doc.save(), 'application/pdf'),
    filename: `${stem(file)}-cropped.pdf`,
    summary: say(
      `${indices.length} page${indices.length === 1 ? '' : 's'} cropped · hidden content is still in the file`,
      `${indices.length} halaman dipotong · kandungan tersembunyi masih ada dalam fail`,
    ),
  };
};
