import { PDFDocument, StandardFonts } from 'pdf-lib';
import { writeFile, mkdir } from 'node:fs/promises';

await mkdir('e2e/fixtures', { recursive: true });

async function makePdf(pages, label) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (let i = 1; i <= pages; i++) {
    const page = doc.addPage([595, 842]);
    page.drawText(`${label} — page ${i} of ${pages}`, { x: 60, y: 760, size: 22, font });
  }
  return doc.save();
}

await writeFile('e2e/fixtures/two-pages.pdf', await makePdf(2, 'Alpha'));
await writeFile('e2e/fixtures/three-pages.pdf', await makePdf(3, 'Beta'));
console.log('fixtures: two-pages.pdf (2), three-pages.pdf (3)');
