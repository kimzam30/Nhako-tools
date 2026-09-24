import { ToolError, type FileRun } from '../types';
import { loadDocument } from '../../lib/pdfjs';
import { sayer } from '../say';

export const run: FileRun = async (files, opts, ctx) => {
  const say = sayer(opts);
  const file = files[0];
  if (!file) throw new ToolError(say('No file selected.', 'Tiada fail dipilih.'));
  const doc = await loadDocument(file, say);

  const chunks: string[] = [];
  let characters = 0;

  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const text = content.items.map((item) => ('str' in item ? item.str : '')).join(' ').replace(/\s+/g, ' ').trim();
    characters += text.length;
    chunks.push(`--- ${say('Page', 'Halaman')} ${i} ---\n\n${text}\n`);
    ctx.onProgress(i / doc.numPages);
  }

  if (characters === 0) {
    throw new ToolError(say(
      'This PDF has no text layer, so it is almost certainly a scan. Extracting text from it would need OCR, which this tool does not do.',
      'PDF ini tiada lapisan teks, jadi ia hampir pasti sebuah imbasan. Mengeluarkan teks daripadanya memerlukan OCR, yang alat ini tidak lakukan.',
    ));
  }

  return {
    blob: new Blob([chunks.join('\n')], { type: 'text/plain;charset=utf-8' }),
    filename: file.name.replace(/\.pdf$/i, '') + '.txt',
    summary: say(
      `${doc.numPages} page${doc.numPages === 1 ? '' : 's'} · ${characters.toLocaleString()} characters`,
      `${doc.numPages} halaman · ${characters.toLocaleString()} aksara`,
    ),
  };
};
