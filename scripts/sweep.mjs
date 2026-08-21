/**
 * Exercise every tool in a real browser and report what actually happens.
 * Run against `npm run preview` (needs the COOP/COEP headers).
 */
import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const BASE = process.env.BASE ?? 'http://localhost:4321';
const only = process.argv[2];

const PDF = fileURLToPath(new URL('../e2e/fixtures/three-pages.pdf', import.meta.url));
const PNG = fileURLToPath(new URL('../dist/_fixtures/test.png', import.meta.url));

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

const FILE_CASES = {
  'pdf/merge': { files: [PDF, PDF] },
  'pdf/split': { files: [PDF] },
  'pdf/compress': { files: [PDF] },
  'pdf/to-image': { files: [PDF] },
  'pdf/to-text': { files: [PDF] },
  'pdf/rotate': { files: [PDF] },
  'pdf/watermark': { files: [PDF] },
  'image/compress': { files: [PNG] },
  'image/convert': { files: [PNG] },
  'image/resize': { files: [PNG] },
  'media/compress-video': { video: true, timeout: 90_000 },
  'media/extract-audio': { video: true, timeout: 90_000 },
  'media/transcribe': { video: true, timeout: 300_000, note: 'downloads ~39MB model' },
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

async function check(page, id) {
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
      await page.locator('input[type=file]').setInputFiles(cfg.files);
    }
    const budget = cfg.timeout ?? 30_000;
    const start = Date.now();
    let state;
    while (Date.now() - start < budget) {
      state = await check(page, id);
      if (state.done || state.errText) break;
      await page.waitForTimeout(1000);
    }
    const secs = ((Date.now() - start) / 1000).toFixed(1);
    results.push({
      id,
      status: state.done ? 'PASS' : state.errText ? 'ERROR' : 'HANG',
      detail: state.done
        ? (state.body.match(/✓\s*([^\n]{0,70})/) || [, ''])[1].trim()
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
