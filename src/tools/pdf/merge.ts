import { ToolError, type FileRun } from '../types';
import { bytesToBlob } from '../../lib/format';
import { sayer } from '../say';
import { openPdf } from './load';

export const run: FileRun = async (files, opts, ctx) => {
  const say = sayer(opts);
  const { PDFDocument } = await import('pdf-lib');
  const pdfs = files.filter((f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'));
  if (pdfs.length === 0) throw new ToolError(say('None of those are PDFs.', 'Tiada satu pun daripada itu adalah PDF.'));
  if (pdfs.length < 2) throw new ToolError(say(
    'Merging needs at least two PDFs. Drop another one in.',
    'Penggabungan memerlukan sekurang-kurangnya dua PDF. Lepaskan satu lagi.',
  ));

  const merged = await PDFDocument.create();
  let pageCount = 0;

  for (const [i, file] of pdfs.entries()) {
    const doc = await openPdf(file, say);
    const pages = await merged.copyPages(doc, doc.getPageIndices());
    for (const page of pages) merged.addPage(page);
    pageCount += pages.length;
    ctx.onProgress((i + 1) / pdfs.length);
  }

  return {
    blob: bytesToBlob(await merged.save(), 'application/pdf'),
    filename: 'merged.pdf',
    summary: say(`${pdfs.length} files, ${pageCount} pages`, `${pdfs.length} fail, ${pageCount} halaman`),
  };
};
