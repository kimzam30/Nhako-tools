import { ToolError, type FileRun } from '../types';
import { bytesToBlob } from '../../lib/format';

export const run: FileRun = async (files, opts, ctx) => {
  const file = files[0];
  if (!file) throw new ToolError('No file selected.');
  const text = String(opts.text ?? '').trim();
  if (!text) throw new ToolError('Enter some watermark text.');

  const { PDFDocument, StandardFonts, degrees, rgb } = await import('pdf-lib');

  let doc;
  try {
    doc = await PDFDocument.load(await file.arrayBuffer());
  } catch {
    throw new ToolError(`Could not read "${file.name}". If it is password-protected, unlock it first.`);
  }

  const font = await doc.embedFont(StandardFonts.HelveticaBold);
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
    summary: `"${text}" on ${pages.length} page${pages.length === 1 ? '' : 's'}`,
  };
};
