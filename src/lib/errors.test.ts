import { describe, expect, it } from 'vitest';
import { errorKind, friendlyError } from './errors';
import { ToolError } from '../tools/types';

describe('friendlyError', () => {
  it('passes a ToolError through: it is already written for people', () => {
    expect(friendlyError(new ToolError('Wrong password.'), 'en', 'x')).toBe('Wrong password.');
  });

  it.each([
    [new RangeError('Array buffer allocation failed'), 'memory'],
    [new Error('RuntimeError: memory access out of bounds'), 'memory'],
    [new Error('Aborted(OOM)... out of memory'), 'memory'],
    [new TypeError('Failed to fetch dynamically imported module: https://tools.nhako.com/_astro/x.js'), 'stale'],
    [new TypeError('Importing a module script failed.'), 'stale'],
    [new TypeError('Failed to fetch'), 'network'],
    [new TypeError('Load failed'), 'network'],
  ] as const)('maps %s to %s', (err, kind) => {
    expect(errorKind(err)).toBe(kind);
  });

  it('speaks Malay on Malay pages', () => {
    expect(friendlyError(new Error('memory access out of bounds'), 'ms', 'x')).toMatch(/memori/);
  });

  it('keeps an unknown error, and falls back when there is no message', () => {
    expect(friendlyError(new Error('Odd thing'), 'en', 'fallback')).toBe('Odd thing');
    expect(friendlyError(undefined, 'en', 'fallback')).toBe('fallback');
  });
});
