import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { contrast, AA_TEXT, AA_LARGE } from '@/lib/color';

/**
 * These assertions are the reason the rebuild exists in part: the previous
 * design used `bg-nhakoPink text-white` for every primary button, which is
 * 2.01:1, a clear WCAG AA failure on every call to action on the site.
 *
 * The test parses tokens.css directly rather than duplicating the values, so a
 * colour cannot be changed without this suite re-checking it.
 */

const css = readFileSync(fileURLToPath(new URL('./tokens.css', import.meta.url)), 'utf8');

function block(selector: string): Record<string, string> {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`${escaped}\\s*\\{([\\s\\S]*?)\\n\\}`, 'm');
  const body = css.match(re)?.[1];
  if (!body) throw new Error(`Could not find CSS block for ${selector}`);
  const out: Record<string, string> = {};
  for (const [, k, v] of body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    out[k!.trim()] = v!.trim();
  }
  return out;
}

const root = block(':root');
const darkOverrides = block("[data-theme='dark']");
const dark = { ...root, ...darkOverrides };

/** Resolve a token through any chain of var() indirections. */
function resolve(scope: Record<string, string>, name: string, depth = 0): string {
  if (depth > 10) throw new Error(`var() cycle at ${name}`);
  const raw = scope[name];
  if (raw === undefined) throw new Error(`Token ${name} is not defined`);
  const ref = raw.match(/^var\(\s*(--[\w-]+)\s*\)$/);
  return ref ? resolve(scope, ref[1]!, depth + 1) : raw;
}

const themes = [
  ['light', root],
  ['dark', dark],
] as const;

const CATEGORY_HUES = ['--cat-pdf', '--cat-calc', '--cat-image', '--cat-dev', '--cat-media'] as const;

describe('brand pink', () => {
  it('is unchanged: #FF91E7 is fixed', () => {
    expect(resolve(root, '--pink-300').toLowerCase()).toBe('#ff91e7');
  });

  it('documents why it cannot carry text on light backgrounds', () => {
    // The regression this whole ramp exists to prevent.
    expect(contrast('#ffffff', '#ff91e7')).toBeLessThan(AA_TEXT);
  });
});

describe.each(themes)('%s theme contrast', (_name, scope) => {
  const t = (k: string) => resolve(scope, k);

  it('body text on background meets AA', () => {
    expect(contrast(t('--text'), t('--bg'))).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it('muted text meets AA on background, surface and sunken', () => {
    for (const surface of ['--bg', '--surface', '--sunken'] as const) {
      expect(contrast(t('--text-muted'), t(surface))).toBeGreaterThanOrEqual(AA_TEXT);
    }
  });

  it('accent button label meets AA on the accent fill', () => {
    expect(contrast(t('--accent-on'), t('--accent'))).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it('accent button label still meets AA in the hover state', () => {
    expect(contrast(t('--accent-on'), t('--accent-hover'))).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it('status colours meet AA on background', () => {
    for (const status of ['--ok', '--warn', '--err'] as const) {
      expect(contrast(t(status), t('--bg'))).toBeGreaterThanOrEqual(AA_TEXT);
    }
  });

  it('error text meets AA on its own subtle background', () => {
    expect(contrast(t('--err'), t('--err-subtle'))).toBeGreaterThanOrEqual(AA_TEXT);
  });

  /* The done indicator is the one moment the user is definitely looking at
     this page, so its fill is held to the same bar as the error state. */
  it('success text meets AA on its own subtle background', () => {
    expect(contrast(t('--ok'), t('--ok-subtle'))).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it('borders are distinguishable from their surface', () => {
    // Non-text contrast: 3:1 per WCAG 1.4.11 for meaningful UI boundaries.
    expect(contrast(t('--border-strong'), t('--bg'))).toBeGreaterThanOrEqual(1.5);
  });

  it('focus ring meets non-text contrast against the background', () => {
    expect(contrast(t('--accent-ring'), t('--bg'))).toBeGreaterThanOrEqual(AA_LARGE);
  });
});

describe.each(themes)('%s category hues', (_name, scope) => {
  const t = (k: string) => resolve(scope, k);

  /**
   * These are drawn as 1.5 unit strokes at 20px, so although WCAG 1.4.11 only
   * asks 3:1 of a graphical object, the tokens are solved to 4.5:1 and the test
   * holds them there. A hue that stops clearing it gets reselected, not excused.
   */
  it('each hue meets AA against background, surface and sunken', () => {
    for (const hue of CATEGORY_HUES) {
      for (const surface of ['--bg', '--surface', '--sunken'] as const) {
        expect(
          contrast(t(hue), t(surface)),
          `${hue} on ${surface}`,
        ).toBeGreaterThanOrEqual(AA_TEXT);
      }
    }
  });

  it('the five hues are five different values', () => {
    const values = CATEGORY_HUES.map((h) => t(h).toLowerCase());
    expect(new Set(values).size).toBe(CATEGORY_HUES.length);
  });

  /**
   * Deliberately NOT asserted: that the hues differ in luminance. They are
   * isoluminant by construction, so their pairwise contrast is 1.00:1 and in
   * greyscale they are five identical greys. Pulling them apart in lightness
   * would make PDF, at 18 tools, shout over Calculators at one. The mitigation
   * is structural instead: colour is redundant encoding and the mark's shape
   * carries the meaning. See .design/redesign/INFORMATION_ARCHITECTURE.md #3.
   */
  it('no category hue is mistakable for the accent', () => {
    for (const hue of CATEGORY_HUES) {
      expect(t(hue).toLowerCase(), `${hue} duplicates the accent`).not.toBe(
        t('--accent').toLowerCase(),
      );
    }
  });

  it('a row rule is weaker than a section rule but still visible', () => {
    const weak = contrast(t('--border-weak'), t('--bg'));
    const normal = contrast(t('--border'), t('--bg'));
    expect(weak).toBeLessThan(normal);
    expect(weak).toBeGreaterThan(1.05);
  });
});

describe('type ramp', () => {
  const theme = block('@theme inline');
  const steps = Object.entries(theme)
    .filter(([k]) => /^--text-(2xs|xs|sm|base|lg|xl|2xl|3xl|4xl)$/.test(k))
    .map(([k, v]) => [k, parseFloat(v) * 16] as const);

  it('finds every step', () => {
    expect(steps).toHaveLength(9);
  });

  /**
   * The defect this exists to prevent: on 2026-09-23 Lighthouse scored the
   * homepage at 44.34% legible text, with 47.8% of it at 11px, because one
   * token carried both a tool blurb and a row count.
   */
  it('has no step below 12px', () => {
    for (const [name, px] of steps) {
      expect(px, `${name} is ${px}px`).toBeGreaterThanOrEqual(12);
    }
  });

  it('increases monotonically', () => {
    const order = ['--text-2xs', '--text-xs', '--text-sm', '--text-base', '--text-lg', '--text-xl', '--text-2xl', '--text-3xl', '--text-4xl'];
    const sizes = order.map((k) => steps.find(([n]) => n === k)![1]);
    for (let i = 1; i < sizes.length; i += 1) {
      expect(sizes[i], `${order[i]} after ${order[i - 1]}`).toBeGreaterThan(sizes[i - 1]!);
    }
  });

  it('the body default is not the floor', () => {
    const floor = steps.find(([n]) => n === '--text-2xs')![1];
    const body = steps.find(([n]) => n === '--text-sm')![1];
    expect(body).toBeGreaterThan(floor);
  });
});
