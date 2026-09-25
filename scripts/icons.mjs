/**
 * Rasterise favicon.svg into the PNG sizes browsers and PWAs still want.
 * Uses the Playwright chromium that is already installed rather than adding an
 * image dependency. The SVG stays the single source of truth for the mark.
 *
 * Three shapes, because the platforms mask icons differently:
 *   - `any`: the favicon as drawn, rounded corners and all. Desktop install
 *     dialogs and the Chrome app list show it unmasked.
 *   - apple-touch-icon: full bleed, no transparency. iOS draws its own rounded
 *     corners and fills any transparent pixel with BLACK, so the favicon's
 *     rounded rect came out as a pink tile with black corners on a home screen.
 *   - maskable: full bleed with the mark inside the central 80% safe zone, so
 *     Android can cut it to a circle, squircle or teardrop without clipping it.
 */
import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';

const svg = readFileSync('public/favicon.svg', 'utf8');
const bg = svg.match(/<rect[^>]*fill="([^"]+)"/)[1];
const mark = svg.match(/<path[^>]*\/>/)[0];

// The same mark on a square with no corner radius. `scale` shrinks the mark
// around the centre. iOS keeps the favicon's proportions. Maskable needs it
// smaller: at full size the N's farthest corner is 31% of the width from the
// centre, which is inside the W3C's 40% safe circle, but Android's adaptive
// mask shows only the middle 72/108 (a 33% radius), and on the emulator's
// launcher the N all but touched the edge (checked 2026-09-25). At 0.72 it
// sits at 22%, the same breathing room the mark has on the favicon.
const square = (scale) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" fill="${bg}"/>` +
  `<g transform="translate(16 16) scale(${scale}) translate(-16 -16)">${mark}</g></svg>`;

const sizes = [
  [180, 'public/icons/apple-touch-icon.png', square(1)],
  [192, 'public/icons/icon-192.png', svg],
  [512, 'public/icons/icon-512.png', svg],
  [192, 'public/icons/maskable-192.png', square(0.72)],
  [512, 'public/icons/maskable-512.png', square(0.72)],
];

const browser = await chromium.launch();
for (const [size, out, source] of sizes) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(
    `<style>html,body{margin:0;padding:0}svg{display:block;width:${size}px;height:${size}px}</style>${source}`,
  );
  writeFileSync(out, await page.locator('svg').screenshot({ omitBackground: true }));
  await page.close();
  console.log(`  ${out}  ${size}x${size}`);
}
await browser.close();
