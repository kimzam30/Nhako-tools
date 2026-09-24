/**
 * Exercise every tool with a generic interface in a real browser and report
 * what actually happens. Run against `npm run preview` (needs the COOP/COEP
 * headers).
 *
 * The seven tools with their own interface (kind 'app': Organize, Sign, Scan,
 * Crop image, Passport photo, Salary calculator, Teleprompter) cannot be
 * driven from here, because there is no shared drop-zone-and-options shape to
 * drive. They are covered by the e2e suite, which knows each of their UIs.
 */
/* global window, document, DataTransfer */
import { chromium } from '@playwright/test';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = process.env.BASE ?? 'http://localhost:4321';
const only = process.argv[2];

const PDF = fileURLToPath(new URL('../e2e/fixtures/three-pages.pdf', import.meta.url));
const HEIC = fileURLToPath(new URL('../e2e/fixtures/photo.heic', import.meta.url));
const SCRATCH = mkdtempSync(join(tmpdir(), 'nhako-sweep-'));

/** A minimal .docx, so Office to PDF has something real to convert. */
function docx() {
  const path = join(SCRATCH, 'surat.docx');
  const files = {
    '[Content_Types].xml': '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
    '_rels/.rels': '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
    'word/document.xml': '<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Surat rasmi kepada Pengarah</w:t></w:r></w:p></w:body></w:document>',
  };
  // A stored (uncompressed) ZIP, written by hand so the script needs no deps.
  const parts = []; const central = []; let offset = 0;
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc32 = (buf) => {
    let c = 0xffffffff;
    for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  for (const [name, text] of Object.entries(files)) {
    const data = Buffer.from(text, 'utf8');
    const nameBuf = Buffer.from(name, 'utf8');
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4);
    local.writeUInt32LE(crc, 14); local.writeUInt32LE(data.length, 18); local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    parts.push(local, nameBuf, data);
    const dir = Buffer.alloc(46);
    dir.writeUInt32LE(0x02014b50, 0); dir.writeUInt16LE(20, 4); dir.writeUInt16LE(20, 6);
    dir.writeUInt32LE(crc, 16); dir.writeUInt32LE(data.length, 20); dir.writeUInt32LE(data.length, 24);
    dir.writeUInt16LE(nameBuf.length, 28); dir.writeUInt32LE(offset, 42);
    central.push(dir, nameBuf);
    offset += local.length + nameBuf.length + data.length;
  }
  const body = Buffer.concat(parts);
  const dirBuf = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(Object.keys(files).length, 8); end.writeUInt16LE(Object.keys(files).length, 10);
  end.writeUInt32LE(dirBuf.length, 12); end.writeUInt32LE(body.length, 16);
  writeFileSync(path, Buffer.concat([body, dirBuf, end]));
  return path;
}
const DOCX = docx();
// The image fixture is drawn here rather than read from disk: it used to
// point at dist/_fixtures/test.png, which nothing ever created, so every
// image tool reported THREW. Half of it is transparent on purpose.
const PNG = join(SCRATCH, 'test.png');
/** A page of printed text, for the two OCR tools. */
const TEXT_PNG = join(SCRATCH, 'printed.png');

const TEXT_CASES = {
  'dev/json': '{"b":1,"a":{"d":2,"c":[3,4]}}',
  'dev/jwt': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxIiwibmFtZSI6IkFkYSIsImV4cCI6MjUzMzcwNzY0ODAwfQ.sig',
  'dev/base64': 'héllo 🎉 wörld',
  'dev/word-count': 'one two three four five. six seven!',
  'dev/hash': 'abc',
  'dev/qr': 'https://tools.nhako.com',
  'dev/css-shadow': '',
  'dev/uuid': '',
  'dev/diff': 'alpha\nbeta\ngamma',
};

