import { ToolError } from '../types';
import type { Say } from '../say';

/** Open a PDF with pdf-lib, turning its errors into something a person can act on. */
export async function openPdf(file: File, say: Say) {
  const { PDFDocument } = await import('pdf-lib');
  try {
    return await PDFDocument.load(await file.arrayBuffer());
  } catch (err) {
    if (/encrypt/i.test(String(err))) {
      throw new ToolError(say(
        `"${file.name}" is password-protected. Open it with Unlock PDF first.`,
        `"${file.name}" dilindungi kata laluan. Buka dengan Buka Kunci PDF dahulu.`,
      ));
    }
    throw new ToolError(say(`Could not read "${file.name}" as a PDF.`, `"${file.name}" tidak dapat dibaca sebagai PDF.`));
  }
}

export const stem = (file: File) => file.name.replace(/\.pdf$/i, '');
