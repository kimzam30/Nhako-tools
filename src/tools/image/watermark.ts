import { ToolError, type FileRun } from '../types';
import { decode, draw, toBlob, replaceExtension, EXTENSION } from '../../lib/canvas';
import { sayer } from '../say';
import { bundle, sameFormat } from './output';

const COLORS: Record<string, string> = { white: '255,255,255', black: '0,0,0', red: '200,16,46' };

export const run: FileRun = async (files, opts, ctx) => {
  const say = sayer(opts);
  if (files.length === 0) throw new ToolError(say('No file selected.', 'Tiada fail dipilih.'));
  const text = String(opts.text ?? '').trim();
  if (!text) throw new ToolError(say('Type the watermark text.', 'Taip teks tera air.'));
  const position = String(opts.position ?? 'tile');
  const opacity = Math.min(1, Math.max(0.05, Number(opts.opacity ?? 35) / 100));
  const sizePct = Number(opts.size ?? 6) / 100;
  const rgb = COLORS[String(opts.color ?? 'white')] ?? COLORS.white;

  const out: { name: string; blob: Blob }[] = [];
  for (const [i, file] of files.entries()) {
    const bitmap = await decode(file, say);
    const mime = sameFormat(file);
    const canvas = draw(bitmap, bitmap.width, bitmap.height, mime);
    const c = canvas.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
    const W = bitmap.width;
    const H = bitmap.height;
    const size = Math.max(10, Math.round(Math.min(W, H) * sizePct));
    c.font = `600 ${size}px system-ui, -apple-system, "Segoe UI", sans-serif`;
    c.fillStyle = `rgba(${rgb},${opacity})`;
    // A thin opposite-coloured outline keeps the text readable on any photo.
    c.strokeStyle = `rgba(${rgb === '0,0,0' ? '255,255,255' : '0,0,0'},${opacity * 0.35})`;
    c.lineWidth = Math.max(1, size / 24);
    c.textBaseline = 'middle';
    const tw = c.measureText(text).width;
    const pad = size;

    const stamp = (x: number, y: number) => { c.strokeText(text, x, y); c.fillText(text, x, y); };

    if (position === 'tile') {
      c.save();
      c.translate(W / 2, H / 2);
      c.rotate(-Math.PI / 6);
      const stepX = tw + size * 3;
      const stepY = size * 4;
      const reach = Math.hypot(W, H);
      for (let y = -reach; y < reach; y += stepY) {
        const offset = (Math.round(y / stepY) % 2) * (stepX / 2);
        for (let x = -reach; x < reach; x += stepX) stamp(x + offset, y);
      }
      c.restore();
    } else if (position === 'center') {
      c.save();
      c.translate(W / 2, H / 2);
      c.rotate(-Math.PI / 6);
      stamp(-tw / 2, 0);
      c.restore();
    } else {
      const x = position.endsWith('left') ? pad : W - pad - tw;
      const y = position.startsWith('top') ? pad : H - pad;
      stamp(x, y);
    }
    bitmap.close();
    out.push({ name: replaceExtension(file.name, EXTENSION[mime]).replace(/(\.[^.]+)$/, '-watermarked$1'), blob: await toBlob(canvas, mime, 0.92, say) });
    ctx.onProgress((i + 1) / files.length);
  }

  const result = await bundle(out, 'watermarked-images.zip');
  return {
    blob: result.blob,
    filename: result.name,
    summary: say(`"${text}" on ${out.length} image${out.length === 1 ? '' : 's'}`, `"${text}" pada ${out.length} imej`),
  };
};
