/**
 * Rasterise favicon.svg into the PNG sizes browsers and PWAs still want.
 * Uses the Playwright chromium that is already installed rather than adding an
 * image dependency — the SVG stays the single source of truth for the mark.
 */
import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';

const svg = readFileSync('public/favicon.svg', 'utf8');
const sizes = [
  [180, 'public/icons/apple-touch-icon.png'],
  [192, 'public/icons/icon-192.png'],
  [512, 'public/icons/icon-512.png'],
];

const browser = await chromium.launch();
for (const [size, out] of sizes) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(
    `<style>html,body{margin:0;padding:0}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`,
  );
  writeFileSync(out, await page.locator('svg').screenshot({ omitBackground: true }));
  await page.close();
  console.log(`  ${out}  ${size}x${size}`);
}
await browser.close();
