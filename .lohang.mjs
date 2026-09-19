import { chromium } from '@playwright/test';
import JSZip from 'jszip';
const zip = new JSZip();
zip.file('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
zip.file('_rels/.rels', '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
zip.file('word/document.xml', '<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Hi</w:t></w:r></w:p></w:body></w:document>');
const docx = await zip.generateAsync({ type: 'nodebuffer' });
const b = await chromium.launch();
let fails = 0, slow = 0;
for (let i = 0; i < 24; i++) {
  const ctx = await b.newContext(); const p = await ctx.newPage();
  const retried = [];
  p.on('console', (m) => { if (m.text().includes('Progress tracking disabled')) retried.push(1); });
  await p.goto('http://localhost:4399/pdf/office-to-pdf');
  const t = Date.now();
  await p.locator('input[type=file]').setInputFiles({ name: 'a.docx', mimeType: 'application/octet-stream', buffer: docx });
  const ok = await p.getByRole('link', { name: 'Save' }).waitFor({ timeout: 150000 }).then(() => true, () => false);
  const ms = Date.now() - t;
  if (!ok) fails++;
  if (ms > 20000) slow++;
  console.log(i, ok ? 'ok' : 'FAIL', ms, 'ms', 'engines started:', retried.length);
  await ctx.close();
}
console.log('fails', fails, 'recovered (slow)', slow);
await b.close();
