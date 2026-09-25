import { test, expect, type Page } from '@playwright/test';
import JSZip from 'jszip';

/**
 * Phase 3: the teleprompter. Scrolling is checked by reading the text's
 * actual position over time, recording by reading the saved file's bytes,
 * and the phone remote by driving a real second page through the live relay.
 */

const SETTINGS = 'nhako.teleprompter.settings';

/** Start every test from a clean browser, with no countdown unless asked. */
async function fresh(page: Page, settings: Record<string, unknown> = {}) {
  await page.addInitScript(([key, s]) => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.clear();
    localStorage.setItem(key as string, JSON.stringify({ countdown: 0, ...(s as object) }));
  }, [SETTINGS, settings] as const);
}

/**
 * Playwright's fill is several steps (select all, then insert), and in WebKit
 * hydration can land between them. A person's keystroke is one event, and
 * typing before hydration has its own test below, so every other test waits
 * for the island first.
 */
async function writeScript(page: Page, text: string) {
  await expect(page.locator('astro-island[ssr]')).toHaveCount(0);
  await page.getByTestId('script').fill(text);
}

/**
 * Open the stage and press play. The stage opens idle by design, so every test
 * that wants movement asks for it, exactly as a presenter does.
 */
async function startPlaying(page: Page, which: 'start' | 'start-record' = 'start') {
  await page.getByTestId(which).click();
  await expect(page.getByTestId('ready-hint')).toBeVisible();
  await page.getByTestId('play').click();
}

