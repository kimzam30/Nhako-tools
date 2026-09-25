import { test, expect, devices, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * The site as an installable app (2026-09-25).
 *
 * Covers what makes it installable, the install prompt on each platform it
 * handles differently, and the touch-screen rules that were measured against
 * Apple's HIG in the same pass: every control at least 44px, and no text
 * field under 16px, the size below which iOS Safari zooms the page in.
 */

test.describe('installable', () => {
  test('the manifest carries what Chrome and Android need to install it', async ({ page, request }) => {
    await page.goto('/');
    const href = await page.locator('link[rel="manifest"]').getAttribute('href');
    const manifest = await (await request.get(href!)).json();

    expect(manifest.id).toBe('/');
    expect(manifest.display).toBe('standalone');
    expect(manifest.start_url).toBe('/');
    const sizes = (purpose: string) =>
      manifest.icons.filter((i: { purpose: string }) => i.purpose === purpose).map((i: { sizes: string }) => i.sizes);
    expect(sizes('any')).toEqual(expect.arrayContaining(['192x192', '512x512']));
    expect(sizes('maskable')).toEqual(expect.arrayContaining(['192x192', '512x512']));

    // Every icon and every shortcut resolves. A shortcut to a 404 would open
    // the installed app on an error page from the home screen.
    for (const icon of manifest.icons) expect((await request.get(icon.src)).status(), icon.src).toBe(200);
    for (const s of manifest.shortcuts) expect((await request.get(s.url)).status(), s.url).toBe(200);
    // Screenshots are what turn Chrome's one-line install dialog into the
    // richer sheet; both form factors, and the sizes they claim.
    expect(manifest.screenshots.map((x: { form_factor: string }) => x.form_factor)).toEqual(expect.arrayContaining(['narrow', 'wide']));
    for (const shot of manifest.screenshots) expect((await request.get(shot.src)).status(), shot.src).toBe(200);
  });

  test('iOS gets its home-screen tags and a full-bleed icon', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('meta[name="apple-mobile-web-app-capable"]')).toHaveAttribute('content', 'yes');
    await expect(page.locator('meta[name="apple-mobile-web-app-title"]')).toHaveAttribute('content', 'Nhako');
    await expect(page.locator('meta[name="viewport"]')).toHaveAttribute('content', /viewport-fit=cover/);

    // iOS fills transparent pixels with black, so the icon must have none.
    const opaque = await page.evaluate(async () => {
      const img = new Image();
      img.src = '/icons/apple-touch-icon.png';
      await img.decode();
      const c = document.createElement('canvas');
      c.width = img.width; c.height = img.height;
      const ctx = c.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      const data = ctx.getImageData(0, 0, c.width, c.height).data;
      for (let i = 3; i < data.length; i += 4) if ((data[i] ?? 0) < 255) return false;
      return true;
    });
    expect(opaque).toBe(true);
  });
});

