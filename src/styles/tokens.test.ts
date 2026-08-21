import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { contrast, AA_TEXT, AA_LARGE } from '@/lib/color';

/**
 * These assertions are the reason the rebuild exists in part: the previous
 * design used `bg-nhakoPink text-white` for every primary button, which is
 * 2.01:1 — a clear WCAG AA failure on every call to action on the site.
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

describe('brand pink', () => {
  it('is unchanged — #FF91E7 is fixed', () => {
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

  it('borders are distinguishable from their surface', () => {
    // Non-text contrast: 3:1 per WCAG 1.4.11 for meaningful UI boundaries.
    expect(contrast(t('--border-strong'), t('--bg'))).toBeGreaterThanOrEqual(1.5);
  });

  it('focus ring meets non-text contrast against the background', () => {
    expect(contrast(t('--accent-ring'), t('--bg'))).toBeGreaterThanOrEqual(AA_LARGE);
  });
});
