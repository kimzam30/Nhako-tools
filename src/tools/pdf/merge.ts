import { ToolError, type FileRun } from '../types';
import { bytesToBlob } from '../../lib/format';

export const run: FileRun = async (files, _opts, ctx) => {
  const { PDFDocument } = await import('pdf-lib');
  const pdfs = files.filter((f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'));
  if (pdfs.length === 0) throw new ToolError('None of those are PDFs.');
  if (pdfs.length < 2) throw new ToolError('Merging needs at least two PDFs. Drop another one in.');

  const merged = await PDFDocument.create();
  let pageCount = 0;

  for (const [i, file] of pdfs.entries()) {
    let doc;
    try {
      doc = await PDFDocument.load(await file.arrayBuffer());
    } catch {
      throw new ToolError(`Could not read "${file.name}". If it is password-protected, unlock it first.`);
    }
    const pages = await merged.copyPages(doc, doc.getPageIndices());
    for (const page of pages) merged.addPage(page);
    pageCount += pages.length;
    ctx.onProgress((i + 1) / pdfs.length);
  }

  return {
    blob: bytesToBlob(await merged.save(), 'application/pdf'),
    filename: 'merged.pdf',
    summary: `${pdfs.length} files · ${pageCount} pages`,
  };
};
