import { ToolError, type FileRun } from '../types';
import { bytesToBlob } from '../../lib/format';
import { sayer } from '../say';
import { openPdf } from './load';

export const run: FileRun = async (files, opts, ctx) => {
  const say = sayer(opts);
  const file = files[0];
  if (!file) throw new ToolError(say('No file selected.', 'Tiada fail dipilih.'));
  const text = String(opts.text ?? '').trim();
  if (!text) throw new ToolError(say('Enter some watermark text.', 'Masukkan teks tera air.'));

  const { StandardFonts, degrees, rgb } = await import('pdf-lib');

  const doc = await openPdf(file, say);

  const font = await doc.embedFont(StandardFonts.HelveticaBold);

  // The built-in PDF fonts only cover Western European text (WinAnsi). Name
  // the characters that cannot be drawn instead of surfacing pdf-lib's raw
  // "WinAnsi cannot encode" error.
  const supported = new Set(font.getCharacterSet());
  const unsupported = [...new Set([...text].filter((c) => !supported.has(c.codePointAt(0)!)))];
  if (unsupported.length > 0) {
    throw new ToolError(say(
      `The watermark font covers Latin characters only and cannot draw: ${unsupported.slice(0, 8).join(' ')}. ` +
      'Remove those characters and try again.',
      `Fon tera air meliputi aksara Latin sahaja dan tidak dapat melukis: ${unsupported.slice(0, 8).join(' ')}. ` +
      'Buang aksara itu dan cuba lagi.',
    ));
  }
  const size = Number(opts.size ?? 52);
  const angle = Number(opts.angle ?? 45);
  const opacity = Math.min(Math.max(Number(opts.opacity ?? 20) / 100, 0.01), 1);
  const pages = doc.getPages();

  for (const [i, page] of pages.entries()) {
    const { width, height } = page.getSize();
    const textWidth = font.widthOfTextAtSize(text, size);
    const radians = (angle * Math.PI) / 180;
    // Rotation pivots on the draw origin, so offset by half the rotated extent
    // to keep the stamp centred on the page.
    page.drawText(text, {
      x: width / 2 - (textWidth / 2) * Math.cos(radians) + (size / 2) * Math.sin(radians),
      y: height / 2 - (textWidth / 2) * Math.sin(radians) - (size / 2) * Math.cos(radians),
      size,
      font,
      color: rgb(0.1, 0.1, 0.12),
      opacity,
      rotate: degrees(angle),
    });
    ctx.onProgress((i + 1) / pages.length);
  }

  return {
    blob: bytesToBlob(await doc.save(), 'application/pdf'),
    filename: file.name.replace(/\.pdf$/i, '') + '-watermarked.pdf',
    summary: say(`"${text}" on ${pages.length} page${pages.length === 1 ? '' : 's'}`, `"${text}" pada ${pages.length} halaman`),
  };
};
