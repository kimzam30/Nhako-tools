import { ToolError, type FileRun } from '../types';
import { decode, surface, toBlob, replaceExtension, EXTENSION, hasAlpha } from '../../lib/canvas';
import { sayer } from '../say';
import { bundle, sameFormat } from './output';

export const run: FileRun = async (files, opts, ctx) => {
  const say = sayer(opts);
  if (files.length === 0) throw new ToolError(say('No file selected.', 'Tiada fail dipilih.'));
  const action = String(opts.action ?? 'cw');

  const out: { name: string; blob: Blob }[] = [];
  for (const [i, file] of files.entries()) {
    const bitmap = await decode(file);
    const turn = action === 'cw' || action === 'ccw';
    const w = turn ? bitmap.height : bitmap.width;
    const h = turn ? bitmap.width : bitmap.height;
    const canvas = surface(w, h);
    const c = canvas.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
    const mime = sameFormat(file);
    if (!hasAlpha(mime)) { c.fillStyle = '#ffffff'; c.fillRect(0, 0, w, h); }
    c.translate(w / 2, h / 2);
    if (action === 'cw') c.rotate(Math.PI / 2);
    else if (action === 'ccw') c.rotate(-Math.PI / 2);
    else if (action === '180') c.rotate(Math.PI);
    else if (action === 'flip-h') c.scale(-1, 1);
    else if (action === 'flip-v') c.scale(1, -1);
    c.drawImage(bitmap, -bitmap.width / 2, -bitmap.height / 2);
    bitmap.close();
    out.push({ name: replaceExtension(file.name, EXTENSION[mime]), blob: await toBlob(canvas, mime, 0.92) });
    ctx.onProgress((i + 1) / files.length);
  }

  const result = await bundle(out, 'rotated-images.zip');
  return {
    blob: result.blob,
    filename: result.name,
    summary: say(`${out.length} image${out.length === 1 ? '' : 's'} done`, `${out.length} imej siap`),
  };
};
