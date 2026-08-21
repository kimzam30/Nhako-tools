/**
 * Render the social preview images.
 *
 * Five images (four categories plus a default), not twenty-two: a share card
 * is glanced at, and the category plus the brand is all it needs to carry.
 * Same Playwright-rasterise approach as scripts/icons.mjs, so there is no
 * image dependency and the mark stays defined in one place.
 */
import { chromium } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const CARDS = [
  ['default', 'Nhako Tools', '22 tools that run in your browser'],
  ['pdf', 'PDF tools', 'Merge, split, compress, convert. No upload'],
  ['media', 'Media tools', 'Compress video, extract audio, transcribe'],
  ['image', 'Image tools', 'Compress, convert, resize. No upload'],
  ['dev', 'Developer tools', 'JSON, JWT, Base64, hashes, and more'],
];

const mark = await readFile('public/favicon.svg', 'utf8');
await mkdir('public/og', { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });

for (const [slug, heading, sub] of CARDS) {
  await page.setContent(`<!doctype html><meta charset="utf-8">
    <style>
      @font-face { font-family: 'IS'; src: url('data:font/woff2;base64,') }
      * { margin: 0; box-sizing: border-box }
      body {
        width: 1200px; height: 630px; background: #0b0b0e; color: #f2f2f5;
        font-family: ui-sans-serif, system-ui, -apple-system, sans-serif;
        display: flex; flex-direction: column; justify-content: space-between;
        padding: 72px 80px;
      }
      .mark { width: 88px; height: 88px }
      h1 { font-size: 78px; line-height: 1.05; letter-spacing: -0.035em; font-weight: 700 }
      p  { font-size: 32px; color: #9a9aa8; margin-top: 20px; letter-spacing: -0.01em }
      .foot { display: flex; align-items: center; gap: 14px; font-size: 26px; color: #9a9aa8;
              font-family: ui-monospace, monospace }
      .dot { width: 12px; height: 12px; border-radius: 99px; background: #ff91e7 }
      .brand { color: #ff91e7; font-weight: 600 }
    </style>
    <div class="mark">${mark}</div>
    <div>
      <h1>${heading}</h1>
      <p>${sub}</p>
    </div>
    <div class="foot">
      <span class="dot"></span>
      <span>tools.<span class="brand">nhako</span>.com</span>
      <span style="margin-left:auto">0 bytes uploaded</span>
    </div>`);

  await writeFile(`public/og/${slug}.png`, await page.screenshot());
  console.log(`  public/og/${slug}.png`);
}

await browser.close();
