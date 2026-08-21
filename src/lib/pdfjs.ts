import type * as PdfJs from 'pdfjs-dist';

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

export async function loadDocument(file: File) {
  const pdfjs = await getPdfJs();
  return pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
}
