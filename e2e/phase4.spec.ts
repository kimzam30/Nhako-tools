import { test, expect, type Page } from '@playwright/test';
import { PDFDocument, degrees } from 'pdf-lib';

/**
 * Phase 4: the heavy tools. Each check reads what the tool produced (the
 * recognised text, the saved file's text layer, pixels, pages), never just
 * that a Save button appeared.
 */

const LINES = ['The quick brown fox jumps over the lazy dog.', 'Selamat pagi semua, terima kasih kerana datang.'];

/** A PNG of printed text, drawn by the browser; `turn` rotates it 90° clockwise. */
async function textImage(page: Page, turn = false) {
  const b64 = await page.evaluate(([lines, turn]) => {
    const w = 1500; const h = 360;
    const c = document.createElement('canvas');
    c.width = turn ? h : w; c.height = turn ? w : h;
    const x = c.getContext('2d')!;
    x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height);
    if (turn) { x.translate(h, 0); x.rotate(Math.PI / 2); }
    x.fillStyle = '#111'; x.font = '52px Georgia, serif';
    (lines as string[]).forEach((l, i) => x.fillText(l, 50, 120 + i * 110));
    return c.toDataURL('image/png').split(',')[1]!;
  }, [LINES, turn] as const);
  return Buffer.from(b64, 'base64');
}

async function saved(page: Page) {
  const href = await page.getByRole('link', { name: 'Save' }).getAttribute('href');
  const b64 = await page.evaluate(async (h) => {
    const bytes = new Uint8Array(await (await fetch(h!)).arrayBuffer());
    let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(s);
  }, href);
  return Buffer.from(b64, 'base64');
}

/**
 * Words pdf.js finds on each page, with the centre of each as the page is
 * displayed, as fractions from the top-left. Uses pdf.js in Node, not the
 * site's code, so the check is independent of what it checks.
 */
async function textLayer(pdf: Buffer) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const doc = await pdfjs.getDocument({ data: new Uint8Array(pdf) }).promise;
  const pages: { word: string; x: number; y: number }[][] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const p = await doc.getPage(n);
    const vp = p.getViewport({ scale: 1 });
    const items = (await p.getTextContent()).items as { str: string; transform: number[]; width: number; height: number }[];
    pages.push(items.filter((i) => i.str.trim()).map((i) => {
      const [x, y] = vp.convertToViewportPoint(i.transform[4]!, i.transform[5]!);
      return { word: i.str.trim().toLowerCase(), x: x! / vp.width, y: y! / vp.height };
    }));
  }
  return pages;
}

