import { ToolError, type FileRun } from '../types';
import { bytesToBlob } from '../../lib/format';
import { convertWithRetry, libreOffice, Timeout } from '../../lib/libreoffice';
import { sayer } from '../say';

/** What LibreOffice is asked to read, by extension. */
const FORMATS: Record<string, string> = {
  doc: 'doc', docx: 'docx', odt: 'odt', rtf: 'rtf', txt: 'txt',
  xls: 'xls', xlsx: 'xlsx', ods: 'ods', csv: 'csv',
  ppt: 'ppt', pptx: 'pptx', odp: 'odp',
};

export const extensionOf = (name: string) => name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? '';

/**
 * Word, Excel and PowerPoint to PDF with LibreOffice, running in the browser.
 * The engine is a large one-time download; after that every conversion is
 * local and quick.
 */
export const run: FileRun = async (files, opts, ctx) => {
  const say = sayer(opts);
  if (files.length === 0) throw new ToolError(say('No file selected.', 'Tiada fail dipilih.'));
  for (const f of files) {
    if (!FORMATS[extensionOf(f.name)]) {
      throw new ToolError(say(
        `"${f.name}" is not a Word, Excel or PowerPoint file (or their OpenDocument equivalents).`,
        `"${f.name}" bukan fail Word, Excel atau PowerPoint (atau setaranya dalam OpenDocument).`,
      ));
    }
  }

  const progress = (f: number, stage: 'download' | 'start') => ctx.onProgress(
    stage === 'download' ? f * 0.6 : 0.6 + f * 0.2,
    stage === 'download' ? say('Downloading LibreOffice (once, about 77 MB)', 'Memuat turun LibreOffice (sekali, kira-kira 77 MB)') : say('Starting LibreOffice', 'Memulakan LibreOffice'),
  );
  try {
    await libreOffice(progress);
  } catch {
    throw new ToolError(say(
      'LibreOffice could not start. It needs a recent desktop browser with about 1 GB of free memory; check your connection and try again.',
      'LibreOffice tidak dapat dimulakan. Ia memerlukan pelayar desktop terkini dengan kira-kira 1 GB memori kosong; semak sambungan anda dan cuba lagi.',
    ));
  }

  const outputs: { blob: Blob; name: string }[] = [];
  for (const [i, file] of files.entries()) {
    ctx.onProgress(0.8 + (0.2 * i) / files.length, say(`Converting ${file.name}`, `Menukar ${file.name}`));
    const ext = extensionOf(file.name);
    let result;
    try {
      result = await convertWithRetry(new Uint8Array(await file.arrayBuffer()), { outputFormat: 'pdf', inputFormat: FORMATS[ext] as never }, file.name, progress);
    } catch (err) {
      const locked = /password|encrypt/i.test(String(err));
      if (err instanceof Timeout) {
        throw new ToolError(say(
          `LibreOffice stopped responding while converting "${file.name}", twice. Try again, or split a very large file.`,
          `LibreOffice berhenti bertindak balas semasa menukar "${file.name}", dua kali. Cuba lagi, atau pecahkan fail yang sangat besar.`,
        ));
      }
      throw new ToolError(locked
        ? say(`"${file.name}" is password-protected. Remove the password in Office first.`, `"${file.name}" dilindungi kata laluan. Buang kata laluan dalam Office dahulu.`)
        : say(`LibreOffice could not convert "${file.name}". It may be damaged, or use a feature it cannot read.`, `LibreOffice tidak dapat menukar "${file.name}". Ia mungkin rosak, atau menggunakan ciri yang tidak dapat dibaca.`));
    }
    outputs.push({ blob: bytesToBlob(result.data, 'application/pdf'), name: file.name.replace(/\.[^.]+$/, '') + '.pdf' });
  }
  ctx.onProgress(1);

  const summary = say(`${outputs.length} file${outputs.length === 1 ? '' : 's'} converted`, `${outputs.length} fail ditukar`);
  if (outputs.length === 1) return { blob: outputs[0]!.blob, filename: outputs[0]!.name, summary };
  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();
  for (const o of outputs) zip.file(o.name, o.blob);
  return { blob: await zip.generateAsync({ type: 'blob' }), filename: 'converted-pdfs.zip', summary };
};
