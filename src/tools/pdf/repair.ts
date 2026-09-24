import { ToolError, type FileRun } from '../types';
import { bytesToBlob } from '../../lib/format';
import { qpdf } from '../../lib/qpdf';
import { getPdfJs } from '../../lib/pdfjs';
import { sayer } from '../say';
import { stem } from './load';

/**
 * Repair a damaged PDF: a download cut short, a broken cross-reference table,
 * objects at the wrong offsets. Two rescuers, then an independent check.
 *
 * 1. qpdf, which rebuilds a broken cross-reference TABLE by scanning for
 *    objects. It exits 0 for a file it read cleanly, 3 when it read it with
 *    warnings (for a damaged file, that is the repair happening) and 2 when it
 *    gave up.
 * 2. pdf-lib, when qpdf gives up. Modern PDFs keep their cross-reference as a
 *    compressed STREAM and pack objects inside other streams; once that
 *    stream's offset is wrong, qpdf's scan cannot reach the packed objects.
 *    pdf-lib ignores offsets and reads the file object by object, which gets
 *    them back. Found 2026-09-25 on this site's own test fixture.
 *
 * Whatever comes out is opened by pdf.js, a third reader that neither rescuer
 * shares code with, so "repaired" is only ever said about a file that opens.
 */

async function pagesIn(bytes: Uint8Array): Promise<number> {
  const pdfjs = await getPdfJs();
  const doc = await pdfjs.getDocument({ data: bytes.slice() }).promise;
  const n = doc.numPages;
  await doc.destroy();
  return n;
}

async function viaPdfLib(input: Uint8Array): Promise<Uint8Array | null> {
  const { PDFDocument } = await import('pdf-lib');
  try {
    const doc = await PDFDocument.load(input, { ignoreEncryption: true, throwOnInvalidObject: false, updateMetadata: false });
    if (doc.getPageCount() < 1) return null;
    return await doc.save({ useObjectStreams: true });
  } catch {
    return null;
  }
}

export const run: FileRun = async (files, opts, ctx) => {
  const say = sayer(opts);
  const file = files[0];
  if (!file) throw new ToolError(say('No file selected.', 'Tiada fail dipilih.'));
  const input = new Uint8Array(await file.arrayBuffer());
  if (!/%PDF-/.test(new TextDecoder('latin1').decode(input.subarray(0, 1024)))) {
    throw new ToolError(say(
      `"${file.name}" is not a PDF: it has no PDF header, so there is nothing to repair.`,
      `"${file.name}" bukan PDF: ia tiada pengepala PDF, jadi tiada apa-apa untuk dibaiki.`,
    ));
  }

  ctx.onProgress(0.2, say('Loading the repair engine', 'Memuatkan enjin pembaikan'));
  const first = await qpdf(input, ['--object-streams=generate', '/in.pdf', '/out.pdf']);
  let bytes: Uint8Array | null = first.code !== 2 && first.bytes ? first.bytes : null;
  let damaged = first.code === 3;

  if (!bytes) {
    if ((await qpdf(input, ['--requires-password', '/in.pdf'])).code === 0) {
      throw new ToolError(say(`"${file.name}" is password-protected. Unlock it first, then repair it.`, `"${file.name}" dilindungi kata laluan. Buka kuncinya dahulu, kemudian baiki.`));
    }
    ctx.onProgress(0.55, say('Trying a deeper rebuild', 'Mencuba pembinaan semula yang lebih mendalam'));
    bytes = await viaPdfLib(input);
    damaged = true;
  }

  ctx.onProgress(0.8, say('Checking the repaired file', 'Menyemak fail yang dibaiki'));
  let pages = 0;
  if (bytes) {
    try { pages = await pagesIn(bytes); } catch { pages = 0; }
  }
  if (!bytes || pages < 1) {
    throw new ToolError(say(
      `"${file.name}" is too badly damaged to recover. If it was downloaded, download it again.`,
      `"${file.name}" terlalu rosak untuk dipulihkan. Jika ia dimuat turun, muat turun semula.`,
    ));
  }
  ctx.onProgress(1);

  return {
    blob: bytesToBlob(bytes, 'application/pdf'),
    filename: `${stem(file)}-repaired.pdf`,
    summary: damaged
      ? say(`Repaired, ${pages} page${pages === 1 ? '' : 's'} recovered`, `Dibaiki, ${pages} halaman dipulihkan`)
      : say(`No damage found; rewritten cleanly, ${pages} page${pages === 1 ? '' : 's'}`, `Tiada kerosakan ditemui; ditulis semula dengan bersih, ${pages} halaman`),
  };
};