test.describe('OCR', () => {
  test.setTimeout(120_000);

  test('reads English and Malay from an image', async ({ page }) => {
    await page.goto('/image/ocr');
    const png = await textImage(page);
    await page.locator('input[type=file]').setInputFiles({ name: 'note.png', mimeType: 'image/png', buffer: png });
    const out = page.getByLabel('Output');
    await expect(out).toBeVisible({ timeout: 90_000 });
    const text = (await out.inputValue()).toLowerCase();
    for (const w of ['quick', 'brown', 'lazy', 'selamat', 'pagi', 'terima', 'kasih', 'kerana', 'datang']) expect(text).toContain(w);
    await expect(page.getByText(/\d+ words · \d+% confidence/)).toBeVisible();
  });

  test('makes a scanned PDF searchable, with the text over the right words, even on a sideways page', async ({ page }) => {
    await page.goto('/pdf/ocr');
    const png = await textImage(page);
    const doc = await PDFDocument.create();
    const img = await doc.embedPng(png);
    // Page 1: upright. The image spans 40..740 pt across, 40..208 pt down.
    doc.addPage([792, 612]).drawImage(img, { x: 40, y: 612 - 208, width: 700, height: 168 });
    // Page 2: stored portrait with /Rotate 90, the image drawn turned
    // anticlockwise so that it DISPLAYS upright in the same place.
    const side = doc.addPage([612, 792]);
    side.setRotation(degrees(90));
    side.drawImage(img, { x: 208, y: 40, width: 700, height: 168, rotate: degrees(90) });
    const input = Buffer.from(await doc.save());

    await page.locator('input[type=file]').setInputFiles({ name: 'scan.pdf', mimeType: 'application/pdf', buffer: input });
    await expect(page.getByText(/2 pages read/)).toBeVisible({ timeout: 90_000 });
    const out = await saved(page);
    // The pages themselves are untouched: same count and rotation.
    const after = await PDFDocument.load(out);
    expect(after.getPages().map((p) => p.getRotation().angle)).toEqual([0, 90]);

    const layers = await textLayer(out);
    for (const words of layers) {
      const joined = words.map((w) => w.word).join(' ');
      for (const w of ['quick', 'lazy', 'selamat', 'datang']) expect(joined).toContain(w);
      // Every recognised word sits inside the picture as displayed:
      // 40..740 of 792 across, 40..208 of 612 down (baselines, so allow a line).
      for (const w of words) {
        expect(w.x, w.word).toBeGreaterThan(0.03);
        expect(w.x, w.word).toBeLessThan(0.95);
        expect(w.y, w.word).toBeGreaterThan(0.05);
        expect(w.y, w.word).toBeLessThan(0.4);
      }
      // English on the first line, Malay on the second.
      const at = (word: string) => words.find((w) => w.word.includes(word))!;
      expect(at('quick').y).toBeLessThan(at('selamat').y);
      expect(at('quick').x).toBeLessThan(at('lazy').x);
    }
  });

  test('leaves a PDF that already has text alone', async ({ page }) => {
    await page.goto('/pdf/ocr');
    const doc = await PDFDocument.create();
    const { StandardFonts } = await import('pdf-lib');
    const font = await doc.embedFont(StandardFonts.Helvetica);
    doc.addPage().drawText('This page already has a proper text layer to search.', { x: 50, y: 700, size: 14, font });
    await page.locator('input[type=file]').setInputFiles({ name: 'digital.pdf', mimeType: 'application/pdf', buffer: Buffer.from(await doc.save()) });
    await expect(page.getByText('Every page already has text, so there was nothing to read. It is searchable as it is.')).toBeVisible({ timeout: 60_000 });
  });
});

