import { ToolError, type FileRun } from '../types';
import { loadDocument } from '../../lib/pdfjs';

export const run: FileRun = async (files, _opts, ctx) => {
  const file = files[0];
  if (!file) throw new ToolError('No file selected.');
  const doc = await loadDocument(file);

  const chunks: string[] = [];
  let characters = 0;

  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const text = content.items.map((item) => ('str' in item ? item.str : '')).join(' ').replace(/\s+/g, ' ').trim();
    characters += text.length;
    chunks.push(`--- Page ${i} ---\n\n${text}\n`);
    ctx.onProgress(i / doc.numPages);
  }

  if (characters === 0) {
    throw new ToolError(
      'This PDF has no text layer, so it is almost certainly a scan. Extracting text from it would need OCR, which this tool does not do.',
    );
  }

  return {
    blob: new Blob([chunks.join('\n')], { type: 'text/plain;charset=utf-8' }),
    filename: file.name.replace(/\.pdf$/i, '') + '.txt',
    summary: `${doc.numPages} pages · ${characters.toLocaleString()} characters`,
  };
};
