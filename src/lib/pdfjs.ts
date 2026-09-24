import type * as PdfJs from 'pdfjs-dist';
import { ToolError } from '../tools/types';
import { sayer, type Say } from '../tools/say';

/** English on its own, for callers with no page locale to hand. */
const englishOnly: Say = sayer({});

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
export async function loadDocument(file: File, say: Say = englishOnly) {
  const pdfjs = await getPdfJs();
  try {
    return await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  } catch (err) {
    const locked = err instanceof Error && err.name === 'PasswordException';
    throw new ToolError(
      locked
        ? say(
          `"${file.name}" is password-protected. Unlock it first, then try again.`,
          `"${file.name}" dilindungi kata laluan. Buka kuncinya dahulu, kemudian cuba lagi.`,
        )
        : say(
          `Could not read "${file.name}". It may be corrupt or not a PDF.`,
          `Tidak dapat membaca "${file.name}". Ia mungkin rosak atau bukan PDF.`,
        ),
    );
  }
}