/** A minimal .docx, written by hand, independent of the site's own writer. */
async function handDocx(paragraphs: string[]) {
  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();
  zip.file('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
  zip.file('_rels/.rels', '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
  zip.file('word/document.xml', `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${paragraphs.map((p) => `<w:p><w:r><w:t>${p}</w:t></w:r></w:p>`).join('')}</w:body></w:document>`);
  return zip.generateAsync({ type: 'nodebuffer' });
}

/** A minimal .xlsx with inline strings and numbers. */
async function handXlsx(rows: (string | number)[][]) {
  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();
  zip.file('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>');
  zip.file('_rels/.rels', '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>');
  zip.file('xl/workbook.xml', '<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Sheet1" sheetId="1" r:id="rId1"/></sheets></workbook>');
  zip.file('xl/_rels/workbook.xml.rels', '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>');
  const cells = rows.map((r, i) => `<row r="${i + 1}">${r.map((v, j) => {
    const ref = `${String.fromCharCode(65 + j)}${i + 1}`;
    return typeof v === 'number' ? `<c r="${ref}"><v>${v}</v></c>` : `<c r="${ref}" t="inlineStr"><is><t>${v}</t></is></c>`;
  }).join('')}</row>`).join('');
  zip.file('xl/worksheets/sheet1.xml', `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${cells}</sheetData></worksheet>`);
  return zip.generateAsync({ type: 'nodebuffer' });
}

/** A two-page PDF with a heading, a wrapped paragraph, italics and a second page. */
async function samplePdf() {
  const { StandardFonts } = await import('pdf-lib');
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const body = await doc.embedFont(StandardFonts.TimesRoman);
  const italic = await doc.embedFont(StandardFonts.TimesRomanItalic);
  page.drawText('Laporan Tahunan 2026', { x: 72, y: 760, size: 24, font: bold });
  const lines = ['Syarikat mencatatkan pertumbuhan yang kukuh sepanjang tahun ini,', 'dengan hasil meningkat dalam setiap suku tahun.'];
  lines.forEach((l, i) => page.drawText(l, { x: 72, y: 710 - i * 15, size: 12, font: body }));
  page.drawText('Nota:', { x: 72, y: 660, size: 12, font: body });
  page.drawText('angka belum diaudit.', { x: 104, y: 660, size: 12, font: italic });
  doc.addPage([595, 842]).drawText('Halaman kedua bermula di sini.', { x: 72, y: 760, size: 12, font: body });
  return Buffer.from(await doc.save());
}

const allText = async (pdf: Buffer) => (await textLayer(pdf)).map((p) => p.map((w) => w.word).join(' ')).join(' ');

test.describe('Office to PDF (LibreOffice)', () => {
  test.setTimeout(600_000);
  test.skip(({ browserName }) => browserName !== 'chromium', 'LibreOffice needs about 1 GB; one engine is enough to prove the pipeline');

  // One test, so LibreOffice (250 MB unpacked) starts once per run: two
  // copies starting side by side under a full parallel suite ran out the clock.
  test('converts Word and Excel files, and this site\'s own PDF to Word output, several at once', async ({ page }) => {
    // First, the site's PDF to Word output, to prove a real office suite opens it.
    await page.goto('/pdf/to-word');
    await page.locator('input[type=file]').setInputFiles({ name: 'laporan.pdf', mimeType: 'application/pdf', buffer: await samplePdf() });
    await expect(page.getByRole('link', { name: 'Save' })).toBeVisible({ timeout: 60_000 });
    const ours = await saved(page);

    await page.goto('/pdf/office-to-pdf/word');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Word to PDF');
    await page.locator('input[type=file]').setInputFiles([
      { name: 'surat.docx', mimeType: 'application/octet-stream', buffer: await handDocx(['Surat rasmi kepada Pengarah', 'Tarikh: 19 September 2026']) },
      { name: 'belanjawan.xlsx', mimeType: 'application/octet-stream', buffer: await handXlsx([['Perkara', 'Jumlah'], ['Sewa', 1250], ['Elektrik', 186.4]]) },
      { name: 'laporan.docx', mimeType: 'application/octet-stream', buffer: ours },
    ]);
    await expect(page.getByText('3 files converted')).toBeVisible({ timeout: 420_000 });
    const JSZip = (await import('jszip')).default;
    const zip = await JSZip.loadAsync(await saved(page));
    expect(Object.keys(zip.files).sort()).toEqual(['belanjawan.pdf', 'laporan.pdf', 'surat.pdf']);
    const pdf = async (name: string) => Buffer.from(await zip.file(name)!.async('uint8array'));
    const word = await allText(await pdf('surat.pdf'));
    expect(word).toContain('pengarah');
    expect(word).toContain('september');
    const sheet = await allText(await pdf('belanjawan.pdf'));
    for (const v of ['perkara', 'sewa', '1250', '186.4']) expect(sheet).toContain(v);
    const report = await pdf('laporan.pdf');
    expect((await PDFDocument.load(report)).getPageCount()).toBe(2);
    const text = await allText(report);
    for (const w of ['laporan', 'pertumbuhan', 'diaudit', 'kedua']) expect(text).toContain(w);
  });

  test('refuses a file that is not an office document', async ({ page }) => {
    await page.goto('/pdf/office-to-pdf');
    await page.locator('input[type=file]').setInputFiles({ name: 'photo.png', mimeType: 'image/png', buffer: Buffer.from([0x89, 0x50]) });
    await expect(page.getByText('"photo.png" is not a Word, Excel or PowerPoint file')).toBeVisible();
  });
});

test.describe('PDF to Word', () => {
  test.setTimeout(240_000);


  test('rebuilds headings, paragraphs and styles into a valid .docx', async ({ page }) => {
    await page.goto('/pdf/to-word');
    await page.locator('input[type=file]').setInputFiles({ name: 'laporan.pdf', mimeType: 'application/pdf', buffer: await samplePdf() });
    await expect(page.getByText(/2 pages · \d+ paragraphs · 1 headings/)).toBeVisible({ timeout: 60_000 });
    const docx = await saved(page);
    const JSZip = (await import('jszip')).default;
    const xml = await (await JSZip.loadAsync(docx)).file('word/document.xml')!.async('string');
    // A real XML parser accepts it.
    const errors = await page.evaluate((x) => new DOMParser().parseFromString(x, 'application/xml').getElementsByTagName('parsererror').length, xml);
    expect(errors).toBe(0);
    expect(xml).toMatch(/<w:pStyle w:val="Heading1"\/><\/w:pPr><w:r><w:rPr>[^]*?<w:b\/>[^]*?Laporan Tahunan 2026/);
    // The two body lines are one paragraph again.
    expect(xml).toContain('sepanjang tahun ini, dengan hasil meningkat');
    expect(xml).toMatch(/<w:i\/>[^]*?angka belum diaudit\./);
    expect(xml).toContain('Times New Roman');
    expect(xml).toMatch(/<w:pageBreakBefore\/>[^]*?Halaman kedua/);
  });

  test('says to run OCR first on a scan', async ({ page }) => {
    await page.goto('/pdf/to-word');
    const doc = await PDFDocument.create();
    doc.addPage();
    await page.locator('input[type=file]').setInputFiles({ name: 'scan.pdf', mimeType: 'application/pdf', buffer: Buffer.from(await doc.save()) });
    await expect(page.getByText(/Run it through OCR PDF first/)).toBeVisible();
  });
});

test.describe('Remove background (downloads a model from Hugging Face)', () => {
  test.setTimeout(240_000);

  test('keeps the subject and clears the background to transparent', async ({ page }) => {
    await page.goto('/image/remove-background');
    // An orange ball with shading, on a plain blue backdrop.
    const b64 = await page.evaluate(() => {
      const c = document.createElement('canvas'); c.width = 800; c.height = 600;
      const x = c.getContext('2d')!;
      x.fillStyle = '#1e3a8a'; x.fillRect(0, 0, 800, 600);
      const g = x.createRadialGradient(360, 260, 20, 400, 300, 180);
      g.addColorStop(0, '#fdba74'); g.addColorStop(1, '#c2410c');
      x.fillStyle = g; x.beginPath(); x.arc(400, 300, 180, 0, Math.PI * 2); x.fill();
      return c.toDataURL('image/png').split(',')[1]!;
    });
    await page.locator('input[type=file]').setInputFiles({ name: 'ball.png', mimeType: 'image/png', buffer: Buffer.from(b64, 'base64') });
    await expect(page.getByRole('link', { name: 'Save' })).toBeVisible({ timeout: 200_000 });
    // The output name lives in the rename field now, split from its extension.
    await expect(page.getByLabel('File name')).toHaveValue('ball-no-bg');
    const alpha = await page.evaluate(async (href) => {
      const img = await createImageBitmap(await (await fetch(href!)).blob());
      const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
      const x = c.getContext('2d')!; x.drawImage(img, 0, 0);
      const a = (px: number, py: number) => x.getImageData(px, py, 1, 1).data[3];
      return { size: [img.width, img.height], centre: a(400, 300), inner: a(400, 180), corner: a(20, 20), side: a(760, 300) };
    }, await page.getByRole('link', { name: 'Save' }).getAttribute('href'));
    expect(alpha.size).toEqual([800, 600]);
    expect(alpha.centre).toBeGreaterThan(230);
    expect(alpha.inner).toBeGreaterThan(200);
    expect(alpha.corner).toBeLessThan(25);
    expect(alpha.side).toBeLessThan(25);
  });
});

test.describe('Audio to text', () => {
  // The model is a download, then a full run: the default 30s is not enough.
  test.setTimeout(300_000);

  test('Malay fetches the multilingual model, never the English-only one', async ({ page }) => {
    const models: string[] = [];
    // The ONNX runtime's threaded build spawns pthread workers from code that
    // does not survive bundling; it threw "g is not defined" three times per
    // run and fell back to one thread, so the tool worked and nothing caught
    // it. numThreads = 1 is the fix, and this is what would see it come back.
    const crashes: string[] = [];
    page.on('pageerror', (e) => { if (e.message) crashes.push(e.message); });
    page.on('request', (r) => { const m = /huggingface\.co\/(Xenova\/whisper-[^/]+)\//.exec(r.url()); if (m && !models.includes(m[1]!)) models.push(m[1]!); });
    await page.goto('/media/transcribe');
    await page.getByLabel('Language').selectOption('ms');
    await page.getByLabel('Model').selectOption('fast');
    // A second of silence: enough to make the tool fetch its model.
    const wav = (() => {
      const n = 16000; const b = Buffer.alloc(44 + n * 2);
      b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
      b.writeUInt32LE(16000, 24); b.writeUInt32LE(32000, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(n * 2, 40);
      return b;
    })();
    await page.locator('input[type=file]').setInputFiles({ name: 'quiet.wav', mimeType: 'audio/wav', buffer: wav });
    await expect.poll(() => models, { timeout: 60_000 }).toContain('Xenova/whisper-base');
    expect(models.some((m) => m.endsWith('.en'))).toBe(false);

    // Let the run reach the point where the runtime starts its session.
    await expect(page.getByRole('link', { name: 'Save' }).or(page.locator('[data-status-message]'))).toBeVisible({ timeout: 180_000 });
    expect(crashes).toEqual([]);
  });
});

test.describe('Scan to PDF', () => {
  /** A phone-style photo: a tilted white page with lines of "text" on a dark desk. */
  async function photo(page: Page) {
    const b64 = await page.evaluate(() => {
      const c = document.createElement('canvas'); c.width = 1200; c.height = 1600;
      const x = c.getContext('2d')!;
      x.fillStyle = '#3f3f46'; x.fillRect(0, 0, 1200, 1600);
      x.save(); x.translate(600, 800); x.rotate(0.08);
      // An A4-shaped sheet, 840 x 1188.
      x.fillStyle = '#f4f1ea'; x.fillRect(-420, -594, 840, 1188);
      x.fillStyle = '#222';
      for (let i = 0; i < 18; i++) x.fillRect(-340, -500 + i * 55, 520 + ((i * 37) % 150), 14);
      x.restore();
      return c.toDataURL('image/jpeg', 0.9).split(',')[1]!;
    });
    return { name: 'page.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(b64, 'base64') };
  }

  test('finds, straightens and saves the page as an A4 PDF', async ({ page }) => {
    await page.goto('/pdf/scan');
    await page.locator('#scan-choose').setInputFiles(await photo(page));
    await expect(page.getByRole('img', { name: 'Page 1' })).toBeVisible({ timeout: 30_000 });
    // The flattened page has the sheet's shape (840 x 1188 is 0.707), not the photo's (0.75).
    const ratio = await page.getByRole('img', { name: 'Page 1' }).evaluate((img: HTMLImageElement) => img.naturalWidth / img.naturalHeight);
    expect(ratio).toBeGreaterThan(0.68);
    expect(ratio).toBeLessThan(0.73);
    await page.getByTestId('make-pdf').click();
    const link = page.getByRole('link', { name: /Save PDF/ });
    await expect(link).toBeVisible();
    const pdf = await (async () => {
      const href = await link.getAttribute('href');
      const b64 = await page.evaluate(async (h) => {
        const bytes = new Uint8Array(await (await fetch(h!)).arrayBuffer());
        let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
        return btoa(s);
      }, href);
      return PDFDocument.load(Buffer.from(b64, 'base64'));
    })();
    expect(pdf.getPageCount()).toBe(1);
    const { width, height } = pdf.getPage(0).getSize();
    expect([Math.round(width), Math.round(height)]).toEqual([595, 842]);
  });

  test('corners can be moved with the keyboard, and pages reordered and removed', async ({ page }) => {
    await page.goto('/pdf/scan');
    await page.locator('#scan-choose').setInputFiles([await photo(page), { ...(await photo(page)), name: 'second.jpg' }]);
    await expect(page.getByRole('img', { name: 'Page 2' })).toBeVisible({ timeout: 30_000 });
    await page.getByRole('button', { name: 'Adjust: Page 1' }).click();
    const before = await page.getByRole('img', { name: 'Page 1' }).evaluate((img: HTMLImageElement) => img.naturalWidth);
    // Pull both right-hand corners in: the page's width is its longer edge.
    for (const corner of ['Top-right corner', 'Bottom-right corner']) {
      await page.getByRole('button', { name: corner }).focus();
      for (let i = 0; i < 5; i++) await page.keyboard.press('Shift+ArrowLeft');
    }
    await expect.poll(() => page.getByRole('img', { name: 'Page 1' }).evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeLessThan(before * 0.9);
    await page.getByRole('button', { name: 'Done' }).click();
    await page.getByRole('button', { name: 'Remove: Page 2' }).click();
    await expect(page.getByText('1 page', { exact: true })).toBeVisible();
  });
});
