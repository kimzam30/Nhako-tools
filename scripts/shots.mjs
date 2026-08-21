import { chromium } from '@playwright/test';

const shots = [
  ['/', 'home', 1280, 900],
  ['/pdf/merge', 'tool-file', 1280, 900],
  ['/dev/json', 'tool-text', 1280, 900],
  ['/', 'home-mobile', 390, 844],
];

const browser = await chromium.launch();
for (const theme of ['light', 'dark']) {
  for (const [path, name, w, h] of shots) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    await page.addInitScript((t) => { try { localStorage.setItem('theme', t); } catch { /* */ } }, theme);
    await page.goto(`http://localhost:4321${path}`, { waitUntil: 'networkidle' });
    if (name === 'tool-text') {
      await page.getByLabel('Input').fill('{"user":{"name":"Ada","admin":true,"scores":[98,72],"note":null}}');
      await page.waitForTimeout(300);
    }
    await page.screenshot({ path: `.design/nhako-tools-rebuild/screenshots/${name}-${theme}.png`, fullPage: name.startsWith('home') });
    await ctx.close();
  }
}
await browser.close();
console.log('captured');
