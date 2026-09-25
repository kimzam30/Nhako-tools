/**
 * Render the social preview images.
 *
 * Six images (five categories plus a default), not one per tool: a share card
 * is glanced at, and the category plus the brand is all it needs to carry.
 * Same Playwright-rasterise approach as scripts/icons.mjs, so there is no
 * image dependency and the mark stays defined in one place.
 */
import { chromium } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const CARDS = [
  ['default', 'Nhako Tools', 'Tools that run in your browser'],
  ['pdf', 'PDF tools', 'Merge, split, compress, convert. No upload'],
  ['media', 'Media tools', 'Compress video, extract audio, transcribe'],
  ['image', 'Image tools', 'Compress, passport photos, resize. No upload'],
  ['calc', 'Calculators', 'Take-home pay and CGPA, from official tables'],
  ['dev', 'Developer tools', 'JSON, JWT, Base64, hashes, and more'],
];

const mark = await readFile('public/favicon.svg', 'utf8');
await mkdir('public/og', { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });

for (const [slug, heading, sub] of CARDS) {
  await page.setContent(`<!doctype html><meta charset="utf-8">
    <style>
      * { margin: 0; box-sizing: border-box }
      /* Light and in the site's one system face, to match the site itself
         (light by default and SF only, since 2026-09-25). */
      body {
        width: 1200px; height: 630px; background: #ffffff; color: #131316;
        font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif;
        display: flex; flex-direction: column; justify-content: space-between;
        padding: 72px 80px;
      }
      /* 96 = 3 x the icon's 32px grid, so every art pixel lands whole. */
      .mark { width: 96px; height: 96px }
      .mark svg { display: block; width: 100%; height: 100% }
      h1 { font-size: 78px; line-height: 1.05; letter-spacing: -0.035em; font-weight: 700 }
      p  { font-size: 32px; color: #63636e; margin-top: 20px; letter-spacing: -0.01em }
      .foot { display: flex; align-items: center; gap: 14px; font-size: 26px; color: #63636e;
              border-top: 2px solid #ebebee; padding-top: 28px; font-variant-numeric: tabular-nums }
      .brand { color: #c7009b; font-weight: 600 }
    </style>
    <div class="mark">${mark}</div>
    <div>
      <h1>${heading}</h1>
      <p>${sub}</p>
    </div>
    <div class="foot">
      <span>tools.<span class="brand">nhako</span>.com</span>
      <span style="margin-left:auto">0 bytes uploaded</span>
    </div>`);

  await writeFile(`public/og/${slug}.png`, await page.screenshot());
  console.log(`  public/og/${slug}.png`);
}

await browser.close();
