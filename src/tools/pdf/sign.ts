import { normalizeRotation, visualToUser, visualSize, type Box } from '../../lib/pdf-geometry';

/**
 * A signature (or any PNG) placed on a page, in DISPLAYED coordinates:
 * points from the top-left of the page as the reader sees it.
 */
export interface Placement {
  page: number;
  rect: Box;
  png: Uint8Array;
}

/** Stamp each placement into the PDF, upright however the page is rotated. */
export async function stamp(pdf: Uint8Array, placements: Placement[]): Promise<Uint8Array> {
  const { PDFDocument, degrees } = await import('pdf-lib');
  const doc = await PDFDocument.load(pdf);
  const cache = new Map<Uint8Array, Awaited<ReturnType<typeof doc.embedPng>>>();
  for (const p of placements) {
    const page = doc.getPage(p.page);
    const box = page.getCropBox();
    const rotation = normalizeRotation(page.getRotation().angle);
    let image = cache.get(p.png);
    if (!image) { image = await doc.embedPng(p.png); cache.set(p.png, image); }
    // Anchor at the displayed bottom-left; pdf-lib rotates anticlockwise about
    // it, which undoes the page's clockwise display rotation. Width and height
    // are along the image's own axes, so they are the displayed size as-is.
    const at = visualToUser(p.rect.x, p.rect.y + p.rect.height, box, rotation);
    page.drawImage(image, { x: at.x, y: at.y, width: p.rect.width, height: p.rect.height, rotate: degrees(rotation) });
  }
  return doc.save();
}

/** The displayed size of every page, for laying out previews. */
export async function pageSizes(pdf: Uint8Array) {
  const { PDFDocument } = await import('pdf-lib');
  const doc = await PDFDocument.load(pdf);
  return doc.getPages().map((page) => visualSize(page.getCropBox(), normalizeRotation(page.getRotation().angle)));
}