test.describe('install prompt', () => {
  /** Chrome's install event, faked: Playwright cannot make a real one fire. */
  const fireInstallEvent = (page: Page) =>
    page.evaluate(() => {
      const event = new Event('beforeinstallprompt', { cancelable: true }) as Event & Record<string, unknown>;
      (window as unknown as { __prompted: number }).__prompted = 0;
      event.prompt = () => { (window as unknown as { __prompted: number }).__prompted++; return Promise.resolve(); };
      event.userChoice = Promise.resolve({ outcome: 'accepted' });
      dispatchEvent(event);
    });

  test.describe('in desktop Firefox', () => {
    // A browser with no install at all. The WebKit project cannot stand in
    // for "cannot install": it reports itself as Safari on a Mac, which can.
    test.use({ userAgent: 'Mozilla/5.0 (X11; Linux x86_64; rv:131.0) Gecko/20100101 Firefox/131.0' });

    test('nothing is offered where the browser cannot install', async ({ page }) => {
      await page.goto('/');
      await expect(page.locator('footer [data-install-row]')).toBeHidden();
      await expect(page.locator('#install-card')).toBeHidden();
    });
  });

  test.describe('in Safari on a Mac', () => {
    test.use({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15' });

    test('offers File, then Add to Dock', async ({ page }) => {
      await page.goto('/');
      await page.locator('footer').getByRole('button', { name: 'Install app' }).click();
      const card = page.getByRole('dialog', { name: 'Install Nhako Tools' });
      await expect(card.getByRole('listitem')).toHaveCount(3);
      await expect(card.getByRole('listitem').nth(1)).toContainText('Add to Dock');
    });
  });

  test("Chrome's own install dialog is one tap away once the browser offers it", async ({ page }) => {
    await page.goto('/');
    await fireInstallEvent(page);
    const entry = page.locator('footer').getByRole('button', { name: 'Install app' });
    await expect(entry).toBeVisible();
    await entry.click();

    const card = page.getByRole('dialog', { name: 'Install Nhako Tools' });
    await expect(card).toBeVisible();
    await card.getByRole('button', { name: 'Install', exact: true }).click();
    await expect(card).toBeHidden();
    expect(await page.evaluate(() => (window as unknown as { __prompted: number }).__prompted)).toBe(1);
  });

  test('appears on its own on a second page view, and Not now puts it away', async ({ page }) => {
    await page.goto('/');
    await page.goto('/pdf');
    await fireInstallEvent(page);
    const card = page.getByRole('dialog', { name: 'Install Nhako Tools' });
    await expect(card).toBeVisible({ timeout: 6000 });
    await card.getByRole('button', { name: 'Not now' }).click();
    await expect(card).toBeHidden();

    const snoozed = await page.evaluate(() => Number(localStorage.getItem('nhako:install-snooze')));
    expect(snoozed - Date.now()).toBeGreaterThan(13 * 864e5);
    await page.goto('/image');
    await fireInstallEvent(page);
    await page.waitForTimeout(3500);
    await expect(card).toBeHidden();
  });

  test.describe('on an iPhone', () => {
    test.use({ userAgent: devices['iPhone 14'].userAgent, viewport: { width: 390, height: 664 }, hasTouch: true, isMobile: true });

    test('shows the Share, Add to Home Screen steps from the More sheet', async ({ page }) => {
      await page.goto('/');
      await page.getByRole('navigation', { name: 'Sections' }).getByRole('button', { name: 'More' }).click();
      await page.getByRole('dialog', { name: 'More' }).getByRole('button', { name: 'Install app' }).click();

      const card = page.getByRole('dialog', { name: 'Install Nhako Tools' });
      await expect(card).toBeVisible();
      await expect(card.getByRole('listitem')).toHaveCount(3);
      await expect(card.getByRole('listitem').nth(1)).toContainText('Add to Home Screen');
      // Sits above the tab bar, not over it.
      const [cardBox, barBox] = await Promise.all([card.boundingBox(), page.locator('[data-tabbar]').boundingBox()]);
      expect(cardBox!.y + cardBox!.height).toBeLessThanOrEqual(barBox!.y);
    });
  });
});

test.describe('touch screens', () => {
  test.use({ viewport: { width: 393, height: 659 }, hasTouch: true, isMobile: true, deviceScaleFactor: 3 });

  /**
   * Every visible control is at least 44 x 44. A link inside a sentence is
   * exempt (WCAG 2.5.8's inline exception, and the HIG's own practice); an
   * input wrapped in its label is measured as the label, which is what a
   * finger actually hits.
   */
  const undersized = (page: Page) =>
    page.evaluate(() => {
      const vw = document.documentElement.clientWidth;
      const shown = (el: Element) => {
        const r = el.getBoundingClientRect();
        const s = getComputedStyle(el);
        return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && !el.closest('[hidden], .sr-only');
      };
      const inView = (el: Element) => {
        const r = el.getBoundingClientRect();
        const cx = r.left + r.width / 2;
        for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
          const s = getComputedStyle(p);
          if (/(auto|scroll|hidden)/.test(s.overflowX)) {
            const q = p.getBoundingClientRect();
            if (cx < q.left || cx > q.right) return false;
          }
        }
        return cx >= 0 && cx <= vw;
      };
      return [...document.querySelectorAll('a[href], button, input:not([type=hidden]), select, textarea, summary')]
        .map((el) => (el instanceof HTMLInputElement && el.closest('label')) || el)
        .filter((el, i, all) => all.indexOf(el) === i)
        .filter((el) => shown(el) && inView(el))
        .filter((el) => {
          const p = el.closest('p');
          return !(el.tagName === 'A' && p && (p.textContent ?? '').trim().length > (el.textContent ?? '').trim().length + 20);
        })
        .filter((el) => { const r = el.getBoundingClientRect(); return Math.min(r.width, r.height) < 43.5; })
        .map((el) => `${(el.getAttribute('aria-label') || el.textContent || el.tagName).trim().slice(0, 40)} ${Math.round(el.getBoundingClientRect().width)}x${Math.round(el.getBoundingClientRect().height)}`);
    });

  for (const path of ['/', '/pdf', '/pdf/merge', '/image/compress', '/favourites', '/feedback', '/malaysia', '/dev/uuid', '/pdf/protect', '/media/teleprompter', '/calc/take-home-pay', '/calc/cgpa', '/image/passport-photo']) {
    test(`${path}: every control is at least 44px`, async ({ page }) => {
      await page.goto(path);
      expect(await undersized(page)).toEqual([]);
    });
  }

  test('no text field is small enough to make iOS zoom the page', async ({ page }) => {
    for (const path of ['/', '/calc/cgpa', '/image/compress', '/feedback', '/favourites']) {
      await page.goto(path);
      const small = await page.evaluate(() =>
        [...document.querySelectorAll('input:not([type=hidden], [type=checkbox], [type=radio], [type=range], [type=file]), select, textarea')]
          .filter((el) => el.getBoundingClientRect().width > 0 && !el.closest('[hidden], .sr-only'))
          .filter((el) => parseFloat(getComputedStyle(el).fontSize) < 16)
          .map((el) => el.getAttribute('aria-label') || el.id || el.tagName));
      expect(small, path).toEqual([]);
    }
  });

  test('the drop zone asks a thumb to choose, not to drop', async ({ page }) => {
    await page.goto('/pdf/merge');
    await expect(page.getByText('Choose PDFs')).toBeVisible();
    await expect(page.getByText('Drop PDFs here, or browse')).toBeHidden();
  });

  test('a tool page has a back button to its category instead of a breadcrumb', async ({ page }) => {
    await page.goto('/pdf/sign');
    await expect(page.getByRole('navigation', { name: 'Breadcrumb' })).toBeHidden();
    await page.getByRole('link', { name: 'Back to PDF' }).click();
    await expect(page).toHaveURL('/pdf');
  });
});

test.describe('app shell accessibility', () => {
  test.use({ userAgent: devices['iPhone 14'].userAgent, viewport: { width: 390, height: 664 }, hasTouch: true, isMobile: true });

  for (const theme of ['light', 'dark'] as const) {
    test(`the tab bar, the More sheet and the install card pass axe (${theme})`, async ({ page }) => {
      await page.addInitScript((t) => localStorage.setItem('theme', t), theme);
      await page.goto('/pdf');
      const scan = async () => {
        const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
        return violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
      };
      expect(await scan()).toEqual([]);

      await page.getByRole('button', { name: 'More' }).click();
      await expect(page.getByRole('dialog', { name: 'More' })).toBeVisible();
      await page.waitForTimeout(350);
      expect(await scan()).toEqual([]);

      await page.getByRole('dialog', { name: 'More' }).getByRole('button', { name: 'Install app' }).click();
      await expect(page.getByRole('dialog', { name: 'Install Nhako Tools' })).toBeVisible();
      await page.waitForTimeout(300);
      expect(await scan()).toEqual([]);
    });
  }

  test('the dark mode switch says what it is and whether it is on', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'More' }).click();
    const toggle = page.getByRole('switch', { name: 'Dark mode' });
    await expect(toggle).toHaveAttribute('aria-checked', 'false');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-checked', 'true');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#0b0b0e');
  });
});