// `action`: the staging apps (Merge, Split, JPG to PDF) deliberately do not
// run when a file lands; a person stages files, then presses this button.
// `filesFirst`: a `stageFirst` tool withholds its settings until a file is in.
// Both changed on 2026-09-24 and the sweep was not updated until 2026-09-25,
// so these four read as HANG/THREW in between without anything being broken.
const FILE_CASES = {
  'pdf/merge': { files: [PDF, PDF], action: 'Combine into one PDF' },
  'pdf/split': { files: [PDF], action: 'Split' },
  'pdf/compress': { files: [PDF] },
  'pdf/to-image': { files: [PDF] },
  'pdf/to-text': { files: [PDF] },
  'pdf/rotate': { files: [PDF] },
  'pdf/watermark': { files: [PDF] },
  'image/compress': { files: [PNG] },
  'image/convert': { files: [PNG] },
  'image/resize': { files: [PNG] },
  'image/rotate': { files: [PNG] },
  'image/remove-metadata': { files: [PNG] },
  'pdf/jpg-to-pdf': { files: [PNG], action: 'Make the PDF' },
  'pdf/page-numbers': { files: [PDF] },
  'pdf/crop': { files: [PDF] },
  'pdf/to-word': { files: [PDF] },
  'image/remove-background': { files: [PNG], timeout: 240_000, note: 'downloads ~45MB model' },
  'media/compress-video': { video: true, timeout: 90_000 },
  'media/extract-audio': { video: true, timeout: 90_000 },
  'media/transcribe': { video: true, timeout: 300_000, note: 'downloads ~39MB model' },
  'image/watermark': { files: [PNG], options: { Text: 'DRAFT' }, filesFirst: true },
  'image/heic-to-jpg': { files: [HEIC], timeout: 60_000 },
  'image/ocr': { files: [TEXT_PNG], timeout: 120_000, note: 'downloads ~15MB of language data' },
  'pdf/ocr': { files: [PDF], timeout: 120_000, note: 'the fixture already has text, so it reports that' },
  'pdf/protect': { files: [PDF], options: { Password: 'rahsia123' } },
  // Locked by pdf/protect at startup, so Unlock is exercised on a real
  // encrypted file rather than on one with nothing to unlock.
  'pdf/unlock': { locked: true, options: { Password: 'rahsia123' }, timeout: 60_000 },
  'pdf/office-to-pdf': { files: [DOCX], timeout: 420_000, note: 'downloads ~77MB of LibreOffice' },
  'pdf/n-up': { files: [PDF] },
  'pdf/remove-pages': { files: [PDF], options: { 'Pages to remove': '1' } },
  'pdf/extract-pages': { files: [PDF], options: { 'Pages to extract': '1' } },
  'pdf/grayscale': { files: [PDF], timeout: 60_000 },
  'pdf/repair': { files: [PDF], timeout: 60_000 },
  'pdf/to-powerpoint': { files: [PDF], timeout: 60_000 },
};

const RECORD = `
window.__makeVideo = async (seconds = 3) => {
  const canvas = document.createElement('canvas');
  canvas.width = 320; canvas.height = 240;
  canvas.style.cssText='position:fixed;bottom:0;right:0;width:40px;opacity:.01;z-index:9999';
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d'); let f=0;
  const frame=()=>{ctx.fillStyle='hsl('+((f*6)%360)+' 70% 50%)';ctx.fillRect(0,0,320,240);
    ctx.fillStyle='#fff';ctx.font='30px monospace';ctx.fillText('f'+f,20,130);f++;};
  frame();
  const ac = new AudioContext();
  const osc = ac.createOscillator(); const dest = ac.createMediaStreamDestination();
  osc.frequency.value = 440; osc.connect(dest); osc.start();
  const stream = canvas.captureStream(20);
  for (const t of dest.stream.getAudioTracks()) stream.addTrack(t);
  const rec=new MediaRecorder(stream,{mimeType:'video/webm'});
  const chunks=[];rec.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};
  rec.start(100); const t=setInterval(frame,50);
  await new Promise(r=>setTimeout(r,seconds*1000+200));
  clearInterval(t); osc.stop();
  await new Promise(r=>{rec.onstop=r;rec.stop()});
  canvas.remove();
  return new File(chunks,'clip.webm',{type:'video/webm'});
};`;

