import { test, expect, type Page } from '@playwright/test';

/**
 * The teleprompter on a phone or tablet. Only this file runs on the handset
 * and tablet projects (android, ios, ios-landscape, ipados, ipados-landscape);
 * the desktop projects skip it.
 *
 * What it guards is the thing a phone gets wrong and a desktop never does: the
 * controls crowding the script off a small screen, a control landing out of
 * reach, and the system Back button dropping the presenter out of the tool
 * mid-take.
 */

const SETTINGS = 'nhako.teleprompter.settings';

async function fresh(page: Page, settings: Record<string, unknown> = {}) {
  await page.addInitScript(([key, s]) => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.clear();
    localStorage.setItem(key as string, JSON.stringify({ countdown: 0, ...(s as object) }));
  }, [SETTINGS, settings] as const);
}

/** Everything about the control bar that a small screen can get wrong. */
async function stageMetrics(page: Page) {
  return page.evaluate(() => {
    const play = document.querySelector('[data-testid=play]') as HTMLElement;
    const row = play.parentElement as HTMLElement;
    const bar = row.parentElement as HTMLElement;
    const view = document.querySelector('[data-testid=prompter-view]') as HTMLElement;
    const controls = [...bar.querySelectorAll('button')].map((e) => {
      const r = e.getBoundingClientRect();
      return { label: (e.textContent ?? '').trim().slice(0, 14), w: Math.round(r.width), h: Math.round(r.height), right: Math.round(r.right), bottom: Math.round(r.bottom) };
    });
    return {
      vw: innerWidth, vh: innerHeight,
      barPct: Math.round((bar.getBoundingClientRect().height / innerHeight) * 100),
      scriptPct: Math.round((view.getBoundingClientRect().height / innerHeight) * 100),
      overflowX: document.documentElement.scrollWidth > innerWidth + 1,
      offscreen: controls.filter((c) => c.right > innerWidth + 1 || c.bottom > innerHeight + 1).map((c) => c.label),
      // Apple and Google both put the minimum comfortable target at ~44 px.
      tooSmall: controls.filter((c) => c.h < 44 || c.w < 44).map((c) => c.label),
      hasMore: Boolean(document.querySelector('[data-testid=more]')),
    };
  });
}

test.describe('teleprompter on a handheld', () => {
  test('the controls leave the screen to the script, and all of them are reachable', async ({ page }) => {
    await fresh(page);
    await page.goto('/media/teleprompter');
    await page.getByTestId('start').click();
    await expect(page.getByTestId('ready-hint')).toBeVisible();

    const m = await stageMetrics(page);
    expect(m.offscreen, `off the screen at ${m.vw}x${m.vh}`).toEqual([]);
    expect(m.tooSmall, `under a 44px touch target at ${m.vw}x${m.vh}`).toEqual([]);
    expect(m.overflowX).toBe(false);
    // The script is what the presenter is here to read: it keeps most of the
    // screen even on the shortest phone in landscape.
    expect(m.scriptPct, `script only got ${m.scriptPct}% of ${m.vw}x${m.vh}`).toBeGreaterThanOrEqual(65);
    expect(m.barPct).toBeLessThanOrEqual(35);
  });

  test('a narrow or short screen keeps the secondary controls behind More', async ({ page }) => {
    await fresh(page);
    await page.goto('/media/teleprompter');
    await page.getByTestId('start').click();
    const { vw, vh, hasMore } = await stageMetrics(page);
    // Same rule the stage uses: room for everything, or hide the extras.
    expect(hasMore).toBe(vw <= 700 || vh <= 520);

    if (hasMore) {
      await expect(page.getByTestId('remote')).toBeHidden();
      await page.getByTestId('more').click();
      await expect(page.getByTestId('more-tray')).toBeVisible();
    }
    // Either way the phone remote is reachable before anything starts.
    await page.getByTestId('remote').click();
    await expect(page.getByTestId('room-code')).toBeVisible();
  });

  test('tapping the script pauses it', async ({ page }) => {
    await fresh(page);
    await page.goto('/media/teleprompter');
    await page.getByTestId('start').click();
    await page.getByTestId('play').click();
    await expect(page.getByTestId('play')).toHaveText(/Pause/);
    await page.getByTestId('prompter-view').tap();
    await expect(page.getByTestId('play')).toHaveText(/Play/);
  });

  test('the system Back button closes the stage instead of leaving the tool', async ({ page }) => {
    await fresh(page);
    await page.goto('/media/teleprompter');
    await page.getByTestId('start').click();
    await expect(page.getByTestId('prompter-view')).toBeVisible();

    await page.goBack();
    await expect(page.getByTestId('prompter-view')).toBeHidden();
    // Still on the tool, with the script and the library intact.
    expect(page.url()).toContain('/media/teleprompter');
    await expect(page.getByTestId('script')).toBeVisible();
  });

  test('the script and the settings stack until the screen is wide enough', async ({ page }) => {
    await fresh(page);
    await page.goto('/media/teleprompter');
    const layout = await page.evaluate(() => {
      const script = document.querySelector('[data-testid=script]')!.closest('.rounded-lg') as HTMLElement;
      const rail = (document.querySelector('[data-testid=start]') as HTMLElement).parentElement!.parentElement as HTMLElement;
      const s = script.getBoundingClientRect();
      const r = rail.getBoundingClientRect();
      return {
        vw: innerWidth,
        sideBySide: r.left >= s.right - 1,
        overflowX: document.documentElement.scrollWidth > innerWidth + 1,
      };
    });
    // The two-column rail is an lg-and-up layout: 1024 px.
    expect(layout.sideBySide).toBe(layout.vw >= 1024);
    expect(layout.overflowX).toBe(false);
  });
});

test.describe('browsers without a wake lock', () => {
  test('says the screen may sleep instead of letting it dim unexplained', async ({ page }) => {
    await fresh(page);
    // Firefox, and Safari before 16.4, reach the stage with no Wake Lock.
    await page.addInitScript(() => {
      const proto = Object.getPrototypeOf(navigator) as object;
      // @ts-expect-error deleting an optional API to stand in for an older browser
      delete proto.wakeLock;
    });
    await page.goto('/media/teleprompter');
    await expect(page.getByTestId('screen-sleep')).toBeVisible();
  });

  test('says nothing where the screen can be held awake', async ({ page }) => {
    await fresh(page);
    await page.goto('/media/teleprompter');
    const supported = await page.evaluate(() => 'wakeLock' in navigator);
    test.skip(!supported, 'this engine has no Wake Lock to begin with');
    await expect(page.getByTestId('screen-sleep')).toBeHidden();
  });
});
