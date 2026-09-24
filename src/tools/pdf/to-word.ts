import { ToolError, type FileRun } from '../types';
import { bytesToBlob } from '../../lib/format';
import { loadDocument, getPdfJs } from '../../lib/pdfjs';
import { buildDocx, type DocxPage } from '../../lib/docx';
import { familyOf, isBold, isItalic, toBlocks, type TextPiece } from './word-layout';
import { sayer } from '../say';

const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

/**
 * PDF to an editable Word document. The text of each page is read with its
 * position, size and font, rebuilt into paragraphs and headings
 * (word-layout.ts), and written as a real .docx (lib/docx.ts). Nothing is
 * rendered to pictures: what you get is text you can edit.
 */
export const run: FileRun = async (files, opts, ctx) => {
  const say = sayer(opts);
  const file = files[0];
  if (!file) throw new ToolError(say('No file selected.', 'Tiada fail dipilih.'));
  const doc = await loadDocument(file, say);
  const { Util } = await getPdfJs();

  const pages: DocxPage[] = [];
  const fontChars = new Map<string, number>();
  const sizeChars = new Map<number, number>();
  let chars = 0;
  let first: { width: number; height: number } | null = null;
  const bounds = { left: Infinity, right: -Infinity, top: Infinity, bottom: -Infinity };

  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    const viewport = page.getViewport({ scale: 1 });
    first ??= { width: viewport.width, height: viewport.height };
    // Loading the operator list loads the fonts, whose real names say bold
    // or italic; the text content alone only has internal ids.
    await page.getOperatorList();
    const content = await page.getTextContent();
    const pieces: TextPiece[] = [];
    for (const item of content.items) {
      if (!('str' in item) || !item.str) continue;
      const t = Util.transform(viewport.transform, item.transform);
      const size = Math.hypot(t[2]!, t[3]!);
      if (size < 1) continue;
      let name = '';
      try {
        const font = page.commonObjs.get(item.fontName) as { name?: string; bold?: boolean; italic?: boolean } | undefined;
        name = font?.name ?? '';
      } catch { /* font not loaded: fall back to its family below */ }
      const family = name ? familyOf(name) : content.styles[item.fontName]?.fontFamily === 'serif' ? 'Times New Roman' : 'Calibri';
      pieces.push({
        str: item.str, x: t[4]!, y: t[5]!, width: item.width || item.str.length * size * 0.5,
        size, bold: isBold(name), italic: isItalic(name), font: family,
      });
      fontChars.set(family, (fontChars.get(family) ?? 0) + item.str.length);
      const rounded = Math.round(size * 2) / 2;
      sizeChars.set(rounded, (sizeChars.get(rounded) ?? 0) + item.str.length);
      chars += item.str.trim().length;
      bounds.left = Math.min(bounds.left, t[4]!);
      bounds.right = Math.max(bounds.right, t[4]! + item.width);
      bounds.top = Math.min(bounds.top, t[5]! - size);
      bounds.bottom = Math.max(bounds.bottom, t[5]!);
    }
    pages.push({ blocks: toBlocks(pieces, viewport.width) });
    page.cleanup();
    ctx.onProgress(n / doc.numPages, say(`Reading page ${n} of ${doc.numPages}`, `Membaca halaman ${n} daripada ${doc.numPages}`));
  }

  if (chars === 0) {
    throw new ToolError(say(
      'This PDF has no text to convert: it is almost certainly a scan. Run it through OCR PDF first, then convert the result.',
      'PDF ini tiada teks untuk ditukar: ia hampir pasti imbasan. Jalankan melalui OCR PDF dahulu, kemudian tukar hasilnya.',
    ));
  }

  const most = <K,>(m: Map<K, number>, d: K) => [...m.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? d;
  const size = { width: first!.width, height: first!.height };
  // Margins from where the text actually sits, within sensible limits.
  const clamp = (v: number) => Math.min(108, Math.max(36, Math.round(v)));
  const margin = {
    left: clamp(bounds.left), right: clamp(size.width - bounds.right),
    top: clamp(bounds.top), bottom: clamp(size.height - bounds.bottom),
  };
  const bytes = await buildDocx(pages, { ...size, margin, title: file.name.replace(/\.pdf$/i, '') }, { size: most(sizeChars, 11), font: most(fontChars, 'Calibri') });
  const paragraphs = pages.reduce((a, p) => a + p.blocks.length, 0);
  const headings = pages.reduce((a, p) => a + p.blocks.filter((b) => b.kind === 'heading').length, 0);

  return {
    blob: bytesToBlob(bytes, DOCX),
    filename: file.name.replace(/\.pdf$/i, '') + '.docx',
    summary: say(
      `${doc.numPages} page${doc.numPages === 1 ? '' : 's'}, ${paragraphs} paragraphs, ${headings} headings`,
      `${doc.numPages} halaman, ${paragraphs} perenggan, ${headings} tajuk`,
    ),
  };
};