const browser = await chromium.launch();
const results = [];

{
  const page = await browser.newPage();
  const dataUrl = await page.evaluate(() => {
    const c = document.createElement('canvas');
    c.width = 400; c.height = 300;
    const x = c.getContext('2d');
    x.fillStyle = '#e0457b'; x.fillRect(0, 0, 200, 300);
    x.fillStyle = '#3b82f6'; x.fillRect(40, 40, 120, 220);
    return c.toDataURL('image/png');
  });
  writeFileSync(PNG, Buffer.from(dataUrl.split(',')[1], 'base64'));

  const textUrl = await page.evaluate(() => {
    const c = document.createElement('canvas');
    c.width = 1500; c.height = 360;
    const x = c.getContext('2d');
    x.fillStyle = '#fff'; x.fillRect(0, 0, 1500, 360);
    x.fillStyle = '#111'; x.font = '52px Georgia, serif';
    x.fillText('The quick brown fox jumps over the lazy dog.', 50, 120);
    x.fillText('Selamat pagi semua, terima kasih kerana datang.', 50, 230);
    return c.toDataURL('image/png');
  });
  writeFileSync(TEXT_PNG, Buffer.from(textUrl.split(',')[1], 'base64'));
  await page.close();
}

/**
 * A password-protected PDF, made by the site's own Protect tool.
 *
 * Unlock has nothing to say about a file that was never locked, so without
 * this the only thing it could report here is "nothing to unlock", which is
 * not the path anyone uses it for.
 */
async function lockedPdf() {
  const ctx = await browser.newContext({ serviceWorkers: 'block' });
  const page = await ctx.newPage();
  try {
    await page.goto(`${BASE}/pdf/protect`, { waitUntil: 'domcontentloaded' });
    await page.getByLabel('Password').fill('rahsia123');
    await page.locator('input[type=file]').setInputFiles(PDF);
    await page.getByRole('link', { name: 'Save' }).waitFor({ timeout: 60_000 });
    const href = await page.getByRole('link', { name: 'Save' }).getAttribute('href');
    const b64 = await page.evaluate(async (h) => {
      const bytes = new Uint8Array(await (await fetch(h)).arrayBuffer());
      let out = '';
      for (let i = 0; i < bytes.length; i += 0x8000) out += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      return btoa(out);
    }, href);
    const path = join(SCRATCH, 'locked.pdf');
    writeFileSync(path, Buffer.from(b64, 'base64'));
    return path;
  } finally {
    await ctx.close();
  }
}
const LOCKED = await lockedPdf();

async function check(page) {
  const body = await page.locator('body').innerText();
  const err = await page.locator('.text-err, [class*="text-err"]').allInnerTexts().catch(() => []);
  const done = /✓/.test(body) || (await page.getByRole('link', { name: 'Save' }).count()) > 0;
  const errText = err.map((e) => e.trim()).filter(Boolean).join(' | ');
  return { done, errText, body };
}

