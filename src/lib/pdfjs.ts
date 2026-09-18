import type * as PdfJs from 'pdfjs-dist';
import { ToolError } from '../tools/types';

let cached: typeof PdfJs | null = null;

/** Load pdf.js once and point it at the bundled worker. */
export async function getPdfJs(): Promise<typeof PdfJs> {
  if (cached) return cached;
  const pdfjs = await import('pdfjs-dist');
  const workerSrc = (await import('pdfjs-dist/build/pdf.worker.mjs?url')).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;
  cached = pdfjs;
  return pdfjs;
}

/** Open a PDF, turning pdf.js's internal exceptions into a message a person can act on. */
export async function loadDocument(file: File) {
  const pdfjs = await getPdfJs();
  try {
    return await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  } catch (err) {
    const locked = err instanceof Error && err.name === 'PasswordException';
    throw new ToolError(
      locked
        ? `"${file.name}" is password-protected. Unlock it first, then try again.`
        : `Could not read "${file.name}". It may be corrupt or not a PDF.`,
    );
  }
}