/** The text's offset under the reading line, in pixels scrolled. */
const scrolled = (page: Page) => page.getByTestId('prompter-text').evaluate((el) => {
  const m = /translate3d\(0px, (-?[\d.]+)px/.exec((el as HTMLElement).style.transform);
  const view = el.parentElement!.clientHeight;
  const guide = Number(localStorage.getItem('guide') ?? 0);
  return { offset: m ? Number(m[1]) : NaN, view, guide, height: el.scrollHeight };
});

const lorem = (n: number, word = 'word') => Array.from({ length: n }, (_, i) => `${word}${i}`).join(' ');

test.describe('teleprompter', () => {
  test('scrolls at the words-per-minute you set', async ({ page }) => {
    await fresh(page, { wpm: 180 });
    await page.goto('/media/teleprompter');
    await writeScript(page, Array.from({ length: 30 }, () => lorem(12)).join('\n\n'));
    await expect(page.getByTestId('stats')).toContainText('360 words');
    await startPlaying(page);
    await expect(page.getByTestId('play')).toHaveText('Pause');

    const a = await scrolled(page);
    await page.waitForTimeout(2000);
    const b = await scrolled(page);
    const px = a.offset - b.offset;
    // 180 wpm is 3 words a second; each word is height/360 px tall on average.
    const expected = 3 * (a.height / 360) * 2;
    expect(px).toBeGreaterThan(expected * 0.8);
    expect(px).toBeLessThan(expected * 1.2);
  });

  test('stops at a [PAUSE] cue and carries on when tapped', async ({ page }) => {
    await fresh(page, { wpm: 260, fontSize: 24 });
    await page.goto('/media/teleprompter');
    await writeScript(page, `${lorem(20)} [PAUSE] ${lorem(400, 'after')}`);
    await startPlaying(page);
    await expect(page.getByText('Paused at a cue. Tap to continue.')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('play')).toHaveText('Play');
    const at = (await scrolled(page)).offset;
    await page.waitForTimeout(600);
    expect((await scrolled(page)).offset).toBe(at);

    await page.getByTestId('prompter-view').click();
    await expect(page.getByTestId('play')).toHaveText('Pause');
    await page.waitForTimeout(600);
    expect((await scrolled(page)).offset).toBeLessThan(at);
  });

  test('opens the stage idle, so there is time to set up before anything moves', async ({ page }) => {
    await fresh(page, { wpm: 200 });
    await page.goto('/media/teleprompter');
    await writeScript(page, Array.from({ length: 30 }, () => lorem(12)).join('\n\n'));
    await page.getByTestId('start').click();

    await expect(page.getByTestId('prompter-view')).toBeVisible();
    await expect(page.getByTestId('ready-hint')).toBeVisible();
    await expect(page.getByTestId('play')).toHaveText('Play');
    // The first frame is what puts the text under the reading line; in WebKit
    // that can land after the stage is already on screen.
    await expect.poll(async () => Number.isFinite((await scrolled(page)).offset), { timeout: 3000 }).toBe(true);
    // Long enough that an auto-start at 200 wpm would have moved hundreds of px.
    const at = (await scrolled(page)).offset;
    await page.waitForTimeout(1500);
    expect((await scrolled(page)).offset).toBe(at);

    // The phone remote is reachable while it waits, which is the point.
    await page.getByTestId('remote').click();
    await expect(page.getByTestId('room-code')).toBeVisible();
    await page.getByRole('button', { name: 'Done' }).click();
    expect((await scrolled(page)).offset).toBe(at);

    await page.getByTestId('play').click();
    await expect(page.getByTestId('play')).toHaveText('Pause');
    await expect(page.getByTestId('ready-hint')).toBeHidden();
    await expect.poll(async () => (await scrolled(page)).offset, { timeout: 3000 }).toBeLessThan(at);
  });

  test('counts down before it starts', async ({ page }) => {
    await fresh(page, { countdown: 3 });
    await page.goto('/media/teleprompter');
    await startPlaying(page);
    await expect(page.getByTestId('countdown')).toHaveText('3');
    await expect(page.getByTestId('countdown')).toHaveText('2');
    await expect(page.getByTestId('countdown')).toBeHidden({ timeout: 4000 });
    await expect(page.getByTestId('play')).toHaveText('Pause');
  });

  test('keys: space pauses, arrows change speed, Page Down jumps a section, Esc closes', async ({ page }) => {
    await fresh(page, { wpm: 140 });
    await page.goto('/media/teleprompter');
    await writeScript(page, `# One\n${lorem(60)}\n# Two\n${lorem(60)}\n# Three\n${lorem(60)}`);
    await startPlaying(page);
    await expect(page.getByTestId('play')).toHaveText('Pause');
    await page.keyboard.press('Space');
    await expect(page.getByTestId('play')).toHaveText('Play');

    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await expect(page.getByTestId('wpm')).toHaveText('160 wpm');
    await page.keyboard.press('ArrowLeft');
    await expect(page.getByTestId('wpm')).toHaveText('150 wpm');

    const tops = await page.locator('[data-section]').evaluateAll((els) => els.map((e) => (e as HTMLElement).offsetTop));
    await page.keyboard.press('Home');
    await page.waitForTimeout(700);
    // From the very top, the next section is the first heading, then the second.
    await page.keyboard.press('PageDown');
    await page.waitForTimeout(700);
    await page.keyboard.press('PageDown');
    // The glide settles on the second heading.
    await expect.poll(async () => {
      const s = await scrolled(page);
      return Math.abs(s.view * 0.22 - s.offset - tops[1]!) <= 1;
    }, { timeout: 3000 }).toBe(true);

    // Like Safari, WebKit spends the first Esc leaving full screen.
    await page.keyboard.press('Escape');
    if (await page.getByTestId('prompter-view').isVisible()) await page.keyboard.press('Escape');
    await expect(page.getByTestId('prompter-view')).toBeHidden();
    // Speed changes on the stage are remembered.
    await page.reload();
    await expect(page.locator('[data-setting=wpm]')).toHaveValue('150');
  });

  test('mirrors the text for a beam-splitter rig', async ({ page }) => {
    await fresh(page, { mirrorX: true });
    await page.goto('/media/teleprompter');
    await page.getByTestId('start').click();
    await expect(page.getByTestId('prompter-view')).toHaveCSS('transform', 'matrix(-1, 0, 0, 1, 0, 0)');
  });

  test('keeps scripts in the library across reloads, and imports Word files', async ({ page }) => {
    await fresh(page);
    await page.goto('/media/teleprompter');
    await writeScript(page, '# My talk\nFirst line of my talk.');
    await expect(page.getByTestId('library')).toContainText('My talk', { timeout: 3000 });

    const zip = new JSZip();
    zip.file('word/document.xml', '<w:document><w:body><w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>From Word</w:t></w:r></w:p><w:p><w:r><w:t>Hello &amp; welcome.</w:t></w:r></w:p></w:body></w:document>');
    const buffer = await zip.generateAsync({ type: 'nodebuffer' });
    await page.getByTestId('import').setInputFiles({ name: 'speech.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer });
    await expect(page.getByTestId('script')).toHaveValue('# From Word\n\nHello & welcome.');

    await page.waitForTimeout(600);
    await page.reload();
    await expect(page.getByTestId('script')).toHaveValue('# From Word\n\nHello & welcome.');
    const titles = await page.getByTestId('library').locator('option').allTextContents();
    expect(titles).toEqual(expect.arrayContaining(['speech', 'My talk']));
  });

  test('voice-follow moves the text to the words being spoken', async ({ page }) => {
    // A stand-in for the browser's speech recogniser that the test can speak through.
    await page.addInitScript(() => {
      class FakeRecognition {
        lang = ''; continuous = false; interimResults = false;
        onresult: ((e: unknown) => void) | null = null; onend: (() => void) | null = null; onerror: unknown = null;
        start() { (window as unknown as { say: (s: string) => void }).say = (s: string) => this.onresult?.({ resultIndex: 0, results: [Object.assign([{ transcript: s }], { isFinal: true })] }); }
        stop() { this.onend?.(); }
      }
      Object.assign(window, { SpeechRecognition: FakeRecognition, webkitSpeechRecognition: FakeRecognition });
    });
    await fresh(page, { wpm: 60 });
    await page.goto('/media/teleprompter');
    const words = Array.from({ length: 300 }, (_, i) => `w${i}`);
    words.splice(80, 3, 'purple', 'elephant', 'dancing');
    await writeScript(page, words.join(' '));
    await page.getByTestId('voice').check();
    await startPlaying(page);
    await expect(page.getByText('Listening')).toBeVisible();

    const before = await scrolled(page);
    await page.waitForTimeout(800);
    // With voice-follow on, nothing moves until you speak.
    expect((await scrolled(page)).offset).toBe(before.offset);

    await page.evaluate(() => (window as unknown as { say: (s: string) => void }).say('w30 w31 w32'));
    await page.waitForTimeout(1000);
    const top33 = await page.locator('[data-w="33"]').evaluate((e) => (e as HTMLElement).offsetTop);
    const s = await scrolled(page);
    // The page and this test each round once: allow a pixel.
    expect(Math.abs(s.view * 0.22 - s.offset - top33)).toBeLessThanOrEqual(1);

    await page.evaluate(() => (window as unknown as { say: (s: string) => void }).say('purple elephant dancing'));
    await page.waitForTimeout(1200);
    const top83 = await page.locator('[data-w="83"]').evaluate((e) => (e as HTMLElement).offsetTop);
    const s2 = await scrolled(page);
    expect(Math.abs(s2.view * 0.22 - s2.offset - top83)).toBeLessThanOrEqual(1);

    // Something far ahead or unrelated does not yank the text away.
    await page.evaluate(() => (window as unknown as { say: (s: string) => void }).say('w290 w291 w292'));
    await page.waitForTimeout(800);
    expect((await scrolled(page)).offset).toBe(s2.offset);
  });

  test('a script typed before the page finished loading is kept', async ({ page }) => {
    await fresh(page);
    let release!: () => void;
    const gate = new Promise<void>((r) => { release = r; });
    await page.route(/\/_astro\/Teleprompter\.[^/]+\.js$/, async (route) => { await gate; await route.continue(); });
    await page.goto('/media/teleprompter', { waitUntil: 'domcontentloaded' });
    await page.locator('#prompter-script').fill('# Early bird\nTyped straight away.');
    release();
    await expect(page.getByTestId('stats')).toContainText('3 words');
    await expect(page.getByTestId('script')).toHaveValue('# Early bird\nTyped straight away.');
    await expect(page.getByTestId('library')).toContainText('Early bird');
  });

  test('select all before the page loads, paste after: the paste replaces the sample', async ({ page }) => {
    await fresh(page);
    let release!: () => void;
    const gate = new Promise<void>((r) => { release = r; });
    await page.route(/\/_astro\/Teleprompter\.[^/]+\.js$/, async (route) => { await gate; await route.continue(); });
    await page.goto('/media/teleprompter', { waitUntil: 'domcontentloaded' });
    await page.locator('#prompter-script').focus();
    await page.keyboard.press('ControlOrMeta+a');
    release();
    await expect(page.locator('astro-island[ssr]')).toHaveCount(0);
    await page.waitForTimeout(300);
    await page.keyboard.insertText('pasted after load');
    await expect(page.getByTestId('script')).toHaveValue('pasted after load');
    await expect(page.getByTestId('stats')).toContainText('3 words');
  });

  test('a file chosen for import before the page finished loading is imported, and the library kept', async ({ page }) => {
    await fresh(page);
    await page.goto('/media/teleprompter');
    await writeScript(page, '# Keep me\nAlready saved.');
    await expect(page.getByTestId('library')).toContainText('Keep me', { timeout: 3000 });
    await page.waitForTimeout(600);

    let release!: () => void;
    const gate = new Promise<void>((r) => { release = r; });
    await page.route(/\/_astro\/Teleprompter\.[^/]+\.js$/, async (route) => { await gate; await route.continue(); });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByTestId('import').setInputFiles({ name: 'early.txt', mimeType: 'text/plain', buffer: Buffer.from('Imported early.') });
    release();
    await expect(page.getByTestId('script')).toHaveValue('Imported early.');
    const titles = await page.getByTestId('library').locator('option').allTextContents();
    expect(titles).toEqual(expect.arrayContaining(['early', 'Keep me']));
  });

  test('the Malay page is in Malay', async ({ page }) => {
    await fresh(page);
    await page.goto('/ms/media/teleprompter');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Teleprompter');
    await expect(page.getByTestId('start')).toHaveText('Mula');
    await expect(page.getByTestId('script')).toHaveValue(/Selamat datang/);
    await expect(page.getByTestId('stats')).toContainText('perkataan');
  });
});

test.describe('recording', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'Chromium provides a fake camera and microphone');
  test.use({ permissions: ['camera', 'microphone'] });

  test('records camera and mic to a real video file that survives a reload', async ({ page }) => {
    await fresh(page);
    await page.goto('/media/teleprompter');
    // Start and record brings the camera up but does not record: that is the
    // presenter's call, once they have framed the shot.
    await page.getByTestId('start-record').click();
    await expect(page.getByTestId('ready-hint')).toBeVisible();
    await expect(page.getByTestId('rec-badge')).toBeHidden();
    await page.getByTestId('record').click();
    await expect(page.getByTestId('rec-badge')).toBeVisible();
    await page.waitForTimeout(3000);
    await page.getByTestId('record').click();
    await expect(page.getByText(/^Saved take-.* on this device\.$/)).toBeVisible();
    await page.getByTestId('close').click();

    const take = page.getByTestId('takes').locator('li').first();
    await expect(take).toContainText(/take-\d{8}-\d{6}\.(mp4|webm)/);
    await expect(take).toContainText('Stored on this device');

    const href = (await take.locator('a[download]').getAttribute('href'))!;
    const head = await page.evaluate(async (h) => {
      const b = new Uint8Array(await (await fetch(h)).arrayBuffer());
      return { size: b.length, bytes: [...b.subarray(0, 12)] };
    }, href);
    expect(head.size).toBeGreaterThan(20_000);
    const isWebm = head.bytes.slice(0, 4).join() === [0x1a, 0x45, 0xdf, 0xa3].join();
    const isMp4 = String.fromCharCode(...head.bytes.slice(4, 8)) === 'ftyp';
    expect(isWebm || isMp4).toBe(true);

    // A video element can play it back, and it has sound and picture.
    const meta = await page.evaluate(async (h) => {
      const v = document.createElement('video');
      v.src = h; v.muted = true;
      await new Promise((r, j) => { v.onloadedmetadata = r; v.onerror = j; });
      return { w: v.videoWidth, h: v.videoHeight };
    }, href);
    expect(meta.w).toBeGreaterThan(0);

    await page.reload();
    await expect(page.getByTestId('takes').locator('li')).toHaveCount(1);
    page.once('dialog', (d) => void d.accept());
    await page.getByTestId('takes').getByRole('button', { name: 'Delete' }).click();
    await expect(page.getByText('Recordings you make appear here.', { exact: false })).toBeVisible();
  });

  test('Record records without scrolling, and Play scrolls without touching the recording', async ({ page }) => {
    await fresh(page);
    await page.goto('/media/teleprompter');
    await writeScript(page, Array.from({ length: 20 }, () => lorem(12)).join('\n\n'));
    await page.getByTestId('start-record').click();
    await page.getByTestId('record').click();
    await expect(page.getByTestId('rec-badge')).toBeVisible();
    await expect(page.getByTestId('ready-hint')).toBeHidden();
    const before = (await scrolled(page)).offset;
    await page.waitForTimeout(1000);
    expect((await scrolled(page)).offset).toBe(before);
    await expect(page.getByTestId('play')).toHaveText('Play');

    await page.getByTestId('play').click();
    await expect.poll(async () => (await scrolled(page)).offset).toBeLessThan(before - 5);
    // Stopping the recording leaves the script running.
    await page.getByTestId('record').click();
    await expect(page.getByText(/^Saved take-.* on this device\.$/)).toBeVisible();
    await expect(page.getByTestId('rec-badge')).toBeHidden();
    await expect(page.getByTestId('play')).toHaveText('Pause');
  });

  test('Play and record starts the recording and the scroll together, after the countdown', async ({ page }) => {
    await fresh(page, { countdown: 3 });
    await page.goto('/media/teleprompter');
    await writeScript(page, Array.from({ length: 20 }, () => lorem(12)).join('\n\n'));
    await page.getByTestId('start-record').click();
    await expect(page.getByTestId('ready-hint')).toContainText('Play and record');
    // Timestamps from inside the page: when the REC badge appears, and the
    // first frame the text moves.
    await page.evaluate(() => {
      const w = window as unknown as { marks: Record<string, number> };
      w.marks = {};
      const text = document.querySelector('[data-testid=prompter-text]') as HTMLElement;
      const start = text.style.transform;
      new MutationObserver(() => {
        if (!w.marks.badge && document.querySelector('[data-testid=rec-badge]')) w.marks.badge = performance.now();
      }).observe(document.body, { childList: true, subtree: true });
      const watch = () => {
        if (text.style.transform !== start) { w.marks.scroll = performance.now(); return; }
        requestAnimationFrame(watch);
      };
      requestAnimationFrame(watch);
    });
    await page.getByTestId('play-record').click();
    await expect(page.getByTestId('countdown')).toBeVisible();
    await expect(page.getByTestId('play-record')).toHaveText('Stop');
    // Nothing is recorded during the countdown.
    await expect(page.getByTestId('rec-badge')).toBeHidden();
    await expect(page.getByTestId('rec-badge')).toBeVisible({ timeout: 6000 });
    await expect(page.getByTestId('countdown')).toBeHidden();
    await expect(page.getByTestId('play')).toHaveText('Pause');
    const marks = await page.waitForFunction(() => {
      const m = (window as unknown as { marks: Record<string, number> }).marks;
      return m.badge && m.scroll ? m : null;
    }).then((h) => h.jsonValue());
    // The same tick starts both; allow a couple of frames for React and paint.
    expect(Math.abs(marks!.scroll! - marks!.badge!)).toBeLessThan(100);

    await page.waitForTimeout(1500);
    await page.getByTestId('play-record').click();
    await expect(page.getByText(/^Saved take-.* on this device\.$/)).toBeVisible();
    await expect(page.getByTestId('rec-badge')).toBeHidden();
    await expect(page.getByTestId('play')).toHaveText('Play');
    await expect(page.getByTestId('play-record')).toHaveText('Play and record');
  });

  test('stopping Play and record during the countdown leaves no empty take behind', async ({ page }) => {
    await fresh(page, { countdown: 5 });
    await page.goto('/media/teleprompter');
    await page.getByTestId('start-record').click();
    await page.getByTestId('play-record').click();
    await expect(page.getByTestId('countdown')).toBeVisible();
    await page.getByTestId('play-record').click();
    await expect(page.getByTestId('countdown')).toBeHidden();
    await expect(page.getByTestId('play-record')).toHaveText('Play and record');
    await page.waitForTimeout(500);
    await expect(page.getByTestId('rec-badge')).toBeHidden();
    await page.getByTestId('close').click();
    const files = await page.evaluate(async () => {
      const d = await (await navigator.storage.getDirectory()).getDirectoryHandle('teleprompter-takes', { create: true });
      const names: string[] = [];
      for await (const k of (d as unknown as { keys(): AsyncIterable<string> }).keys()) names.push(k);
      return names;
    });
    expect(files).toEqual([]);
    await expect(page.getByText('Recordings you make appear here.', { exact: false })).toBeVisible();
  });
});

/**
 * Why the camera "sometimes does not show up" on phones and tablets, one cause
 * per test. Chromium's fake camera stands in for the device; getUserMedia,
 * play() and the track are stubbed only where a phone behaves differently.
 */
test.describe('camera on phones and tablets', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'Chromium provides a fake camera and microphone');
  test.use({ permissions: ['camera', 'microphone'] });

  /** Make getUserMedia refuse `times` times with `name`, counting every call.
   *  `site` is what the Permissions API reports for the site meanwhile. */
  async function refuse(page: Page, name: string, times = 1, site?: 'denied' | 'granted') {
    if (site) {
      await page.addInitScript((state) => {
        const real = navigator.permissions.query.bind(navigator.permissions);
        let left = 1;
        navigator.permissions.query = (d) => (left-- > 0 ? Promise.resolve({ state } as PermissionStatus) : real(d));
      }, site);
    }
    await page.addInitScript(([n, k]) => {
      const w = window as unknown as { gumCalls: number };
      w.gumCalls = 0;
      let left = k as number;
      const real = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
      navigator.mediaDevices.getUserMedia = async (c) => {
        w.gumCalls++;
        if (left-- > 0) throw new DOMException('stubbed', n as string);
        return real(c);
      };
    }, [name, times] as const);
  }

  test('a refusal keeps you on the page, says where the setting is, and Try again opens the stage', async ({ page }) => {
    await fresh(page);
    await refuse(page, 'NotAllowedError', 1, 'denied');
    await page.goto('/media/teleprompter');
    await expect(page.locator('astro-island[ssr]')).toHaveCount(0);
    await page.getByTestId('start-record').click();
    await expect(page.getByTestId('camera-error')).toContainText('was blocked');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    // Asked once: a refusal is not retried behind the person's back.
    expect(await page.evaluate(() => (window as unknown as { gumCalls: number }).gumCalls)).toBe(1);

    await page.getByTestId('camera-error-retry').click();
    await expect(page.getByTestId('camera-preview')).toBeVisible();
    await expect(page.getByTestId('ready-hint')).toContainText('Camera on');
    await expect.poll(() => page.locator('[data-testid=camera-preview] video').evaluate((v: HTMLVideoElement) => v.readyState >= 2 && !v.paused)).toBe(true);
    await expect(page.getByTestId('camera-error')).toHaveCount(0);
  });

  test('refused while the site holds the permission, it points at the system settings instead', async ({ page }) => {
    // Found on the Android emulator: Chrome denied the camera by Android
    // itself. The site reads as granted, so the site setting is not the fix.
    await fresh(page);
    await refuse(page, 'NotAllowedError', 1, 'granted');
    await page.goto('/media/teleprompter');
    await expect(page.locator('astro-island[ssr]')).toHaveCount(0);
    await page.getByTestId('start-record').click();
    await expect(page.getByTestId('camera-error')).toContainText('keeping the camera from this browser');
    await page.getByTestId('camera-error-retry').click();
    await expect(page.getByTestId('camera-preview')).toBeVisible();
  });

  test('a camera that will not open at 1080p opens at whatever size it can', async ({ page }) => {
    await fresh(page);
    await refuse(page, 'OverconstrainedError');
    await page.goto('/media/teleprompter');
    await expect(page.locator('astro-island[ssr]')).toHaveCount(0);
    await page.getByTestId('start-record').click();
    await expect(page.getByTestId('camera-preview')).toBeVisible();
    expect(await page.evaluate(() => (window as unknown as { gumCalls: number }).gumCalls)).toBe(2);
  });

  test('a second tap while the camera is opening does not ask twice', async ({ page }) => {
    await fresh(page);
    await page.addInitScript(() => {
      const w = window as unknown as { gumCalls: number };
      w.gumCalls = 0;
      const real = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
      // A permission prompt the person takes a moment over.
      navigator.mediaDevices.getUserMedia = async (c) => { w.gumCalls++; await new Promise((r) => setTimeout(r, 800)); return real(c); };
    });
    await page.goto('/media/teleprompter');
    await expect(page.locator('astro-island[ssr]')).toHaveCount(0);
    await page.getByTestId('start-record').click();
    await expect(page.getByTestId('start-record')).toHaveText('Opening camera…');
    await page.getByTestId('start-record').click({ force: true });
    await expect(page.getByTestId('camera-preview')).toBeVisible();
    // Record straight away: the stage already has the camera, so no new request.
    await page.getByTestId('record').click();
    await expect(page.getByTestId('rec-badge')).toBeVisible();
    await page.getByTestId('record').click();
    await expect(page.getByText(/^Saved take-/)).toBeVisible();
    expect(await page.evaluate(() => (window as unknown as { gumCalls: number }).gumCalls)).toBe(1);
  });

  test('a preview the browser will not autoplay gets a tap-to-show button', async ({ page }) => {
    await fresh(page);
    await page.addInitScript(() => {
      // iOS in Low Power Mode: play() without a tap is refused, even muted.
      const real = HTMLMediaElement.prototype.play;
      let refused = false;
      HTMLMediaElement.prototype.play = function () {
        if (!refused && this instanceof HTMLVideoElement && this.srcObject) {
          refused = true;
          return Promise.reject(new DOMException('stubbed', 'NotAllowedError'));
        }
        return real.call(this);
      };
    });
    await page.goto('/media/teleprompter');
    await expect(page.locator('astro-island[ssr]')).toHaveCount(0);
    await page.getByTestId('start-record').click();
    await page.getByTestId('camera-tap').click();
    await expect(page.getByTestId('camera-tap')).toHaveCount(0);
    await expect.poll(() => page.locator('[data-testid=camera-preview] video').evaluate((v: HTMLVideoElement) => !v.paused)).toBe(true);
  });

  test('plain Start can still bring the camera up from the Camera button', async ({ page }) => {
    await fresh(page);
    await page.goto('/media/teleprompter');
    await page.getByTestId('start').click();
    await expect(page.getByTestId('camera-preview')).toHaveCount(0);
    await page.getByTestId('camera').click();
    await expect(page.getByTestId('camera-preview')).toBeVisible();
    await expect(page.getByTestId('camera')).toHaveAttribute('aria-pressed', 'true');
  });

  test('a camera that ends under the page says so, and Try again brings it back', async ({ page }) => {
    await fresh(page);
    await page.goto('/media/teleprompter');
    await expect(page.locator('astro-island[ssr]')).toHaveCount(0);
    await page.getByTestId('start-record').click();
    await expect(page.getByTestId('camera-preview')).toBeVisible();
    // Another app takes the camera: the browser ends the track and fires ended.
    await page.locator('[data-testid=camera-preview] video').evaluate((v: HTMLVideoElement) => {
      const tr = (v.srcObject as MediaStream).getVideoTracks()[0]!;
      tr.stop();
      tr.dispatchEvent(new Event('ended'));
    });
    await expect(page.getByTestId('camera-preview')).toHaveCount(0);
    await expect(page.getByTestId('stage-message')).toContainText('camera stopped');
    await page.getByTestId('camera-retry').click();
    await expect(page.getByTestId('camera-preview')).toBeVisible();
    await expect(page.getByTestId('stage-message')).toHaveCount(0);
  });

  test('back from another app with a dead camera, it reopens by itself', async ({ page }) => {
    await fresh(page);
    await page.goto('/media/teleprompter');
    await expect(page.locator('astro-island[ssr]')).toHaveCount(0);
    await page.getByTestId('start-record').click();
    const video = page.locator('[data-testid=camera-preview] video');
    await expect(video).toBeVisible();
    const firstId = await video.evaluate((v: HTMLVideoElement) => (v.srcObject as MediaStream).id);
    // The phone ended the track while the page was hidden, with no event.
    await video.evaluate((v: HTMLVideoElement) => (v.srcObject as MediaStream).getVideoTracks()[0]!.stop());
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    await expect.poll(() => video.evaluate((v: HTMLVideoElement) => {
      const s = v.srcObject as MediaStream | null;
      return s ? `${s.id !== undefined}:${s.getVideoTracks()[0]?.readyState}` : 'none';
    }), { timeout: 5000 }).toBe('true:live');
    expect(await video.evaluate((v: HTMLVideoElement) => (v.srcObject as MediaStream).id)).not.toBe(firstId);
  });
});