for (const [id, cfg] of Object.entries(FILE_CASES)) {
  if (only && !id.includes(only)) continue;
  const ctx = await browser.newContext({ serviceWorkers: 'block' });
  const page = await ctx.newPage();
  const consoleErrors = [];
  page.on('pageerror', (e) => consoleErrors.push(String(e).slice(0, 120)));
  try {
    await page.goto(`${BASE}/${id}`, { waitUntil: 'domcontentloaded' });
    if (cfg.video) {
      await page.addScriptTag({ content: RECORD });
      await page.evaluate(async () => {
        const f = await window.__makeVideo(3);
        const i = document.querySelector('input[type=file]');
        const dt = new DataTransfer(); dt.items.add(f);
        i.files = dt.files; i.dispatchEvent(new Event('change', { bubbles: true }));
      });
    } else {
      const input = page.locator('input[type=file]').first();
      if (cfg.filesFirst) await input.setInputFiles(cfg.files);
      for (const [label, value] of Object.entries(cfg.options ?? {})) {
        await page.getByLabel(label, { exact: true }).first().fill(value);
      }
      if (!cfg.filesFirst) await input.setInputFiles(cfg.locked ? [LOCKED] : cfg.files);
      if (cfg.action) {
        const button = page.getByRole('button', { name: cfg.action, exact: true });
        await button.and(page.locator(':enabled')).waitFor({ timeout: 15_000 });
        await button.click();
      }
    }
    const budget = cfg.timeout ?? 30_000;
    // A stage-first tool first asks for its text (deliberately, see
    // preview.spec.ts), then re-runs once it is typed. Wait for that run
    // rather than reading the prompt as the result.
    if (cfg.filesFirst) await page.locator('[data-status="done"]').waitFor({ timeout: budget }).catch(() => {});
    const start = Date.now();
    let state;
    while (Date.now() - start < budget) {
      state = await check(page);
      if (state.done || state.errText) break;
      await page.waitForTimeout(1000);
    }
    const secs = ((Date.now() - start) / 1000).toFixed(1);
    results.push({
      id,
      status: state.done ? 'PASS' : state.errText ? 'ERROR' : 'HANG',
      detail: state.done
        ? (state.body.match(/✓\s*([^\n]{0,70})/) || [null, ''])[1].trim()
        : state.errText || `no result after ${secs}s`,
      secs,
      pageErrors: consoleErrors.slice(0, 1),
    });
  } catch (e) {
    results.push({ id, status: 'THREW', detail: String(e).split('\n')[0].slice(0, 100), pageErrors: consoleErrors.slice(0, 1) });
  }
  await ctx.close();
}

for (const [id, input] of Object.entries(TEXT_CASES)) {
  if (only && !id.includes(only)) continue;
  const ctx = await browser.newContext({ serviceWorkers: 'block' });
  const page = await ctx.newPage();
  const consoleErrors = [];
  page.on('pageerror', (e) => consoleErrors.push(String(e).slice(0, 120)));
  try {
    await page.goto(`${BASE}/${id}`, { waitUntil: 'domcontentloaded' });
    if (input) await page.getByLabel(/^(Input|Original text)$/).fill(input);
    // Diff needs both panes; with one side empty every line reads as removed,
    // and removed lines are styled with the error colour.
    if (id === 'dev/diff') await page.getByLabel('Changed text').fill('alpha\nBETA\ngamma');
    await page.waitForTimeout(1200);
    const out = await page.locator('pre, img[alt*="QR"]').first();
    const has = (await out.count()) > 0;
    const text = has ? (await page.locator('pre').first().innerText().catch(() => '')) : '';
    const isImg = (await page.locator('img[alt*="QR"]').count()) > 0;
    // Scope the error probe to the error paragraph, not any red-tinted text.
    const errText = (await page.locator('p[class*="text-err"]').allInnerTexts().catch(() => []))
      .map((s) => s.trim()).filter(Boolean).join(' | ');
    const ok = isImg || (text && !/appears here as you type/.test(text));
    results.push({
      id,
      status: errText ? 'ERROR' : ok ? 'PASS' : 'EMPTY',
      detail: errText || (isImg ? 'QR image rendered' : text.replace(/\s+/g, ' ').slice(0, 60)),
      pageErrors: consoleErrors.slice(0, 1),
    });
  } catch (e) {
    results.push({ id, status: 'THREW', detail: String(e).split('\n')[0].slice(0, 100), pageErrors: consoleErrors.slice(0, 1) });
  }
  await ctx.close();
}

await browser.close();

const pad = (s, n) => String(s).padEnd(n);
console.log('\n  tool                    status   detail');
console.log('  ' + '-'.repeat(84));
for (const r of results.sort((a, b) => a.id.localeCompare(b.id))) {
  const mark = r.status === 'PASS' ? '✓' : '✗';
  console.log(`  ${mark} ${pad(r.id, 22)} ${pad(r.status, 8)} ${r.detail}`);
  if (r.pageErrors?.length) console.log(`      page error: ${r.pageErrors[0]}`);
}
const bad = results.filter((r) => r.status !== 'PASS');
console.log(`\n  ${results.length - bad.length}/${results.length} passing`);
