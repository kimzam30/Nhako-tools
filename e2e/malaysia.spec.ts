import { test, expect, type Page } from '@playwright/test';
import { fileURLToPath } from 'node:url';

/**
 * Phase 1: Bahasa Melayu, target sizes, the salary calculator and the photo
 * maker. Expected payroll figures come from LHDN's published worked example,
 * not from this code.
 */

const fixture = (name: string) => fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url));

/** A noisy JPEG, the worst case for compression, drawn by the browser. */
async function noisyJpeg(page: Page, w: number, h: number) {
  const b64 = await page.evaluate(async ([w, h]) => {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const x = c.getContext('2d')!;
    const img = x.createImageData(w, h);
    let s = 7;
    for (let i = 0; i < img.data.length; i += 4) {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      img.data[i] = s & 255; img.data[i + 1] = (s >> 8) & 255; img.data[i + 2] = (s >> 16) & 255; img.data[i + 3] = 255;
    }
    x.putImageData(img, 0, 0);
    return c.toDataURL('image/jpeg', 0.95).split(',')[1]!;
  }, [w, h] as const);
  return { name: 'noisy.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(b64, 'base64') };
}

async function savedBytes(page: Page, selector = 'a[download]') {
  const href = await page.locator(selector).first().getAttribute('href');
  return page.evaluate(async (h) => new Uint8Array(await (await fetch(h!)).arrayBuffer()).length, href);
}

test.describe('Bahasa Melayu', () => {
  test('the Malay page is in Malay and points at its English twin', async ({ page }) => {
    await page.goto('/ms/pdf/merge');
    await expect(page.locator('html')).toHaveAttribute('lang', 'ms');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Gabung PDF');
    await expect(page.locator('link[rel=alternate][hreflang=en]')).toHaveAttribute('href', 'https://tools.nhako.com/pdf/merge');
    await expect(page.locator('link[rel=canonical]')).toHaveAttribute('href', 'https://tools.nhako.com/ms/pdf/merge');
    await page.getByRole('link', { name: /^EN,/ }).click();
    await expect(page).toHaveURL(/\/pdf\/merge$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Merge PDF');
  });

  test('searching in Malay finds a tool, and results stay on Malay pages', async ({ page }) => {
    await page.goto('/ms');
    await page.locator('#tool-search').fill('gabung');
    await expect(page.getByRole('link', { name: /Gabung PDF/ })).toBeVisible();
    await page.keyboard.press('ControlOrMeta+k');
    await page.locator('#palette-input').fill('gaji');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/ms\/calc\/take-home-pay$/);
  });
});

test.describe('salary calculator', () => {
  test("reproduces LHDN's worked example: RM5,500, spouse working, 3 children -> PCB RM110.00", async ({ page }) => {
    await page.goto('/calc/take-home-pay');
    await page.getByLabel('Monthly salary').fill('5500');
    await page.getByLabel('Household').selectOption('spouse-working');
    await page.getByRole('spinbutton', { name: 'Children under 18' }).fill('3');
    await expect(page.getByTestId('pcb')).toHaveText('− RM 110.00');
    // 5,500 - 605 EPF - 68.10 SOCSO - 10.90 EIS - 110 PCB
    await expect(page.getByTestId('net-pay')).toHaveText('RM 4,706.00');
  });
});

test.describe('target size', () => {
  test('a preset page gets an image under 100 KB', async ({ page }) => {
    await page.goto('/image/compress/100kb');
    await expect(page.locator('#opt-target')).toHaveValue('100');
    await page.locator('input[type=file]').setInputFiles(await noisyJpeg(page, 2400, 1600));
    await expect(page.getByText(/Under 100 KB: [\d,]+ bytes/)).toBeVisible({ timeout: 60_000 });
    expect(await savedBytes(page)).toBeLessThanOrEqual(100_000);
  });

  test('a PDF already under the target keeps its text layer', async ({ page }) => {
    await page.goto('/pdf/compress/100kb');
    await page.locator('input[type=file]').setInputFiles(fixture('three-pages.pdf'));
    await expect(page.getByText(/Under 100 KB: .*text still selectable/)).toBeVisible();
  });
});

test.describe('passport photo maker', () => {
  test('makes a 35 x 50 mm photo at 600 dpi and a 4R sheet at 300 dpi', async ({ page }) => {
    await page.goto('/image/passport-photo');
    await page.locator('input[type=file]').setInputFiles(await noisyJpeg(page, 1200, 1600));
    await expect(page.getByTestId('save-photo')).toContainText('827×1181');
    const dpi = await page.evaluate(async () => {
      const read = async (id: string) => {
        const a = document.querySelector<HTMLAnchorElement>(`[data-testid=${id}]`)!;
        const b = new Uint8Array(await (await fetch(a.href)).arrayBuffer());
        return { units: b[13], density: (b[14]! << 8) | b[15]! };
      };
      return { photo: await read('save-photo'), sheet: await read('save-sheet') };
    });
    expect(dpi).toEqual({ photo: { units: 1, density: 600 }, sheet: { units: 1, density: 300 } });
    await expect(page.getByText('4 copies on a 6×4 inch sheet')).toBeVisible();
  });

  test('the SPA preset keeps the digital photo under 1 MB', async ({ page }) => {
    await page.goto('/image/passport-photo');
    await page.getByLabel('Photo type').selectOption('spa-myresume');
    await page.locator('input[type=file]').setInputFiles(await noisyJpeg(page, 1600, 2000));
    await expect(page.getByText(/Under 1 MB: [\d,]+ bytes/)).toBeVisible();
    expect(await savedBytes(page, '[data-testid=save-photo]')).toBeLessThanOrEqual(1_000_000);
  });

  test('the preview can be moved with the keyboard', async ({ page }) => {
    await page.goto('/image/passport-photo');
    await page.locator('input[type=file]').setInputFiles(await noisyJpeg(page, 2000, 1600));
    const frame = page.getByRole('img', { name: /Photo preview/ });
    await frame.focus();
    const before = await frame.evaluate((c: HTMLCanvasElement) => c.toDataURL());
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowLeft');
    await expect.poll(() => frame.evaluate((c: HTMLCanvasElement) => c.toDataURL())).not.toBe(before);
  });
});

test.describe('choices made before the page is interactive', () => {
  async function delayIsland(page: Page, name: string) {
    let release!: () => void;
    const gate = new Promise<void>((r) => { release = r; });
    await page.route(new RegExp(`/_astro/${name}\\.[^/]+\\.js$`), async (route) => { await gate; await route.continue(); });
    return release;
  }

  test('a photo type chosen before hydration is the one used', async ({ page }) => {
    const release = await delayIsland(page, 'PhotoMaker');
    await page.goto('/image/passport-photo', { waitUntil: 'domcontentloaded' });
    await page.getByLabel('Photo type').selectOption('spa-myresume');
    release();
    await page.locator('input[type=file]').setInputFiles(await noisyJpeg(page, 1200, 1600));
    await expect(page.getByText(/Under 1 MB: [\d,]+ bytes/)).toBeVisible();
  });

  test('a salary typed before hydration is the one calculated', async ({ page }) => {
    const release = await delayIsland(page, 'SalaryCalculator');
    await page.goto('/calc/take-home-pay', { waitUntil: 'domcontentloaded' });
    await page.getByLabel('Monthly salary').fill('5500');
    await page.getByLabel('Household').selectOption('spouse-working');
    release();
    await page.getByRole('spinbutton', { name: 'Children under 18' }).fill('3');
    await expect(page.getByTestId('pcb')).toHaveText('− RM 110.00');
  });
});
