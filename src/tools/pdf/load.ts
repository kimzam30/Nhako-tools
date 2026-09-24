import { ToolError } from '../types';
import type { Say } from '../say';

/**
 * Open a PDF with pdf-lib, turning its errors into something a person can act on.
 *
 * The page count is read here, inside the same try, because pdf-lib's load()
 * accepts anything that merely starts with "%PDF" and only fails when the
 * catalog is first touched. A truncated download used to load "successfully"
 * and then throw a raw "Cannot read properties of undefined (reading 'Pages')"
 * at the user from whichever line happened to ask for a page first.
 */
export async function openPdf(file: File, say: Say) {
  const { PDFDocument } = await import('pdf-lib');
  try {
    const doc = await PDFDocument.load(await file.arrayBuffer());
    doc.getPageCount();
    return doc;
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
