import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { contrast, AA_TEXT } from '@/lib/color';

/**
 * The NeraOS panel is a gradient, so every text colour that sits on it is
 * checked against every stop, not an average. Parsed from the CSS itself,
 * like tokens.test.ts, so a colour cannot drift without this re-running.
 */

const read = (f: string) => readFileSync(fileURLToPath(new URL(f, import.meta.url)), 'utf8');
const nera = read('./nera.css');
const tokens = read('./tokens.css');

function block(css: string, selector: string): Record<string, string> {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const body = css.match(new RegExp(`${escaped}\\s*\\{([\\s\\S]*?)\\n\\}`, 'm'))?.[1];
  if (!body) throw new Error(`Could not find CSS block for ${selector}`);
  const out: Record<string, string> = {};
  for (const [, k, v] of body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) out[k!.trim()] = v!.trim();
  return out;
}

const light = { ...block(tokens, ':root'), ...block(nera, ':root') };
const dark = { ...light, ...block(tokens, "[data-theme='dark']"), ...block(nera, "[data-theme='dark']") };

function resolve(scope: Record<string, string>, name: string): string {
  const raw = scope[name];
  if (raw === undefined) throw new Error(`Token ${name} is not defined`);
  const ref = raw.match(/^var\(\s*(--[\w-]+)\s*\)$/);
  return ref ? resolve(scope, ref[1]!) : raw;
}

const stops = (scope: Record<string, string>) => [...scope['--nera-panel']!.matchAll(/#[0-9a-f]{6}/gi)].map((m) => m[0]);

describe.each([['light', light], ['dark', dark]] as const)('%s NeraOS panel', (_name, scope) => {
  it('has three gradient stops to check', () => {
    expect(stops(scope)).toHaveLength(3);
  });

  it.each(['--nera-win', '--nera-ink', '--text-muted', '--err'])('%s meets AA on every stop', (token) => {
    for (const stop of stops(scope)) {
      expect(contrast(resolve(scope, token), stop), `${token} on ${stop}`).toBeGreaterThanOrEqual(AA_TEXT);
    }
  });

  it('the loader percentage (ink-soft) meets AA on every stop', () => {
    for (const stop of stops(scope)) {
      expect(contrast(resolve(scope, '--nera-ink-soft'), stop)).toBeGreaterThanOrEqual(AA_TEXT);
    }
  });
});
