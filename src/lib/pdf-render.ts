import { getPdfJs } from './pdfjs';

export type PdfJsDoc = Awaited<ReturnType<Awaited<ReturnType<typeof getPdfJs>>['getDocument']>['promise']>;

/** Open PDF bytes for previewing. pdf.js takes ownership of the buffer, so it gets a copy. */
export async function openForPreview(bytes: Uint8Array): Promise<PdfJsDoc> {
  const pdfjs = await getPdfJs();
  return pdfjs.getDocument({ data: bytes.slice() }).promise;
}

export interface RenderedPage {
  /** Object URL of a PNG; revoke it when done. */
  url: string;
  /** Displayed size in PDF points (rotation applied). */
  widthPt: number;
  heightPt: number;
}

/** Render page `n` (1-based) about `cssWidth` CSS pixels wide, sharp on high-density screens. */
export async function renderPage(doc: PdfJsDoc, n: number, cssWidth: number): Promise<RenderedPage> {
  const page = await doc.getPage(n);
  const base = page.getViewport({ scale: 1 });
  const dpr = typeof window === 'undefined' ? 1 : Math.min(2, window.devicePixelRatio || 1);
  const viewport = page.getViewport({ scale: (cssWidth * dpr) / base.width });
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvas, canvasContext: ctx, viewport }).promise;
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('render'))), 'image/png'));
  page.cleanup();
  return { url: URL.createObjectURL(blob), widthPt: base.width, heightPt: base.height };
}