test.describe('phone remote (live relay)', () => {
  test('a phone page controls the tablet through the relay', async ({ browser }) => {
    test.setTimeout(60_000);
    const tabletCtx = await browser.newContext();
    const tablet = await tabletCtx.newPage();
    await fresh(tablet, { wpm: 140 });
    await tablet.goto('/media/teleprompter');
    await writeScript(tablet, `# Part one\n${lorem(200)}\n# Part two\n${lorem(200)}`);
    await startPlaying(tablet);
    await expect(tablet.getByTestId('play')).toHaveText('Pause');
    await tablet.keyboard.press('Space');
    await expect(tablet.getByTestId('play')).toHaveText('Play');
    await tablet.getByTestId('remote').click();
    const code = (await tablet.getByTestId('room-code').textContent())!;
    expect(code).toMatch(/^[2-9A-HJKMNP-Z]{10}$/);
    await expect(tablet.getByTestId('remote-qr').locator('svg')).toBeVisible();
    await expect(tablet.getByText('Waiting for your phone…')).toBeVisible({ timeout: 20_000 });

    const phoneCtx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const phone = await phoneCtx.newPage();
    await phone.goto(`/media/teleprompter/remote#${code}`);
    // The code is taken out of the address bar at once.
    expect(new URL(phone.url()).hash).toBe('');
    await expect(phone.getByTestId('remote-status')).toContainText('Connected', { timeout: 20_000 });
    await expect(tablet.getByText('Phone connected.')).toBeVisible({ timeout: 10_000 });
    await tablet.getByRole('button', { name: 'Done' }).click();

    await phone.getByTestId('rc-faster').click();
    await expect(tablet.getByTestId('wpm')).toHaveText('150 wpm', { timeout: 10_000 });
    await expect(phone.getByTestId('rc-wpm')).toHaveText('150', { timeout: 10_000 });

    await phone.getByTestId('rc-toggle').click();
    await expect(tablet.getByTestId('play')).toHaveText('Pause', { timeout: 10_000 });
    await expect(phone.getByTestId('remote-status')).toContainText('Playing', { timeout: 10_000 });
    await phone.getByTestId('rc-toggle').click();
    await expect(tablet.getByTestId('play')).toHaveText('Play', { timeout: 10_000 });

    // A reload keeps the phone in the same room.
    await phone.reload();
    await expect(phone.getByTestId('remote-status')).toContainText('Connected', { timeout: 20_000 });

    await tabletCtx.close();
    await phoneCtx.close();
  });

  test('the remote asks for a code when opened without one', async ({ page }) => {
    await page.goto('/media/teleprompter/remote');
    await page.getByTestId('code').fill('abc');
    await page.getByRole('button', { name: 'Connect' }).click();
    await expect(page.getByRole('alert')).toHaveText('That code should be 10 letters and numbers.');
  });
});
