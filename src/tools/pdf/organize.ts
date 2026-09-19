/**
 * Build a new PDF from pages picked out of one or more source PDFs, in any
 * order, each with an extra rotation. Pages are copied, never re-rendered.
 */
export interface PagePick {
  /** Index into the `sources` array. */
  source: number;
  /** Zero-based page index within that source. */
  index: number;
  /** Extra clockwise turn on top of the page's own, in degrees. */
  turn: number;
}

export async function assemble(sources: Uint8Array[], picks: PagePick[]): Promise<Uint8Array> {
  const { PDFDocument, degrees } = await import('pdf-lib');
  const docs = await Promise.all(sources.map((s) => PDFDocument.load(s)));
  const out = await PDFDocument.create();
  for (const pick of picks) {
    const [page] = await out.copyPages(docs[pick.source]!, [pick.index]);
    if (!page) continue;
    if (pick.turn) page.setRotation(degrees((((page.getRotation().angle + pick.turn) % 360) + 360) % 360));
    out.addPage(page);
  }
  return out.save();
}
